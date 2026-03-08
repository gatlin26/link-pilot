/**
 * 同步调度器（Background Script）
 */

import { syncRunnerService, syncSettingsStorage } from '@extension/storage';

const SYNC_ALARM_NAME = 'link-pilot-sync';

async function scheduleSyncAlarm(): Promise<void> {
  await chrome.alarms.clear(SYNC_ALARM_NAME);

  const settings = await syncSettingsStorage.get();
  const periodInMinutes = Math.max(1, settings.syncIntervalMinutes || 5);

  if (!settings.webAppUrl.trim()) {
    return;
  }

  await chrome.alarms.create(SYNC_ALARM_NAME, {
    delayInMinutes: periodInMinutes,
    periodInMinutes,
  });
}

chrome.runtime.onInstalled.addListener(() => {
  void scheduleSyncAlarm();
});

chrome.runtime.onStartup?.addListener(() => {
  void scheduleSyncAlarm();
});

chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name !== SYNC_ALARM_NAME) {
    return;
  }

  void syncRunnerService.processPendingJobs().catch(error => {
    console.error('定时同步失败:', error);
  });
});

import { messageRouter } from './message-router';

messageRouter.register('SYNC_SETTINGS_UPDATED', (message, sender, sendResponse) => {
  scheduleSyncAlarm()
    .then(() => sendResponse({ success: true }))
    .catch(error => sendResponse({ success: false, error: error.message }));
  return true; // 异步响应
});

void scheduleSyncAlarm();
