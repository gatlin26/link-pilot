'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { AlertCircle, Check, Loader2, Sparkles } from 'lucide-react';
import type { Control } from 'react-hook-form';
import type { ToolFormData } from './tool-form-types';

interface LocaleInfo {
  code: string;
  flag?: string;
  name: string;
}

interface LocaleTabsProps {
  locales: LocaleInfo[];
  activeTab: string;
  onTabChange: (tab: string) => void;
  control: Control<ToolFormData>;
  isGenerating: boolean;
  generateError: string | null;
  onGenerate: () => void;
  watchTitle: (code: string) => string;
}

export function LocaleTabs({
  locales,
  activeTab,
  onTabChange,
  control,
  isGenerating,
  generateError,
  onGenerate,
  watchTitle,
}: LocaleTabsProps) {
  return (
    <Tabs value={activeTab} onValueChange={onTabChange}>
      <TabsList className="flex-wrap h-auto gap-1">
        {locales.map(({ code, flag, name }) => (
          <TabsTrigger key={code} value={code} className="gap-1">
            <span>{flag}</span>
            <span>{name}</span>
            {watchTitle(code) && <Check className="size-3 text-green-500" />}
          </TabsTrigger>
        ))}
      </TabsList>

      {locales.map(({ code, name }) => (
        <TabsContent key={code} value={code} className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">{name} 内容</h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onGenerate}
              disabled={isGenerating || activeTab !== code}
            >
              {isGenerating && activeTab === code ? (
                <Loader2 className="size-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="size-4 mr-2" />
              )}
              AI 生成
            </Button>
          </div>

          {isGenerating && activeTab === code && (
            <Alert>
              <Loader2 className="size-4 animate-spin" />
              <AlertDescription>
                AI 正在生成 {name} 内容，请稍候...
              </AlertDescription>
            </Alert>
          )}

          {generateError && activeTab === code && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>{generateError}</AlertDescription>
            </Alert>
          )}

          <FormField
            control={control}
            name={`translations.${code}.title`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Title (SEO)</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="SEO title..." />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name={`translations.${code}.description`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description (Meta)</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    rows={2}
                    placeholder="Meta description..."
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name={`translations.${code}.introduction`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Introduction (Markdown)</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    rows={12}
                    placeholder="## What is {Tool Name}?..."
                    className="font-mono text-sm"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </TabsContent>
      ))}
    </Tabs>
  );
}
