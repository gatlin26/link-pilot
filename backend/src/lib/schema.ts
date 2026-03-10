/**
 * @file schema.ts
 * @description JSON-LD 结构化数据生成工具库
 * @author git.username
 * @date 2025-12-27
 */

import { websiteConfig } from '@/config/website';
import type { Locale } from 'next-intl';
import { getBaseUrl, getImageUrl, getUrlWithLocale } from './urls/urls';

/**
 * Organization Schema - 组织信息
 */
export function generateOrganizationSchema() {
  const { metadata } = websiteConfig;
  const socialLinks = Object.values(metadata.social || {}).filter(
    Boolean
  ) as string[];

  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: metadata.name || 'Vidlyo',
    url: getBaseUrl(),
    logo: getImageUrl(
      websiteConfig.metadata.images?.logoDark || '/logo-dark.png'
    ),
    description: metadata.description || 'Free AI photo editor online.',
    foundingDate: metadata.foundingDate || '2024',
    ...(socialLinks.length > 0 && { sameAs: socialLinks }),
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'Customer Support',
      email: metadata.supportEmail || 'support@vidlyo.net',
    },
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'US',
    },
  };
}

/**
 * Website Schema - 网站搜索功能
 */
export function generateWebsiteSchema(locale: Locale = 'en') {
  const { metadata } = websiteConfig;
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: metadata.name || 'Vidlyo',
    url: getBaseUrl(),
    inLanguage: locale,
    availableLanguage: Object.keys(websiteConfig.i18n.locales),
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${getBaseUrl()}/blog?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

/**
 * SoftwareApplication Schema - 软件应用信息
 */
export function generateSoftwareApplicationSchema() {
  const { metadata } = websiteConfig;
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: metadata.name || 'Vidlyo',
    applicationCategory: 'GraphicsApplication',
    description: metadata.description || 'Free AI-powered photo editor.',
    url: getBaseUrl(),
    image: getImageUrl(
      websiteConfig.metadata.images?.ogImage ?? '/og-image.png'
    ),
    operatingSystem: ['Windows', 'macOS', 'Linux', 'Android', 'iOS'],
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      category: 'Free',
    },
  };
}

/**
 * Product Schema - 产品/计划信息
 */
export function generateProductSchema(
  planName: string,
  planDescription: string,
  price: string,
  currency = 'USD',
  interval: 'month' | 'year' | 'lifetime' = 'month',
  features: string[] = []
) {
  const siteName = websiteConfig.metadata.name || 'Vidlyo';
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: `${siteName} - ${planName} Plan`,
    description: planDescription,
    image: getImageUrl(
      websiteConfig.metadata.images?.ogImage ?? '/og-image.png'
    ),
    brand: {
      '@type': 'Brand',
      name: siteName,
    },
    offers: {
      '@type': 'Offer',
      price: price === '0' ? '0' : price.replace(/[^0-9]/g, ''),
      priceCurrency: currency,
      url: `${getBaseUrl()}/pricing`,
      availability: 'https://schema.org/InStock',
      priceValidUntil: new Date(
        new Date().setFullYear(new Date().getFullYear() + 1)
      )
        .toISOString()
        .split('T')[0],
      ...(interval !== 'lifetime' && {
        billingDuration: interval === 'month' ? 'P1M' : 'P1Y',
      }),
      hasMerchantReturnPolicy: {
        '@type': 'MerchantReturnPolicy',
        applicableCountry: 'US',
        returnPolicyCategory: 'https://schema.org/MerchantReturnNotPermitted',
        merchantReturnDays: 0,
        returnMethod: 'https://schema.org/ReturnByMail',
        returnFees: 'https://schema.org/FreeReturn',
      },
      shippingDetails: {
        '@type': 'OfferShippingDetails',
        shippingRate: {
          '@type': 'MonetaryAmount',
          value: '0',
          currency: 'USD',
        },
        shippingDestination: {
          '@type': 'DefinedRegion',
          addressCountry: 'US',
        },
        deliveryTime: {
          '@type': 'ShippingDeliveryTime',
          handlingTime: {
            '@type': 'QuantitativeValue',
            minValue: 0,
            maxValue: 0,
            unitCode: 'DAY',
          },
          transitTime: {
            '@type': 'QuantitativeValue',
            minValue: 0,
            maxValue: 0,
            unitCode: 'DAY',
          },
        },
      },
    },
    ...(features.length > 0 && {
      additionalProperty: features.map((feature) => ({
        '@type': 'PropertyValue',
        name: feature,
        value: true,
      })),
    }),
  };
}

