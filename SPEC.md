# Link Pilot 外链类型识别 + 半自动评论提交 技术方案

## 项目背景

Link Pilot 是一个 Chrome 扩展 + 后端 SaaS 应用，用于外链管理和自动化评论提交。现有代码已具备：
- 外链数据采集（Ahrefs API）
- 表单检测和自动填充（博客评论）
- 模板学习和字段映射

本次需求新增两个功能模块。

---

## 一、外链类型识别

### 1.1 需求分析

**需求目标：**
- 识别外链是否可用（可访问、活着）
- 打标外链类型：博客、社交媒体、视频、工具、电商、新闻、论坛等
- 记录外链的可用性状态

**数据模型扩展：**

```typescript
// 新增字段到 CollectedBacklink
interface CollectedBacklink {
  // ... 现有字段
  
  // 新增字段
  availability_status?: 'alive' | 'dead' | 'unknown';
  availability_checked_at?: string;
  availability_error?: string;
  link_category?: LinkCategory;
  category_confidence?: number;
}

enum LinkCategory {
  BLOG = 'blog',
  SOCIAL_MEDIA = 'social_media',
  VIDEO = 'video',
  TOOL = 'tool',
  ECOMMERCE = 'ecommerce',
  NEWS = 'news',
  FORUM = 'forum',
  WIKI = 'wiki',
  QNA = 'qna',
  RESOURCE_PAGE = 'resource_page',
  UNKNOWN = 'unknown',
}
```

### 1.2 可用性检测方案

**方案选型：**

| 方案 | 优点 | 缺点 | 推荐 |
|------|------|------|------|
| HTTP HEAD 请求 | 速度快，只获取响应头 | 某些网站不支持 | ✅ 首选 |
| HTTP GET 请求 | 获取完整内容，准确性高 | 速度慢，资源消耗大 | ✅ 备用 |
| Puppeteer/Playwright | 能渲染 JS，检测准确 | 资源消耗极大 | ❌ 不推荐 |

**实现方案：**

```typescript
// backend/src/services/link-availability.ts

interface AvailabilityResult {
  status: 'alive' | 'dead' | 'unknown';
  statusCode?: number;
  contentType?: string;
  contentLength?: number;
  responseTime?: number;
  error?: string;
  checkedAt: string;
}

export class LinkAvailabilityService {
  private readonly userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
  private readonly timeout = 10000;
  
  async check(url: string): Promise<AvailabilityResult> {
    const startTime = Date.now();
    
    try {
      // 首先尝试 HEAD 请求
      const response = await this.fetchWithTimeout(url, 'HEAD');
      
      return {
        status: response.ok ? 'alive' : 'dead',
        statusCode: response.status,
        contentType: response.headers.get('content-type') || undefined,
        contentLength: parseInt(response.headers.get('content-length') || '0', 10) || undefined,
        responseTime: Date.now() - startTime,
        checkedAt: new Date().toISOString(),
      };
    } catch (error) {
      // HEAD 失败，尝试 GET 请求（部分网站不支持 HEAD）
      if (error instanceof Error && error.name === 'MethodNotAllowedError') {
        try {
          const response = await this.fetchWithTimeout(url, 'GET');
          return {
            status: response.ok ? 'alive' : 'dead',
            statusCode: response.status,
            checkedAt: new Date().toISOString(),
          };
        } catch {}
      }
      
      return {
        status: 'unknown',
        error: error instanceof Error ? error.message : 'Unknown error',
        checkedAt: new Date().toISOString(),
      };
    }
  }
  
  private async fetchWithTimeout(
    url: string, 
    method: 'HEAD' | 'GET'
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    
    try {
      return await fetch(url, {
        method,
        signal: controller.signal,
        redirect: 'follow',
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'text/html,application/xhtml+xml',
        },
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
```

**检测策略：**

1. **批量检测**：后端提供批量检测 API，每次最多 100 个 URL
2. **异步队列**：使用任务队列处理大量 URL 检测，避免阻塞
3. **智能重试**：失败的 URL 最多重试 2 次，间隔 5 秒
4. **频率控制**：每个域名最多同时 3 个请求，避免被封

### 1.3 类型识别方案

**识别策略：**

