import '../env-loader';
import { MIN_TOOLS_FOR_PUBLISH } from '@/config/tag-whitelist';
import { sql } from 'drizzle-orm';
import { db, getExecuteRows } from '../../db/index';

/**
 * 自动更新标签状态
 *
 * 发布规则（必须同时满足）：
 * 1. 翻译完整性：必须同时有英文和中文翻译
 * 2. 工具数量：使用该标签的已发布工具数 >= 5
 *
 * 状态转换：
 * - 不满足任一条件: status='draft'
 * - 同时满足两个条件: status='published'
 *
 * 该函数应该定期执行（如每天一次）
 */
export async function updateTagStatusBasedOnUsage() {
  console.log('开始更新标签状态...\n');

  try {
    // 1. 更新所有标签的 usageCount
    console.log('步骤 1: 更新标签使用次数...');
    await db.execute(sql`
      UPDATE tool_tags
      SET usage_count = (
        SELECT COUNT(*)
        FROM tools
        WHERE tags::jsonb @> jsonb_build_array(tool_tags.slug)
          AND published = true
      ),
      updated_at = NOW()
    `);
    console.log('✓ 标签使用次数更新完成\n');

    // 2. 根据翻译完整性和 usageCount 自动更新 status
    console.log(
      `步骤 2: 更新标签状态（规则: 翻译完整 + 工具数 >= ${MIN_TOOLS_FOR_PUBLISH}）...`
    );

    // 使用 CTE 查询每个标签的翻译完整性
    const result = await db.execute(sql`
      WITH tag_translation_status AS (
        SELECT
          tt.slug,
          tt.usage_count,
          tt.status as current_status,
          COUNT(DISTINCT ttt.locale) FILTER (WHERE ttt.locale IN ('en', 'zh')) as translation_count
        FROM tool_tags tt
        LEFT JOIN tool_tag_translations ttt ON tt.slug = ttt.slug
        GROUP BY tt.slug, tt.usage_count, tt.status
      )
      UPDATE tool_tags
      SET status = CASE
        -- 必须同时满足：翻译完整（英文+中文）且工具数 >= 5
        WHEN (
          SELECT translation_count FROM tag_translation_status WHERE slug = tool_tags.slug
        ) = 2
        AND usage_count >= ${MIN_TOOLS_FOR_PUBLISH}
        THEN 'published'
        ELSE 'draft'
      END,
      updated_at = NOW()
      WHERE status != CASE
        WHEN (
          SELECT translation_count FROM tag_translation_status WHERE slug = tool_tags.slug
        ) = 2
        AND usage_count >= ${MIN_TOOLS_FOR_PUBLISH}
        THEN 'published'
        ELSE 'draft'
      END
      RETURNING slug, usage_count, status
    `);

    console.log(`✓ 标签状态更新完成，共更新 ${result.count ?? 0} 个标签\n`);

    // 3. 统计信息
    const statsResult = await db.execute(sql`
      SELECT
        status,
        COUNT(*) as count,
        AVG(usage_count) as avg_usage
      FROM tool_tags
      GROUP BY status
      ORDER BY status
    `);

    console.log('📊 标签状态统计:');
    if (statsResult && statsResult.length > 0) {
      for (const row of statsResult as any[]) {
        console.log(
          `  - ${row.status}: ${row.count} 个标签（平均使用 ${Math.round(row.avg_usage)} 次）`
        );
      }
    } else {
      console.log('  - 没有统计数据');
    }
    console.log('');

    // 4. 列出需要关注的标签
    // 4.1 缺少翻译的标签
    const missingTranslationsResult = await db.execute(sql`
      WITH tag_translation_status AS (
        SELECT
          tt.slug,
          tt.usage_count,
          tt.category,
          COUNT(DISTINCT ttt.locale) FILTER (WHERE ttt.locale = 'en') as has_en,
          COUNT(DISTINCT ttt.locale) FILTER (WHERE ttt.locale = 'zh') as has_zh
        FROM tool_tags tt
        LEFT JOIN tool_tag_translations ttt ON tt.slug = ttt.slug
        GROUP BY tt.slug, tt.usage_count, tt.category
      )
      SELECT slug, usage_count, category,
        CASE
          WHEN has_en = 0 AND has_zh = 0 THEN 'missing both'
          WHEN has_en = 0 THEN 'missing en'
          WHEN has_zh = 0 THEN 'missing zh'
        END as missing_translation
      FROM tag_translation_status
      WHERE has_en = 0 OR has_zh = 0
      ORDER BY usage_count DESC
      LIMIT 20
    `);

    if (missingTranslationsResult && missingTranslationsResult.length > 0) {
      console.log('⚠️  缺少翻译的标签（前 20 个）:');
      for (const row of missingTranslationsResult as any[]) {
        console.log(
          `  - ${row.slug} (${row.category}): ${row.usage_count} 次使用 - ${row.missing_translation}`
        );
      }
      console.log('');
    }

    // 4.2 翻译完整但工具数不足的标签
    const thinContentResult = await db.execute(sql`
      WITH tag_translation_status AS (
        SELECT
          tt.slug,
          tt.usage_count,
          tt.category,
          COUNT(DISTINCT ttt.locale) FILTER (WHERE ttt.locale IN ('en', 'zh')) as translation_count
        FROM tool_tags tt
        LEFT JOIN tool_tag_translations ttt ON tt.slug = ttt.slug
        GROUP BY tt.slug, tt.usage_count, tt.category
      )
      SELECT slug, usage_count, category
      FROM tag_translation_status
      WHERE translation_count = 2
        AND usage_count > 0
        AND usage_count < ${MIN_TOOLS_FOR_PUBLISH}
      ORDER BY usage_count DESC
      LIMIT 20
    `);

    if (thinContentResult && thinContentResult.length > 0) {
      console.log(
        `⚠️  翻译完整但工具数不足的标签（< ${MIN_TOOLS_FOR_PUBLISH}，前 20 个）:`
      );
      for (const row of thinContentResult as any[]) {
        console.log(
          `  - ${row.slug} (${row.category}): ${row.usage_count} 次使用`
        );
      }
      console.log('');
    }

    console.log('✅ 标签状态更新完成！');
    return {
      success: true,
      updatedCount: result.count ?? 0,
      missingTranslations: missingTranslationsResult?.length || 0,
      thinContent: thinContentResult?.length || 0,
    };
  } catch (error) {
    console.error('❌ 更新标签状态失败:', error);
    throw error;
  }
}

