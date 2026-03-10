-- 修复标签分类字段：将中文值转换为英文值
-- 这个迁移脚本修复了之前错误使用中文 category 值的问题

-- 更新所有使用中文分类的标签
UPDATE tool_tags SET category = 'type', updated_at = now() WHERE category = '类型';
UPDATE tool_tags SET category = 'pricing', updated_at = now() WHERE category = '定价';
UPDATE tool_tags SET category = 'platform', updated_at = now() WHERE category = '平台';
UPDATE tool_tags SET category = 'feature', updated_at = now() WHERE category = '功能';
UPDATE tool_tags SET category = 'general', updated_at = now() WHERE category = '通用';
UPDATE tool_tags SET category = 'other', updated_at = now() WHERE category = '其他';
