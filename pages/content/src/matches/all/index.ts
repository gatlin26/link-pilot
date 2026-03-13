import { sampleFunction } from '@src/sample-function';
import { PageObserver, getCurrentMatchContext } from '@src/page-observer';
import { initMessageListener } from '@src/handlers/message-handler';
import { collectorRegistry } from '@src/collectors/collector-registry';
import { backlinkMatcher } from '@extension/shared/lib/services/backlink-matcher.js';
import type { MatchResult } from '@extension/shared/lib/services/backlink-matcher.js';
import { MessageType } from '@extension/shared/lib/types/messages.js';

console.log('[Link Pilot] Content script loaded');

// 初始化页面观察器和匹配状态
const pageObserver = new PageObserver();
let lastMatchResults: MatchResult[] = [];

/**
 * 执行智能匹配
 * 获取当前页面上下文，调用匹配服务，广播结果
 */
async function performSmartMatch(): Promise<void> {
  try {
    // 获取当前页面上下文
    const context = getCurrentMatchContext();
    console.log('[Link Pilot] 执行智能匹配，上下文:', {
      url: context.currentUrl,
      domain: context.currentDomain,
      formDetected: context.formDetected,
    });

    // 执行匹配
    const matches = await backlinkMatcher.findMatches(context);
    lastMatchResults = matches;

    console.log(`[Link Pilot] 智能匹配完成，找到 ${matches.length} 个匹配结果`);

    // 广播匹配结果
    await broadcastMatchResult(matches, context.currentUrl);

    // 如果有高置信度匹配，发送特殊消息
    const highConfidenceMatches = matches.filter(m => m.score >= 0.8);
    if (highConfidenceMatches.length > 0) {
      console.log(`[Link Pilot] 发现 ${highConfidenceMatches.length} 个高置信度匹配`);
      await notifyHighConfidenceMatch(highConfidenceMatches[0]);
    }
  } catch (error) {
    console.error('[Link Pilot] 智能匹配失败:', error);
  }
}

/**
 * 广播匹配结果到所有相关组件
 * @param matches 匹配结果列表
 * @param sourceUrl 源 URL
 */
async function broadcastMatchResult(matches: MatchResult[], sourceUrl: string): Promise<void> {
  const bestMatch = matches.length > 0 ? matches[0] : null;

  const message = {
    type: MessageType.MATCH_RESULT_UPDATED,
    payload: {
      bestMatch: bestMatch?.backlink ?? null,
      confidence: bestMatch?.score ?? 0,
      alternatives: matches.slice(1).map(m => m.backlink),
      allMatches: matches,
      sourceUrl,
      timestamp: Date.now(),
    },
  };

  try {
    // 发送到 background script 进行广播
    await chrome.runtime.sendMessage(message);
  } catch (error) {
    console.error('[Link Pilot] 广播匹配结果失败:', error);
  }
}

/**
 * 通知高置信度匹配
 * @param match 最佳匹配结果
 */
async function notifyHighConfidenceMatch(match: MatchResult): Promise<void> {
  try {
    await chrome.runtime.sendMessage({
      type: MessageType.MATCH_RESULT_UPDATED,
      payload: {
        event: 'HIGH_CONFIDENCE_MATCH',
        match,
        timestamp: Date.now(),
      },
    });
  } catch (error) {
    console.error('[Link Pilot] 通知高置信度匹配失败:', error);
  }
}

/**
 * 处理 SMART_MATCH_BACKLINK 消息
 * 手动触发智能匹配
 */
