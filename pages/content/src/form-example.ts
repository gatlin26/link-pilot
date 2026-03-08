import { blogCommentHandler } from './form-handlers';
import { manualAnnotation } from './template/manual-annotation';

/**
 * 示例 1: 自动检测并填充当前页面
 */
async function example1_AutoDetectAndFill() {
  await blogCommentHandler.initialize();
}

/**
 * 示例 2: 使用自定义数据填充
 */
async function example2_FillWithCustomData() {
  await blogCommentHandler.initialize();
  await blogCommentHandler.manualFill({
    name: 'John Doe',
    email: 'john@example.com',
    website: 'https://example.com',
    comment: 'Great post! Thanks for sharing.',
  });
}

/**
 * 示例 3: 手动标注字段
 */
function example3_ManualAnnotation() {
  manualAnnotation.start();
}

/**
 * 示例 4: 学习模板
 */
async function example4_LearnFromSubmission() {
  const result = await blogCommentHandler.getDetectionResult();
  if (!result?.detected) {
    return;
  }

  console.log('模板学习功能已准备，等待实际提交流程接入');
}

/**
 * 示例 5: 检查检测结果
 */
async function example5_CheckDetectionResult() {
  await blogCommentHandler.initialize();
  const result = await blogCommentHandler.getDetectionResult();

  if (!result) {
    console.log('尚无检测结果');
    return;
  }

  console.log('表单检测结果:', {
    detected: result.detected,
    pageType: result.pageType,
    confidence: result.confidence,
    fields: result.fields.map(f => ({
      type: f.type,
      selector: f.selector,
      confidence: f.confidence,
    })),
    template: result.template ? {
      id: result.template.id,
      domain: result.template.domain,
      version: result.template.version,
    } : null,
  });
}

/**
 * 示例 6: 监听消息并处理填充请求
 */
function example6_MessageListener() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'FILL_FORM') {
      blogCommentHandler
        .manualFill(message.data, message.autoSubmit)
        .then(result => {
          sendResponse({ success: true, result });
        })
        .catch(error => {
          sendResponse({ success: false, error: error.message });
        });
      return true;
    }

    if (message.type === 'START_ANNOTATION') {
      manualAnnotation.start();
      sendResponse({ success: true });
      return false;
    }

    if (message.type === 'ANNOTATE_FIELD') {
      manualAnnotation.annotateField(message.fieldType);
      sendResponse({ success: true });
      return false;
    }

    if (message.type === 'SAVE_ANNOTATION') {
      manualAnnotation
        .save()
        .then(() => {
          sendResponse({ success: true });
        })
        .catch(error => {
          sendResponse({ success: false, error: error.message });
        });
      return true;
    }

    return false;
  });
}

export {
  example1_AutoDetectAndFill,
  example2_FillWithCustomData,
  example3_ManualAnnotation,
  example4_LearnFromSubmission,
  example5_CheckDetectionResult,
  example6_MessageListener,
};
