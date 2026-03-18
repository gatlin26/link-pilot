/**
 * 消息处理器
 */

import {
  extensionSettingsStorage,
  managedBacklinkStorage,
  submissionSessionStorage,
  websiteProfileStorage,
  backlinkSubmissionStorage,
} from '@extension/storage';
import type {
  BaseMessage,
  BaseResponse,
  GetFillPageStateResponse,
  MatchResult,
} from '@extension/shared/lib/types/messages';
import type { BacklinkSubmission } from '@extension/shared/lib/types/models';
import { MessageType } from '@extension/shared/lib/types/messages';
import type { FillPageState, ManagedBacklink, WebsiteProfile } from '@extension/shared';
import { autoFillService, formDetector, type FormField, type FormDetectionResult } from '../form-handlers';
import { templateLearner } from '../template';
import { createAhrefsInterceptor } from '../collectors/ahrefs-api-interceptor';
import { isAhrefsBacklinkChecker, detectVerificationPage, waitForVerificationComplete } from '../collectors/ahrefs-detector';
import type { CollectedBacklink } from '@extension/shared';

const PASSIVE_INTERCEPT_MAX_COUNT = 20;
const CACHE_TTL_MS = 10 * 60 * 1000;

let activeInterceptor: ReturnType<typeof createAhrefsInterceptor> | null = null;
let lastDetectionResult: FormDetectionResult | null = null;
let formAnchorElements: HTMLElement[] = [];
let formAnchorIndex = 0;
let autoFillStarted = false;
let learnedTemplateKey: string | null = null;
let interceptorMaxCount = 0;
let interceptorPassiveMode = false;
let cachedBacklinks: CollectedBacklink[] = [];
let cachedBacklinksAt = 0;
let pendingCollectionMaxCount: number | null = null;
let passiveRestartTimer: number | null = null;
let autoPassiveBootstrapStarted = false;
let passiveBootstrapRetryTimer: number | null = null;
let passiveBootstrapRetryCount = 0;

// === 新增：智能匹配状态 ===
let currentMatchResult: MatchResult | null = null;
let lastUrl: string = window.location.href;

// === 新增：悬浮球状态 ===
interface FloatingPanelState {
  isOpen: boolean;
  state: 'expanded' | 'collapsed';
}
let floatingPanelState: FloatingPanelState = { isOpen: false, state: 'collapsed' };

// === 新增：待提交记录 ===
interface PendingSubmission {
  profileId: string;
  backlinkId: string;
  comment: string;
  timestamp: number;
}

