/**
 * AI 相关的工具函数
 */

/**
 * 清理 AI 返回的 JSON 响应
 * AI 有时会返回 ```json ... ``` 格式，需要清理
 */
export function cleanAIJsonResponse(content: string): string {
  let cleaned = content.trim();

  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }

  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }

  return cleaned.trim();
}

/**
 * 清理用户输入，防止 Prompt Injection 攻击
 * @param input 用户输入
 * @param maxLength 最大长度限制
 */
export function sanitizeForPrompt(input: string, maxLength = 500): string {
  return input
    .replace(/[`]/g, '\\`') // 转义反引号
    .replace(/\$\{/g, '\\${') // 转义模板字符串
    .replace(/\n{3,}/g, '\n\n') // 限制连续换行
    .slice(0, maxLength);
}

/**
 * 确保值是字符串数组
 */
export function ensureStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string');
  }
  if (typeof value === 'string') {
    return [value];
  }
  return [];
}

/**
 * EvoLink API 配置
 */
export const EVOLINK_CONFIG = {
  baseUrl: 'https://api.evolink.ai/v1/chat/completions',
  model: process.env.EVOLINK_MODEL || 'gemini-2.5-flash',
  timeout: 60000, // 60 秒超时
};

/**
 * 验证 EvoLink API 密钥是否配置
 */
export function validateEvolinkApiKey(): { valid: boolean; error?: string } {
  if (!process.env.EVOLINK_API_KEY) {
    return {
      valid: false,
      error: 'AI service is not configured. Please contact administrator.',
    };
  }
  return { valid: true };
}

/**
 * 调用 EvoLink API 的通用函数
 */
export async function callEvolinkAPI(params: {
  prompt: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<
  { success: true; content: string } | { success: false; error: string }
> {
  const { prompt, temperature = 0.7, maxTokens = 2500 } = params;

  // 验证 API 密钥
  const validation = validateEvolinkApiKey();
  if (!validation.valid) {
    return { success: false, error: validation.error! };
  }

  // 创建超时控制器
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    EVOLINK_CONFIG.timeout
  );

  try {
    const response = await fetch(EVOLINK_CONFIG.baseUrl, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.EVOLINK_API_KEY}`,
      },
      body: JSON.stringify({
        model: EVOLINK_CONFIG.model,
        messages: [{ role: 'user', content: prompt }],
        temperature,
        max_tokens: maxTokens,
      }),
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      // 生产环境不记录完整响应内容
      if (process.env.NODE_ENV === 'development') {
        console.error('EvoLink API error:', response.status, errorText);
      } else {
        console.error('EvoLink API error:', response.status);
      }
      return {
        success: false,
        error: `AI service error: ${response.status}`,
      };
    }

    const aiResult = await response.json();
    const content = aiResult.choices?.[0]?.message?.content;

    if (!content) {
      return {
        success: false,
        error: 'AI returned empty response',
      };
    }

    return { success: true, content };
  } catch (error) {
    clearTimeout(timeoutId);

    // 处理超时错误
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('EvoLink API timeout');
      return {
        success: false,
        error: 'AI service timeout. Please try again.',
      };
    }

    // 处理网络错误
    if (error instanceof TypeError && error.message.includes('fetch')) {
      console.error('EvoLink API network error:', error.message);
      return {
        success: false,
        error: 'Network error. Please check your connection.',
      };
    }

    console.error('EvoLink API error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'AI service error',
    };
  }
}

/**
 * 智能解析 AI 返回的 JSON，支持修复截断的 JSON
 * @param content AI 返回的原始内容
 * @returns 解析结果
 */
export function parseAIJsonResponse<T>(content: string): {
  success: boolean;
  data?: T;
  error?: string;
  partial?: boolean;
} {
  try {
    const cleaned = cleanAIJsonResponse(content);

    // 尝试修复常见的 JSON 截断问题
    let jsonStr = cleaned;

    // 检查是否有未闭合的字符串（最后一个引号后没有对应的闭合引号）
    const lastQuoteIndex = jsonStr.lastIndexOf('"');
    if (lastQuoteIndex !== -1) {
      // 检查最后一个引号是否是字段名的引号（格式："fieldName":）
      const afterQuote = jsonStr.substring(lastQuoteIndex + 1).trim();
      if (
        !afterQuote.startsWith(':') &&
        !afterQuote.startsWith(',') &&
        !afterQuote.startsWith('}') &&
        !afterQuote.startsWith(']')
      ) {
        // 这是一个值的开始引号，但没有结束引号，需要补全
        jsonStr += '"';
      }
    }

    // 如果 JSON 不完整，尝试补全括号
    if (!jsonStr.endsWith('}') && !jsonStr.endsWith(']')) {
      // 计算未闭合的括号
      const openBraces = (jsonStr.match(/{/g) || []).length;
      const closeBraces = (jsonStr.match(/}/g) || []).length;
      const openBrackets = (jsonStr.match(/\[/g) || []).length;
      const closeBrackets = (jsonStr.match(/]/g) || []).length;

      const missingBraces = openBraces - closeBraces;
      const missingBrackets = openBrackets - closeBrackets;

      // 先补全数组括号，再补全对象括号
      if (missingBrackets > 0) {
        jsonStr += ']'.repeat(missingBrackets);
      }
      if (missingBraces > 0) {
        jsonStr += '}'.repeat(missingBraces);
      }
    }

    // 尝试解析
    const parsed = JSON.parse(jsonStr);
    return { success: true, data: parsed };
  } catch (error) {
    // 如果直接修复失败，尝试更激进的修复策略
    try {
      const cleaned = cleanAIJsonResponse(content);

      // 找到最后一个完整的字段
      // 匹配模式："fieldName": "value" 或 "fieldName": value 或 "fieldName": [...]
      const fields: Record<string, unknown> = {};

      // 匹配字符串值
      const stringPattern = /"(\w+)"\s*:\s*"([^"]*)"/g;
      let match: RegExpExecArray | null = stringPattern.exec(cleaned);

      while (match !== null) {
        fields[match[1]] = match[2];
        match = stringPattern.exec(cleaned);
      }

      // 匹配数组值（包括不完整的数组）
      const arrayPattern = /"(\w+)"\s*:\s*\[([^\]]*)\]?/g;
      match = arrayPattern.exec(cleaned);

      while (match !== null) {
        const fieldName = match[1];
        const arrayContent = match[2];

        // 提取数组中的字符串元素
        const elements: string[] = [];
        const elementPattern = /"([^"]*)"/g;
        let elementMatch: RegExpExecArray | null =
          elementPattern.exec(arrayContent);

        while (elementMatch !== null) {
          elements.push(elementMatch[1]);
          elementMatch = elementPattern.exec(arrayContent);
        }

        if (elements.length > 0) {
          fields[fieldName] = elements;
        }

        match = arrayPattern.exec(cleaned);
      }

      // 如果提取到了至少一个字段，返回部分数据
      if (Object.keys(fields).length > 0) {
        return {
          success: true,
          data: fields as T,
          partial: true,
        };
      }
    } catch {
      // 忽略部分提取失败
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to parse JSON',
    };
  }
}

/**
 * 带重试机制的 EvoLink API 调用
 * @param params API 调用参数
 * @param maxRetries 最大重试次数
 * @returns API 调用结果
 */
export async function callEvolinkAPIWithRetry(
  params: {
    prompt: string;
    temperature?: number;
    maxTokens?: number;
  },
  maxRetries = 2
): Promise<
  { success: true; content: string } | { success: false; error: string }
> {
  let lastError = '';

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const result = await callEvolinkAPI(params);

    if (result.success) {
      return result;
    }

    lastError = result.error;

    // 如果是超时或网络错误，等待后重试
    if (
      attempt < maxRetries &&
      (lastError.includes('timeout') ||
        lastError.includes('network') ||
        lastError.includes('Network'))
    ) {
      // 指数退避：1秒、2秒、4秒...
      await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt));
      continue;
    }

    // 其他错误不重试
    break;
  }

  return { success: false, error: lastError };
}
