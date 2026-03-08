/**
 * 同步功能集成测试示例
 *
 * 注意：这是一个示例文件，展示如何测试同步功能
 * 实际测试需要配置真实的 GAS Web App URL
 */

import { SyncService, SheetsApiClient } from '@extension/shared/lib/services';
import { syncQueueService } from '@extension/storage/lib/services/sync-queue-service';
import { backlinkStorage } from '@extension/storage/lib/impl/backlink-storage';
import { opportunityStorage } from '@extension/storage/lib/impl/opportunity-storage';
import { templateStorage } from '@extension/storage/lib/impl/template-storage';
import { submissionStorage } from '@extension/storage/lib/impl/submission-storage';
import type { DataFetcher } from '@extension/shared/lib/services';
import { SyncEntityType, SyncOperation } from '@extension/shared/lib/types/enums';

/**
 * 测试配置
 */
const TEST_CONFIG = {
  // 替换为你的 GAS Web App URL
  webAppUrl: 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec',
};

/**
 * 数据获取器实现
 */
const dataFetcher: DataFetcher = {
  getBacklinkById: (id) => backlinkStorage.getById(id),
  getOpportunityById: (id) => opportunityStorage.getById(id),
  getTemplateById: (id) => templateStorage.getById(id),
  getSubmissionById: (id) => submissionStorage.getById(id),
};

/**
 * 测试 1: 测试连接
 */
async function testConnection() {
  console.log('测试 1: 测试连接');

  const client = new SheetsApiClient({
    webAppUrl: TEST_CONFIG.webAppUrl,
  });

  const isConnected = await client.testConnection();

  if (isConnected) {
    console.log('✓ 连接成功');
  } else {
    console.log('✗ 连接失败');
  }

  return isConnected;
}

/**
 * 测试 2: 同步单个外链
 */
