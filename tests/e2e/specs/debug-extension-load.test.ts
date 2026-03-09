describe('Debug Extension Load', () => {
  it('should inspect chrome://extensions state', async () => {
    await browser.url('chrome://extensions/');
    await browser.pause(2000);

    const script = `
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

      var items = deepFindAll('extensions-item', document).map(function(item) {
        return {
          id: item.getAttribute('id'),
          outer: (item.outerHTML || '').slice(0, 200),
        };
      });

      return {
        href: window.location.href,
        title: document.title,
        managerCount: deepFindAll('extensions-manager', document).length,
        itemCount: items.length,
        items: items,
        bodyPreview: (document.body && document.body.innerHTML ? document.body.innerHTML : '').slice(0, 500),
      };
    `;

    const snapshot = await browser.execute((source: string) => {
      const runtimeFn = new Function(source);
      return runtimeFn();
    }, script);

    // This test is for diagnostics; keep assertion simple so logs are still emitted.
    // eslint-disable-next-line no-console
    console.log('[debug-extension-load] snapshot:', JSON.stringify(snapshot, null, 2));

    let polledItemCount = -1;
    await browser.waitUntil(
      async () => {
        polledItemCount = await browser.execute((source: string) => {
          const runtimeFn = new Function(source);
          const result = runtimeFn() as { itemCount?: number };
          return Number(result.itemCount || 0);
        }, script);
        return polledItemCount > 0;
      },
      {
        timeout: 10000,
        interval: 1000,
        timeoutMsg: 'extensions-item still empty after 10s',
      },
    ).catch(() => undefined);
    // eslint-disable-next-line no-console
    console.log('[debug-extension-load] polled itemCount:', polledItemCount);

    await browser.url('chrome://version/');
    await browser.pause(800);
    const commandLine = await browser.execute(() => {
      const element = document.querySelector('#command_line');
      return element ? (element.textContent || '') : '';
    });
    // eslint-disable-next-line no-console
    console.log('[debug-extension-load] command line:', commandLine);

    try {
      const browserLogs = await browser.getLogs('browser');
      // eslint-disable-next-line no-console
      console.log('[debug-extension-load] browser logs:', JSON.stringify(browserLogs.slice(-20), null, 2));
    } catch (error) {
      // eslint-disable-next-line no-console
      console.log('[debug-extension-load] getLogs(browser) unsupported:', String(error));
    }

    expect(snapshot.managerCount).toBeGreaterThanOrEqual(0);
  });
});
