/**
 * comment-generator.ts
 * 评论生成器工具函数
 * @author Link Pilot Team
 * @date 2026-03-13
 */

import type { FillPageState, ManagedBacklink, WebsiteProfile } from '../types/models.js';

type SupportedCommentLanguage =
  | 'en'
  | 'zh'
  | 'es'
  | 'fr'
  | 'de'
  | 'pt'
  | 'it'
  | 'ja'
  | 'ko'
  | 'ru';

interface CommentLanguagePack {
  fallbackTopic: string;
  keywordSeparator: string;
  templates: string[];
  buildContextTail: (values: Record<string, string>) => string;
}

const LANGUAGE_PACKS: Record<SupportedCommentLanguage, CommentLanguagePack> = {
  en: {
    fallbackTopic: 'this topic',
    keywordSeparator: ', ',
    templates: [
      'Thanks for sharing this post on {pageTopic}; the explanation is clear and practical.',
      'This was a helpful read on {pageTopic}, especially the part about {pageFocus}.',
      'I just finished reading {pageTitle}, and the structure made the topic easy to follow.',
    ],
    buildContextTail: values => {
      const topic = values.pageTopic || values.pageDomain || 'this topic';
      const title = values.pageTitle ? `"${values.pageTitle}"` : '';
      const focus = values.pageDescription || values.pageH1 || values.backlinkNote;
      const parts = [
        title ? `The article ${title} presents ${topic} in a very approachable way.` : `This article on ${topic} is easy to follow.`,
        focus ? `I especially liked the section about ${truncateText(focus, 42)}.` : '',
        values.backlinkKeywords ? `It also connects well with ${values.backlinkKeywords}.` : '',
      ].filter(Boolean);
      return parts.join(' ');
    },
  },
  zh: {
    fallbackTopic: '当前主题',
    keywordSeparator: '、',
    templates: [
      '感谢分享，关于 {pageTopic} 的内容整理得很清晰。',
      '这篇内容对理解 {pageTopic} 很有帮助，尤其是 {pageFocus} 这一部分。',
      '刚读完 {pageTitle}，信息梳理得很完整，也让我重新梳理了 {pageTopic}。',
    ],
    buildContextTail: values => {
      const topic = values.pageTopic || values.pageDomain || '当前主题';
      const title = values.pageTitle ? `《${values.pageTitle}》` : '';
      const focus = values.pageDescription || values.pageH1 || values.backlinkNote;
      const parts = [
        title ? `这篇 ${title} 围绕 ${topic} 的信息整理得很顺。` : `这篇关于 ${topic} 的内容读起来很顺畅。`,
        focus ? `尤其是 ${truncateText(focus, 42)} 这部分，很有参考价值。` : '',
        values.backlinkKeywords ? `和 ${values.backlinkKeywords} 这些方向也比较契合。` : '',
      ].filter(Boolean);
      return parts.join(' ');
    },
  },
  es: {
    fallbackTopic: 'este tema',
    keywordSeparator: ', ',
    templates: [
      'Gracias por compartir este articulo sobre {pageTopic}; la explicacion es clara y util.',
      'Fue una lectura muy util sobre {pageTopic}, sobre todo la parte de {pageFocus}.',
      'Acabo de leer {pageTitle} y la estructura hace que el tema sea facil de seguir.',
    ],
    buildContextTail: values => {
      const topic = values.pageTopic || values.pageDomain || 'este tema';
      const focus = values.pageDescription || values.pageH1 || values.backlinkNote;
      const parts = [
        `El contenido sobre ${topic} esta muy bien organizado.`,
        focus ? `Me gusto especialmente la parte sobre ${truncateText(focus, 42)}.` : '',
        values.backlinkKeywords ? `Tambien encaja bien con ${values.backlinkKeywords}.` : '',
      ].filter(Boolean);
      return parts.join(' ');
    },
  },
  fr: {
    fallbackTopic: 'ce sujet',
    keywordSeparator: ', ',
    templates: [
      'Merci pour cet article sur {pageTopic}; l explication est claire et utile.',
      'Cette lecture m a aide a mieux comprendre {pageTopic}, surtout la partie sur {pageFocus}.',
      'Je viens de lire {pageTitle} et la structure rend le sujet facile a suivre.',
    ],
    buildContextTail: values => {
      const topic = values.pageTopic || values.pageDomain || 'ce sujet';
      const focus = values.pageDescription || values.pageH1 || values.backlinkNote;
      const parts = [
        `Le contenu sur ${topic} est tres bien organise.`,
        focus ? `J ai particulierement aime la partie sur ${truncateText(focus, 42)}.` : '',
        values.backlinkKeywords ? `Cela rejoint aussi ${values.backlinkKeywords}.` : '',
      ].filter(Boolean);
      return parts.join(' ');
    },
  },
  de: {
    fallbackTopic: 'dieses Thema',
    keywordSeparator: ', ',
    templates: [
      'Danke fuer diesen Beitrag zu {pageTopic}; die Erklaerung ist klar und hilfreich.',
      'Das war ein hilfreicher Beitrag zu {pageTopic}, besonders der Abschnitt zu {pageFocus}.',
      'Ich habe gerade {pageTitle} gelesen und fand die Struktur sehr leicht nachvollziehbar.',
    ],
    buildContextTail: values => {
      const topic = values.pageTopic || values.pageDomain || 'dieses Thema';
      const focus = values.pageDescription || values.pageH1 || values.backlinkNote;
      const parts = [
        `Der Inhalt zu ${topic} ist sehr gut aufgebaut.`,
        focus ? `Besonders stark fand ich den Teil ueber ${truncateText(focus, 42)}.` : '',
        values.backlinkKeywords ? `Das passt auch gut zu ${values.backlinkKeywords}.` : '',
      ].filter(Boolean);
      return parts.join(' ');
    },
  },
  pt: {
    fallbackTopic: 'este tema',
    keywordSeparator: ', ',
    templates: [
      'Obrigado por compartilhar este conteudo sobre {pageTopic}; a explicacao esta clara e util.',
      'Foi uma leitura muito boa sobre {pageTopic}, especialmente a parte sobre {pageFocus}.',
      'Acabei de ler {pageTitle} e a estrutura tornou o tema facil de acompanhar.',
    ],
    buildContextTail: values => {
      const topic = values.pageTopic || values.pageDomain || 'este tema';
      const focus = values.pageDescription || values.pageH1 || values.backlinkNote;
      const parts = [
        `O conteudo sobre ${topic} esta muito bem organizado.`,
        focus ? `Gostei especialmente da parte sobre ${truncateText(focus, 42)}.` : '',
        values.backlinkKeywords ? `Isso tambem conversa bem com ${values.backlinkKeywords}.` : '',
      ].filter(Boolean);
      return parts.join(' ');
    },
  },
  it: {
    fallbackTopic: 'questo argomento',
    keywordSeparator: ', ',
    templates: [
      'Grazie per aver condiviso questo articolo su {pageTopic}; la spiegazione e chiara e utile.',
      'E stata una lettura utile su {pageTopic}, soprattutto la parte su {pageFocus}.',
      'Ho appena letto {pageTitle} e la struttura rende l argomento facile da seguire.',
    ],
    buildContextTail: values => {
      const topic = values.pageTopic || values.pageDomain || 'questo argomento';
      const focus = values.pageDescription || values.pageH1 || values.backlinkNote;
      const parts = [
        `Il contenuto su ${topic} e organizzato molto bene.`,
        focus ? `Mi e piaciuta soprattutto la parte su ${truncateText(focus, 42)}.` : '',
        values.backlinkKeywords ? `Si collega bene anche a ${values.backlinkKeywords}.` : '',
      ].filter(Boolean);
      return parts.join(' ');
    },
  },
  ja: {
    fallbackTopic: 'このテーマ',
    keywordSeparator: '、',
    templates: [
      '{pageTopic} についてとても分かりやすく整理された記事でした。共有ありがとうございます。',
      '{pageTopic} を理解するうえでとても参考になり、特に {pageFocus} の部分が印象的でした。',
      '{pageTitle} を読み終えて、流れがとても自然で内容が頭に入りやすかったです。',
    ],
    buildContextTail: values => {
      const topic = values.pageTopic || values.pageDomain || 'このテーマ';
      const focus = values.pageDescription || values.pageH1 || values.backlinkNote;
      const parts = [
        `${topic} について丁寧にまとまっていて読みやすかったです。`,
        focus ? `特に ${truncateText(focus, 42)} の部分が参考になりました。` : '',
        values.backlinkKeywords ? `${values.backlinkKeywords} とも相性が良い内容だと感じました。` : '',
      ].filter(Boolean);
      return parts.join('');
    },
  },
  ko: {
    fallbackTopic: '이 주제',
    keywordSeparator: ', ',
    templates: [
      '{pageTopic} 에 대한 내용을 아주 명확하게 정리해 주셔서 감사합니다.',
      '{pageTopic} 를 이해하는 데 큰 도움이 되었고 특히 {pageFocus} 부분이 좋았습니다.',
      '{pageTitle} 를 읽고 나니 흐름이 자연스러워 내용을 따라가기 쉬웠습니다.',
    ],
    buildContextTail: values => {
      const topic = values.pageTopic || values.pageDomain || '이 주제';
      const focus = values.pageDescription || values.pageH1 || values.backlinkNote;
      const parts = [
        `${topic} 에 대한 내용이 잘 정리되어 있어 읽기 편했습니다.`,
        focus ? `특히 ${truncateText(focus, 42)} 부분이 인상적이었습니다.` : '',
        values.backlinkKeywords ? `${values.backlinkKeywords} 와도 잘 연결되는 내용이네요.` : '',
      ].filter(Boolean);
      return parts.join(' ');
    },
  },
  ru: {
    fallbackTopic: 'etot vopros',
    keywordSeparator: ', ',
    templates: [
      'Spasibo za etot material o {pageTopic}; obyasnenie poluchilos ponyatnym i poleznym.',
      'Eto byl poleznyy tekst o {pageTopic}, osobenno chast pro {pageFocus}.',
      'Ya tolko chto prochital {pageTitle}, i struktura pomogla legko sledit za khodom mysli.',
    ],
    buildContextTail: values => {
      const topic = values.pageTopic || values.pageDomain || 'etot vopros';
      const focus = values.pageDescription || values.pageH1 || values.backlinkNote;
      const parts = [
        `Material po teme ${topic} horosho strukturirovan.`,
        focus ? `Osobenno poleznoy byla chast pro ${truncateText(focus, 42)}.` : '',
        values.backlinkKeywords ? `Eto takzhe horosho sochetaetsya s ${values.backlinkKeywords}.` : '',
      ].filter(Boolean);
      return parts.join(' ');
    },
  },
};