async function testSyncSingleBacklink() {
  console.log('\n测试 2: 同步单个外链');

  // 创建测试数据
  const testBacklink = {
    id: crypto.randomUUID(),
    source_platform: 'ahrefs' as const,
    collection_batch_id: 'test-batch-1',
    collected_at: new Date().toISOString(),
    target_domain: 'example.com',
    target_url: 'https://example.com/test',
    referring_page_url: 'https://referrer.com/page',
    referring_domain: 'referrer.com',
    anchor_text: 'test link',
    page_title: 'Test Page',
    raw_metrics: { dr: 50, traffic: 1000 },
    raw_snapshot: 'test snapshot',
    status: 'collected' as const,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // 保存到本地存储
  await backlinkStorage.add(testBacklink);

  // 添加到同步队列
  await syncQueueService.enqueue(
    SyncEntityType.BACKLINK,
    testBacklink.id,
    SyncOperation.CREATE
  );

  // 获取待同步任务
  const jobs = await syncQueueService.getPendingJobs(1);

  if (jobs.length === 0) {
    console.log('✗ 没有待同步任务');
    return false;
  }

  // 执行同步
  const syncService = new SyncService({
    webAppUrl: TEST_CONFIG.webAppUrl,
  });

  const result = await syncService.syncJobs(jobs, dataFetcher);

  // 更新任务状态
  for (const job of jobs) {
    const error = result.errors?.find(e => e.jobId === job.id);
    if (error) {
      await syncQueueService.markFailed(job.id, error.error);
    } else {
      await syncQueueService.markSuccess(job.id);
    }
  }

  console.log(`同步结果: 总计 ${result.total}, 成功 ${result.synced}, 失败 ${result.failed}`);

  if (result.success) {
    console.log('✓ 同步成功');
  } else {
    console.log('✗ 同步失败:', result.errors);
  }

  return result.success;
}

/**
 * 测试 3: 批量同步
 */
async function testBatchSync() {
  console.log('\n测试 3: 批量同步');

  // 创建 10 个测试外链
  const testBacklinks = Array.from({ length: 10 }, (_, i) => ({
    id: crypto.randomUUID(),
    source_platform: 'ahrefs' as const,
    collection_batch_id: 'test-batch-2',
    collected_at: new Date().toISOString(),
    target_domain: `example${i}.com`,
    target_url: `https://example${i}.com/test`,
    referring_page_url: `https://referrer.com/page${i}`,
    referring_domain: 'referrer.com',
    anchor_text: `test link ${i}`,
    page_title: `Test Page ${i}`,
    raw_metrics: { dr: 50 + i, traffic: 1000 + i * 100 },
    raw_snapshot: `test snapshot ${i}`,
    status: 'collected' as const,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));

  // 批量保存
  await backlinkStorage.addBatch(testBacklinks);

  // 批量入队
  const jobs = testBacklinks.map(backlink => ({
    entityType: SyncEntityType.BACKLINK,
    entityId: backlink.id,
    operation: SyncOperation.CREATE,
  }));

  await syncQueueService.enqueueBatch(jobs);

  // 获取待同步任务
  const pendingJobs = await syncQueueService.getPendingJobs(100);

  console.log(`待同步任务数: ${pendingJobs.length}`);

  // 执行同步
  const syncService = new SyncService({
    webAppUrl: TEST_CONFIG.webAppUrl,
  });

  const result = await syncService.syncJobs(pendingJobs, dataFetcher);

  // 更新任务状态
  for (const job of pendingJobs) {
    const error = result.errors?.find(e => e.jobId === job.id);
    if (error) {
      await syncQueueService.markFailed(job.id, error.error);
    } else {
      await syncQueueService.markSuccess(job.id);
    }
  }

  console.log(`同步结果: 总计 ${result.total}, 成功 ${result.synced}, 失败 ${result.failed}`);

  if (result.success) {
    console.log('✓ 批量同步成功');
  } else {
    console.log('✗ 批量同步失败:', result.errors);
  }

  return result.success;
}

/**
 * 测试 4: 查看同步统计
 */
async function testSyncStats() {
  console.log('\n测试 4: 查看同步统计');

  const stats = await syncQueueService.getStats();

  console.log('同步统计:');
  console.log(`  总任务数: ${stats.total}`);
  console.log(`  待处理: ${stats.pending}`);
  console.log(`  已成功: ${stats.success}`);
  console.log(`  已失败: ${stats.failed}`);

  return true;
}

/**
 * 测试 5: 重试失败任务
 */
async function testRetryFailed() {
  console.log('\n测试 5: 重试失败任务');

  const failedJobs = await syncQueueService.getFailedJobs();

  console.log(`失败任务数: ${failedJobs.length}`);

  if (failedJobs.length > 0) {
    await syncQueueService.retryFailed();
    console.log('✓ 已将失败任务重新加入队列');
  } else {
    console.log('没有失败任务');
  }

  return true;
}

/**
 * 测试 6: 清理已完成任务
 */
async function testCleanup() {
  console.log('\n测试 6: 清理已完成任务');

  const cleaned = await syncQueueService.cleanupCompleted(0); // 清理所有已完成任务

  console.log(`已清理 ${cleaned} 个已完成任务`);

  return true;
}

/**
 * 运行所有测试
 */
async function runAllTests() {
  console.log('=== 开始同步功能测试 ===\n');

  try {
    // 测试 1: 测试连接
    const connectionOk = await testConnection();
    if (!connectionOk) {
      console.log('\n连接失败，请检查 Web App URL 配置');
      return;
    }

    // 测试 2: 同步单个外链
    await testSyncSingleBacklink();

    // 测试 3: 批量同步
    await testBatchSync();

    // 测试 4: 查看同步统计
    await testSyncStats();

    // 测试 5: 重试失败任务
    await testRetryFailed();

    // 测试 6: 清理已完成任务
    await testCleanup();

    console.log('\n=== 测试完成 ===');
  } catch (error) {
    console.error('\n测试失败:', error);
  }
}

// 导出测试函数
export {
  testConnection,
  testSyncSingleBacklink,
  testBatchSync,
  testSyncStats,
  testRetryFailed,
  testCleanup,
  runAllTests,
};

// 如果直接运行此文件，执行所有测试
if (typeof window !== 'undefined') {
  // 在浏览器环境中，将测试函数挂载到 window 对象
  (window as any).syncTests = {
    testConnection,
    testSyncSingleBacklink,
    testBatchSync,
    testSyncStats,
    testRetryFailed,
    testCleanup,
    runAllTests,
  };

  console.log('同步测试函数已加载，可以通过 window.syncTests 访问');
  console.log('例如: window.syncTests.runAllTests()');
}
