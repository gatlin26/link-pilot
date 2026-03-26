describe('Webextension Content Runtime Script', () => {
  before(function () {
    // Chrome doesn't allow content scripts on the extension pages
    if ((browser.capabilities as WebdriverIO.Capabilities).browserName === 'chrome') {
      this.skip();
    }
  });

  it('should create all runtime elements on the page', async function () {
    // Open the side panel
    const extensionPath = await browser.getExtensionPath();
    const sidePanelUrl = `${extensionPath}/side-panel/index.html`;

    // If Side Panel file not found, skip the test
    try {
      await browser.url(sidePanelUrl);
    } catch {
      console.error('Side Panel file not found');
      this.skip();
    }

    await expect(browser).toHaveTitle('Side Panel');

    // Trigger inject button on side panel
    const contentScriptsButton = await $('button*=Content Scripts').getElement();

    await contentScriptsButton.click();

    // Check if id exists on the page
    const runtimeExampleElement = await $('#CEB-extension-runtime-example').getElement();
    const runtimeAllElement = await $('#CEB-extension-runtime-all').getElement();

    await expect(runtimeExampleElement).toBeExisting();
    await expect(runtimeAllElement).toBeExisting();
  });
});
