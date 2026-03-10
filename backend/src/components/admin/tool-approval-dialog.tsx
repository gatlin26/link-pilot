'use client';

import {
  captureAndSaveScreenshotsAction,
  retryScreenshotAction,
} from '@/actions/tools/capture-screenshots';
import { fetchToolBasicInfoAction } from '@/actions/tools/fetch-tool-basic-info';
import { fetchUrlContentAction } from '@/actions/tools/fetch-url-content';
import { generateToolContentAction } from '@/actions/tools/generate-tool-content';
import { fetchAndSaveReferenceAction } from '@/actions/tools/manage-reference';
import { ImageUploader } from '@/components/admin/image-uploader';
import { LogoUploader } from '@/components/admin/logo-uploader';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { AlertCircle, Loader2, RefreshCw, Sparkles, X } from 'lucide-react';
import { useAction } from 'next-safe-action/hooks';
import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

interface Submission {
  id: string;
  name: string;
  url: string;
  slug: string;
  status: string;
  submitterEmail: string | null;
  iconUrl?: string | null;
  thumbnailUrl?: string | null;
  description?: string | null;
}

interface ToolApprovalDialogProps {
  submission: Submission;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApprove: (data: ApprovalFormData) => void;
  onReject: () => void;
  isApproving?: boolean;
}

const approvalFormSchema = z.object({
  // 基础信息
  name: z.string().min(1, 'Name is required'),
  url: z.string().url('Valid URL is required'),
  categories: z.array(z.string()),
  tags: z.array(z.string()),
  // 英文内容
  enTitle: z.string().min(1, 'English title is required'),
  enDescription: z.string().min(1, 'English description is required'),
  enIntroduction: z.string().min(1, 'English introduction is required'),
  // 中文内容
  zhTitle: z.string().min(1, 'Chinese title is required'),
  zhDescription: z.string().min(1, 'Chinese description is required'),
  zhIntroduction: z.string().min(1, 'Chinese introduction is required'),
});

export type ApprovalFormData = z.infer<typeof approvalFormSchema>;

/**
 * 获取表单默认值
 */
function getDefaultValues(submission: Submission): ApprovalFormData {
  return {
    name: submission.name,
    url: submission.url,
    categories: [],
    tags: [],
    enTitle: '',
    enDescription: '',
    enIntroduction: '',
    zhTitle: '',
    zhDescription: '',
    zhIntroduction: '',
  };
}

