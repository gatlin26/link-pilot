/**
 * 表单填充编排器
 * 协调表单检测、置信度计算和自动填充流程
 */

import { formDetector } from './form-detector';
import { autoFillService } from './auto-fill-service';
import { confidenceCalculator } from './confidence-calculator';
import { templateLearner } from '../template/template-learner';
import { templateStorage } from '@extension/storage';
import { extensionSettingsStorage } from '@extension/storage';
import type { FillData } from '@extension/shared';

/**
 * 编排结果
 */
export interface OrchestrationResult {
  /** 是否检测到表单 */
  detected: boolean;
  /** 置信度 */
  confidence: number;
  /** 建议的行为 */
  behavior: 'auto_fill' | 'prompt_user' | 'manual_only';
  /** 是否已自动填充 */
  autoFilled: boolean;
  /** 填充结果 */
  fillResult?: {
    success: boolean;
    filledFields: string[];
    failedFields: string[];
  };
  /** 错误信息 */
  error?: string;
}

/**
 * 表单填充编排器
 */
export class FormFillOrchestrator {
  /**
   * 执行完整的表单检测和填充流程
   */
  async orchestrate(fillData: FillData, autoSubmit = false): Promise<OrchestrationResult> {
    try {
      // 1. 检测表单
      const detectionResult = await formDetector.detect();

      if (!detectionResult.detected) {
        return {
          detected: false,
          confidence: 0,
          behavior: 'manual_only',
          autoFilled: false,
        };
      }

      // 2. 计算置信度（考虑历史成功率）
      let historicalSuccessRate: number | undefined;
      if (detectionResult.template) {
        historicalSuccessRate = await templateStorage.getSuccessRate(detectionResult.template.id);
      }

      const confidence = confidenceCalculator.calculateFormConfidence(
        detectionResult.fields,
        detectionResult.template,
        historicalSuccessRate
      );

      // 3. 决定填充行为
      const decision = await autoFillService.decideFill(confidence);

      // 4. 根据决策执行填充
      if (decision.shouldAutoFill) {
        // 自动填充
        const fillResult = await autoFillService.fill(
          detectionResult.fields,
          fillData,
          autoSubmit
        );

        // 记录模板使用
        if (detectionResult.template) {
          await templateStorage.recordUsage(detectionResult.template.id, fillResult.success);
        }

        // 如果没有模板且填充成功，自动学习
        if (!detectionResult.template && fillResult.success) {
          const settings = await extensionSettingsStorage.get();
          if (settings.auto_save_template_after_fill) {
            await templateLearner.learnFromCurrentPage(detectionResult.fields, 'auto');
          }
        }

        return {
          detected: true,
          confidence,
          behavior: 'auto_fill',
          autoFilled: true,
          fillResult: {
            success: fillResult.success,
            filledFields: fillResult.filledFields,
            failedFields: fillResult.failedFields,
          },
        };
      } else if (decision.shouldPromptUser) {
        // 提示用户
        return {
          detected: true,
          confidence,
          behavior: 'prompt_user',
          autoFilled: false,
        };
      } else {
        // 仅手动
        return {
          detected: true,
          confidence,
          behavior: 'manual_only',
          autoFilled: false,
        };
      }
    } catch (error) {
      return {
        detected: false,
        confidence: 0,
        behavior: 'manual_only',
        autoFilled: false,
        error: error instanceof Error ? error.message : '未知错误',
      };
    }
  }

  /**
   * 手动填充（用户确认后）
   */
  async manualFill(fillData: FillData, autoSubmit = false): Promise<OrchestrationResult> {
    try {
      const detectionResult = await formDetector.detect();

      if (!detectionResult.detected) {
        return {
          detected: false,
          confidence: 0,
          behavior: 'manual_only',
          autoFilled: false,
          error: '未检测到表单',
        };
      }

      const fillResult = await autoFillService.fill(
        detectionResult.fields,
        fillData,
        autoSubmit
      );

      // 记录模板使用
      if (detectionResult.template) {
        await templateStorage.recordUsage(detectionResult.template.id, fillResult.success);
      }

      // 如果没有模板且填充成功，询问是否学习
      if (!detectionResult.template && fillResult.success) {
        const settings = await extensionSettingsStorage.get();
        if (settings.enable_assisted_learning) {
          // 这里应该显示 UI 询问用户是否保存模板
          // 暂时自动保存
          await templateLearner.learnFromCurrentPage(detectionResult.fields, 'user_assisted');
        }
      }

      return {
        detected: true,
        confidence: detectionResult.confidence,
        behavior: 'manual_only',
        autoFilled: true,
        fillResult: {
          success: fillResult.success,
          filledFields: fillResult.filledFields,
          failedFields: fillResult.failedFields,
        },
      };
    } catch (error) {
      return {
        detected: false,
        confidence: 0,
        behavior: 'manual_only',
        autoFilled: false,
        error: error instanceof Error ? error.message : '未知错误',
      };
    }
  }

  /**
   * 撤销填充
   */
  undo(): boolean {
    return autoFillService.undo();
  }

  /**
   * 检查是否可以撤销
   */
  canUndo(): boolean {
    return autoFillService.canUndo();
  }
}

/**
 * 导出单例
 */
export const formFillOrchestrator = new FormFillOrchestrator();
