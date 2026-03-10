/**
 * @file image-utils.ts
 * @description 图片处理工具函数 - WebP 转换、压缩等
 * @author git.username
 * @date 2026-02-03
 */

/**
 * 检查浏览器是否支持 WebP 格式
 * @returns 是否支持 WebP
 */
export function supportsWebP(): boolean {
  if (typeof window === 'undefined') return false;

  const canvas = document.createElement('canvas');
  if (!canvas.getContext || !canvas.getContext('2d')) {
    return false;
  }

  return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
}

/**
 * 将图片文件转换为 WebP 格式
 * @param file - 原始图片文件 (JPEG, PNG)
 * @param quality - 质量参数 (0-1)，默认 0.85
 * @returns WebP 格式的 File 对象
 */
export async function convertImageToWebP(
  file: File,
  quality = 0.85
): Promise<File> {
  // 如果已经是 WebP 格式，直接返回
  if (file.type === 'image/webp') {
    return file;
  }

  // 检查浏览器支持
  if (!supportsWebP()) {
    console.warn('Browser does not support WebP, returning original file');
    return file;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      reject(new Error('Failed to get canvas context'));
      return;
    }

    img.onload = () => {
      try {
        // 设置 canvas 尺寸为图片原始尺寸
        canvas.width = img.width;
        canvas.height = img.height;

        // 绘制图片到 canvas
        ctx.drawImage(img, 0, 0);

        // 转换为 WebP Blob
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to convert image to WebP'));
              return;
            }

            // 创建新的 File 对象
            const webpFile = new File(
              [blob],
              file.name.replace(/\.[^.]+$/, '.webp'),
              {
                type: 'image/webp',
                lastModified: Date.now(),
              }
            );

            // 清理 ObjectURL
            URL.revokeObjectURL(img.src);

            resolve(webpFile);
          },
          'image/webp',
          quality
        );
      } catch (error) {
        URL.revokeObjectURL(img.src);
        reject(
          error instanceof Error ? error : new Error('Failed to convert image')
        );
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error('Failed to load image'));
    };

    // 加载图片
    img.src = URL.createObjectURL(file);
  });
}

/**
 * 批量转换图片为 WebP 格式
 * @param files - 图片文件数组
 * @param quality - 质量参数 (0-1)，默认 0.85
 * @returns WebP 格式的 File 对象数组
 */
export async function convertImagesToWebP(
  files: File[],
  quality = 0.85
): Promise<File[]> {
  const promises = files.map((file) => convertImageToWebP(file, quality));
  return Promise.all(promises);
}

/**
 * 验证图片文件类型
 * @param file - 文件对象
 * @returns 是否为有效的图片类型
 */
export function isValidImageType(file: File): boolean {
  const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
  return validTypes.includes(file.type);
}

/**
 * 验证图片文件大小
 * @param file - 文件对象
 * @param maxSizeMB - 最大文件大小（MB）
 * @returns 是否在大小限制内
 */
export function isValidImageSize(file: File, maxSizeMB: number): boolean {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  return file.size <= maxSizeBytes;
}

/**
 * 格式化文件大小
 * @param bytes - 字节数
 * @returns 格式化后的文件大小字符串
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${Number.parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
}
