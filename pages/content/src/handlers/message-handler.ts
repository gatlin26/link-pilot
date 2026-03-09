/**
 * 消息处理器
 */

import {
  extensionSettingsStorage,
  managedBacklinkStorage,
  submissionSessionStorage,
  websiteProfileStorage,
} from '@extension/storage';
import type {
  BaseMessage,
  BaseResponse,
  GetFillPageStateResponse,
} from '@extension/shared/lib/types/messages';
import { MessageType } from '@extension/shared/lib/types/messages';
import type { FillPageState, WebsiteProfile } from '@extension/shared';
import { autoFillService, formDetector, type FormField, type FormDetectionResult } from '../form-handlers';
import { templateLearner } from '../template';
import { createAhrefsInterceptor } from '../collectors/ahrefs-api-interceptor';
import { isAhrefsBacklinkChecker } from '../collectors/ahrefs-detector';
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
  const response = await chrome.runtime.sendMessage({
    type: 'ENSURE_AHREFS_MAIN_BRIDGE',
  }) as { success?: boolean; error?: string };

  if (!response?.success) {
    throw new Error(response?.error || '主世界桥接注入失败');
  }
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

function buildAutoComment(profile: WebsiteProfile, backlinkNote?: string): string {
  const comments = profile.comments.map(comment => comment.trim()).filter(Boolean);
  if (comments.length > 0) {
    return comments[0];
  }

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
      comment: buildAutoComment(profile, currentBacklink?.note),
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
    const payload = (message.payload ?? {}) as { selectedWebsiteId?: string; commentIndex?: number; comment?: string };
    if (!payload.selectedWebsiteId) {
      throw new Error('未选择网站资料');
    }

    const profile = await websiteProfileStorage.getProfileById(payload.selectedWebsiteId);
    if (!profile || !profile.enabled) {
      throw new Error('网站资料不存在或已禁用');
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

    const result = await autoFillService.fill(
      detection.fields,
      {
        name: profile.name,
        email: profile.email,
        website: profile.url,
        comment: payloadComment || validComments[selectedIndex],
      },
      false,
    );

    if (result.success) {
      autoFillStarted = true;
      await learnTemplateIfNeeded(detection);
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

    case 'START_API_INTERCEPTOR':
      void handleStartApiInterceptor(message, sendResponse);
      return true;

    case 'STOP_API_INTERCEPTOR':
      handleStopApiInterceptor(sendResponse);
      return false;

    case 'PING_CONTENT_SCRIPT':
      sendResponse({ success: true });
      return false;

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

export function initMessageListener(): void {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => handleMessage(message, sender, sendResponse));
  void warmupDetectionIfNeeded();
  void ensurePassiveInterceptorBootstrap();
  console.log('[Content Script] 消息监听器已初始化');
}