/**
 * 获取未使用的标签
 */
export async function getUnusedTags() {
  const result = await db.execute(sql`
    SELECT slug, category, created_at
    FROM tool_tags
    WHERE usage_count = 0
    ORDER BY created_at DESC
  `);

  return getExecuteRows(result);
}

/**
 * 获取薄内容标签（使用次数 < 阈值）
 */
export async function getThinContentTags() {
  const result = await db.execute(sql`
    SELECT slug, category, usage_count, status
    FROM tool_tags
    WHERE usage_count > 0 AND usage_count < ${MIN_TOOLS_FOR_PUBLISH}
    ORDER BY usage_count DESC
  `);

  return getExecuteRows(result);
}

/**
 * 获取缺少翻译的标签
 */
export async function getTagsMissingTranslations() {
  const result = await db.execute(sql`
    WITH tag_translation_status AS (
      SELECT
        tt.slug,
        tt.usage_count,
        tt.category,
        tt.status,
        COUNT(DISTINCT ttt.locale) FILTER (WHERE ttt.locale = 'en') as has_en,
        COUNT(DISTINCT ttt.locale) FILTER (WHERE ttt.locale = 'zh') as has_zh
      FROM tool_tags tt
      LEFT JOIN tool_tag_translations ttt ON tt.slug = ttt.slug
      GROUP BY tt.slug, tt.usage_count, tt.category, tt.status
    )
    SELECT
      slug,
      usage_count,
      category,
      status,
      CASE
        WHEN has_en = 0 AND has_zh = 0 THEN 'both'
        WHEN has_en = 0 THEN 'en'
        WHEN has_zh = 0 THEN 'zh'
      END as missing_locale
    FROM tag_translation_status
    WHERE has_en = 0 OR has_zh = 0
    ORDER BY usage_count DESC, slug ASC
  `);

  return getExecuteRows(result);
}

/**
 * 检查单个标签的翻译完整性
 */
export async function checkTagTranslationCompleteness(slug: string) {
  const result = await db.execute(sql`
    SELECT
      tt.slug,
      tt.usage_count,
      tt.category,
      tt.status,
      COUNT(DISTINCT ttt.locale) FILTER (WHERE ttt.locale = 'en') as has_en,
      COUNT(DISTINCT ttt.locale) FILTER (WHERE ttt.locale = 'zh') as has_zh
    FROM tool_tags tt
    LEFT JOIN tool_tag_translations ttt ON tt.slug = ttt.slug
    WHERE tt.slug = ${slug}
    GROUP BY tt.slug, tt.usage_count, tt.category, tt.status
  `);

  const rows = getExecuteRows(result);

  if (rows.length === 0) {
    return null;
  }

  const row = rows[0] as any;
  return {
    slug: row.slug,
    usageCount: row.usage_count,
    category: row.category,
    status: row.status,
    hasEnTranslation: row.has_en > 0,
    hasZhTranslation: row.has_zh > 0,
    isComplete: row.has_en > 0 && row.has_zh > 0,
    canPublish:
      row.has_en > 0 &&
      row.has_zh > 0 &&
      row.usage_count >= MIN_TOOLS_FOR_PUBLISH,
  };
}

// 如果直接运行此脚本
if (require.main === module) {
  updateTagStatusBasedOnUsage()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
