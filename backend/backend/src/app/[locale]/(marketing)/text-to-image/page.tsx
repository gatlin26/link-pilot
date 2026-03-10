import { FaqSection } from '@/components/landing/faq-section';
import { FeaturesSection } from '@/components/landing/features-section';
import { FinalCtaSection } from '@/components/landing/final-cta-section';
import { GallerySection } from '@/components/landing/gallery-section';
import { HighlightsSection } from '@/components/landing/highlights-section';
import { HowItWorksSection } from '@/components/landing/how-it-works-section';
import { IntroSections } from '@/components/landing/intro-sections';
import { MarketingHero } from '@/components/landing/marketing-hero';
import { MidCtaSection } from '@/components/landing/mid-cta-section';
import { TrustSecuritySection } from '@/components/landing/trust-security-section';
import { UseCasesSection } from '@/components/landing/use-cases-section';
import { MultipleSchemaRenderer } from '@/components/schema/schema-renderer';
import { constructMetadata } from '@/lib/metadata';
import {
  generateFAQPageSchema,
  generateOrganizationSchema,
  generateSoftwareApplicationSchema,
  generateWebsiteSchema,
} from '@/lib/schema';
import { getUrlWithLocale } from '@/lib/urls/urls';
import type { Metadata } from 'next';
import type { Locale } from 'next-intl';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  // Fallback metadata if translations are missing
  return constructMetadata({
    title: 'Free AI Text to Image Generator | Vidlyo',
    description:
      'Create sunny, realistic, and artistic images from text in seconds using Evolink AI.',
    canonicalUrl: getUrlWithLocale('/text-to-image', locale),
  });
}

export default async function TextToImagePage() {
  const t = await getTranslations('LandingPage.faq');

  const faqItems = [
    {
      question: t('items.noSignup.question'),
      answer: t('items.noSignup.answer'),
    },
    // ... other FAQ items can be dynamically populated or hardcoded for this specific page
  ];

  return (
    <>
      <MultipleSchemaRenderer
        schemas={[
          generateOrganizationSchema(),
          generateWebsiteSchema(),
          generateSoftwareApplicationSchema(),
          generateFAQPageSchema(faqItems),
        ]}
      />
      <main className="min-h-screen bg-background text-foreground">
        {/* The New Hero with Tabs and Redirect */}
        <MarketingHero />

        {/* Reusing the rich 12-section layout */}
        <GallerySection />
        <IntroSections />
        <HighlightsSection />
        <HowItWorksSection />
        <FeaturesSection />
        <UseCasesSection />
        <MidCtaSection />
        <TrustSecuritySection />
        <FaqSection />
        <FinalCtaSection />
      </main>
    </>
  );
}
