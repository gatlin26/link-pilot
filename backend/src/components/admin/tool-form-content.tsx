'use client';

import { getAllTagsAction } from '@/actions/tags/manage-tags';
import { fetchToolBasicInfoAction } from '@/actions/tools/fetch-tool-basic-info';
import { fetchUrlContentAction } from '@/actions/tools/fetch-url-content';
import { generateToolContentAction } from '@/actions/tools/generate-tool-content';
import { fetchAndSaveReferenceAction } from '@/actions/tools/manage-reference';
import { saveToolTranslationAction } from '@/actions/tools/save-tool-translation';
import type { Tag } from '@/components/admin/tag-selector';
import {
  AutoFillDialog,
  type AutoFillState,
} from '@/components/admin/tool-form-autofill-dialog';
import { ToolFormBasicInfo } from '@/components/admin/tool-form-basic-info';
import { LocaleTabs } from '@/components/admin/tool-form-locale-tabs';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { websiteConfig } from '@/config/website';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useAction } from 'next-safe-action/hooks';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import {
  type ToolFormData,
  type ToolFormMode,
  toolFormSchema,
} from './tool-form-types';

// 所有支持的语言列表（从配置动态读取）
const LOCALE_LIST = Object.entries(websiteConfig.i18n.locales).map(
  ([code, info]) => ({ code, ...info })
);

// 工具数据类型（来自 getToolDetailAction）
export interface ToolData {
  id: string;
  slug: string;
  name: string;
  url: string;
  tags: string | null;
  featured: boolean | null;
  published: boolean | null;
  status: string;
  submitterEmail?: string | null;
  iconUrl?: string | null;
  thumbnailUrl?: string | null;
  imageUrl?: string | null;
  translations?: Record<
    string,
    { title: string; description: string; introduction: string }
  >;
}

// 提交数据类型
export interface SubmissionData {
  id: string;
  name: string;
  url: string;
  slug: string;
  status: string;
  submitterEmail: string | null;
  iconUrl?: string | null;
  thumbnailUrl?: string | null;
  imageUrl?: string | null;
}

// 组件 Props
interface ToolFormContentProps {
  mode: ToolFormMode;
  tool?: ToolData | null;
  submission?: SubmissionData | null;
  onSubmit: (data: ToolFormData) => void;
  onCancel?: () => void;
  isSaving?: boolean;
}

/**
 * 构建空的 translations 对象
 */
function buildEmptyTranslations(): Record<
  string,
  { title: string; description: string; introduction: string }
> {
  return Object.fromEntries(
    LOCALE_LIST.map(({ code }) => [
      code,
      { title: '', description: '', introduction: '' },
    ])
  );
}

/**
 * 获取表单默认值
 */
function getDefaultValues(
  mode: ToolFormMode,
  tool?: ToolData | null,
  submission?: SubmissionData | null
): ToolFormData {
  if (mode === 'approve' && submission) {
    return {
      name: submission.name,
      url: submission.url,
      tags: [],
      featured: false,
      published: true,
      referenceContent: '',
      iconUrl: submission.iconUrl ?? null,
      thumbnailUrl: submission.thumbnailUrl ?? null,
      imageUrl: submission.imageUrl ?? null,
      translations: buildEmptyTranslations(),
    };
  }

  if (mode === 'edit' && tool) {
    let tags: string[] = [];
    try {
      tags = tool.tags ? JSON.parse(tool.tags) : [];
    } catch {
      tags = [];
    }

    const translations = buildEmptyTranslations();
    if (tool.translations) {
      for (const [locale, content] of Object.entries(tool.translations)) {
        if (translations[locale] !== undefined) {
          translations[locale] = content;
        }
      }
    }

    return {
      name: tool.name,
      url: tool.url,
      tags,
      featured: tool.featured ?? false,
      published: tool.published ?? true,
      referenceContent: '',
      iconUrl: tool.iconUrl ?? null,
      thumbnailUrl: tool.thumbnailUrl ?? null,
      imageUrl: tool.imageUrl ?? null,
      translations,
    };
  }

  return {
    name: '',
    url: '',
    tags: [],
    featured: false,
    published: true,
    referenceContent: '',
    iconUrl: null,
    thumbnailUrl: null,
    imageUrl: null,
    translations: buildEmptyTranslations(),
  };
}