/**
 * Tool Product Schema - 工具产品信息（用于工具详情页）
 * 包含完整的商家信息结构化数据，支持真实用户评论和聚合评分
 */
export function generateToolProductSchema(
  toolName: string,
  toolDescription: string,
  toolUrl: string,
  imageUrl: string,
  rating?: number,
  category?: string[],
  locale: Locale = 'en',
  reviewCount?: number,
  reviews?: Array<{
    authorName: string;
    ratingValue: number;
    reviewBody: string;
    datePublished: string;
  }>
) {
  const siteName = websiteConfig.metadata.name || 'Vidlyo';
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: toolName,
    description: toolDescription,
    image: imageUrl,
    url: toolUrl,
    inLanguage: locale,
    brand: {
      '@type': 'Brand',
      name: siteName,
    },
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
      url: toolUrl,
      priceValidUntil: new Date(
        new Date().setFullYear(new Date().getFullYear() + 1)
      )
        .toISOString()
        .split('T')[0],
      hasMerchantReturnPolicy: {
        '@type': 'MerchantReturnPolicy',
        applicableCountry: 'US',
        returnPolicyCategory: 'https://schema.org/MerchantReturnNotPermitted',
        merchantReturnDays: 0,
        returnMethod: 'https://schema.org/ReturnByMail',
        returnFees: 'https://schema.org/FreeReturn',
      },
      shippingDetails: {
        '@type': 'OfferShippingDetails',
        shippingRate: {
          '@type': 'MonetaryAmount',
          value: '0',
          currency: 'USD',
        },
        shippingDestination: {
          '@type': 'DefinedRegion',
          addressCountry: 'US',
        },
        deliveryTime: {
          '@type': 'ShippingDeliveryTime',
          handlingTime: {
            '@type': 'QuantitativeValue',
            minValue: 0,
            maxValue: 0,
            unitCode: 'DAY',
          },
          transitTime: {
            '@type': 'QuantitativeValue',
            minValue: 0,
            maxValue: 0,
            unitCode: 'DAY',
          },
        },
      },
    },
  };

  // aggregateRating: 优先使用真实用户评论数据，fallback 到管理员评分
  if (reviewCount && reviewCount > 0 && rating && rating > 0) {
    schema.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: rating.toFixed(1),
      bestRating: '5',
      worstRating: '1',
      ratingCount: reviewCount,
    };
  } else if (rating && rating > 0) {
    schema.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: rating.toFixed(1),
      bestRating: '5',
      worstRating: '1',
      ratingCount: 1,
    };
  }

  // review[]: 真实用户评论（Google 要求有 reviewBody）
  if (reviews && reviews.length > 0) {
    schema.review = reviews.map((r) => ({
      '@type': 'Review',
      author: {
        '@type': 'Person',
        name: r.authorName,
      },
      reviewRating: {
        '@type': 'Rating',
        ratingValue: r.ratingValue,
        bestRating: 5,
      },
      reviewBody: r.reviewBody,
      datePublished: r.datePublished,
    }));
  }

  if (category && category.length > 0) {
    schema.category = category.join(', ');
  }

  return schema;
}

/**
 * Offer Schema - 优惠信息（基础版）
 */
