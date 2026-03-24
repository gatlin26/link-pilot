export {};

const sessionStore = new Map<string, string>();

const locationStub = {
  href: 'https://ahrefs.com/backlink-checker/?input=https%3A%2F%2Fexample.com&mode=subdomains',
  hostname: 'ahrefs.com',
  pathname: '/backlink-checker/',
  search: '?input=https%3A%2F%2Fexample.com&mode=subdomains',
  protocol: 'https:',
};

const documentBody = {
  appendChild: () => undefined,
  removeChild: () => undefined,
};

const documentHead = {
  appendChild: () => undefined,
};

const noop = () => undefined;

const windowStub = {
  location: locationStub,
  addEventListener: noop,
  removeEventListener: noop,
  postMessage: noop,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  history: {
    pushState: noop,
    replaceState: noop,
  },
};

const documentStub = {
  readyState: 'complete',
  title: 'test',
  body: documentBody,
  head: documentHead,
  addEventListener: noop,
  removeEventListener: noop,
  querySelector: () => null,
  querySelectorAll: () => [],
  createElement: () => ({ style: {}, setAttribute: noop, appendChild: noop, remove: noop, textContent: '' }),
};

const chromeStub = {
  runtime: {
    onMessage: {
      addListener: noop,
    },
    sendMessage: async () => ({ success: true }),
    getURL: (path: string) => path,
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
      addListener: noop,
      removeListener: noop,
    },
  },
};

class MutationObserverStub {
  observe() {}
  disconnect() {}
  takeRecords() { return []; }
}

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
  MutationObserver: MutationObserverStub,
  Element: class {},
  HTMLElement: class {},
  HTMLInputElement: class {},
  HTMLTextAreaElement: class {},
  HTMLSelectElement: class {},
  Node: class {},
  Event,
  CustomEvent,
  CSS: { escape: (value: string) => value },
});

async function main() {
  await import('../index');
  console.log('ENTRY_IMPORT_OK');
}

main().catch(error => {
  console.error('ENTRY_IMPORT_FAILED');
  console.error(error);
  process.exitCode = 1;
});
