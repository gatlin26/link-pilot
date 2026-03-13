import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const BUILD_VERSION_FILE = resolve(__dirname, '../.build-version');

/**
 * 获取递增的构建版本号
 * 格式: 0.5.0-n (n 每次编译+1)
 */
export function getBuildVersion(): string {
  // 读取 package.json 获取基础版本
  const packageJson = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf8'));
  const baseVersion = packageJson.version; // e.g., "0.5.0"

  // 读取或初始化构建计数
  let buildNumber = 1;
  if (existsSync(BUILD_VERSION_FILE)) {
    const content = readFileSync(BUILD_VERSION_FILE, 'utf8').trim();
    const match = content.match(/-(\d+)$/);
    if (match) {
      buildNumber = parseInt(match[1], 10) + 1;
    }
  }

  // 生成新版本号
  const version = `${baseVersion}-${buildNumber}`;

  // 保存构建计数
  writeFileSync(BUILD_VERSION_FILE, version, 'utf8');

  console.log(`[BuildVersion] Generated version: ${version}`);

  return version;
}

// 如果直接运行此脚本，输出版本号
if (require.main === module) {
  console.log(getBuildVersion());
}