| 识别方法 | 优先级 | 说明 |
|----------|--------|------|
| 域名特征匹配 | P0 | 根据域名快速判断（如 youtube.com, twitter.com） |
| URL 路径模式 | P0 | 根据 URL 结构判断（如 /blog/, /forum/, /product/） |
| 页面内容分析 | P1 | 分析页面标题、meta 标签、内容特征 |
| AI 分类 | P2 | 使用 LLM 进行更精确的分类 |

**实现代码：**

```typescript
// backend/src/services/link-classifier.ts

interface ClassificationResult {
  category: LinkCategory;
  confidence: number;
  reasons: string[];
}

export class LinkClassifier {
  // 域名到类型的映射
  private domainPatterns: Record<LinkCategory, RegExp[]> = {
    [LinkCategory.VIDEO]: [
      /youtube\.com/i, /youtu\.be/i, /vimeo\.com/i, 
      /bilibili\.com/i, /dailymotion\.com/i, /twitch\.tv/i,
    ],
    [LinkCategory.SOCIAL_MEDIA]: [
      /twitter\.com/i, /x\.com/i, /facebook\.com/i,
      /instagram\.com/i, /linkedin\.com/i, /reddit\.com/i,
      /pinterest\.com/i, /tumblr\.com/i, /weibo\.com/i,
    ],
    [LinkCategory.ECOMMERCE]: [
      /amazon\.com/i, /ebay\.com/i, /aliexpress\.com/i,
      /taobao\.com/i, /jd\.com/i, /shopify\.com/i,
      /etsy\.com/i, /walmart\.com/i,
    ],
    [LinkCategory.NEWS]: [
      /cnn\.com/i, /bbc\.com/i, /nytimes\.com/i,
      /reuters\.com/i, /bloomberg\.com/i, /theguardian\.com/i,
      /news\./i, /press\./i,
    ],
    [LinkCategory.FORUM]: [
      /forum\./i, /board\./i, /discussion\./i,
      /reddit\.com\/r\//i, /stackexchange\.com/i,
      /discourse\./i, /phpbb\./i,
    ],
    [LinkCategory.BLOG]: [
      /medium\.com/i, /blogspot\.com/i, /wordpress\.com/i,
      /ghost\./i, /substack\.com/i, /dev\.to/i,
      /hashnode\.dev/i, /blog\./i,
    ],
    [LinkCategory.TOOL]: [
      /canva\.com/i, /figma\.com/i, /miro\.com/i,
      /notion\.so/i, /airtable\.com/i, /typeform\.com/i,
      /calculator\./i, /generator\./i, /tool\./i,
    ],
    [LinkCategory.WIKI]: [
      /wikipedia\.org/i, /wikia\.com/i, /wiki\./i,
    ],
    [LinkCategory.QNA]: [
      /stackoverflow\.com/i, /quora\.com/i, 
      /answers\.yahoo\.com/i, /zhihu\.com/i,
    ],
    [LinkCategory.RESOURCE_PAGE]: [
      /resources?\./i, /links?\./i, /recommended\./i,
      /tools?\./i, /directory\./i, /collection\./i,
    ],
    [LinkCategory.UNKNOWN]: [],
  };
  
  // URL 路径模式
  private pathPatterns: Record<LinkCategory, RegExp[]> = {
    [LinkCategory.BLOG]: [
      /^\/blog\//i, /^\/post\//i, /^\/article\//i,
      /^\/20\d{2}\/\d{2}\//i, // 日期路径如 /2024/03/
    ],
    [LinkCategory.FORUM]: [
      /^\/forum\//i, /^\/thread\//i, /^\/topic\//i,
      /^\/t\//i, // 短路径如 /t/12345
    ],
    [LinkCategory.VIDEO]: [
      /^\/watch\//i, /^\/v\//i, /^\/embed\//i,
      /^\/video\//i, /^\/blended\//i,
    ],
    [LinkCategory.NEWS]: [
      /^\/news\//i, /^\/article\//i, /^\/breaking\//i,
    ],
    [LinkCategory.ECOMMERCE]: [
      /^\/product\//i, /^\/item\//i, /^\/dp\//i,
      /^\/shop\//i, /^\/cart\//i,
    ],
    [LinkCategory.RESOURCE_PAGE]: [
      /^\/resources\//i, /^\/links\//i, /^\/recommended\//i,
      /^\/tools\//i, /^\/directory\//i,
    ],
    // 其他类型默认空数组
    [LinkCategory.SOCIAL_MEDIA]: [],
    [LinkCategory.TOOL]: [],
    [LinkCategory.WIKI]: [],
    [LinkCategory.QNA]: [],
    [LinkCategory.UNKNOWN]: [],
  };
  
  async classify(url: string, content?: string): Promise<ClassificationResult> {
    const parsedUrl = new URL(url);
    const domain = parsedUrl.hostname;
    const path = parsedUrl.pathname;
    
    // 1. 域名特征匹配
    for (const [category, patterns] of Object.entries(this.domainPatterns)) {
      if (patterns.some(pattern => pattern.test(domain))) {
        return {
          category: category as LinkCategory,
          confidence: 0.95,
          reasons: [`域名匹配: ${domain}`],
        };
      }
    }
    
    // 2. URL 路径模式匹配
    for (const [category, patterns] of Object.entries(this.pathPatterns)) {
      if (patterns.some(pattern => pattern.test(path))) {
        return {
          category: category as LinkCategory,
          confidence: 0.85,
          reasons: [`URL 路径匹配: ${path}`],
        };
      }
    }
    
    // 3. 页面内容分析（可选，需要 fetch 内容）
    if (content) {
      return this.classifyByContent(content, url);
    }
    
    // 4. 无法识别
    return {
      category: LinkCategory.UNKNOWN,
      confidence: 0.0,
      reasons: ['无法识别链接类型'],
    };
  }
  
  private classifyByContent(content: string, url: string): ClassificationResult {
    const text = content.toLowerCase();
    const scores: Record<LinkCategory, number> = {
      [LinkCategory.BLOG]: 0,
      [LinkCategory.SOCIAL_MEDIA]: 0,
      [LinkCategory.VIDEO]: 0,
      [LinkCategory.TOOL]: 0,
      [LinkCategory.ECOMMERCE]: 0,
      [LinkCategory.NEWS]: 0,
      [LinkCategory.FORUM]: 0,
      [LinkCategory.WIKI]: 0,
      [LinkCategory.QNA]: 0,
      [LinkCategory.RESOURCE_PAGE]: 0,
      [LinkCategory.UNKNOWN]: 0,
    };
    
    // 内容特征关键词
    const contentPatterns: Record<LinkCategory, string[]> = {
      [LinkCategory.BLOG]: ['written by', 'author', 'published', 'blog post', 'comment section'],
      [LinkCategory.SOCIAL_MEDIA]: ['follow us', 'share this', 'like', 'friend request'],
      [LinkCategory.VIDEO]: ['watch video', 'subscribe', 'views', 'duration', 'views'],
      [LinkCategory.TOOL]: ['free tool', 'generator', 'calculator', 'create your own'],
      [LinkCategory.ECOMMERCE]: ['add to cart', 'buy now', 'price', 'checkout', 'shipping'],
      [LinkCategory.NEWS]: ['breaking news', 'reported that', 'according to', 'press release'],
      [LinkCategory.FORUM]: ['replied to', 'topic', 'moderator', 'registered users'],
      [LinkCategory.WIKI]: ['from wikipedia', 'encyclopedia', 'citation needed'],
      [LinkCategory.QNA]: ['answered', 'question', 'best answer', 'votes'],
      [LinkCategory.RESOURCE_PAGE]: ['resources', 'helpful links', 'recommended', 'useful links'],
      [LinkCategory.SOCIAL_MEDIA]: [], // 重复填充
      [LinkCategory.UNKNOWN]: [],
    };
    
    // 计算分数
    for (const [category, keywords] of Object.entries(contentPatterns)) {
      if (category === LinkCategory.UNKNOWN) continue;
      for (const keyword of keywords) {
        if (text.includes(keyword)) {
          scores[category as LinkCategory]++;
        }
      }
    }
    
    // 找到最高分
    let maxCategory = LinkCategory.UNKNOWN;
    let maxScore = 0;
    for (const [category, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        maxCategory = category as LinkCategory;
      }
    }
    
    const confidence = maxScore > 0 ? Math.min(0.7, 0.3 + maxScore * 0.1) : 0.1;
    
    return {
      category: maxCategory,
      confidence,
      reasons: [`内容分析得分: ${maxScore}`],
    };
  }
}
```

