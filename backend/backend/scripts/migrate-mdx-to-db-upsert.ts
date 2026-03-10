/**
 * MDX 工具数据迁移脚本（支持 UPSERT）
 * 将现有 MDX 文件中的工具数据迁移到数据库
 * 支持插入新数据和更新已有数据
 *
 * 使用方法：
 *   pnpm tsx scripts/migrate-mdx-to-db-upsert.ts
 *   pnpm tsx scripts/migrate-mdx-to-db-upsert.ts --dry-run  # 仅预览，不执行
 */

import { resolve } from 'path';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config({ path: resolve(process.cwd(), '.env.local') });
if (!process.env.DATABASE_URL) {
  dotenv.config();
}

import fs from 'fs';
import path from 'path';
import { and, eq } from 'drizzle-orm';
import matter from 'gray-matter';
import { nanoid } from 'nanoid';
import { getDb } from '../src/db';
import { toolTranslations, tools } from '../src/db/schema';

interface ToolFrontmatter {
  id: string;
  name: string;
  title: string;
  description: string;
  category: string[];
  tags: string[];
  published: boolean;
  featured: boolean;
  href: string;
  url: string;
  image: string;
  thumbnailUrl: string;
  collectionTime: string;
  starRating: number;
  badge?: string;
  order?: number;
}

interface ToolData {
  en?: {
    frontmatter: ToolFrontmatter;
    content: string;
  };
  zh?: {
    frontmatter: ToolFrontmatter;
    content: string;
  };
}

interface MigrationStats {
  toolsInserted: number;
  toolsUpdated: number;
  toolsSkipped: number;
  translationsInserted: number;
  translationsUpdated: number;
  errors: number;
}

