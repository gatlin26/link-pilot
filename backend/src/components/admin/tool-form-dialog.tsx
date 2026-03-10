'use client';

import { getPublishedTagsAction } from '@/actions/tags/manage-tags';
import { fetchToolBasicInfoAction } from '@/actions/tools/fetch-tool-basic-info';
import { fetchUrlContentAction } from '@/actions/tools/fetch-url-content';
import { generateToolContentAction } from '@/actions/tools/generate-tool-content';
import { fetchAndSaveReferenceAction } from '@/actions/tools/manage-reference';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  AlertCircle,
  Globe,
  Loader2,
  RefreshCw,
  Sparkles,
  X,
} from 'lucide-react';
import { useAction } from 'next-safe-action/hooks';
import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { type Tag, TagSelector } from './tag-selector';

// 表单模式
export type ToolFormMode = 'create' | 'edit' | 'approve';

// 工具数据类型
export interface ToolData {
  id: string;
  name: string;
  url: string;
  types: string | null;
  categories: string | null;
  tags: string | null;
  featured: boolean | null;
  published: boolean | null;
  referenceContent?: string | null;
  enTitle?: string | null;
  enDescription?: string | null;
  enIntroduction?: string | null;
  zhTitle?: string | null;
  zhDescription?: string | null;
  zhIntroduction?: string | null;
}

// 提交数据类型
export interface SubmissionData {
  id: string;
  name: string;
  url: string;
  description: string | null;
  email: string;
}

// 组件 Props
interface ToolFormDialogProps {
  mode: ToolFormMode;
  tool?: ToolData | null;
  submission?: SubmissionData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave?: (data: ToolFormData) => void;
  onApprove?: (data: ToolFormData) => void;
  onReject?: () => void;
  isSaving?: boolean;
}

// 表单 Schema
const toolFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  url: z.string().url('Valid URL is required'),
  types: z.array(z.string()),
  categories: z.array(z.string()),
  tags: z.array(z.string()),
  featured: z.boolean(),
  published: z.boolean(),
  referenceContent: z.string().optional(),
  enTitle: z.string().min(1, 'English title is required'),
  enDescription: z.string().min(1, 'English description is required'),
  enIntroduction: z.string().min(1, 'English introduction is required'),
  zhTitle: z.string().min(1, 'Chinese title is required'),
  zhDescription: z.string().min(1, 'Chinese description is required'),
  zhIntroduction: z.string().min(1, 'Chinese introduction is required'),
});

export type ToolFormData = z.infer<typeof toolFormSchema>;

/**
 * 获取表单默认值
 */
function getDefaultValues(
  mode: ToolFormMode,
  tool?: ToolData | null,
  submission?: SubmissionData | null
): ToolFormData {
  // 审批模式：从 submission 初始化
  if (mode === 'approve' && submission) {
    return {
      name: submission.name,
      url: submission.url,
      types: [],
      categories: [],
      tags: [],
      featured: false,
      published: true,
      referenceContent: '',
      enTitle: '',
      enDescription: '',
      enIntroduction: '',
      zhTitle: '',
      zhDescription: '',
      zhIntroduction: '',
    };
  }

  // 编辑模式：从 tool 初始化
  if (mode === 'edit' && tool) {
    let types: string[] = [];
    let categories: string[] = [];
    let tags: string[] = [];

    try {
      types = tool.types ? JSON.parse(tool.types) : [];
    } catch {
      types = [];
    }

    try {
      categories = tool.categories ? JSON.parse(tool.categories) : [];
    } catch {
      categories = [];
    }

    try {
      tags = tool.tags ? JSON.parse(tool.tags) : [];
    } catch {
      tags = [];
    }

    return {
      name: tool.name,
      url: tool.url,
      types,
      categories,
      tags,
      featured: tool.featured ?? false,
      published: tool.published ?? true,
      referenceContent: tool.referenceContent ?? '',
      enTitle: tool.enTitle ?? '',
      enDescription: tool.enDescription ?? '',
      enIntroduction: tool.enIntroduction ?? '',
      zhTitle: tool.zhTitle ?? '',
      zhDescription: tool.zhDescription ?? '',
      zhIntroduction: tool.zhIntroduction ?? '',
    };
  }

  // 创建模式：空表单
  return {
    name: '',
    url: '',
    types: [],
    categories: [],
    tags: [],
    featured: false,
    published: true,
    referenceContent: '',
    enTitle: '',
    enDescription: '',
    enIntroduction: '',
    zhTitle: '',
    zhDescription: '',
    zhIntroduction: '',
  };
}