### 1.4 批量处理架构

```typescript
// 后端 Action: 批量检测外链可用性和类型
export const batchCheckLinksAction = adminActionClient
  .schema(batchCheckLinksSchema)
  .action(async ({ parsedInput }) => {
    const { linkIds, checkAvailability, checkCategory } = parsedInput;
    
    const results = await processInBatches(linkIds, 10, async (link) => {
      const result: LinkCheckResult = {
        id: link.id,
      };
      
      // 1. 可用性检测
      if (checkAvailability) {
        const availability = await linkAvailabilityService.check(link.url);
        result.availabilityStatus = availability.status;
        result.availabilityCheckedAt = availability.checkedAt;
        result.availabilityError = availability.error;
      }
      
      // 2. 类型识别
      if (checkCategory) {
        // 获取页面内容进行分类
        const content = availability.status === 'alive' 
          ? await fetchPageContent(link.url)
          : undefined;
        
        const classification = await linkClassifier.classify(link.url, content);
        result.linkCategory = classification.category;
        result.categoryConfidence = classification.confidence;
      }
      
      return result;
    });
    
    // 批量更新数据库
    await db.update(backlinks).set(results).where(inArray(backlinks.id, linkIds));
    
    return { success: true, results };
  });
```

---

## 二、半自动评论提交

