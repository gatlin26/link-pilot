/**
 * @file tools/submit/page.tsx
 * @description Tool submission page
 * @author git.username
 * @date 2026-01-25
 */

import { submitToolAction } from '@/actions/tools/submit-tool';
import { ToolSubmitWithPlans } from '@/components/tools/tool-submit-with-plans';
import { ArrowLeft, Sparkles } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

interface ToolSubmitPageProps {
  params: Promise<{
    locale: string;
  }>;
}

export async function generateMetadata({
  params,
}: ToolSubmitPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'ToolsPage' });

  return {
    title: t('submit.title'),
    description: t('submit.description'),
  };
}

export default async function ToolSubmitPage({ params }: ToolSubmitPageProps) {
  const { locale } = await params;
  const t = await getTranslations('ToolsPage');

  return (
    <div className="relative min-h-screen py-24 lg:py-32 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-white via-[#f8fafc] to-white dark:from-[#0a0f1a] dark:via-[#0f172a] dark:to-[#0a0f1a]" />

      {/* Decorative blobs */}
      <div className="absolute top-1/4 left-0 w-[500px] h-[500px] bg-gradient-to-br from-[#0052ff]/5 to-transparent rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-0 w-[400px] h-[400px] bg-gradient-to-tl from-[#3d8bff]/5 to-transparent rounded-full blur-3xl" />

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <nav className="mb-8">
          <Link
            href={`/${locale}/tools`}
            className="inline-flex items-center gap-2 text-[#64748b] dark:text-[#94a3b8] hover:text-[#0052ff] dark:hover:text-[#3d8bff] transition-colors"
          >
            <ArrowLeft className="size-4" />
            <span className="text-sm font-medium">{t('backToTools')}</span>
          </Link>
        </nav>

        {/* Page Header */}
        <div className="text-center mb-12">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#0052ff]/10 dark:bg-[#3d8bff]/15 border border-[#0052ff]/20 dark:border-[#3d8bff]/25 rounded-full mb-5">
            <Sparkles className="size-4 text-[#0052ff] dark:text-[#3d8bff]" />
            <span className="text-sm text-[#0052ff] dark:text-[#3d8bff] font-semibold uppercase tracking-wider">
              {t('submit.badge')}
            </span>
          </div>

          {/* Title */}
          <h1 className="font-heading text-3xl lg:text-5xl font-bold tracking-tight mb-5">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#0f172a] to-[#475569] dark:from-[#f8fafc] dark:to-[#94a3b8]">
              {t('submit.title')}
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-[#64748b] dark:text-[#94a3b8] text-lg max-w-2xl mx-auto leading-relaxed">
            {t('submit.description')}
          </p>
        </div>

        {/* 套餐选择 + 提交表单（免费需反链，专业版稍后上线） */}
        <ToolSubmitWithPlans action={submitToolAction} />
      </div>
    </div>
  );
}
