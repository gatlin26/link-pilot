/**
 * @file avatar-cache.ts
 * @description 用户头像缓存到 R2 存储的工具函数
 * @author git.username
 * @date 2025-12-20
 */

import { randomUUID } from 'crypto';
import { uploadFile } from '@/storage';

/**
 * 从 URL 下载头像并上传到 R2 存储
 * @param avatarUrl 原始头像 URL（如 Google、GitHub 等）
 * @param userId 用户 ID，用于日志记录
 * @returns 上传后的 R2 URL，失败时返回原始 URL
 */
export async function downloadAndCacheAvatar(
  avatarUrl: string,
  userId: string
): Promise<string> {
  try {
    // 检查是否是有效的 URL
    if (!avatarUrl || !avatarUrl.startsWith('http')) {
      console.warn(`Invalid avatar URL for user ${userId}:`, avatarUrl);
      return avatarUrl;
    }

    // 检查是否已经是我们自己的 R2 URL（避免重复下载）
    const publicUrl = process.env.STORAGE_PUBLIC_URL;
    if (publicUrl && avatarUrl.includes(publicUrl)) {
      console.log(`Avatar already cached for user ${userId}`);
      return avatarUrl;
    }

    console.log(`Downloading avatar for user ${userId} from:`, avatarUrl);

    // 下载头像
    const response = await fetch(avatarUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to download avatar: ${response.status} ${response.statusText}`
      );
    }

    // 获取内容类型
    const contentType = response.headers.get('content-type') || 'image/jpeg';

    // 确定文件扩展名
    let extension = 'jpg';
    if (contentType.includes('png')) {
      extension = 'png';
    } else if (contentType.includes('webp')) {
      extension = 'webp';
    } else if (contentType.includes('gif')) {
      extension = 'gif';
    }

    // 转换为 Buffer
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 生成随机文件名
    const randomFilename = `${randomUUID()}.${extension}`;

    console.log(
      `Uploading avatar for user ${userId}, size: ${buffer.length} bytes`
    );

    // 上传到 R2 的 avatar 目录
    const result = await uploadFile(
      buffer,
      randomFilename,
      contentType,
      'avatar'
    );

    console.log(`Avatar cached successfully for user ${userId}:`, result.url);

    return result.url;
  } catch (error) {
    console.error(`Failed to cache avatar for user ${userId}:`, error);
    // 失败时返回原始 URL，确保不影响用户登录
    return avatarUrl;
  }
}

/**
 * 批量缓存多个用户的头像
 * @param users 用户数组，包含 id 和 image 字段
 * @returns 更新后的用户数组
 */
export async function batchCacheAvatars<
  T extends { id: string; image: string | null },
>(users: T[]): Promise<T[]> {
  const promises = users.map(async (user) => {
    if (!user.image) return user;

    const cachedUrl = await downloadAndCacheAvatar(user.image, user.id);
    return {
      ...user,
      image: cachedUrl,
    };
  });

  return Promise.all(promises);
}