// 从 sessionStorage 恢复待提交记录
function loadPendingSubmission(): PendingSubmission | null {
  try {
    const stored = sessionStorage.getItem('link-pilot-pending-submission');
    if (!stored) return null;
    const data = JSON.parse(stored) as PendingSubmission;
    // 检查是否超时（5分钟）
    if (Date.now() - data.timestamp > 5 * 60 * 1000) {
      sessionStorage.removeItem('link-pilot-pending-submission');
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

// 保存待提交记录到 sessionStorage
function savePendingSubmission(data: PendingSubmission): void {
  try {
    sessionStorage.setItem('link-pilot-pending-submission', JSON.stringify(data));
  } catch (error) {
    console.error('[Content Script] 保存待提交记录失败:', error);
  }
}

// 清除待提交记录
function clearPendingSubmission(): void {
  try {
    sessionStorage.removeItem('link-pilot-pending-submission');
  } catch (error) {
    console.error('[Content Script] 清除待提交记录失败:', error);
  }
}

let pendingSubmission: PendingSubmission | null = loadPendingSubmission();

function cacheBacklinks(backlinks: CollectedBacklink[]): void {
  cachedBacklinks = backlinks.slice();
  cachedBacklinksAt = Date.now();
}

function hasFreshCachedBacklinks(maxCount: number): boolean {
  if (cachedBacklinks.length < maxCount) {
    return false;
  }
  return Date.now() - cachedBacklinksAt <= CACHE_TTL_MS;
}

function notifyCollectionComplete(backlinks: CollectedBacklink[]): void {
  void chrome.runtime.sendMessage({ type: 'COLLECTION_COMPLETE', payload: { backlinks } }).catch(error => {
    console.error('[Content Script] 发送 COLLECTION_COMPLETE 失败:', error);
  });
}

function notifyCollectionError(errorMessage: string): void {
  void chrome.runtime.sendMessage({ type: 'COLLECTION_ERROR', payload: { error: errorMessage } }).catch(error => {
    console.error('[Content Script] 发送 COLLECTION_ERROR 失败:', error);
  });
}

function schedulePassiveInterceptorRestart(): void {
  if (passiveRestartTimer !== null) {
    window.clearTimeout(passiveRestartTimer);
  }

  passiveRestartTimer = window.setTimeout(() => {
    passiveRestartTimer = null;
    void ensurePassiveInterceptorBootstrap();
  }, 600);
}

async function ensureMainWorldBridge(): Promise<void> {
  // 主世界桥接脚本已通过 manifest 自动注入
  // 不需要手动请求注入，直接返回
  console.log('[Content Script] 桥接脚本已通过 manifest 自动注入');
  return Promise.resolve();
}

function createAndStartInterceptor(maxCount: number, passiveMode: boolean): void {
  if (activeInterceptor?.isRunning()) {
    activeInterceptor.stop();
  }

  interceptorMaxCount = maxCount;
  interceptorPassiveMode = passiveMode;
  activeInterceptor = createAhrefsInterceptor({
    maxCount,
    onCollected: (backlinks: CollectedBacklink[]) => {
      cacheBacklinks(backlinks);

      const pendingMaxCount = pendingCollectionMaxCount;
      if (pendingMaxCount !== null) {
        notifyCollectionComplete(backlinks.slice(0, Math.min(pendingMaxCount, backlinks.length)));
        pendingCollectionMaxCount = null;
      } else if (!passiveMode) {
        notifyCollectionComplete(backlinks);
      }

      if (passiveMode) {
        schedulePassiveInterceptorRestart();
      }
    },
    onError: (error: Error) => {
      if (!passiveMode || pendingCollectionMaxCount !== null) {
        notifyCollectionError(error.message);
      }
      pendingCollectionMaxCount = null;

      if (passiveMode) {
        schedulePassiveInterceptorRestart();
      }
    },
  });

  activeInterceptor.start();
}

async function ensurePassiveInterceptorBootstrap(): Promise<void> {
  if (!isAhrefsBacklinkChecker()) {
    return;
  }

  if (passiveBootstrapRetryTimer !== null) {
    window.clearTimeout(passiveBootstrapRetryTimer);
    passiveBootstrapRetryTimer = null;
  }

  if (autoPassiveBootstrapStarted) {
    return;
  }
  if (activeInterceptor?.isRunning()) {
    return;
  }

  autoPassiveBootstrapStarted = true;
  try {
    await ensureMainWorldBridge();
    createAndStartInterceptor(PASSIVE_INTERCEPT_MAX_COUNT, true);
    passiveBootstrapRetryCount = 0;
    console.log('[Content Script] Ahrefs 被动拦截器已启动');
  } catch (error) {
    console.error('[Content Script] 启动 Ahrefs 被动拦截器失败:', error);
    passiveBootstrapRetryCount += 1;
    const retryDelay = Math.min(6000, 800 * passiveBootstrapRetryCount);
    passiveBootstrapRetryTimer = window.setTimeout(() => {
      passiveBootstrapRetryTimer = null;
      void ensurePassiveInterceptorBootstrap();
    }, retryDelay);
  } finally {
    autoPassiveBootstrapStarted = false;
  }
}

function normalizeUrl(value: string): string {
  return value.trim().replace(/\/$/, '').toLowerCase();
}

function normalizeDomain(value: string): string {
  return value.trim().toLowerCase();
}

function getPageSeoSummary() {
  const title = document.title || '';
  const description = document.querySelector('meta[name="description"]')?.getAttribute('content') || '';
  const h1 = document.querySelector('h1')?.textContent?.trim() || '';
  const language = document.documentElement.lang || navigator.language || '';

  return {
    title,
    description,
    h1,
    language,
    url: window.location.href,
  };
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}

function buildTemplateKey(fields: FormField[]): string {
  return [window.location.hostname, window.location.pathname, ...fields.map(field => `${field.type}:${field.selector}`)].join('|');
}

async function learnTemplateIfNeeded(detection: FormDetectionResult): Promise<void> {
  if (!detection.detected || detection.template || detection.fields.length === 0) {
    return;
  }

  const nextKey = buildTemplateKey(detection.fields);
  if (learnedTemplateKey === nextKey) {
    return;
  }

  const result = await templateLearner.learnFromCurrentPage(detection.fields);
  if (result.success) {
    learnedTemplateKey = nextKey;
  }
}

/**
 * 构建自动评论
 * 优先使用 LLM 生成，失败则回退到模板
 */
async function buildAutoComment(profile: WebsiteProfile, backlinkNote?: string): Promise<string> {
  const comments = profile.comments.map(comment => comment.trim()).filter(Boolean);
  if (comments.length > 0) {
    return comments[0];
  }

  // 尝试使用 LLM 生成评论
  try {
    const settings = await extensionSettingsStorage.get();
    if (settings.enable_llm_comment && settings.llm_api_key) {
      const seo = getPageSeoSummary();

      const response = await chrome.runtime.sendMessage({
        type: MessageType.GENERATE_LLM_COMMENT,
        payload: {
          pageTitle: seo.title,
          pageDescription: seo.description,
          pageH1: seo.h1,
          pageUrl: seo.url,
          websiteName: profile.name,
          websiteUrl: profile.url,
          websiteDescription: profile.comments[0], // 使用第一条评论作为网站简介
          backlinkNote,
        },
      });

      if (response?.success && response.data) {
        console.log('[Content Script] LLM 生成评论成功');
        return response.data;
      }
    }
  } catch (error) {
    console.warn('[Content Script] LLM 生成评论失败，回退到模板:', error);
  }

  // 回退到模板生成
  const seo = getPageSeoSummary();
  const topic = seo.h1 || seo.title || window.location.hostname.replace(/^www\./, '') || '当前主题';
  const focus = seo.description || backlinkNote || seo.title || '';
  const parts = [
    `感谢分享关于 ${truncateText(topic, 48)} 的内容，整体梳理得很清晰。`,
    focus ? `尤其是 ${truncateText(focus, 40)} 这部分，很有参考价值。` : '',
    `这里也补充一下 ${profile.name}（${profile.url}），希望能给读者提供另一个参考。`,
  ].filter(Boolean);

  return parts.join(' ');
}

async function autoStartFillIfNeeded(detection: FormDetectionResult): Promise<void> {
  if (autoFillStarted || !detection.detected) {
    return;
  }

  const session = await submissionSessionStorage.getSession();
  if (!session.selected_website_id) {
    return;
  }

  const profile = await websiteProfileStorage.getProfileById(session.selected_website_id);
  if (!profile || !profile.enabled) {
    return;
  }

  const currentBacklink = session.current_backlink_id
    ? await managedBacklinkStorage.getBacklinkById(session.current_backlink_id)
    : null;

  const result = await autoFillService.fill(
    detection.fields,
    {
      name: profile.name,
      email: profile.email,
      website: profile.url,
      comment: await buildAutoComment(profile, currentBacklink?.note),
    },
    false,
  );

  if (result.success) {
    autoFillStarted = true;
    await learnTemplateIfNeeded(detection);
    console.log('[Content Script] 已根据当前表单自动开始填充');
  }
}

async function detectForms(force = false): Promise<FormDetectionResult> {
  if (!force && lastDetectionResult) {
    return lastDetectionResult;
  }

  lastDetectionResult = await formDetector.detect();
  refreshFormAnchors(lastDetectionResult.fields);
  await learnTemplateIfNeeded(lastDetectionResult);
  return lastDetectionResult;
}

function refreshFormAnchors(fields: FormField[]) {
  const explicitForms = Array.from(document.querySelectorAll('form')) as HTMLElement[];
  const commentAnchors = Array.from(
    document.querySelectorAll('textarea, input[type="email"], input[type="url"], input[name*="comment" i], textarea[name*="comment" i]'),
  ) as HTMLElement[];
  const fieldParents = fields
    .map(field => field.element.closest('form') as HTMLElement | null)
    .filter((element): element is HTMLElement => Boolean(element));

  const merged = [...fieldParents, ...explicitForms, ...commentAnchors].filter(Boolean);
  const unique = merged.filter((element, index) => merged.indexOf(element) === index);

  formAnchorElements = unique;
  formAnchorIndex = 0;
}

function locateNextForm(): BaseResponse<{ index: number; total: number }> {
  if (!formAnchorElements.length) {
    return {
      success: false,
      error: '当前页面没有可定位的表单',
    };
  }

  const target = formAnchorElements[formAnchorIndex];
  formAnchorIndex = (formAnchorIndex + 1) % formAnchorElements.length;
  target.scrollIntoView({ behavior: 'smooth', block: 'center' });

  return {
    success: true,
    data: {
      index: formAnchorIndex === 0 ? formAnchorElements.length : formAnchorIndex,
      total: formAnchorElements.length,
    },
  };
}

function pageContainsWebsiteLink(profile?: WebsiteProfile): boolean {
  if (!profile) return false;

  const targetDomain = normalizeDomain(profile.domain);
  const targetUrl = normalizeUrl(profile.url);
  const anchors = Array.from(document.querySelectorAll('a[href]')) as HTMLAnchorElement[];

  return anchors.some(anchor => {
    const href = anchor.href;
    if (!href) return false;

    try {
      const url = new URL(href);
      return normalizeDomain(url.hostname) === targetDomain || normalizeUrl(href).startsWith(targetUrl);
    } catch {
      return false;
    }
  });
}

async function isCurrentUrlInBacklinkGroup(groupId?: string): Promise<boolean> {
  if (!groupId) return false;

  const backlinks = await managedBacklinkStorage.getAllBacklinks();
  const currentUrl = normalizeUrl(window.location.href);

  return backlinks.some(backlink => backlink.group_id === groupId && normalizeUrl(backlink.url) === currentUrl);
}

async function buildFillPageState(payload?: {
  selectedWebsiteId?: string;
  selectedBacklinkGroupId?: string;
}): Promise<FillPageState> {
  const [detection, selectedWebsite, backlinkInCurrentGroup] = await Promise.all([
    detectForms(false),
    payload?.selectedWebsiteId ? websiteProfileStorage.getProfileById(payload.selectedWebsiteId) : Promise.resolve(null),
    isCurrentUrlInBacklinkGroup(payload?.selectedBacklinkGroupId),
  ]);

  return {
    seo: getPageSeoSummary(),
    form_detected: detection.detected,
    form_confidence: detection.confidence,
    field_types: detection.fields.map(field => field.type),
    backlink_in_current_group: backlinkInCurrentGroup,
    selected_website_link_present: pageContainsWebsiteLink(selectedWebsite ?? undefined),
  };
}

async function handleGetFillPageState(
  message: BaseMessage,
  sendResponse: (response: GetFillPageStateResponse) => void,
): Promise<void> {
  try {
    const data = await buildFillPageState(message.payload as { selectedWebsiteId?: string; selectedBacklinkGroupId?: string } | undefined);
    sendResponse({ success: true, data });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : '获取页面状态失败',
    });
  }
}

async function handleDetectPageForms(sendResponse: (response: BaseResponse) => void): Promise<void> {
  try {
    const detection = await detectForms(true);
    sendResponse({
      success: true,
      data: {
        detected: detection.detected,
        confidence: detection.confidence,
        fields: detection.fields.map(field => field.type),
      },
    });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : '检测表单失败',
    });
  }
}

