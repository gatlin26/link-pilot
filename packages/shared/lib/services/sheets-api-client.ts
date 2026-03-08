/**
 * Google Sheets API 客户端
 * 通过 Google Apps Script Web App 与 Google Sheets 交互
 */

import type {
  CollectedBacklink,
  Opportunity,
  SiteTemplate,
  Submission,
} from '../types/models.js';

/**
 * API 响应接口
 */
export interface SheetsApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

/**
 * 批量操作结果
 */
export interface BatchResult {
  total: number;
  success: number;
  failed: number;
  errors?: Array<{ index: number; error: string }>;
}

/**
 * Google Sheets API 客户端配置
 */
export interface SheetsApiClientConfig {
  webAppUrl: string;
  timeout?: number;
}

/**
 * Google Sheets API 客户端
 */
export class SheetsApiClient {
  private webAppUrl: string;
  private timeout: number;

  constructor(config: SheetsApiClientConfig) {
    this.webAppUrl = config.webAppUrl;
    this.timeout = config.timeout || 30000; // 默认 30 秒超时
  }

  /**
   * 发送 POST 请求
   */
  private async post<T>(
    path: string,
    data: unknown,
  ): Promise<SheetsApiResponse<T>> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.webAppUrl}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result as SheetsApiResponse<T>;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error('请求超时');
        }
        throw error;
      }
      throw new Error('未知错误');
    }
  }

  /**
   * 同步已收集外链
   */
  async syncBacklinks(
    backlinks: CollectedBacklink[],
  ): Promise<SheetsApiResponse<BatchResult>> {
    return this.post<BatchResult>('/api/backlinks', { backlinks });
  }

  /**
   * 同步机会
   */
  async syncOpportunities(
    opportunities: Opportunity[],
  ): Promise<SheetsApiResponse<BatchResult>> {
    return this.post<BatchResult>('/api/opportunities', { opportunities });
  }

  /**
   * 同步站点模板
   */
  async syncTemplates(
    templates: SiteTemplate[],
  ): Promise<SheetsApiResponse<BatchResult>> {
    return this.post<BatchResult>('/api/templates', { templates });
  }

  /**
   * 同步提交记录
   */
  async syncSubmissions(
    submissions: Submission[],
  ): Promise<SheetsApiResponse<BatchResult>> {
    return this.post<BatchResult>('/api/submissions', { submissions });
  }

  /**
   * 测试连接
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.post<{ version: string }>('/api/ping', {});
      return response.success;
    } catch {
      return false;
    }
  }
}
