import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import dotenv from 'dotenv';
import { and, eq, inArray } from 'drizzle-orm';
import { nanoid } from 'nanoid';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });
dotenv.config();

let websiteConfig: typeof import('../src/config/website').websiteConfig;
let TAG_DEFINITIONS: typeof import('../src/config/tag-definitions').TAG_DEFINITIONS;
let getDb: typeof import('../src/db').getDb;
let toolTagTranslations: typeof import('../src/db/schema').toolTagTranslations;
let toolTags: typeof import('../src/db/schema').toolTags;
let callEvolinkAPIWithRetry: typeof import('../src/lib/ai-utils').callEvolinkAPIWithRetry;
let parseAIJsonResponse: typeof import('../src/lib/ai-utils').parseAIJsonResponse;
let sanitizeForPrompt: typeof import('../src/lib/ai-utils').sanitizeForPrompt;

interface DbTranslation {
  slug: string;
  locale: string;
  name: string | null;
  description: string | null;
  content: string | null;
}

interface TagSeed {
  slug: string;
  category: string | null;
  currentTranslations: Array<{
    locale: string;
    name: string | null;
    description: string | null;
    content: string | null;
  }>;
  canonical: {
    en: {
      name: string;
      description: string;
      reference: string;
    };
    zh: {
      name: string;
      description: string;
      reference: string;
    };
  };
}

interface GeneratedTranslation {
  locale: string;
  name: string;
  description: string;
  content: string;
}

interface GeneratedTagResult {
  slug: string;
  translations: GeneratedTranslation[];
}

