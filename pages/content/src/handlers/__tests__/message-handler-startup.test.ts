import { describe, expect, it } from 'vitest';

describe('message-handler 模块启动', () => {
  it('导入模块时不应在顶层初始化阶段抛错', async () => {
    await expect(import('../message-handler')).resolves.toBeDefined();
  });
});
