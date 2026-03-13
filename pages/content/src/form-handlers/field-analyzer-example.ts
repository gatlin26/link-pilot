/**
 * FieldAnalyzer 集成验证示例
 *
 * 本文件展示如何使用集成后的 FieldAnalyzer
 *
 * @author yiangto
 * @date 2026-03-13
 */

import { FieldAnalyzer } from './field-analyzer';
import type { DetectedField, FormFieldElement } from '../types/field-analyzer';
import { mapFieldPurposeToLinkPilot, calculateFieldQuality } from '../utils/field-type-mapper';

/**
 * 示例：分析页面上的所有表单字段
 */
export function analyzePageFields() {
  const analyzer = new FieldAnalyzer();

  // 查找所有表单元素
  const formElements = document.querySelectorAll<FormFieldElement>(
    'input:not([type="hidden"]):not([type="password"]), textarea, select'
  );

  const results = [];

  for (const element of Array.from(formElements)) {
    // 检查是否可见
    if (!analyzer.isElementVisible(element)) {
      continue;
    }

    // 分析字段
    const detectedField: DetectedField = {
      element,
      metadata: {} as any,
    };

    const metadata = analyzer.analyzeField(detectedField);
    detectedField.metadata = metadata;

    // 映射到 link-pilot 字段类型
    const linkPilotType = mapFieldPurposeToLinkPilot(
      metadata.fieldPurpose,
      metadata
    );

    // 计算质量分数
    const qualityScore = calculateFieldQuality(metadata);

    results.push({
      element,
      metadata,
      linkPilotType,
      qualityScore,
    });

    // 打印分析结果
    console.log('字段分析结果:', {
      // 7 种标签来源
      labels: {
        labelTag: metadata.labelTag,
        labelAria: metadata.labelAria,
        labelData: metadata.labelData,
        labelLeft: metadata.labelLeft,
        labelTop: metadata.labelTop,
        placeholder: metadata.placeholder,
        helperText: metadata.helperText,
      },
      // 字段分类
      fieldType: metadata.fieldType,
      fieldPurpose: metadata.fieldPurpose,
      linkPilotType,
      // 质量评分
      qualityScore,
      // 可见性和交互性
      isVisible: metadata.isVisible,
      isTopElement: metadata.isTopElement,
      isInteractive: metadata.isInteractive,
    });
  }

  return results;
}

/**
 * 示例：分析单个字段
 */
export function analyzeSingleField(element: FormFieldElement) {
  const analyzer = new FieldAnalyzer();

  const detectedField: DetectedField = {
    element,
    metadata: {} as any,
  };

  const metadata = analyzer.analyzeField(detectedField);

  return {
    // 基本属性
    id: metadata.id,
    name: metadata.name,
    type: metadata.type,

    // 7 种标签来源
    labelTag: metadata.labelTag,
    labelAria: metadata.labelAria,
    labelData: metadata.labelData,
    labelLeft: metadata.labelLeft,
    labelTop: metadata.labelTop,
    placeholder: metadata.placeholder,
    helperText: metadata.helperText,

    // 分类信息
    fieldType: metadata.fieldType,
    fieldPurpose: metadata.fieldPurpose,

    // 映射到 link-pilot 类型
    linkPilotType: mapFieldPurposeToLinkPilot(metadata.fieldPurpose, metadata),

    // 质量分数
    qualityScore: calculateFieldQuality(metadata),

    // 可见性和交互性
    isVisible: metadata.isVisible,
    isTopElement: metadata.isTopElement,
    isInteractive: metadata.isInteractive,
  };
}