function sanitizeMarketingClaims(text: string) {
  return text
    .replace(/#1/gi, 'popular')
    .replace(/number one/gi, 'widely used')
    .replace(/top-rated/gi, 'well-regarded')
    .replace(/leading/gi, 'popular')
    .replace(/\bbest\b/gi, 'strong');
}

interface ProgressState {
  completedSlugs: string[];
  failed: Array<{ slug: string; reason: string }>;
  updatedRows: number;
  lastUpdatedAt: string | null;
}

let LOCALES: string[] = [];
let DEFINITION_MAP = new Map<string, (typeof TAG_DEFINITIONS)[number]>();
const DEFAULT_BATCH_SIZE = 3;
const DEFAULT_DELAY_MS = 600;
const DEFAULT_PROGRESS_PATH = resolve(
  process.cwd(),
  'tmp/tag-translation-backfill-progress.json'
);

function parseArgs() {
  const flags = new Map<string, string | boolean>();

  for (let index = 2; index < process.argv.length; index += 1) {
    const part = process.argv[index];
    if (!part.startsWith('--')) {
      continue;
    }

    const [rawKey, inlineValue] = part.slice(2).split('=');
    const key = rawKey.trim();

    if (inlineValue !== undefined) {
      flags.set(key, inlineValue);
      continue;
    }

    const next = process.argv[index + 1];
    if (next && !next.startsWith('--')) {
      flags.set(key, next);
      index += 1;
    } else {
      flags.set(key, true);
    }
  }

  return {
    batchSize: Number(flags.get('batch-size') || DEFAULT_BATCH_SIZE),
    limit: flags.get('limit') ? Number(flags.get('limit')) : undefined,
    delayMs: Number(flags.get('delay-ms') || DEFAULT_DELAY_MS),
    overwrite: Boolean(flags.get('overwrite')),
    dryRun: Boolean(flags.get('dry-run')),
    resetProgress: Boolean(flags.get('reset-progress')),
    progressFile: String(flags.get('progress-file') || DEFAULT_PROGRESS_PATH),
    slugsFile: flags.get('slugs-file')
      ? String(flags.get('slugs-file'))
      : undefined,
    slugs: String(flags.get('slugs') || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  };
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function isFilled(value: string | null | undefined) {
  return Boolean(value && value.trim());
}

function needsBackfill(
  translations: Map<string, DbTranslation>,
  overwrite: boolean
) {
  for (const locale of LOCALES) {
    const current = translations.get(locale);
    if (!current) {
      return true;
    }

    if (overwrite) {
      return true;
    }

    if (
      !isFilled(current.name) ||
      !isFilled(current.description) ||
      !isFilled(current.content)
    ) {
      return true;
    }
  }

  return false;
}

function truncateReference(content: string | undefined, maxLength = 900) {
  if (!content) {
    return '';
  }

  return sanitizeForPrompt(content.replace(/\s+/g, ' ').trim(), maxLength);
}

function buildTagSeed(
  slug: string,
  category: string | null,
  translationMap: Map<string, DbTranslation>
): TagSeed {
  const definition = DEFINITION_MAP.get(slug);
  const enDb = translationMap.get('en');
  const zhDb = translationMap.get('zh');

  if (!definition && (!enDb || !zhDb)) {
    throw new Error(
      `No definition or baseline translations found for slug: ${slug}`
    );
  }

  return {
    slug,
    category,
    currentTranslations: LOCALES.map((locale) => {
      const current = translationMap.get(locale);
      return {
        locale,
        name: current?.name ?? null,
        description: current?.description ?? null,
        content: current?.content ?? null,
      };
    }),
    canonical: {
      en: {
        name: definition?.en.name || enDb?.name || slug,
        description:
          definition?.en.description ||
          enDb?.description ||
          `AI tools related to ${slug}`,
        reference:
          truncateReference(definition?.references?.en?.content) ||
          truncateReference(enDb?.content || undefined),
      },
      zh: {
        name: definition?.zh.name || zhDb?.name || slug,
        description:
          definition?.zh.description ||
          zhDb?.description ||
          `与 ${slug} 相关的 AI 工具`,
        reference:
          truncateReference(definition?.references?.zh?.content) ||
          truncateReference(zhDb?.content || undefined),
      },
    },
  };
}

function buildPrompt(seeds: TagSeed[], overwrite: boolean) {
  const localeNames = Object.entries(websiteConfig.i18n.locales).map(
    ([code, info]) => `${code}: ${info.name}`
  );

  return `You are a senior international SEO editor for an AI tools directory taxonomy.

Generate high-quality localized tag data for each tag below.

Target locales:
${localeNames.join('\n')}

Primary goals:
1. Preserve the exact taxonomy meaning of each slug.
2. Make every translation sound native for its locale.
3. Produce content that is genuinely useful for category landing pages and internal linking.
4. Avoid keyword stuffing, hype, unverifiable claims, or awkward literal translations.

Output rules for EVERY locale:
- name: concise taxonomy label only, 1-4 words where natural.
- description: a single sentence that can work for card copy and meta description support.
- content: SEO-friendly Markdown with EXACTLY three H2 sections.
- content must include these ideas in localized headings and paragraphs:
  1) definition / what the tag means
  2) common use cases or user intent
  3) what to look for when choosing tools
- content must be specific, helpful, and readable, not generic filler.
- do NOT mention BuildWay, years, rankings, or phrases like “best”, “#1”, “leading”, “top-rated”.

Canonical requirements:
- Preserve the provided English and Simplified Chinese canonical names and descriptions exactly.
- zh-TW must use Traditional Chinese.
- Do not invent a different meaning than the canonical seed.

Field fill policy:
- ${overwrite ? 'Regenerate all fields for all locales.' : 'Keep non-empty existing values semantically consistent; prioritize filling missing fields, but still return a complete JSON payload for every locale.'}

Return ONLY valid JSON in this shape:
{
  "results": [
    {
      "slug": "example-slug",
      "translations": [
        {
          "locale": "en",
          "name": "Example",
          "description": "One sentence description.",
          "content": "## What Is It?\\n\\n...\\n\\n## Common Use Cases\\n\\n...\\n\\n## How to Choose Tools\\n\\n..."
        }
      ]
    }
  ]
}

Batch input:
${JSON.stringify(seeds, null, 2)}`;
}

function validateTranslation(locale: string, translation: GeneratedTranslation) {
  const name = translation.name?.trim();
  const description = translation.description?.trim();
  const content = sanitizeMarketingClaims(translation.content?.trim() || '');

  if (!name || name.length > 80) {
    throw new Error(`${locale}: invalid name`);
  }

  if (!description || description.length < 10 || description.length > 260) {
    throw new Error(`${locale}: invalid description length`);
  }

  if (!content || content.length < 260) {
    throw new Error(`${locale}: content too short`);
  }

  const headingCount = (content.match(/^##\s+/gm) || []).length;
  if (headingCount !== 3) {
    throw new Error(`${locale}: content must contain exactly 3 H2 headings`);
  }

}

function validateResult(tag: GeneratedTagResult, seeds: TagSeed[]) {
  const seed = seeds.find((item) => item.slug === tag.slug);
  if (!seed) {
    throw new Error(`Unexpected slug from AI: ${tag.slug}`);
  }

  if (
    !Array.isArray(tag.translations) ||
    tag.translations.length !== LOCALES.length
  ) {
    throw new Error(`${tag.slug}: expected ${LOCALES.length} translations`);
  }

  const byLocale = new Map(tag.translations.map((item) => [item.locale, item]));
  for (const locale of LOCALES) {
    const translation = byLocale.get(locale);
    if (!translation) {
      throw new Error(`${tag.slug}: missing locale ${locale}`);
    }

    validateTranslation(locale, translation);
  }

  const en = byLocale.get('en');
  const zh = byLocale.get('zh');

  if (en?.name !== seed.canonical.en.name) {
    throw new Error(`${tag.slug}: English canonical name drifted`);
  }

  if (en?.description !== seed.canonical.en.description) {
    throw new Error(`${tag.slug}: English canonical description drifted`);
  }

  if (zh?.name !== seed.canonical.zh.name) {
    throw new Error(`${tag.slug}: Chinese canonical name drifted`);
  }

  if (zh?.description !== seed.canonical.zh.description) {
    throw new Error(`${tag.slug}: Chinese canonical description drifted`);
  }
}

function normalizeWithCanonical(tag: GeneratedTagResult, seeds: TagSeed[]) {
  const seed = seeds.find((item) => item.slug === tag.slug);
  if (!seed) {
    return tag;
  }

  return {
    ...tag,
    translations: tag.translations.map((translation) => {
      if (translation.locale === 'en') {
        return {
          ...translation,
          name: seed.canonical.en.name,
          description: seed.canonical.en.description,
          content: sanitizeMarketingClaims(translation.content),
        };
      }

      if (translation.locale === 'zh') {
        return {
          ...translation,
          name: seed.canonical.zh.name,
          description: seed.canonical.zh.description,
          content: sanitizeMarketingClaims(translation.content),
        };
      }

      return {
        ...translation,
        content: sanitizeMarketingClaims(translation.content),
      };
    }),
  };
}

async function generateBatch(seeds: TagSeed[], overwrite: boolean) {
  const prompt = buildPrompt(seeds, overwrite);
  const response = await callEvolinkAPIWithRetry(
    {
      prompt,
      temperature: 0.3,
      maxTokens: 12000,
    },
    3
  );

  if (!response.success) {
    throw new Error(response.error);
  }

  const parsed = parseAIJsonResponse<{ results: GeneratedTagResult[] }>(
    response.content
  );

  if (!parsed.success || !parsed.data?.results) {
    throw new Error(parsed.error || 'Failed to parse AI JSON response');
  }

  let results = parsed.data.results.map((result) =>
    normalizeWithCanonical(result, seeds)
  );

  if (results.length !== seeds.length && seeds.length === 1) {
    const targetSlug = seeds[0].slug;
    const exactMatch = results.find((result) => result.slug === targetSlug);
    if (exactMatch) {
      results = [exactMatch];
    }
  }

  if (results.length !== seeds.length) {
    throw new Error(
      `Expected ${seeds.length} results, received ${results.length}`
    );
  }

  for (const result of results) {
    validateResult(result, seeds);
  }

  return results;
}

async function generateBatchWithFallback(
  seeds: TagSeed[],
  overwrite: boolean
) {
  try {
    return await generateBatch(seeds, overwrite);
  } catch (error) {
    if (seeds.length === 1) {
      throw error;
    }

    console.warn(
      `  ↪️  Falling back to per-tag generation: ${error instanceof Error ? error.message : 'Unknown batch error'}`
    );

    const results: GeneratedTagResult[] = [];
    for (const seed of seeds) {
      const [single] = await generateBatch([seed], overwrite);
      results.push(single);
    }

    return results;
  }
}

async function upsertTranslations(
  slug: string,
  translations: GeneratedTranslation[],
  currentMap: Map<string, DbTranslation>,
  overwrite: boolean
) {
  const db = await getDb();
  let updatedRows = 0;

  await db.transaction(async (tx) => {
    for (const translation of translations) {
      const existing = currentMap.get(translation.locale);

      const nextName = overwrite
        ? translation.name
        : existing?.name?.trim() || translation.name;
      const nextDescription = overwrite
        ? translation.description
        : existing?.description?.trim() || translation.description;
      const nextContent = overwrite
        ? translation.content
        : existing?.content?.trim() || translation.content;

      if (existing) {
        const changed =
          existing.name !== nextName ||
          (existing.description || null) !== nextDescription ||
          (existing.content || null) !== nextContent;

        if (!changed) {
          continue;
        }

        await tx
          .update(toolTagTranslations)
          .set({
            name: nextName,
            description: nextDescription,
            content: nextContent,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(toolTagTranslations.slug, slug),
              eq(toolTagTranslations.locale, translation.locale)
            )
          );
      } else {
        await tx.insert(toolTagTranslations).values({
          id: nanoid(),
          slug,
          locale: translation.locale,
          name: nextName,
          description: nextDescription,
          content: nextContent,
        });
      }

      currentMap.set(translation.locale, {
        slug,
        locale: translation.locale,
        name: nextName,
        description: nextDescription,
        content: nextContent,
      });
      updatedRows += 1;
    }
  });

  return updatedRows;
}

async function loadProgress(
  progressPath: string,
  reset: boolean
): Promise<ProgressState> {
  if (reset) {
    return {
      completedSlugs: [],
      failed: [],
      updatedRows: 0,
      lastUpdatedAt: null,
    };
  }

  try {
    const content = await readFile(progressPath, 'utf8');
    const parsed = JSON.parse(content) as ProgressState;
    return {
      completedSlugs: parsed.completedSlugs || [],
      failed: parsed.failed || [],
      updatedRows: parsed.updatedRows || 0,
      lastUpdatedAt: parsed.lastUpdatedAt || null,
    };
  } catch {
    return {
      completedSlugs: [],
      failed: [],
      updatedRows: 0,
      lastUpdatedAt: null,
    };
  }
}

async function saveProgress(progressPath: string, state: ProgressState) {
  await mkdir(dirname(progressPath), { recursive: true });
  state.lastUpdatedAt = new Date().toISOString();
  await writeFile(progressPath, JSON.stringify(state, null, 2), 'utf8');
}

async function main() {
  const websiteModule = await import('../src/config/website');
  const definitionModule = await import('../src/config/tag-definitions');
  const dbModule = await import('../src/db');
  const schemaModule = await import('../src/db/schema');
  const aiModule = await import('../src/lib/ai-utils');

  websiteConfig = websiteModule.websiteConfig;
  TAG_DEFINITIONS = definitionModule.TAG_DEFINITIONS;
  getDb = dbModule.getDb;
  toolTagTranslations = schemaModule.toolTagTranslations;
  toolTags = schemaModule.toolTags;
  callEvolinkAPIWithRetry = aiModule.callEvolinkAPIWithRetry;
  parseAIJsonResponse = aiModule.parseAIJsonResponse;
  sanitizeForPrompt = aiModule.sanitizeForPrompt;
  LOCALES = Object.keys(websiteConfig.i18n.locales);
  DEFINITION_MAP = new Map(TAG_DEFINITIONS.map((tag) => [tag.slug, tag]));

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not configured');
  }

  if (!process.env.EVOLINK_API_KEY) {
    throw new Error('EVOLINK_API_KEY is not configured');
  }

  const args = parseArgs();
  const db = await getDb();
  const progressPath = resolve(process.cwd(), args.progressFile);
  const progress = await loadProgress(progressPath, args.resetProgress);
  const completedSet = new Set(progress.completedSlugs);

  const allTags = await db
    .select({
      slug: toolTags.slug,
      category: toolTags.category,
      status: toolTags.status,
    })
    .from(toolTags)
    .orderBy(toolTags.slug);

  const slugsFromFile = args.slugsFile
    ? (await readFile(resolve(process.cwd(), args.slugsFile), 'utf8'))
        .split(/[,\n]/)
        .map((value) => value.trim())
        .filter(Boolean)
    : [];
  const selectedSlugSet = new Set([...args.slugs, ...slugsFromFile]);

  const selectedTags = allTags.filter((tag) => {
    if (selectedSlugSet.size > 0 && !selectedSlugSet.has(tag.slug)) {
      return false;
    }

    return true;
  });

  const slugs = selectedTags.map((tag) => tag.slug);
  const translationRows = slugs.length
    ? await db
        .select({
          slug: toolTagTranslations.slug,
          locale: toolTagTranslations.locale,
          name: toolTagTranslations.name,
          description: toolTagTranslations.description,
          content: toolTagTranslations.content,
        })
        .from(toolTagTranslations)
        .where(inArray(toolTagTranslations.slug, slugs))
    : [];

  const translationsBySlug = new Map<string, Map<string, DbTranslation>>();
  for (const row of translationRows) {
    const localeMap = translationsBySlug.get(row.slug) || new Map();
    localeMap.set(row.locale, row);
    translationsBySlug.set(row.slug, localeMap);
  }

  const pendingTags = selectedTags.filter((tag) => {
    if (!args.overwrite && completedSet.has(tag.slug)) {
      return false;
    }

    return needsBackfill(
      translationsBySlug.get(tag.slug) || new Map(),
      args.overwrite
    );
  });

  const queue = args.limit ? pendingTags.slice(0, args.limit) : pendingTags;
  const batches = chunkArray(queue, Math.max(1, args.batchSize));

  console.log(`🌍 Locales: ${LOCALES.join(', ')}`);
  console.log(`🏷️  Selected tags: ${selectedTags.length}`);
  console.log(`🧩 Pending tags: ${queue.length}`);
  console.log(`📦 Batches: ${batches.length}`);
  console.log(`📝 Progress file: ${progressPath}`);

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex += 1) {
    const batch = batches[batchIndex];
    const seeds = batch.map((tag) =>
      buildTagSeed(
        tag.slug,
        tag.category,
        translationsBySlug.get(tag.slug) || new Map()
      )
    );

    console.log(
      `\n[${batchIndex + 1}/${batches.length}] Generating: ${batch
        .map((tag) => tag.slug)
        .join(', ')}`
    );

    try {
      const results = await generateBatchWithFallback(seeds, args.overwrite);

      for (const result of results) {
        const currentMap = translationsBySlug.get(result.slug) || new Map();
        translationsBySlug.set(result.slug, currentMap);

        const updatedRows = args.dryRun
          ? result.translations.length
          : await upsertTranslations(
              result.slug,
              result.translations,
              currentMap,
              args.overwrite
            );

        progress.updatedRows += updatedRows;
        if (!progress.completedSlugs.includes(result.slug)) {
          progress.completedSlugs.push(result.slug);
        }
        progress.failed = progress.failed.filter(
          (item) => item.slug !== result.slug
        );
        console.log(`  ✅ ${result.slug} (${updatedRows} rows synced)`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`  ❌ Batch failed: ${message}`);

      for (const tag of batch) {
        progress.failed = progress.failed.filter((item) => item.slug !== tag.slug);
        progress.failed.push({ slug: tag.slug, reason: message });
      }
    }

    await saveProgress(progressPath, progress);

    if (batchIndex < batches.length - 1 && args.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, args.delayMs));
    }
  }

  console.log('\n🎉 Backfill complete');
  console.log(`✅ Completed slugs: ${progress.completedSlugs.length}`);
  console.log(`❌ Failed slugs: ${progress.failed.length}`);
  console.log(`🗄️  Updated rows: ${progress.updatedRows}`);

  if (progress.failed.length > 0) {
    console.log('Failed details:');
    for (const item of progress.failed.slice(0, 20)) {
      console.log(`- ${item.slug}: ${item.reason}`);
    }
  }
}

main().catch((error) => {
  console.error('❌ Backfill failed:', error);
  process.exit(1);
});