### 2.1 需求分析

**需求目标：**
- 自动填充评论内容到评论框
- 人工点击确认提交按钮
- 提交完成后自动处理下一个外链
- 考虑反爬虫机制、提交频率控制

**现有能力：**
项目已有完整的表单检测和自动填充能力（`form-detector.ts`、`auto-fill-service.ts`），需要扩展为工作流模式。

### 2.2 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                    半自动评论提交流程                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐              │
│  │ 1. 打开  │───▶│ 2. 检测  │───▶│ 3. 填充  │              │
│  │   URL   │    │   表单    │    │   表单   │              │
│  └──────────┘    └──────────┘    └──────────┘              │
│                                             │               │
│                     ┌────────────────────────┘               │
│                     ▼                                       │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐              │
│  │ 7. 记录  │◀───│ 6. 人工  │◀───│ 4. 提示  │              │
│  │   结果   │    │   确认   │    │   提交   │              │
│  └──────────┘    └──────────┘    └──────────┘              │
│        │                                    │               │
│        │         ┌─────────────────────────┘               │
│        ▼         ▼                                         │
│  ┌──────────┐    ┌──────────┐                              │
│  │ 8. 打开  │───▶│ 9. 下一  │                              │
│  │   下一个 │    │   个外链 │                              │
│  └──────────┘    └──────────┘                              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 2.3 核心模块设计

#### 2.3.1 任务队列管理

```typescript
// chrome-extension/src/background/submission-queue.ts

interface SubmissionTask {
  id: string;
  backlinkId: string;
  url: string;
  domain: string;
  comment: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  retryCount: number;
  error?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export class SubmissionQueue {
  private queue: SubmissionTask[] = [];
  private currentIndex = 0;
  private isProcessing = false;
  
  // 频率控制配置
  private readonly config = {
    minIntervalMs: 5000,     // 最小间隔 5 秒
    maxRetries: 2,          // 最大重试次数
    domainCooldown: 60000,  // 同一域名冷却 60 秒
  };
  
  private lastSubmitTime = 0;
  private domainLastSubmit: Map<string, number> = new Map();
  
  // 添加任务到队列
  addTask(task: SubmissionTask): void {
    this.queue.push(task);
    this.processQueue();
  }
  
  // 处理队列
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.currentIndex >= this.queue.length) {
      return;
    }
    
    this.isProcessing = true;
    
    while (this.currentIndex < this.queue.length) {
      const task = this.queue[this.currentIndex];
      
      // 频率控制检查
      if (!this.canSubmit(task.domain)) {
        await this.waitForCooldown(task.domain);
      }
      
      // 执行任务
      await this.executeTask(task);
      
      // 等待间隔
      await this.waitForInterval();
    }
    
    this.isProcessing = false;
  }
  
  private canSubmit(domain: string): boolean {
    const now = Date.now();
    const lastSubmit = this.lastSubmitTime;
    const domainLastSubmit = this.domainLastSubmit.get(domain) || 0;
    
    return (now - lastSubmit) >= this.config.minIntervalMs &&
           (now - domainLastSubmit) >= this.config.domainCooldown;
  }
  
  private async waitForCooldown(domain: string): Promise<void> {
    const now = Date.now();
    const domainLastSubmit = this.domainLastSubmit.get(domain) || 0;
    const cooldownRemaining = this.config.domainCooldown - (now - domainLastSubmit);
    
    if (cooldownRemaining > 0) {
      await this.sleep(cooldownRemaining);
    }
  }
  
  private async executeTask(task: SubmissionTask): Promise<void> {
    task.status = 'in_progress';
    task.startedAt = new Date().toISOString();
    
    try {
      // 打开标签页
      const tab = await this.openUrl(task.url);
      
      // 发送消息给 content script 执行填充
      const result = await this.sendFillRequest(tab.id!, task.comment);
      
      if (result.success) {
        task.status = 'completed';
        // 记录提交等待用户确认
        await this.waitForUserConfirmation(tab.id!);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      task.status = 'failed';
      task.error = error instanceof Error ? error.message : 'Unknown error';
      task.retryCount++;
      
      if (task.retryCount < this.config.maxRetries) {
        // 重试
        this.queue.push(task);
      }
    } finally {
      task.completedAt = new Date().toISOString();
      this.lastSubmitTime = Date.now();
      this.domainLastSubmit.set(task.domain, Date.now());
      this.currentIndex++;
    }
  }
}
```

