import { extensionSettingsStorage, managedBacklinkStorage, submissionSessionStorage } from '@extension/storage';
import { messageRouter } from './message-router';

async function openBacklinkInTab(backlinkId: string) {
  const backlink = await managedBacklinkStorage.getBacklinkById(backlinkId);

  if (!backlink) {
    throw new Error('外链不存在');
  }

  const tab = await chrome.tabs.create({ url: backlink.url, active: true });

  if (!tab.id) {
    throw new Error('无法打开外链标签页');
  }

  await submissionSessionStorage.updateSession({
    current_backlink_id: backlink.id,
    last_opened_at: new Date().toISOString(),
  });

  return backlink;
}

messageRouter.register('OPEN_NEXT_BACKLINKS', (message, _sender, sendResponse) => {
  (async () => {
    const settings = await extensionSettingsStorage.get();
    const session = await submissionSessionStorage.getSession();
    const requestedCount = Number(message?.payload?.count) || settings.next_backlink_count || 1;
    const count = Math.max(1, requestedCount);

    if (!session.queue_backlink_ids.length) {
      sendResponse({ success: false, error: '当前没有可打开的外链队列' });
      return;
    }

    const startIndex = Math.min(session.queue_cursor, session.queue_backlink_ids.length);
    const nextIds = session.queue_backlink_ids.slice(startIndex, startIndex + count);

    if (!nextIds.length) {
      sendResponse({ success: false, error: '已经没有下一个外链了' });
      return;
    }

    const opened = [];
    for (const backlinkId of nextIds) {
      const backlink = await openBacklinkInTab(backlinkId);
      opened.push({ id: backlink.id, url: backlink.url, domain: backlink.domain });
    }

    await submissionSessionStorage.updateSession({
      queue_cursor: startIndex + nextIds.length,
      current_backlink_id: nextIds[nextIds.length - 1],
      last_opened_at: new Date().toISOString(),
    });

    sendResponse({
      success: true,
      data: {
        opened,
        remaining: Math.max(0, session.queue_backlink_ids.length - (startIndex + nextIds.length)),
      },
    });
  })().catch(error => {
    sendResponse({ success: false, error: error instanceof Error ? error.message : '打开外链失败' });
  });

  return true;
});

messageRouter.register('OPEN_MANAGED_BACKLINK', (message, _sender, sendResponse) => {
  (async () => {
    const backlinkId = message?.payload?.backlinkId as string | undefined;
    const queueIds = Array.isArray(message?.payload?.queueIds) ? message.payload.queueIds : [];
    const groupId = message?.payload?.groupId as string | undefined;

    if (!backlinkId) {
      sendResponse({ success: false, error: '缺少 backlinkId' });
      return;
    }

    const backlink = await openManagedBacklink(backlinkId, queueIds, groupId);
    sendResponse({ success: true, data: backlink });
  })().catch(error => {
    sendResponse({ success: false, error: error instanceof Error ? error.message : '打开外链失败' });
  });

  return true;
});

export async function openManagedBacklink(backlinkId: string, queueBacklinkIds: string[], backlinkGroupId?: string) {
  if (queueBacklinkIds.length) {
    await submissionSessionStorage.updateSession({
      queue_backlink_ids: queueBacklinkIds,
      queue_cursor: Math.min(queueBacklinkIds.indexOf(backlinkId) + 1, queueBacklinkIds.length),
      selected_backlink_group_id: backlinkGroupId,
    });
  }

  return openBacklinkInTab(backlinkId);
}