/**
 * 获取对话框标题
 */
function getDialogTitle(mode: ToolFormMode, name?: string): string {
  switch (mode) {
    case 'create':
      return '创建新工具';
    case 'edit':
      return `编辑工具${name ? `: ${name}` : ''}`;
    case 'approve':
      return `审批工具${name ? `: ${name}` : ''}`;
  }
}

/**
 * 获取对话框描述
 */
function getDialogDescription(mode: ToolFormMode): string {
  switch (mode) {
    case 'create':
      return '填写工具信息并生成多语言内容';
    case 'edit':
      return '编辑工具信息和多语言内容';
    case 'approve':
      return '编辑工具信息并生成多语言内容，确认后发布到工具目录';
  }
}

export function ToolFormDialog({
  mode,
  tool,
  submission,
  open,
  onOpenChange,
  onSave,
  onApprove,
  onReject,
  isSaving = false,
}: ToolFormDialogProps) {
  const [activeTab, setActiveTab] = useState<'en' | 'zh'>('en');
  const [newType, setNewType] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [fetchContentError, setFetchContentError] = useState<string | null>(
    null
  );
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);

  const form = useForm<ToolFormData>({
    resolver: zodResolver(toolFormSchema),
    defaultValues: getDefaultValues(mode, tool, submission),
  });

  // 获取已发布的标签列表
  const { execute: fetchTags, status: fetchTagsStatus } = useAction(
    getPublishedTagsAction,
    {
      onSuccess: ({ data }) => {
        if (data?.success && data.data) {
          // 将标签数据转换为 TagSelector 所需的格式
          const tags: Tag[] = data.data.map((tag) => ({
            id: tag.slug, // 使用 slug 作为 id
            slug: tag.slug,
            name: tag.name || tag.slug,
            description: tag.description,
            category: tag.category,
          }));
          setAvailableTags(tags);
        }
      },
    }
  );

  // 当 mode、tool、submission 或 open 变化时重置表单
  useEffect(() => {
    if (open) {
      form.reset(getDefaultValues(mode, tool, submission));
      setFetchError(null);
      setGenerateError(null);
      setFetchContentError(null);
      setActiveTab('en');
      // 获取标签列表
      fetchTags({ locale: 'en' });
    }
  }, [mode, tool, submission, open, form, fetchTags]);

  // 获取基础信息
  const { execute: fetchBasicInfo, status: fetchBasicStatus } = useAction(
    fetchToolBasicInfoAction,
    {
      onSuccess: ({ data }) => {
        setFetchError(null);
        if (data?.success && data.data) {
          const info = data.data;
          form.setValue('name', info.name);
          form.setValue('tags', info.tags);
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

  // 生成多语言内容
  const { execute: generateContent, status: generateStatus } = useAction(
    generateToolContentAction,
    {
      onSuccess: ({ data }) => {
        setGenerateError(null);
        if (data?.success && data.data) {
          const content = data.data;
          if (activeTab === 'en') {
            form.setValue('enTitle', content.title);
            form.setValue('enDescription', content.description);
            form.setValue('enIntroduction', content.introduction);
          } else {
            form.setValue('zhTitle', content.title);
            form.setValue('zhDescription', content.description);
            form.setValue('zhIntroduction', content.introduction);
          }
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

  // 获取 URL 内容
  const { execute: fetchUrlContent, status: fetchContentStatus } = useAction(
    fetchUrlContentAction,
    {
      onSuccess: ({ data }) => {
        setFetchContentError(null);
        if (data?.success && data.data) {
          form.setValue('referenceContent', data.data.content);
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

  const handleFetchBasicInfo = useCallback(() => {
    setFetchError(null);
    const description =
      mode === 'approve' && submission ? submission.description : undefined;
    fetchBasicInfo({
      url: form.getValues('url'),
      name: form.getValues('name'),
      description: description || undefined,
    });
  }, [fetchBasicInfo, form, mode, submission]);

  const handleGenerateContent = useCallback(async () => {
    setGenerateError(null);
    const url = form.getValues('url');
    let referenceContent = form.getValues('referenceContent')?.trim() ?? '';

    // 参考内容不足时自动抓取
    if (referenceContent.length < 50 && url) {
      try {
        const toolId = tool?.id;
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
      locale: activeTab,
    });
  }, [generateContent, form, activeTab, mode, tool?.id]);

  const handleFetchUrlContent = useCallback(() => {
    setFetchContentError(null);
    fetchUrlContent({
      url: form.getValues('url'),
    });
  }, [fetchUrlContent, form]);

  const handleAddType = useCallback(() => {
    if (newType.trim()) {
      const current = form.getValues('types');
      if (!current.includes(newType.trim())) {
        form.setValue('types', [...current, newType.trim()]);
      }
      setNewType('');
    }
  }, [newType, form]);

  const handleRemoveType = useCallback(
    (type: string) => {
      const current = form.getValues('types');
      form.setValue(
        'types',
        current.filter((t) => t !== type)
      );
    },
    [form]
  );

  const handleAddCategory = useCallback(() => {
    if (newCategory.trim()) {
      const current = form.getValues('categories');
      if (!current.includes(newCategory.trim())) {
        form.setValue('categories', [...current, newCategory.trim()]);
      }
      setNewCategory('');
    }
  }, [newCategory, form]);

  const handleRemoveCategory = useCallback(
    (category: string) => {
      const current = form.getValues('categories');
      form.setValue(
        'categories',
        current.filter((c) => c !== category)
      );
    },
    [form]
  );

  const handleSubmit = useCallback(
    (data: ToolFormData) => {
      if (mode === 'approve' && onApprove) {
        onApprove(data);
      } else if (onSave) {
        onSave(data);
      }
    },
    [mode, onApprove, onSave]
  );

  const displayName =
    mode === 'approve' && submission
      ? submission.name
      : mode === 'edit' && tool
        ? tool.name
        : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-none w-screen h-screen max-h-screen rounded-none border-0 p-0 overflow-hidden">
        <div className="h-full overflow-y-auto">
          <div className="max-w-5xl mx-auto p-6 md:p-8 lg:p-10">
            <DialogHeader className="mb-6">
              <DialogTitle className="text-2xl">
                {getDialogTitle(mode, displayName)}
              </DialogTitle>
              <DialogDescription>
                {getDialogDescription(mode)}
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(handleSubmit)}
                className="space-y-6"
              >
                {/* 语言切换 Tab */}
                <Tabs
                  value={activeTab}
                  onValueChange={(v) => setActiveTab(v as 'en' | 'zh')}
                >
                  <TabsList>
                    <TabsTrigger value="en">English</TabsTrigger>
                    <TabsTrigger value="zh">中文</TabsTrigger>
                  </TabsList>

                  {/* 基础信息 - 所有语言共享 */}
                  <div className="mt-6 space-y-4 p-4 rounded-lg border bg-muted/30">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-sm text-muted-foreground">
                        基础信息 (所有语言共享)
                      </h3>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleFetchBasicInfo}
                        disabled={isFetchingBasic}
                      >
                        {isFetchingBasic ? (
                          <Loader2 className="size-4 mr-2 animate-spin" />
                        ) : (
                          <RefreshCw className="size-4 mr-2" />
                        )}
                        分析网站
                      </Button>
                    </div>

                    {/* 基础信息加载提示 */}
                    {isFetchingBasic && (
                      <Alert>
                        <Loader2 className="size-4 animate-spin" />
                        <AlertDescription>
                          AI 正在分析网站，获取工具基础信息...
                        </AlertDescription>
                      </Alert>
                    )}

                    {/* 基础信息错误提示 */}
                    {fetchError && (
                      <Alert variant="destructive">
                        <AlertCircle className="size-4" />
                        <AlertDescription>{fetchError}</AlertDescription>
                      </Alert>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Name</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="url"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>URL</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Types */}
                    <div className="space-y-2">
                      <FormLabel>Types</FormLabel>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {form.watch('types').map((type) => (
                          <Badge key={type} variant="default" className="gap-1">
                            {type}
                            <button
                              type="button"
                              onClick={() => handleRemoveType(type)}
                              className="ml-1 hover:text-destructive"
                            >
                              <X className="size-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Add type..."
                          value={newType}
                          onChange={(e) => setNewType(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddType();
                            }
                          }}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleAddType}
                        >
                          Add
                        </Button>
                      </div>
                    </div>

                    {/* Categories */}
                    <div className="space-y-2">
                      <FormLabel>Categories</FormLabel>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {form.watch('categories').map((category) => (
                          <Badge
                            key={category}
                            variant="secondary"
                            className="gap-1"
                          >
                            {category}
                            <button
                              type="button"
                              onClick={() => handleRemoveCategory(category)}
                              className="ml-1 hover:text-destructive"
                            >
                              <X className="size-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Add category..."
                          value={newCategory}
                          onChange={(e) => setNewCategory(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddCategory();
                            }
                          }}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleAddCategory}
                        >
                          Add
                        </Button>
                      </div>
                    </div>

                    {/* Tags */}
                    <div className="space-y-2">
                      <FormLabel>Tags</FormLabel>
                      <TagSelector
                        selectedTagIds={form.watch('tags')}
                        availableTags={availableTags}
                        onChange={(tagSlugs) => form.setValue('tags', tagSlugs)}
                        disabled={fetchTagsStatus === 'executing'}
                        placeholder={
                          fetchTagsStatus === 'executing'
                            ? 'Loading tags...'
                            : 'Select tags...'
                        }
                      />
                    </div>

                    {/* Featured & Published - 仅在创建和编辑模式显示 */}
                    {(mode === 'create' || mode === 'edit') && (
                      <div className="flex gap-6">
                        <FormField
                          control={form.control}
                          name="featured"
                          render={({ field }) => (
                            <FormItem className="flex items-center gap-2">
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                              <FormLabel className="!mt-0">精选</FormLabel>
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="published"
                          render={({ field }) => (
                            <FormItem className="flex items-center gap-2">
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                              <FormLabel className="!mt-0">已发布</FormLabel>
                            </FormItem>
                          )}
                        />
                      </div>
                    )}
                  </div>

                  {/* 参考内容 - 仅在创建和编辑模式显示 */}
                  {(mode === 'create' || mode === 'edit') && (
                    <div className="mt-4 space-y-4 p-4 rounded-lg border bg-muted/30">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-sm text-muted-foreground">
                          参考内容
                        </h3>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleFetchUrlContent}
                          disabled={isFetchingContent}
                        >
                          {isFetchingContent ? (
                            <Loader2 className="size-4 mr-2 animate-spin" />
                          ) : (
                            <Globe className="size-4 mr-2" />
                          )}
                          获取内容
                        </Button>
                      </div>

                      {isFetchingContent && (
                        <Alert>
                          <Loader2 className="size-4 animate-spin" />
                          <AlertDescription>
                            正在获取网站内容...
                          </AlertDescription>
                        </Alert>
                      )}

                      {fetchContentError && (
                        <Alert variant="destructive">
                          <AlertCircle className="size-4" />
                          <AlertDescription>
                            {fetchContentError}
                          </AlertDescription>
                        </Alert>
                      )}

                      <FormField
                        control={form.control}
                        name="referenceContent"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Textarea
                                {...field}
                                rows={8}
                                placeholder="网站内容将用于 AI 生成更准确的描述..."
                                className="font-mono text-sm"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}

                  {/* 英文内容 */}
                  <TabsContent value="en" className="space-y-4 mt-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">English Content</h3>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleGenerateContent}
                        disabled={isGenerating}
                      >
                        {isGenerating ? (
                          <Loader2 className="size-4 mr-2 animate-spin" />
                        ) : (
                          <Sparkles className="size-4 mr-2" />
                        )}
                        AI Generate
                      </Button>
                    </div>

                    {/* 内容生成加载提示 */}
                    {isGenerating && activeTab === 'en' && (
                      <Alert>
                        <Loader2 className="size-4 animate-spin" />
                        <AlertDescription>
                          AI is analyzing the website and generating English
                          content, this may take 20-30 seconds...
                        </AlertDescription>
                      </Alert>
                    )}

                    {/* 内容生成错误提示 */}
                    {generateError && activeTab === 'en' && (
                      <Alert variant="destructive">
                        <AlertCircle className="size-4" />
                        <AlertDescription>{generateError}</AlertDescription>
                      </Alert>
                    )}

                    <FormField
                      control={form.control}
                      name="enTitle"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Title (SEO)</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="e.g., ChatGPT: Powerful AI Chat Assistant"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="enDescription"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description (Meta)</FormLabel>
                          <FormControl>
                            <Textarea
                              {...field}
                              rows={2}
                              placeholder="Brief description for search results..."
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="enIntroduction"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Introduction (Markdown)</FormLabel>
                          <FormControl>
                            <Textarea
                              {...field}
                              rows={12}
                              placeholder="## What is {Tool Name}?&#10;&#10;Detailed introduction..."
                              className="font-mono text-sm"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </TabsContent>

                  {/* 中文内容 */}
                  <TabsContent value="zh" className="space-y-4 mt-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">中文内容</h3>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleGenerateContent}
                        disabled={isGenerating}
                      >
                        {isGenerating ? (
                          <Loader2 className="size-4 mr-2 animate-spin" />
                        ) : (
                          <Sparkles className="size-4 mr-2" />
                        )}
                        AI 生成
                      </Button>
                    </div>

                    {/* 内容生成加载提示 */}
                    {isGenerating && activeTab === 'zh' && (
                      <Alert>
                        <Loader2 className="size-4 animate-spin" />
                        <AlertDescription>
                          AI 正在分析网站并生成中文内容，这可能需要 20-30 秒...
                        </AlertDescription>
                      </Alert>
                    )}

                    {/* 内容生成错误提示 */}
                    {generateError && activeTab === 'zh' && (
                      <Alert variant="destructive">
                        <AlertCircle className="size-4" />
                        <AlertDescription>{generateError}</AlertDescription>
                      </Alert>
                    )}

                    <FormField
                      control={form.control}
                      name="zhTitle"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>标题 (SEO)</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="例如: ChatGPT: 强大的 AI 对话助手"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="zhDescription"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>描述 (Meta)</FormLabel>
                          <FormControl>
                            <Textarea
                              {...field}
                              rows={2}
                              placeholder="用于搜索结果的简短描述..."
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="zhIntroduction"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>详细介绍 (Markdown)</FormLabel>
                          <FormControl>
                            <Textarea
                              {...field}
                              rows={12}
                              placeholder="### 什么是 {工具名称}?&#10;&#10;详细介绍..."
                              className="font-mono text-sm"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </TabsContent>
                </Tabs>

                <DialogFooter className="gap-2 pt-6 border-t mt-8">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                  >
                    取消
                  </Button>
                  {mode === 'approve' && onReject && (
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={onReject}
                    >
                      拒绝
                    </Button>
                  )}
                  <Button
                    type="submit"
                    disabled={isSaving}
                    className={
                      mode === 'approve'
                        ? 'bg-green-600 hover:bg-green-700'
                        : ''
                    }
                  >
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
                </DialogFooter>
              </form>
            </Form>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
