'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { AlertCircle, Check, Loader2 } from 'lucide-react';

export type AutoFillStep =
  | 'idle'
  | 'fetching'
  | 'analyzing'
  | 'awaiting-confirmation'
  | 'generating-all'
  | 'completed'
  | 'error';

/** 分析完成后的待确认数据，用于用户确认后再生成各语言 */
export interface PendingAutoFillData {
  referenceContent: string;
  basicInfo: { name: string; tags: string[] };
  url: string;
}

export interface AutoFillState {
  step: AutoFillStep;
  progress: number;
  error: string | null;
  completedSteps: string[];
  /** 分析完成后的待确认数据，仅在 awaiting-confirmation 时有值 */
  pendingData?: PendingAutoFillData | null;
}

interface AutoFillDialogProps {
  state: AutoFillState;
  localeCount: number;
  isAutoFilling: boolean;
  onClose: () => void;
  onConfirmAndGenerate?: () => void;
}

export function AutoFillDialog({
  state,
  localeCount,
  isAutoFilling,
  onClose,
  onConfirmAndGenerate,
}: AutoFillDialogProps) {
  const isConfirmStep = state.step === 'awaiting-confirmation';
  const pending = state.pendingData;

  return (
    <Dialog
      open={state.step !== 'idle'}
      onOpenChange={(open) => {
        if (!open && !isAutoFilling) onClose();
      }}
    >
      <DialogContent
        className={
          isConfirmStep
            ? 'sm:max-w-lg max-h-[90vh] overflow-y-auto'
            : 'sm:max-w-md'
        }
      >
        <DialogHeader>
          <DialogTitle>
            {state.step === 'completed'
              ? '填充完成'
              : state.step === 'error'
                ? '填充失败'
                : isConfirmStep
                  ? '请确认内容'
                  : '正在自动填充'}
          </DialogTitle>
          <DialogDescription>
            {state.step === 'completed' && '所有内容已成功填充，请检查并调整。'}
            {state.step === 'error' && '自动填充过程中出现错误。'}
            {isConfirmStep &&
              '请确认参考内容和基础信息无误后，再生成各语言内容。'}
            {isAutoFilling &&
              !isConfirmStep &&
              `正在并行生成 ${localeCount} 种语言内容，请稍候...`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Progress value={state.progress} className="h-2" />

          {isAutoFilling && !isConfirmStep && (
            <div className="flex items-center gap-3">
              <Loader2 className="size-5 animate-spin text-primary" />
              <span className="text-sm font-medium">
                {state.step === 'fetching' && '正在抓取网页内容...'}
                {state.step === 'analyzing' && 'AI 正在分析工具信息...'}
                {state.step === 'generating-all' &&
                  'AI 正在并行生成所有语言内容...'}
              </span>
            </div>
          )}

          {isConfirmStep && pending && (
            <div className="space-y-4 text-sm">
              <div className="rounded-lg border bg-muted/50 p-3 space-y-2">
                <p className="font-medium text-muted-foreground">基础信息</p>
                <p>
                  <span className="text-muted-foreground">名称：</span>
                  {pending.basicInfo.name}
                </p>
                {pending.basicInfo.tags.length > 0 && (
                  <p>
                    <span className="text-muted-foreground">标签：</span>
                    {pending.basicInfo.tags.join(', ')}
                  </p>
                )}
              </div>
              <div className="rounded-lg border bg-muted/50 p-3 space-y-2">
                <p className="font-medium text-muted-foreground">
                  参考内容预览
                </p>
                <p className="text-muted-foreground line-clamp-4 font-mono text-xs">
                  {pending.referenceContent.slice(0, 300)}
                  {pending.referenceContent.length > 300 ? '...' : ''}
                </p>
                <p className="text-xs text-muted-foreground">
                  共 {pending.referenceContent.length} 字，可在下方表单中编辑
                </p>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={onClose}>
                  取消
                </Button>
                <Button size="sm" onClick={onConfirmAndGenerate}>
                  确认并生成 {localeCount} 种语言
                </Button>
              </div>
            </div>
          )}

          {state.step === 'completed' && (
            <div className="flex items-center gap-3 text-green-600">
              <Check className="size-5" />
              <span className="text-sm font-medium">所有步骤已完成</span>
            </div>
          )}

          {state.step === 'error' && (
            <div className="space-y-2">
              <div className="flex items-center gap-3 text-destructive">
                <AlertCircle className="size-5" />
                <span className="text-sm font-medium">错误</span>
              </div>
              <p className="text-sm text-muted-foreground">{state.error}</p>
            </div>
          )}

          {state.completedSteps.length > 0 && !isConfirmStep && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">已完成步骤：</p>
              <div className="flex flex-wrap gap-2">
                {state.completedSteps.map((step) => (
                  <Badge key={step} variant="secondary" className="gap-1">
                    <Check className="size-3" />
                    {step}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
