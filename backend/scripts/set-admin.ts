/**
 * 设置用户为管理员
 * 使用方法：
 *   pnpm tsx scripts/set-admin.ts <user-email>
 */

import { resolve } from 'path';
import dotenv from 'dotenv';

// 加载 .env.local 文件
dotenv.config({ path: resolve(process.cwd(), '.env.local') });
// 如果 .env.local 不存在，尝试加载 .env
if (!process.env.DATABASE_URL) {
  dotenv.config();
}

import { eq } from 'drizzle-orm';
import { getDb } from '../src/db';
import { user } from '../src/db/schema';

async function setAdminRole() {
  const email = process.argv[2];

  if (!email) {
    console.error('❌ 错误：请提供用户邮箱');
    console.log('');
    console.log('使用方法：');
    console.log('  pnpm tsx scripts/set-admin.ts <user-email>');
    process.exit(1);
  }

  try {
    const db = await getDb();

    // 查找用户
    console.log(`🔍 查找用户: ${email}`);
    const users = await db
      .select()
      .from(user)
      .where(eq(user.email, email))
      .limit(1);

    if (users.length === 0) {
      console.error(`❌ 用户不存在: ${email}`);
      process.exit(1);
    }

    const targetUser = users[0];
    console.log('');
    console.log('📋 用户信息:');
    console.log(`  ID: ${targetUser.id}`);
    console.log(`  Name: ${targetUser.name}`);
    console.log(`  Email: ${targetUser.email}`);
    console.log(`  Current Role: ${targetUser.role || '(无)'}`);
    console.log('');

    // 如果已经是 admin
    if (targetUser.role === 'admin') {
      console.log('ℹ️  该用户已经是管理员');
      process.exit(0);
    }

    // 设置为 admin
    console.log('🔧 设置为管理员...');
    await db
      .update(user)
      .set({
        role: 'admin',
        updatedAt: new Date(),
      })
      .where(eq(user.id, targetUser.id));

    console.log('✅ 成功！用户已设置为管理员');
    console.log('');
    console.log('💡 提示：');
    console.log('  - 用户需要重新登录才能获得管理员权限');
    console.log('  - 管理员可以访问 /admin/users 管理页面');
  } catch (error) {
    console.error('❌ 错误:', error);
    process.exit(1);
  }
}

setAdminRole();
