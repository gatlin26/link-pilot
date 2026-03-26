# 我的网站 + 外链管理 + AI 动态字段系统实现计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现"我的网站"URL 自动抓取 + AI 动态字段生成 + 可视化编辑 + 外链卡片式管理 + 可用性检测的分层架构系统。

**Architecture:** 三层分离架构 — 基础实体层（OwnedSite/ExternalLink）、AI 元数据层（OwnedSiteMetadata/ExternalLinkMetadata）、用户配置层（OwnedSiteProfile/ExternalLinkProfile）。动态字段系统通过 DynamicFieldDefinition + DynamicFieldValue 类型支持任意字段扩展。

**Tech Stack:** TypeScript, React, TailwindCSS, Chrome Extension Storage, AI LLM API

---

## 文件映射总览

### 新建文件
- `packages/shared/lib/types/external-link-types.ts` — 新类型定义（ExternalLink, ExternalLinkMetadata, ExternalLinkProfile, DynamicFieldDefinition, DynamicFieldValue, CommentTemplate 等）
- `packages/shared/lib/types/owned-site-types.ts` — OwnedSite 系列类型
- `packages/storage/lib/impl/owned-site-storage.ts` — OwnedSite 基础层 storage
- `packages/storage/lib/impl/owned-site-metadata-storage.ts` — OwnedSiteMetadata 层 storage
- `packages/storage/lib/impl/owned-site-profile-storage.ts` — OwnedSiteProfile 层 storage
- `packages/storage/lib/impl/external-link-storage.ts` — ExternalLink 基础层 storage
- `packages/storage/lib/impl/external-link-metadata-storage.ts` — ExternalLinkMetadata 层 storage
- `packages/storage/lib/impl/external-link-profile-storage.ts` — ExternalLinkProfile 层 storage
- `packages/shared/lib/services/dynamic-field-service.ts` — 动态字段操作服务
- `packages/shared/lib/services/link-metadata-collector.ts` — AI 元数据采集服务
- `packages/shared/lib/services/availability-checker.ts` — 可用性检测服务
- `packages/shared/lib/services/site-type-classifier.ts` — 站点类型 AI 识别服务
- `pages/options/src/components/OwnedSitesPanel.tsx` — "我的网站"管理面板
- `pages/options/src/components/ExternalLinksPanel.tsx` — 外链卡片式管理面板（替换 ManagedBacklinksPanel）
- `pages/options/src/components/DynamicFieldEditor.tsx` — 可视化动态字段编辑器
- `pages/options/src/components/LinkCard.tsx` — 外链卡片组件
- `pages/options/src/components/LinkDetailDrawer.tsx` — 外链详情抽屉
- `pages/options/src/components/SiteMetadataPreview.tsx` — AI 元数据预览组件

### 修改文件
- `packages/shared/lib/types/enums.ts` — 新增 LinkAvailabilityStatus enum, LinkSiteType enum
- `packages/shared/lib/types/index.ts` — 导出新类型
- `packages/storage/lib/impl/index.ts` — 导出新 storage
- `pages/options/src/Options.tsx` — 接入新面板
- `pages/options/src/components/ManagedBacklinksPanel.tsx` — 保留但标记为 Legacy，可在 ExternalLinksPanel 稳定后移除

---

## Phase 1: 类型与枚举定义

### Task 1: 新增枚举

**Files:**
- Modify: `packages/shared/lib/types/enums.ts`

- [ ] **Step 1: 在 enums.ts 末尾追加新枚举**

在 `export enum DeduplicationStrategy` 之后添加：

```typescript
/**
 * 外链可用性状态
 */
export enum LinkAvailabilityStatus {
  UNKNOWN = 'unknown',
  CHECKING = 'checking',
  AVAILABLE = 'available',
  UNAVAILABLE = 'unavailable',
}

/**
 * 站点类型（AI 推荐值，可扩展）
 */
export enum LinkSiteType {
  BLOG_COMMENT = 'blog_comment',
  DIRECTORY = 'directory',
  AI_DIRECTORY = 'ai_directory',
  FORUM = 'forum',
  SOCIAL_PROFILE = 'social_profile',
  GUEST_POST = 'guest_post',
  TOOL_SUBMISSION = 'tool_submission',
  OTHER = 'other',
}
```

- [ ] **Step 2: 提交**

```bash
git add packages/shared/lib/types/enums.ts
git commit -m "feat: add LinkAvailabilityStatus and LinkSiteType enums"
```

---

### Task 2: 新建 OwnedSite 系列类型

**Files:**
- Create: `packages/shared/lib/types/owned-site-types.ts`

- [ ] **Step 1: 创建文件**

```typescript
/**
 * 我的网站 — 基础实体层
 */
export interface OwnedSite {
  id: string;
  groupId: string;
  url: string;
  domain: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * 我的网站 — AI 元数据层
 */
export interface OwnedSiteMetadata {
  siteId: string;
  siteName?: string;
  siteTitle?: string;
  shortDescription?: string;
  fullDescription?: string;
  logoUrl?: string;
  screenshotUrl?: string;
  faviconUrl?: string;
  language?: string;
  categories?: string[];
  keywords?: string[];
  extractedFields: DynamicFieldDefinition[];
  analysisSummary?: string;
  generatedAt: string;
}

/**
 * 我的网站 — 用户配置层
 */
export interface OwnedSiteProfile {
  siteId: string;
  displayName?: string;
  customDescription?: string;
  approvedFields: DynamicFieldValue[];
  hiddenFieldKeys: string[];
  preferredTemplateIds: string[];
  notes?: string;
  updatedAt: string;
}

/**
 * 动态字段定义
 */
export interface DynamicFieldDefinition {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'url' | 'email' | 'image' | 'tag-list' | 'rich-text';
  source: 'system' | 'ai' | 'user';
  required: boolean;
  visible: boolean;
  group: 'site_info' | 'submission' | 'comment' | 'seo' | 'custom';
  description?: string;
  placeholder?: string;
  defaultValue?: string;
  order: number;
}

/**
 * 动态字段值
 */
export interface DynamicFieldValue {
  key: string;
  value: string;
  updatedBy: 'ai' | 'user';
  updatedAt: string;
}

/**
 * 评论模板
 */
export interface CommentTemplate {
  id: string;
  name: string;
  siteType: string;
  tone?: string;
  prompt: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * 模板推荐结果
 */
export interface TemplateRecommendation {
  templateId: string;
  score: number;
  reason: string;
}
```

- [ ] **Step 2: 提交**

```bash
git add packages/shared/lib/types/owned-site-types.ts
git commit -m "feat: add OwnedSite, OwnedSiteMetadata, OwnedSiteProfile types"
```

---

### Task 3: 新建 ExternalLink 系列类型

**Files:**
- Create: `packages/shared/lib/types/external-link-types.ts`

- [ ] **Step 1: 创建文件**

```typescript
import { LinkAvailabilityStatus, LinkSiteType } from './enums.js';

/**
 * 外链 — 基础实体层
 */
export interface ExternalLink {
  id: string;
  groupId: string;
  url: string;
  domain: string;
  status: LinkAvailabilityStatus;
  siteType: LinkSiteType;
  favorite: boolean;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  lastCheckedAt?: string;
}

/**
 * 外链 — AI 元数据层
 */
export interface ExternalLinkMetadata {
  linkId: string;
  siteName?: string;
  pageTitle?: string;
  summary?: string;
  description?: string;
  language?: string;
  categories?: string[];
  dr?: number;
  as?: number;
  detectedSiteType?: LinkSiteType;
  typeConfidence?: number;
  availableSignals?: {
    httpStatus?: number;
    reachable?: boolean;
    hasForm?: boolean;
    lastError?: string;
  };
  formFields: DynamicFieldDefinition[];
  dataFields: DynamicFieldDefinition[];
  recommendedTemplates: TemplateRecommendation[];
  analysisSummary?: string;
  generatedAt: string;
}

/**
 * 外链 — 用户配置层
 */
export interface ExternalLinkProfile {
  linkId: string;
  approvedSiteType?: LinkSiteType;
  customTags: string[];
  visibleFieldKeys: string[];
  customFieldValues: Record<string, string>;
  preferredTemplateId?: string;
  notes?: string;
  updatedAt: string;
}
```

