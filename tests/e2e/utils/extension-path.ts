/**
 * Returns the Chrome extension path.
 * @param browser
 * @returns path to the Chrome extension
 */
export const getChromeExtensionPath = async (browser: WebdriverIO.Browser) => {
  await browser.url('chrome://version/');
  await browser.pause(500);

  const commandLine = await browser.execute(() => {
    const element = document.querySelector('#command_line');
    return element ? (element.textContent || '') : '';
  });

  const commandLineMatch = commandLine.match(/--load-extension=[^ ]*extension_([a-z]{32})/i);
  let extensionId: string | null = commandLineMatch?.[1] ?? null;

  if (!extensionId) {
    await browser.url('chrome://extensions/');

    const findIdScript = `
      var deepFindAll = function(selector, root) {
        var results = Array.prototype.slice.call(root.querySelectorAll(selector));
        var stack = Array.prototype.slice.call(root.querySelectorAll('*'));
        while (stack.length > 0) {
          var current = stack.shift();
          if (current && current.shadowRoot) {
            results = results.concat(Array.prototype.slice.call(current.shadowRoot.querySelectorAll(selector)));
            stack = stack.concat(Array.prototype.slice.call(current.shadowRoot.querySelectorAll('*')));
          }
        }
        return results;
      };

      var extensionItems = deepFindAll('extensions-item', document);
      if (!extensionItems || extensionItems.length === 0) {
        return null;
      }

      var ids = extensionItems.map(function(item) { return item.getAttribute('id') || ''; });
      var idLike = ids.find(function(id) { return /^[a-z]{32}$/.test(id); });
      return idLike || (extensionItems[0] && extensionItems[0].getAttribute('id')) || null;
    `;

    await browser.waitUntil(
      async () => {
        extensionId = await browser.execute((scriptSource: string) => {
          const runtimeFn = new Function(scriptSource);
          return runtimeFn() as string | null;
        }, findIdScript);

        return Boolean(extensionId);
      },
      {
        timeout: 15000,
        interval: 300,
        timeoutMsg: 'Extension ID not found on chrome://extensions',
      },
    );
  }

  if (!extensionId) {
    throw new Error('Extension ID not found');
  }

  return `chrome-extension://${extensionId}`;
};

/**
 * Returns the Firefox extension path.
 * @param browser
 * @returns path to the Firefox extension
 */
export const getFirefoxExtensionPath = async (browser: WebdriverIO.Browser) => {
  await browser.url('about:debugging#/runtime/this-firefox');
  const uuidElement = await browser.$('//dt[contains(text(), "Internal UUID")]/following-sibling::dd').getElement();
  const internalUUID = await uuidElement.getText();

  if (!internalUUID) {
    throw new Error('Internal UUID not found');
  }

  return `moz-extension://${internalUUID}`;
};
