/**
 * 业务类型检测服务实现
 */

import type { BusinessTypeDetectorService } from '../interfaces/services.js';
import { BusinessType } from '../types/enums.js';
import { identifyBusinessTypes, extractKeywords } from '../rules/business-type-rules.js';

export class BusinessTypeDetectorServiceImpl implements BusinessTypeDetectorService {
  /**
   * 检测业务类型
   */
  detect(url: string, title: string, anchorText: string): BusinessType[] {
    return identifyBusinessTypes(url, title, anchorText);
  }

  /**
   * 提取关键词
   */
  extractKeywords(text: string): string[] {
    return extractKeywords(text);
  }
}

export const businessTypeDetectorService = new BusinessTypeDetectorServiceImpl();