- [ ] **Step 2: 提交**

```bash
git add packages/shared/lib/types/external-link-types.ts
git commit -m "feat: add ExternalLink, ExternalLinkMetadata, ExternalLinkProfile types"
```

---

### Task 4: 更新 shared 类型导出

**Files:**
- Modify: `packages/shared/lib/types/index.ts`

- [ ] **Step 1: 更新导出**

在现有 `export *` 后追加：

```typescript
export * from './owned-site-types.js';
export * from './external-link-types.js';
```

- [ ] **Step 2: 提交**

```bash
git add packages/shared/lib/types/index.ts
git commit -m "feat: export new type modules"
```

---

## Phase 2: Storage 层实现

### Task 5: OwnedSite Storage

**Files:**
- Create: `packages/storage/lib/impl/owned-site-storage.ts`

- [ ] **Step 1: 创建 Storage**

```typescript
import { createStorage, StorageEnum } from '../base/index.js';
import type { OwnedSite } from '@extension/shared';

interface OwnedSiteStorageState {
  sites: OwnedSite[];
  lastUpdated: string;
}

const defaultGroupId = 'default';

const storage = createStorage<OwnedSiteStorageState>(
  'owned-site-storage-key',
  {
    sites: [],
    lastUpdated: new Date().toISOString(),
  },
  {
    storageEnum: StorageEnum.Local,
    liveUpdate: true,
  },
);

export const ownedSiteStorage = {
  ...storage,

  async getAll(): Promise<OwnedSite[]> {
    const state = await storage.get();
    return state.sites;
  },

  async getById(id: string): Promise<OwnedSite | null> {
    const state = await storage.get();
    return state.sites.find(s => s.id === id) ?? null;
  },

  async add(site: OwnedSite): Promise<void> {
    await storage.set(state => ({
      ...state,
      sites: [...state.sites, site],
      lastUpdated: new Date().toISOString(),
    }));
  },

  async update(id: string, updates: Partial<OwnedSite>): Promise<void> {
    await storage.set(state => ({
      ...state,
      sites: state.sites.map(s =>
        s.id === id ? { ...s, ...updates, updatedAt: new Date().toISOString() } : s
      ),
      lastUpdated: new Date().toISOString(),
    }));
  },

  async delete(id: string): Promise<void> {
    await storage.set(state => ({
      ...state,
      sites: state.sites.filter(s => s.id !== id),
      lastUpdated: new Date().toISOString(),
    }));
  },
};
```

- [ ] **Step 2: 提交**

```bash
git add packages/storage/lib/impl/owned-site-storage.ts
git commit -m "feat: add ownedSiteStorage"
```

---

### Task 6: OwnedSiteMetadata Storage

**Files:**
- Create: `packages/storage/lib/impl/owned-site-metadata-storage.ts`

- [ ] **Step 1: 创建 Storage**

```typescript
import { createStorage, StorageEnum } from '../base/index.js';
import type { OwnedSiteMetadata } from '@extension/shared';

interface OwnedSiteMetadataState {
  metadata: Record<string, OwnedSiteMetadata>;
  lastUpdated: string;
}

const storage = createStorage<OwnedSiteMetadataState>(
  'owned-site-metadata-storage-key',
  { metadata: {}, lastUpdated: new Date().toISOString() },
  { storageEnum: StorageEnum.Local, liveUpdate: true },
);

export const ownedSiteMetadataStorage = {
  ...storage,

  async get(siteId: string): Promise<OwnedSiteMetadata | null> {
    const state = await storage.get();
    return state.metadata[siteId] ?? null;
  },

  async set(metadata: OwnedSiteMetadata): Promise<void> {
    await storage.set(state => ({
      ...state,
      metadata: { ...state.metadata, [metadata.siteId]: metadata },
      lastUpdated: new Date().toISOString(),
    }));
  },

  async delete(siteId: string): Promise<void> {
    await storage.set(state => {
      const next = { ...state.metadata };
      delete next[siteId];
      return { ...state, metadata: next, lastUpdated: new Date().toISOString() };
    });
  },
};
```

- [ ] **Step 2: 提交**

```bash
git add packages/storage/lib/impl/owned-site-metadata-storage.ts
git commit -m "feat: add ownedSiteMetadataStorage"
```

---

### Task 7: OwnedSiteProfile Storage

**Files:**
- Create: `packages/storage/lib/impl/owned-site-profile-storage.ts`

- [ ] **Step 1: 创建 Storage**

```typescript
import { createStorage, StorageEnum } from '../base/index.js';
import type { OwnedSiteProfile } from '@extension/shared';

interface OwnedSiteProfileState {
  profiles: Record<string, OwnedSiteProfile>;
  lastUpdated: string;
}

const storage = createStorage<OwnedSiteProfileState>(
  'owned-site-profile-storage-key',
  { profiles: {}, lastUpdated: new Date().toISOString() },
  { storageEnum: StorageEnum.Local, liveUpdate: true },
);

export const ownedSiteProfileStorage = {
  ...storage,

  async get(siteId: string): Promise<OwnedSiteProfile | null> {
    const state = await storage.get();
    return state.profiles[siteId] ?? null;
  },

  async upsert(profile: OwnedSiteProfile): Promise<void> {
    await storage.set(state => ({
      ...state,
      profiles: { ...state.profiles, [profile.siteId]: profile },
      lastUpdated: new Date().toISOString(),
    }));
  },

  async delete(siteId: string): Promise<void> {
    await storage.set(state => {
      const next = { ...state.profiles };
      delete next[siteId];
      return { ...state, profiles: next, lastUpdated: new Date().toISOString() };
    });
  },
};
```

- [ ] **Step 2: 提交**

```bash
git add packages/storage/lib/impl/owned-site-profile-storage.ts
git commit -m "feat: add ownedSiteProfileStorage"
```

---

### Task 8: ExternalLink Storage

**Files:**
- Create: `packages/storage/lib/impl/external-link-storage.ts`

- [ ] **Step 1: 创建 Storage**

