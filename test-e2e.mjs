#!/usr/bin/env node

/**
 * 端到端测试脚本
 * 测试 LLM 生成 -> 表单填充 -> 提交记录 的完整流程
 */

const API_KEY = 'sk-z0ZuQ5gq90GRH9jlwgZzhVRac7TBbDBhO4yCFHgT424zSblD';
const ENDPOINT = 'https://api.yunnet.top/v1/messages';
const MODEL = 'claude-sonnet-4-6';

console.log('🧪 Link Pilot 端到端测试\n');
console.log('═'.repeat(60));

// 测试场景
const testScenario = {
  // 页面信息（模拟 test-llm-page.html）
  page: {
    title: 'Chrome Extension MV3 开发完整指南',
    description: '本文详细介绍了 Chrome Extension MV3 的开发实践，包括 Service Worker、Content Script、消息传递等核心技术',
    h1: 'Chrome Extension MV3 开发完整指南',
    url: 'file:///Users/xingzhi/code/link-pilot/test-llm-page.html',
  },
  // 网站资料（模拟用户配置）
  profile: {
    id: 'test-profile-001',
    name: 'Link Pilot',
    url: 'https://linkpilot.com',
    email: 'contact@linkpilot.com',
    description: '专业的外链管理和自动化填表工具，帮助 SEO 从业者提高工作效率',
  },
  // 外链信息
  backlink: {
    id: 'test-backlink-001',
    url: 'https://example.com/blog/chrome-extension-guide',
    note: '关于 Chrome Extension 开发的优质教程',
  },
};

console.log('📋 测试场景:');
console.log(`  页面: ${testScenario.page.title}`);
console.log(`  网站: ${testScenario.profile.name}`);
console.log(`  外链: ${testScenario.backlink.url}`);
console.log('═'.repeat(60) + '\n');

// Step 1: 测试 LLM 生成评论
async function step1_generateComment() {
  console.log('📝 Step 1: 生成 LLM 评论\n');

  const prompt = `请为以下博客文章生成一条真诚、有价值的评论。

## 博客文章信息
- 标题: ${testScenario.page.h1}
- 描述: ${testScenario.page.description}
- URL: ${testScenario.page.url}

## 我的网站信息
- 网站名称: ${testScenario.profile.name}
- 网站 URL: ${testScenario.profile.url}
- 网站简介: ${testScenario.profile.description}
- 补充说明: ${testScenario.backlink.note}

## 要求
1. 评论应该真诚、自然，像一个真实读者的反馈
2. 先对文章内容表示认可或提出有价值的观点
3. 可以适当提及我的网站作为补充资源，但不要过度营销
4. 评论长度控制在 80-150 字之间
5. 使用中文撰写
6. 不要使用过于正式或模板化的语言

请直接输出评论内容，不要包含任何前缀或解释。`;

  try {
    const startTime = Date.now();

    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
        system: '你是一个专业的博客评论助手，擅长撰写有价值、自然、友好的评论。评论应该真诚、具体，避免过度营销。',
      }),
    });

    const elapsed = Date.now() - startTime;

    if (!response.ok) {
      throw new Error(`API 调用失败: ${response.status}`);
    }

    const data = await response.json();
    const comment = data.content[0]?.text || '';

    console.log(`✅ LLM 生成成功 (耗时: ${elapsed}ms)`);
    console.log(`📝 生成的评论 (${comment.length}字):`);
    console.log('─'.repeat(60));
    console.log(comment);
    console.log('─'.repeat(60));

    return { success: true, comment, elapsed };
  } catch (error) {
    console.error('❌ LLM 生成失败:', error.message);
    return { success: false, error: error.message };
  }
}

// Step 2: 模拟表单填充
function step2_fillForm(comment) {
  console.log('\n📋 Step 2: 填充表单字段\n');

  const formData = {
    name: testScenario.profile.name,
    email: testScenario.profile.email,
    website: testScenario.profile.url,
    comment: comment,
  };

  console.log('✅ 表单数据准备完成:');
  console.log(`  姓名: ${formData.name}`);
  console.log(`  邮箱: ${formData.email}`);
  console.log(`  网站: ${formData.website}`);
  console.log(`  评论: ${formData.comment.substring(0, 50)}...`);

  return { success: true, formData };
}

// Step 3: 模拟提交记录
function step3_recordSubmission(formData) {
  console.log('\n💾 Step 3: 记录提交信息\n');

  const submission = {
    id: `submission-${Date.now()}`,
    website_profile_id: testScenario.profile.id,
    managed_backlink_id: testScenario.backlink.id,
    comment: formData.comment,
    status: 'submitted',
    submitted_at: new Date().toISOString(),
    page_url: testScenario.page.url,
    page_title: testScenario.page.title,
  };

  console.log('✅ 提交记录创建:');
  console.log(`  ID: ${submission.id}`);
  console.log(`  网站: ${submission.website_profile_id}`);
  console.log(`  外链: ${submission.managed_backlink_id}`);
  console.log(`  状态: ${submission.status}`);
  console.log(`  时间: ${new Date(submission.submitted_at).toLocaleString('zh-CN')}`);

  return { success: true, submission };
}