async function handleFillSelectedWebsite(message: BaseMessage, sendResponse: (response: BaseResponse) => void): Promise<void> {
  try {
    const payload = (message.payload ?? {}) as {
      selectedWebsiteId?: string;
      commentIndex?: number;
      comment?: string;
      profile?: WebsiteProfile;
      backlink?: ManagedBacklink;
    };

    // 支持两种格式：旧格式（selectedWebsiteId）和新格式（profile）
    let profile: WebsiteProfile | null = null;
    let backlinkId: string | undefined;

    if (payload.profile) {
      // 新格式：直接使用 profile 对象
      profile = payload.profile;
      backlinkId = payload.backlink?.id;
    } else if (payload.selectedWebsiteId) {
      // 旧格式：通过 ID 查询
      profile = await websiteProfileStorage.getProfileById(payload.selectedWebsiteId);
    }

    if (!profile) {
      throw new Error('未选择网站资料');
    }

    if (!profile.enabled) {
      throw new Error('网站资料已禁用');
    }

    const detection = await detectForms(false);
    if (!detection.detected) {
      throw new Error('当前页面未检测到可填充表单');
    }

    const validComments = profile.comments.map(comment => comment.trim()).filter(Boolean);
    const payloadComment = payload.comment?.trim();

    if (!payloadComment && !validComments.length) {
      throw new Error('网站资料缺少评论内容');
    }

    const selectedIndex = validComments.length > 0
      ? typeof payload.commentIndex === 'number'
        ? Math.max(0, Math.min(validComments.length - 1, payload.commentIndex))
        : Math.floor(Math.random() * validComments.length)
      : 0;

    const commentToUse = payloadComment || validComments[selectedIndex];

    const result = await autoFillService.fill(
      detection.fields,
      {
        name: profile.name,
        email: profile.email,
        website: profile.url,
        comment: commentToUse,
      },
      false,
    );

    if (result.success) {
      autoFillStarted = true;
      await learnTemplateIfNeeded(detection);

      // 设置待提交记录，等待表单提交事件
      if (backlinkId) {
        pendingSubmission = {
          profileId: profile.id,
          backlinkId,
          comment: commentToUse,
          timestamp: Date.now(),
        };
        savePendingSubmission(pendingSubmission);
        console.log('[Content Script] 已设置待提交记录，等待表单提交');
      }
    }

    sendResponse({
      success: result.success,
      data: {
        ...result,
        commentIndex: selectedIndex,
      },
      error: result.error,
    });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : '填表失败',
    });
  }
}