```typescript
import { createStorage, StorageEnum } from '../base/index.js';
import type { ExternalLink, LinkAvailabilityStatus, LinkSiteType } from '@extension/shared';

interface ExternalLinkState {
  links: ExternalLink[];
  lastUpdated: string;
}

const storage = createStorage<ExternalLinkState>(
  'external-link-storage-key',
  {
    links: [],
    lastUpdated: new Date().toISOString(),
  },
  {
    storageEnum: StorageEnum.Local,
    liveUpdate: true,
  },
);

export const externalLinkStorage = {
  ...storage,

  async getAll(): Promise<ExternalLink[]> {
    const state = await storage.get();
    return state.links;
  },

  async getById(id: string): Promise<ExternalLink | null> {
    const state = await storage.get();
    return state.links.find(l => l.id === id) ?? null;
  },

  async getByGroup(groupId: string): Promise<ExternalLink[]> {
    const state = await storage.get();
    return state.links.filter(l => l.groupId === groupId);
  },

  async add(link: ExternalLink): Promise<void> {
    await storage.set(state => ({
      ...state,
      links: [...state.links, link],
      lastUpdated: new Date().toISOString(),
    }));
  },

  async update(id: string, updates: Partial<ExternalLink>): Promise<void> {
    await storage.set(state => ({
      ...state,
      links: state.links.map(l =>
        l.id === id ? { ...l, ...updates, updatedAt: new Date().toISOString() } : l
      ),
      lastUpdated: new Date().toISOString(),
    }));
  },

  async updateStatus(id: string, status: LinkAvailabilityStatus, lastCheckedAt?: string): Promise<void> {
    await this.update(id, { status, lastCheckedAt });
  },

  async delete(id: string): Promise<void> {
    await storage.set(state => ({
      ...state,
      links: state.links.filter(l => l.id !== id),
      lastUpdated: new Date().toISOString(),
    }));
  },

  async toggleFavorite(id: string): Promise<void> {
    const link = await this.getById(id);
    if (link) {
      await this.update(id, { favorite: !link.favorite });
    }
  },
};
```

- [ ] **Step 2: 提交**

```bash
git add packages/storage/lib/impl/external-link-storage.ts
git commit -m "feat: add externalLinkStorage"
```

---

### Task 9: ExternalLinkMetadata Storage

**Files:**
- Create: `packages/storage/lib/impl/external-link-metadata-storage.ts`

- [ ] **Step 1: 创建 Storage**

```typescript
import { createStorage, StorageEnum } from '../base/index.js';
import type { ExternalLinkMetadata } from '@extension/shared';

interface ExternalLinkMetadataState {
  metadata: Record<string, ExternalLinkMetadata>;
  lastUpdated: string;
}

const storage = createStorage<ExternalLinkMetadataState>(
  'external-link-metadata-storage-key',
  { metadata: {}, lastUpdated: new Date().toISOString() },
  { storageEnum: StorageEnum.Local, liveUpdate: true },
);

export const externalLinkMetadataStorage = {
  ...storage,

  async get(linkId: string): Promise<ExternalLinkMetadata | null> {
    const state = await storage.get();
    return state.metadata[linkId] ?? null;
  },

  async set(metadata: ExternalLinkMetadata): Promise<void> {
    await storage.set(state => ({
      ...state,
      metadata: { ...state.metadata, [metadata.linkId]: metadata },
      lastUpdated: new Date().toISOString(),
    }));
  },

  async delete(linkId: string): Promise<void> {
    await storage.set(state => {
      const next = { ...state.metadata };
      delete next[linkId];
      return { ...state, metadata: next, lastUpdated: new Date().toISOString() };
    });
  },
};
```

- [ ] **Step 2: 提交**

```bash
git add packages/storage/lib/impl/external-link-metadata-storage.ts
git commit -m "feat: add externalLinkMetadataStorage"
```

---

### Task 10: ExternalLinkProfile Storage

**Files:**
- Create: `packages/storage/lib/impl/external-link-profile-storage.ts`

- [ ] **Step 1: 创建 Storage**

```typescript
import { createStorage, StorageEnum } from '../base/index.js';
import type { ExternalLinkProfile } from '@extension/shared';

interface ExternalLinkProfileState {
  profiles: Record<string, ExternalLinkProfile>;
  lastUpdated: string;
}

const storage = createStorage<ExternalLinkProfileState>(
  'external-link-profile-storage-key',
  { profiles: {}, lastUpdated: new Date().toISOString() },
  { storageEnum: StorageEnum.Local, liveUpdate: true },
);

export const externalLinkProfileStorage = {
  ...storage,

  async get(linkId: string): Promise<ExternalLinkProfile | null> {
    const state = await storage.get();
    return state.profiles[linkId] ?? null;
  },

  async upsert(profile: ExternalLinkProfile): Promise<void> {
    await storage.set(state => ({
      ...state,
      profiles: { ...state.profiles, [profile.linkId]: profile },
      lastUpdated: new Date().toISOString(),
    }));
  },

  async delete(linkId: string): Promise<void> {
    await storage.set(state => {
      const next = { ...state.profiles };
      delete next[linkId];
      return { ...state, profiles: next, lastUpdated: new Date().toISOString() };
    });
  },
};
```

- [ ] **Step 2: 提交**

```bash
git add packages/storage/lib/impl/external-link-profile-storage.ts
git commit -m "feat: add externalLinkProfileStorage"
```

---

### Task 11: 更新 Storage 导出

**Files:**
- Modify: `packages/storage/lib/impl/index.ts`

- [ ] **Step 1: 追加导出**

```typescript
export * from './owned-site-storage.js';
export * from './owned-site-metadata-storage.js';
export * from './owned-site-profile-storage.js';
export * from './external-link-storage.js';
export * from './external-link-metadata-storage.js';
export * from './external-link-profile-storage.js';
```

- [ ] **Step 2: 提交**

```bash
git add packages/storage/lib/impl/index.ts
git commit -m "feat: export new storage modules"
```

---

## Phase 3: AI 服务层实现

### Task 12: 站点类型识别服务

**Files:**
- Create: `packages/shared/lib/services/site-type-classifier.ts`

- [ ] **Step 1: 创建服务**

```typescript
import type { LinkSiteType } from '@extension/shared';

/**
 * 基于页面特征的站点类型识别
 * 不依赖外部 LLM API，纯规则推断（MVP 阶段）
 * 后续可扩展为 LLM 调用
 */
export interface SiteAnalysisInput {
  url: string;
  pageTitle: string;
  metaDescription?: string;
  pageText: string;
  hasForm: boolean;
  formFields: string[];
  ctaText: string[];
  urlPath: string;
}

const SITE_TYPE_PATTERNS: Array<{
  type: LinkSiteType;
  keywords: string[];
  pathPatterns: string[];
  score: number;
}> = [
  {
    type: LinkSiteType.BLOG_COMMENT,
    keywords: ['comment', 'blog', 'post a reply', 'leave a reply', 'trackback', 'pingback', 'article', 'post comment'],
    pathPatterns: ['/post/', '/article/', '/blog/', '/p/', '/entry/'],
    score: 3,
  },
  {
    type: LinkSiteType.DIRECTORY,
    keywords: ['submit', 'add site', 'add url', 'directory', 'listing', 'register', 'submit site'],
    pathPatterns: ['/submit', '/add', '/register', '/add-site', '/submit-url'],
    score: 3,
  },
  {
    type: LinkSiteType.AI_DIRECTORY,
    keywords: ['ai tools', 'ai directory', 'submit ai', 'ai software', 'chatgpt', 'llm'],
    pathPatterns: ['/ai-', '/ai/', '/tools/', '/submit'],
    score: 4,
  },
  {
    type: LinkSiteType.FORUM,
    keywords: ['forum', 'discussion', 'reply', 'thread', 'topic', 'community'],
    pathPatterns: ['/forum/', '/topic/', '/thread/', '/discuss', '/community/'],
    score: 3,
  },
  {
    type: LinkSiteType.GUEST_POST,
    keywords: ['guest post', 'write for us', 'contribute', 'submit article', 'author', 'guest article'],
    pathPatterns: ['/guest', '/write-for-us', '/contribute', '/submit-post'],
    score: 3,
  },
  {
    type: LinkSiteType.TOOL_SUBMISSION,
    keywords: ['tool', 'software', 'submit tool', 'add tool', 'tool listing', 'product'],
    pathPatterns: ['/tools/', '/submit-tool', '/add-tool', '/product/'],
    score: 3,
  },
  {
    type: LinkSiteType.SOCIAL_PROFILE,
    keywords: ['profile', 'about', 'bio', 'author', 'contact', 'social'],
    pathPatterns: ['/about', '/profile/', '/author/', '/user/'],
    score: 1,
  },
];

export function classifySiteType(input: SiteAnalysisInput): { type: LinkSiteType; confidence: number; reason: string } {
  const { pageText, urlPath, formFields, ctaText, hasForm } = input;
  const combined = `${pageText} ${ctaText.join(' ')} ${formFields.join(' ')}`.toLowerCase();

  const scores: Record<string, number> = {};

  for (const pattern of SITE_TYPE_PATTERNS) {
    let score = 0;

    // 检查 URL 路径
    for (const pp of pattern.pathPatterns) {
      if (urlPath.toLowerCase().includes(pp)) {
        score += pattern.score;
        break;
      }
    }

    // 检查关键词
    for (const kw of pattern.keywords) {
      if (combined.includes(kw)) {
        score += 1;
      }
    }

    // 表单存在加分
    if (hasForm && ['BLOG_COMMENT', 'DIRECTORY', 'GUEST_POST'].includes(pattern.type)) {
      score += 2;
    }

    scores[pattern.type] = score;
  }

  const entries = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [bestType, bestScore] = entries[0];

  const confidence = bestScore === 0 ? 0 : Math.min(bestScore / 10, 1);

  return {
    type: bestScore === 0 ? LinkSiteType.OTHER : (bestType as LinkSiteType),
    confidence,
    reason: bestScore === 0
      ? '无法识别站点类型'
      : `基于 URL 路径和关键词匹配得分 ${bestScore}`,
  };
}
```

