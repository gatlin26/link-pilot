/**
 * YouTube 表单检测诊断脚本
 *
 * 使用方法：
 * 1. 打开 YouTube 视频页面
 * 2. 滚动到评论区
 * 3. 打开 DevTools Console
 * 4. 复制粘贴这段代码并执行
 */

(function diagnoseYouTubeForm() {
  console.log('🔍 YouTube 表单检测诊断\n');
  console.log('═'.repeat(60));

  // 1. 检测标准表单元素
  console.log('\n📋 1. 标准表单元素:');
  const forms = document.querySelectorAll('form');
  console.log(`  找到 ${forms.length} 个 <form> 元素`);

  const inputs = document.querySelectorAll('input:not([type="hidden"])');
  console.log(`  找到 ${inputs.length} 个可见 <input> 元素`);

  const textareas = document.querySelectorAll('textarea');
  console.log(`  找到 ${textareas.length} 个 <textarea> 元素`);

  // 2. 检测 contenteditable 元素
  console.log('\n✏️  2. ContentEditable 元素:');
  const editables = document.querySelectorAll('[contenteditable="true"]');
  console.log(`  找到 ${editables.length} 个 contenteditable 元素`);

  if (editables.length > 0) {
    editables.forEach((el, i) => {
      console.log(`  [${i}] ${el.tagName}`, {
        id: el.id,
        class: el.className,
        placeholder: el.getAttribute('placeholder') || el.getAttribute('aria-label'),
        text: el.textContent?.substring(0, 50),
      });
    });
  }

  // 3. 检测 YouTube 特定元素
  console.log('\n🎬 3. YouTube 特定元素:');

  // 评论输入框
  const commentBox = document.querySelector('#simplebox-placeholder');
  console.log(`  评论占位符: ${commentBox ? '✅ 找到' : '❌ 未找到'}`);

  const commentInput = document.querySelector('#contenteditable-root');
  console.log(`  评论输入框: ${commentInput ? '✅ 找到' : '❌ 未找到'}`);

  // 评论区容器
  const commentsSection = document.querySelector('ytd-comments');
  console.log(`  评论区容器: ${commentsSection ? '✅ 找到' : '❌ 未找到'}`);

  // 4. 检测 Shadow DOM
  console.log('\n🌑 4. Shadow DOM 检测:');
  let shadowRootCount = 0;
  const allElements = document.querySelectorAll('*');

  allElements.forEach(el => {
    if (el.shadowRoot) {
      shadowRootCount++;
      const shadowInputs = el.shadowRoot.querySelectorAll('input, textarea, [contenteditable="true"]');
      if (shadowInputs.length > 0) {
        console.log(`  找到 Shadow Root (${el.tagName}):`, {
          inputs: shadowInputs.length,
          elements: Array.from(shadowInputs).map(i => ({
            tag: i.tagName,
            type: i.getAttribute('type'),
            name: i.getAttribute('name'),
          }))
        });
      }
    }
  });
  console.log(`  总共找到 ${shadowRootCount} 个 Shadow Root`);

  // 5. 检测可能的评论字段
  console.log('\n💬 5. 可能的评论字段:');

  const possibleCommentFields = [
    // YouTube 特定选择器
    '#simplebox-placeholder',
    '#contenteditable-root',
    'div[contenteditable="true"]',
    '[aria-label*="comment" i]',
    '[aria-label*="评论"]',
    '[placeholder*="comment" i]',
    '[placeholder*="评论"]',
    // 通用选择器
    'textarea[name*="comment"]',
    'textarea[id*="comment"]',
    'div[role="textbox"]',
  ];

  possibleCommentFields.forEach(selector => {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
      console.log(`  ✅ ${selector}: 找到 ${elements.length} 个`);
      elements.forEach((el, i) => {
        if (i < 3) { // 只显示前3个
          console.log(`     [${i}]`, {
            tag: el.tagName,
            visible: el.offsetParent !== null,
            text: el.textContent?.substring(0, 30),
          });
        }
      });
    }
  });

  // 6. 检测提交按钮
  console.log('\n🔘 6. 提交按钮:');

  const possibleSubmitButtons = [
    'button[type="submit"]',
    'button[aria-label*="comment" i]',
    'button[aria-label*="评论"]',
    'button[aria-label*="post" i]',
    'button[aria-label*="发布"]',
    'ytd-button-renderer[aria-label*="comment" i]',
  ];

  possibleSubmitButtons.forEach(selector => {
    const buttons = document.querySelectorAll(selector);
    if (buttons.length > 0) {
      console.log(`  ✅ ${selector}: 找到 ${buttons.length} 个`);
    }
  });

  // 7. 模拟 Link Pilot 的检测逻辑
  console.log('\n🤖 7. 模拟 Link Pilot 检测:');

  const detectedFields = [];

  // 检测评论字段
  const commentField = document.querySelector('#contenteditable-root') ||
                       document.querySelector('div[contenteditable="true"]') ||
                       document.querySelector('textarea[name*="comment"]');

  if (commentField) {
    detectedFields.push({
      type: 'comment',
      element: commentField,
      visible: commentField.offsetParent !== null,
    });
    console.log('  ✅ 检测到评论字段:', commentField.tagName);
  } else {
    console.log('  ❌ 未检测到评论字段');
  }

  // 检测姓名字段
  const nameField = document.querySelector('input[name*="name"]') ||
                    document.querySelector('input[placeholder*="name" i]');

  if (nameField) {
    detectedFields.push({
      type: 'name',
      element: nameField,
      visible: nameField.offsetParent !== null,
    });
    console.log('  ✅ 检测到姓名字段');
  }

  // 检测邮箱字段
  const emailField = document.querySelector('input[type="email"]') ||
                     document.querySelector('input[name*="email"]');

  if (emailField) {
    detectedFields.push({
      type: 'email',
      element: emailField,
      visible: emailField.offsetParent !== null,
    });
    console.log('  ✅ 检测到邮箱字段');
  }

  // 判断是否检测到表单
  const hasComment = detectedFields.some(f => f.type === 'comment');
  const hasNameOrEmail = detectedFields.some(f => f.type === 'name' || f.type === 'email');
  const detected = hasComment && hasNameOrEmail;

  console.log('\n📊 检测结果:');
  console.log(`  评论字段: ${hasComment ? '✅' : '❌'}`);
  console.log(`  姓名/邮箱: ${hasNameOrEmail ? '✅' : '❌'}`);
  console.log(`  表单检测: ${detected ? '✅ 通过' : '❌ 失败'}`);

  // 8. 建议
  console.log('\n💡 建议:');

  if (!hasComment && editables.length > 0) {
    console.log('  ⚠️  页面有 contenteditable 元素，但未被识别为评论字段');
    console.log('  建议: 添加对 contenteditable 元素的支持');
  }

  if (hasComment && !hasNameOrEmail) {
    console.log('  ⚠️  检测到评论字段，但缺少姓名/邮箱字段');
    console.log('  建议: YouTube 评论不需要姓名/邮箱，应该放宽检测条件');
  }

  if (!hasComment && !hasNameOrEmail) {
    console.log('  ⚠️  未检测到任何表单字段');
    console.log('  建议: 检查页面是否已加载评论区，或尝试滚动到评论区');
  }

  console.log('\n═'.repeat(60));
  console.log('诊断完成！');

  // 返回检测结果供进一步分析
  return {
    forms: forms.length,
    inputs: inputs.length,
    textareas: textareas.length,
    editables: editables.length,
    shadowRoots: shadowRootCount,
    detectedFields,
    detected,
  };
})();
