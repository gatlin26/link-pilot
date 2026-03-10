/**
 * @file migrate-avatars.ts
 * @description 迁移现有用户的头像到 R2 存储
 * @author git.username
 * @date 2025-12-20
 *
 * 使用方法：
 * npx tsx scripts/migrate-avatars.ts
 */

import { getDb } from '@/db/index';
import { user } from '@/db/schema';
import { downloadAndCacheAvatar } from '@/lib/avatar-cache';
import { eq, isNotNull, notLike } from 'drizzle-orm';

async function migrateAvatars() {
  console.log('=== 开始迁移用户头像到 R2 ===\n');

  const db = await getDb();
  const publicUrl = process.env.STORAGE_PUBLIC_URL || '';

  // 查询所有有头像且头像不是我们自己 R2 URL 的用户
  console.log('1. 查询需要迁移的用户...');

  let whereCondition = isNotNull(user.image);
  if (publicUrl) {
    whereCondition = notLike(user.image, `%${publicUrl}%`);
  }

  const users = await db
    .select({
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
    })
    .from(user)
    .where(whereCondition);

  console.log(`   找到 ${users.length} 个需要迁移的用户\n`);

  if (users.length === 0) {
    console.log('✅ 没有需要迁移的用户');
    return;
  }

  // 询问是否继续
  console.log('2. 开始迁移...\n');

  let successCount = 0;
  let failCount = 0;
  let skipCount = 0;

  for (let i = 0; i < users.length; i++) {
    const currentUser = users[i];
    const progress = `[${i + 1}/${users.length}]`;

    if (!currentUser.image) {
      skipCount++;
      continue;
    }

    try {
      console.log(
        `${progress} 处理用户: ${currentUser.email} (${currentUser.id})`
      );
      console.log(`   原始头像: ${currentUser.image}`);

      const cachedUrl = await downloadAndCacheAvatar(
        currentUser.image,
        currentUser.id
      );

      if (cachedUrl !== currentUser.image) {
        // 更新数据库
        await db
          .update(user)
          .set({ image: cachedUrl })
          .where(eq(user.id, currentUser.id));

        console.log(`   ✅ 缓存成功: ${cachedUrl}\n`);
        successCount++;
      } else {
        console.log(`   ⚠️  跳过：头像未改变\n`);
        skipCount++;
      }
    } catch (error) {
      console.error(
        `   ❌ 失败: ${error instanceof Error ? error.message : '未知错误'}\n`
      );
      failCount++;
    }

    // 添加延迟避免请求过快
    if (i < users.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  console.log('\n=== 迁移完成 ===');
  console.log(`总计: ${users.length} 个用户`);
  console.log(`成功: ${successCount} 个`);
  console.log(`失败: ${failCount} 个`);
  console.log(`跳过: ${skipCount} 个`);
}

migrateAvatars()
  .then(() => {
    console.log('\n脚本执行完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n脚本执行失败:', error);
    process.exit(1);
  });
