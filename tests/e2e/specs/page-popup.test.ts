import { canSwitchTheme } from '../helpers/theme.js';

describe('Webextension Side Panel', () => {
  it('should open the side panel successfully', async () => {
    const extensionPath = await browser.getExtensionPath();
    const sidePanelUrl = `${extensionPath}/side-panel/index.html`;
    await browser.url(sidePanelUrl);

    await expect(browser).toHaveTitle('Side Panel');
    await canSwitchTheme();
  });
});
