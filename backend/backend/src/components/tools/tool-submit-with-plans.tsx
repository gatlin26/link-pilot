'use client';

import type { submitToolAction } from '@/actions/tools/submit-tool';
import { ToolSubmitForm } from '@/components/tools/tool-submit-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Check, Info, Rocket, Send, ShieldAlert, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';

type PlanId = 'free' | 'pro';

interface ToolSubmitWithPlansProps {
  action: typeof submitToolAction;
}

export function ToolSubmitWithPlans({ action }: ToolSubmitWithPlansProps) {
  const t = useTranslations('ToolsPage.submit');
  const [selectedPlan, setSelectedPlan] = useState<PlanId>('free');
  const formRef = useRef<HTMLFormElement>(null);

  // 触发表单提交的函数
  const handlePlanSubmit = (plan: PlanId) => {
    setSelectedPlan(plan);
    // 使用 setTimeout 确保状态更新后再提交
    setTimeout(() => {
      if (formRef.current) {
        // 触发表单的提交事件
        formRef.current.dispatchEvent(
          new Event('submit', { cancelable: true, bubbles: true })
        );
      }
    }, 0);
  };

  const tips = t.raw('inclusionTips.items') as string[];

  return (
    <div className="space-y-10">
      {/* 提交表单放在上方：先填写信息，再选择套餐 */}
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <ToolSubmitForm
          action={action}
          plan={selectedPlan}
          hideSubmitButton
          formRef={formRef}
        />
      </div>

      {/* 套餐选择卡片：等高布局，Header/按钮垂直对齐 */}
      <div className="grid gap-6 sm:grid-cols-2 items-stretch">
        {/* FREE */}
        <Card
          className={cn(
            'relative flex flex-col h-full border-2 transition-all',
            selectedPlan === 'free'
              ? 'border-violet-500/50 bg-violet-50/30 dark:bg-violet-950/20 shadow-md'
              : 'border-border hover:border-violet-300/50 dark:hover:border-violet-700/30'
          )}
        >
          <CardHeader className="pb-2">
            <div className="flex items-baseline justify-between">
              <CardTitle className="text-2xl font-bold">
                {t('plans.free.title')}
              </CardTitle>
              <span className="text-2xl font-bold text-violet-600 dark:text-violet-400">
                {t('plans.free.price')}
              </span>
            </div>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-4">
            <ul className="space-y-2 text-sm">
              <PlanItem check>{t('plans.free.feature1')}</PlanItem>
              <PlanItem check>{t('plans.free.feature2')}</PlanItem>
              <PlanItem check>{t('plans.free.feature3')}</PlanItem>
              <PlanItem check>{t('plans.free.feature4')}</PlanItem>
              <PlanItem check={false}>{t('plans.free.limit1')}</PlanItem>
              <PlanItem check={false}>{t('plans.free.limit2')}</PlanItem>
            </ul>
            <Button
              type="button"
              variant="outline"
              className="mt-auto w-full border-violet-500/50 text-violet-700 hover:bg-violet-50 hover:text-violet-800 dark:border-violet-500/50 dark:text-violet-300 dark:hover:bg-violet-950/30"
              onClick={() => handlePlanSubmit('free')}
            >
              <Send className="size-4" />
              {t('plans.free.cta')}
            </Button>
          </CardContent>
        </Card>

        {/* PRO */}
        <Card
          className={cn(
            'relative flex flex-col h-full border-2 transition-all',
            selectedPlan === 'pro'
              ? 'border-violet-500/50 bg-violet-50/30 dark:bg-violet-950/20 shadow-md'
              : 'border-border hover:border-violet-300/50 dark:hover:border-violet-700/30'
          )}
        >
          <CardHeader className="pb-2">
            <div className="flex items-baseline justify-between">
              <CardTitle className="text-2xl font-bold">
                {t('plans.pro.title')}
              </CardTitle>
              <span className="text-2xl font-bold text-violet-600 dark:text-violet-400">
                {t('plans.pro.price')}
              </span>
            </div>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-4">
            <ul className="space-y-2 text-sm">
              <PlanItem check>{t('plans.pro.feature1')}</PlanItem>
              <PlanItem check>{t('plans.pro.feature2')}</PlanItem>
              <PlanItem check>{t('plans.pro.feature3')}</PlanItem>
              <PlanItem check>{t('plans.pro.feature4')}</PlanItem>
              <PlanItem check>{t('plans.pro.feature5')}</PlanItem>
              <PlanItem check>{t('plans.pro.feature6')}</PlanItem>
            </ul>
            <Button
              type="button"
              className="mt-auto w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:opacity-90"
              onClick={() => handlePlanSubmit('pro')}
            >
              <Rocket className="size-4" />
              {t('plans.pro.cta')}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* 收录须知 */}
      <div className="border-t pt-6">
        <div className="flex items-center gap-1.5 mb-3">
          <ShieldAlert className="size-3.5 text-muted-foreground shrink-0" />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {t('inclusionTips.title')}
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
          {tips.map((item, i) => (
            <div key={i} className="flex items-start gap-1.5">
              <Info className="size-3 mt-0.5 shrink-0 text-muted-foreground/60" />
              <span className="text-xs text-muted-foreground leading-relaxed">
                {item}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PlanItem({
  children,
  check,
}: { children: React.ReactNode; check: boolean }) {
  return (
    <li className="flex items-start gap-2">
      {check ? (
        <Check className="size-4 shrink-0 text-violet-600 dark:text-violet-400 mt-0.5" />
      ) : (
        <X className="size-4 shrink-0 text-muted-foreground mt-0.5" />
      )}
      <span className={check ? 'text-foreground' : 'text-muted-foreground'}>
        {children}
      </span>
    </li>
  );
}
