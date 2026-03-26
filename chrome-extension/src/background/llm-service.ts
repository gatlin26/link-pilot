/**
 * LLM 服务 - 在 Background Service Worker 中调用 LLM API
 */

import { extensionSettingsStorage } from '@extension/storage';
import type {
  GenerateLLMCommentMessage,
  GenerateLLMCommentResponse,
  GenerateLLMFillPlanData,
  GenerateLLMFillPlanMessage,
  GenerateLLMFillPlanResponse,
} from '@extension/shared';

interface LLMRequestOptions {
  provider: 'openai' | 'anthropic' | 'custom';
  apiKey: string;
  model: string;
  customEndpoint?: string;
}

function resolveLanguageInstruction(pageLanguage?: string): string {
  const normalized = (pageLanguage || '').trim().toLowerCase();

  if (!normalized) {
    return 'Use the same language as the current webpage. Do not mix languages in the comment.';
  }

  return `The current webpage language is "${pageLanguage}". Write the entire comment in that language only, and do not mix in Chinese or any other language.`;
}

/**
 * 调用 OpenAI API
 */
async function callOpenAI(
  options: LLMRequestOptions,
  prompt: string,
  systemPrompt: string,
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
          content: systemPrompt,
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
  prompt: string,
  systemPrompt: string,
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
      system: systemPrompt,
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
    pageLanguage,
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
4. Keep the comment concise: about 2-4 sentences, roughly 60-120 words or equivalent length in the target language
5. ${resolveLanguageInstruction(pageLanguage)}
6. 不要使用过于正式或模板化的语言
7. 保持简洁，不要啰嗦

请直接输出评论内容，不要包含任何前缀或解释。`;
}

function buildFillPlanPrompt(payload: GenerateLLMFillPlanMessage['payload']): string {
  const fieldList = payload.fields
    .map((field, index) => {
      const parts = [
        `#${index + 1}`,
        `selector=${field.selector}`,
        `currentType=${field.currentType}`,
        `tag=${field.tagName}`,
        field.inputType ? `inputType=${field.inputType}` : '',
        field.name ? `name=${field.name}` : '',
        field.id ? `id=${field.id}` : '',
        field.placeholder ? `placeholder=${field.placeholder}` : '',
        field.label ? `label=${field.label}` : '',
        field.ariaLabel ? `ariaLabel=${field.ariaLabel}` : '',
        field.required ? 'required=true' : '',
      ].filter(Boolean);

      return `- ${parts.join(' | ')}`;
    })
    .join('\n');

  const commentCandidates = (payload.commentCandidates ?? [])
    .filter(Boolean)
    .slice(0, 3)
    .map(comment => `- ${comment}`)
    .join('\n');

  return `你要为一个博客评论表单生成“字段判断 + 评论内容”。

## 当前博客页面
- 标题: ${payload.pageH1 || payload.pageTitle}
- 描述: ${payload.pageDescription || '无'}
- URL: ${payload.pageUrl}
- 语言: ${payload.pageLanguage || '未知'}

## 我的网站资料
- 网站名称: ${payload.websiteName}
- 网站 URL: ${payload.websiteUrl}
- 邮箱: ${payload.websiteEmail || '无'}
- 网站简介: ${payload.websiteDescription || '无'}
${payload.backlinkNote ? `- 补充说明: ${payload.backlinkNote}` : ''}

## 可参考的评论候选
${commentCandidates || '- 无'}

## 当前表单字段
${fieldList}

## 目标
1. 判断每个字段最适合填什么角色，只能是 name、email、website、comment、submit、unknown。
2. 生成一条适合当前 blog 页面的评论，评论要结合博客内容和我的网站资料。
3. 评论必须使用当前网页语言，不要混用中文。
4. 如果某个字段不确定，就返回 unknown，不要瞎猜。

请只返回 JSON，不要使用 markdown 代码块。格式如下：
{
  "comment": "string",
  "fieldMappings": [
    {
      "selector": "string",
      "fieldType": "name|email|website|comment|submit|unknown",
      "confidence": 0.0
    }
  ]
}`;
}

function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim();
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch?.[1]?.trim() || trimmed;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  const jsonString = start >= 0 && end > start ? candidate.slice(start, end + 1) : candidate;
  return JSON.parse(jsonString);
}

function normalizeFieldType(value: string): GenerateLLMFillPlanData['fieldMappings'][number]['fieldType'] {
  switch ((value || '').trim().toLowerCase()) {
    case 'name':
    case 'email':
    case 'website':
    case 'comment':
    case 'submit':
      return value.trim().toLowerCase() as GenerateLLMFillPlanData['fieldMappings'][number]['fieldType'];
    default:
      return 'unknown';
  }
}

function getCommentSystemPrompt(): string {
  return '你是一个专业的博客评论助手，擅长撰写有价值、自然、友好的评论。评论应该真诚、具体，避免过度营销。';
}

function getFillPlanSystemPrompt(): string {
  return '你是一个博客评论表单助手，擅长识别评论表单里的 name、email、website、comment、submit 字段，并生成适合当前页面语境的真实评论。必须返回合法 JSON。';
}

async function callTextModel(
  options: LLMRequestOptions,
  prompt: string,
  systemPrompt: string,
): Promise<string> {
  if (options.provider === 'anthropic') {
    return callAnthropic(options, prompt, systemPrompt);
  }

  return callOpenAI(options, prompt, systemPrompt);
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

    const comment = await callTextModel(options, prompt, getCommentSystemPrompt());

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

export async function generateLLMFillPlan(
  message: GenerateLLMFillPlanMessage,
): Promise<GenerateLLMFillPlanResponse> {
  try {
    const settings = await extensionSettingsStorage.get();

    if (!settings.enable_llm_comment) {
      return {
        success: false,
        error: 'LLM 评论生成未启用',
      };
    }

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

    const raw = await callTextModel(options, buildFillPlanPrompt(message.payload), getFillPlanSystemPrompt());
    const parsed = extractJsonObject(raw) as Partial<GenerateLLMFillPlanData>;

    const data: GenerateLLMFillPlanData = {
      comment: String(parsed.comment || '').trim(),
      fieldMappings: Array.isArray(parsed.fieldMappings)
        ? parsed.fieldMappings
            .map(item => ({
              selector: String(item?.selector || '').trim(),
              fieldType: normalizeFieldType(String(item?.fieldType || 'unknown')),
              confidence: Math.max(0, Math.min(1, Number(item?.confidence || 0))),
            }))
            .filter(item => item.selector.length > 0)
        : [],
    };

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error('[LLM Service] 生成结构化填表方案失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '生成结构化填表方案失败',
    };
  }
}
