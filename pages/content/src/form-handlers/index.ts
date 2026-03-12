/**
 * 表单处理器导出
 */

export { formDetector, FormDetector } from './form-detector';
export type { FormField, FormDetectionResult } from './form-detector';

export { autoFillService, AutoFillService } from './auto-fill-service';
export type { FillDecision } from './auto-fill-service';
export type { FillData, FillResult } from '@extension/shared';

export { blogCommentHandler, BlogCommentHandler } from './blog-comment-handler';

export { confidenceCalculator, ConfidenceCalculator, ConfidenceLevel, AutoFillBehavior } from './confidence-calculator';

export { formFillOrchestrator, FormFillOrchestrator } from './form-fill-orchestrator';
export type { OrchestrationResult } from './form-fill-orchestrator';

export { fieldTypeInferrer, FieldTypeInferrer } from './field-type-inferrer';
export type { FieldType, FieldInfo, InferenceResult } from './field-type-inferrer';

export { assistedLearningService, AssistedLearningService, LearningState } from './assisted-learning';
export type { DetectedField, LearningSession } from './assisted-learning';
