/**
 * 字段分析器常量
 * 用于判断元素的交互性和可见性
 *
 * @author yiangto
 * @date 2026-03-13
 */

/**
 * 交互式光标类型集合
 */
export const INTERACTIVE_CURSORS = new Set([
  'pointer',
  'move',
  'text',
  'grab',
  'grabbing',
  'cell',
  'copy',
  'alias',
  'all-scroll',
  'col-resize',
  'context-menu',
  'crosshair',
  'e-resize',
  'ew-resize',
  'n-resize',
  'ne-resize',
  'nesw-resize',
  'ns-resize',
  'nw-resize',
  'nwse-resize',
  'row-resize',
  's-resize',
  'se-resize',
  'sw-resize',
  'vertical-text',
  'w-resize',
  'zoom-in',
  'zoom-out',
]);

/**
 * 交互式 ARIA 角色集合
 */
export const INTERACTIVE_ROLES = new Set([
  'button',
  'menuitem',
  'tab',
  'switch',
  'slider',
  'spinbutton',
  'combobox',
  'searchbox',
  'textbox',
  'listbox',
  'option',
  'scrollbar',
]);

/**
 * 交互式标签集合
 */
export const INTERACTIVE_TAGS = new Set([
  'a',
  'button',
  'input',
  'select',
  'textarea',
  'details',
  'summary',
  'label',
  'option',
  'optgroup',
  'fieldset',
  'legend',
]);

/**
 * 字段用途推断模式
 */
export const FIELD_PURPOSE_PATTERNS: Array<{
  regex: RegExp;
  purpose: 'name' | 'email' | 'phone' | 'address' | 'city' | 'state' | 'zip' | 'country' | 'company' | 'title';
}> = [
  { regex: /\b(email|e-mail|mail)\b/i, purpose: 'email' },
  { regex: /\b(phone|tel|telephone|mobile|cell)\b/i, purpose: 'phone' },
  {
    regex:
      /\b(name|full[\s-]?name|first[\s-]?name|last[\s-]?name|given[\s-]?name|family[\s-]?name)\b/i,
    purpose: 'name',
  },
  {
    regex: /\b(address|street|addr|location|residence)\b/i,
    purpose: 'address',
  },
  { regex: /\b(city|town)\b/i, purpose: 'city' },
  { regex: /\b(state|province|region)\b/i, purpose: 'state' },
  { regex: /\b(zip|postal[\s-]?code|postcode)\b/i, purpose: 'zip' },
  { regex: /\b(country|nation)\b/i, purpose: 'country' },
  {
    regex: /\b(company|organization|employer|business)\b/i,
    purpose: 'company',
  },
  { regex: /\b(title|position|job[\s-]?title|role)\b/i, purpose: 'title' },
];

/**
 * autocomplete 属性映射
 */
export const AUTOCOMPLETE_MAP: Record<
  string,
  'name' | 'email' | 'phone' | 'address' | 'city' | 'state' | 'zip' | 'country' | 'company' | 'title'
> = {
  name: 'name',
  'given-name': 'name',
  'family-name': 'name',
  email: 'email',
  tel: 'phone',
  'street-address': 'address',
  'address-line1': 'address',
  'address-line2': 'address',
  city: 'city',
  state: 'state',
  'postal-code': 'zip',
  country: 'country',
  organization: 'company',
  'job-title': 'title',
};