function normalizeUrlValue(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function ToolFormContent({
  mode,
  tool,
  submission,
  onSubmit,
  onCancel,
  isSaving = false,
}: ToolFormContentProps) {
  const [activeTab, setActiveTab] = useState(LOCALE_LIST[0].code);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [fetchContentError, setFetchContentError] = useState<string | null>(
    null
  );
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [isLoadingTags, setIsLoadingTags] = useState(false);
  const analyzeAfterFetchRef = useRef(false);
  const autoFillAssetSnapshotRef = useRef<{
    iconUrl: string | null;
    thumbnailUrl: string | null;
    imageUrl: string | null;
  } | null>(null);
  const [autoFillState, setAutoFillState] = useState<AutoFillState>({
    step: 'idle',
    progress: 0,
    error: null,
    completedSteps: [],
  });

  const form = useForm<ToolFormData>({
    resolver: zodResolver(toolFormSchema),
    defaultValues: getDefaultValues(mode, tool, submission),
  });

  useEffect(() => {
    const loadTags = async () => {
      setIsLoadingTags(true);
      try {
        const result = await getAllTagsAction({ locale: 'en' });
        if (result?.data?.success && result.data.data) {
          setAvailableTags(result.data.data as Tag[]);
        }
      } catch (error) {
        console.error('Failed to load tags:', error);
      } finally {
        setIsLoadingTags(false);
      }
    };
    loadTags();
  }, []);

  useEffect(() => {
    form.reset(getDefaultValues(mode, tool, submission));
    setFetchError(null);
    setGenerateError(null);
    setFetchContentError(null);
    setActiveTab(LOCALE_LIST[0].code);
    autoFillAssetSnapshotRef.current = null;
  }, [mode, tool, submission, form]);

  const { execute: fetchBasicInfo, status: fetchBasicStatus } = useAction(
    fetchToolBasicInfoAction,
    {
      onSuccess: ({ data }) => {
        setFetchError(null);
        if (data?.success && data.data) {
          form.setValue('name', data.data.name);
          form.setValue('tags', data.data.tags);
        } else if (data && !data.success) {
          setFetchError(data.error);
        }
      },
      onError: ({ error }) => {
        setFetchError(
          typeof error.serverError === 'string'
            ? error.serverError
            : 'Failed to fetch basic info'
        );
      },
    }
  );

  const { execute: generateContent, status: generateStatus } = useAction(
    generateToolContentAction,
    {
      onSuccess: ({ data, input }) => {
        setGenerateError(null);
        if (data?.success && data.data) {
          const content = data.data;
          const locale = input.locale;
          form.setValue(`translations.${locale}.title`, content.title);
          form.setValue(
            `translations.${locale}.description`,
            content.description
          );
          form.setValue(
            `translations.${locale}.introduction`,
            content.introduction
          );
        } else if (data && !data.success) {
          setGenerateError(data.error);
        }
      },
      onError: ({ error }) => {
        setGenerateError(
          typeof error.serverError === 'string'
            ? error.serverError
            : 'Failed to generate content'
        );
      },
    }
  );

  const { execute: fetchUrlContent, status: fetchContentStatus } = useAction(
    fetchUrlContentAction,
    {
      onSuccess: ({ data }) => {
        setFetchContentError(null);
        if (data?.success && data.data) {
          const content = data.data.content;
          form.setValue('referenceContent', content);
          if (analyzeAfterFetchRef.current) {
            analyzeAfterFetchRef.current = false;
            fetchBasicInfo({
              url: data.data.url,
              name: form.getValues('name'),
              referenceContent: content,
              availableTags: availableTags.map((tag) => ({
                slug: tag.slug,
                name: tag.name,
                category: tag.category ?? null,
                description: tag.description ?? null,
              })),
            });
          }
        } else if (data && !data.success) {
          setFetchContentError(data.error);
        }
      },
      onError: ({ error }) => {
        setFetchContentError(
          typeof error.serverError === 'string'
            ? error.serverError
            : 'Failed to fetch URL content'
        );
      },
    }
  );

  const isFetchingBasic = fetchBasicStatus === 'executing';
  const isGenerating = generateStatus === 'executing';
  const isFetchingContent = fetchContentStatus === 'executing';
  const isAutoFilling =
    autoFillState.step !== 'idle' &&
    autoFillState.step !== 'completed' &&
    autoFillState.step !== 'error';

  const restoreProtectedAssets = useCallback(() => {
    const snapshot = autoFillAssetSnapshotRef.current;
    if (!snapshot) return;

    const currentIconUrl = normalizeUrlValue(form.getValues('iconUrl'));
    const currentThumbnailUrl = normalizeUrlValue(form.getValues('thumbnailUrl'));
    const currentImageUrl = normalizeUrlValue(form.getValues('imageUrl'));

    const safeIconUrl = currentIconUrl || snapshot.iconUrl;
    const safeThumbnailUrl = currentThumbnailUrl || snapshot.thumbnailUrl;
    const safeImageUrl =
      currentImageUrl || safeThumbnailUrl || snapshot.imageUrl;

    if (safeIconUrl !== currentIconUrl) {
      form.setValue('iconUrl', safeIconUrl);
    }
    if (safeThumbnailUrl !== currentThumbnailUrl) {
      form.setValue('thumbnailUrl', safeThumbnailUrl);
    }
    if (safeImageUrl !== currentImageUrl) {
      form.setValue('imageUrl', safeImageUrl);
    }
  }, [form]);

  const handleFormSubmit = useCallback(
    (data: ToolFormData) => {
      const thumbnailUrl = normalizeUrlValue(data.thumbnailUrl);
      const imageUrl = normalizeUrlValue(data.imageUrl) || thumbnailUrl;

      onSubmit({
        ...data,
        iconUrl: normalizeUrlValue(data.iconUrl),
        thumbnailUrl,
        imageUrl,
      });
    },
    [onSubmit]
  );

  const handleCloseAutoFillDialog = useCallback(() => {
    autoFillAssetSnapshotRef.current = null;
    setAutoFillState({
      step: 'idle',
      progress: 0,
      error: null,
      completedSteps: [],
      pendingData: undefined,
    });
  }, []);

  const handleFetchBasicInfo = useCallback(() => {
    setFetchError(null);
    setFetchContentError(null);
    const url = form.getValues('url');
    const name = form.getValues('name');
    const referenceContent = form.getValues('referenceContent')?.trim() || '';

    if (referenceContent.length < 50) {
      analyzeAfterFetchRef.current = true;
      fetchUrlContent({ url });
    } else {
      fetchBasicInfo({
        url,
        name,
        referenceContent: referenceContent || undefined,
        availableTags: availableTags.map((tag) => ({
          slug: tag.slug,
          name: tag.name,
          category: tag.category ?? null,
          description: tag.description ?? null,
        })),
      });
    }
  }, [availableTags, fetchBasicInfo, fetchUrlContent, form]);

  const handleGenerateContent = useCallback(async () => {
    setGenerateError(null);
    const url = form.getValues('url');
    let referenceContent = form.getValues('referenceContent')?.trim() ?? '';

    // 参考内容不足时自动抓取
    if (referenceContent.length < 50 && url) {
      try {
        const toolId = tool?.id || submission?.id;
        if (toolId) {
          const saveResult = await fetchAndSaveReferenceAction({
            url,
            toolId,
            autoFetch: true,
          });
          if (!saveResult?.data?.success) {
            toast.error(
              saveResult?.data?.error ||
                '抓取失败，请检查 URL 或手动粘贴参考内容'
            );
            return;
          }
          referenceContent = saveResult.data?.data?.rawContent || '';
        } else {
          const fetchResult = await fetchUrlContentAction({ url });
          if (!fetchResult?.data?.success) {
            toast.error(
              fetchResult?.data?.error ||
                '抓取失败，请检查 URL 或手动粘贴参考内容'
            );
            return;
          }
          referenceContent = fetchResult.data?.data?.content || '';
        }
        form.setValue('referenceContent', referenceContent);
      } catch {
        toast.error('抓取失败，请检查 URL 或手动粘贴参考内容');
        return;
      }
    }

    if (referenceContent.length < 50) {
      toast.error('参考内容不足 50 字，请先抓取网页或手动粘贴参考内容');
      return;
    }

    generateContent({
      name: form.getValues('name'),
      url,
      referenceContent,
      locale: activeTab as
        | 'en'
        | 'zh'
        | 'zh-TW'
        | 'ko'
        | 'ja'
        | 'pt'
        | 'es'
        | 'de'
        | 'fr'
        | 'vi',
    });
  }, [generateContent, form, activeTab, tool, submission]);

  const handleFetchUrlContent = useCallback(() => {
    setFetchContentError(null);
    fetchUrlContent({ url: form.getValues('url') });
  }, [fetchUrlContent, form]);

  /**
   * 一键填充 阶段1：抓取（如有需要）→ 分析信息 → 暂停等待用户确认
   * 有参考内容时直接使用，不重新抓取网页
   */
  const handleAutoFill = useCallback(async () => {
    const url = form.getValues('url');
    const existingContent = form.getValues('referenceContent')?.trim() || '';
    autoFillAssetSnapshotRef.current = {
      iconUrl: normalizeUrlValue(form.getValues('iconUrl')),
      thumbnailUrl: normalizeUrlValue(form.getValues('thumbnailUrl')),
      imageUrl: normalizeUrlValue(form.getValues('imageUrl')),
    };

    if (!url) {
      setAutoFillState((prev) => ({
        ...prev,
        step: 'error',
        error: '请先输入 URL',
      }));
      return;
    }

    setAutoFillState({
      step: existingContent ? 'analyzing' : 'fetching',
      progress: existingContent ? 25 : 5,
      error: null,
      completedSteps: existingContent ? ['使用已有参考内容，跳过抓取'] : [],
    });
    setFetchError(null);
    setGenerateError(null);
    setFetchContentError(null);

    try {
      let referenceContent = existingContent;

      // Step 1: 仅当参考内容不足时抓取网页
      if (!existingContent) {
        const toolId = tool?.id || submission?.id;

        if (toolId) {
          const saveResult = await fetchAndSaveReferenceAction({
            url,
            toolId,
            autoFetch: true,
          });
          if (!saveResult?.data?.success) {
            throw new Error(
              saveResult?.data?.error || '抓取并保存网页内容失败'
            );
          }
          referenceContent = saveResult.data?.data?.rawContent || '';
        } else {
          const fetchResult = await fetchUrlContentAction({ url });
          if (!fetchResult?.data?.success) {
            throw new Error(fetchResult?.data?.error || '抓取网页内容失败');
          }
          referenceContent = fetchResult.data?.data?.content || '';
        }

        form.setValue('referenceContent', referenceContent);

        setAutoFillState((prev) => ({
          ...prev,
          step: 'analyzing',
          progress: 25,
          completedSteps: [...prev.completedSteps, '抓取网页'],
        }));
      }

      // Step 2: 分析基础信息
      const basicInfoResult = await fetchToolBasicInfoAction({
        url,
        name: form.getValues('name') || 'Unknown Tool',
        referenceContent,
        availableTags: availableTags.map((tag) => ({
          slug: tag.slug,
          name: tag.name,
          category: tag.category ?? null,
          description: tag.description ?? null,
        })),
      });

      if (!basicInfoResult?.data?.success) {
        const errData = basicInfoResult?.data as
          | { success: false; error: string }
          | undefined;
        throw new Error(errData?.error || '分析基础信息失败');
      }

      const basicInfo = basicInfoResult.data.data;
      form.setValue('name', basicInfo.name);
      form.setValue('tags', basicInfo.tags);

      // 暂停：等待用户确认后再生成各语言
      setAutoFillState({
        step: 'awaiting-confirmation',
        progress: 40,
        error: null,
        completedSteps: [
          ...(existingContent ? ['使用已有参考内容，跳过抓取'] : ['抓取网页']),
          '分析信息',
        ],
        pendingData: {
          referenceContent,
          basicInfo,
          url,
        },
      });
    } catch (error) {
      setAutoFillState((prev) => ({
        ...prev,
        step: 'error',
        error: error instanceof Error ? error.message : '自动填充失败',
      }));
    } finally {
      restoreProtectedAssets();
    }
  }, [availableTags, form, tool, submission, restoreProtectedAssets]);

  /**
   * 一键填充 阶段2：用户确认后，并行生成所有语言内容
   * 使用表单中的参考内容（用户可能已编辑），不足时回退到待确认数据
   */
  const handleConfirmAndGenerate = useCallback(async () => {
    const pending = autoFillState.pendingData;
    if (!pending || autoFillState.step !== 'awaiting-confirmation') return;

    const { basicInfo, url } = pending;
    const referenceContent =
      form.getValues('referenceContent')?.trim() || pending.referenceContent;
    const toolId = tool?.id || submission?.id;
    const locales = LOCALE_LIST.map((l) => l.code);
    const progressPerLocale = 60 / locales.length;
    let completedCount = 0;
    const failedLocales: string[] = [];

    setAutoFillState((prev) => ({
      ...prev,
      step: 'generating-all',
      progress: 40,
      pendingData: undefined,
    }));

    try {
      await Promise.all(
        locales.map(async (locale) => {
          try {
            const result = await generateToolContentAction({
              name: basicInfo.name,
              url,
              referenceContent,
              locale: locale as
                | 'en'
                | 'zh'
                | 'zh-TW'
                | 'ko'
                | 'ja'
                | 'pt'
                | 'es'
                | 'de'
                | 'fr'
                | 'vi',
            });

            if (result?.data?.success && result.data.data) {
              const content = result.data.data;
              form.setValue(
                `translations.${locale}.title` as any,
                content.title
              );
              form.setValue(
                `translations.${locale}.description` as any,
                content.description
              );
              form.setValue(
                `translations.${locale}.introduction` as any,
                content.introduction
              );

              if (toolId) {
                await saveToolTranslationAction({
                  toolId,
                  locale,
                  title: content.title,
                  description: content.description,
                  introduction: content.introduction,
                });
              }
            } else {
              failedLocales.push(locale);
            }
          } catch {
            failedLocales.push(locale);
          }

          completedCount++;
          setAutoFillState((prev) => ({
            ...prev,
            progress: Math.round(40 + completedCount * progressPerLocale),
            completedSteps: [...prev.completedSteps, locale],
          }));
        })
      );

      const hasFailures = failedLocales.length > 0;
      setAutoFillState((prev) => ({
        step: hasFailures ? 'error' : 'completed',
        progress: 100,
        error: hasFailures
          ? `以下语言生成失败：${failedLocales.join(', ')}`
          : null,
        completedSteps: prev.completedSteps,
      }));

      if (!hasFailures) {
        setTimeout(() => {
          autoFillAssetSnapshotRef.current = null;
          setAutoFillState((prev) => ({ ...prev, step: 'idle' }));
        }, 3000);
      }
    } catch (error) {
      setAutoFillState((prev) => ({
        ...prev,
        step: 'error',
        error: error instanceof Error ? error.message : '生成各语言失败',
      }));
    } finally {
      restoreProtectedAssets();
    }
  }, [
    autoFillState.pendingData,
    autoFillState.step,
    form,
    tool,
    submission,
    restoreProtectedAssets,
  ]);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4">
        {/* 基础信息 */}
        <ToolFormBasicInfo
          form={form}
          mode={mode}
          isSaving={isSaving}
          isLoadingTags={isLoadingTags}
          availableTags={availableTags}
          isFetchingBasic={isFetchingBasic}
          isFetchingContent={isFetchingContent}
          isAutoFilling={isAutoFilling}
          fetchError={fetchError}
          localeCount={LOCALE_LIST.length}
          onFetchBasicInfo={handleFetchBasicInfo}
          onAutoFill={handleAutoFill}
          onFetchUrlContent={handleFetchUrlContent}
        />

        {/* 动态语言 Tabs */}
        <LocaleTabs
          locales={LOCALE_LIST}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          control={form.control}
          isGenerating={isGenerating}
          generateError={generateError}
          onGenerate={handleGenerateContent}
          watchTitle={(code) =>
            form.watch(`translations.${code}.title` as any) ?? ''
          }
        />

        {/* 一键填充进度对话框 */}
        <AutoFillDialog
          state={autoFillState}
          localeCount={LOCALE_LIST.length}
          isAutoFilling={isAutoFilling}
          onClose={handleCloseAutoFillDialog}
          onConfirmAndGenerate={handleConfirmAndGenerate}
        />

        {/* 表单底部按钮 */}
        <div className="flex justify-end gap-2 pt-6 border-t">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              取消
            </Button>
          )}
          <Button type="submit" disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="size-4 mr-2 animate-spin" />
                {mode === 'approve' ? '发布中...' : '保存中...'}
              </>
            ) : mode === 'approve' ? (
              '批准并发布'
            ) : (
              '保存'
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