const PLACEHOLDER_PATTERN = /\{([a-zA-Z0-9_]+)\}/g;

function normalizeText(value?: string | null): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 1)).trim()}...`;
}

function parseDomain(value?: string): string {
  if (!value) {
    return '';
  }

  try {
    return new URL(value).hostname.replace(/^www\./, '');
  } catch {
    return value.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0] ?? '';
  }
}

function dedupeComments(comments: string[]): string[] {
  const seen = new Set<string>();

  return comments.filter(comment => {
    const normalized = normalizeText(comment);
    if (!normalized || seen.has(normalized)) {
      return false;
    }

    seen.add(normalized);
    return true;
  });
}

function interpolateTemplate(template: string, values: Record<string, string>): string {
  return template.replace(PLACEHOLDER_PATTERN, (_match, key: string) => values[key] ?? '');
}

function resolveCommentLanguage(language?: string | null): SupportedCommentLanguage {
  const normalized = normalizeText(language).toLowerCase();

  if (!normalized) return 'en';
  if (normalized.startsWith('zh')) return 'zh';
  if (normalized.startsWith('ja')) return 'ja';
  if (normalized.startsWith('ko')) return 'ko';
  if (normalized.startsWith('es')) return 'es';
  if (normalized.startsWith('fr')) return 'fr';
  if (normalized.startsWith('de')) return 'de';
  if (normalized.startsWith('pt')) return 'pt';
  if (normalized.startsWith('it')) return 'it';
  if (normalized.startsWith('ru')) return 'ru';

  return 'en';
}

function detectScriptFamily(text: string): 'cjk' | 'ja' | 'ko' | 'cyrillic' | 'latin' | 'unknown' {
  if (!text) return 'unknown';
  if (/[\u3040-\u30ff]/.test(text)) return 'ja';
  if (/[\uac00-\ud7af]/.test(text)) return 'ko';
  if (/[\u4e00-\u9fff]/.test(text)) return 'cjk';
  if (/[\u0400-\u04ff]/.test(text)) return 'cyrillic';
  if (/[A-Za-z]/.test(text)) return 'latin';
  return 'unknown';
}

function matchesTargetLanguage(text: string, language: SupportedCommentLanguage): boolean {
  const family = detectScriptFamily(text);
  if (family === 'unknown') return true;

  switch (language) {
    case 'zh':
      return family === 'cjk';
    case 'ja':
      return family === 'ja' || family === 'cjk';
    case 'ko':
      return family === 'ko';
    case 'ru':
      return family === 'cyrillic';
    default:
      return family === 'latin';
  }
}

function buildKeywordList(
  keywords: string[],
  separator: string,
): string {
  return keywords.map(keyword => normalizeText(keyword)).filter(Boolean).slice(0, 3).join(separator);
}

export function buildCommentCandidates(
  profile: WebsiteProfile,
  pageState: FillPageState | null,
  currentBacklink: ManagedBacklink | null,
): string[] {
  // 输入验证
  if (!profile) {
    throw new Error('profile 参数不能为空');
  }

  if (!profile.name || typeof profile.name !== 'string') {
    throw new Error('profile.name 必须是非空字符串');
  }

  if (profile.name.trim().length === 0) {
    throw new Error('profile.name 不能为空白字符串');
  }

  // 验证 pageState（如果提供）
  if (pageState !== null && typeof pageState !== 'object') {
    throw new Error('pageState 必须是对象或 null');
  }

  // 验证 currentBacklink（如果提供）
  if (currentBacklink !== null && typeof currentBacklink !== 'object') {
    throw new Error('currentBacklink 必须是对象或 null');
  }

  const pageTitle = normalizeText(pageState?.seo?.title);
  const pageH1 = normalizeText(pageState?.seo?.h1);
  const pageDescription = normalizeText(pageState?.seo?.description);
  const commentLanguage = resolveCommentLanguage(pageState?.seo?.language);
  const languagePack = LANGUAGE_PACKS[commentLanguage];
  const pageUrl = normalizeText(pageState?.seo?.url);
  const pageDomain = parseDomain(pageUrl);
  const pageTopic = truncateText(pageH1 || pageTitle || pageDomain || languagePack.fallbackTopic, 72);
  const pageFocus = truncateText(pageDescription || pageH1 || pageTitle || pageTopic, 72);
  const backlinkNote = normalizeText(currentBacklink?.note);
  const backlinkKeywords = buildKeywordList(currentBacklink?.keywords ?? [], languagePack.keywordSeparator);
  const values = {
    websiteName: normalizeText(profile.name),
    websiteUrl: normalizeText(profile.url),
    websiteDomain: normalizeText(profile.domain) || parseDomain(profile.url),
    email: normalizeText(profile.email),
    pageTitle,
    pageH1,
    pageDescription,
    pageUrl,
    pageDomain,
    pageTopic,
    pageFocus,
    backlinkNote,
    backlinkKeywords,
  };

  const baseTemplates = profile.comments
    .map(comment => normalizeText(comment))
    .filter(Boolean)
    .filter(comment => matchesTargetLanguage(comment, commentLanguage));
  const sourceTemplates = baseTemplates.length > 0 ? baseTemplates : languagePack.templates;
  const contextTail = languagePack.buildContextTail(values);

  const generatedFromTemplates = sourceTemplates.map(template => {
    const interpolated = normalizeText(interpolateTemplate(template, values));
    if (!interpolated) {
      return '';
    }

    const hasPlaceholders = PLACEHOLDER_PATTERN.test(template);
    PLACEHOLDER_PATTERN.lastIndex = 0;

    if (hasPlaceholders || !contextTail) {
      return interpolated;
    }

    return normalizeText(`${interpolated} ${contextTail}`);
  });

  const autoGenerated = languagePack.templates.map(template => normalizeText(interpolateTemplate(template, values)));

  return dedupeComments([...generatedFromTemplates, ...autoGenerated]).slice(0, 8);
}
