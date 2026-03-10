# SEO 结构化数据指南

本文档说明如何在项目中正确使用和维护结构化数据（Schema.org），以确保符合 Google Search Console 的要求。

## 📋 目录

- [概述](#概述)
- [核心文件](#核心文件)
- [可用的 Schema 类型](#可用的-schema-类型)
- [工具页面结构化数据](#工具页面结构化数据)
- [Google 要求的必填字段](#google-要求的必填字段)
- [验证和测试](#验证和测试)
- [常见问题](#常见问题)

## 概述

结构化数据帮助搜索引擎更好地理解网站内容，提升搜索结果的展示效果。本项目使用 Schema.org 标准实现结构化数据。

## 核心文件

### 1. Schema 生成库
**文件**: `src/lib/schema.ts`

包含所有结构化数据生成函数，统一管理 Schema 的创建逻辑。

### 2. Schema 渲染组件
**文件**: `src/components/schema/schema-renderer.tsx`

提供两个组件：
- `SchemaRenderer` - 渲染单个 Schema
- `MultipleSchemaRenderer` - 渲染多个 Schema（使用 @graph）

## 可用的 Schema 类型

### 1. Organization Schema
```typescript
generateOrganizationSchema()
```
用于网站的组织信息，包括名称、Logo、联系方式、社交媒体链接等。

**使用场景**: 首页、关于页面

### 2. Website Schema
```typescript
generateWebsiteSchema()
```
定义网站搜索功能的结构化数据。

**使用场景**: 首页

### 3. Tool Product Schema ⭐
```typescript
generateToolProductSchema(
  toolName: string,
  toolDescription: string,
  toolUrl: string,
  imageUrl: string,
  rating?: number,
  category?: string[],
  locale: Locale = 'en'
)
```
专门为工具详情页设计，包含完整的商家信息字段。

**包含的必填字段**:
- `offers` - 优惠信息
  - `hasMerchantReturnPolicy` - 退货政策
  - `shippingDetails` - 运输详情
- `aggregateRating` - 综合评分（如果有评分数据）
- `category` - 产品分类
- `brand` - 品牌信息

**使用场景**: 工具详情页 (`/tools/[slug]`)

### 4. Product Schema
```typescript
generateProductSchema(
  planName: string,
  planDescription: string,
  price: string,
  currency = 'USD',
  interval: 'month' | 'year' | 'lifetime' = 'month',
  features: string[] = []
)
```
用于定价计划和产品信息（含 aggregateRating/review 时使用）。

### 4.1 Pricing Offer Schema
```typescript
generatePricingOfferSchema(
  planName: string,
  description: string,
  price: string,
  currency = 'USD',
  locale?: Locale
)
```
用于定价页，避免 Product Schema 的 aggregateRating/review 验证问题。含 hasMerchantReturnPolicy、shippingDetails。

**使用场景**: 定价页面 (`/pricing`)

### 5. Article/BlogPosting Schema
```typescript
generateArticleSchema(
  title: string,
  description: string,
  image: string | undefined,
  datePublished: Date,
  dateModified: Date,
  authorName: string,
  authorImage: string | undefined,
  slug: string[],
  locale: Locale = 'en'
)
```
用于博客文章。

**使用场景**: 博客文章页面

### 6. FAQ Page Schema
```typescript
generateFAQPageSchema(
  faqs: Array<{
    question: string;
    answer: string;
  }>
)
```
用于常见问题页面。

**使用场景**: FAQ 页面、包含问答的页面

### 7. Breadcrumb Schema
```typescript
generateBreadcrumbSchema(
  breadcrumbs: Array<{
    name: string;
    url: string;
  }>
)
```
用于面包屑导航。

**使用场景**: 所有需要显示导航路径的页面

### 8. Aggregate Rating Schema
```typescript
generateAggregateRatingSchema(
  ratingValue: number,
  ratingCount: number,
  name: string = websiteConfig.metadata.name || 'Vidlyo'
)
```
用于综合评分信息。

**使用场景**: 产品页面、工具页面

## 工具页面结构化数据

### 实现示例

```typescript
// src/app/[locale]/(marketing)/tools/[slug]/page.tsx

import { MultipleSchemaRenderer } from '@/components/schema/schema-renderer';
import {
  generateToolProductSchema,
  generateBreadcrumbSchema,
} from '@/lib/schema';
import { getUrlWithLocale } from '@/lib/urls/urls';

export default async function ToolDetailPage({ params }: ToolDetailPageProps) {
  const { locale, slug } = await params;
  const tool = toolsSource.getPage([slug], locale);

  // 生成结构化数据
  const toolUrl = getUrlWithLocale(`/tools/${slug}`, locale);
  const toolImage = tool.data.thumbnailUrl || tool.data.image || '/og-image.png';

  const schemas = [
    // 工具产品 Schema
    generateToolProductSchema(
      tool.data.name,
      tool.data.description,
      toolUrl,
      toolImage,
      tool.data.starRating,
      tool.data.category,
      locale
    ),
    // 面包屑导航 Schema
    generateBreadcrumbSchema([
      {
        name: t('title'),
        url: getUrlWithLocale('/tools', locale),
      },
      {
        name: tool.data.name,
        url: toolUrl,
      },
    ]),
  ];

  return (
    <>
      {/* 结构化数据 */}
      <MultipleSchemaRenderer schemas={schemas} />

      {/* 页面内容 */}
      <div>...</div>
    </>
  );
}
```

### 生成的 JSON-LD 示例

```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Product",
      "name": "Mixart.ai",
      "description": "Create and edit images effortlessly...",
      "image": "https://example.com/image.jpg",
      "url": "https://buildway.com/en/tools/mixart-ai",
      "brand": {
        "@type": "Brand",
        "name": "BuildWay"
      },
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD",
        "availability": "https://schema.org/InStock",
        "url": "https://buildway.com/en/tools/mixart-ai",
        "priceValidUntil": "2027-01-27",
        "hasMerchantReturnPolicy": {
          "@type": "MerchantReturnPolicy",
          "applicableCountry": "US",
          "returnPolicyCategory": "https://schema.org/MerchantReturnNotPermitted",
          "merchantReturnDays": 0,
          "returnMethod": "https://schema.org/ReturnByMail",
          "returnFees": "https://schema.org/FreeReturn"
        },
        "shippingDetails": {
          "@type": "OfferShippingDetails",
          "shippingRate": {
            "@type": "MonetaryAmount",
            "value": "0",
            "currency": "USD"
          },
          "shippingDestination": {
            "@type": "DefinedRegion",
            "addressCountry": "US"
          },
          "deliveryTime": {
            "@type": "ShippingDeliveryTime",
            "handlingTime": {
              "@type": "QuantitativeValue",
              "minValue": 0,
              "maxValue": 0,
              "unitCode": "DAY"
            },
            "transitTime": {
              "@type": "QuantitativeValue",
              "minValue": 0,
              "maxValue": 0,
              "unitCode": "DAY"
            }
          }
        }
      },
      "aggregateRating": {
        "@type": "AggregateRating",
        "ratingValue": "5.0",
        "bestRating": "5",
        "worstRating": "1",
        "ratingCount": 1
      },
      "category": "AI Tools, Image Generation"
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "name": "Discover AI Tools",
          "item": "https://buildway.com/en/tools"
        },
        {
          "@type": "ListItem",
          "position": 2,
          "name": "Mixart.ai",
          "item": "https://buildway.com/en/tools/mixart-ai"
        }
      ]
    }
  ]
}
```

## Google 要求的必填字段

### Product Schema 必填字段

根据 Google Search Console 的要求，Product Schema 必须包含以下之一：
1. ✅ **offers** - 优惠信息（推荐）
2. ✅ **review** - 用户评论
3. ✅ **aggregateRating** - 综合评分

### Offers 字段的必填子字段

如果使用 `offers`，必须包含：
- ✅ **price** - 价格
- ✅ **priceCurrency** - 货币
- ✅ **availability** - 可用性状态
- ✅ **hasMerchantReturnPolicy** - 退货政策（商家信息）
- ✅ **shippingDetails** - 运输详情（商家信息）

### 退货政策字段 (hasMerchantReturnPolicy)

```typescript
{
  "@type": "MerchantReturnPolicy",
  "applicableCountry": "US",
  "returnPolicyCategory": "https://schema.org/MerchantReturnNotPermitted",
  "merchantReturnDays": 0,
  "returnMethod": "https://schema.org/ReturnByMail",
  "returnFees": "https://schema.org/FreeReturn"
}
```

**说明**: 对于数字产品（如 AI 工具），通常不支持退货。

### 运输详情字段 (shippingDetails)

```typescript
{
  "@type": "OfferShippingDetails",
  "shippingRate": {
    "@type": "MonetaryAmount",
    "value": "0",
    "currency": "USD"
  },
  "shippingDestination": {
    "@type": "DefinedRegion",
    "addressCountry": "US"
  },
  "deliveryTime": {
    "@type": "ShippingDeliveryTime",
    "handlingTime": {
      "@type": "QuantitativeValue",
      "minValue": 0,
      "maxValue": 0,
      "unitCode": "DAY"
    },
    "transitTime": {
      "@type": "QuantitativeValue",
      "minValue": 0,
      "maxValue": 0,
      "unitCode": "DAY"
    }
  }
}
```

**说明**: 对于数字产品，运输费用为 0，交付时间为即时。

## 验证和测试

### 1. Google Rich Results Test
使用 Google 的富媒体结果测试工具验证结构化数据：

🔗 https://search.google.com/test/rich-results

**步骤**:
1. 输入页面 URL 或粘贴 HTML 代码
2. 点击"测试 URL"或"测试代码"
3. 查看检测到的结构化数据类型
4. 检查是否有错误或警告

### 2. Google Search Console
在 Google Search Console 中监控结构化数据问题：

**路径**: 增强功能 > 产品 / 商家信息

**检查项**:
- ✅ 严重问题数量（必须为 0）
- ✅ 非严重问题数量（建议为 0）
- ✅ 有效项目数量

### 3. 本地验证

```bash
# 启动开发服务器
pnpm dev

# 访问工具页面
# http://localhost:3000/en/tools/[slug]

# 查看页面源代码，搜索 "application/ld+json"
# 验证 JSON-LD 格式是否正确
```

### 4. Schema.org Validator
使用 Schema.org 官方验证器：

🔗 https://validator.schema.org/

## 常见问题

### Q1: 为什么需要 hasMerchantReturnPolicy 和 shippingDetails？
**A**: Google 要求所有包含 `offers` 的 Product Schema 必须提供完整的商家信息，包括退货政策和运输详情。即使是免费的数字产品也需要这些字段。

### Q2: 数字产品如何设置运输信息？
**A**: 对于数字产品：
- 运输费用设为 0
- 交付时间设为 0（即时交付）
- 退货政策设为不支持退货

### Q3: 如果工具没有评分怎么办？
**A**: 如果工具没有评分数据，`generateToolProductSchema` 会自动跳过 `aggregateRating` 字段。但必须确保 `offers` 字段完整。

### Q4: 如何添加新的 Schema 类型？
**A**:
1. 在 `src/lib/schema.ts` 中添加新的生成函数
2. 遵循 Schema.org 标准
3. 使用 TypeScript 类型确保类型安全
4. 在相应页面中使用 `SchemaRenderer` 或 `MultipleSchemaRenderer` 渲染

### Q5: 多个 Schema 如何组合？
**A**: 使用 `MultipleSchemaRenderer` 组件，它会自动使用 `@graph` 将多个 Schema 组合成一个 JSON-LD 块。

```typescript
<MultipleSchemaRenderer
  schemas={[
    generateToolProductSchema(...),
    generateBreadcrumbSchema(...),
    generateFAQPageSchema(...),
  ]}
/>
```

### Q6: 如何更新现有页面的结构化数据？
**A**:
1. 修改 `src/lib/schema.ts` 中的生成函数
2. 确保所有使用该函数的页面都会自动更新
3. 运行 `pnpm build` 验证没有类型错误
4. 使用 Google Rich Results Test 验证更新后的数据

### Q7: 结构化数据更新后多久生效？
**A**:
- Google 重新抓取页面通常需要几天到几周
- 可以在 Search Console 中请求重新抓取
- 使用 Rich Results Test 可以立即验证更新

## 最佳实践

### ✅ 推荐做法

1. **统一管理**: 所有 Schema 生成逻辑集中在 `src/lib/schema.ts`
2. **类型安全**: 使用 TypeScript 确保参数类型正确
3. **复用组件**: 使用 `SchemaRenderer` 组件统一渲染
4. **完整数据**: 确保所有必填字段都有值
5. **定期验证**: 定期检查 Search Console 中的结构化数据问题

### ❌ 避免做法

1. **不要硬编码**: 避免在页面中直接写 JSON-LD
2. **不要遗漏字段**: 确保包含所有 Google 要求的必填字段
3. **不要重复**: 同一页面不要重复相同类型的 Schema
4. **不要忽略警告**: Search Console 中的非严重问题也应该修复

## 参考资源

- [Schema.org 官方文档](https://schema.org/)
- [Google 结构化数据指南](https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data)
- [Google 商家信息指南](https://developers.google.com/search/docs/appearance/structured-data/product)
- [Google Rich Results Test](https://search.google.com/test/rich-results)
- [Schema.org Validator](https://validator.schema.org/)

## 更新日志

### 2026-01-27
- ✅ 添加 `generateToolProductSchema` 函数
- ✅ 为工具详情页添加完整的商家信息字段
- ✅ 修复 Google Search Console 报告的所有结构化数据问题
- ✅ 添加 `hasMerchantReturnPolicy` 和 `shippingDetails` 字段
- ✅ 为所有工具页面添加 `aggregateRating` 和 `Breadcrumb` Schema
