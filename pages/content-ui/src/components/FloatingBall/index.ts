/**
 * 悬浮球组件导出
 */

export { FloatingBall } from './FloatingBall';
export { FloatingPanel } from './FloatingPanel';
export { QuickAddBacklink } from './QuickAddBacklink';
export type { QuickAddBacklinkProps } from './QuickAddBacklink';
export {
  FloatingBallState,
  type FloatingBallProps,
  type FillPayload,
  type FormField,
  type FormDetectionResult,
  type WebsiteProfile,
  type ManagedBacklink,
} from './types';
export {
  extractPageInfo,
  extractDomain,
  normalizeUrl,
  isValidUrl,
  generateId,
  parseKeywords,
  formatKeywords,
  type ExtractedPageInfo,
} from './utils';
