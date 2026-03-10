import { z } from 'zod';

export const translationSchema = z.object({
  title: z.string(),
  description: z.string(),
  introduction: z.string(),
});

export const toolFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  url: z.string().url('Valid URL is required'),
  tags: z.array(z.string()),
  featured: z.boolean(),
  published: z.boolean(),
  referenceContent: z.string().optional(),
  iconUrl: z.string().url().optional().nullable(),
  thumbnailUrl: z.string().url().optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  translations: z.record(
    z.enum(['en', 'zh', 'zh-TW', 'ko', 'ja', 'pt', 'es', 'de', 'fr', 'vi']),
    translationSchema
  ),
});

export type ToolFormData = z.infer<typeof toolFormSchema>;

export type ToolFormMode = 'create' | 'edit' | 'approve';