async function handleSmartMatchMessage(message: { payload?: { currentUrl?: string; currentTitle?: string } }): Promise<{
  success: boolean;
  data?: { matches: MatchResult[]; count: number };
  error?: string;
}> {
  try {
    // 使用消息中的 URL 或当前页面 URL
    const targetUrl = message.payload?.currentUrl || location.href;

    // 如果指定了不同的 URL，先更新页面状态
    if (targetUrl !== location.href) {
      console.log('[Link Pilot] 使用指定 URL 进行匹配:', targetUrl);
    }

    await performSmartMatch();

    return {
      success: true,
      data: {
        matches: lastMatchResults,
        count: lastMatchResults.length,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * 初始化智能匹配功能
 */
function initSmartMatching(): void {
  // 注册 URL 变化回调
  pageObserver.onUrlChange((newUrl) => {
    console.log('[Link Pilot] URL 变化，重新执行智能匹配:', newUrl);
    void performSmartMatch();

    // 发送 URL 变化消息
    void chrome.runtime.sendMessage({
      type: MessageType.URL_CHANGED,
      payload: {
        oldUrl: pageObserver.getLastUrl(),
        newUrl,
        title: document.title,
      },
    });
  });

  // 启动页面监听
  pageObserver.start();

  // 页面加载完成后立即执行一次匹配
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      void performSmartMatch();
    });
  } else {
    // DOM 已加载完成，立即执行
    void performSmartMatch();
  }

  console.log('[Link Pilot] 智能匹配功能已初始化');
}

/**
 * 初始化消息处理器
 * 监听来自 popup、sidepanel 和 background 的消息
 */
function initSmartMatchMessageHandler(): void {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // 使用 async IIFE 处理异步操作
    void (async () => {
      try {
        switch (message.type) {
          case MessageType.SMART_MATCH_BACKLINK: {
            const result = await handleSmartMatchMessage(message);
            sendResponse(result);
            break;
          }

          case MessageType.GET_FILL_PAGE_STATE: {
            // 返回当前匹配状态
            const context = getCurrentMatchContext();
            sendResponse({
              success: true,
              data: {
                currentUrl: context.currentUrl,
                formDetected: context.formDetected,
                matchCount: lastMatchResults.length,
                bestMatch: lastMatchResults[0]?.backlink ?? null,
              },
            });
            break;
          }

          default:
            // 不处理的消息类型，不要调用 sendResponse
            return;
        }
      } catch (error) {
        console.error('[Link Pilot] 消息处理失败:', error);
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : '未知错误',
        });
      }
    })();

    // 返回 true 表示将异步发送响应
    return true;
  });

  console.log('[Link Pilot] 智能匹配消息处理器已注册');
}

// === 原有的采集功能代码 ===

// 立即检测并启动常驻拦截（不等待任何条件）
const collector = collectorRegistry.detectCollector();
if (collector) {
  console.log(`[Link Pilot] 检测到支持的平台: ${collector.platform}`);
  console.log('[Link Pilot] 立即启动常驻拦截模式');

  // 主世界桥接脚本已通过 manifest 自动注入
  // 直接启动拦截器
  startPersistentCollection();
}

/**
 * 启动常驻拦截
 * 持续监听 API 请求，自动保存数据
 */
function startPersistentCollection() {
  console.log('[Link Pilot] 拦截器启动，开始监听 API 请求...');

  // 使用较大的数量，让拦截器持续运行
  collectorRegistry.startCollection(1000).then(backlinks => {
    if (backlinks.length === 0) {
      console.log('[Link Pilot] 本轮未拦截到数据，继续监听...');
    } else {
      console.log(`[Link Pilot] 拦截到外链数据，共 ${backlinks.length} 条`);

      // 自动保存到 storage，添加错误处理
      try {
        chrome.runtime.sendMessage({
          type: 'AUTO_COLLECTION_COMPLETE',
          payload: { backlinks },
        }).then(response => {
          if (response?.success) {
            console.log(`[Link Pilot] 数据已保存 - 新增: ${response.saved || response.count} 条, 跳过: ${response.skipped || 0} 条`);
          }
        }).catch(error => {
          // 检查是否是扩展上下文失效错误
          if (error.message?.includes('Extension context invalidated')) {
            console.warn('[Link Pilot] 扩展已重新加载，停止当前拦截器');
            collectorRegistry.stopCollection();
            return;
          }
          console.error('[Link Pilot] 发送数据失败:', error);
        });
      } catch (error) {
        console.error('[Link Pilot] 发送消息异常:', error);
      }
    }

    // 继续下一轮拦截（常驻模式）
    setTimeout(() => {
      startPersistentCollection();
    }, 2000);
  }).catch(error => {
    console.error('[Link Pilot] 拦截器错误:', error);

    // 出错后重试
    console.log('[Link Pilot] 3秒后重试...');
    setTimeout(() => {
      startPersistentCollection();
    }, 3000);
  });
}

// === 初始化 ===

// 初始化原有功能
initMessageListener();

// 初始化智能匹配
initSmartMatching();

// 初始化智能匹配消息处理器
initSmartMatchMessageHandler();

void sampleFunction();
