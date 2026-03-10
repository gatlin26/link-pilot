/**
 * 移除用户的管理员权限
 * 使用方法：
 *   pnpm tsx scripts/remove-admin.ts <user-email>
 */

import { eq } from 'drizzle-orm';
import { getDb } from '../src/db';
import { user } from '../src/db/schema';

async function removeAdmin() {
  const email = process.argv[2];

  if (!email) {
    console.error('❌ 错误：请提供用户邮箱');
    console.log('');
    console.log('使用方法：');
    console.log('  pnpm tsx scripts/remove-admin.ts <user-email>');
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

    // 如果不是 admin，提示并退出
    if (targetUser.role !== 'admin') {
      console.log('ℹ️  该用户不是管理员');
      process.exit(0);
    }

    // 移除 admin 角色
    console.log('🔧 移除管理员权限...');
    await db
      .update(user)
      .set({
        role: null,
        updatedAt: new Date(),
      })
      .where(eq(user.id, targetUser.id));

    console.log('✅ 成功！已移除管理员权限');
  } catch (error) {
    console.error('❌ 错误:', error);
    process.exit(1);
  }
}

removeAdmin();
