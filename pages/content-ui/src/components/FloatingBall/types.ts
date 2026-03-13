/**
 * 悬浮球状态枚举
 */
export enum FloatingBallState {
  /** 隐藏 */
  HIDDEN = 'hidden',
  /** 收起态 */
  COLLAPSED = 'collapsed',
  /** 检测到表单 - 呼吸态（高置信度） */
  DETECTED_BREATH = 'detected_breath',
  /** 低置信度 - 小蓝点 */
  DETECTED_SUBTLE = 'detected_subtle',
  /** 展开态 */
  EXPANDED = 'expanded',
  /** 填充中 */
  FILLING = 'filling',
  /** 填充成功 */
  SUCCESS = 'success',
  /** 填充失败 */
  ERROR = 'error',
}

/**
 * 网站资料
 */
export interface WebsiteProfile {
  id: string;
  group_id: string;
  name: string;
  url: string;
  domain: string;
  email: string;
  comments: string[];
  enabled: boolean;
}

/**
 * 管理的外链
 */
export interface ManagedBacklink {
  id: string;
  group_id: string;
  url: string;
  domain: string;
  note?: string;
  keywords: string[];
  dr?: number;
  as?: number;
  flagged: boolean;
}

/**
 * 表单字段
 */
export interface FormField {
  type: 'name' | 'email' | 'website' | 'comment' | 'submit';
  element?: HTMLElement;
  selector: string;
  confidence: number;
}

/**
 * 表单检测结果
 */
export interface FormDetectionResult {
  detected: boolean;
  pageType: string | null;
  fields: FormField[];
  template: unknown;
  confidence: number;
}

/**
 * 悬浮球 Props
 */
export interface FloatingBallProps {
  /** 网站资料列表 */
  profiles: WebsiteProfile[];
  /** 当前页面 URL */
  currentUrl: string;
  /** 检测到的表单 */
  detectedForm: FormDetectionResult | null;
  /** 匹配的外链 */
  matchedBacklink?: ManagedBacklink | null;
  /** 匹配置信度 */
  matchConfidence?: number;
  /** 当前状态 */
  state: FloatingBallState;
  /** 状态变更回调 */
  onStateChange: (state: FloatingBallState) => void;
  /** 填充回调 */
  onFill: (data: FillPayload) => void;
  /** 关闭回调 */
  onClose: () => void;
}

/**
 * 填充数据载荷
 */
export interface FillPayload {
  /** 选中的网站资料 ID */
  profileId: string;
  /** 选中的外链 ID */
  backlinkId?: string;
  /** 填充模式 */
  fillMode: 'smart' | 'manual';
  /** 评论内容（手动模式时使用） */
  comment?: string;
  /** 是否自动提交 */
  autoSubmit?: boolean;
}

/**
 * 展开面板 Props
 */
export interface FloatingPanelProps {
  /** 网站资料列表 */
  profiles: WebsiteProfile[];
  /** 当前页面 URL */
  currentUrl: string;
  /** 检测到的表单 */
  detectedForm: FormDetectionResult | null;
  /** 匹配的外链 */
  matchedBacklink?: ManagedBacklink | null;
  /** 匹配置信度 */
  matchConfidence?: number;
  /** 当前状态 */
  state: FloatingBallState;
  /** 最小化回调 */
  onMinimize: () => void;
  /** 填充回调 */
  onFill: (data: FillPayload) => void;
  /** 关闭回调 */
  onClose: () => void;
}