#### 2.3.2 用户交互界面

**Popup 界面设计：**

```tsx
// pages/popup/src/components/SubmissionPanel.tsx

export function SubmissionPanel() {
  const [queue, setQueue] = useState<SubmissionTask[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [currentTask, setCurrentTask] = useState<SubmissionTask | null>(null);
  
  // 启动批量提交
  const startBatchSubmission = async (backlinkIds: string[]) => {
    // 获取评论内容
    const comments = await generateComments(backlinkIds);
    
    // 创建任务队列
    const tasks = await Promise.all(
      backlinkIds.map(async (id, index) => ({
        id: generateId(),
        backlinkId: id,
        url: await getBacklinkUrl(id),
        domain: await getBacklinkDomain(id),
        comment: comments[index],
        status: 'pending' as const,
        retryCount: 0,
        createdAt: new Date().toISOString(),
      }))
    );
    
    // 发送到 background script
    chrome.runtime.sendMessage({
      type: 'START_SUBMISSION_QUEUE',
      tasks,
    });
    
    setIsRunning(true);
  };
  
  // 暂停/恢复
  const togglePause = () => {
    chrome.runtime.sendMessage({
      type: isRunning ? 'PAUSE_SUBMISSION' : 'RESUME_SUBMISSION',
    });
    setIsRunning(!isRunning);
  };
  
  return (
    <div className="submission-panel">
      <div className="header">
        <h3>批量评论提交</h3>
        <div className="status">
          {isRunning ? '运行中' : '已暂停'}
        </div>
      </div>
      
      {/* 当前任务状态 */}
      {currentTask && (
        <div className="current-task">
          <div className="progress">
            已完成: {currentTaskIndex} / {totalTasks}
          </div>
          <div className="current-url">
            当前: {currentTask.url}
          </div>
          <div className="instruction">
            ⏳ 等待您点击提交按钮...
          </div>
        </div>
      )}
      
      {/* 控制按钮 */}
      <div className="controls">
        <button onClick={togglePause}>
          {isRunning ? '暂停' : '继续'}
        </button>
        <button onClick={stopSubmission} disabled={!isRunning}>
          停止
        </button>
      </div>
      
      {/* 队列预览 */}
      <div className="queue-preview">
        <h4>待提交列表</h4>
        {queue.slice(0, 5).map(task => (
          <div key={task.id} className={`task-item ${task.status}`}>
            {task.domain} - {task.status}
          </div>
        ))}
        {queue.length > 5 && (
          <div className="more">还有 {queue.length - 5} 个...</div>
        )}
      </div>
    </div>
  );
}
```

#### 2.3.3 Content Script 消息处理

