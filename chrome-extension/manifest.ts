import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const BUILD_VERSION_FILE = resolve(import.meta.dirname, '.build-version');

/**
 * 获取递增的构建版本号
 * 格式: 0.5.0.n (n 每次编译+1，使用点号分隔以符合 Chrome 规范)
 */
function getBuildVersion(): string {
  // 读取 package.json 获取基础版本
  const packageJson = JSON.parse(readFileSync(resolve(import.meta.dirname, 'package.json'), 'utf8'));
  const baseVersion = packageJson.version; // e.g., "0.5.0"

  // 读取或初始化构建计数
  let buildNumber = 1;
  if (existsSync(BUILD_VERSION_FILE)) {
    const content = readFileSync(BUILD_VERSION_FILE, 'utf8').trim();
    const match = content.match(/\.(\d+)$/);
    if (match) {
      buildNumber = parseInt(match[1], 10) + 1;
    }
  }

  // 生成新版本号 (四段式，符合 Chrome 规范)
  const version = `${baseVersion}.${buildNumber}`;

  // 保存构建计数
  writeFileSync(BUILD_VERSION_FILE, version, 'utf8');

  console.log(`[BuildVersion] Generated version: ${version}`);

  return version;
}

import type { ManifestType } from '@extension/shared';

/**
 * @prop default_locale
 * if you want to support multiple languages, you can use the following reference
 * https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Internationalization
 *
 * @prop browser_specific_settings
 * Must be unique to your extension to upload to addons.mozilla.org
 * (you can delete if you only want a chrome extension)
 *
 * @prop permissions
 * Firefox doesn't support sidePanel (It will be deleted in manifest parser)
 *
 * @prop content_scripts
 * css: ['content.css'], // public folder
 */
const manifest = {
  manifest_version: 3,
  default_locale: 'en',
  name: '__MSG_extensionName__',
  browser_specific_settings: {
    gecko: {
      id: 'example@example.com',
      strict_min_version: '109.0',
    },
  },
  version: getBuildVersion(),
  description: '__MSG_extensionDescription__',
  host_permissions: ['<all_urls>'],
  permissions: ['storage', 'scripting', 'tabs', 'notifications', 'sidePanel', 'alarms', 'webRequest'],
  options_page: 'options/index.html',
  background: {
    service_worker: 'background.js',
    type: 'module',
  },
  action: {
    default_icon: 'icon-34.png',
  },
  chrome_url_overrides: {
    newtab: 'new-tab/index.html',
  },
  icons: {
    '128': 'icon-128.png',
  },
  content_scripts: [
    {
      matches: ['http://*/*', 'https://*/*', '<all_urls>'],
      js: ['content/all.iife.js'],
    },
    {
      matches: ['https://example.com/*'],
      js: ['content/example.iife.js'],
    },
    {
      matches: ['http://*/*', 'https://*/*', '<all_urls>'],
      js: ['content-ui/all.iife.js'],
    },
    {
      matches: ['https://example.com/*'],
      js: ['content-ui/example.iife.js'],
    },
    {
      matches: ['http://*/*', 'https://*/*', '<all_urls>'],
      css: ['content.css'],
    },
    {
      matches: ['https://ahrefs.com/*', 'https://*.ahrefs.com/*'],
      js: ['ahrefs-main-bridge.js'],
      world: 'MAIN',
      run_at: 'document_start',
    },
  ],
  devtools_page: 'devtools/index.html',
  web_accessible_resources: [
    {
      resources: ['*.js', '*.css', '*.svg', '*.html', 'icon-128.png', 'icon-34.png'],
      matches: ['*://*/*'],
    },
  ],
  side_panel: {
    default_path: 'side-panel/index.html',
  },
} satisfies ManifestType;

export default manifest;
