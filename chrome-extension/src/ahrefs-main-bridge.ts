/**
 * Ahrefs 主世界桥接脚本
 * 在页面加载时自动注入到 MAIN world，用于拦截 API 请求
 *
 * 注意：此脚本运行在页面的主世界（MAIN world），可以访问页面的 window 对象
 */

const BRIDGE_CHANNEL = '__LINK_PILOT_AHREFS_BRIDGE__';
const BRIDGE_SOURCE_MAIN = 'link_pilot_ahrefs_main';
const BRIDGE_SOURCE_CONTENT = 'link_pilot_ahrefs_content';
const BRIDGE_STATE_KEY = '__linkPilotAhrefsBridgeState__';

type BridgePayload = Record<string, unknown> | undefined;
type BridgeMessage = {
  channel: string;
  source: string;
  type: string;
  payload?: BridgePayload;
};
type BridgeState = {
  active: boolean;
  readyForStreaming: boolean;
  originalFetch: typeof window.fetch;
  originalXhrOpen: typeof XMLHttpRequest.prototype.open;
  originalXhrSend: typeof XMLHttpRequest.prototype.send;
  bufferedResponses: Array<{ url: string; data: unknown }>;
  listenerBound: boolean;
  stop: () => void;
};

const win = window as unknown as Window & Record<string, unknown>;
const existingState = win[BRIDGE_STATE_KEY] as BridgeState | undefined;

const emit = (type: string, payload?: BridgePayload): void => {
  const message: BridgeMessage = {
    channel: BRIDGE_CHANNEL,
    source: BRIDGE_SOURCE_MAIN,
    type,
    payload,
  };
  window.postMessage(message, '*');
};

// 如果已经注入过，直接返回
if (existingState?.listenerBound) {
  console.log('[Ahrefs Bridge] 桥接脚本已存在，跳过重复注入');
  emit('BRIDGE_READY', { reused: true });
} else {
  console.log('[Ahrefs Bridge] 开始初始化主世界桥接脚本');

  const state: BridgeState = {
    active: false,
    readyForStreaming: false,
    originalFetch: window.fetch,
    originalXhrOpen: XMLHttpRequest.prototype.open,
    originalXhrSend: XMLHttpRequest.prototype.send,
    bufferedResponses: [],
    listenerBound: true,
    stop: () => {
      if (!state.active) {
        return;
      }
      state.active = false;
      state.readyForStreaming = false;
      window.fetch = state.originalFetch;
      XMLHttpRequest.prototype.open = state.originalXhrOpen;
      XMLHttpRequest.prototype.send = state.originalXhrSend;
      emit('INTERCEPTOR_STOPPED');
    },
  };

  const emitApiResponse = (url: string, data: unknown): void => {
    if (!state.readyForStreaming) {
      state.bufferedResponses.push({ url, data });
      if (state.bufferedResponses.length > 60) {
        state.bufferedResponses = state.bufferedResponses.slice(-60);
      }
      return;
    }

    emit('API_RESPONSE', { url, data });
  };

  const flushBufferedResponses = (): void => {
    if (!state.readyForStreaming || state.bufferedResponses.length === 0) {
      return;
    }
    const backlog = state.bufferedResponses.slice();
    state.bufferedResponses = [];
    backlog.forEach(item => {
      emit('API_RESPONSE', { url: item.url, data: item.data });
    });
  };

  const isAhrefsApiRequest = (url: string): boolean => {
    const patterns = [
      /api\.ahrefs\.com/i,
      /ahrefs\.com\/api/i,
      /ahrefs\.com\/v\d+\//i,
      /stGetFreeBacklinksList/i,
      /backlink.*api/i,
      /refpages/i,
      /backlinks/i,
    ];
    return patterns.some(pattern => pattern.test(url));
  };

  const getUrlFromResource = (resource: RequestInfo | URL): string => {
    if (typeof resource === 'string') {
      return resource;
    }
    if (resource instanceof URL) {
      return resource.toString();
    }
    return resource.url;
  };

  const start = (readyForStreaming: boolean): void => {
    if (readyForStreaming) {
      state.readyForStreaming = true;
    }

    if (state.active) {
      flushBufferedResponses();
      emit('BRIDGE_READY', { reused: true });
      return;
    }

    state.active = true;

    // 拦截 fetch
    window.fetch = async (...args: Parameters<typeof fetch>): Promise<Response> => {
      const [resource] = args;
      const url = getUrlFromResource(resource);
      const matched = isAhrefsApiRequest(url);

      if (state.active) {
        emit('REQUEST_SEEN', {
          transport: 'fetch',
          url,
          matched,
        });
      }

      const response = await state.originalFetch.call(window, ...args);

      if (state.active && matched) {
        try {
          const payload = await response.clone().json();
          emitApiResponse(url, payload);
        } catch (error) {
          emit('BRIDGE_ERROR', {
            error: error instanceof Error ? error.message : '解析 fetch 响应失败',
            url,
            transport: 'fetch',
          });
        }
      }

      return response;
    };

    // 拦截 XMLHttpRequest
    XMLHttpRequest.prototype.open = function (method: string, url: string | URL, ...rest: unknown[]): void {
      (this as XMLHttpRequest & { __linkPilotUrl?: string }).__linkPilotUrl = url.toString();
      return state.originalXhrOpen.apply(this, [method, url, ...rest] as Parameters<
        typeof XMLHttpRequest.prototype.open
      >);
    };

    XMLHttpRequest.prototype.send = function (...args): void {
      const xhr = this as XMLHttpRequest & { __linkPilotUrl?: string };
      const url = xhr.__linkPilotUrl || '';
      const matched = isAhrefsApiRequest(url);

      if (state.active && url) {
        emit('REQUEST_SEEN', {
          transport: 'xhr',
          url,
          matched,
        });
      }

      if (state.active && matched) {
        xhr.addEventListener('load', () => {
          if (xhr.status < 200 || xhr.status >= 300) {
            return;
          }
          try {
            const payload = JSON.parse(xhr.responseText);
            emitApiResponse(url, payload);
          } catch (error) {
            emit('BRIDGE_ERROR', {
              error: error instanceof Error ? error.message : '解析 XHR 响应失败',
              url,
              transport: 'xhr',
            });
          }
        });
      }

      state.originalXhrSend.apply(this, args as Parameters<typeof XMLHttpRequest.prototype.send>);
    };

    flushBufferedResponses();
    emit('BRIDGE_READY', { ready: true });
  };

  // 监听来自 content script 的消息
  window.addEventListener('message', event => {
    const message = event.data as BridgeMessage | undefined;
    if (event.source !== window || !message || typeof message !== 'object') {
      return;
    }
    if (message.channel !== BRIDGE_CHANNEL || message.source !== BRIDGE_SOURCE_CONTENT) {
      return;
    }

    if (message.type === 'START_INTERCEPT') {
      start(true);
      return;
    }
    if (message.type === 'STOP_INTERCEPT') {
      state.stop();
    }
  });

  // 页面卸载时停止拦截
  window.addEventListener('beforeunload', () => {
    state.stop();
  });

  // 自动启动底层拦截，尽可能提前捕获请求
  // 数据会在 content script 就绪后回放
  start(false);

  win[BRIDGE_STATE_KEY] = state;
  emit('BRIDGE_READY', { installed: true });

  console.log('[Ahrefs Bridge] 主世界桥接脚本初始化完成，拦截器已启动');
}
