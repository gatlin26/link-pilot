import { resolve } from 'node:path';
import { defineConfig, type PluginOption } from 'vite';
import libAssetsPlugin from '@laynezh/vite-plugin-lib-assets';
import makeManifestPlugin from './utils/plugins/make-manifest-plugin.js';
import { watchPublicPlugin, watchRebuildPlugin } from '@extension/hmr';
import { watchOption } from '@extension/vite-config';
import env, { IS_DEV, IS_PROD } from '@extension/env';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

const rootDir = resolve(import.meta.dirname);
const srcDir = resolve(rootDir, 'src');

const outDir = resolve(rootDir, '..', 'dist');

// 检查是否构建主世界桥接脚本
const isBuildingBridge = process.env.BUILD_TARGET === 'ahrefs-bridge';

export default defineConfig({
  define: {
    'process.env': env,
  },
  resolve: {
    alias: {
      '@root': rootDir,
      '@src': srcDir,
      '@assets': resolve(srcDir, 'assets'),
    },
  },
  plugins: [
    libAssetsPlugin({
      outputPath: outDir,
    }) as PluginOption,
    watchPublicPlugin(),
    !isBuildingBridge && makeManifestPlugin({ outDir }),
    IS_DEV && watchRebuildPlugin({ reload: true, id: 'chrome-extension-hmr' }),
    nodePolyfills(),
  ].filter(Boolean),
  publicDir: resolve(rootDir, 'public'),
  build: {
    lib: isBuildingBridge
      ? {
          name: 'AhrefsMainBridge',
          fileName: () => 'ahrefs-main-bridge.js',
          formats: ['iife'],
          entry: resolve(srcDir, 'ahrefs-main-bridge.ts'),
        }
      : {
          name: 'BackgroundScript',
          fileName: 'background',
          formats: ['es'],
          entry: resolve(srcDir, 'background', 'index.ts'),
        },
    outDir,
    emptyOutDir: false,
    sourcemap: IS_DEV,
    minify: IS_PROD,
    reportCompressedSize: IS_PROD,
    watch: watchOption,
    rollupOptions: {
      external: isBuildingBridge ? [] : ['chrome'],
    },
  },
});
