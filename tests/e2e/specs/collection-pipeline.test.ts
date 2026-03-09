import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

interface BacklinkSeed {
  from: string;
  anchor: string;
  title: string;
  dr: number;
}

interface AttemptScenario {
  attempt: string;
  maxCount: number;
  seeds: BacklinkSeed[];
}

const scenarios: AttemptScenario[] = [
  {
    attempt: '1',
    maxCount: 6,
    seeds: [
      { from: 'https://source-a.test/post-1', anchor: 'alpha one', title: 'Alpha One', dr: 71 },
      { from: 'https://source-a.test/post-2', anchor: 'alpha two', title: 'Alpha Two', dr: 68 },
      { from: 'https://source-b.test/post-1', anchor: 'beta one', title: 'Beta One', dr: 55 },
      { from: 'https://source-c.test/post-1', anchor: 'gamma one', title: 'Gamma One', dr: 62 },
      { from: 'https://source-d.test/post-1', anchor: 'delta one', title: 'Delta One', dr: 49 },
      { from: 'https://source-e.test/post-1', anchor: 'epsilon one', title: 'Epsilon One', dr: 73 },
    ],
  },
  {
    attempt: '2',
    maxCount: 6,
    seeds: [
      { from: 'https://source-a.test/post-1', anchor: 'alpha one', title: 'Alpha One', dr: 71 },
      { from: 'https://source-a.test/post-2', anchor: 'alpha two', title: 'Alpha Two', dr: 68 },
      { from: 'https://source-b.test/post-1', anchor: 'beta one', title: 'Beta One', dr: 55 },
      { from: 'https://source-f.test/post-1', anchor: 'zeta one', title: 'Zeta One', dr: 45 },
      { from: 'https://source-g.test/post-1', anchor: 'eta one', title: 'Eta One', dr: 58 },
      { from: 'https://source-h.test/post-1', anchor: 'theta one', title: 'Theta One', dr: 64 },
    ],
  },
  {
    attempt: '3',
    maxCount: 6,
    seeds: [
      { from: 'https://source-a.test/post-1', anchor: 'alpha one', title: 'Alpha One', dr: 71 },
      { from: 'https://source-a.test/post-2', anchor: 'alpha two', title: 'Alpha Two', dr: 68 },
      { from: 'https://source-b.test/post-1', anchor: 'beta one', title: 'Beta One', dr: 55 },
      { from: 'https://source-c.test/post-1', anchor: 'gamma one', title: 'Gamma One', dr: 62 },
      { from: 'https://source-d.test/post-1', anchor: 'delta one', title: 'Delta One', dr: 49 },
      { from: 'https://source-e.test/post-1', anchor: 'epsilon one', title: 'Epsilon One', dr: 73 },
    ],
  },
];

const scenarioMap = new Map(scenarios.map(item => [item.attempt, item]));