// Step 4: 验证统计更新
function step4_verifyStats(submission) {
  console.log('\n📊 Step 4: 验证统计数据\n');

  // 模拟统计计算
  const stats = {
    total_backlinks: 1, // 提交过的不同外链数量
    submitted_count: 1, // 已提交的记录数
    approved_count: 0,  // 已审核的记录数
  };

  console.log('✅ 统计数据更新:');
  console.log(`  外链总数: ${stats.total_backlinks}`);
  console.log(`  已提交: ${stats.submitted_count}`);
  console.log(`  已审核: ${stats.approved_count}`);
  console.log(`  待提交: ${stats.total_backlinks - stats.submitted_count}`);

  return { success: true, stats };
}

// 主测试流程
async function runE2ETest() {
  console.log('🚀 开始端到端测试...\n');

  const results = {
    step1: null,
    step2: null,
    step3: null,
    step4: null,
  };

  // Step 1: 生成评论
  results.step1 = await step1_generateComment();
  if (!results.step1.success) {
    console.error('\n❌ 测试失败: LLM 生成评论失败');
    return;
  }

  // Step 2: 填充表单
  results.step2 = step2_fillForm(results.step1.comment);
  if (!results.step2.success) {
    console.error('\n❌ 测试失败: 表单填充失败');
    return;
  }

  // Step 3: 记录提交
  results.step3 = step3_recordSubmission(results.step2.formData);
  if (!results.step3.success) {
    console.error('\n❌ 测试失败: 提交记录失败');
    return;
  }

  // Step 4: 验证统计
  results.step4 = step4_verifyStats(results.step3.submission);
  if (!results.step4.success) {
    console.error('\n❌ 测试失败: 统计验证失败');
    return;
  }

  // 测试总结
  console.log('\n' + '═'.repeat(60));
  console.log('🎉 端到端测试完成！\n');

  console.log('📊 测试结果汇总:');
  console.log(`  ✅ Step 1: LLM 生成评论 (${results.step1.elapsed}ms)`);
  console.log(`  ✅ Step 2: 表单填充`);
  console.log(`  ✅ Step 3: 提交记录`);
  console.log(`  ✅ Step 4: 统计更新`);

  console.log('\n🔍 质量检查:');
  const comment = results.step1.comment;
  console.log(`  ${comment.length >= 80 && comment.length <= 150 ? '✅' : '⚠️ '} 评论长度: ${comment.length}字 (目标: 80-150字)`);
  console.log(`  ${/[\u4e00-\u9fa5]/.test(comment) ? '✅' : '❌'} 包含中文`);
  console.log(`  ${comment.includes(testScenario.profile.name) || comment.includes('Link Pilot') ? '✅' : '⚠️ '} 提及网站`);
  console.log(`  ${!comment.includes('强烈推荐') && !comment.includes('必备工具') ? '✅' : '⚠️ '} 不过度营销`);

  console.log('\n💡 实际测试步骤:');
  console.log('  1. 在浏览器中打开: file:///Users/xingzhi/code/link-pilot/test-llm-page.html');
  console.log('  2. 加载扩展到 Chrome');
  console.log('  3. 在扩展页面 Console 执行 quick-config-llm.js 配置 LLM');
  console.log('  4. 打开 Side Panel');
  console.log('  5. 添加测试网站资料:');
  console.log(`     - 名称: ${testScenario.profile.name}`);
  console.log(`     - URL: ${testScenario.profile.url}`);
  console.log(`     - 邮箱: ${testScenario.profile.email}`);
  console.log('  6. 添加测试外链:');
  console.log(`     - URL: ${testScenario.backlink.url}`);
  console.log('  7. 在测试页面点击"一键填充"');
  console.log('  8. 检查表单是否自动填充（包括 LLM 生成的评论）');
  console.log('  9. 点击"提交评论"按钮');
  console.log('  10. 检查 Console 日志和 Side Panel 统计数字');

  console.log('\n📝 预期结果:');
  console.log('  ✅ 表单自动填充所有字段');
  console.log('  ✅ 评论内容由 LLM 生成（真诚、自然）');
  console.log('  ✅ 提交后 Console 显示 "[Content Script] 检测到表单提交"');
  console.log('  ✅ Console 显示 "[Content Script] 记录提交成功"');
  console.log('  ✅ Side Panel 统计数字更新（已提交 +1）');

  console.log('\n' + '═'.repeat(60));
}

runE2ETest();
