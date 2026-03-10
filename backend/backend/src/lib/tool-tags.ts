export const TOOL_TAG_CATEGORY_ORDER = [
  'platform',
  'pricing',
  'general',
  'type',
  'feature',
  'other',
] as const;

const TOOL_TAG_CATEGORY_ORDER_MAP = new Map(
  TOOL_TAG_CATEGORY_ORDER.map((category, index) => [category, index])
);

const TOOL_TAG_CATEGORY_LABELS: Record<string, Record<string, string>> = {
  type: {
    en: 'Type',
    zh: '类型',
    'zh-TW': '類型',
    ja: 'タイプ',
    ko: '유형',
    de: 'Typ',
    es: 'Tipo',
    fr: 'Type',
    pt: 'Tipo',
    vi: 'Loại',
  },
  feature: {
    en: 'Features',
    zh: '功能',
    'zh-TW': '功能',
    ja: '機能',
    ko: '기능',
    de: 'Funktionen',
    es: 'Funciones',
    fr: 'Fonctionnalités',
    pt: 'Recursos',
    vi: 'Tính năng',
  },
  pricing: {
    en: 'Pricing',
    zh: '定价',
    'zh-TW': '定價',
    ja: '料金',
    ko: '가격',
    de: 'Preis',
    es: 'Precios',
    fr: 'Tarification',
    pt: 'Preço',
    vi: 'Giá',
  },
  platform: {
    en: 'Platform',
    zh: '平台',
    'zh-TW': '平台',
    ja: 'プラットフォーム',
    ko: '플랫폼',
    de: 'Plattform',
    es: 'Plataforma',
    fr: 'Plateforme',
    pt: 'Plataforma',
    vi: 'Nền tảng',
  },
  general: {
    en: 'General',
    zh: '通用',
    'zh-TW': '通用',
    ja: '一般',
    ko: '일반',
    de: 'Allgemein',
    es: 'General',
    fr: 'Général',
    pt: 'Geral',
    vi: 'Chung',
  },
  other: {
    en: 'Other',
    zh: '其他',
    'zh-TW': '其他',
    ja: '其他',
    ko: '기타',
    de: 'Weitere',
    es: 'Otros',
    fr: 'Autres',
    pt: 'Outros',
    vi: 'Khác',
  },
};

const TOOL_TAG_CATEGORY_SIMILARITY_WEIGHT: Record<string, number> = {
  type: 12,
  feature: 8,
  pricing: 3,
  platform: 2,
  general: 1,
  other: 1,
};

export interface ToolTagLike {
  slug: string;
  name: string;
  category?: string | null;
  sortOrder?: number | null;
  usageCount?: number | null;
}

export function getToolTagCategoryRank(category?: string | null) {
  const normalizedCategory = (category || 'other') as
    | (typeof TOOL_TAG_CATEGORY_ORDER)[number]
    | 'other';

  return TOOL_TAG_CATEGORY_ORDER_MAP.get(normalizedCategory) ?? 999;
}

export function getToolTagCategoryLabel(
  category: string | null | undefined,
  locale: string
) {
  const normalizedLocale = TOOL_TAG_CATEGORY_LABELS.type[locale]
    ? locale
    : locale.startsWith('zh')
      ? locale === 'zh-TW'
        ? 'zh-TW'
        : 'zh'
      : 'en';

  return (
    TOOL_TAG_CATEGORY_LABELS[category || 'other']?.[normalizedLocale] ||
    TOOL_TAG_CATEGORY_LABELS.other[normalizedLocale]
  );
}

export function getToolTagSimilarityWeight(category?: string | null) {
  return TOOL_TAG_CATEGORY_SIMILARITY_WEIGHT[category || 'other'] ?? 1;
}

export function sortToolTagsByCategory<T extends ToolTagLike>(tags: T[]) {
  return [...tags].sort((a, b) => {
    const categoryDiff =
      getToolTagCategoryRank(a.category) - getToolTagCategoryRank(b.category);

    if (categoryDiff !== 0) {
      return categoryDiff;
    }

    const sortOrderDiff = (b.sortOrder ?? 0) - (a.sortOrder ?? 0);
    if (sortOrderDiff !== 0) {
      return sortOrderDiff;
    }

    const usageCountDiff = (b.usageCount ?? 0) - (a.usageCount ?? 0);
    if (usageCountDiff !== 0) {
      return usageCountDiff;
    }

    return a.name.localeCompare(b.name);
  });
}

export function sortToolTagsBySimilarity<T extends ToolTagLike>(tags: T[]) {
  return [...tags].sort((a, b) => {
    const similarityDiff =
      getToolTagSimilarityWeight(b.category) -
      getToolTagSimilarityWeight(a.category);

    if (similarityDiff !== 0) {
      return similarityDiff;
    }

    const categoryDiff =
      getToolTagCategoryRank(a.category) - getToolTagCategoryRank(b.category);

    if (categoryDiff !== 0) {
      return categoryDiff;
    }

    const sortOrderDiff = (b.sortOrder ?? 0) - (a.sortOrder ?? 0);
    if (sortOrderDiff !== 0) {
      return sortOrderDiff;
    }

    const usageCountDiff = (b.usageCount ?? 0) - (a.usageCount ?? 0);
    if (usageCountDiff !== 0) {
      return usageCountDiff;
    }

    return a.name.localeCompare(b.name);
  });
}

export function isSuitableRelatedTool<T extends ToolTagLike>(matchedTags: T[]) {
  return matchedTags.some(
    (tag) => tag.category === 'type' || tag.category === 'feature'
  );
}
