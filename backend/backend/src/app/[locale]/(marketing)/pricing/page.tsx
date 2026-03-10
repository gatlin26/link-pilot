/**
 * @file page.tsx
 * @description 定价页面 - 工具提交套餐
 * @author yiangto
 * @date 2026-01-25
 */

import FaqSection from '@/components/blocks/faqs/faqs';
import Container from '@/components/layout/container';
import { MultipleSchemaRenderer } from '@/components/schema/schema-renderer';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { constructMetadata } from '@/lib/metadata';
import { generatePricingOfferSchema } from '@/lib/schema';
import { getUrlWithLocale } from '@/lib/urls/urls';
import { CheckIcon, SparklesIcon } from 'lucide-react';
import type { Metadata } from 'next';
import type { Locale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations('PricingPage');
  return constructMetadata({
    title: t('title'),
    description: t('description'),
    canonicalUrl: getUrlWithLocale('/pricing', locale),
  });
}

export default async function PricingPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const t = await getTranslations('PricingPage');

  // 定价页使用 Offer Schema（避免 Product 的 aggregateRating/review 验证问题）
  const submitToolSchema = generatePricingOfferSchema(
    t('title'),
    t('description'),
    '4.99',
    'USD',
    locale
  );

  const features = [
    'Featured listing on homepage',
    'Permanent placement in directory',
    'SEO-optimized tool page',
    'Direct link to your website',
    'Increased visibility and traffic',
    'Fast approval process',
  ];

  return (
    <>
      <MultipleSchemaRenderer schemas={[submitToolSchema]} />
      <Container className="mt-8 max-w-4xl px-4 flex flex-col gap-16">
        {/* 页面标题 */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight">
            {t('submitTool.title')}
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {t('submitTool.subtitle')}
          </p>
        </div>

        {/* 套餐卡片 */}
        <div className="flex justify-center">
          <Card className="relative flex flex-col max-w-md w-full border-primary shadow-lg">
            {/* Popular 标签 */}
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <div className="bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-semibold">
                {t('submitTool.badge')}
              </div>
            </div>

            <CardHeader className="text-center pb-4">
              {/* 图标 */}
              <div className="mx-auto mb-2 p-3 rounded-full bg-primary/10 text-primary">
                <SparklesIcon className="h-8 w-8" />
              </div>

              {/* 套餐名称 */}
              <CardTitle className="text-2xl">
                {t('submitTool.packageName')}
              </CardTitle>
              <CardDescription className="text-base">
                {t('submitTool.packageDescription')}
              </CardDescription>
            </CardHeader>

            <CardContent className="flex-1 flex flex-col">
              {/* 价格区域 */}
              <div className="text-center mb-8">
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-5xl font-bold">$4.99</span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  {t('submitTool.oneTime')}
                </p>
              </div>

              {/* 特点列表 */}
              <ul className="space-y-3 mb-8 flex-1">
                {features.map((feature, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <CheckIcon className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

              {/* 提交按钮 */}
              <Button asChild size="lg" className="w-full">
                <Link href={`/${locale}/tools/submit`}>
                  {t('submitTool.submitButton')}
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        <FaqSection namespace="PricingPage.faqs" />
      </Container>
    </>
  );
}
