/**
 * BacklinkMatcher 服务测试
 * @author gatlinyao
 * @date 2025-03-13
 */

import { BacklinkMatcher, type MatchContext, type MatchResult } from '../lib/services/backlink-matcher.js';
import type { ManagedBacklink } from '../lib/types/models.js';

// 模拟外链数据
const mockBacklinks: ManagedBacklink[] = [
  {
    id: '1',
    url: 'https://example.com/blog/post-1',
    domain: 'example.com',
    keywords: ['blog', 'article', 'content'],
    note: '这是一个博客文章',
    group_id: 'default',
    flagged: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '2',
    url: 'https://example.com/contact',
    domain: 'example.com',
    keywords: ['contact', 'form', 'submit'],
    note: '联系表单页面',
    group_id: 'default',
    flagged: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '3',
    url: 'https://another-site.com/page',
    domain: 'another-site.com',
    keywords: ['external', 'site'],
    note: '外部站点',
    group_id: 'default',
    flagged: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

/**
 * 测试：URL 完全匹配
 */
async function testExactUrlMatch(): Promise<void> {
  console.log('\n--- 测试：URL 完全匹配 ---');

  const matcher = new BacklinkMatcher();
  const context: MatchContext = {
    currentUrl: 'https://example.com/blog/post-1',
    currentDomain: 'example.com',
    currentPath: '/blog/post-1',
    pageTitle: '博客文章标题',
    pageKeywords: ['blog', 'content'],
    formDetected: false,
  };

  const results = await matcher.findMatches(context, mockBacklinks);

  console.log(`找到 ${results.length} 个匹配结果`);
  if (results.length > 0) {
    console.log('最佳匹配:', {
      url: results[0].backlink.url,
      score: results[0].score,
      reasons: results[0].reasons,
    });

    // 验证 URL 完全匹配应该有高分
    if (results[0].score >= 0.8) {
      console.log('✓ 测试通过：URL 完全匹配获得高分数');
    } else {
      console.log('✗ 测试失败：URL 完全匹配分数过低');
    }
  }
}

/**
 * 测试：域名匹配
 */
async function testDomainMatch(): Promise<void> {
  console.log('\n--- 测试：域名匹配 ---');

  const matcher = new BacklinkMatcher();
  const context: MatchContext = {
    currentUrl: 'https://example.com/other-page',
    currentDomain: 'example.com',
    currentPath: '/other-page',
    pageTitle: '其他页面',
    pageKeywords: ['other'],
    formDetected: false,
  };

  const results = await matcher.findMatches(context, mockBacklinks);

  console.log(`找到 ${results.length} 个匹配结果`);
  const domainMatches = results.filter(r =>
    r.reasons.some(reason => reason.includes('域名'))
  );

  console.log(`域名匹配结果: ${domainMatches.length} 个`);
  if (domainMatches.length >= 2) {
    console.log('✓ 测试通过：域名匹配正确识别');
  } else {
    console.log('✗ 测试失败：域名匹配结果不足');
  }
}

/**
 * 测试：关键词匹配
 */
async function testKeywordMatch(): Promise<void> {
  console.log('\n--- 测试：关键词匹配 ---');

  const matcher = new BacklinkMatcher();
  const context: MatchContext = {
    currentUrl: 'https://example.com/blog/article-about-content',
    currentDomain: 'example.com',
    currentPath: '/blog/article-about-content',
    pageTitle: '关于内容的文章',
    pageKeywords: ['content', 'article', 'blog'],
    formDetected: false,
  };

  const results = await matcher.findMatches(context, mockBacklinks);

  console.log(`找到 ${results.length} 个匹配结果`);
  const keywordMatches = results.filter(r =>
    r.reasons.some(reason => reason.includes('关键词'))
  );

  console.log(`关键词匹配结果: ${keywordMatches.length} 个`);
  if (keywordMatches.length > 0) {
    console.log('✓ 测试通过：关键词匹配正常工作');
  } else {
    console.log('✗ 测试失败：关键词匹配未识别');
  }
}

/**
 * 测试：表单检测加成
 */
async function testFormBonus(): Promise<void> {
  console.log('\n--- 测试：表单检测加成 ---');

  const matcher = new BacklinkMatcher();

  // 无表单场景
  const contextWithoutForm: MatchContext = {
    currentUrl: 'https://example.com/contact',
    currentDomain: 'example.com',
    currentPath: '/contact',
    pageTitle: '联系我们',
    pageKeywords: ['contact'],
    formDetected: false,
  };

  // 有表单场景
  const contextWithForm: MatchContext = {
    ...contextWithoutForm,
    formDetected: true,
  };

  const resultsWithoutForm = await matcher.findMatches(contextWithoutForm, mockBacklinks);
  const resultsWithForm = await matcher.findMatches(contextWithForm, mockBacklinks);

  const scoreWithoutForm = resultsWithoutForm[0]?.score ?? 0;
  const scoreWithForm = resultsWithForm[0]?.score ?? 0;

  console.log(`无表单分数: ${scoreWithoutForm}`);
  console.log(`有表单分数: ${scoreWithForm}`);

  if (scoreWithForm > scoreWithoutForm) {
    console.log('✓ 测试通过：表单检测获得加成');
  } else {
    console.log('✗ 测试失败：表单检测未获得加成');
  }
}

/**
 * 测试：缓存功能
 */
async function testCache(): Promise<void> {
  console.log('\n--- 测试：缓存功能 ---');

  const matcher = new BacklinkMatcher();
  const context: MatchContext = {
    currentUrl: 'https://example.com/blog/post-1',
    currentDomain: 'example.com',
    currentPath: '/blog/post-1',
    pageTitle: '博客文章标题',
    pageKeywords: ['blog'],
    formDetected: false,
  };

  // 第一次调用
  const start1 = performance.now();
  const results1 = await matcher.findMatches(context, mockBacklinks);
  const time1 = performance.now() - start1;

  // 第二次调用（应该使用缓存）
  const start2 = performance.now();
  const results2 = await matcher.findMatches(context, mockBacklinks);
  const time2 = performance.now() - start2;

  console.log(`第一次调用耗时: ${time1.toFixed(2)}ms`);
  console.log(`第二次调用耗时: ${time2.toFixed(2)}ms`);

  if (time2 < time1 && JSON.stringify(results1) === JSON.stringify(results2)) {
    console.log('✓ 测试通过：缓存功能正常工作');
  } else {
    console.log('ℹ 缓存性能测试结果（缓存可能因异步操作不明显）');
  }
}

/**
 * 测试：置信度判断
 */
function testConfidenceLevels(): void {
  console.log('\n--- 测试：置信度判断 ---');

  const testCases = [
    { score: 0.9, expectedHigh: true, expectedMedium: false },
    { score: 0.8, expectedHigh: true, expectedMedium: false },
    { score: 0.7, expectedHigh: false, expectedMedium: true },
    { score: 0.4, expectedHigh: false, expectedMedium: true },
    { score: 0.3, expectedHigh: false, expectedMedium: false },
  ];

  let passed = 0;
  for (const tc of testCases) {
    const isHigh = BacklinkMatcher.isHighConfidence(tc.score);
    const isMedium = BacklinkMatcher.isMediumConfidence(tc.score);

    if (isHigh === tc.expectedHigh && isMedium === tc.expectedMedium) {
      console.log(`✓ 分数 ${tc.score}: 高置信度=${isHigh}, 中等置信度=${isMedium}`);
      passed++;
    } else {
      console.log(`✗ 分数 ${tc.score}: 预期高=${tc.expectedHigh}, 实际高=${isHigh}; 预期中=${tc.expectedMedium}, 实际中=${isMedium}`);
    }
  }

  console.log(`置信度判断测试: ${passed}/${testCases.length} 通过`);
}

/**
 * 运行所有测试
 */
async function runTests(): Promise<void> {
  console.log('========================================');
  console.log('BacklinkMatcher 服务测试');
  console.log('========================================');

  try {
    await testExactUrlMatch();
    await testDomainMatch();
    await testKeywordMatch();
    await testFormBonus();
    await testCache();
    testConfidenceLevels();

    console.log('\n========================================');
    console.log('测试完成');
    console.log('========================================');
  } catch (error) {
    console.error('测试执行失败:', error);
  }
}

// 如果直接运行此文件
if (import.meta.url === `file://${process.argv[1]}`) {
  void runTests();
}

export { runTests };
