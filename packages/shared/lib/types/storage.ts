/**
 * Storage 基础类型定义
 */

/**
 * 值或更新函数类型
 */
export type ValueOrUpdateType<D> = D | ((prev: D) => D | Promise<D>);

/**
 * 基础 Storage 类型
 */
export type BaseStorageType<D> = {
  get: () => Promise<D>;
  set: (value: ValueOrUpdateType<D>) => Promise<void>;
  getSnapshot: () => D | null;
  subscribe: (listener: () => void) => () => void;
};