export function generateOfferSchema(
  name: string,
  price: string,
  currency = 'USD',
  availability = true
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Offer',
    name,
    price: price === '0' ? '0' : price,
    priceCurrency: currency,
    url: `${getBaseUrl()}/pricing`,
    availability: availability
      ? 'https://schema.org/InStock'
      : 'https://schema.org/OutOfStock',
  };
}

/**
 * Pricing Offer Schema - 定价页完整 Offer（含商家政策）
 * 用于定价页，避免 Product Schema 的 aggregateRating/review 验证问题
 */
export function generatePricingOfferSchema(
  planName: string,
  description: string,
  price: string,
  currency = 'USD',
  locale?: Locale
) {
  const siteName = websiteConfig.metadata.name || 'Vidlyo';
  return {
    '@context': 'https://schema.org',
    '@type': 'Offer',
    name: `${siteName} - ${planName} Plan`,
    description,
    price: price === '0' ? '0' : price.replace(/[^0-9]/g, ''),
    priceCurrency: currency,
    url: getUrlWithLocale('/pricing', locale),
    availability: 'https://schema.org/InStock',
    priceValidUntil: new Date(
      new Date().setFullYear(new Date().getFullYear() + 1)
    )
      .toISOString()
      .split('T')[0],
    hasMerchantReturnPolicy: {
      '@type': 'MerchantReturnPolicy',
      applicableCountry: 'US',
      returnPolicyCategory: 'https://schema.org/MerchantReturnNotPermitted',
      merchantReturnDays: 0,
      returnMethod: 'https://schema.org/ReturnByMail',
      returnFees: 'https://schema.org/FreeReturn',
    },
    shippingDetails: {
      '@type': 'OfferShippingDetails',
      shippingRate: {
        '@type': 'MonetaryAmount',
        value: '0',
        currency: 'USD',
      },
      shippingDestination: {
        '@type': 'DefinedRegion',
        addressCountry: 'US',
      },
      deliveryTime: {
        '@type': 'ShippingDeliveryTime',
        handlingTime: {
          '@type': 'QuantitativeValue',
          minValue: 0,
          maxValue: 0,
          unitCode: 'DAY',
        },
        transitTime: {
          '@type': 'QuantitativeValue',
          minValue: 0,
          maxValue: 0,
          unitCode: 'DAY',
        },
      },
    },
  };
}

/**
 * Article/BlogPosting Schema - 博客文章
 */
export function generateArticleSchema(
  title: string,
  description: string,
  image: string | undefined,
  datePublished: Date,
  dateModified: Date,
  authorName: string,
  authorImage: string | undefined,
  slug: string[],
  locale: Locale = 'en'
) {
  const url = getUrlWithLocale(`/blog/${slug.join('/')}`, locale);

  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: title,
    description,
    inLanguage: locale,
    image: image
      ? getImageUrl(image)
      : getImageUrl(websiteConfig.metadata.images?.ogImage ?? '/og-image.png'),
    datePublished: datePublished.toISOString(),
    dateModified: dateModified.toISOString(),
    author: {
      '@type': 'Person',
      name: authorName,
      ...(authorImage && {
        image: getImageUrl(authorImage),
      }),
    },
    publisher: {
      '@type': 'Organization',
      name: websiteConfig.metadata.name || 'Vidlyo',
      logo: {
        '@type': 'ImageObject',
        url: getImageUrl(
          websiteConfig.metadata.images?.logoDark || '/logo-dark.png'
        ),
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': url,
    },
    url,
  };
}

/**
 * FAQ Page Schema - FAQ页面
 */
export function generateFAQPageSchema(
  faqs: Array<{
    question: string;
    answer: string;
  }>
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}

/**
 * Breadcrumb Schema - 面包屑导航
 */
export function generateBreadcrumbSchema(
  breadcrumbs: Array<{
    name: string;
    url: string;
  }>
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbs.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

/**
 * HowTo Schema - 操作指南
 */
export function generateHowToSchema(
  name: string,
  description: string,
  image: string | undefined,
  steps: Array<{
    name: string;
    description: string;
    image?: string;
  }>
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name,
    description,
    image: image ? getImageUrl(image) : undefined,
    step: steps.map((step, index) => ({
      '@type': 'HowToStep',
      position: index + 1,
      name: step.name,
      text: step.description,
      ...(step.image && {
        image: getImageUrl(step.image),
      }),
    })),
  };
}

