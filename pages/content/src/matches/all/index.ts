import { sampleFunction } from '@src/sample-function';
import { initMessageListener } from '@src/handlers/message-handler';
import { collectorRegistry } from '@src/collectors/collector-registry';

console.log('[Link Pilot] Content script loaded');

// 初始化消息监听器
initMessageListener();

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

      // 自动保存到 storage
      chrome.runtime.sendMessage({
        type: 'AUTO_COLLECTION_COMPLETE',
        payload: { backlinks },
      }).then(response => {
        if (response?.success) {
          console.log(`[Link Pilot] 数据已保存 - 新增: ${response.saved || response.count} 条, 跳过: ${response.skipped || 0} 条`);
        }
      }).catch(error => {
        console.error('[Link Pilot] 发送数据失败:', error);
      });
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

void sampleFunction();