```typescript
// pages/content/src/submission-handler.ts

export function setupSubmissionHandler() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
      case 'FILL_AND_WAIT':
        handleFillAndWait(message.data)
          .then(sendResponse)
          .catch(error => sendResponse({ success: false, error: error.message }));
        return true; // 异步响应
      
      case 'CONFIRM_SUBMISSION':
        handleConfirmSubmission(message.data)
          .then(sendResponse)
          .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
      
      case 'GET_SUBMISSION_STATUS':
        handleGetStatus()
          .then(sendResponse);
        return true;
    }
  });
}

async function handleFillAndWait(data: { comment: string }) {
  // 1. 检测表单
  const detectionResult = await formDetector.detect();
  
  if (!detectionResult.detected) {
    return { success: false, error: '未检测到评论表单' };
  }
  
  // 2. 填充评论内容（不包括提交按钮）
  const result = await autoFillService.fill(
    detectionResult.fields,
    { comment: data.comment },
    false // 不自动提交，等待用户确认
  );
  
  if (!result.success) {
    return { success: false, error: result.error };
  }
  
  // 3. 等待用户点击提交
  // 使用 MutationObserver 监听表单提交事件
  return new Promise((resolve) => {
    const form = detectionResult.fields[0]?.element.closest('form');
    
    const observer = new MutationObserver((mutations, obs) => {
      // 检查是否提交成功（页面变化或出现成功消息）
      if (checkSubmissionSuccess()) {
        obs.disconnect();
        resolve({ success: true, submitted: true });
      }
    });
    
    // 启动观察
    if (form) {
      form.addEventListener('submit', () => {
        // 延迟检查，确保页面有变化
        setTimeout(() => {
          observer.disconnect();
          resolve({ success: true, submitted: true });
        }, 2000);
      });
    }
    
    // 设置超时（用户长时间未提交）
    setTimeout(() => {
      observer.disconnect();
      resolve({ success: true, submitted: false, timeout: true });
    }, 120000); // 2 分钟超时
  });
}

function checkSubmissionSuccess(): boolean {
  // 检查常见的成功提示
  const successIndicators = [
    '.success-message',
    '.thank-you',
    '[class*="success"]',
    '[class*="thanks"]',
    '#comment-success',
  ];
  
  for (const selector of successIndicators) {
    const element = document.querySelector(selector);
    if (element && window.getComputedStyle(element).display !== 'none') {
      return true;
    }
  }
  
  // 检查评论是否出现在页面中
  const comments = document.querySelectorAll('.comment, .comments li, .comment-body');
  if (comments.length > 0) {
    return true;
  }
  
  return false;
}
```

### 2.4 反爬虫策略

| 策略 | 实现方式 | 配置 |
|------|----------|------|
| 请求频率限制 | 每次提交间隔至少 5 秒 | 可配置 |
| 域名冷却 | 同一域名 60 秒内不重复提交 | 可配置 |
| User-Agent 轮换 | 随机选择多个常见 UA | 可配置 |
| 随机延迟 | 提交间隔增加 0-3 秒随机延迟 | 可配置 |
| 智能重试 | 失败后指数退避重试 | 最多 3 次 |

```typescript
// 频率控制配置
interface RateLimitConfig {
  minIntervalMs: number;      // 最小间隔
  maxIntervalMs: number;       // 最大间隔（含随机延迟）
  domainCooldownMs: number;    // 域名冷却时间
  maxRetries: number;          // 最大重试次数
  retryDelayMs: number;        // 重试延迟基数
}

const defaultConfig: RateLimitConfig = {
  minIntervalMs: 5000,
  maxIntervalMs: 8000,
  domainCooldownMs: 60000,
  maxRetries: 3,
  retryDelayMs: 2000,
};

// 随机延迟
function getRandomDelay(config: RateLimitConfig): number {
  return Math.random() * (config.maxIntervalMs - config.minIntervalMs) 
         + config.minIntervalMs;
}
```

### 2.5 数据流设计

