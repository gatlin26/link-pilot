/**
 * 检查 toolReferences 表中的数据
 */

import { resolve } from 'node:path';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config({ path: resolve(process.cwd(), '.env.local') });
if (!process.env.DATABASE_URL) {
  dotenv.config();
}

import { getDb } from '../src/db';

async function checkToolReferences() {
  const db = await getDb();

  try {
    console.log('📊 正在查询 toolReferences 表...\n');

    const references = await db.query.toolReferences.findMany({
      limit: 10,
    });

    console.log(`找到 ${references.length} 条参考记录\n`);

    if (references.length > 0) {
      console.log('前 10 条记录：\n');
      for (const ref of references) {
        console.log(`- 工具ID: ${ref.toolId || '未关联'}`);
        console.log(`  URL: ${ref.url}`);
        console.log(`  来源: ${ref.source}`);
        console.log(`  状态: ${ref.status}`);
        console.log(`  内容长度: ${ref.rawContent?.length || 0} 字符`);
        console.log(`  抓取时间: ${ref.fetchedAt}\n`);
      }
    } else {
      console.log('⚠️  toolReferences 表中没有数据');
      console.log('这是正常的，因为还没有执行过抓取操作\n');
    }

    // 统计信息
    const stats = await db.query.toolReferences.findMany();
    console.log('========================================');
    console.log('📊 统计信息');
    console.log('========================================');
    console.log(`总记录数: ${stats.length}`);
    console.log(
      `成功抓取: ${stats.filter((r) => r.status === 'success').length}`
    );
    console.log(`失败: ${stats.filter((r) => r.status === 'failed').length}`);
    console.log('========================================\n');
  } catch (error) {
    console.error('❌ 查询失败:', error);
    process.exit(1);
  }
}

// 执行查询
checkToolReferences()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
