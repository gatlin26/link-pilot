'use server';

import {
  callEvolinkAPIWithRetry,
  cleanAIJsonResponse,
  ensureStringArray,
  parseAIJsonResponse,
  sanitizeForPrompt,
} from '@/lib/ai-utils';
import { adminActionClient } from '@/lib/safe-action';
import { renderPrompt } from '@/prompts';
import { z } from 'zod';

const fetchToolBasicInfoSchema = z.object({
  url: z.string().url('Valid URL is required'),
  name: z.string().min(1, 'Tool name is required'),
  description: z.string().optional(),
  referenceContent: z.string().optional(),
  availableTags: z
    .array(
      z.object({
        slug: z.string().min(1).max(50),
        name: z.string().min(1).max(100),
        category: z.string().nullable().optional(),
        description: z.string().nullable().optional(),
      })
    )
    .default([]),
});

interface ManagedTagOption {
  slug: string;
  name: string;
  category?: string | null;
  description?: string | null;
}

function normalizeTagKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-');
}

function buildAvailableTagsPrompt(availableTags: ManagedTagOption[]) {
  if (availableTags.length === 0) {
    return 'No managed tags are available. Infer concise slug-style tags only if needed.';
  }

  return availableTags
    .slice(0, 250)
    .map((tag) => {
      const safeSlug = sanitizeForPrompt(tag.slug, 50);
      const safeName = sanitizeForPrompt(tag.name, 100);
      const safeCategory = tag.category
        ? sanitizeForPrompt(tag.category, 50)
        : 'general';
      const safeDescription = tag.description
        ? sanitizeForPrompt(tag.description, 160)
        : 'n/a';

      return `- slug: ${safeSlug} | name: ${safeName} | category: ${safeCategory} | description: ${safeDescription}`;
    })
    .join('\n');
}

function inferTagsFromManagedCatalog(
  content: string,
  availableTags: ManagedTagOption[]
) {
  if (availableTags.length === 0) {
    return [] as string[];
  }

  const normalizedContent = content.toLowerCase();

  return availableTags
    .map((tag) => {
      let score = 0;
      const normalizedName = tag.name.trim().toLowerCase();
      const slugTerms = tag.slug
        .split('-')
        .map((term) => term.trim().toLowerCase())
        .filter((term) => term.length >= 3);

      if (normalizedName && normalizedContent.includes(normalizedName)) {
        score += 4;
      }

      for (const term of slugTerms) {
        if (normalizedContent.includes(term)) {
          score += 1;
        }
      }

      if (
        tag.category &&
        normalizedContent.includes(tag.category.trim().toLowerCase())
      ) {
        score += 1;
      }

      return { slug: tag.slug, score };
    })
    .filter((tag) => tag.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 6)
    .map((tag) => tag.slug);
}

/**
 * 工具基础信息（语言无关）
 */
export interface ToolBasicInfo {
  name: string;
  tags: string[];
}

/**
 * 使用 EvoLink AI 联网分析网站，获取工具基础信息
 * 仅获取与语言无关的信息：名称、分类、标签
 */
export const fetchToolBasicInfoAction = adminActionClient
  .schema(fetchToolBasicInfoSchema)
  .action(
    async ({
      parsedInput,
    }): Promise<
      { success: true; data: ToolBasicInfo } | { success: false; error: string }
    > => {
      const { url, name, description, referenceContent, availableTags } =
        parsedInput;

      // 清理用户输入，防止 Prompt Injection
      const safeUrl = sanitizeForPrompt(url, 200);
      const safeName = sanitizeForPrompt(name, 100);
      const safeDescription = description
        ? sanitizeForPrompt(description, 500)
        : 'Not provided';
      const safeReferenceContent = referenceContent
        ? sanitizeForPrompt(referenceContent, 5000)
        : 'Not available';
      const safeAvailableTags = buildAvailableTagsPrompt(availableTags);

      // 使用提示词模板
      const prompt = renderPrompt('tool-basic-info', {
        url: safeUrl,
        name: safeName,
        description: safeDescription,
        referenceContent: safeReferenceContent,
        availableTags: safeAvailableTags,
      });

      // 调用 EvoLink API（带重试）
      const apiResult = await callEvolinkAPIWithRetry({
        prompt,
        temperature: 0.5,
        maxTokens: 1500,
      });

      if (!apiResult.success) {
        return { success: false, error: apiResult.error };
      }

      // 使用智能 JSON 解析
      const parseResult = parseAIJsonResponse<ToolBasicInfo>(apiResult.content);

      if (!parseResult.success || !parseResult.data) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Failed to parse AI response:', apiResult.content);
        }
        return {
          success: false,
          error:
            parseResult.error ||
            'Failed to parse AI response. Please try again.',
        };
      }

      const parsed = parseResult.data;

      // 验证并规范化字段
      if (!parsed.name) {
        parsed.name = name; // 使用用户提交的名称作为备选
      }

      // 确保 tags 是字符串数组
      const allowedTagSlugs = new Set(availableTags.map((tag) => tag.slug));
      const tagAliasMap = new Map<string, string>();

      for (const tag of availableTags) {
        tagAliasMap.set(normalizeTagKey(tag.slug), tag.slug);
        tagAliasMap.set(normalizeTagKey(tag.name), tag.slug);
      }

      parsed.tags = ensureStringArray(parsed.tags)
        .map((tag) => tagAliasMap.get(normalizeTagKey(tag)) || tag)
        .filter((tag, index, tags) => tags.indexOf(tag) === index)
        .filter((tag) =>
          allowedTagSlugs.size > 0 ? allowedTagSlugs.has(tag) : true
        )
        .slice(0, 6);

      if (parsed.tags.length === 0 && availableTags.length > 0) {
        parsed.tags = inferTagsFromManagedCatalog(
          [name, description, referenceContent].filter(Boolean).join('\n\n'),
          availableTags
        );
      }

      return {
        success: true,
        data: {
          name: parsed.name,
          tags: parsed.tags,
        },
      };
    }
  );