// === 新增：智能匹配处理器 ===

/**
 * 处理匹配结果更新
 */
async function handleMatchResultUpdated(
  message: BaseMessage,
  sendResponse: (response: BaseResponse) => void,
): Promise<void> {
  try {
    const payload = message.payload as MatchResult & { sourceUrl: string; timestamp: number } | undefined;
    if (!payload) {
      sendResponse({ success: false, error: '缺少匹配结果数据' });
      return;
    }

    currentMatchResult = {
      bestMatch: payload.bestMatch,
      confidence: payload.confidence,
      alternatives: payload.alternatives,
    };

    console.log('[Content Script] 匹配结果已更新:', {
      hasMatch: !!payload.bestMatch,
      confidence: payload.confidence,
      alternativesCount: payload.alternatives.length,
    });

    // 触发表单检测
    if (payload.bestMatch && payload.confidence >= 30) {
      const detection = await detectForms(false);

      // 发送表单检测结果
      if (detection.detected) {
        void chrome.runtime.sendMessage({
          type: MessageType.FORM_DETECTED,
          payload: {
            detected: true,
            confidence: detection.confidence,
            fieldTypes: detection.fields.map(f => f.type),
          },
        });
      }
    }

    sendResponse({ success: true });
  } catch (error) {
    console.error('[Content Script] 处理匹配结果失败:', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : '处理匹配结果失败',
    });
  }
}

// === 新增：快速添加外链处理器 ===

/**
 * 处理快速添加外链响应
 */
