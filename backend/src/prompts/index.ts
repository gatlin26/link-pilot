// 使用 raw import 引用 txt 文件
import toolBasicInfoPrompt from './tool-basic-info.txt';
import toolContentDePrompt from './tool-content-de.txt';
import toolContentEnPrompt from './tool-content-en.txt';
import toolContentEsPrompt from './tool-content-es.txt';
import toolContentFrPrompt from './tool-content-fr.txt';
import toolContentJaPrompt from './tool-content-ja.txt';
import toolContentKoPrompt from './tool-content-ko.txt';
import toolContentPtPrompt from './tool-content-pt.txt';
import toolContentViPrompt from './tool-content-vi.txt';
import toolContentZhTWPrompt from './tool-content-zh-TW.txt';
import toolContentZhPrompt from './tool-content-zh.txt';

/**
 * 提示词模板变量类型
 */
export type PromptVariables = Record<string, string>;

/**
 * 可用的提示词模板名称
 */
export type PromptTemplateName =
  | 'tool-basic-info'
  | 'tool-content-en'
  | 'tool-content-zh'
  | 'tool-content-zh-TW'
  | 'tool-content-ko'
  | 'tool-content-ja'
  | 'tool-content-pt'
  | 'tool-content-es'
  | 'tool-content-de'
  | 'tool-content-fr'
  | 'tool-content-vi';

/**
 * 提示词模板映射
 */
const PROMPT_TEMPLATES: Record<PromptTemplateName, string> = {
  'tool-basic-info': toolBasicInfoPrompt,
  'tool-content-en': toolContentEnPrompt,
  'tool-content-zh': toolContentZhPrompt,
  'tool-content-zh-TW': toolContentZhTWPrompt,
  'tool-content-ko': toolContentKoPrompt,
  'tool-content-ja': toolContentJaPrompt,
  'tool-content-pt': toolContentPtPrompt,
  'tool-content-es': toolContentEsPrompt,
  'tool-content-de': toolContentDePrompt,
  'tool-content-fr': toolContentFrPrompt,
  'tool-content-vi': toolContentViPrompt,
};

/**
 * 获取提示词模板
 */
export function getPromptTemplate(templateName: PromptTemplateName): string {
  const template = PROMPT_TEMPLATES[templateName];
  if (!template) {
    throw new Error(`Unknown prompt template: ${templateName}`);
  }
  return template;
}

/**
 * 渲染提示词模板，替换变量占位符
 * 占位符格式: {{variableName}}
 */
export function renderPrompt(
  templateName: PromptTemplateName,
  variables: PromptVariables
): string {
  let template = getPromptTemplate(templateName);

  for (const [key, value] of Object.entries(variables)) {
    const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    template = template.replace(placeholder, value);
  }

  return template;
}
