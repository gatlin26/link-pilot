'use server';

import {
  callEvolinkAPIWithRetry,
  parseAIJsonResponse,
  sanitizeForPrompt,
} from '@/lib/ai-utils';
import { adminActionClient } from '@/lib/safe-action';
import { type PromptTemplateName, renderPrompt } from '@/prompts';
import { z } from 'zod';

const generateToolContentSchema = z.object({
  name: z.string().min(1, 'Tool name is required'),
  url: z.string().url('Valid URL is required'),
  referenceContent: z.string().min(50, '参考内容不足 50 字，请先抓取或粘贴'),
  locale: z.enum([
    'en',
    'zh',
    'zh-TW',
    'ko',
    'ja',
    'pt',
    'es',
    'de',
    'fr',
    'vi',
  ]),
});

/**
 * 生成的多语言内容
 */
export interface GeneratedToolContent {
  title: string;
  description: string;
  introduction: string;
}

/**
 * 使用 EvoLink AI 联网分析网站，生成指定语言的内容
 * 每次只生成一种语言的内容
 */
export const generateToolContentAction = adminActionClient
  .schema(generateToolContentSchema)
  .action(
    async ({
      parsedInput,
    }): Promise<
      | { success: true; data: GeneratedToolContent }
      | { success: false; error: string }
    > => {
      const { name, url, referenceContent, locale } = parsedInput;

      // 清理用户输入，防止 Prompt Injection
      const safeUrl = sanitizeForPrompt(url, 200);
      const safeReferenceContent = sanitizeForPrompt(referenceContent, 8000);
      const safeName = sanitizeForPrompt(name, 100);

      // 根据语言选择提示词模板，有对应模板用对应模板，否则用英文模板
      const localeTemplateMap: Record<string, string> = {
        en: 'tool-content-en',
        zh: 'tool-content-zh',
        'zh-TW': 'tool-content-zh-TW',
        ko: 'tool-content-ko',
        ja: 'tool-content-ja',
        pt: 'tool-content-pt',
        es: 'tool-content-es',
        de: 'tool-content-de',
        fr: 'tool-content-fr',
        vi: 'tool-content-vi',
      };
      const templateName = (localeTemplateMap[locale] ??
        'tool-content-en') as PromptTemplateName;
      const prompt = renderPrompt(templateName, {
        url: safeUrl,
        name: safeName,
        referenceContent: safeReferenceContent,
      });

      // 调用 EvoLink API（带重试机制）
      const apiResult = await callEvolinkAPIWithRetry({
        prompt,
        temperature: 0.7,
        maxTokens: 8000, // 放大以避免 introduction 被截断
      });

      if (!apiResult.success) {
        return { success: false, error: apiResult.error };
      }

      // 使用智能解析函数，可以修复截断的 JSON
      const parseResult = parseAIJsonResponse<GeneratedToolContent>(
        apiResult.content
      );

      if (!parseResult.success || !parseResult.data) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Failed to parse AI response:', apiResult.content);
          console.error('Parse error:', parseResult.error);
        }
        return {
          success: false,
          error: `AI 响应解析失败：${parseResult.error || '未知错误'}。这可能是因为响应被截断，请重试。`,
        };
      }

      const parsed = parseResult.data;

      // 验证必要字段
      if (!parsed.title || !parsed.description || !parsed.introduction) {
        // 如果是部分解析成功，提供更详细的错误信息
        if (parseResult.partial) {
          const missingFields = [];
          if (!parsed.title) missingFields.push('title');
          if (!parsed.description) missingFields.push('description');
          if (!parsed.introduction) missingFields.push('introduction');

          return {
            success: false,
            error: `AI 响应不完整，缺少字段：${missingFields.join(', ')}。请重试。`,
          };
        }

        return {
          success: false,
          error: 'AI 响应缺少必要字段。请重试。',
        };
      }

      return {
        success: true,
        data: {
          title: parsed.title,
          description: parsed.description,
          introduction: parsed.introduction,
        },
      };
    }
  );
