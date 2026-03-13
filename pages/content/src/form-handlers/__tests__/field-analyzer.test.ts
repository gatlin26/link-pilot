/**
 * FieldAnalyzer 单元测试
 * 测试字段分析器的核心功能
 *
 * @author yiangto
 * @date 2026-03-13
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { FieldAnalyzer } from '../field-analyzer';
import type { DetectedField, FormFieldElement } from '../../types/field-analyzer';

describe('FieldAnalyzer', () => {
  let analyzer: FieldAnalyzer;

  beforeEach(() => {
    analyzer = new FieldAnalyzer();
  });

  describe('analyzeField', () => {
    it('应该正确识别 email 字段', () => {
      // 创建测试元素
      const input = document.createElement('input');
      input.type = 'email';
      input.name = 'user_email';
      input.placeholder = '请输入邮箱';

      const field: DetectedField = {
        element: input as FormFieldElement,
        metadata: {} as any,
      };

      // 分析字段
      const metadata = analyzer.analyzeField(field);

      // 验证结果
      expect(metadata.fieldPurpose).toBe('email');
      expect(metadata.confidence).toBeGreaterThan(0.7);
    });

    it('应该正确识别 name 字段', () => {
      const input = document.createElement('input');
      input.type = 'text';
      input.name = 'author_name';
      input.placeholder = '您的姓名';

      const field: DetectedField = {
        element: input as FormFieldElement,
        metadata: {} as any,
      };

      const metadata = analyzer.analyzeField(field);

      expect(metadata.fieldPurpose).toBe('name');
      expect(metadata.confidence).toBeGreaterThan(0.5);
    });

    it('应该正确识别 comment 字段', () => {
      const textarea = document.createElement('textarea');
      textarea.name = 'comment_content';
      textarea.placeholder = '请输入评论';

      const field: DetectedField = {
        element: textarea as FormFieldElement,
        metadata: {} as any,
      };

      const metadata = analyzer.analyzeField(field);

      expect(metadata.fieldPurpose).toBe('comment');
      expect(metadata.confidence).toBeGreaterThan(0.6);
    });

    it('应该正确识别 website 字段', () => {
      const input = document.createElement('input');
      input.type = 'url';
      input.name = 'website';
      input.placeholder = '您的网站';

      const field: DetectedField = {
        element: input as FormFieldElement,
        metadata: {} as any,
      };

      const metadata = analyzer.analyzeField(field);

      expect(metadata.fieldPurpose).toBe('website');
      expect(metadata.confidence).toBeGreaterThan(0.6);
    });

    it('应该检测必填字段', () => {
      const input = document.createElement('input');
      input.type = 'text';
      input.name = 'name';
      input.required = true;

      const field: DetectedField = {
        element: input as FormFieldElement,
        metadata: {} as any,
      };

      const metadata = analyzer.analyzeField(field);

      expect(metadata.required).toBe(true);
    });

    it('应该处理中文关键词', () => {
      const input = document.createElement('input');
      input.type = 'text';
      input.name = 'user_name';
      input.placeholder = '昵称';

      const field: DetectedField = {
        element: input as FormFieldElement,
        metadata: {} as any,
      };

      const metadata = analyzer.analyzeField(field);

      expect(metadata.fieldPurpose).toBe('name');
    });
  });

  describe('isElementVisible', () => {
    it('应该检测可见元素', () => {
      const input = document.createElement('input');
      document.body.appendChild(input);

      const isVisible = analyzer.isElementVisible(input as FormFieldElement);

      expect(isVisible).toBe(true);

      document.body.removeChild(input);
    });

    it('应该检测隐藏元素 (display: none)', () => {
      const input = document.createElement('input');
      input.style.display = 'none';
      document.body.appendChild(input);

      const isVisible = analyzer.isElementVisible(input as FormFieldElement);

      expect(isVisible).toBe(false);

      document.body.removeChild(input);
    });

    it('应该检测隐藏元素 (visibility: hidden)', () => {
      const input = document.createElement('input');
      input.style.visibility = 'hidden';
      document.body.appendChild(input);

      const isVisible = analyzer.isElementVisible(input as FormFieldElement);

      expect(isVisible).toBe(false);

      document.body.removeChild(input);
    });

    it('应该检测隐藏元素 (opacity: 0)', () => {
      const input = document.createElement('input');
      input.style.opacity = '0';
      document.body.appendChild(input);

      const isVisible = analyzer.isElementVisible(input as FormFieldElement);

      expect(isVisible).toBe(false);

      document.body.removeChild(input);
    });
  });

  describe('边界情况', () => {
    it('应该处理没有属性的元素', () => {
      const input = document.createElement('input');

      const field: DetectedField = {
        element: input as FormFieldElement,
        metadata: {} as any,
      };

      const metadata = analyzer.analyzeField(field);

      expect(metadata).toBeDefined();
      expect(metadata.fieldPurpose).toBeDefined();
    });

    it('应该处理空字符串属性', () => {
      const input = document.createElement('input');
      input.name = '';
      input.placeholder = '';

      const field: DetectedField = {
        element: input as FormFieldElement,
        metadata: {} as any,
      };

      const metadata = analyzer.analyzeField(field);

      expect(metadata).toBeDefined();
    });
  });
});
