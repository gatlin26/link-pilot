/**
 * iframe 支持工具
 * 处理 iframe 相关的坐标计算和信息获取
 *
 * @author yiangto
 * @date 2026-03-13
 */

/**
 * Frame 信息
 */
export interface FrameInfo {
  /** 是否为主 frame */
  isMainFrame: boolean;
  /** 当前 frame 的 URL */
  frameUrl: string;
  /** 父 frame 的 URL */
  parentUrl: string;
  /** frame 嵌套深度 */
  frameDepth: number;
}

/**
 * iframe 坐标偏移
 */
export interface IframeOffset {
  /** X 轴偏移 */
  x: number;
  /** Y 轴偏移 */
  y: number;
}

/**
 * 获取当前 frame 信息
 * 包括是否为主 frame、URL、嵌套深度等
 *
 * @returns Frame 信息
 */
export function getFrameInfo(): FrameInfo {
  const isMainFrame = window.self === window.top;
  const frameUrl = window.location.href;
  const parentUrl = isMainFrame ? frameUrl : document.referrer || frameUrl;

  return {
    isMainFrame,
    frameUrl,
    parentUrl,
    frameDepth: getFrameDepth(),
  };
}

/**
 * 获取 frame 嵌套深度
 * 从当前 window 向上遍历，直到 top window
 *
 * @returns 嵌套深度（0 表示主 frame）
 */
function getFrameDepth(): number {
  let depth = 0;
  let win: Window = window;

  try {
    // 最多遍历 10 层，防止无限循环
    while (win !== win.parent && depth < 10) {
      depth++;
      win = win.parent;
    }
  } catch (error) {
    // 跨域访问会抛出异常，此时返回当前深度
    console.debug('无法访问父 frame，可能是跨域限制:', error);
  }

  return depth;
}

/**
 * 获取 iframe 坐标偏移
 * 计算当前 iframe 相对于顶层窗口的坐标偏移
 *
 * @param frameInfo - Frame 信息（可选，如果不提供则自动获取）
 * @returns 坐标偏移
 */
export function getIframeOffset(frameInfo?: FrameInfo): IframeOffset {
  // 如果没有提供 frameInfo，自动获取
  const info = frameInfo || getFrameInfo();

  // 主 frame 没有偏移
  if (info.isMainFrame) {
    return { x: 0, y: 0 };
  }

  let x = 0;
  let y = 0;
  let currentWindow: Window = window;

  try {
    // 向上遍历所有父 frame，累加偏移量
    while (currentWindow !== currentWindow.top) {
      const frameElement = currentWindow.frameElement;

      // 如果无法访问 frameElement（跨域），停止遍历
      if (!frameElement) {
        console.debug('无法访问 frameElement，可能是跨域限制');
        break;
      }

      // 获取 iframe 元素的位置
      const rect = frameElement.getBoundingClientRect();
      x += rect.left;
      y += rect.top;

      // 移动到父窗口
      currentWindow = currentWindow.parent;
    }
  } catch (error) {
    // 跨域访问会抛出异常
    console.debug('计算 iframe 偏移时遇到跨域限制:', error);
  }

  return { x, y };
}

/**
 * 检查是否在 iframe 中
 *
 * @returns 是否在 iframe 中
 */
export function isInIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch (error) {
    // 跨域情况下也返回 true
    return true;
  }
}

/**
 * 检查是否可以访问父 frame
 * 用于判断是否存在跨域限制
 *
 * @returns 是否可以访问
 */
export function canAccessParentFrame(): boolean {
  if (!isInIframe()) {
    return false;
  }

  try {
    // 尝试访问父窗口的 location
    const _ = window.parent.location.href;
    return true;
  } catch (error) {
    // 跨域访问会抛出异常
    return false;
  }
}
