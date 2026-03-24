export {};

const sessionStore = new Map<string, string>();

const locationStub = {
  href: 'https://ahrefs.com/backlink-checker/?input=https%3A%2F%2Fexample.com&mode=subdomains',
  hostname: 'ahrefs.com',
  pathname: '/backlink-checker/',
  search: '?input=https%3A%2F%2Fexample.com&mode=subdomains',
};

const windowStub = {
  location: locationStub,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
  setTimeout,
  clearTimeout,
};

const documentStub = {
  readyState: 'complete',
  title: 'test',
  body: {},
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
  querySelector: () => null,
  querySelectorAll: () => [],
  createElement: () => ({ style: {} }),
};

const chromeStub = {
  runtime: {
    onMessage: {
      addListener: () => undefined,
    },
    sendMessage: async () => ({ success: true }),
  },
  tabs: {
    query: async () => [{ id: 1 }],
  },
  storage: {
    local: {
      get: async () => ({}),
      set: async () => undefined,
      remove: async () => undefined,
      clear: async () => undefined,
    },
    session: {
      get: async () => ({}),
      set: async () => undefined,
      remove: async () => undefined,
      clear: async () => undefined,
      setAccessLevel: async () => undefined,
    },
    sync: {
      get: async () => ({}),
      set: async () => undefined,
      remove: async () => undefined,
      clear: async () => undefined,
    },
    onChanged: {
      addListener: () => undefined,
      removeListener: () => undefined,
    },
  },
};

Object.assign(globalThis, {
  window: windowStub,
  document: documentStub,
  location: locationStub,
  chrome: chromeStub,
  sessionStorage: {
    getItem: (key: string) => sessionStore.get(key) ?? null,
    setItem: (key: string, value: string) => void sessionStore.set(key, value),
    removeItem: (key: string) => void sessionStore.delete(key),
  },
  MutationObserver: class {
    observe() {}
    disconnect() {}
    takeRecords() { return []; }
  },
  HTMLElement: class {},
  HTMLInputElement: class {},
  HTMLTextAreaElement: class {},
  HTMLSelectElement: class {},
  Event,
  CSS: { escape: (value: string) => value },
});

async function main() {
  await import('../message-handler');
  console.log('IMPORT_OK');
}

main().catch(error => {
  console.error('IMPORT_FAILED');
  console.error(error);
  process.exitCode = 1;
});