async function handleBacklinkAdded(
  message: BaseMessage,
  sendResponse: (response: BaseResponse) => void,
): Promise<void> {
  try {
    const payload = message.payload as { backlink: ManagedBacklink; addedAt: string } | undefined;
    if (!payload?.backlink) {
      sendResponse({ success: false, error: '缺少外链数据' });
      return;
    }

    console.log('[Content Script] 新外链已添加:', payload.backlink.url);

    // 如果当前页面 URL 与新添加的外链匹配，更新匹配结果
    const currentUrl = normalizeUrl(window.location.href);
    const backlinkUrl = normalizeUrl(payload.backlink.url);

    if (currentUrl === backlinkUrl || currentUrl.includes(backlinkUrl)) {
      currentMatchResult = {
        bestMatch: payload.backlink,
        confidence: 100,
        alternatives: currentMatchResult?.alternatives || [],
      };
    }

    sendResponse({ success: true });
  } catch (error) {
    console.error('[Content Script] 处理外链添加通知失败:', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : '处理外链添加通知失败',
    });
  }
}

// === 新增：一键填充处理器 ===

/**
 * 记录外链提交
 */
async function recordSubmission(
  websiteProfileId: string,
  backlinkId: string,
  comment: string
): Promise<void> {
  try {
    // 检查是否已提交过
    const hasSubmitted = await backlinkSubmissionStorage.hasSubmitted(
      websiteProfileId,
      backlinkId
    );

    if (hasSubmitted) {
      console.warn('[Content Script] 该外链已提交过，跳过记录:', { websiteProfileId, backlinkId });
      return;
    }

    const backlink = await managedBacklinkStorage.getBacklinkById(backlinkId);
    if (!backlink) {
      console.warn('[Content Script] 外链不存在，无法记录提交:', backlinkId);
      return;
    }

    const submission: BacklinkSubmission = {
      id: `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      website_profile_id: websiteProfileId,
      managed_backlink_id: backlinkId,
      target_url: window.location.href,
      target_domain: backlink.domain,
      submitted_at: new Date().toISOString(),
      status: 'submitted',
      comment: comment,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await backlinkSubmissionStorage.addSubmission(submission);
    console.log('[Content Script] 提交记录已保存:', submission);

    // 通知用户提交成功
    void chrome.runtime.sendMessage({
      type: 'SUBMISSION_RECORDED',
      payload: { submission },
    }).catch(error => {
      console.error('[Content Script] 发送提交记录通知失败:', error);
    });
  } catch (error) {
    console.error('[Content Script] 记录提交失败:', error);

    // 通知用户记录失败
    void chrome.runtime.sendMessage({
      type: 'SUBMISSION_RECORD_FAILED',
      payload: { error: error instanceof Error ? error.message : '未知错误' },
    }).catch(err => {
      console.error('[Content Script] 发送失败通知失败:', err);
    });
  }
}

/**
 * 处理一键填充请求
 */
async function handleOneClickFill(
  message: BaseMessage,
  sendResponse: (response: BaseResponse) => void,
): Promise<void> {
  try {
    const payload = message.payload as {
      profileId: string;
      backlinkId?: string;
      comment?: string;
      autoSubmit?: boolean;
    } | undefined;

    if (!payload?.profileId) {
      sendResponse({ success: false, error: '缺少 profileId 参数' });
      return;
    }

    const { profileId, backlinkId, comment, autoSubmit } = payload;

    // 获取网站资料
    const profile = await websiteProfileStorage.getProfileById(profileId);
    if (!profile || !profile.enabled) {
      sendResponse({ success: false, error: '网站资料不存在或已禁用' });
      return;
    }

    // 检测表单
    const detection = await detectForms(false);
    if (!detection.detected) {
      sendResponse({ success: false, error: '当前页面未检测到可填充表单' });
      return;
    }

    // 获取当前外链的备注（用于生成评论）
    let backlinkNote: string | undefined;
    if (backlinkId) {
      const backlink = await managedBacklinkStorage.getBacklinkById(backlinkId);
      backlinkNote = backlink?.note;
    }

    // 使用指定的评论或生成自动评论
    const commentToUse = comment?.trim() || await buildAutoComment(profile, backlinkNote);

    // 执行填充
    const result = await autoFillService.fill(
      detection.fields,
      {
        name: profile.name,
        email: profile.email,
        website: profile.url,
        comment: commentToUse,
      },
      autoSubmit || false,
    );

    if (result.success) {
      autoFillStarted = true;
      await learnTemplateIfNeeded(detection);

      // 设置待提交记录，等待表单提交事件
      if (backlinkId) {
        pendingSubmission = {
          profileId,
          backlinkId,
          comment: commentToUse,
          timestamp: Date.now(),
        };
        savePendingSubmission(pendingSubmission);
        console.log('[Content Script] 已设置待提交记录，等待表单提交');
      }

      // 发送填充已开始通知
      void chrome.runtime.sendMessage({
        type: MessageType.FILL_INITIATED,
        payload: {
          success: true,
          profileId,
          backlinkId,
          filledFields: detection.fields.map(f => f.type),
        },
      });

      sendResponse({
        success: true,
        data: {
          profileId,
          backlinkId,
          filledFields: detection.fields.map(f => f.type),
        },
      });
    } else {
      sendResponse({
        success: false,
        error: result.error || '填充失败',
      });
    }
  } catch (error) {
    console.error('[Content Script] 一键填充失败:', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : '一键填充失败',
    });
  }
}

// === 新增：悬浮面板处理器 ===

/**
 * 处理打开悬浮面板请求
 */
async function handleOpenFloatingPanel(
  message: BaseMessage,
  sendResponse: (response: BaseResponse) => void,
): Promise<void> {
  try {
    const payload = message.payload as { initialState?: 'expanded' | 'collapsed' } | undefined;

    floatingPanelState = {
      isOpen: true,
      state: payload?.initialState || 'collapsed',
    };

    // 通知悬浮面板状态变更
    void chrome.runtime.sendMessage({
      type: MessageType.FLOATING_PANEL_STATE_CHANGED,
      payload: {
        isOpen: true,
        state: floatingPanelState.state,
        matchResult: currentMatchResult || undefined,
      },
    });

    console.log('[Content Script] 悬浮面板已打开:', floatingPanelState);
    sendResponse({ success: true });
  } catch (error) {
    console.error('[Content Script] 打开悬浮面板失败:', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : '打开悬浮面板失败',
    });
  }
}

/**
 * 处理关闭悬浮面板请求
 */
async function handleCloseFloatingPanel(
  message: BaseMessage,
  sendResponse: (response: BaseResponse) => void,
): Promise<void> {
  try {
    const payload = message.payload as { reason?: 'user_action' | 'auto' | 'page_navigate' } | undefined;

    floatingPanelState = {
      isOpen: false,
      state: 'collapsed',
    };

    // 通知悬浮面板状态变更
    void chrome.runtime.sendMessage({
      type: MessageType.FLOATING_PANEL_STATE_CHANGED,
      payload: {
        isOpen: false,
        state: 'collapsed',
        matchResult: currentMatchResult || undefined,
      },
    });

    console.log('[Content Script] 悬浮面板已关闭:', { reason: payload?.reason });
    sendResponse({ success: true });
  } catch (error) {
    console.error('[Content Script] 关闭悬浮面板失败:', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : '关闭悬浮面板失败',
    });
  }
}

// === 新增：表单检测处理器 ===

/**
 * 处理强制检测表单请求
 */
async function handleForceDetectForm(
  message: BaseMessage,
  sendResponse: (response: BaseResponse) => void,
): Promise<void> {
  try {
    const payload = message.payload as { retryCount?: number } | undefined;

    // 清除缓存，强制重新检测
    lastDetectionResult = null;
    const detection = await detectForms(true);

    // 发送表单检测结果消息
    void chrome.runtime.sendMessage({
      type: MessageType.FORM_DETECTED,
      payload: {
        detected: detection.detected,
        confidence: detection.confidence,
        fieldTypes: detection.fields.map(f => f.type),
        selectors: detection.fields.map(f => f.selector),
      },
    });

    sendResponse({
      success: true,
      data: {
        detected: detection.detected,
        confidence: detection.confidence,
        fields: detection.fields.map(f => ({
          type: f.type,
          selector: f.selector,
          required: f.required ?? false,
        })),
      },
    });
  } catch (error) {
    console.error('[Content Script] 强制检测表单失败:', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : '强制检测表单失败',
    });
  }
}

// === 新增：URL 变更处理器 ===

/**
 * 处理 URL 变更通知
 */
async function handleUrlChanged(
  message: BaseMessage,
  sendResponse: (response: BaseResponse) => void,
): Promise<void> {
  try {
    const payload = message.payload as { oldUrl: string; newUrl: string; title?: string } | undefined;
    if (!payload?.newUrl) {
      sendResponse({ success: false, error: '缺少 newUrl 参数' });
      return;
    }

    console.log('[Content Script] URL 变更:', payload.oldUrl, '->', payload.newUrl);

    // 更新最后 URL
    lastUrl = payload.newUrl;

    // 重置状态
    autoFillStarted = false;
    learnedTemplateKey = null;
    lastDetectionResult = null;

    // 如果悬浮面板打开，更新其状态
    if (floatingPanelState.isOpen) {
      void chrome.runtime.sendMessage({
        type: MessageType.FLOATING_PANEL_STATE_CHANGED,
        payload: {
          isOpen: true,
          state: floatingPanelState.state,
          matchResult: currentMatchResult || undefined,
        },
      });
    }

    sendResponse({ success: true });
  } catch (error) {
    console.error('[Content Script] 处理 URL 变更失败:', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : '处理 URL 变更失败',
    });
  }
}

function handleMessage(
  message: BaseMessage,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response: BaseResponse) => void,
): boolean {
  console.log('[Content Script] 收到消息:', message.type);

  switch (message.type) {
    case MessageType.GET_FILL_PAGE_STATE:
      void handleGetFillPageState(message, sendResponse as (response: GetFillPageStateResponse) => void);
      return true;

    case MessageType.DETECT_PAGE_FORMS:
      void handleDetectPageForms(sendResponse);
      return true;

    case MessageType.LOCATE_NEXT_FORM:
      sendResponse(locateNextForm());
      return false;

    case MessageType.FILL_SELECTED_WEBSITE:
      void handleFillSelectedWebsite(message, sendResponse);
      return true;

    // === 新增：智能匹配相关 ===
    case MessageType.MATCH_RESULT_UPDATED:
      void handleMatchResultUpdated(message, sendResponse);
      return true;

    // === 新增：快速添加外链相关 ===
    case MessageType.BACKLINK_ADDED:
      void handleBacklinkAdded(message, sendResponse);
      return true;

    // === 新增：一键填充相关 ===
    case MessageType.ONE_CLICK_FILL:
      void handleOneClickFill(message, sendResponse);
      return true;

    // === 新增：悬浮面板相关 ===
    case MessageType.OPEN_FLOATING_PANEL:
      void handleOpenFloatingPanel(message, sendResponse);
      return true;

    case MessageType.CLOSE_FLOATING_PANEL:
      void handleCloseFloatingPanel(message, sendResponse);
      return true;

    // === 新增：表单检测相关 ===
    case MessageType.FORCE_DETECT_FORM:
      void handleForceDetectForm(message, sendResponse);
      return true;

    // === 新增：URL 变更相关 ===
    case MessageType.URL_CHANGED:
      void handleUrlChanged(message, sendResponse);
      return true;

    case 'START_API_INTERCEPTOR':
      void handleStartApiInterceptor(message, sendResponse);
      return true;

    case 'STOP_API_INTERCEPTOR':
      handleStopApiInterceptor(sendResponse);
      return false;

    case 'PING_CONTENT_SCRIPT':
      sendResponse({ success: true });
      return false;

    case 'CHECK_VERIFICATION_PAGE':
      handleCheckVerificationPage(sendResponse);
      return false;

    case 'WAIT_FOR_VERIFICATION':
      void handleWaitForVerification(message, sendResponse);
      return true;

    default:
      sendResponse({ success: false, error: `未知的消息类型: ${message.type}` });
      return false;
  }
}

async function handleStartApiInterceptor(message: BaseMessage, sendResponse: (response: BaseResponse) => void): Promise<void> {
  try {
    const payload = (message.payload ?? {}) as { maxCount?: number };
    const normalizedMaxCount = Number(payload.maxCount);
    const maxCount = Number.isFinite(normalizedMaxCount) && normalizedMaxCount > 0
      ? Math.min(200, Math.floor(normalizedMaxCount))
      : 20;

    pendingCollectionMaxCount = maxCount;

    console.log('[Content Script] 准备启动 API 拦截器', {
      href: window.location.href,
      maxCount,
      passiveMode: interceptorPassiveMode,
      running: activeInterceptor?.isRunning() || false,
    });

    if (hasFreshCachedBacklinks(maxCount)) {
      console.log('[Content Script] 命中缓存外链结果，直接返回');
      notifyCollectionComplete(cachedBacklinks.slice(0, maxCount));
      sendResponse({ success: true });
      return;
    }

    if (activeInterceptor?.isRunning() && interceptorPassiveMode && interceptorMaxCount >= maxCount) {
      console.log('[Content Script] 复用已运行的被动拦截器，等待结果');
      sendResponse({ success: true });
      return;
    }

    await ensureMainWorldBridge();
    createAndStartInterceptor(maxCount, false);
    console.log('[Content Script] API 拦截器启动成功');
    sendResponse({ success: true });
  } catch (error) {
    console.error('[Content Script] 启动 API 拦截器失败:', error);
    sendResponse({ success: false, error: error instanceof Error ? error.message : '未知错误' });
  }
}

function handleStopApiInterceptor(sendResponse: (response: BaseResponse) => void): void {
  try {
    console.log('[Content Script] 准备停止 API 拦截器');
    pendingCollectionMaxCount = null;

    if (activeInterceptor?.isRunning()) {
      activeInterceptor.stop();
      activeInterceptor = null;
    }

    if (isAhrefsBacklinkChecker()) {
      void ensurePassiveInterceptorBootstrap();
    }

    console.log('[Content Script] API 拦截器已停止');
    sendResponse({ success: true });
  } catch (error) {
    console.error('[Content Script] 停止 API 拦截器失败:', error);
    sendResponse({ success: false, error: error instanceof Error ? error.message : '未知错误' });
  }
}

function handleCheckVerificationPage(sendResponse: (response: BaseResponse) => void): void {
  try {
    const result = detectVerificationPage();
    sendResponse({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[Content Script] 检测验证页面失败:', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : '检测失败',
    });
  }
}

async function handleWaitForVerification(message: BaseMessage, sendResponse: (response: BaseResponse) => void): Promise<void> {
  try {
    const payload = (message.payload ?? {}) as { timeoutMs?: number };
    const timeoutMs = typeof payload.timeoutMs === 'number' ? payload.timeoutMs : 300000;

    console.log('[Content Script] 开始等待验证完成，超时时间:', timeoutMs, 'ms');
    const completed = await waitForVerificationComplete(timeoutMs);

    sendResponse({
      success: true,
      data: { completed },
    });
  } catch (error) {
    console.error('[Content Script] 等待验证失败:', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : '等待验证失败',
    });
  }
}

async function warmupDetectionIfNeeded() {
  try {
    const settings = await extensionSettingsStorage.get();
    if (!settings.auto_detect_form && !settings.auto_start_fill) {
      return;
    }

    const detection = await detectForms(true);
    if (settings.auto_start_fill) {
      await autoStartFillIfNeeded(detection);
    }
  } catch (error) {
    console.error('[Content Script] 自动检测表单失败:', error);
  }
}

// === 新增：监听 URL 变化 ===

/**
 * 监听 URL 变化（用于 SPA 页面）
 */
function initUrlChangeListener(): void {
  let lastUrl = window.location.href;

  // 监听 hash 变化
  window.addEventListener('hashchange', () => {
    const newUrl = window.location.href;
    notifyUrlChanged(lastUrl, newUrl);
    lastUrl = newUrl;
  });

  // 监听 history 变化（pushState/replaceState）
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function (...args) {
    originalPushState.apply(this, args);
    const newUrl = window.location.href;
    notifyUrlChanged(lastUrl, newUrl);
    lastUrl = newUrl;
  };

  history.replaceState = function (...args) {
    originalReplaceState.apply(this, args);
    const newUrl = window.location.href;
    if (newUrl !== lastUrl) {
      notifyUrlChanged(lastUrl, newUrl);
      lastUrl = newUrl;
    }
  };

  // 监听 popstate 事件（前后缀导航）
  window.addEventListener('popstate', () => {
    const newUrl = window.location.href;
    if (newUrl !== lastUrl) {
      notifyUrlChanged(lastUrl, newUrl);
      lastUrl = newUrl;
    }
  });

  console.log('[Content Script] URL 变化监听已初始化');
}

/**
 * 通知 URL 变更
 */
async function notifyUrlChanged(oldUrl: string, newUrl: string): Promise<void> {
  const title = document.title;

  // 发送到 background
  try {
    await chrome.runtime.sendMessage({
      type: MessageType.URL_CHANGED,
      payload: { oldUrl, newUrl, title },
    });
  } catch (error) {
    console.warn('[Content Script] 发送 URL 变更通知失败:', error);
  }
}

// 防止重复初始化表单提交监听器
let formSubmitListenerInitialized = false;

/**
 * 初始化表单提交监听
 */
function initFormSubmitListener(): void {
  // 防止重复注册监听器
  if (formSubmitListenerInitialized) {
    console.log('[Content Script] 表单提交监听已初始化，跳过');
    return;
  }

  formSubmitListenerInitialized = true;

  // 监听表单提交事件
  document.addEventListener('submit', async (event) => {
    if (!pendingSubmission) return;

    const { profileId, backlinkId, comment, timestamp } = pendingSubmission;

    // 检查是否超时（5分钟内有效）
    const now = Date.now();
    if (now - timestamp > 5 * 60 * 1000) {
      console.warn('[Content Script] 待提交记录已超时，跳过');
      pendingSubmission = null;
      clearPendingSubmission();
      return;
    }

    // 阻止默认提交，等待记录完成
    event.preventDefault();

    console.log('[Content Script] 检测到表单提交，记录提交:', { profileId, backlinkId });

    try {
      // 记录提交
      await recordSubmission(profileId, backlinkId, comment);

      // 清除待提交记录
      pendingSubmission = null;
      clearPendingSubmission();

      console.log('[Content Script] 提交记录完成，继续提交表单');

      // 继续提交表单
      const form = event.target as HTMLFormElement;
      // 移除监听器以避免递归
      formSubmitListenerInitialized = false;
      form.submit();
      // 重新标记为已初始化（因为页面可能不会跳转）
      formSubmitListenerInitialized = true;
    } catch (error) {
      console.error('[Content Script] 记录提交失败，但仍继续提交表单:', error);

      // 清除待提交记录
      pendingSubmission = null;
      clearPendingSubmission();

      // 即使记录失败，也继续提交表单
      const form = event.target as HTMLFormElement;
      formSubmitListenerInitialized = false;
      form.submit();
      formSubmitListenerInitialized = true;
    }
  }, true); // 使用捕获阶段，确保在表单提交前记录

  console.log('[Content Script] 表单提交监听已初始化');
}

export function initMessageListener(): void {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => handleMessage(message, sender, sendResponse));
  void warmupDetectionIfNeeded();
  void ensurePassiveInterceptorBootstrap();
  initUrlChangeListener(); // 初始化 URL 变化监听
  initFormSubmitListener(); // 初始化表单提交监听
  console.log('[Content Script] 消息监听器已初始化');
}
