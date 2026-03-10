/**
 * 列出所有管理员
 * 使用方法：
 *   pnpm tsx scripts/list-admins.ts
 */

import { eq } from 'drizzle-orm';
import { getDb } from '../src/db';
import { user } from '../src/db/schema';

async function listAdmins() {
  try {
    const db = await getDb();

    console.log('🔍 查询所有管理员...');
    console.log('');

    const admins = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
      })
      .from(user)
      .where(eq(user.role, 'admin'));

    if (admins.length === 0) {
      console.log('📋 当前没有管理员');
      console.log('');
      console.log('💡 使用以下命令设置管理员：');
      console.log('  pnpm tsx scripts/set-admin.ts <user-email>');
      return;
    }

    console.log(`📋 管理员列表 (${admins.length}):`);
    console.log('');

    admins.forEach((admin, index) => {
      console.log(`${index + 1}. ${admin.name}`);
      console.log(`   Email: ${admin.email}`);
      console.log(`   ID: ${admin.id}`);
      console.log(`   Created: ${admin.createdAt.toISOString()}`);
      console.log('');
    });
  } catch (error) {
    console.error('❌ 错误:', error);
    process.exit(1);
  }
}

listAdmins();
