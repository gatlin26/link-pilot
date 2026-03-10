'use client';

import { updateTagAction } from '@/actions/tags/manage-tags';
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

const tagEditFormSchema = z.object({
  slug: z.string().min(1),
  enName: z.string().min(1, 'English name is required').max(100),
  zhName: z.string().min(1, 'Chinese name is required').max(100),
  enDescription: z.string().optional(),
  zhDescription: z.string().optional(),
  category: z.string().optional(),
  status: z.enum(['draft', 'published', 'archived']),
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

  const form = useForm<TagEditFormData>({
    resolver: zodResolver(tagEditFormSchema),
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

  const { execute: updateTag, status } = useAction(updateTagAction, {
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

  const isSubmitting = status === 'executing';

  const handleSubmit = (data: TagEditFormData) => {
    updateTag({
      slug: data.slug,
      enName: data.enName,
      zhName: data.zhName,
      enDescription: data.enDescription || null,
      zhDescription: data.zhDescription || null,
      category: data.category || null,
      status: data.status,
    });
  };

  // 当标签数据变化时更新表单
  useEffect(() => {
    if (open && tag) {
      const enTranslation = tag.translations.find((t) => t.locale === 'en');
      const zhTranslation = tag.translations.find((t) => t.locale === 'zh');

      form.reset({
        slug: tag.slug,
        enName: enTranslation?.name || '',
        zhName: zhTranslation?.name || '',
        enDescription: enTranslation?.description || '',
        zhDescription: zhTranslation?.description || '',
        category: tag.category || 'general',
        status:
          (tag.status as 'draft' | 'published' | 'archived') || 'published',
      });
    }
  }, [open, tag, form]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('form.edit')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4"
          >
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
                    Slug cannot be changed
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
                    value={field.value}
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
                    value={field.value}
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
