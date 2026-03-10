'use client';

import { fetchToolBasicInfoAction } from '@/actions/tools/fetch-tool-basic-info';
import { fetchUrlContentAction } from '@/actions/tools/fetch-url-content';
import { generateToolContentAction } from '@/actions/tools/generate-tool-content';
import { fetchAndSaveReferenceAction } from '@/actions/tools/manage-reference';
import { ImageUploader } from '@/components/admin/image-uploader';
import { LogoUploader } from '@/components/admin/logo-uploader';
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
import { useTranslations } from 'next-intl';
import { useAction } from 'next-safe-action/hooks';
import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

export interface ToolData {
  id: string;
  name: string;
  url: string;
  tags: string | null;
  featured: boolean | null;
  published: boolean | null;
  referenceContent?: string | null;
  iconUrl?: string | null;
  thumbnailUrl?: string | null;
  imageUrl?: string | null;
  enTitle?: string | null;
  enDescription?: string | null;
  enIntroduction?: string | null;
  zhTitle?: string | null;
  zhDescription?: string | null;
  zhIntroduction?: string | null;
}

interface ToolEditDialogProps {
  tool?: ToolData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: ToolFormData) => void;
  isSaving?: boolean;
}

const toolFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  url: z.string().url('Valid URL is required'),
  tags: z.array(z.string()),
  featured: z.boolean(),
  published: z.boolean(),
  referenceContent: z.string().optional(),
  iconUrl: z.string().url().optional().nullable(),
  thumbnailUrl: z.string().url().optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  enTitle: z.string().min(1, 'English title is required'),
  enDescription: z.string().min(1, 'English description is required'),
  enIntroduction: z.string().min(1, 'English introduction is required'),
  zhTitle: z.string().min(1, 'Chinese title is required'),
  zhDescription: z.string().min(1, 'Chinese description is required'),
  zhIntroduction: z.string().min(1, 'Chinese introduction is required'),
});

export type ToolFormData = z.infer<typeof toolFormSchema>;

function getDefaultValues(tool?: ToolData | null): ToolFormData {
  if (!tool) {
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
      enTitle: '',
      enDescription: '',
      enIntroduction: '',
      zhTitle: '',
      zhDescription: '',
      zhIntroduction: '',
    };
  }

  let tags: string[] = [];

  try {
    tags = tool.tags ? JSON.parse(tool.tags) : [];
  } catch {
    tags = [];
  }

  return {
    name: tool.name,
    url: tool.url,
    tags,
    featured: tool.featured ?? false,
    published: tool.published ?? true,
    referenceContent: tool.referenceContent ?? '',
    iconUrl: tool.iconUrl ?? null,
    thumbnailUrl: tool.thumbnailUrl ?? null,
    imageUrl: tool.imageUrl ?? null,
    enTitle: tool.enTitle ?? '',
    enDescription: tool.enDescription ?? '',
    enIntroduction: tool.enIntroduction ?? '',
    zhTitle: tool.zhTitle ?? '',
    zhDescription: tool.zhDescription ?? '',
    zhIntroduction: tool.zhIntroduction ?? '',
  };
}

