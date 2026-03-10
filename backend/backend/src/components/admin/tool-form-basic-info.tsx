'use client';

import { ImageUploader } from '@/components/admin/image-uploader';
import { LogoUploader } from '@/components/admin/logo-uploader';
import { type Tag, TagSelector } from '@/components/admin/tag-selector';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { AlertCircle, FileDown, Loader2, RefreshCw, Wand2 } from 'lucide-react';
import type { UseFormReturn } from 'react-hook-form';
import type { ToolFormData, ToolFormMode } from './tool-form-types';

interface ToolFormBasicInfoProps {
  form: UseFormReturn<ToolFormData>;
  mode: ToolFormMode;
  isSaving: boolean;
  isLoadingTags: boolean;
  availableTags: Tag[];
  isFetchingBasic: boolean;
  isFetchingContent: boolean;
  isAutoFilling: boolean;
  fetchError: string | null;
  localeCount: number;
  onFetchBasicInfo: () => void;
  onAutoFill: () => void;
  onFetchUrlContent?: () => void;
}

export function ToolFormBasicInfo({
  form,
  mode,
  isSaving,
  isLoadingTags,
  availableTags,
  isFetchingBasic,
  isFetchingContent,
  isAutoFilling,
  fetchError,
  localeCount,
  onFetchBasicInfo,
  onAutoFill,
  onFetchUrlContent,
}: ToolFormBasicInfoProps) {
  return (
    <div className="space-y-3 p-3 rounded-lg border bg-muted/30">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm text-muted-foreground">
          基础信息 (所有语言共享)
        </h3>
        <div className="flex flex-col items-end gap-1">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onFetchBasicInfo}
              disabled={isFetchingBasic || isFetchingContent || isAutoFilling}
            >
              {isFetchingBasic || isFetchingContent ? (
                <Loader2 className="size-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="size-4 mr-2" />
              )}
              分析网站
            </Button>
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={onAutoFill}
              disabled={isAutoFilling || !form.watch('url')}
            >
              {isAutoFilling ? (
                <Loader2 className="size-4 mr-2 animate-spin" />
              ) : (
                <Wand2 className="size-4 mr-2" />
              )}
              一键填充
            </Button>
          </div>
          <span className="text-xs text-muted-foreground">
            一键填充：有参考内容时跳过抓取 → 分析信息 → 确认后生成 {localeCount}{' '}
            种语言
          </span>
        </div>
      </div>

      {(isFetchingBasic || isFetchingContent) && (
        <Alert>
          <Loader2 className="size-4 animate-spin" />
          <AlertDescription>
            {isFetchingContent
              ? '正在从网页获取数据...'
              : 'AI 正在分析网站，获取工具基础信息...'}
          </AlertDescription>
        </Alert>
      )}

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

      <FormField
        control={form.control}
        name="tags"
        render={({ field }) => {
          const selectedTagIds = availableTags
            .filter((tag) => field.value.includes(tag.slug))
            .map((tag) => tag.id);
          return (
            <FormItem>
              <FormLabel>Tags</FormLabel>
              <FormControl>
                <TagSelector
                  selectedTagIds={selectedTagIds}
                  availableTags={availableTags}
                  onChange={(tagIds) =>
                    field.onChange(
                      availableTags
                        .filter((t) => tagIds.includes(t.id))
                        .map((t) => t.slug)
                    )
                  }
                  disabled={isSaving || isLoadingTags}
                  placeholder={isLoadingTags ? '加载标签中...' : '选择标签...'}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          );
        }}
      />

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
                  disabled={isSaving || isAutoFilling}
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
                    field.onChange(url);
                    form.setValue('imageUrl', url);
                  }}
                  disabled={isSaving || isAutoFilling}
                  folder="screenshots"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {/* 参考内容：管理员可手动粘贴或通过抓取获取，用于 AI 分析/生成 */}
      <FormField
        control={form.control}
        name="referenceContent"
        render={({ field }) => (
          <FormItem>
            <div className="flex items-center justify-between gap-2">
              <FormLabel className="text-xs text-muted-foreground">
                参考内容
              </FormLabel>
              {onFetchUrlContent && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onFetchUrlContent}
                  disabled={
                    isFetchingContent ||
                    isAutoFilling ||
                    !form.watch('url')?.trim()
                  }
                  className="h-7 text-xs"
                >
                  {isFetchingContent ? (
                    <Loader2 className="size-3 mr-1 animate-spin" />
                  ) : (
                    <FileDown className="size-3 mr-1" />
                  )}
                  抓取网页
                </Button>
              )}
            </div>
            <FormControl>
              <Textarea
                {...field}
                value={field.value ?? ''}
                rows={6}
                placeholder="可手动粘贴网站内容，或点击「抓取网页」从 URL 获取。用于「分析网站」和「一键填充」的 AI 参考。"
                className="font-mono text-xs resize-y min-h-[120px]"
              />
            </FormControl>
            <p className="text-xs text-muted-foreground">
              管理员可手动添加内容；有内容时「分析网站」「一键填充」将直接使用，无需再抓取
            </p>
          </FormItem>
        )}
      />
    </div>
  );
}
