/**
 * 快速配置 LLM 功能
 *
 * 使用方法：
 * 1. 打开 Chrome Extension 的任意页面（Options/Popup/Side Panel）
 * 2. 打开 DevTools Console
 * 3. 复制粘贴这段代码并执行
 */

(async function configureLLM() {
  console.log('🚀 开始配置 LLM 功能...\n');

  const config = {
    enable_llm_comment: true,
    llm_provider: 'anthropic',
    llm_api_key: 'sk-z0ZuQ5gq90GRH9jlwgZzhVRac7TBbDBhO4yCFHgT424zSblD',
    llm_model: 'claude-sonnet-4-6',
    llm_custom_endpoint: 'https://api.yunnet.top/v1/messages',
  };

  try {
    // 获取当前配置
    const result = await chrome.storage.local.get('extension-settings-storage-key');
    const currentSettings = result['extension-settings-storage-key'] || {};

    // 合并配置
    const newSettings = {
      ...currentSettings,
      ...config,
    };

    // 保存配置
    await chrome.storage.local.set({
      'extension-settings-storage-key': newSettings
    });

    console.log('✅ LLM 配置已保存！\n');
    console.log('📝 配置详情:');
    console.log('  启用 LLM: ✅');
    console.log('  提供商: Anthropic');
    console.log('  模型: claude-sonnet-4-6');
    console.log('  端点: https://api.yunnet.top');
    console.log('  API Key: ' + config.llm_api_key.substring(0, 15) + '...');

    console.log('\n🎯 下一步:');
    console.log('  1. 打开任意博客文章页面');
    console.log('  2. 打开 Side Panel');
    console.log('  3. 选择网站资料');
    console.log('  4. 点击"一键填充"');
    console.log('  5. 评论框会自动填充 LLM 生成的内容');

    console.log('\n🔍 查看日志:');
    console.log('  打开 Console 查看 [Content Script] 和 [LLM Service] 的日志');

    // 验证配置
    const verification = await chrome.storage.local.get('extension-settings-storage-key');
    const saved = verification['extension-settings-storage-key'];

    if (saved.enable_llm_comment && saved.llm_api_key) {
      console.log('\n✅ 配置验证通过！');
    } else {
      console.warn('\n⚠️  配置可能未正确保存，请检查');
    }

  } catch (error) {
    console.error('❌ 配置失败:', error);
    console.log('\n💡 请确保:');
    console.log('  1. 在扩展的页面中执行（Options/Popup/Side Panel）');
    console.log('  2. 扩展有 storage 权限');
  }
})();
