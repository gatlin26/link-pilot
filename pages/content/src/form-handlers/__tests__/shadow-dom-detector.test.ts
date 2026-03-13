/**
 * Shadow DOM 检测器单元测试
 * 测试 Shadow DOM 检测功能
 *
 * @author yiangto
 * @date 2026-03-13
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ShadowDOMDetector } from '../shadow-dom-detector';
import { FieldAnalyzer } from '../field-analyzer';

describe('ShadowDOMDetector', () => {
  let detector: ShadowDOMDetector;
  let analyzer: FieldAnalyzer;
  let testContainer: HTMLDivElement;

  beforeEach(() => {
    analyzer = new FieldAnalyzer();
    detector = new ShadowDOMDetector(analyzer);

    testContainer = document.createElement('div');
    document.body.appendChild(testContainer);
  });

  afterEach(() => {
    document.body.removeChild(testContainer);
  });

  describe('detectShadowDOMFields', () => {
    it('应该检测 open Shadow DOM 中的字段', () => {
      const host = document.createElement('div');
      testContainer.appendChild(host);

      const shadowRoot = host.attachShadow({ mode: 'open' });
      const input = document.createElement('input');
      input.type = 'email';
      input.name = 'email';
      shadowRoot.appendChild(input);

      const fields = detector.detectShadowDOMFields(testContainer);

      expect(fields.length).toBeGreaterThan(0);
      expect(fields[0].element).toBe(input);
    });

    it('应该检测嵌套 Shadow DOM 中的字段', () => {
      // 第一层 Shadow DOM
      const host1 = document.createElement('div');
      testContainer.appendChild(host1);
      const shadowRoot1 = host1.attachShadow({ mode: 'open' });

      // 第二层 Shadow DOM
      const host2 = document.createElement('div');
      shadowRoot1.appendChild(host2);
      const shadowRoot2 = host2.attachShadow({ mode: 'open' });

      // 添加字段
      const input = document.createElement('input');
      input.type = 'text';
      input.name = 'name';
      shadowRoot2.appendChild(input);

      const fields = detector.detectShadowDOMFields(testContainer, {
        maxDepth: 5,
      });

      expect(fields.length).toBeGreaterThan(0);
    });

    it('应该遵守最大深度限制', () => {
      // 创建深层嵌套的 Shadow DOM
      let currentRoot: ShadowRoot | HTMLElement = testContainer;

      for (let i = 0; i < 10; i++) {
        const host = document.createElement('div');
        if (currentRoot instanceof ShadowRoot) {
          currentRoot.appendChild(host);
        } else {
          currentRoot.appendChild(host);
        }
        currentRoot = host.attachShadow({ mode: 'open' });
      }

      // 在最深层添加字段
      const input = document.createElement('input');
      (currentRoot as ShadowRoot).appendChild(input);

      // 使用较小的深度限制
      const fields = detector.detectShadowDOMFields(testContainer, {
        maxDepth: 3,
      });

      // 应该检测不到深层的字段
      expect(fields.length).toBe(0);
    });

    it('应该过滤重复字段', () => {
      const host = document.createElement('div');
      testContainer.appendChild(host);

      const shadowRoot = host.attachShadow({ mode: 'open' });
      const input = document.createElement('input');
      input.id = 'unique-input';
      shadowRoot.appendChild(input);

      // 第一次检测
      const fields1 = detector.detectShadowDOMFields(testContainer, {
        includeDuplicates: false,
      });

      // 第二次检测（应该过滤重复）
      const fields2 = detector.detectShadowDOMFields(testContainer, {
        includeDuplicates: false,
      });

      expect(fields1.length).toBeGreaterThan(0);
      expect(fields2.length).toBe(0);
    });

    it('应该检测多种类型的表单字段', () => {
      const host = document.createElement('div');
      testContainer.appendChild(host);

      const shadowRoot = host.attachShadow({ mode: 'open' });

      // 添加不同类型的字段
      const input = document.createElement('input');
      input.type = 'text';
      shadowRoot.appendChild(input);

      const textarea = document.createElement('textarea');
      shadowRoot.appendChild(textarea);

      const select = document.createElement('select');
      shadowRoot.appendChild(select);

      const fields = detector.detectShadowDOMFields(testContainer);

      expect(fields.length).toBe(3);
    });

    it('应该忽略隐藏字段', () => {
      const host = document.createElement('div');
      testContainer.appendChild(host);

      const shadowRoot = host.attachShadow({ mode: 'open' });

      // 添加隐藏字段
      const hiddenInput = document.createElement('input');
      hiddenInput.type = 'hidden';
      shadowRoot.appendChild(hiddenInput);

      // 添加密码字段
      const passwordInput = document.createElement('input');
      passwordInput.type = 'password';
      shadowRoot.appendChild(passwordInput);

      // 添加文件字段
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      shadowRoot.appendChild(fileInput);

      const fields = detector.detectShadowDOMFields(testContainer);

      // 应该过滤掉这些字段
      expect(fields.length).toBe(0);
    });

    it('应该忽略不可见字段', () => {
      const host = document.createElement('div');
      testContainer.appendChild(host);

      const shadowRoot = host.attachShadow({ mode: 'open' });

      const input = document.createElement('input');
      input.style.display = 'none';
      shadowRoot.appendChild(input);

      const fields = detector.detectShadowDOMFields(testContainer);

      expect(fields.length).toBe(0);
    });
  });

  describe('hasShadowRoot', () => {
    it('应该检测 open Shadow DOM', () => {
      const host = document.createElement('div');
      host.attachShadow({ mode: 'open' });

      const hasShadow = detector['hasShadowRoot'](host);

      expect(hasShadow).toBe(true);
    });

    it('应该检测没有 Shadow DOM 的元素', () => {
      const div = document.createElement('div');

      const hasShadow = detector['hasShadowRoot'](div);

      expect(hasShadow).toBe(false);
    });
  });

  describe('边界情况', () => {
    it('应该处理空容器', () => {
      const emptyDiv = document.createElement('div');

      const fields = detector.detectShadowDOMFields(emptyDiv);

      expect(fields).toEqual([]);
    });

    it('应该处理没有 Shadow DOM 的容器', () => {
      const div = document.createElement('div');
      const input = document.createElement('input');
      div.appendChild(input);

      const fields = detector.detectShadowDOMFields(div);

      // 不应该检测到普通 DOM 中的字段
      expect(fields.length).toBe(0);
    });

    it('应该处理 null 配置', () => {
      const host = document.createElement('div');
      testContainer.appendChild(host);

      const shadowRoot = host.attachShadow({ mode: 'open' });
      const input = document.createElement('input');
      shadowRoot.appendChild(input);

      const fields = detector.detectShadowDOMFields(testContainer);

      expect(fields.length).toBeGreaterThan(0);
    });
  });
});
