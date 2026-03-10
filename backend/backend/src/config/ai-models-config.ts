/**
 * @file ai-models-config.ts
 * @description AI 生图模型配置 - 对接 EvoLink API
 * @author git.username
 * @date 2025-12-26
 */

export interface AIModel {
  id: string;
  name: string;
  /** 特性标签的 i18n key 列表 */
  tagKeys: string[];
  duration: string;
  aspectRatios: string[];
  /** EvoLink API 的实际模型标识符 */
  evolinkModel: string;
  /** 质量选项（仅部分模型支持） */
  qualities?: string[];
  /** 最大输入图片数量 */
  maxInputImages?: number;
  /** 每次生成消耗的 Credits */
  creditsPerGeneration: number;
  /** 成本价格（美元），用于利润计算 */
  costUsd: number;
}

/**
 * AI 生图模型列表
 * 基于 EvoLink API 文档更新（2025-12-26）
 */
export const AI_MODELS: AIModel[] = [
  {
    id: 'nano-banana',
    name: 'Nano Banana',
    tagKeys: ['fastGeneration', 'strongConsistency', 'strongComprehension'],
    duration: '20-30秒',
    aspectRatios: ['auto', '1:1', '2:3', '3:2', '4:3', '3:4', '16:9', '9:16'],
    evolinkModel: 'gemini-2.5-flash-image',
    maxInputImages: 5,
    creditsPerGeneration: 2,
    costUsd: 0.022,
  },
  {
    id: 'nano-banana-pro',
    name: 'Nano Banana Pro',
    tagKeys: ['4kHd', 'strongComprehension', 'fastGeneration'],
    duration: '20-30秒',
    aspectRatios: [
      'auto',
      '1:1',
      '2:3',
      '3:2',
      '3:4',
      '4:3',
      '4:5',
      '5:4',
      '9:16',
      '16:9',
      '21:9',
    ],
    evolinkModel: 'nano-banana-2-lite',
    qualities: ['1K', '2K', '4K'],
    maxInputImages: 10,
    creditsPerGeneration: 4,
    costUsd: 0.043,
  },
  {
    id: 'seedream-4.5',
    name: 'Seedream 4.5',
    tagKeys: ['fastGeneration', 'strongConsistency', '4kHd', 'multiImageGen'],
    duration: '30-45秒',
    aspectRatios: ['1:1', '4:3', '3:4', '16:9', '9:16'],
    evolinkModel: 'doubao-seedream-4.5',
    maxInputImages: 14,
    creditsPerGeneration: 3,
    costUsd: 0.031,
  },
  {
    id: 'z-image-turbo',
    name: 'Z Image Turbo',
    tagKeys: ['ultraFast', 'highQuality', 'asyncProcess'],
    duration: '10-20秒',
    aspectRatios: [
      '1:1',
      '2:3',
      '3:2',
      '3:4',
      '4:3',
      '9:16',
      '16:9',
      '1:2',
      '2:1',
    ],
    evolinkModel: 'z-image-turbo',
    creditsPerGeneration: 2,
    costUsd: 0.026,
  },
];

/**
 * 默认模型
 */
export const DEFAULT_MODEL = AI_MODELS[0];

/**
 * 根据前端模型 ID 获取 EvoLink 模型标识符
 */
export function getEvolinkModelId(modelId: string): string | null {
  const model = AI_MODELS.find((m) => m.id === modelId);
  return model?.evolinkModel || null;
}

/**
 * 根据 EvoLink 模型标识符获取前端模型配置
 */
export function getModelByEvolinkId(evolinkModel: string): AIModel | null {
  return AI_MODELS.find((m) => m.evolinkModel === evolinkModel) || null;
}

/**
 * 根据模型 ID 获取支持的宽高比列表
 */
export function getModelAspectRatios(modelId: string): string[] {
  const model = AI_MODELS.find((m) => m.id === modelId);
  return model?.aspectRatios || ['1:1'];
}

/**
 * 根据模型 ID 获取模型配置
 */
export function getModelById(modelId: string): AIModel | null {
  return AI_MODELS.find((m) => m.id === modelId) || null;
}

/**
 * 根据模型 ID 获取每次生成消耗的 Credits
 * @param modelId 模型 ID
 * @returns Credits 消耗数量，默认返回 2
 */
export function getModelCredits(modelId: string): number {
  const model = AI_MODELS.find((m) => m.id === modelId);
  return model?.creditsPerGeneration ?? 2;
}

/**
 * 获取免费用户可用的模型列表（消耗 ≤ maxCredits 的模型）
 * @param maxCredits 最大允许的 credits 消耗
 */
export function getFreeUserModels(maxCredits: number): AIModel[] {
  return AI_MODELS.filter((m) => m.creditsPerGeneration <= maxCredits);
}

/**
 * 检查模型是否对免费用户可用
 * @param modelId 模型 ID
 * @param maxCredits 免费用户允许的最大 credits 消耗
 */
export function isModelAvailableForFreeUser(
  modelId: string,
  maxCredits: number
): boolean {
  const model = AI_MODELS.find((m) => m.id === modelId);
  return model ? model.creditsPerGeneration <= maxCredits : false;
}

/**
 * 根据模型计算积分消耗（质量不影响积分）
 * @param modelId 模型 ID
 * @param quality 图片质量 ('1K' | '2K' | '4K')，此参数保留用于未来扩展，但不影响积分计算
 * @returns 积分消耗数量
 */
export function calculateCreditsForGeneration(
  modelId: string,
  quality?: string
): number {
  const model = AI_MODELS.find((m) => m.id === modelId);
  if (!model) {
    return 2; // 默认值
  }

  // 积分只根据模型计算，质量不影响积分
  return model.creditsPerGeneration;
}
