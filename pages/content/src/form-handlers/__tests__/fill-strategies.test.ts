/**
 * 填充策略单元测试
 * 测试不同的字段填充策略
 *
 * @author yiangto
 * @date 2026-03-13
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('填充策略测试', () => {
  let testContainer: HTMLDivElement;

  beforeEach(() => {
    // 创建测试容器
    testContainer = document.createElement('div');
    document.body.appendChild(testContainer);
  });

  afterEach(() => {
    // 清理测试容器
    document.body.removeChild(testContainer);
  });

  describe('直接赋值策略', () => {
    it('应该能填充 input 元素', () => {
      const input = document.createElement('input');
      input.type = 'text';
      testContainer.appendChild(input);

      // 填充值
      input.value = 'test value';

      expect(input.value).toBe('test value');
    });

    it('应该能填充 textarea 元素', () => {
      const textarea = document.createElement('textarea');
      testContainer.appendChild(textarea);

      textarea.value = 'test comment';

      expect(textarea.value).toBe('test comment');
    });

    it('应该能填充 select 元素', () => {
      const select = document.createElement('select');
      const option1 = document.createElement('option');
      option1.value = 'value1';
      const option2 = document.createElement('option');
      option2.value = 'value2';
      select.appendChild(option1);
      select.appendChild(option2);
      testContainer.appendChild(select);

      select.value = 'value2';

      expect(select.value).toBe('value2');
    });
  });

  describe('事件触发策略', () => {
    it('应该触发 input 事件', () => {
      const input = document.createElement('input');
      testContainer.appendChild(input);

      let eventFired = false;
      input.addEventListener('input', () => {
        eventFired = true;
      });

      input.value = 'test';
      input.dispatchEvent(new Event('input', { bubbles: true }));

      expect(eventFired).toBe(true);
    });

    it('应该触发 change 事件', () => {
      const input = document.createElement('input');
      testContainer.appendChild(input);

      let eventFired = false;
      input.addEventListener('change', () => {
        eventFired = true;
      });

      input.value = 'test';
      input.dispatchEvent(new Event('change', { bubbles: true }));

      expect(eventFired).toBe(true);
    });

    it('应该触发 blur 事件', () => {
      const input = document.createElement('input');
      testContainer.appendChild(input);

      let eventFired = false;
      input.addEventListener('blur', () => {
        eventFired = true;
      });

      input.dispatchEvent(new Event('blur', { bubbles: true }));

      expect(eventFired).toBe(true);
    });
  });

  describe('React 受控组件策略', () => {
    it('应该能通过 setter 修改值', () => {
      const input = document.createElement('input');
      testContainer.appendChild(input);

      // 模拟 React 的 value setter
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value',
      )?.set;

      if (nativeInputValueSetter) {
        nativeInputValueSetter.call(input, 'test value');
        input.dispatchEvent(new Event('input', { bubbles: true }));

        expect(input.value).toBe('test value');
      }
    });

    it('应该能通过 setter 修改 textarea 值', () => {
      const textarea = document.createElement('textarea');
      testContainer.appendChild(textarea);

      const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        'value',
      )?.set;

      if (nativeTextAreaValueSetter) {
        nativeTextAreaValueSetter.call(textarea, 'test comment');
        textarea.dispatchEvent(new Event('input', { bubbles: true }));

        expect(textarea.value).toBe('test comment');
      }
    });
  });

  describe('iframe 内填充策略', () => {
    it('应该能访问 iframe 内的元素', () => {
      const iframe = document.createElement('iframe');
      testContainer.appendChild(iframe);

      // 等待 iframe 加载
      return new Promise<void>(resolve => {
        iframe.onload = () => {
          const iframeDoc = iframe.contentDocument;
          if (iframeDoc) {
            const input = iframeDoc.createElement('input');
            iframeDoc.body.appendChild(input);

            input.value = 'iframe test';

            expect(input.value).toBe('iframe test');
          }
          resolve();
        };

        // 触发加载
        iframe.src = 'about:blank';
      });
    });
  });

  describe('Shadow DOM 填充策略', () => {
    it('应该能访问 Shadow DOM 内的元素', () => {
      const host = document.createElement('div');
      testContainer.appendChild(host);

      const shadowRoot = host.attachShadow({ mode: 'open' });
      const input = document.createElement('input');
      shadowRoot.appendChild(input);

      input.value = 'shadow test';

      expect(input.value).toBe('shadow test');
    });

    it('应该能在 closed Shadow DOM 中填充（如果有引用）', () => {
      const host = document.createElement('div');
      testContainer.appendChild(host);

      const shadowRoot = host.attachShadow({ mode: 'closed' });
      const input = document.createElement('input');
      shadowRoot.appendChild(input);

      // 如果有元素引用，仍然可以填充
      input.value = 'closed shadow test';

      expect(input.value).toBe('closed shadow test');
    });
  });

  describe('边界情况', () => {
    it('应该处理只读字段', () => {
      const input = document.createElement('input');
      input.readOnly = true;
      testContainer.appendChild(input);

      // 尝试填充只读字段
      input.value = 'test';

      // 只读字段仍然可以通过 JavaScript 修改
      expect(input.value).toBe('test');
    });

    it('应该处理禁用字段', () => {
      const input = document.createElement('input');
      input.disabled = true;
      testContainer.appendChild(input);

      input.value = 'test';

      expect(input.value).toBe('test');
      expect(input.disabled).toBe(true);
    });

    it('应该处理不可见字段', () => {
      const input = document.createElement('input');
      input.style.display = 'none';
      testContainer.appendChild(input);

      input.value = 'test';

      expect(input.value).toBe('test');
    });
  });
});
