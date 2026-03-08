import { sampleFunction } from '@src/sample-function';
import { initMessageListener } from '@src/handlers/message-handler';
import { collectorRegistry } from '@src/collectors/collector-registry';

console.log('[Link Pilot] Content script loaded');

// 初始化消息监听器
initMessageListener();

// 检测并初始化收集器
const collector = collectorRegistry.detectCollector();
if (collector) {
  console.log(`[Link Pilot] 检测到支持的平台: ${collector.platform}`);
  console.log('[Link Pilot] API 拦截器已就绪，等待采集指令');
}

void sampleFunction();