async function migrateMdxToDb() {
  const isDryRun = process.argv.includes('--dry-run');

  if (isDryRun) {
    console.log('🔍 DRY RUN 模式 - 仅预览，不执行数据库操作\n');
  }

  const toolsDir = path.join(process.cwd(), 'content/tools');

  // 检查目录是否存在
  if (!fs.existsSync(toolsDir)) {
    console.error(`❌ 目录不存在: ${toolsDir}`);
    process.exit(1);
  }

  const files = fs.readdirSync(toolsDir);
  const mdxFiles = files.filter((f) => f.endsWith('.mdx'));

  console.log(`📁 找到 ${mdxFiles.length} 个 MDX 文件\n`);

  // 分组：英文和中文文件
  const toolMap = new Map<string, ToolData>();

  for (const file of mdxFiles) {
    const isZh = file.endsWith('.zh.mdx');
    const slug = file.replace('.zh.mdx', '').replace('.mdx', '');

    const filePath = path.join(toolsDir, file);
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const { data, content } = matter(fileContent);

    if (!toolMap.has(slug)) {
      toolMap.set(slug, {});
    }

    const entry = toolMap.get(slug)!;
    const parsed = {
      frontmatter: data as ToolFrontmatter,
      content: content.trim(),
    };

    if (isZh) {
      entry.zh = parsed;
    } else {
      entry.en = parsed;
    }
  }

  console.log(`🔧 解析出 ${toolMap.size} 个工具\n`);

  if (isDryRun) {
    // 预览模式：显示将要插入/更新的数据
    console.log('📋 将要处理的工具:\n');
    let index = 0;
    for (const [slug, data] of toolMap) {
      index++;
      const en = data.en?.frontmatter;
      const zh = data.zh?.frontmatter;
      const name = en?.name || zh?.name || slug;

      console.log(`${index}. ${name} (${slug})`);
      console.log(`   URL: ${en?.url || zh?.url}`);
      console.log(`   EN: ${en ? '✓' : '✗'} | ZH: ${zh ? '✓' : '✗'}`);
      console.log('');
    }

    console.log('✅ DRY RUN 完成');
    console.log('💡 移除 --dry-run 参数以执行实际迁移');
    return;
  }

  // 实际迁移
  const db = await getDb();
  const stats: MigrationStats = {
    toolsInserted: 0,
    toolsUpdated: 0,
    toolsSkipped: 0,
    translationsInserted: 0,
    translationsUpdated: 0,
    errors: 0,
  };

  for (const [slug, data] of toolMap) {
    try {
      const en = data.en?.frontmatter;
      const zh = data.zh?.frontmatter;

      // 使用英文数据为主，中文为备选
      const name = en?.name || zh?.name || slug;
      const url = en?.url || zh?.url || '';

      if (!url) {
        console.log(`⚠️  跳过 ${slug}: 缺少 URL`);
        stats.toolsSkipped++;
        continue;
      }

      // 1. 检查工具是否已存在
      const existingTools = await db
        .select()
        .from(tools)
        .where(eq(tools.slug, slug))
        .limit(1);

      let toolId: string;
      let isNewTool = false;

      if (existingTools.length > 0) {
        // 更新现有工具
        toolId = existingTools[0].id;
        await db
          .update(tools)
          .set({
            name,
            url,
            categories: JSON.stringify(en?.category || zh?.category || []),
            tags: JSON.stringify(en?.tags || zh?.tags || []),
            starRating: en?.starRating || zh?.starRating || 5,
            featured: en?.featured || zh?.featured || false,
            published: en?.published ?? zh?.published ?? true,
            imageUrl: en?.image || zh?.image || null,
            thumbnailUrl: en?.thumbnailUrl || zh?.thumbnailUrl || null,
            collectionTime:
              en?.collectionTime || zh?.collectionTime
                ? new Date(en?.collectionTime || zh?.collectionTime || '')
                : new Date(),
            updatedAt: new Date(),
          })
          .where(eq(tools.id, toolId));

        console.log(`🔄 更新工具: ${name} (${slug})`);
        stats.toolsUpdated++;
      } else {
        // 插入新工具
        toolId = nanoid();
        isNewTool = true;
        await db.insert(tools).values({
          id: toolId,
          slug,
          name,
          url,
          categories: JSON.stringify(en?.category || zh?.category || []),
          tags: JSON.stringify(en?.tags || zh?.tags || []),
          starRating: en?.starRating || zh?.starRating || 5,
          featured: en?.featured || zh?.featured || false,
          published: en?.published ?? zh?.published ?? true,
          imageUrl: en?.image || zh?.image || null,
          thumbnailUrl: en?.thumbnailUrl || zh?.thumbnailUrl || null,
          collectionTime:
            en?.collectionTime || zh?.collectionTime
              ? new Date(en?.collectionTime || zh?.collectionTime || '')
              : new Date(),
        });

        console.log(`✨ 创建工具: ${name} (${slug})`);
        stats.toolsInserted++;
      }

      // 2. 处理英文翻译
      if (data.en) {
        const existingEnTranslation = await db
          .select()
          .from(toolTranslations)
          .where(
            and(
              eq(toolTranslations.toolId, toolId),
              eq(toolTranslations.locale, 'en')
            )
          )
          .limit(1);

        if (existingEnTranslation.length > 0) {
          // 更新英文翻译
          await db
            .update(toolTranslations)
            .set({
              title: data.en.frontmatter.title,
              description: data.en.frontmatter.description,
              introduction: data.en.content,
              updatedAt: new Date(),
            })
            .where(eq(toolTranslations.id, existingEnTranslation[0].id));

          console.log(`  🔄 更新英文翻译`);
          stats.translationsUpdated++;
        } else {
          // 插入英文翻译
          await db.insert(toolTranslations).values({
            id: nanoid(),
            toolId,
            locale: 'en',
            title: data.en.frontmatter.title,
            description: data.en.frontmatter.description,
            introduction: data.en.content,
          });

          console.log(`  ✨ 添加英文翻译`);
          stats.translationsInserted++;
        }
      }

      // 3. 处理中文翻译
      if (data.zh) {
        const existingZhTranslation = await db
          .select()
          .from(toolTranslations)
          .where(
            and(
              eq(toolTranslations.toolId, toolId),
              eq(toolTranslations.locale, 'zh')
            )
          )
          .limit(1);

        if (existingZhTranslation.length > 0) {
          // 更新中文翻译
          await db
            .update(toolTranslations)
            .set({
              title: data.zh.frontmatter.title,
              description: data.zh.frontmatter.description,
              introduction: data.zh.content,
              updatedAt: new Date(),
            })
            .where(eq(toolTranslations.id, existingZhTranslation[0].id));

          console.log(`  🔄 更新中文翻译`);
          stats.translationsUpdated++;
        } else {
          // 插入中文翻译
          await db.insert(toolTranslations).values({
            id: nanoid(),
            toolId,
            locale: 'zh',
            title: data.zh.frontmatter.title,
            description: data.zh.frontmatter.description,
            introduction: data.zh.content,
          });

          console.log(`  ✨ 添加中文翻译`);
          stats.translationsInserted++;
        }
      }
    } catch (error) {
      console.error(`❌ 迁移失败 ${slug}:`, error);
      stats.errors++;
    }
  }

  console.log('\n========================================');
  console.log('✅ 迁移完成');
  console.log('========================================');
  console.log(`📊 统计信息:`);
  console.log(
    `   工具 - 新增: ${stats.toolsInserted} | 更新: ${stats.toolsUpdated} | 跳过: ${stats.toolsSkipped}`
  );
  console.log(
    `   翻译 - 新增: ${stats.translationsInserted} | 更新: ${stats.translationsUpdated}`
  );
  console.log(`   错误: ${stats.errors}`);
  console.log('========================================\n');

  if (stats.errors > 0) {
    process.exit(1);
  }
}

migrateMdxToDb().catch((error) => {
  console.error('❌ 迁移脚本执行失败:', error);
  process.exit(1);
});
