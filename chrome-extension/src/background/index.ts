import 'webextension-polyfill';
import { exampleThemeStorage } from '@extension/storage';
import { messageRouter } from './message-router';

import './context-manager';
import './error-logger';
import './sync-manager';
import './collection-manager';
import './web-request-manager';
import './submission-session-manager';
import './recursive-collection-manager';

const initStorageAccess = async () => {
  try {
    await chrome.storage.session.setAccessLevel({
      accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS',
    });
    console.log('[Background] Session storage access enabled for content scripts');
  } catch (error) {
    console.error('[Background] Failed to configure session storage access:', error);
  }
};

// 初始化消息路由器
messageRouter.init();
console.log('[Background] Message router initialized');

// 初始化存储访问
initStorageAccess();

exampleThemeStorage.get().then(theme => {
  console.log('[Background] Theme loaded:', theme);
});

console.log('[Background] Background script loaded');