function buildMockHtml(): string {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Mock Backlink Checker</title>
  </head>
  <body>
    <h1>Mock Backlink Checker</h1>
    <script>
      const params = new URLSearchParams(window.location.search);
      const attempt = params.get('attempt') || '1';
      const doFetch = async () => {
        try {
          await fetch('/api.ahrefs.com/mock?attempt=' + encodeURIComponent(attempt), {
            headers: { 'x-link-pilot-e2e': '1' },
          });
        } catch (error) {
          console.error('[Mock Collector Page] fetch failed:', error);
        }
      };

      // Give the extension enough time to inject content script and start interceptor.
      setTimeout(doFetch, 3000);
    </script>
  </body>
</html>`;
}

function sendJson(res: ServerResponse, code: number, data: unknown): void {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

function parseAttempt(req: IncomingMessage): string {
  const url = new URL(req.url || '/', 'http://127.0.0.1');
  return url.searchParams.get('attempt') || '1';
}

function createMockServer() {
  return createServer((req, res) => {
    const requestUrl = req.url || '/';
    const parsed = new URL(requestUrl, 'http://127.0.0.1');

    if (parsed.pathname === '/mock-backlink-checker') {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(buildMockHtml());
      return;
    }

    if (parsed.pathname === '/api.ahrefs.com/mock') {
      const attempt = parseAttempt(req);
      const scenario = scenarioMap.get(attempt) || scenarios[0];

      const backlinks = scenario.seeds.map(seed => ({
        url_from: seed.from,
        url_to: 'https://target-for-e2e.test/',
        anchor: seed.anchor,
        title: seed.title,
        domain_rating: seed.dr,
      }));

      sendJson(res, 200, { backlinks });
      return;
    }

    sendJson(res, 404, { error: 'not found' });
  });
}

async function readStorageSnapshot() {
  return browser.executeAsync(done => {
    chrome.storage.local
      .get(['managed-backlink-storage-key', 'opportunity-storage-key', 'collection-batch-storage-key'])
      .then(raw => {
        const managedState = raw['managed-backlink-storage-key'] || {};
        const opportunityState = raw['opportunity-storage-key'] || {};
        const batchState = raw['collection-batch-storage-key'] || {};
        done({
          managedCount: Array.isArray(managedState.backlinks) ? managedState.backlinks.length : 0,
          opportunityCount: Array.isArray(opportunityState.opportunities) ? opportunityState.opportunities.length : 0,
          batchCount: Array.isArray(batchState.batches) ? batchState.batches.length : 0,
        });
      })
      .catch(error => {
        done({
          error: error instanceof Error ? error.message : String(error),
        });
      });
  });
}

async function clearCollectionStorage() {
  await browser.executeAsync(done => {
    chrome.storage.local
      .remove([
        'managed-backlink-storage-key',
        'opportunity-storage-key',
        'collection-batch-storage-key',
        'collection_debug_logs',
      ])
      .then(() => done({ ok: true }))
      .catch(error => done({ ok: false, error: error instanceof Error ? error.message : String(error) }));
  });
}

describe('Collection Pipeline (Browser Validation)', () => {
  let server: ReturnType<typeof createMockServer>;
  let baseUrl = '';

  before(async () => {
    server = createMockServer();
    await new Promise<void>((resolve, reject) => {
      server.listen(0, '127.0.0.1', error => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });

    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  after(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close(error => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  });

  it('should pass three manual-collection attempts and keep storage counts consistent', async () => {
    const extensionPath = await browser.getExtensionPath();
    await browser.url(`${extensionPath}/popup/index.html`);
    await clearCollectionStorage();

    let previousManaged = 0;
    let previousOpportunity = 0;
    let previousBatch = 0;

    for (const scenario of scenarios) {
      const overrideUrl =
        `${baseUrl}/mock-backlink-checker?attempt=${scenario.attempt}` +
        `&input=${encodeURIComponent('https://target-for-e2e.test/')}`;

      const attemptResult = await browser.executeAsync((payload, done) => {
        chrome.runtime
          .sendMessage({
            type: 'START_MANUAL_COLLECTION',
            payload,
          })
          .then(async response => {
            const debugResult = await chrome.runtime.sendMessage({ type: 'GET_COLLECTION_DEBUG_LOGS' });
            done({
              response,
              debugLogs: Array.isArray(debugResult?.logs) ? debugResult.logs : [],
            });
          })
          .catch(error => {
            done({
              response: null,
              error: error instanceof Error ? error.message : String(error),
            });
          });
      }, {
        targetUrl: 'https://target-for-e2e.test/',
        maxCount: scenario.maxCount,
        groupId: 'default',
        collectionUrlOverride: overrideUrl,
      });

      expect(attemptResult.error).toBeUndefined();
      expect(attemptResult.response).toBeTruthy();
      expect(attemptResult.response.success).toBe(true);
      expect(attemptResult.response.count).toBe(scenario.maxCount);
      expect(typeof attemptResult.response.addedToLibrary).toBe('number');
      expect(typeof attemptResult.response.skippedInLibrary).toBe('number');
      expect(attemptResult.response.addedToLibrary + attemptResult.response.skippedInLibrary).toBe(scenario.maxCount);

      const snapshot = await readStorageSnapshot();
      expect(snapshot.error).toBeUndefined();

      const addedToLibrary = Number(attemptResult.response.addedToLibrary || 0);
      expect(snapshot.managedCount - previousManaged).toBe(addedToLibrary);
      expect(snapshot.opportunityCount - previousOpportunity).toBe(scenario.maxCount);
      expect(snapshot.batchCount - previousBatch).toBe(1);

      previousManaged = snapshot.managedCount;
      previousOpportunity = snapshot.opportunityCount;
      previousBatch = snapshot.batchCount;
    }
  });

  it('should reject invalid collectionUrlOverride', async () => {
    const extensionPath = await browser.getExtensionPath();
    await browser.url(`${extensionPath}/popup/index.html`);

    const result = await browser.executeAsync(done => {
      chrome.runtime
        .sendMessage({
          type: 'START_MANUAL_COLLECTION',
          payload: {
            targetUrl: 'https://target-for-e2e.test/',
            collectionUrlOverride: 'file:///tmp/mock.html',
          },
        })
        .then(response => done(response))
        .catch(error => {
          done({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        });
    });

    expect(result.success).toBe(false);
    expect(String(result.error || '')).toContain('仅支持 http/https');
  });
});
