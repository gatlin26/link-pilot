/**
 * DOM 缓存工具
 * 缓存计算样式以提高性能
 *
 * @author yiangto
 * @date 2026-03-13
 */

/**
 * DOM 缓存对象
 * 使用 WeakMap 存储元素的计算样式，避免重复计算
 */
export const DOM_CACHE = {
  computedStyles: new WeakMap<Element, CSSStyleDeclaration>(),

  /**
   * 清空缓存
   */
  clear: () => {
    DOM_CACHE.computedStyles = new WeakMap();
  },
};

/**
 * 获取缓存的计算样式
 * 如果缓存中没有，则计算并缓存
 *
 * @param element - DOM 元素
 * @returns 计算样式或 null
 */
export function getCachedComputedStyle(element: Element): CSSStyleDeclaration | null {
  if (!element) return null;

  // 检查缓存
  if (DOM_CACHE.computedStyles.has(element)) {
    return DOM_CACHE.computedStyles.get(element) ?? null;
  }

  // 计算样式并缓存
  const style = window.getComputedStyle(element);
  DOM_CACHE.computedStyles.set(element, style);

  return style;
}
