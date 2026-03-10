/**
 * @file faq-accordion.tsx
 * @description FAQ 手风琴组件
 * @author git.username
 * @date 2025-12-22
 */

'use client';

import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQAccordionProps {
  items: FAQItem[];
  className?: string;
}

export function FAQAccordion({ items, className }: FAQAccordionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className={cn('space-y-3', className)}>
      {items.map((item, index) => (
        <div
          key={index}
          className="border border-border rounded-lg overflow-hidden"
        >
          <button
            onClick={() => setOpenIndex(openIndex === index ? null : index)}
            className="w-full flex items-center justify-between p-5 text-left hover:bg-muted/50 transition-colors"
          >
            <span className="font-medium text-foreground pr-4">
              {item.question}
            </span>
            <ChevronDown
              className={cn(
                'w-5 h-5 text-primary transition-transform flex-shrink-0',
                openIndex === index && 'rotate-180'
              )}
            />
          </button>
          <div
            className={cn(
              'overflow-hidden transition-all duration-300',
              openIndex === index ? 'max-h-96' : 'max-h-0'
            )}
          >
            <p className="px-5 pb-5 text-muted-foreground leading-relaxed">
              {item.answer}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
