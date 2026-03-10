// 环境变量加载器
// 在所有脚本开始时导入此文件
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 加载 .env.local 文件
const result = config({ path: resolve(__dirname, '../../.env.local') });

if (result.error) {
  console.warn('⚠️  无法加载 .env.local 文件:', result.error.message);
} else {
  console.log('✓ 环境变量已加载');
}

// 验证关键环境变量
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL 环境变量未设置');
  process.exit(1);
}
