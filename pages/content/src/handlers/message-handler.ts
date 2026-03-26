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
  GenerateLLMFillPlanData,
  LLMFieldCandidate,
  MatchResult,
} from '@extension/shared/lib/types/messages';
import type { BacklinkSubmission } from '@extension/shared/lib/types/models';
import { MessageType } from '@extension/shared/lib/types/messages';
import type { FillPageState, ManagedBacklink, WebsiteProfile } from '@extension/shared';
import {
  buildCommentCandidates,
  getPrimaryWebsiteDescription,
  getProfileCommentTemplates,
  PageType,
} from '@extension/shared';
import { autoFillService } from '../form-handlers/auto-fill-service';
import { formDetector, type FormField, type FormDetectionResult } from '../form-handlers/form-detector';
import { templateLearner } from '../template/template-learner';
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

// 待提交记录超时时间（5分钟）
const PENDING_SUBMISSION_TIMEOUT = 5 * 60 * 1000;

// 检查待提交记录是否超时
function isPendingSubmissionExpired(timestamp: number): boolean {
  return Date.now() - timestamp > PENDING_SUBMISSION_TIMEOUT;
}

// 从 sessionStorage 恢复待提交记录
function loadPendingSubmission(): PendingSubmission | null {
  try {
    const stored = sessionStorage.getItem('link-pilot-pending-submission');
    if (!stored) return null;
    const data = JSON.parse(stored) as PendingSubmission;
    // 检查是否超时
    if (isPendingSubmissionExpired(data.timestamp)) {
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
  console.log('[Content Script][Passive] ensurePassiveInterceptorBootstrap 进入', {
    href: window.location.href,
    hostname: window.location.hostname,
    activeInterceptorRunning: activeInterceptor?.isRunning() || false,
    autoPassiveBootstrapStarted,
  });

  if (!isAhrefsBacklinkChecker()) {
    console.log('[Content Script][Passive] 当前页面不是 Ahrefs Backlink Checker，跳过');
    return;
  }

  if (passiveBootstrapRetryTimer !== null) {
    window.clearTimeout(passiveBootstrapRetryTimer);
    passiveBootstrapRetryTimer = null;
  }

  if (autoPassiveBootstrapStarted) {
    console.log('[Content Script][Passive] 已在启动中，跳过重复启动');
    return;
  }
  if (activeInterceptor?.isRunning()) {
    console.log('[Content Script][Passive] 拦截器已在运行，跳过');
    return;
  }

  autoPassiveBootstrapStarted = true;
  try {
    console.log('[Content Script][Passive] 准备确认主世界桥接脚本');
    await ensureMainWorldBridge();
    console.log('[Content Script][Passive] 主世界桥接脚本确认完成，准备创建被动拦截器');
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

function buildTemplateKey(fields: FormField[]): string {
  return [window.location.hostname, window.location.pathname, ...fields.map(field => `${field.type}:${field.selector}`)].join('|');
}

function isFillableElementVisible(element: HTMLElement): boolean {
  const style = window.getComputedStyle(element);
  if (
    style.display === 'none' ||
    style.visibility === 'hidden' ||
    style.opacity === '0' ||
    element.getAttribute('aria-hidden') === 'true'
  ) {
    return false;
  }

  if (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLButtonElement
  ) {
    if (element.disabled) {
      return false;
    }
  }

  const rect = element.getBoundingClientRect();
  return rect.width > 0 || rect.height > 0 || element.getClientRects().length > 0;
}

function generateFallbackSelector(element: HTMLElement): string {
  if (element.id) {
    return `#${CSS.escape(element.id)}`;
  }

  const name = element.getAttribute('name');
  if (name) {
    return `${element.tagName.toLowerCase()}[name="${CSS.escape(name)}"]`;
  }

  const classes = Array.from(element.classList).slice(0, 2).map(className => `.${CSS.escape(className)}`).join('');
  return `${element.tagName.toLowerCase()}${classes}`;
}

function createFallbackField(
  type: FormField['type'],
  element: HTMLElement | null,
  confidence: number,
): FormField | null {
  if (!element || !isFillableElementVisible(element)) {
    return null;
  }

  return {
    type,
    element,
    selector: generateFallbackSelector(element),
    confidence,
    required: element.hasAttribute('required'),
  };
}

function findFirstMatchingElement(
  container: ParentNode,
  selectors: string[],
  predicate?: (element: HTMLElement) => boolean,
): HTMLElement | null {
  for (const selector of selectors) {
    const elements = Array.from(container.querySelectorAll<HTMLElement>(selector));
    for (const element of elements) {
      if (!isFillableElementVisible(element)) {
        continue;
      }
      if (predicate && !predicate(element)) {
        continue;
      }
      return element;
    }
  }

  return null;
}

function dedupeFields(fields: FormField[]): FormField[] {
  const seen = new Set<HTMLElement>();
  return fields.filter(field => {
    if (seen.has(field.element)) {
      return false;
    }
    seen.add(field.element);
    return true;
  });
}

function getElementLabelText(element: HTMLElement): string {
  const explicitLabelId = element.getAttribute('id');
  if (explicitLabelId) {
    const explicitLabel = document.querySelector(`label[for="${CSS.escape(explicitLabelId)}"]`)?.textContent?.trim();
    if (explicitLabel) {
      return explicitLabel;
    }
  }

  const parentLabel = element.closest('label')?.textContent?.trim();
  if (parentLabel) {
    return parentLabel;
  }

  const previousText = element.previousElementSibling?.textContent?.trim();
  if (previousText) {
    return previousText;
  }

  return '';
}

function serializeFieldForLLM(field: FormField): LLMFieldCandidate {
  const inputType =
    field.element instanceof HTMLInputElement ? field.element.type : field.element.getAttribute('type') || undefined;

  return {
    selector: field.selector,
    currentType: field.type,
    tagName: field.element.tagName.toLowerCase(),
    inputType,
    name: field.element.getAttribute('name') || undefined,
    id: field.element.id || undefined,
    placeholder: field.element.getAttribute('placeholder') || undefined,
    label: getElementLabelText(field.element) || undefined,
    ariaLabel: field.element.getAttribute('aria-label') || undefined,
    required: field.required ?? false,
  };
}

function normalizeResolvedFields(
  fields: FormField[],
  plan?: GenerateLLMFillPlanData | null,
): FormField[] {
  if (!plan || !Array.isArray(plan.fieldMappings) || plan.fieldMappings.length === 0) {
    return fields;
  }

  const mappingBySelector = new Map(plan.fieldMappings.map(item => [item.selector, item]));
  const adjusted = fields.map(field => {
    const mapping = mappingBySelector.get(field.selector);
    if (!mapping || mapping.fieldType === 'unknown') {
      return field;
    }

    return {
      ...field,
      type: mapping.fieldType,
      confidence: Math.max(field.confidence, mapping.confidence),
    };
  });

  const keepTypes: Array<FormField['type']> = ['comment', 'name', 'email', 'website', 'submit'];
  const bestByType = new Map<FormField['type'], FormField>();

  adjusted
    .slice()
    .sort((left, right) => right.confidence - left.confidence)
    .forEach(field => {
      if (!keepTypes.includes(field.type)) {
        return;
      }
      if (!bestByType.has(field.type)) {
        bestByType.set(field.type, field);
      }
    });

  const ordered = keepTypes.map(type => bestByType.get(type)).filter((field): field is FormField => Boolean(field));
  return ordered.length > 0 ? ordered : fields;
}

async function buildLLMFillPlan(
  profile: WebsiteProfile,
  backlink: ManagedBacklink | null,
  fields: FormField[],
): Promise<GenerateLLMFillPlanData | null> {
  try {
    const seo = getPageSeoSummary();
    const commentCandidates = buildCommentCandidates(
      profile,
      {
        seo,
        form_detected: true,
        form_confidence: 1,
        field_types: [],
        backlink_in_current_group: false,
        selected_website_link_present: false,
      },
      backlink,
    );

    const response = await chrome.runtime.sendMessage({
      type: MessageType.GENERATE_LLM_FILL_PLAN,
      payload: {
        pageTitle: seo.title,
        pageDescription: seo.description,
        pageH1: seo.h1,
        pageUrl: seo.url,
        pageLanguage: seo.language,
        websiteName: profile.name,
        websiteUrl: profile.url,
        websiteEmail: profile.email,
        websiteDescription: getPrimaryWebsiteDescription(profile),
        backlinkNote: backlink?.note,
        commentCandidates,
        fields: fields.map(serializeFieldForLLM),
      },
    });

    if (!response?.success || !response.data) {
      return null;
    }

    return response.data as GenerateLLMFillPlanData;
  } catch (error) {
    console.warn('[Content Script] 生成 LLM 结构化填表方案失败，回退到规则模式:', error);
    return null;
  }
}

function detectSimpleCommentForm(): FormDetectionResult | null {
  const containerSelectors = [
    'form',
    '#respond',
    '[id*="commentform" i]',
    '[id*="respond" i]',
    '[class*="comment-form" i]',
    '[class*="comment-respond" i]',
    '[class*="commentform" i]',
  ];

  const containers = Array.from(document.querySelectorAll<HTMLElement>(containerSelectors.join(', ')));
  const uniqueContainers = containers.filter((container, index) => containers.indexOf(container) === index);
  const candidates = uniqueContainers.length > 0 ? uniqueContainers : [document.body];

  let bestFields: FormField[] = [];
  let bestScore = 0;

  for (const container of candidates) {
    const commentField = createFallbackField(
      'comment',
      findFirstMatchingElement(container, [
        'textarea[name*="comment" i]',
        'textarea[id*="comment" i]',
        'textarea[placeholder*="comment" i]',
        'textarea[aria-label*="comment" i]',
        'textarea',
        '[contenteditable="true"][role="textbox"]',
        '[contenteditable="true"]',
      ]),
      0.96,
    );

    if (!commentField) {
      continue;
    }

    const fields = dedupeFields([
      commentField,
      createFallbackField(
        'name',
        findFirstMatchingElement(container, [
          'input[name*="author" i]',
          'input[id*="author" i]',
          'input[name*="name" i]',
          'input[id*="name" i]',
          'input[placeholder*="name" i]',
          'input[type="text"]',
        ], element => {
          const haystack = `${element.getAttribute('name') || ''} ${element.id} ${element.getAttribute('placeholder') || ''}`.toLowerCase();
          return !haystack.includes('email') && !haystack.includes('search');
        }),
        0.86,
      ),
      createFallbackField(
        'email',
        findFirstMatchingElement(container, [
          'input[type="email"]',
          'input[name*="email" i]',
          'input[id*="email" i]',
          'input[placeholder*="email" i]',
        ]),
        0.9,
      ),
      createFallbackField(
        'website',
        findFirstMatchingElement(container, [
          'input[type="url"]',
          'input[name*="url" i]',
          'input[name*="website" i]',
          'input[id*="url" i]',
          'input[placeholder*="website" i]',
        ]),
        0.82,
      ),
      createFallbackField(
        'submit',
        findFirstMatchingElement(container, [
          'button[type="submit"]',
          'input[type="submit"]',
          'button',
          'input[type="button"]',
        ], element => {
          const label = (element.textContent || element.getAttribute('value') || '').trim().toLowerCase();
          return label.length === 0 || /(submit|post|comment|reply|send|发表|提交|评论|发送)/i.test(label);
        }),
        0.78,
      ),
    ].filter((field): field is FormField => Boolean(field)));

    const score =
      fields.length +
      (fields.some(field => field.type === 'submit') ? 1 : 0) +
      (fields.some(field => field.type === 'email') ? 0.5 : 0);

    if (score > bestScore) {
      bestScore = score;
      bestFields = fields;
    }
  }

  if (!bestFields.some(field => field.type === 'comment')) {
    return null;
  }

  if (!bestFields.some(field => field.type === 'submit') && bestFields.length < 2) {
    return null;
  }

  return {
    detected: true,
    pageType: PageType.BLOG_COMMENT,
    fields: bestFields,
    template: null,
    confidence: Math.min(0.98, 0.72 + bestFields.length * 0.06),
  };
}

function mergeDetectionWithFallback(detection: FormDetectionResult): FormDetectionResult {
  const fallback = detectSimpleCommentForm();
  if (!fallback) {
    return detection;
  }

  if (!detection.detected) {
    console.log('[Content Script] 启用评论表单兜底检测:', fallback.fields.map(field => field.type));
    return fallback;
  }

  const mergedFields = dedupeFields([...detection.fields, ...fallback.fields]);
  if (mergedFields.length === detection.fields.length) {
    return detection;
  }

  return {
    ...detection,
    fields: mergedFields,
    confidence: Math.max(detection.confidence, fallback.confidence),
  };
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
async function buildAutoComment(profile: WebsiteProfile, backlink: ManagedBacklink | null = null): Promise<string> {
  const comments = getProfileCommentTemplates(profile);

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
          pageLanguage: seo.language,
          websiteName: profile.name,
          websiteUrl: profile.url,
          websiteDescription: getPrimaryWebsiteDescription(profile),
          backlinkNote: backlink?.note,
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

  if (comments.length > 0) {
    const seo = getPageSeoSummary();
    const fallbackCandidates = buildCommentCandidates(
      profile,
      {
        seo,
        form_detected: true,
        form_confidence: 1,
        field_types: [],
        backlink_in_current_group: false,
        selected_website_link_present: false,
      },
      backlink,
    );

    return fallbackCandidates[0] || comments[0];
  }

  // 回退到模板生成
  const seo = getPageSeoSummary();
  const fallbackCandidates = buildCommentCandidates(
    profile,
    {
      seo,
      form_detected: true,
      form_confidence: 1,
      field_types: [],
      backlink_in_current_group: false,
      selected_website_link_present: false,
    },
    backlink,
  );

  return fallbackCandidates[0] || '';
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
      comment: await buildAutoComment(profile, currentBacklink),
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

  const detection = await formDetector.detect();
  lastDetectionResult = mergeDetectionWithFallback(detection);
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
    detectForms(true),
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

    const detection = await detectForms(true);
    if (!detection.detected) {
      throw new Error('当前页面未检测到可填充表单');
    }

    const validComments = getProfileCommentTemplates(profile);
    const payloadComment = payload.comment?.trim();
    const generatedCandidates = buildCommentCandidates(
      profile,
      {
        seo: getPageSeoSummary(),
        form_detected: true,
        form_confidence: 1,
        field_types: [],
        backlink_in_current_group: false,
        selected_website_link_present: false,
      },
      payload.backlink ?? null,
    );

    if (!payloadComment && !validComments.length && !generatedCandidates.length) {
      throw new Error('网站资料缺少评论内容');
    }

    const commentPool = validComments.length > 0 ? validComments : generatedCandidates;
    const selectedIndex = commentPool.length > 0
      ? typeof payload.commentIndex === 'number'
        ? Math.max(0, Math.min(commentPool.length - 1, payload.commentIndex))
        : Math.floor(Math.random() * commentPool.length)
      : 0;

    const commentToUse = payloadComment || commentPool[selectedIndex];

    const llmPlan = await buildLLMFillPlan(profile, payload.backlink ?? null, detection.fields);
    const resolvedFields = normalizeResolvedFields(detection.fields, llmPlan);
    const result = await autoFillService.fill(
      resolvedFields,
      {
        name: profile.name,
        email: profile.email,
        website: profile.url,
        comment: llmPlan?.comment?.trim() || commentToUse,
      },
      false,
    );

    if (result.success) {
      autoFillStarted = true;
      await learnTemplateIfNeeded(detection);

      // 设置待提交记录，等待表单提交事件
      if (backlinkId) {
        // 检查是否已提交过（避免重复提交）
        const hasSubmitted = await backlinkSubmissionStorage.hasSubmitted(profile.id, backlinkId);
        if (hasSubmitted) {
          console.warn('[Content Script] 该外链已提交过，跳过设置待提交记录:', { profileId: profile.id, backlinkId });
        } else {
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
    const detection = await detectForms(true);
    if (!detection.detected) {
      sendResponse({ success: false, error: '当前页面未检测到可填充表单' });
      return;
    }

    // 获取当前外链的备注（用于生成评论）
    let backlink: ManagedBacklink | null = null;
    if (backlinkId) {
      backlink = await managedBacklinkStorage.getBacklinkById(backlinkId);
    }

    // 使用指定的评论或生成自动评论
    const llmPlan = await buildLLMFillPlan(profile, backlink, detection.fields);
    const commentToUse = comment?.trim() || llmPlan?.comment?.trim() || await buildAutoComment(profile, backlink);
    const resolvedFields = normalizeResolvedFields(detection.fields, llmPlan);

    // 执行填充
    const result = await autoFillService.fill(
      resolvedFields,
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
        // 检查是否已提交过（避免重复提交）
        const hasSubmitted = await backlinkSubmissionStorage.hasSubmitted(profileId, backlinkId);
        if (hasSubmitted) {
          console.warn('[Content Script] 该外链已提交过，跳过设置待提交记录:', { profileId, backlinkId });
        } else {
          pendingSubmission = {
            profileId,
            backlinkId,
            comment: commentToUse,
            timestamp: Date.now(),
          };
          savePendingSubmission(pendingSubmission);
          console.log('[Content Script] 已设置待提交记录，等待表单提交');
        }
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

    // 检查是否超时
    if (isPendingSubmissionExpired(timestamp)) {
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
  try {
    console.log('[Content Script][Init] 开始注册 chrome.runtime.onMessage 监听器');
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => handleMessage(message, sender, sendResponse));
    console.log('[Content Script][Init] chrome.runtime.onMessage 监听器注册完成');

    console.log('[Content Script][Init] 准备执行 warmupDetectionIfNeeded');
    void warmupDetectionIfNeeded();
    console.log('[Content Script][Init] warmupDetectionIfNeeded 已触发');

    console.log('[Content Script][Init] 准备执行 ensurePassiveInterceptorBootstrap');
    void ensurePassiveInterceptorBootstrap();
    console.log('[Content Script][Init] ensurePassiveInterceptorBootstrap 已触发');

    console.log('[Content Script][Init] 准备初始化 URL 变化监听');
    initUrlChangeListener(); // 初始化 URL 变化监听
    console.log('[Content Script][Init] URL 变化监听初始化完成');

    console.log('[Content Script][Init] 准备初始化表单提交监听');
    initFormSubmitListener(); // 初始化表单提交监听
    console.log('[Content Script][Init] 表单提交监听初始化完成');

    console.log('[Content Script] 消息监听器已初始化');

    // 通知 background script content script 已就绪
    console.log('[Content Script][Init] 准备发送 CONTENT_SCRIPT_READY');
    void chrome.runtime.sendMessage({
      type: 'CONTENT_SCRIPT_READY',
      payload: {
        url: window.location.href,
        timestamp: Date.now()
      }
    }).then(() => {
      console.log('[Content Script][Init] CONTENT_SCRIPT_READY 发送成功');
    }).catch(error => {
      console.warn('[Content Script][Init] CONTENT_SCRIPT_READY 发送失败:', error);
    });
  } catch (error) {
    console.error('[Content Script] 消息监听器初始化失败:', error);
  }
}