export function ToolApprovalDialog({
  submission,
  open,
  onOpenChange,
  onApprove,
  onReject,
  isApproving = false,
}: ToolApprovalDialogProps) {
  const [activeTab, setActiveTab] = useState<'en' | 'zh'>('en');
  const [newCategory, setNewCategory] = useState('');
  const [newTag, setNewTag] = useState('');
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // 截图相关状态
  const [screenshotStatus, setScreenshotStatus] = useState<{
    logo: 'idle' | 'loading' | 'success' | 'error';
    thumbnail: 'idle' | 'loading' | 'success' | 'error';
  }>({
    logo: 'idle',
    thumbnail: 'idle',
  });

  const [screenshotUrls, setScreenshotUrls] = useState<{
    iconUrl: string | null;
    thumbnailUrl: string | null;
  }>({
    iconUrl: null,
    thumbnailUrl: null,
  });

  const [screenshotError, setScreenshotError] = useState<string | null>(null);

  // 手动截图相关状态
  const [manualScreenshotUrl, setManualScreenshotUrl] = useState('');
  const [isManualScreenshotting, setIsManualScreenshotting] = useState(false);

  const form = useForm<ApprovalFormData>({
    resolver: zodResolver(approvalFormSchema),
    defaultValues: getDefaultValues(submission),
  });

  // 当 submission 或 open 变化时重置表单
  useEffect(() => {
    if (open) {
      form.reset(getDefaultValues(submission));
      setFetchError(null);
      setGenerateError(null);
      setActiveTab('en');
      setScreenshotError(null);
      setScreenshotStatus({ logo: 'idle', thumbnail: 'idle' });
      setManualScreenshotUrl(submission.url); // 初始化为当前工具的 URL

      // 从 submission 加载已有的截图
      const existingIconUrl = submission.iconUrl || null;
      const existingThumbnailUrl = submission.thumbnailUrl || null;
      setScreenshotUrls({
        iconUrl: existingIconUrl,
        thumbnailUrl: existingThumbnailUrl,
      });

      // 自动保存参考内容
      fetchAndSaveReferenceAction({
        toolId: submission.id,
        url: submission.url,
        autoFetch: true,
      });

      // 只有在没有截图时才自动获取
      if (!existingIconUrl || !existingThumbnailUrl) {
        setScreenshotStatus({
          logo: existingIconUrl ? 'success' : 'loading',
          thumbnail: existingThumbnailUrl ? 'success' : 'loading',
        });

        captureAndSaveScreenshotsAction({
          toolId: submission.id,
          url: submission.url,
          skipIfExists: true,
        }).then((result) => {
          if (result?.data?.success) {
            const data = result?.data?.data;
            setScreenshotUrls({
              iconUrl: data?.iconUrl || existingIconUrl,
              thumbnailUrl: data?.thumbnailUrl || existingThumbnailUrl,
            });
            setScreenshotStatus({
              logo: data?.iconUrl || existingIconUrl ? 'success' : 'error',
              thumbnail:
                data?.thumbnailUrl || existingThumbnailUrl
                  ? 'success'
                  : 'error',
            });
          } else {
            setScreenshotError(result?.data?.error || '截图失败');
            setScreenshotStatus({
              logo: existingIconUrl ? 'success' : 'error',
              thumbnail: existingThumbnailUrl ? 'success' : 'error',
            });
          }
        });
      } else {
        // 已有截图，设置为成功状态
        setScreenshotStatus({ logo: 'success', thumbnail: 'success' });
      }
    }
  }, [submission, open, form]);

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

  const isFetchingBasic = fetchBasicStatus === 'executing';
  const isGenerating = generateStatus === 'executing';

  const handleFetchBasicInfo = useCallback(() => {
    setFetchError(null);
    fetchBasicInfo({
      url: form.getValues('url'),
      name: form.getValues('name'),
      description: submission.description || undefined,
    });
  }, [fetchBasicInfo, form, submission.description]);

  const handleGenerateContent = useCallback(async () => {
    setGenerateError(null);
    const url = form.getValues('url');
    let referenceContent = '';

    // 审批弹窗无 referenceContent 字段，始终从 URL 自动抓取
    try {
      const saveResult = await fetchAndSaveReferenceAction({
        url,
        toolId: submission.id,
        autoFetch: true,
      });
      if (saveResult?.data?.success && saveResult.data?.data?.rawContent) {
        referenceContent = saveResult.data.data.rawContent;
      }
      if (referenceContent.length < 50) {
        const fetchResult = await fetchUrlContentAction({ url });
        if (!fetchResult?.data?.success) {
          toast.error(fetchResult?.data?.error || '抓取失败，请检查 URL');
          return;
        }
        referenceContent = fetchResult.data?.data?.content || '';
      }
    } catch {
      try {
        const fetchResult = await fetchUrlContentAction({ url });
        if (!fetchResult?.data?.success) {
          toast.error(fetchResult?.data?.error || '抓取失败，请检查 URL');
          return;
        }
        referenceContent = fetchResult.data?.data?.content || '';
      } catch {
        toast.error('抓取失败，请检查 URL');
        return;
      }
    }

    if (referenceContent.length < 50) {
      toast.error('抓取内容不足 50 字，无法生成');
      return;
    }

    generateContent({
      name: form.getValues('name'),
      url,
      referenceContent,
      locale: activeTab,
    });
  }, [generateContent, form, submission.id, activeTab]);

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
    (data: ApprovalFormData) => {
      onApprove(data);
    },
    [onApprove]
  );

  const handleRetryScreenshots = useCallback(() => {
    setScreenshotError(null);
    setScreenshotStatus({ logo: 'loading', thumbnail: 'loading' });

    captureAndSaveScreenshotsAction({
      toolId: submission.id,
      url: submission.url,
      skipIfExists: false, // 强制重新截图
    }).then((result) => {
      if (result?.data?.success) {
        const data = result?.data?.data;
        setScreenshotUrls({
          iconUrl: data?.iconUrl || null,
          thumbnailUrl: data?.thumbnailUrl || null,
        });
        setScreenshotStatus({
          logo: data?.iconUrl ? 'success' : 'error',
          thumbnail: data?.thumbnailUrl ? 'success' : 'error',
        });
      } else {
        setScreenshotError(result?.data?.error || '截图失败');
        setScreenshotStatus({ logo: 'error', thumbnail: 'error' });
      }
    });
  }, [submission]);

  const handleRetryLogo = useCallback(() => {
    setScreenshotError(null);
    setScreenshotStatus((prev) => ({ ...prev, logo: 'loading' }));

    retryScreenshotAction({
      toolId: submission.id,
      url: submission.url,
      type: 'logo',
    }).then((result) => {
      if (result?.data?.success && result?.data?.data) {
        setScreenshotUrls((prev) => ({
          ...prev,
          iconUrl: result?.data?.data?.url || null,
        }));
        setScreenshotStatus((prev) => ({
          ...prev,
          logo: result?.data?.data?.url ? 'success' : 'error',
        }));
      } else {
        setScreenshotError(result?.data?.error || 'Logo 获取失败');
        setScreenshotStatus((prev) => ({ ...prev, logo: 'error' }));
      }
    });
  }, [submission]);

  const handleRetryThumbnail = useCallback(() => {
    setScreenshotError(null);
    setScreenshotStatus((prev) => ({ ...prev, thumbnail: 'loading' }));

    retryScreenshotAction({
      toolId: submission.id,
      url: submission.url,
      type: 'thumbnail',
    }).then((result) => {
      if (result?.data?.success && result?.data?.data) {
        setScreenshotUrls((prev) => ({
          ...prev,
          thumbnailUrl: result?.data?.data?.url || null,
        }));
        setScreenshotStatus((prev) => ({
          ...prev,
          thumbnail: result?.data?.data?.url ? 'success' : 'error',
        }));
      } else {
        setScreenshotError(result?.data?.error || '缩略图获取失败');
        setScreenshotStatus((prev) => ({ ...prev, thumbnail: 'error' }));
      }
    });
  }, [submission]);

  // 手动截图处理函数
  const handleManualScreenshot = useCallback(() => {
    // 防止重复请求
    if (isManualScreenshotting) {
      return;
    }

    const trimmedUrl = manualScreenshotUrl.trim();

    // 验证 URL 是否为空
    if (!trimmedUrl) {
      setScreenshotError('请输入网站 URL');
      return;
    }

    // 验证 URL 格式和协议
    try {
      const urlObj = new URL(trimmedUrl);
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        setScreenshotError('URL 必须以 http:// 或 https:// 开头');
        return;
      }
    } catch {
      setScreenshotError(
        'URL 格式不正确，请输入完整的网址（例如：https://example.com）'
      );
      return;
    }

    setScreenshotError(null);
    setIsManualScreenshotting(true);
    setScreenshotStatus({ logo: 'loading', thumbnail: 'loading' });

    captureAndSaveScreenshotsAction({
      toolId: submission.id,
      url: trimmedUrl, // 使用 trim 后的 URL
      skipIfExists: false, // 强制重新截图
    })
      .then((result) => {
        if (result?.data?.success) {
          const data = result?.data?.data;
          const hasIcon = !!data?.iconUrl;
          const hasThumbnail = !!data?.thumbnailUrl;

          setScreenshotUrls({
            iconUrl: data?.iconUrl || null,
            thumbnailUrl: data?.thumbnailUrl || null,
          });

          setScreenshotStatus({
            logo: hasIcon ? 'success' : 'error',
            thumbnail: hasThumbnail ? 'success' : 'error',
          });

          // 提供更详细的反馈
          if (hasIcon && hasThumbnail) {
            // 全部成功，不显示错误
            setScreenshotError(null);
          } else if (hasIcon && !hasThumbnail) {
            setScreenshotError('Logo 截取成功，但缩略图截取失败');
          } else if (!hasIcon && hasThumbnail) {
            setScreenshotError('缩略图截取成功，但 Logo 截取失败');
          } else {
            setScreenshotError('截图失败，请检查 URL 是否可访问');
          }
        } else {
          setScreenshotError(result?.data?.error || '截图失败，请稍后重试');
          setScreenshotStatus({ logo: 'error', thumbnail: 'error' });
        }
      })
      .catch((error) => {
        console.error('手动截图异常:', error);
        setScreenshotError('截图过程中发生异常，请稍后重试');
        setScreenshotStatus({ logo: 'error', thumbnail: 'error' });
      })
      .finally(() => {
        setIsManualScreenshotting(false);
      });
  }, [manualScreenshotUrl, submission.id, isManualScreenshotting]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-none w-screen h-screen max-h-screen rounded-none border-0 p-0 overflow-hidden">
        <div className="h-full overflow-y-auto">
          <div className="max-w-5xl mx-auto p-6 md:p-8 lg:p-10">
            <DialogHeader className="mb-6">
              <DialogTitle className="text-2xl">
                审批工具: {submission.name}
              </DialogTitle>
              <DialogDescription>
                编辑工具信息并生成多语言内容，确认后发布到工具目录
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
                  </div>

                  {/* 截图预览区域 */}
                  <div className="mt-6 space-y-4 p-4 rounded-lg border bg-muted/30">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-sm text-muted-foreground">
                        自动截图
                      </h3>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleRetryScreenshots}
                        disabled={screenshotStatus.logo === 'loading'}
                      >
                        {screenshotStatus.logo === 'loading' ? (
                          <Loader2 className="size-4 mr-2 animate-spin" />
                        ) : (
                          <RefreshCw className="size-4 mr-2" />
                        )}
                        重新截图
                      </Button>
                    </div>

                    {/* 加载状态 */}
                    {screenshotStatus.logo === 'loading' && (
                      <Alert>
                        <Loader2 className="size-4 animate-spin" />
                        <AlertDescription>
                          正在自动截取网站 Logo 和缩略图...
                        </AlertDescription>
                      </Alert>
                    )}

                    {/* 错误提示 */}
                    {screenshotError && (
                      <Alert variant="destructive">
                        <AlertCircle className="size-4" />
                        <AlertDescription>
                          {screenshotError}
                          <br />
                          <span className="text-sm">
                            您可以手动上传图片或重新截图
                          </span>
                        </AlertDescription>
                      </Alert>
                    )}

                    {/* 截图预览 */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Logo</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={handleRetryLogo}
                            disabled={screenshotStatus.logo === 'loading'}
                            className="h-7 text-xs"
                          >
                            {screenshotStatus.logo === 'loading' ? (
                              <Loader2 className="size-3 mr-1 animate-spin" />
                            ) : (
                              <RefreshCw className="size-3 mr-1" />
                            )}
                            获取 Logo
                          </Button>
                        </div>
                        {screenshotUrls.iconUrl?.trim() ? (
                          <img
                            src={screenshotUrls.iconUrl}
                            alt="Logo"
                            className="w-32 h-32 object-contain border rounded"
                          />
                        ) : (
                          <div className="w-32 h-32 border rounded flex items-center justify-center text-muted-foreground">
                            无 Logo
                          </div>
                        )}
                        {/* 手动上传选项 */}
                        <LogoUploader
                          value={screenshotUrls.iconUrl || ''}
                          onChange={(url) =>
                            setScreenshotUrls((prev) => ({
                              ...prev,
                              iconUrl: url,
                            }))
                          }
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">缩略图</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={handleRetryThumbnail}
                            disabled={screenshotStatus.thumbnail === 'loading'}
                            className="h-7 text-xs"
                          >
                            {screenshotStatus.thumbnail === 'loading' ? (
                              <Loader2 className="size-3 mr-1 animate-spin" />
                            ) : (
                              <RefreshCw className="size-3 mr-1" />
                            )}
                            获取缩略图
                          </Button>
                        </div>
                        {screenshotUrls.thumbnailUrl?.trim() ? (
                          <img
                            src={screenshotUrls.thumbnailUrl}
                            alt="Thumbnail"
                            className="w-full h-32 object-cover border rounded"
                          />
                        ) : (
                          <div className="w-full h-32 border rounded flex items-center justify-center text-muted-foreground">
                            无缩略图
                          </div>
                        )}
                        {/* 手动上传选项 */}
                        <ImageUploader
                          value={screenshotUrls.thumbnailUrl || ''}
                          onChange={(url) =>
                            setScreenshotUrls((prev) => ({
                              ...prev,
                              thumbnailUrl: url,
                            }))
                          }
                          folder="screenshots"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 手动截图区域 */}
                  <div className="mt-6 space-y-4 p-4 rounded-lg border bg-muted/30">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-sm text-muted-foreground">
                        手动截图
                      </h3>
                    </div>

                    <div className="space-y-3">
                      <label
                        htmlFor="manual-screenshot-url"
                        className="text-sm text-muted-foreground block"
                      >
                        输入网站 URL，系统将自动截取 Logo 和缩略图
                      </label>

                      <div className="flex gap-2">
                        <Input
                          id="manual-screenshot-url"
                          placeholder="输入网站 URL，例如: https://example.com"
                          value={manualScreenshotUrl}
                          onChange={(e) =>
                            setManualScreenshotUrl(e.target.value)
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleManualScreenshot();
                            }
                          }}
                          disabled={isManualScreenshotting}
                          className="flex-1"
                          aria-label="手动截图 URL"
                          aria-describedby="manual-screenshot-description"
                        />
                        <Button
                          type="button"
                          variant="default"
                          onClick={handleManualScreenshot}
                          disabled={
                            isManualScreenshotting ||
                            !manualScreenshotUrl.trim()
                          }
                          title={
                            isManualScreenshotting
                              ? '正在截图中，请稍候...'
                              : !manualScreenshotUrl.trim()
                                ? '请先输入 URL'
                                : '点击开始截图'
                          }
                        >
                          {isManualScreenshotting ? (
                            <>
                              <Loader2 className="size-4 mr-2 animate-spin" />
                              截图中...
                            </>
                          ) : (
                            '手动截图'
                          )}
                        </Button>
                      </div>
                      <span
                        id="manual-screenshot-description"
                        className="sr-only"
                      >
                        输入完整的网站 URL，包括 http:// 或 https:// 前缀
                      </span>
                    </div>
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
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={onReject}
                  >
                    拒绝
                  </Button>
                  <Button
                    type="submit"
                    disabled={isApproving}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {isApproving ? (
                      <>
                        <Loader2 className="size-4 mr-2 animate-spin" />
                        发布中...
                      </>
                    ) : (
                      '批准并发布'
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
