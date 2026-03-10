/**
 * 图片处理服务
 * 使用 Sharp 处理截图：调整大小、转换格式、压缩
 */

import sharp from 'sharp';

/**
 * 处理 Logo 图片
 * 调整为 200x200，保持比例，填充白色背景
 * 转换为 WebP 格式（质量 85%）
 *
 * @param buffer - 原始图片 Buffer
 * @returns 处理后的 Buffer
 */
export async function processLogo(buffer: Buffer): Promise<Buffer> {
  try {
    return await sharp(buffer)
      .resize(200, 200, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      })
      .webp({ quality: 85 })
      .toBuffer();
  } catch (error) {
    console.error('Failed to process logo:', error);
    throw new Error('图片处理失败');
  }
}

/**
 * 处理缩略图
 * 调整为 800x600，保持比例
 * 转换为 WebP 格式（质量 85%）
 *
 * @param buffer - 原始图片 Buffer
 * @returns 处理后的 Buffer
 */
export async function processThumbnail(buffer: Buffer): Promise<Buffer> {
  try {
    return await sharp(buffer)
      .resize(800, 600, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 85 })
      .toBuffer();
  } catch (error) {
    console.error('Failed to process thumbnail:', error);
    throw new Error('图片处理失败');
  }
}

/**
 * 获取图片信息
 * 用于调试和验证
 *
 * @param buffer - 图片 Buffer
 * @returns 图片元数据
 */
export async function getImageInfo(buffer: Buffer) {
  try {
    const metadata = await sharp(buffer).metadata();
    return {
      format: metadata.format,
      width: metadata.width,
      height: metadata.height,
      size: buffer.length,
    };
  } catch (error) {
    console.error('Failed to get image info:', error);
    return null;
  }
}
