/**
 * 字段分析器类型定义
 * 适配自 superfill.ai 的类型系统
 *
 * @author yiangto
 * @date 2026-03-13
 */

/**
 * 表单字段元素类型
 * 支持的 HTML 表单元素
 */
export type FormFieldElement =
  | HTMLInputElement
  | HTMLTextAreaElement
  | HTMLSelectElement;

/**
 * 字段类型
 * 根据 HTML 元素类型和属性分类
 */
export type FieldType =
  | 'text'       // 文本输入
  | 'email'      // 邮箱输入
  | 'tel'        // 电话输入
  | 'url'        // URL 输入
  | 'textarea'   // 多行文本
  | 'select'     // 下拉选择
  | 'checkbox'   // 复选框
  | 'date'       // 日期输入
  | 'number'     // 数字输入
  | 'password';  // 密码输入

/**
 * 字段用途
 * 根据标签、属性等推断字段的实际用途
 */
export type FieldPurpose =
  | 'name'       // 姓名
  | 'email'      // 邮箱
  | 'phone'      // 电话
  | 'address'    // 地址
  | 'city'       // 城市
  | 'state'      // 州/省
  | 'zip'        // 邮编
  | 'country'    // 国家
  | 'company'    // 公司
  | 'title'      // 职位
  | 'unknown';   // 未知

/**
 * 字段元数据
 * 包含字段的所有分析信息
 */
export interface FieldMetadata {
  // 基本属性
  id: string | null;
  name: string | null;
  className: string | null;
  type: string;

  // 标签来源（7 种）
  labelTag: string | null;      // <label> 标签
  labelData: string | null;      // data-label 属性
  labelAria: string | null;      // aria-label 或 aria-labelledby
  labelLeft: string | null;      // 左侧位置标签
  labelTop: string | null;       // 上方位置标签

  // 辅助信息
  placeholder: string | null;    // placeholder 属性
  helperText: string | null;     // 帮助文本
  autocomplete: string | null;   // autocomplete 属性

  // 字段状态
  required: boolean;             // 是否必填
  disabled: boolean;             // 是否禁用
  readonly: boolean;             // 是否只读
  maxLength: number | null;      // 最大长度

  // 位置信息
  rect: DOMRect;                 // 元素位置和尺寸

  // 当前值
  currentValue: string;          // 字段当前值

  // 分类信息
  fieldType: FieldType;          // 字段类型
  fieldPurpose: FieldPurpose;    // 字段用途

  // 可见性和交互性
  isVisible: boolean;            // 是否可见
  isTopElement: boolean;         // 是否在最上层（未被遮挡）
  isInteractive: boolean;        // 是否可交互

  // 选择框选项（仅 select 类型）
  options?: SelectOption[];
}

/**
 * 选择框选项
 */
export interface SelectOption {
  value: string;                 // 选项值
  label: string | null;          // 选项标签
  element: HTMLOptionElement;    // 选项元素
}

/**
 * 检测到的字段
 * 包含元素引用和元数据
 */
export interface DetectedField {
  element: FormFieldElement;     // DOM 元素
  metadata: FieldMetadata;       // 字段元数据
}