- [ ] **Step 2: 提交**

```bash
git add packages/shared/lib/services/site-type-classifier.ts
git commit -m "feat: add site type classifier service"
```

---

### Task 13: 可用性检测服务

**Files:**
- Create: `packages/shared/lib/services/availability-checker.ts`

- [ ] **Step 1: 创建服务**

```typescript
import { LinkAvailabilityStatus } from '@extension/shared';

export interface AvailabilityCheckResult {
  status: LinkAvailabilityStatus.AVAILABLE | LinkAvailabilityStatus.UNAVAILABLE;
  httpStatus?: number;
  reachable: boolean;
  hasForm?: boolean;
  lastError?: string;
  checkedAt: string;
}

/**
 * 检测外链是否可用
 * 使用 fetch API（受 Chrome Extension CORS 限制，需配合后台脚本或 AI Bridge）
 */
export async function checkAvailability(url: string): Promise<AvailabilityCheckResult> {
  const result: AvailabilityCheckResult = {
    status: LinkAvailabilityStatus.UNAVAILABLE,
    reachable: false,
    checkedAt: new Date().toISOString(),
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      method: 'HEAD',
      mode: 'no-cors',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    result.reachable = true;
    result.httpStatus = response.status || 0;
    result.status = LinkAvailabilityStatus.AVAILABLE;
  } catch (error) {
    result.reachable = false;
    result.status = LinkAvailabilityStatus.UNAVAILABLE;
    result.lastError = error instanceof Error ? error.message : 'Unknown error';

    if (error instanceof Error && error.name === 'AbortError') {
      result.lastError = '请求超时';
    }
  }

  return result;
}

/**
 * 批量检测
 */
export async function checkAvailabilityBatch(
  urls: string[],
  onProgress?: (done: number, total: number) => void
): Promise<Map<string, AvailabilityCheckResult>> {
  const results = new Map<string, AvailabilityCheckResult>();

  for (let i = 0; i < urls.length; i++) {
    const result = await checkAvailability(urls[i]);
    results.set(urls[i], result);
    onProgress?.(i + 1, urls.length);
  }

  return results;
}
```

- [ ] **Step 2: 提交**

```bash
git add packages/shared/lib/services/availability-checker.ts
git commit -m "feat: add availability checker service"
```

---

### Task 14: 动态字段服务

**Files:**
- Create: `packages/shared/lib/services/dynamic-field-service.ts`

- [ ] **Step 1: 创建服务**

```typescript
import type { DynamicFieldDefinition, DynamicFieldValue } from '@extension/shared';

/**
 * 合并 AI 生成的字段和用户确认的字段
 * 用户确认 > AI 推荐
 */
export function mergeFields(
  aiFields: DynamicFieldDefinition[],
  userValues: DynamicFieldValue[],
  hiddenKeys: string[]
): DynamicFieldDefinition[] {
  const userValueMap = new Map(userValues.map(v => [v.key, v]));

  return aiFields
    .filter(f => !hiddenKeys.includes(f.key))
    .map(field => {
      const userVal = userValueMap.get(field.key);
      if (userVal) {
        return {
          ...field,
          defaultValue: userVal.value,
          source: 'user' as const,
          visible: true,
        };
      }
      return field;
    });
}

/**
 * 从用户输入生成字段定义（MVP 简化版）
 */
export function createFieldDefinition(
  key: string,
  label: string,
  type: DynamicFieldDefinition['type'] = 'text',
  group: DynamicFieldDefinition['group'] = 'custom'
): DynamicFieldDefinition {
  return {
    key,
    label,
    type,
    source: 'user',
    required: false,
    visible: true,
    group,
    order: 0,
  };
}

/**
 * 将字段值数组转换为 Record<string, string>
 */
export function fieldsToRecord(values: DynamicFieldValue[]): Record<string, string> {
  return Object.fromEntries(values.map(v => [v.key, v.value]));
}

/**
 * 将 Record<string, string> 转换为字段值数组
 */
export function recordToFields(record: Record<string, string>, updatedBy: 'ai' | 'user'): DynamicFieldValue[] {
  return Object.entries(record).map(([key, value]) => ({
    key,
    value,
    updatedBy,
    updatedAt: new Date().toISOString(),
  }));
}
```

- [ ] **Step 2: 提交**

```bash
git add packages/shared/lib/services/dynamic-field-service.ts
git commit -m "feat: add dynamic field service"
```

---

### Task 15: AI 元数据采集服务（骨架 + LLM 调用）

**Files:**
- Create: `packages/shared/lib/services/link-metadata-collector.ts`

- [ ] **Step 1: 创建骨架服务**

