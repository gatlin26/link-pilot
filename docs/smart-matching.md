# 外链智能匹配服务

## 概述

外链智能匹配服务根据当前页面 URL 智能匹配外链库中的外链机会，用于在 Side Panel 和悬浮球中快速推荐。

## 文件结构

```
packages/shared/lib/services/backlink-matcher.ts    # 匹配服务核心
pages/content/src/page-observer.ts                  # 页面监听服务
pages/content/src/matches/all/index.ts              # Content Script 集成
pages/content/src/utils/message-utils.ts            # 消息工具函数
packages/shared/lib/types/messages.ts               # 消息类型定义
```

## 核心功能

### 1. BacklinkMatcher 服务

```typescript
import { BacklinkMatcher, type MatchResult, type MatchContext } from '@extension/shared/lib/services/backlink-matcher.js';

// 创建匹配器实例
const matcher = new BacklinkMatcher();

// 准备匹配上下文
const context: MatchContext = {
  currentUrl: 'https://example.com/blog/post-1',
  currentDomain: 'example.com',
  currentPath: '/blog/post-1',
  pageTitle: '博客文章标题',
  pageKeywords: ['blog', 'content'],
  formDetected: true,
};

// 执行匹配
const results: MatchResult[] = await matcher.findMatches(context);

// 处理结果
results.forEach(result => {
  console.log(`匹配分数: ${result.score}`);
  console.log(`匹配原因: ${result.reasons.join(', ')}`);
  console.log(`外链信息:`, result.backlink);
});
```

### 2. 匹配算法权重

| 匹配类型 | 权重 | 说明 |
|---------|------|------|
| exactUrl | 1.0 | URL 完全匹配 |
| domainMatch | 0.7 | 域名匹配 |
| pathMatch | 0.5 | 路径模式匹配 |
| keywordMatch | 0.3 | 关键词匹配 |
| formBonus | 0.1 | 检测到表单的加成 |

### 3. 置信度阈值

- **高置信度**: >= 0.8
- **中等置信度**: >= 0.4
- **低置信度**: < 0.4

```typescript
import { BacklinkMatcher } from '@extension/shared/lib/services/backlink-matcher.js';

const isHigh = BacklinkMatcher.isHighConfidence(score);
const isMedium = BacklinkMatcher.isMediumConfidence(score);
```

### 4. PageObserver 页面监听

```typescript
import { PageObserver, getCurrentMatchContext } from '@src/page-observer';

const observer = new PageObserver();

// 注册 URL 变化回调
observer.onUrlChange((url) => {
  console.log('URL 变化:', url);
  // 执行智能匹配...
});

// 启动监听（支持 SPA 路由）
observer.start();

// 获取当前匹配上下文
const context = getCurrentMatchContext();
```

### 5. 消息通信

```typescript
import { MessageType } from '@extension/shared/lib/types/messages.js';

// 从 Side Panel 或 Popup 请求智能匹配
const response = await chrome.runtime.sendMessage({
  type: MessageType.SMART_MATCH_BACKLINK,
  payload: {
    currentUrl: 'https://example.com/page',
    currentTitle: '页面标题',
  },
});

// 监听匹配结果更新
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === MessageType.MATCH_RESULT_UPDATED) {
    const { bestMatch, confidence, alternatives, sourceUrl } = message.payload;
    // 处理匹配结果...
  }
});
```

## 性能优化

1. **缓存机制**: 匹配结果缓存 5 分钟，避免重复计算
2. **防抖处理**: URL 变化监听使用 300ms 防抖
3. **异步获取**: 外链数据从 storage 异步获取

## 支持的 SPA 框架

- React Router
- Vue Router
- Angular Router
- 其他使用 history API 的路由器

## 扩展性

可以通过修改 `calculateMatchScore` 方法添加自定义匹配逻辑：

```typescript
class CustomBacklinkMatcher extends BacklinkMatcher {
  protected calculateMatchScore(backlink: ManagedBacklink, context: MatchContext): number {
    let score = super.calculateMatchScore(backlink, context);

    // 添加自定义匹配逻辑
    if (this.customMatchLogic(backlink, context)) {
      score += 0.5;
    }

    return score;
  }
}
```