```
┌─────────────────────────────────────────────────────────────────┐
│                         数据流                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Backend                                                         │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐        │
│  │  生成评论   │───▶│  导出外链   │───▶│  同步到扩展  │        │
│  │  (AI/模板)  │    │  列表数据   │    │   Storage   │        │
│  └─────────────┘    └─────────────┘    └─────────────┘        │
│                                                 │               │
│                                                 ▼               │
│  Chrome Extension (Background)                                  │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐        │
│  │  任务队列   │───▶│  URL 打开   │───▶│  表单填充   │        │
│  │  管理       │    │  (Tab API)  │    │  (Content)  │        │
│  └─────────────┘    └─────────────┘    └─────────────┘        │
│                                                 │               │
│                                                 ▼               │
│  Chrome Extension (Content Script)                            │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐        │
│  │  表单检测   │───▶│  字段填充   │───▶│  等待用户   │        │
│  │  (Detector) │    │  (AutoFill) │    │  提交确认   │        │
│  └─────────────┘    └─────────────┘    └─────────────┘        │
│                                                 │               │
│                                                 ▼               │
│  Chrome Extension (Background)                                  │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐        │
│  │  结果记录   │───▶│  打开下一个 │───▶│  同步结果   │        │
│  │  (Storage)  │    │  (Tab API)  │    │  到后端     │        │
│  └─────────────┘    └─────────────┘    └─────────────┘        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 三、技术选型建议

### 3.1 外链可用性检测

| 技术选型 | 推荐 | 说明 |
|----------|------|------|
| 检测方式 | HTTP HEAD + GET 降级 | 快速且兼容性好 |
| 并发控制 | 10 个 URL 批次 | 避免触发反爬 |
| 错误处理 | 指数退避重试 | 最多 2 次 |
| 存储 | 后端数据库 | 一次性检测，存储结果 |

### 3.2 类型识别

| 技术选型 | 推荐 | 说明 |
|----------|------|------|
| 域名匹配 | 正则规则库 | P0，精确快速 |
| URL 模式 | 正则规则库 | P0，作为域名匹配的补充 |
| 内容分析 | 关键词打分 | P1，仅对未识别链接 |
| AI 分类 | 可选 P2 | 成本考虑，暂不实现 |

### 3.3 半自动评论提交

| 技术选型 | 推荐 | 说明 |
|----------|------|------|
| 浏览器自动化 | Chrome Extension API | 利用现有架构 |
| 表单检测 | 现有 form-detector | 扩展支持 |
| 填充逻辑 | 现有 auto-fill-service | 扩展支持 |
| 任务队列 | Background Script | 内存 + Storage 持久化 |
| 用户交互 | Popup + Side Panel | 实时状态展示 |
| 频率控制 | 内存 + 配置 | 可动态调整 |

---

## 四、实现计划

### 阶段 1：外链可用性检测（预计 2 天）

1. **数据库扩展** - 添加可用性字段
2. **检测服务** - 实现 `LinkAvailabilityService`
3. **批量 API** - 实现 `batchCheckLinksAction`
4. **前端集成** - 检测按钮和结果展示

### 阶段 2：外链类型识别（预计 2 天）

1. **分类服务** - 实现 `LinkClassifier`
2. **内容分析** - 复用 `fetch-url-content.ts`
3. **批量分类 API** - 合并到检测流程
4. **前端展示** - 类型标签显示

### 阶段 3：半自动评论提交（预计 3 天）

1. **任务队列** - 实现 `SubmissionQueue`
2. **Content Script** - 扩展 `submission-handler.ts`
3. **Popup 界面** - 提交控制面板
4. **频率控制** - 反爬策略实现
5. **结果同步** - 提交记录回传后端

### 阶段 4：测试和优化（预计 1 天）

1. **端到端测试** - 完整流程验证
2. **性能优化** - 大批量处理
3. **错误处理** - 异常情况处理

---

## 五、风险与注意事项

1. **反爬虫风险**：不同网站的反爬策略差异大，需要可配置的频率参数
2. **表单检测失败**：部分网站使用动态加载，需要增加等待逻辑
3. **提交结果检测**：评论是否成功发布难以准确判断，需要多重检测
4. **浏览器兼容性**：Chrome Extension API 版本兼容性问题
5. **用户隐私**：评论内容不应存储在第三方服务器

---

## 六、现有代码复用

| 现有模块 | 复用方式 |
|----------|----------|
| `form-detector.ts` | 直接复用表单检测逻辑 |
| `auto-fill-service.ts` | 直接复用字段填充逻辑 |
| `fetch-url-content.ts` | 复用内容提取逻辑用于类型识别 |
| `SiteTemplate` 模型 | 复用模板存储结构 |
| `chrome.storage` | 复用数据持久化机制 |

---

*文档版本: v1.0*  
*创建时间: 2024*