```typescript
import type { ExternalLinkMetadata, OwnedSiteMetadata, DynamicFieldDefinition, TemplateRecommendation } from '@extension/shared';
import { classifySiteType, type SiteAnalysisInput } from './site-type-classifier.js';

/**
 * AI 元数据采集服务
 * MVP 阶段：基于规则的采集 + AI Bridge 调用
 * 后续可扩展为直接 LLM API 调用
 */
export interface SiteInfo {
  url: string;
  title: string;
  description: string;
  favicon: string;
  screenshot?: string;
  language?: string;
}

/**
 * 采集网站基础信息（使用 AI Bridge 或 fetch）
 */
export async function collectSiteInfo(url: string): Promise<SiteInfo | null> {
  // MVP: 通过 AI Bridge 或 chrome.runtime 发送消息获取页面信息
  // 后续可扩展为直接 fetch + AI 分析
  return new Promise(resolve => {
    chrome.runtime.sendMessage(
      { type: 'COLLECT_SITE_INFO', payload: { url } },
      response => {
        if (response?.success) {
          resolve(response.data);
        } else {
          resolve(null);
        }
      }
    );
  });
}

/**
 * 分析页面表单字段
 */
export function analyzeFormFields(formFields: string[]): DynamicFieldDefinition[] {
  const fieldMap: Array<{ key: string; label: string; type: DynamicFieldDefinition['type']; keywords: string[] }> = [
    { key: 'name', label: '姓名', type: 'text', keywords: ['name', 'author', '用户名', 'your name'] },
    { key: 'email', label: '邮箱', type: 'email', keywords: ['email', 'mail', '邮箱', 'e-mail'] },
    { key: 'website', label: '网站', type: 'url', keywords: ['website', 'url', 'site', '博客', 'blog url'] },
    { key: 'comment', label: '评论', type: 'textarea', keywords: ['comment', 'message', 'reply', '评论', '留言'] },
    { key: 'title', label: '标题', type: 'text', keywords: ['title', 'subject', '标题', '主题'] },
  ];

  return formFields.map(fieldName => {
    const normalized = fieldName.toLowerCase();
    const match = fieldMap.find(f => f.keywords.some(kw => normalized.includes(kw)));
    return {
      key: fieldName,
      label: fieldName,
      type: match?.type || 'text',
      source: 'ai' as const,
      required: false,
      visible: true,
      group: 'submission' as const,
      order: 0,
    };
  });
}

/**
 * 生成外链元数据
 */
export async function generateExternalLinkMetadata(
  url: string,
  pageContent?: string
): Promise<ExternalLinkMetadata | null> {
  const siteInfo = await collectSiteInfo(url);
  if (!siteInfo) return null;

  const urlObj = new URL(url);
  const analysisInput: SiteAnalysisInput = {
    url,
    pageTitle: siteInfo.title,
    metaDescription: siteInfo.description,
    pageText: pageContent || siteInfo.description,
    hasForm: true,
    formFields: [],
    ctaText: [],
    urlPath: urlObj.pathname,
  };

  const { type, confidence, reason } = classifySiteType(analysisInput);

  return {
    linkId: '',
    siteName: siteInfo.title,
    pageTitle: siteInfo.title,
    summary: siteInfo.description,
    description: siteInfo.description,
    language: siteInfo.language,
    detectedSiteType: type,
    typeConfidence: confidence,
    analysisSummary: reason,
    formFields: [],
    dataFields: [],
    recommendedTemplates: [],
    generatedAt: new Date().toISOString(),
  };
}
```

- [ ] **Step 2: 提交**

```bash
git add packages/shared/lib/services/link-metadata-collector.ts
git commit -m "feat: add link metadata collector service"
```

---

## Phase 4: UI 组件实现

### Task 16: 动态字段编辑器（核心组件）

**Files:**
- Create: `pages/options/src/components/DynamicFieldEditor.tsx`

- [ ] **Step 1: 创建组件**

创建 `pages/options/src/components/DynamicFieldEditor.tsx`：

```typescript
import React, { useState } from 'react';
import type { DynamicFieldDefinition, DynamicFieldValue } from '@extension/shared';

interface DynamicFieldEditorProps {
  fields: DynamicFieldDefinition[];
  values: DynamicFieldValue[];
  onValuesChange: (values: DynamicFieldValue[]) => void;
  onFieldToggle: (key: string, visible: boolean) => void;
  onFieldUpdate: (key: string, value: string) => void;
  onAddField: () => void;
  onRemoveField: (key: string) => void;
  disabled?: boolean;
}

export const DynamicFieldEditor: React.FC<DynamicFieldEditorProps> = ({
  fields,
  values,
  onValuesChange,
  onFieldToggle,
  onFieldUpdate,
  onAddField,
  onRemoveField,
  disabled = false,
}) => {
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [newFieldKey, setNewFieldKey] = useState('');
  const [newFieldLabel, setNewFieldLabel] = useState('');

  const valueMap = new Map(values.map(v => [v.key, v]));

  const getValue = (key: string): string => {
    return valueMap.get(key)?.value ?? '';
  };

  const handleValueChange = (key: string, val: string) => {
    const existing = values.find(v => v.key === key);
    if (existing) {
      onValuesChange(values.map(v => v.key === key ? { ...v, value: val, updatedAt: new Date().toISOString() } : v));
    } else {
      onValuesChange([...values, { key, value: val, updatedBy: 'user', updatedAt: new Date().toISOString() }]);
    }
  };

  const handleAddField = () => {
    if (!newFieldKey.trim() || !newFieldLabel.trim()) return;
    onAddField(); // 触发父组件添加字段
    setNewFieldKey('');
    setNewFieldLabel('');
  };

  const sourceBadge = (source: DynamicFieldDefinition['source']) => {
    const colors = {
      ai: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
      user: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
      system: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
    };
    const labels = { ai: 'AI', user: '用户', system: '系统' };
    return (
      <span className={`text-xs px-1.5 py-0.5 rounded ${colors[source]}`}>
        {labels[source]}
      </span>
    );
  };

  const visibleFields = fields.filter(f => f.visible);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-sm">动态字段</h4>
        <button
          onClick={onAddField}
          disabled={disabled}
          className="text-sm px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          + 新增字段
        </button>
      </div>

      {visibleFields.length === 0 && (
        <div className="text-sm text-gray-500 py-4 text-center">
          暂无字段，请输入 URL 并点击"AI 抓取"生成字段
        </div>
      )}

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {visibleFields
          .sort((a, b) => a.order - b.order)
          .map(field => (
            <div key={field.key} className="border dark:border-gray-700 rounded-lg p-3 bg-gray-50 dark:bg-gray-900">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-medium">{field.label}</span>
                <span className="text-xs text-gray-400">({field.key})</span>
                {sourceBadge(field.source)}
                {field.required && <span className="text-xs text-red-500">*必填</span>}
                <div className="flex-1" />
                <button
                  onClick={() => onFieldToggle(field.key, false)}
                  disabled={disabled}
                  className="text-xs text-gray-400 hover:text-red-500"
                >
                  隐藏
                </button>
                <button
                  onClick={() => onRemoveField(field.key)}
                  disabled={disabled}
                  className="text-xs text-red-400 hover:text-red-600"
                >
                  删除
                </button>
              </div>

              {field.type === 'textarea' ? (
                <textarea
                  value={getValue(field.key)}
                  onChange={e => handleValueChange(field.key, e.target.value)}
                  disabled={disabled}
                  placeholder={field.placeholder || `输入 ${field.label}`}
                  rows={3}
                  className="w-full px-2 py-1.5 border rounded text-sm dark:bg-gray-800 dark:border-gray-600"
                />
              ) : field.type === 'tag-list' ? (
                <input
                  value={getValue(field.key)}
                  onChange={e => handleValueChange(field.key, e.target.value)}
                  disabled={disabled}
                  placeholder="逗号分隔多个标签"
                  className="w-full px-2 py-1.5 border rounded text-sm dark:bg-gray-800 dark:border-gray-600"
                />
              ) : (
                <input
                  type={field.type === 'url' ? 'url' : field.type === 'email' ? 'email' : 'text'}
                  value={getValue(field.key)}
                  onChange={e => handleValueChange(field.key, e.target.value)}
                  disabled={disabled}
                  placeholder={field.placeholder || `输入 ${field.label}`}
                  className="w-full px-2 py-1.5 border rounded text-sm dark:bg-gray-800 dark:border-gray-600"
                />
              )}

              {field.description && (
                <p className="text-xs text-gray-400 mt-1">{field.description}</p>
              )}
            </div>
          ))}
      </div>
    </div>
  );
};
```

- [ ] **Step 2: 提交**

```bash
git add pages/options/src/components/DynamicFieldEditor.tsx
git commit -m "feat: add DynamicFieldEditor component"
```

---

### Task 17: 外链卡片组件

**Files:**
- Create: `pages/options/src/components/LinkCard.tsx`

