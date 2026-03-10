'use client';

import { HeaderSection } from '@/components/layout/header-section';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import type { IconName } from 'lucide-react/dynamic';
import { useLocale, useTranslations } from 'next-intl';

type FAQItem = {
  id: string;
  icon: IconName;
  question: string;
  answer: string;
};

type FaqNamespace = 'HomePage.faqs' | 'PricingPage.faqs';

interface FaqSectionProps {
  namespace?: FaqNamespace;
}

export default function FaqSection({
  namespace = 'HomePage.faqs',
}: FaqSectionProps) {
  const locale = useLocale();
  const t = useTranslations(namespace);

  // 根据命名空间选择不同的图标配置
  const getIconsForNamespace = (ns: FaqNamespace): IconName[] => {
    if (ns === 'PricingPage.faqs') {
      return [
        'clock',
        'shopping-cart',
        'package',
        'sparkles',
        'calendar',
        'user-x',
        'refresh-cw',
        'credit-card',
      ];
    }
    // 默认图标配置（HomePage.faqs）
    return [
      'coins',
      'calculator',
      'file-image',
      'maximize',
      'clock',
      'arrow-up-down',
      'credit-card',
      'shield-check',
    ];
  };

  const icons = getIconsForNamespace(namespace);

  // 获取 FAQ 项的数量
  const getItemCount = (ns: FaqNamespace): number => {
    if (ns === 'PricingPage.faqs') {
      return 8;
    }
    return 8;
  };

  const itemCount = getItemCount(namespace);
  const faqItems: FAQItem[] = Array.from({ length: itemCount }, (_, i) => {
    const questionKey = `items.item-${i + 1}.question` as const;
    const answerKey = `items.item-${i + 1}.answer` as const;
    return {
      id: `item-${i + 1}`,
      icon: icons[i] || 'help-circle',
      question: t(questionKey as Parameters<typeof t>[0]),
      answer: t(answerKey as Parameters<typeof t>[0]),
    };
  });

  return (
    <section id="faqs" className="px-4 py-16">
      <div className="mx-auto max-w-4xl">
        <HeaderSection
          title={t('title')}
          titleAs="h2"
          subtitle={t('subtitle')}
          subtitleAs="p"
        />

        <div className="mx-auto max-w-4xl mt-12">
          <Accordion
            type="single"
            collapsible
            className="ring-muted w-full rounded-2xl border px-8 py-3 shadow-sm ring-4 dark:ring-0"
          >
            {faqItems.map((item) => (
              <AccordionItem
                key={item.id}
                value={item.id}
                className="border-dashed"
              >
                <AccordionTrigger className="cursor-pointer text-base hover:no-underline">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent>
                  <p className="text-base text-muted-foreground">
                    {item.answer}
                  </p>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
}
