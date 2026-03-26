import 'webextension-polyfill';

/**
 * 点击扩展图标时打开侧边栏
 */
export const initSidePanelToggle = () => {
  if (!chrome.sidePanel?.setPanelBehavior) {
    console.warn('[SidePanel] sidePanel API is not available in this browser context');
    return;
  }

  // 当用户点击扩展图标时打开侧边栏
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((error: unknown) => {
    console.error('[SidePanel] Failed to set panel behavior:', error);
  });

  console.log('[SidePanel] Panel behavior set: open on action click');
};

initSidePanelToggle();