- [ ] **Step 1: 创建组件**

```typescript
import React from 'react';
import type { ExternalLink, ExternalLinkMetadata } from '@extension/shared';
import { LinkAvailabilityStatus, LinkSiteType } from '@extension/shared';

interface LinkCardProps {
  link: ExternalLink;
  metadata?: ExternalLinkMetadata | null;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onFavorite: () => void;
  onCheckAvailability: () => void;
  onReanalyze: () => void;
}

const statusColors = {
  [LinkAvailabilityStatus.UNKNOWN]: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  [LinkAvailabilityStatus.CHECKING]: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  [LinkAvailabilityStatus.AVAILABLE]: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  [LinkAvailabilityStatus.UNAVAILABLE]: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};

const statusLabels = {
  [LinkAvailabilityStatus.UNKNOWN]: '未知',
  [LinkAvailabilityStatus.CHECKING]: '检测中',
  [LinkAvailabilityStatus.AVAILABLE]: '可用',
  [LinkAvailabilityStatus.UNAVAILABLE]: '不可用',
};

const siteTypeLabels: Record<string, string> = {
  [LinkSiteType.BLOG_COMMENT]: 'Blog评论',
  [LinkSiteType.DIRECTORY]: '目录站',
  [LinkSiteType.AI_DIRECTORY]: 'AI导航',
  [LinkSiteType.FORUM]: '论坛',
  [LinkSiteType.SOCIAL_PROFILE]: '社交资料',
  [LinkSiteType.GUEST_POST]: '客座文章',
  [LinkSiteType.TOOL_SUBMISSION]: '工具站',
  [LinkSiteType.OTHER]: '其他',
};

export const LinkCard: React.FC<LinkCardProps> = ({
  link,
  metadata,
  onOpen,
  onEdit,
  onDelete,
  onFavorite,
  onCheckAvailability,
  onReanalyze,
}) => {
  const statusColor = statusColors[link.status];
  const statusLabel = statusLabels[link.status];
  const siteType = metadata?.detectedSiteType || link.siteType;

  return (
    <div className="border dark:border-gray-700 rounded-xl p-4 bg-white dark:bg-gray-800 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-base truncate">
              {metadata?.siteName || link.domain}
            </h3>
            {link.favorite && (
              <span className="text-yellow-500 text-sm">★</span>
            )}
          </div>
          <div className="text-xs text-blue-500 truncate mt-0.5">
            {link.url}
          </div>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${statusColor}`}>
          {statusLabel}
        </span>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300 rounded">
          {siteTypeLabels[siteType] || siteType}
        </span>
        {metadata?.language && (
          <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 rounded">
            {metadata.language}
          </span>
        )}
        {metadata?.dr !== undefined && (
          <span className="text-xs px-2 py-0.5 bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-300 rounded">
            DR {metadata.dr}
          </span>
        )}
        {metadata?.as !== undefined && (
          <span className="text-xs px-2 py-0.5 bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-300 rounded">
            AS {metadata.as}
          </span>
        )}
      </div>

      {/* Summary */}
      {metadata?.summary && (
        <p className="text-xs text-gray-500 mb-3 line-clamp-2">{metadata.summary}</p>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2 pt-2 border-t dark:border-gray-700">
        <button
          onClick={onOpen}
          disabled={link.status === LinkAvailabilityStatus.UNAVAILABLE}
          className="px-3 py-1.5 bg-blue-500 text-white text-xs rounded-lg hover:bg-blue-600 disabled:opacity-40"
        >
          开始
        </button>
        <button
          onClick={onCheckAvailability}
          className="px-3 py-1.5 bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200 text-xs rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
        >
          检测
        </button>
        <button
          onClick={onReanalyze}
          className="px-3 py-1.5 bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300 text-xs rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/50"
        >
          重分析
        </button>
        <button
          onClick={onFavorite}
          className="px-3 py-1.5 text-xs rounded-lg hover:bg-yellow-50 dark:hover:bg-yellow-900/20"
        >
          {link.favorite ? '★' : '☆'}
        </button>
        <button
          onClick={onEdit}
          className="px-3 py-1.5 bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200 text-xs rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
        >
          编辑
        </button>
        <button
          onClick={onDelete}
          className="px-3 py-1.5 bg-red-50 text-red-500 text-xs rounded-lg hover:bg-red-100"
        >
          删除
        </button>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: 提交**

```bash
git add pages/options/src/components/LinkCard.tsx
git commit -m "feat: add LinkCard component"
```

---

### Task 18: 外链管理面板（卡片式）

**Files:**
- Create: `pages/options/src/components/ExternalLinksPanel.tsx`

- [ ] **Step 1: 创建组件**

创建 `pages/options/src/components/ExternalLinksPanel.tsx`，包含：
- 顶部筛选栏（搜索、站点类型、状态、分组、收藏）
- 卡片网格展示
- 新增外链表单（含 URL 输入 + AI 抓取按钮）
- AI 元数据预览
- 动态字段编辑器集成

```typescript
import React, { useState, useMemo } from 'react';
import type { ExternalLink, ExternalLinkMetadata, ExternalLinkProfile, DynamicFieldDefinition, DynamicFieldValue } from '@extension/shared';
import { LinkAvailabilityStatus, LinkSiteType } from '@extension/shared';
import { LinkCard } from './LinkCard.js';
import { DynamicFieldEditor } from './DynamicFieldEditor.js';

interface ExternalLinksPanelProps {
  links: ExternalLink[];
  metadataMap: Record<string, ExternalLinkMetadata>;
  onAddLink: (link: ExternalLink) => Promise<void>;
  onUpdateLink: (id: string, updates: Partial<ExternalLink>) => Promise<void>;
  onDeleteLink: (id: string) => Promise<void>;
  onCollectMetadata: (url: string) => Promise<ExternalLinkMetadata | null>;
  onCheckAvailability: (url: string) => Promise<void>;
  onToggleFavorite: (id: string) => Promise<void>;
}

export const ExternalLinksPanel: React.FC<ExternalLinksPanelProps> = ({
  links,
  metadataMap,
  onAddLink,
  onUpdateLink,
  onDeleteLink,
  onCollectMetadata,
  onCheckAvailability,
  onToggleFavorite,
}) => {
  const [search, setSearch] = useState('');
  const [siteTypeFilter, setSiteTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [favFilter, setFavFilter] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [collecting, setCollecting] = useState(false);
  const [collectedMetadata, setCollectedMetadata] = useState<ExternalLinkMetadata | null>(null);
  const [fieldValues, setFieldValues] = useState<DynamicFieldValue[]>([]);

  const filteredLinks = useMemo(() => {
    return links.filter(link => {
      const matchesSearch = !search || link.domain.includes(search) || link.url.includes(search);
      const matchesType = siteTypeFilter === 'all' || link.siteType === siteTypeFilter;
      const matchesStatus = statusFilter === 'all' || link.status === statusFilter;
      const matchesFav = !favFilter || link.favorite;
      return matchesSearch && matchesType && matchesStatus && matchesFav;
    });
  }, [links, search, siteTypeFilter, statusFilter, favFilter]);

  const handleCollect = async () => {
    if (!newUrl.trim()) return;
    setCollecting(true);
    try {
      const metadata = await onCollectMetadata(newUrl.trim());
      setCollectedMetadata(metadata);
      if (metadata?.dataFields) {
        setFieldValues(
          metadata.dataFields.map(f => ({
            key: f.key,
            value: f.defaultValue || '',
            updatedBy: 'ai' as const,
            updatedAt: new Date().toISOString(),
          }))
        );
      }
    } finally {
      setCollecting(false);
    }
  };

  const handleSave = async () => {
    if (!newUrl.trim()) return;
    const url = newUrl.startsWith('http') ? newUrl : `https://${newUrl}`;
    const domain = new URL(url).hostname;
    const link: ExternalLink = {
      id: `ext-link-${Date.now()}`,
      groupId: 'default',
      url,
      domain,
      status: LinkAvailabilityStatus.UNKNOWN,
      siteType: collectedMetadata?.detectedSiteType || LinkSiteType.OTHER,
      favorite: false,
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await onAddLink(link);
    setNewUrl('');
    setShowAddForm(false);
    setCollectedMetadata(null);
    setFieldValues([]);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">外链管理</h2>
          <p className="text-sm text-gray-500 mt-1">
            共 {filteredLinks.length} 条外链
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(v => !v)}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
        >
          + 新增外链
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="搜索 URL / 域名..."
          className="px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm flex-1 min-w-48"
        />
        <select
          value={siteTypeFilter}
          onChange={e => setSiteTypeFilter(e.target.value)}
          className="px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm"
        >
          <option value="all">全部类型</option>
          {Object.values(LinkSiteType).map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm"
        >
          <option value="all">全部状态</option>
          {Object.values(LinkAvailabilityStatus).map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={favFilter}
            onChange={e => setFavFilter(e.target.checked)}
          />
          仅收藏
        </label>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border dark:border-gray-700 space-y-4">
          <h3 className="font-semibold">新增外链</h3>
          <div className="flex gap-3">
            <input
              value={newUrl}
              onChange={e => setNewUrl(e.target.value)}
              placeholder="输入外链 URL"
              className="flex-1 px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            />
            <button
              onClick={handleCollect}
              disabled={collecting || !newUrl.trim()}
              className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50"
            >
              {collecting ? '采集中...' : 'AI 抓取'}
            </button>
          </div>

          {collectedMetadata && (
            <div className="space-y-3">
              {/* AI Metadata Preview */}
              <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg space-y-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{collectedMetadata.siteName || collectedMetadata.pageTitle}</span>
                  <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded">
                    AI 已分析
                  </span>
                </div>
                {collectedMetadata.summary && (
                  <p className="text-sm text-gray-500">{collectedMetadata.summary}</p>
                )}
                {collectedMetadata.analysisSummary && (
                  <p className="text-xs text-gray-400">{collectedMetadata.analysisSummary}</p>
                )}
              </div>

              {/* Dynamic Fields */}
              {collectedMetadata.dataFields && collectedMetadata.dataFields.length > 0 && (
                <DynamicFieldEditor
                  fields={collectedMetadata.dataFields}
                  values={fieldValues}
                  onValuesChange={setFieldValues}
                  onFieldToggle={() => {}}
                  onFieldUpdate={() => {}}
                  onAddField={() => {}}
                  onRemoveField={() => {}}
                />
              )}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={!newUrl.trim()}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
            >
              保存外链
            </button>
            <button
              onClick={() => { setShowAddForm(false); setNewUrl(''); setCollectedMetadata(null); }}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* Card Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredLinks.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-500">
            暂无外链，请点击上方"新增外链"添加
          </div>
        ) : (
          filteredLinks.map(link => (
            <LinkCard
              key={link.id}
              link={link}
              metadata={metadataMap[link.id]}
              onOpen={() => {}}
              onEdit={() => {}}
              onDelete={() => onDeleteLink(link.id)}
              onFavorite={() => onToggleFavorite(link.id)}
              onCheckAvailability={() => onCheckAvailability(link.url)}
              onReanalyze={() => {}}
            />
          ))
        )}
      </div>
    </div>
  );
};
```

- [ ] **Step 2: 提交**

```bash
git add pages/options/src/components/ExternalLinksPanel.tsx
git commit -m "feat: add ExternalLinksPanel with card layout"
```

---

### Task 19: "我的网站"管理面板

**Files:**
- Create: `pages/options/src/components/OwnedSitesPanel.tsx`

- [ ] **Step 1: 创建组件**

创建 `pages/options/src/components/OwnedSitesPanel.tsx`，包含：
- 卡片列表展示已有网站
- 新增网站表单（URL + AI 抓取）
- AI 元数据预览
- 动态字段编辑器
- 基础信息编辑（名称、描述、分类、关键词）

```typescript
import React, { useState } from 'react';
import type { OwnedSite, OwnedSiteMetadata, OwnedSiteProfile, DynamicFieldDefinition, DynamicFieldValue } from '@extension/shared';
import { DynamicFieldEditor } from './DynamicFieldEditor.js';

interface OwnedSitesPanelProps {
  sites: OwnedSite[];
  metadataMap: Record<string, OwnedSiteMetadata>;
  profiles: Record<string, OwnedSiteProfile>;
  onAddSite: (site: OwnedSite) => Promise<void>;
  onUpdateSite: (id: string, updates: Partial<OwnedSite>) => Promise<void>;
  onDeleteSite: (id: string) => Promise<void>;
  onCollectMetadata: (url: string) => Promise<OwnedSiteMetadata | null>;
  onSaveProfile: (profile: OwnedSiteProfile) => Promise<void>;
}

export const OwnedSitesPanel: React.FC<OwnedSitesPanelProps> = ({
  sites,
  metadataMap,
  profiles,
  onAddSite,
  onUpdateSite,
  onDeleteSite,
  onCollectMetadata,
  onSaveProfile,
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [collecting, setCollecting] = useState(false);
  const [collectedMetadata, setCollectedMetadata] = useState<OwnedSiteMetadata | null>(null);
  const [fieldValues, setFieldValues] = useState<DynamicFieldValue[]>([]);
  const [editingSiteId, setEditingSiteId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [customDesc, setCustomDesc] = useState('');

  const handleCollect = async () => {
    if (!newUrl.trim()) return;
    setCollecting(true);
    try {
      const metadata = await onCollectMetadata(newUrl.trim());
      setCollectedMetadata(metadata);
      if (metadata?.extractedFields) {
        setFieldValues(
          metadata.extractedFields.map(f => ({
            key: f.key,
            value: f.defaultValue || '',
            updatedBy: 'ai' as const,
            updatedAt: new Date().toISOString(),
          }))
        );
        setDisplayName(metadata.siteName || '');
        setCustomDesc(metadata.fullDescription || '');
      }
    } finally {
      setCollecting(false);
    }
  };

  const handleSave = async () => {
    if (!newUrl.trim()) return;
    const url = newUrl.startsWith('http') ? newUrl : `https://${newUrl}`;
    const domain = new URL(url).hostname;
    const id = `owned-site-${Date.now()}`;
    const site: OwnedSite = {
      id,
      groupId: 'default',
      url,
      domain,
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await onAddSite(site);
    if (collectedMetadata) {
      await onCollectMetadata(url);
    }
    setNewUrl('');
    setShowAddForm(false);
    setCollectedMetadata(null);
    setFieldValues([]);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">我的网站</h2>
          <p className="text-sm text-gray-500 mt-1">
            管理你的网站资料，用于后续评论和提交
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(v => !v)}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
        >
          + 新增网站
        </button>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border dark:border-gray-700 space-y-4">
          <h3 className="font-semibold">新增网站</h3>

          <div className="flex gap-3">
            <input
              value={newUrl}
              onChange={e => setNewUrl(e.target.value)}
              placeholder="输入网站 URL"
              className="flex-1 px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            />
            <button
              onClick={handleCollect}
              disabled={collecting || !newUrl.trim()}
              className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50"
            >
              {collecting ? 'AI 采集中...' : 'AI 抓取'}
            </button>
          </div>

          {collectedMetadata && (
            <div className="space-y-4">
              {/* AI Metadata Preview */}
              <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg space-y-3">
                <div className="flex items-center gap-3">
                  {collectedMetadata.faviconUrl && (
                    <img src={collectedMetadata.faviconUrl} className="w-6 h-6" alt="favicon" />
                  )}
                  <div>
                    <div className="font-medium">{collectedMetadata.siteName || collectedMetadata.siteTitle}</div>
                    <div className="text-xs text-gray-400">{collectedMetadata.shortDescription}</div>
                  </div>
                </div>

                {collectedMetadata.categories && collectedMetadata.categories.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {collectedMetadata.categories.map(cat => (
                      <span key={cat} className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded">{cat}</span>
                    ))}
                  </div>
                )}

                {collectedMetadata.keywords && collectedMetadata.keywords.length > 0 && (
                  <div className="text-xs text-gray-500">
                    关键词: {collectedMetadata.keywords.join(', ')}
                  </div>
                )}

                <div className="text-xs text-purple-600">{collectedMetadata.analysisSummary}</div>
              </div>

              {/* Display Name & Description */}
              <div>
                <label className="block text-sm font-medium mb-1">显示名称</label>
                <input
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">网站描述</label>
                <textarea
                  value={customDesc}
                  onChange={e => setCustomDesc(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                />
              </div>

              {/* Dynamic Fields */}
              {collectedMetadata.extractedFields && collectedMetadata.extractedFields.length > 0 && (
                <DynamicFieldEditor
                  fields={collectedMetadata.extractedFields}
                  values={fieldValues}
                  onValuesChange={setFieldValues}
                  onFieldToggle={() => {}}
                  onFieldUpdate={() => {}}
                  onAddField={() => {}}
                  onRemoveField={() => {}}
                />
              )}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={!newUrl.trim()}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
            >
              保存网站
            </button>
            <button
              onClick={() => { setShowAddForm(false); setNewUrl(''); setCollectedMetadata(null); }}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* Sites List */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {sites.length === 0 && !showAddForm && (
          <div className="col-span-full text-center py-12 text-gray-500">
            暂无网站，请点击上方"新增网站"添加
          </div>
        )}
        {sites.map(site => {
          const metadata = metadataMap[site.id];
          const profile = profiles[site.id];
          return (
            <div key={site.id} className="border dark:border-gray-700 rounded-xl p-4 bg-white dark:bg-gray-800">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  {metadata?.faviconUrl && <img src={metadata.faviconUrl} className="w-5 h-5" alt="favicon" />}
                  <div>
                    <div className="font-semibold">{profile?.displayName || metadata?.siteName || site.domain}</div>
                    <div className="text-xs text-blue-500 truncate">{site.url}</div>
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded ${site.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {site.enabled ? '启用' : '禁用'}
                </span>
              </div>
              {metadata?.shortDescription && (
                <p className="text-sm text-gray-500 mt-2 line-clamp-2">{metadata.shortDescription}</p>
              )}
              {metadata?.categories && metadata.categories.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {metadata.categories.map(cat => (
                    <span key={cat} className="text-xs px-1.5 py-0.5 bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300 rounded">
                      {cat}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-2 mt-3 pt-2 border-t dark:border-gray-700">
                <button
                  onClick={() => { setEditingSiteId(site.id); setDisplayName(profile?.displayName || metadata?.siteName || ''); setCustomDesc(profile?.customDescription || metadata?.fullDescription || ''); }}
                  className="px-3 py-1.5 bg-blue-500 text-white text-xs rounded-lg hover:bg-blue-600"
                >
                  编辑
                </button>
                <button
                  onClick={() => onDeleteSite(site.id)}
                  className="px-3 py-1.5 bg-red-50 text-red-500 text-xs rounded-lg hover:bg-red-100"
                >
                  删除
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
```

- [ ] **Step 2: 提交**

```bash
git add pages/options/src/components/OwnedSitesPanel.tsx
git commit -m "feat: add OwnedSitesPanel component"
```

---

## Phase 5: 集成到 Options 页面

### Task 20: 更新 Options.tsx 接入新面板

**Files:**
- Modify: `pages/options/src/Options.tsx`

- [ ] **Step 1: 读取现有 Options.tsx 结构**

```bash
head -50 pages/options/src/Options.tsx
```

- [ ] **Step 2: 在现有面板列表中添加新面板入口**

在 `Options.tsx` 中添加 Tab 切换或直接集成到现有布局：

```typescript
// 在现有面板基础上新增两个 Tab
const [activeTab, setActiveTab] = useState<'links' | 'owned-sites' | 'managed-backlinks'>('links');

// 在渲染部分：
<div className="flex border-b dark:border-gray-700 mb-4">
  <button onClick={() => setActiveTab('links')} className={`px-4 py-2 ${activeTab === 'links' ? 'border-b-2 border-blue-500 font-medium' : ''}`}>
    外链管理
  </button>
  <button onClick={() => setActiveTab('owned-sites')} className={`px-4 py-2 ${activeTab === 'owned-sites' ? 'border-b-2 border-blue-500 font-medium' : ''}`}>
    我的网站
  </button>
  <button onClick={() => setActiveTab('managed-backlinks')} className={`px-4 py-2 ${activeTab === 'managed-backlinks' ? 'border-b-2 border-blue-500 font-medium' : ''}`}>
    旧版外链
  </button>
</div>

// 条件渲染面板
{activeTab === 'owned-sites' && <OwnedSitesPanel ... />}
{activeTab === 'links' && <ExternalLinksPanel ... />}
{activeTab === 'managed-backlinks' && <ManagedBacklinksPanel ... />}
```

- [ ] **Step 3: 提交**

```bash
git add pages/options/src/Options.tsx
git commit -m "feat: integrate new OwnedSitesPanel and ExternalLinksPanel into Options"
```

---

## Phase 6: Build 验证

### Task 21: Build 验证

- [ ] **Step 1: 运行 build**

```bash
cd /Users/xingzhi/code/link-pilot
pnpm build 2>&1 | tail -30
```

Expected: Build 完成，无类型错误

- [ ] **Step 2: 运行 type-check**

```bash
pnpm type-check 2>&1 | tail -20
```

Expected: 无 TS 错误

- [ ] **Step 3: 提交**

```bash
git add -A
git commit -m "feat: complete dynamic fields and link management system"
```

---

## 任务清单总结

- [ ] Task 1: 新增 LinkAvailabilityStatus 和 LinkSiteType 枚举
- [ ] Task 2: 新建 OwnedSite 系列类型
- [ ] Task 3: 新建 ExternalLink 系列类型
- [ ] Task 4: 更新 shared 类型导出
- [ ] Task 5: OwnedSite Storage
- [ ] Task 6: OwnedSiteMetadata Storage
- [ ] Task 7: OwnedSiteProfile Storage
- [ ] Task 8: ExternalLink Storage
- [ ] Task 9: ExternalLinkMetadata Storage
- [ ] Task 10: ExternalLinkProfile Storage
- [ ] Task 11: 更新 Storage 导出
- [ ] Task 12: 站点类型识别服务
- [ ] Task 13: 可用性检测服务
- [ ] Task 14: 动态字段服务
- [ ] Task 15: AI 元数据采集服务
- [ ] Task 16: 动态字段编辑器
- [ ] Task 17: 外链卡片组件
- [ ] Task 18: 外链管理面板
- [ ] Task 19: "我的网站"管理面板
- [ ] Task 20: 集成到 Options 页面
- [ ] Task 21: Build 验证
