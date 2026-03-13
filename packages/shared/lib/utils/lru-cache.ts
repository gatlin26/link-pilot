/**
 * LRU (Least Recently Used) 缓存实现
 * 当缓存达到最大容量时，自动删除最久未使用的项
 *
 * @author yiangto
 * @date 2026-03-13
 */

/**
 * LRU 缓存类
 * 使用 Map 保持插入顺序，最近使用的项会被移到末尾
 */
export class LRUCache<K, V> {
  private cache: Map<K, V>;
  private readonly maxSize: number;

  /**
   * 创建 LRU 缓存实例
   * @param maxSize - 最大缓存容量，默认 100
   */
  constructor(maxSize: number = 100) {
    if (maxSize <= 0) {
      throw new Error('LRU 缓存大小必须大于 0');
    }
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  /**
   * 获取缓存值
   * 如果存在，会将该项移到最后（标记为最近使用）
   * @param key - 缓存键
   * @returns 缓存值，不存在则返回 undefined
   */
  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // 移到最后（最近使用）
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  /**
   * 设置缓存值
   * 如果已存在，会更新并移到最后
   * 如果超过容量，会删除最久未使用的项（第一项）
   * @param key - 缓存键
   * @param value - 缓存值
   */
  set(key: K, value: V): void {
    // 如果已存在，先删除（稍后会重新添加到末尾）
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    // 如果超过大小限制，删除最旧的（第一个）
    else if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    // 添加到末尾
    this.cache.set(key, value);
  }

  /**
   * 检查缓存中是否存在指定键
   * @param key - 缓存键
   * @returns 是否存在
   */
  has(key: K): boolean {
    return this.cache.has(key);
  }

  /**
   * 删除指定缓存项
   * @param key - 缓存键
   * @returns 是否删除成功
   */
  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  /**
   * 清空所有缓存
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * 获取当前缓存大小
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * 获取所有缓存键
   */
  keys(): IterableIterator<K> {
    return this.cache.keys();
  }

  /**
   * 获取所有缓存值
   */
  values(): IterableIterator<V> {
    return this.cache.values();
  }

  /**
   * 获取所有缓存项
   */
  entries(): IterableIterator<[K, V]> {
    return this.cache.entries();
  }
}