/**
 * LocalBusiness Schema - 本地业务信息
 */
export function generateLocalBusinessSchema(
  name: string,
  address: string,
  phone: string,
  email: string
) {
  const { metadata } = websiteConfig;
  const socialLinks = Object.values(metadata.social || {}).filter(
    Boolean
  ) as string[];

  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name,
    image: getImageUrl(metadata.images?.logoDark || '/logo-dark.png'),
    url: getBaseUrl(),
    telephone: phone,
    email,
    address: {
      '@type': 'PostalAddress',
      streetAddress: address,
    },
    ...(socialLinks.length > 0 && { sameAs: socialLinks }),
  };
}

/**
 * AggregateRating Schema - 综合评分
 */
export function generateAggregateRatingSchema(
  ratingValue: number,
  ratingCount: number,
  name: string = websiteConfig.metadata.name || 'Vidlyo'
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'AggregateRating',
    ratingValue: ratingValue.toFixed(1),
    ratingCount,
    name,
  };
}

/**
 * Thing Schema - 通用对象
 * 用于创建自定义的结构化数据
 */
export function generateThingSchema(
  type: string,
  properties: Record<string, unknown>
) {
  return {
    '@context': 'https://schema.org',
    '@type': type,
    ...properties,
  };
}

/**
 * 生成多个schema的组合
 */
export function generateMultipleSchemas(schemas: Record<string, unknown>[]) {
  if (schemas.length === 1) {
    return schemas[0];
  }

  return {
    '@context': 'https://schema.org',
    '@graph': schemas.map((schema) => {
      // 移除已存在的 @context
      const { '@context': _, ...rest } = schema as Record<string, unknown>;
      return rest;
    }),
  };
}

/**
 * CollectionPage Schema - 标签详情页
 * 用于标签页面，描述标签及其包含的工具集合
 */
export function generateCollectionPageSchema(
  tag: { name: string; description?: string | null; slug: string },
  toolCount: number,
  locale: Locale
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: locale === 'zh' ? `${tag.name} AI 工具` : `${tag.name} AI Tools`,
    description:
      tag.description ||
      (locale === 'zh'
        ? `${tag.name} AI 工具集合`
        : `Collection of ${tag.name} AI tools`),
    url: getUrlWithLocale(`/tags/${tag.slug}`, locale),
    inLanguage: locale,
    numberOfItems: toolCount,
    about: {
      '@type': 'Thing',
      name: tag.name,
      description: tag.description || undefined,
    },
  };
}

/**
 * ItemList Schema - 工具列表
 * 用于标签详情页的工具列表
 */
export function generateItemListSchema(
  tools: Array<{ name: string; slug: string; description?: string }>,
  locale: Locale
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    numberOfItems: tools.length,
    itemListElement: tools.map((tool, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'SoftwareApplication',
        name: tool.name,
        url: getUrlWithLocale(`/tools/${tool.slug}`, locale),
        description: tool.description || undefined,
      },
    })),
  };
}

/**
 * CollectionPage Schema - 标签列表页
 * 用于标签列表页，描述所有标签的集合
 */
export function generateTagsListCollectionPageSchema(
  totalCount: number,
  locale: Locale
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: locale === 'zh' ? 'AI 工具标签列表' : 'AI Tool Tags',
    description:
      locale === 'zh'
        ? `浏览 ${totalCount} 个 AI 工具标签，按类型、定价、平台等分类查找工具`
        : `Browse ${totalCount} AI tool tags. Find tools by type, pricing, platform and more.`,
    url: getUrlWithLocale('/tags', locale),
    inLanguage: locale,
    numberOfItems: totalCount,
  };
}