export function ToolEditDialog({
  tool,
  open,
  onOpenChange,
  onSave,
  isSaving = false,
}: ToolEditDialogProps) {
  const t = useTranslations('Dashboard.admin.tools');
  const [activeTab, setActiveTab] = useState<'en' | 'zh'>('en');
  const [newTag, setNewTag] = useState('');
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [fetchContentError, setFetchContentError] = useState<string | null>(
    null
  );

  const isEditMode = !!tool;

  const form = useForm<ToolFormData>({
    resolver: zodResolver(toolFormSchema),
    defaultValues: getDefaultValues(tool),
  });

  useEffect(() => {
    if (open) {
      form.reset(getDefaultValues(tool));
      setFetchError(null);
      setGenerateError(null);
      setFetchContentError(null);
      setActiveTab('en');
    }
  }, [tool, open, form]);

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
    fetchBasicInfo({
      url: form.getValues('url'),
      name: form.getValues('name'),
    });
  }, [fetchBasicInfo, form]);

  const handleGenerateContent = useCallback(async () => {
    setGenerateError(null);
    const url = form.getValues('url');
    let referenceContent = form.getValues('referenceContent')?.trim() ?? '';

    // 参考内容不足时自动抓取
    if (referenceContent.length < 50 && url && tool?.id) {
      try {
        const saveResult = await fetchAndSaveReferenceAction({
          url,
          toolId: tool.id,
          autoFetch: true,
        });
        if (!saveResult?.data?.success) {
          toast.error(
            saveResult?.data?.error || '抓取失败，请检查 URL 或手动粘贴参考内容'
          );
          return;
        }
        referenceContent = saveResult.data?.data?.rawContent || '';
        form.setValue('referenceContent', referenceContent);
      } catch {
        toast.error('抓取失败，请检查 URL 或手动粘贴参考内容');
        return;
      }
    } else if (referenceContent.length < 50 && url) {
      try {
        const fetchResult = await fetchUrlContentAction({ url });
        if (!fetchResult?.data?.success) {
          toast.error(
            fetchResult?.data?.error ||
              '抓取失败，请检查 URL 或手动粘贴参考内容'
          );
          return;
        }
        referenceContent = fetchResult.data?.data?.content || '';
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
  }, [generateContent, form, activeTab, tool?.id]);

  const handleFetchUrlContent = useCallback(() => {
    setFetchContentError(null);
    fetchUrlContent({
      url: form.getValues('url'),
    });
  }, [fetchUrlContent, form]);

  const handleAddTag = useCallback(() => {
    if (newTag.trim()) {
      const current = form.getValues('tags');
      if (!current.includes(newTag.trim())) {
        form.setValue('tags', [...current, newTag.trim()]);
      }
      setNewTag('');
    }
  }, [newTag, form]);

  const handleRemoveTag = useCallback(
    (tag: string) => {
      const current = form.getValues('tags');
      form.setValue(
        'tags',
        current.filter((t) => t !== tag)
      );
    },
    [form]
  );

  const handleSubmit = useCallback(
    (data: ToolFormData) => {
      onSave(data);
    },
    [onSave]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? t('editDialog.titleEdit') : t('editDialog.titleAdd')}
          </DialogTitle>
          <DialogDescription>
            {isEditMode
              ? t('editDialog.descriptionEdit')
              : t('editDialog.descriptionAdd')}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-6"
          >
            <Tabs
              value={activeTab}
              onValueChange={(v) => setActiveTab(v as 'en' | 'zh')}
            >
              <TabsList>
                <TabsTrigger value="en">English</TabsTrigger>
                <TabsTrigger value="zh">中文</TabsTrigger>
              </TabsList>

              {/* 基础信息 */}
              <div className="mt-6 space-y-4 p-4 rounded-lg border bg-muted/30">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm text-muted-foreground">
                    {t('editDialog.basicInfo')}
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
                    {t('editDialog.analyzeWebsite')}
                  </Button>
                </div>

                {isFetchingBasic && (
                  <Alert>
                    <Loader2 className="size-4 animate-spin" />
                    <AlertDescription>
                      {t('editDialog.analyzing')}
                    </AlertDescription>
                  </Alert>
                )}

                {fetchError && (
                  <Alert variant="destructive">
                    <AlertCircle className="size-4" />
                    <AlertDescription>{fetchError}</AlertDescription>
                  </Alert>
                )}

                {/* Name 和 URL 并列 */}
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

                {/* Tags */}
                <div className="space-y-2">
                  <FormLabel>Tags</FormLabel>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {form.watch('tags').map((tag) => (
                      <Badge key={tag} variant="outline" className="gap-1">
                        #{tag}
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(tag)}
                          className="ml-1 hover:text-destructive"
                        >
                          <X className="size-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add tag..."
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddTag();
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleAddTag}
                    >
                      Add
                    </Button>
                  </div>
                </div>

                {/* Featured & Published */}
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
                        <FormLabel className="!mt-0">
                          {t('editDialog.featuredLabel')}
                        </FormLabel>
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
                        <FormLabel className="!mt-0">
                          {t('editDialog.publishedLabel')}
                        </FormLabel>
                      </FormItem>
                    )}
                  />
                </div>

                {/* Logo 和主图并列上传 */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="iconUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Logo</FormLabel>
                        <FormControl>
                          <LogoUploader
                            value={field.value}
                            onChange={field.onChange}
                            disabled={isSaving}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="thumbnailUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>主图 (Main Image)</FormLabel>
                        <FormControl>
                          <ImageUploader
                            value={field.value}
                            onChange={(url) => {
                              // 同时设置 thumbnailUrl 和 imageUrl
                              field.onChange(url);
                              form.setValue('imageUrl', url);
                            }}
                            disabled={isSaving}
                            folder="screenshots"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* 参考内容 */}
              <div className="mt-4 space-y-4 p-4 rounded-lg border bg-muted/30">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm text-muted-foreground">
                    {t('editDialog.referenceContent')}
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
                    {t('editDialog.fetchContent')}
                  </Button>
                </div>

                {isFetchingContent && (
                  <Alert>
                    <Loader2 className="size-4 animate-spin" />
                    <AlertDescription>
                      {t('editDialog.fetchingContent')}
                    </AlertDescription>
                  </Alert>
                )}

                {fetchContentError && (
                  <Alert variant="destructive">
                    <AlertCircle className="size-4" />
                    <AlertDescription>{fetchContentError}</AlertDescription>
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
                          placeholder={t(
                            'editDialog.referenceContentPlaceholder'
                          )}
                          className="font-mono text-sm"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

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
                    {t('editDialog.generateContent')}
                  </Button>
                </div>

                {isGenerating && activeTab === 'en' && (
                  <Alert>
                    <Loader2 className="size-4 animate-spin" />
                    <AlertDescription>
                      {t('editDialog.generating')}
                    </AlertDescription>
                  </Alert>
                )}

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
                    {t('editDialog.generateContent')}
                  </Button>
                </div>

                {isGenerating && activeTab === 'zh' && (
                  <Alert>
                    <Loader2 className="size-4 animate-spin" />
                    <AlertDescription>
                      {t('editDialog.generating')}
                    </AlertDescription>
                  </Alert>
                )}

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

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                {t('editDialog.cancel')}
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="size-4 mr-2 animate-spin" />
                    {t('editDialog.saving')}
                  </>
                ) : (
                  t('editDialog.save')
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
