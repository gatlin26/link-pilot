/**
 * LLM 服务 - 在 Background Service Worker 中调用 LLM API
 */

import { extensionSettingsStorage } from '@extension/storage';
import type { GenerateLLMCommentMessage, GenerateLLMCommentResponse } from '@extension/shared';

interface LLMRequestOptions {
  provider: 'openai' | 'anthropic' | 'custom';
  apiKey: string;
  model: string;
  customEndpoint?: string;
}

/**
 * 调用 OpenAI API
 */
async function callOpenAI(
  options: LLMRequestOptions,
  prompt: string
): Promise<string> {
  const endpoint = options.customEndpoint || 'https://api.openai.com/v1/chat/completions';

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${options.apiKey}`,
    },
    body: JSON.stringify({
      model: options.model,
      messages: [
        {
          role: 'system',
          content: '你是一个专业的博客评论助手，擅长撰写有价值、自然、友好的评论。评论应该真诚、具体，避免过度营销。'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 300,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API 调用失败: ${response.status} ${error}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || '';
}

/**
 * 调用 Anthropic API
 */
async function callAnthropic(
  options: LLMRequestOptions,
  prompt: string
): Promise<string> {
  const endpoint = options.customEndpoint || 'https://api.anthropic.com/v1/messages';

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': options.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: options.model,
      max_tokens: 300,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      system: '你是一个专业的博客评论助手，擅长撰写有价值、自然、友好的评论。评论应该真诚、具体，避免过度营销。',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic API 调用失败: ${response.status} ${error}`);
  }

  const data = await response.json();
  return data.content[0]?.text || '';
}

/**
 * 构建 LLM 提示词
 */
function buildPrompt(payload: GenerateLLMCommentMessage['payload']): string {
  const {
    pageTitle,
    pageDescription,
    pageH1,
    pageUrl,
    websiteName,
    websiteUrl,
    websiteDescription,
    backlinkNote,
  } = payload;

  return `请为以下博客文章生成一条真诚、有价值的评论。

## 博客文章信息
- 标题: ${pageH1 || pageTitle}
- 描述: ${pageDescription || '无'}
- URL: ${pageUrl}

## 我的网站信息
- 网站名称: ${websiteName}
- 网站 URL: ${websiteUrl}
- 网站简介: ${websiteDescription || '无'}
${backlinkNote ? `- 补充说明: ${backlinkNote}` : ''}

## 要求
1. 评论应该真诚、自然，像一个真实读者的反馈
2. 先对文章内容表示认可或提出有价值的观点
3. 可以适当提及我的网站作为补充资源，但不要过度营销
4. **评论长度严格控制在 100-120 字之间**（重要！）
5. 使用中文撰写
6. 不要使用过于正式或模板化的语言
7. 保持简洁，不要啰嗦

请直接输出评论内容，不要包含任何前缀或解释。`;
}

/**
 * 生成 LLM 评论
 */
export async function generateLLMComment(
  message: GenerateLLMCommentMessage
): Promise<GenerateLLMCommentResponse> {
  try {
    // 获取设置
    const settings = await extensionSettingsStorage.get();

    // 检查是否启用 LLM
    if (!settings.enable_llm_comment) {
      return {
        success: false,
        error: 'LLM 评论生成未启用',
      };
    }

    // 检查 API Key
    if (!settings.llm_api_key) {
      return {
        success: false,
        error: 'LLM API Key 未配置',
      };
    }

    const options: LLMRequestOptions = {
      provider: settings.llm_provider || 'openai',
      apiKey: settings.llm_api_key,
      model: settings.llm_model || 'gpt-4o-mini',
      customEndpoint: settings.llm_custom_endpoint,
    };

    const prompt = buildPrompt(message.payload);

    let comment: string;
    if (options.provider === 'anthropic') {
      comment = await callAnthropic(options, prompt);
    } else {
      // openai 或 custom 都使用 OpenAI 格式
      comment = await callOpenAI(options, prompt);
    }

    return {
      success: true,
      data: comment.trim(),
    };
  } catch (error) {
    console.error('[LLM Service] 生成评论失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '生成评论失败',
    };
  }
}
