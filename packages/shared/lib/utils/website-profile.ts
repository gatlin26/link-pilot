import type {
  ManagedBacklinkSiteType,
  WebsiteProfile,
  WebsiteProfileDynamicField,
} from '../types/models.js';

interface DynamicFieldOptions {
  siteType?: ManagedBacklinkSiteType;
  commentCandidates?: string[];
}

function normalizeText(value?: string | null): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

function normalizeList(values?: string[] | null): string[] {
  return (values ?? []).map(value => normalizeText(value)).filter(Boolean);
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values.map(value => normalizeText(value)).filter(Boolean)));
}

function resolveAbsoluteUrl(baseUrl: string, value?: string | null): string | undefined {
  const normalized = normalizeText(value);
  if (!normalized) {
    return undefined;
  }

  try {
    return new URL(normalized, baseUrl).toString();
  } catch {
    return undefined;
  }
}

function readMetaContent(document: Document, selectors: string[]): string {
  for (const selector of selectors) {
    const content = document.querySelector(selector)?.getAttribute('content');
    if (content?.trim()) {
      return content.trim();
    }
  }

  return '';
}

function readLinkHref(document: Document, selectors: string[]): string {
  for (const selector of selectors) {
    const href = document.querySelector<HTMLLinkElement>(selector)?.getAttribute('href');
    if (href?.trim()) {
      return href.trim();
    }
  }

  return '';
}

function splitKeywords(value: string): string[] {
  return dedupe(
    value
      .split(/[,|/]/)
      .map(item => item.trim())
      .filter(Boolean),
  );
}

function mergeField(
  field: WebsiteProfileDynamicField,
  existingMap: Map<string, WebsiteProfileDynamicField>,
): WebsiteProfileDynamicField {
  const existing = existingMap.get(field.id);
  if (!existing) {
    return field;
  }

  return {
    ...field,
    ...existing,
    value:
      existing.value !== undefined &&
      (!Array.isArray(existing.value) ? normalizeText(existing.value) : existing.value.length > 0)
        ? existing.value
        : field.value,
  };
}

export function getProfileCommentTemplates(profile: Pick<WebsiteProfile, 'comment_templates' | 'comments'>): string[] {
  const preferred = normalizeList(profile.comment_templates);
  if (preferred.length > 0) {
    return preferred;
  }

  return normalizeList(profile.comments);
}

export function getPrimaryWebsiteDescription(
  profile: Pick<WebsiteProfile, 'description' | 'tagline' | 'comment_templates' | 'comments'>,
): string {
  return (
    normalizeText(profile.description) ||
    normalizeText(profile.tagline) ||
    getProfileCommentTemplates(profile)[0] ||
    ''
  );
}

export function extractWebsiteProfileFromHtml(html: string, url: string): Partial<WebsiteProfile> {
  const parser = new DOMParser();
  const document = parser.parseFromString(html, 'text/html');

  const rawTitle =
    readMetaContent(document, [
      'meta[property="og:title"]',
      'meta[name="twitter:title"]',
      'meta[name="application-name"]',
    ]) ||
    normalizeText(document.title);
  const rawName =
    readMetaContent(document, [
      'meta[property="og:site_name"]',
      'meta[name="application-name"]',
      'meta[name="apple-mobile-web-app-title"]',
    ]) ||
    rawTitle;
  const description =
    readMetaContent(document, [
      'meta[name="description"]',
      'meta[property="og:description"]',
      'meta[name="twitter:description"]',
    ]) || '';
  const keywords = splitKeywords(readMetaContent(document, ['meta[name="keywords"]']));
  const logoUrl = resolveAbsoluteUrl(
    url,
    readLinkHref(document, [
      'link[rel="apple-touch-icon"]',
      'link[rel="apple-touch-icon-precomposed"]',
      'link[rel="icon"]',
      'link[rel="shortcut icon"]',
      'link[rel="mask-icon"]',
    ]) || '/favicon.ico',
  );
  const screenshotUrl = resolveAbsoluteUrl(
    url,
    readMetaContent(document, ['meta[property="og:image"]', 'meta[name="twitter:image"]']),
  );

  return {
    name: normalizeText(rawName) || new URL(url).hostname.replace(/^www\./, ''),
    title: normalizeText(rawTitle),
    tagline: normalizeText(description).slice(0, 140),
    description: normalizeText(description),
    logo_url: logoUrl,
    screenshot_url: screenshotUrl,
    categories: keywords,
    keywords,
    scraped_at: new Date().toISOString(),
    dynamic_fields: buildWebsiteProfileDynamicFields({
      id: '',
      group_id: 'default',
      name: normalizeText(rawName) || new URL(url).hostname.replace(/^www\./, ''),
      url,
      domain: new URL(url).hostname,
      email: '',
      title: normalizeText(rawTitle),
      tagline: normalizeText(description).slice(0, 140),
      description: normalizeText(description),
      logo_url: logoUrl,
      screenshot_url: screenshotUrl,
      categories: keywords,
      keywords,
      comments: [],
      enabled: true,
      created_at: '',
      updated_at: '',
    }),
  };
}

