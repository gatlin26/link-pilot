'use client';

import {
  autofillTagTranslationsAction,
  updateTagBatchAction,
} from '@/actions/tags/manage-tags';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { websiteConfig } from '@/config/website';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, Check, Loader2, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useAction } from 'next-safe-action/hooks';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

// 所有支持的语言列表
const LOCALE_LIST = Object.entries(websiteConfig.i18n.locales).map(
  ([code, info]) => ({ code, ...info })
);

const tagEditFormSchema = z.object({
  slug: z.string().min(1),
  category: z.string().optional().nullable(),
  status: z.enum(['draft', 'published', 'archived']),
  referenceContent: z.string().optional(),
  translations: z.record(
    z.string(),
    z.object({
      name: z.string().optional(),
      description: z.string().optional(),
      content: z.string().optional(),
    })
  ),
});

type TagEditFormData = z.infer<typeof tagEditFormSchema>;

interface GroupedTag {
  slug: string;
  category: string | null;
  status: string | null;
  sortOrder: number;
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
  translations: {
    locale: string | null;
    id: string | null;
    name: string | null;
    description: string | null;
    content: string | null;
  }[];
}

interface TagEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tag: GroupedTag | null;
  onSuccess?: () => void;
}

export function TagEditDialog({
  open,
  onOpenChange,
  tag,
  onSuccess,
}: TagEditDialogProps) {
  const t = useTranslations('Dashboard.admin.tags');
  const [activeTab, setActiveTab] = useState(LOCALE_LIST[0].code);
  const [autofillError, setAutofillError] = useState<string | null>(null);

  const form = useForm<TagEditFormData>({
    resolver: zodResolver(tagEditFormSchema),
    defaultValues: {
      slug: '',
      category: 'general',
      status: 'published',
      referenceContent: '',
      translations: Object.fromEntries(
        LOCALE_LIST.map((l) => [
          l.code,
          { name: '', description: '', content: '' },
        ])
      ),
    },
  });

  const { execute: updateTag, status } = useAction(updateTagBatchAction, {
    onSuccess: ({ data }) => {
      if (data?.success) {
        toast.success(t('toast.updateSuccess'));
        onOpenChange(false);
        onSuccess?.();
      } else {
        toast.error(data?.error || t('toast.error'));
      }
    },
    onError: ({ error }) => {
      toast.error(
        typeof error.serverError === 'string'
          ? error.serverError
          : t('toast.error')
      );
    },
  });

  const { execute: autofillTranslations, status: autofillStatus } = useAction(
    autofillTagTranslationsAction,
    {
      onSuccess: ({ data }) => {
        setAutofillError(null);
        if (data?.success && data.data) {
          const { mergedTranslations, referenceContent, summary } = data.data;
          if (referenceContent) {
            form.setValue('referenceContent', referenceContent);
          }
          // 回填到表单
          for (const trans of mergedTranslations) {
            if (trans.name) {
              form.setValue(
                `translations.${trans.locale}.name` as any,
                trans.name
              );
            }
            if (trans.description) {
              form.setValue(
                `translations.${trans.locale}.description` as any,
                trans.description
              );
            }
            if (trans.content) {
              form.setValue(
                `translations.${trans.locale}.content` as any,
                trans.content
              );
            }
          }
          toast.success(summary || t('toast.autofillSuccess'));
        } else {
          setAutofillError(data?.error || t('toast.autofillError'));
        }
      },
      onError: ({ error }) => {
        setAutofillError(
          typeof error.serverError === 'string'
            ? error.serverError
            : t('toast.autofillError')
        );
      },
    }
  );

  const isSubmitting = status === 'executing';
  const isAutofilling = autofillStatus === 'executing';

  const handleSubmit = (data: TagEditFormData) => {
    const translations = Object.entries(data.translations).map(
      ([locale, trans]) => ({
        locale,
        name: (trans as any)?.name || undefined,
        description: (trans as any)?.description || undefined,
        content: (trans as any)?.content || undefined,
      })
    );

    updateTag({
      slug: data.slug,
      common: {
        category: data.category,
        status: data.status,
      },
      translations,
    });
  };

  const handleAutofill = () => {
    setAutofillError(null);

    const currentTranslations = LOCALE_LIST.map((l) => {
      const trans = form.getValues(`translations.${l.code}` as any) as any;
      return {
        locale: l.code,
        name: trans?.name || null,
        description: trans?.description || null,
        content: trans?.content || null,
      };
    });

    autofillTranslations({
      slug: form.getValues('slug'),
      referenceContent: form.getValues('referenceContent') || '',
      common: {
        slug: form.getValues('slug'),
        category: form.getValues('category') || null,
        status: form.getValues('status'),
      },
      currentTranslations,
      fillMissingOnly: true,
    });
  };

  // 当标签数据变化时更新表单
  useEffect(() => {
    if (open && tag) {
      const translationsMap = Object.fromEntries(
        LOCALE_LIST.map((l) => {
          const trans = tag.translations.find((t) => t.locale === l.code);
          return [
            l.code,
            {
              name: trans?.name || '',
              description: trans?.description || '',
              content: trans?.content || '',
            },
          ];
        })
      );

      form.reset({
        slug: tag.slug,
        category: tag.category || 'general',
        status:
          (tag.status as 'draft' | 'published' | 'archived') || 'published',
        referenceContent: '',
        translations: translationsMap,
      });
      setAutofillError(null);
      setActiveTab(LOCALE_LIST[0].code);
    }
  }, [open, tag, form]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] lg:max-w-[85vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('form.edit')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-6"
          >
            {/* 公共信息区域 */}
            <div className="space-y-4 p-4 rounded-lg border bg-muted/30">
              <h3 className="font-semibold text-sm text-muted-foreground">
                {t('form.commonFields') || '公共信息'}
              </h3>

              {/* Slug (只读) */}
              <FormField
                control={form.control}
                name="slug"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('form.slug')}</FormLabel>
                    <FormControl>
                      <Input {...field} disabled className="bg-muted" />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      Slug 不可修改
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Category 和 Status 并列 */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('form.category')}</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value || undefined}
                        disabled={isSubmitting}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue
                              placeholder={t('form.categoryPlaceholder')}
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="type">
                            {t('category.type')}
                          </SelectItem>
                          <SelectItem value="pricing">
                            {t('category.pricing')}
                          </SelectItem>
                          <SelectItem value="platform">
                            {t('category.platform')}
                          </SelectItem>
                          <SelectItem value="feature">
                            {t('category.feature')}
                          </SelectItem>
                          <SelectItem value="general">
                            {t('category.general')}
                          </SelectItem>
                          <SelectItem value="other">
                            {t('category.other')}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={isSubmitting}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="draft">
                            {t('status.draft')}
                          </SelectItem>
                          <SelectItem value="published">
                            {t('status.published')}
                          </SelectItem>
                          <SelectItem value="archived">
                            {t('status.archived')}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* 参考内容区域 */}
            <div className="space-y-4 p-4 rounded-lg border bg-muted/30">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm text-muted-foreground">
                  {t('form.referenceContent')}
                </h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAutofill}
                  disabled={isSubmitting || isAutofilling}
                >
                  {isAutofilling ? (
                    <>
                      <Loader2 className="size-4 mr-2 animate-spin" />
                      {t('form.autofilling')}
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-4 mr-2" />
                      {t('form.autofillMissing')}
                    </>
                  )}
                </Button>
              </div>

              {isAutofilling && (
                <Alert>
                  <Loader2 className="size-4 animate-spin" />
                  <AlertDescription>
                    正在生成多语言内容，请稍候...
                  </AlertDescription>
                </Alert>
              )}

              {autofillError && (
                <Alert variant="destructive">
                  <AlertCircle className="size-4" />
                  <AlertDescription>{autofillError}</AlertDescription>
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
                        placeholder={t('form.referenceContentPlaceholder')}
                        disabled={isSubmitting || isAutofilling}
                        rows={6}
                        className="font-mono text-sm"
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      为空时会基于当前标签已关联的工具、已有翻译和共现标签自动生成参考内容。
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* 多语言 Tabs */}
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-10">
                {LOCALE_LIST.map(({ code, flag }) => {
                  const hasContent = form.watch(
                    `translations.${code}.name` as any
                  );
                  return (
                    <TabsTrigger
                      key={code}
                      value={code}
                      className="flex items-center gap-1 text-xs"
                    >
                      <span>{flag}</span>
                      {hasContent && (
                        <Check className="size-3 text-green-500" />
                      )}
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              {/* 动态语言内容 */}
              {LOCALE_LIST.map(({ code, name }) => (
                <TabsContent key={code} value={code} className="space-y-4 mt-4">
                  <h3 className="font-semibold">{name} 内容</h3>

                  {/* 标签名称 (用于列表显示) */}
                  <FormField
                    control={form.control}
                    name={`translations.${code}.name` as any}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>标签名称 (Tag Name)</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="AI Tool"
                            disabled={isSubmitting}
                          />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">
                          显示在标签列表和筛选器中
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* 标签描述 (用于 SEO 和简短说明) */}
                  <FormField
                    control={form.control}
                    name={`translations.${code}.description` as any}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>标签描述 (Tag Description)</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            placeholder="Tools powered by artificial intelligence"
                            disabled={isSubmitting}
                            rows={2}
                          />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">
                          用于 Meta Description 和标签页简介
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Markdown 详细内容 (标签页完整内容) */}
                  <FormField
                    control={form.control}
                    name={`translations.${code}.content` as any}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>详细内容 (Markdown)</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            placeholder="## What are AI Tools?&#10;&#10;AI tools are software applications..."
                            disabled={isSubmitting}
                            rows={12}
                            className="font-mono text-sm"
                          />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">
                          标签详情页的完整 Markdown 内容
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>
              ))}
            </Tabs>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                {t('form.cancel')}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-4 mr-2 animate-spin" />
                    {t('form.saving')}
                  </>
                ) : (
                  t('form.save')
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
