'use client';

import { createTagAction } from '@/actions/tags/manage-tags';
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
import { Textarea } from '@/components/ui/textarea';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useAction } from 'next-safe-action/hooks';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

const tagFormSchema = z.object({
  slug: z
    .string()
    .min(1, 'Slug is required')
    .max(50)
    .regex(
      /^[a-z0-9-]+$/,
      'Slug must be lowercase letters, numbers, and hyphens only'
    ),
  enName: z.string().min(1, 'English name is required').max(100),
  zhName: z.string().min(1, 'Chinese name is required').max(100),
  enDescription: z.string().optional(),
  zhDescription: z.string().optional(),
  category: z.string().optional(),
  status: z.enum(['draft', 'published', 'archived']).default('published'),
});

type TagFormData = z.infer<typeof tagFormSchema>;

interface TagCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function TagCreateDialog({
  open,
  onOpenChange,
  onSuccess,
}: TagCreateDialogProps) {
  const t = useTranslations('Dashboard.admin.tags');

  const form = useForm<TagFormData>({
    resolver: zodResolver(tagFormSchema),
    defaultValues: {
      slug: '',
      enName: '',
      zhName: '',
      enDescription: '',
      zhDescription: '',
      category: 'general',
      status: 'published',
    },
  });

  const { execute: createTag, status } = useAction(createTagAction, {
    onSuccess: ({ data }) => {
      if (data?.success) {
        toast.success(t('toast.createSuccess'));
        form.reset();
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

  const isSubmitting = status === 'executing';

  const handleSubmit = (data: TagFormData) => {
    createTag(data);
  };

  // 重置表单当对话框打开时
  useEffect(() => {
    if (open) {
      form.reset();
    }
  }, [open, form]);

  // 自动生成 slug
  const handleNameChange = (name: string, field: 'enName' | 'zhName') => {
    form.setValue(field, name);
    // 只在 slug 为空时自动生成
    if (!form.getValues('slug') && field === 'enName') {
      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
      form.setValue('slug', slug);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('form.create')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4"
          >
            {/* Slug */}
            <FormField
              control={form.control}
              name="slug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('form.slug')}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder={t('form.slugPlaceholder')}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    {t('form.slugHint')}
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* English Name */}
            <FormField
              control={form.control}
              name="enName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('form.enName')}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder={t('form.enNamePlaceholder')}
                      disabled={isSubmitting}
                      onChange={(e) =>
                        handleNameChange(e.target.value, 'enName')
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Chinese Name */}
            <FormField
              control={form.control}
              name="zhName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('form.zhName')}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder={t('form.zhNamePlaceholder')}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* English Description */}
            <FormField
              control={form.control}
              name="enDescription"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('form.enDescription')}</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder={t('form.enDescriptionPlaceholder')}
                      disabled={isSubmitting}
                      rows={2}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Chinese Description */}
            <FormField
              control={form.control}
              name="zhDescription"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('form.zhDescription')}</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder={t('form.zhDescriptionPlaceholder')}
                      disabled={isSubmitting}
                      rows={2}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Category */}
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('form.category')}</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
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
                      <SelectItem value="type">{t('category.type')}</SelectItem>
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

            {/* Status */}
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={isSubmitting}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="draft">{t('status.draft')}</SelectItem>
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

            <DialogFooter>
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
