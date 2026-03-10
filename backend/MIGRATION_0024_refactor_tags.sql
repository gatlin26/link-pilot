-- ============================================================================
-- 标签表重构：拆分为主表和翻译表
-- 执行前请务必备份数据库！
-- ============================================================================

BEGIN;

-- 步骤 1: 创建新的主表 tool_tags_new
CREATE TABLE tool_tags_new (
  id text PRIMARY KEY NOT NULL,
  slug text NOT NULL UNIQUE,
  category text,
  status text DEFAULT 'draft',
  sort_order integer DEFAULT 0,
  usage_count integer DEFAULT 0,
  created_at timestamp DEFAULT now() NOT NULL,
  updated_at timestamp DEFAULT now() NOT NULL
);

-- 步骤 2: 创建翻译表 tool_tag_translations
CREATE TABLE tool_tag_translations (
  id text PRIMARY KEY NOT NULL,
  slug text NOT NULL,
  locale text NOT NULL,
  name text NOT NULL,
  description text,
  content text,
  created_at timestamp DEFAULT now() NOT NULL,
  updated_at timestamp DEFAULT now() NOT NULL,
  UNIQUE(slug, locale)
);

-- 步骤 3: 迁移数据到主表（每个 slug 只保留一条记录）
INSERT INTO tool_tags_new (
  id, slug, category, status, sort_order, usage_count, created_at, updated_at
)
SELECT DISTINCT ON (slug)
  id,
  slug,
  category,
  -- 状态字段转换逻辑
  CASE
    WHEN published = true THEN 'published'
    WHEN is_active = false THEN 'archived'
    ELSE 'draft'
  END as status,
  sort_order,
  usage_count,
  created_at,
  updated_at
FROM tool_tags
ORDER BY slug, locale ASC; -- 优先选择英文版本

-- 步骤 4: 迁移数据到翻译表
INSERT INTO tool_tag_translations (
  id, slug, locale, name, description, content, created_at, updated_at
)
SELECT
  gen_random_uuid()::text as id,
  slug,
  locale,
  name,
  description,
  content,
  created_at,
  updated_at
FROM tool_tags;

-- 步骤 5: 删除旧表
DROP TABLE tool_tags CASCADE;

-- 步骤 6: 重命名新表
ALTER TABLE tool_tags_new RENAME TO tool_tags;

-- 步骤 7: 添加外键约束到翻译表
ALTER TABLE tool_tag_translations
  ADD CONSTRAINT tool_tag_translations_slug_fk
  FOREIGN KEY (slug) REFERENCES tool_tags(slug) ON DELETE CASCADE;

-- 步骤 8: 创建索引
-- 主表索引
CREATE INDEX tool_tags_slug_idx ON tool_tags (slug);
CREATE INDEX tool_tags_category_idx ON tool_tags (category);
CREATE INDEX tool_tags_status_idx ON tool_tags (status);
CREATE INDEX tool_tags_usage_count_idx ON tool_tags (usage_count);
CREATE INDEX tool_tags_sort_order_idx ON tool_tags (sort_order);

-- 翻译表索引
CREATE INDEX tool_tag_translations_slug_idx ON tool_tag_translations (slug);
CREATE INDEX tool_tag_translations_locale_idx ON tool_tag_translations (locale);
CREATE INDEX tool_tag_translations_slug_locale_idx ON tool_tag_translations (slug, locale);

-- 步骤 9: 验证数据完整性
DO $$
DECLARE
  main_count integer;
  translation_count integer;
  expected_translation_count integer;
BEGIN
  SELECT COUNT(*) INTO main_count FROM tool_tags;
  SELECT COUNT(*) INTO translation_count FROM tool_tag_translations;

  -- 假设每个标签有 2 种语言（en 和 zh）
  expected_translation_count := main_count * 2;

  RAISE NOTICE '========================================';
  RAISE NOTICE '标签表重构完成！';
  RAISE NOTICE '主表记录数：%', main_count;
  RAISE NOTICE '翻译表记录数：%', translation_count;
  RAISE NOTICE '预期翻译记录数：%', expected_translation_count;

  IF translation_count < main_count THEN
    RAISE WARNING '警告：翻译表记录数少于主表记录数，可能有标签缺少翻译';
  END IF;

  RAISE NOTICE '========================================';
END $$;

COMMIT;

-- 迁移完成后，建议运行以下查询验证数据：
-- SELECT COUNT(*) FROM tool_tags;
-- SELECT COUNT(*) FROM tool_tag_translations;
-- SELECT slug, COUNT(*) as translation_count FROM tool_tag_translations GROUP BY slug HAVING COUNT(*) != 2;