export function buildWebsiteProfileDynamicFields(
  profile: Partial<WebsiteProfile>,
  options: DynamicFieldOptions = {},
): WebsiteProfileDynamicField[] {
  const existingMap = new Map((profile.dynamic_fields ?? []).map(field => [field.id, field]));
  const fields: WebsiteProfileDynamicField[] = [];
  const siteType = options.siteType ?? 'other';
  const commentTemplates = getProfileCommentTemplates({
    comment_templates: profile.comment_templates,
    comments: profile.comments ?? [],
  });
  const commentCandidates = dedupe([...(options.commentCandidates ?? []), ...commentTemplates]).slice(0, 3);
  const pushField = (field: WebsiteProfileDynamicField) => {
    const normalizedStringValue = typeof field.value === 'string' ? normalizeText(field.value) : field.value;
    const hasValue = Array.isArray(normalizedStringValue)
      ? normalizedStringValue.length > 0
      : Boolean(normalizedStringValue);
    if (!hasValue) {
      return;
    }

    fields.push(mergeField({ ...field, value: normalizedStringValue }, existingMap));
  };

  pushField({
    id: 'website_name',
    label: '网站名称',
    value: profile.name ?? '',
    field_type: 'text',
    source: 'manual',
    category: 'identity',
    visible: true,
  });
  pushField({
    id: 'website_url',
    label: '网站地址',
    value: profile.url ?? '',
    field_type: 'url',
    source: 'manual',
    category: 'identity',
    visible: true,
  });
  pushField({
    id: 'contact_email',
    label: '联系邮箱',
    value: profile.email ?? '',
    field_type: 'email',
    source: 'manual',
    category: 'identity',
    visible: true,
  });
  pushField({
    id: 'website_title',
    label: '网站标题',
    value: profile.title ?? '',
    field_type: 'text',
    source: profile.scraped_at ? 'scraped' : 'manual',
    category: 'brand',
    visible: true,
  });
  pushField({
    id: 'website_tagline',
    label: '网站简述',
    value: profile.tagline ?? '',
    field_type: 'text',
    source: profile.scraped_at ? 'scraped' : 'manual',
    category: 'brand',
    visible: true,
  });
  pushField({
    id: 'website_description',
    label: '网站描述',
    value: getPrimaryWebsiteDescription({
      description: profile.description,
      tagline: profile.tagline,
      comment_templates: profile.comment_templates,
      comments: profile.comments ?? [],
    }),
    field_type: 'textarea',
    source: profile.scraped_at ? 'scraped' : 'manual',
    category: 'content',
    visible: true,
  });
  pushField({
    id: 'logo_url',
    label: 'Logo 图片',
    value: profile.logo_url ?? '',
    field_type: 'image',
    source: profile.scraped_at ? 'scraped' : 'manual',
    category: 'brand',
    visible: true,
  });
  pushField({
    id: 'screenshot_url',
    label: '网站截图',
    value: profile.screenshot_url ?? '',
    field_type: 'image',
    source: profile.scraped_at ? 'scraped' : 'manual',
    category: 'brand',
    visible: true,
  });
  pushField({
    id: 'categories',
    label: '分类',
    value: dedupe(profile.categories ?? []),
    field_type: 'tags',
    source: profile.scraped_at ? 'scraped' : 'manual',
    category: 'content',
    visible: true,
  });
  pushField({
    id: 'keywords',
    label: '关键词',
    value: dedupe(profile.keywords ?? []),
    field_type: 'tags',
    source: profile.scraped_at ? 'scraped' : 'manual',
    category: 'content',
    visible: true,
  });

  if (siteType === 'blog_comment') {
    pushField({
      id: 'comment_author_name',
      label: '评论昵称',
      value: profile.name ?? '',
      field_type: 'text',
      source: 'generated',
      category: 'submission',
      visible: true,
    });
    pushField({
      id: 'comment_author_email',
      label: '评论邮箱',
      value: profile.email ?? '',
      field_type: 'email',
      source: 'generated',
      category: 'submission',
      visible: true,
    });
    pushField({
      id: 'comment_author_website',
      label: '评论网址',
      value: profile.url ?? '',
      field_type: 'url',
      source: 'generated',
      category: 'submission',
      visible: true,
    });
    commentCandidates.forEach((comment, index) => {
      pushField({
        id: `comment_variant_${index + 1}`,
        label: `评论内容 ${index + 1}`,
        value: comment,
        field_type: 'textarea',
        source: index === 0 ? 'generated' : 'ai',
        category: 'comment',
        visible: true,
      });
    });
  }

  if (siteType === 'ai_directory' || siteType === 'tool_directory' || siteType === 'submission_form') {
    pushField({
      id: 'listing_name',
      label: '提交名称',
      value: profile.name ?? '',
      field_type: 'text',
      source: 'generated',
      category: 'submission',
      visible: true,
    });
    pushField({
      id: 'listing_tagline',
      label: '提交简述',
      value: profile.tagline ?? '',
      field_type: 'text',
      source: 'generated',
      category: 'submission',
      visible: true,
    });
    pushField({
      id: 'listing_description',
      label: '提交描述',
      value: getPrimaryWebsiteDescription({
        description: profile.description,
        tagline: profile.tagline,
        comment_templates: profile.comment_templates,
        comments: profile.comments ?? [],
      }),
      field_type: 'textarea',
      source: 'generated',
      category: 'submission',
      visible: true,
    });
  }

  const generatedIds = new Set(fields.map(field => field.id));
  const extraFields = (profile.dynamic_fields ?? []).filter(field => !generatedIds.has(field.id));
  return [...fields, ...extraFields];
}
