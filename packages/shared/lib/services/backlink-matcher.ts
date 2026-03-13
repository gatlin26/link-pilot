/**
 * 外链智能匹配服务
 * @author gatlinyao
 * @date 2025-03-13
 */

import type { ManagedBacklink } from '../types/models.js';
import { LRUCache } from '../utils/lru-cache.js';
import { normalizeUrlAdvanced, extractDomainAdvanced } from '../utils/index.js';

/**
 * 匹配结果
 */
export interface MatchResult {
  /** 匹配的外链 */
  backlink: ManagedBacklink;
  /** 匹配分数 (0-1) */
  score: number;
  /** 匹配原因（用于调试和展示） */
  reasons: string[];
}

/**
 * 匹配上下文
 */
export interface MatchContext {
  /** 当前完整 URL */
  currentUrl: string;
  /** 当前域名 */
  currentDomain: string;
  /** 当前路径 */
  currentPath: string;
  /** 页面标题 */
  pageTitle: string;
  /** 页面关键词 */
  pageKeywords: string[];
  /** 是否检测到表单 */
  formDetected: boolean;
}

/**
 * 匹配权重配置
 */
const MATCH_WEIGHTS = {
  exactUrl: 1.0, // URL 完全匹配
  domainMatch: 0.7, // 域名匹配
  pathMatch: 0.5, // 路径模式匹配
  keywordMatch: 0.3, // 关键词匹配
  formBonus: 0.1, // 检测到表单的加成
};

/**
 * 置信度阈值
 */
const CONFIDENCE_THRESHOLDS = {
  high: 0.8, // 高置信度
  medium: 0.4, // 中等置信度
};

/**
 * 缓存项
 */
interface CacheItem {
  results: MatchResult[];
  timestamp: number;
}

/**
 * 外链智能匹配器
 * 根据当前页面 URL 智能匹配外链库中的外链机会
 */
export class BacklinkMatcher {
  private cache: LRUCache<string, CacheItem>;
  private readonly cacheTtlMs: number = 5 * 60 * 1000; // 5分钟缓存

  constructor() {
    // 使用 LRU 缓存，限制最大 100 条
    this.cache = new LRUCache<string, CacheItem>(100);
  }

  /**
   * 查找匹配的外链
   * @param context 匹配上下文
   * @param backlinks 外链列表（可选，如不提供则从 storage 获取）
   * @returns 匹配结果列表，按分数降序排列
   */
  async findMatches(context: MatchContext, backlinks?: ManagedBacklink[]): Promise<MatchResult[]> {
    // 检查缓存
    const cacheKey = this.generateCacheKey(context);
    const cached = this.getCachedResult(cacheKey);
    if (cached) {
      return cached;
    }

    // 获取外链数据
    const backlinkList = backlinks ?? await this.fetchBacklinksFromStorage();
    if (backlinkList.length === 0) {
      return [];
    }

    // 计算匹配分数
    const results: MatchResult[] = [];
    for (const backlink of backlinkList) {
      const score = this.calculateMatchScore(backlink, context);
      if (score >= CONFIDENCE_THRESHOLDS.medium) {
        results.push({
          backlink,
          score,
          reasons: this.generateMatchReasons(backlink, context, score),
        });
      }
    }

    // 按分数降序排列
    results.sort((a, b) => b.score - a.score);

    // 缓存结果
    this.setCachedResult(cacheKey, results);

    return results;
  }

  /**
   * 计算匹配分数
   * @param backlink 外链
   * @param context 匹配上下文
   * @returns 匹配分数 (0-1)
   */
  private calculateMatchScore(backlink: ManagedBacklink, context: MatchContext): number {
    const normalizedBacklinkUrl = this.normalizeUrl(backlink.url);
    const normalizedCurrentUrl = this.normalizeUrl(context.currentUrl);
    const normalizedBacklinkDomain = this.normalizeDomain(backlink.domain);
    const normalizedCurrentDomain = this.normalizeDomain(context.currentDomain);

    let score = 0;
    let matchedFactors = 0;

    // 1. URL 完全匹配 (最高权重)
    if (normalizedBacklinkUrl === normalizedCurrentUrl) {
      score += MATCH_WEIGHTS.exactUrl;
      matchedFactors++;
    }

    // 2. 域名匹配
    if (normalizedBacklinkDomain === normalizedCurrentDomain) {
      score += MATCH_WEIGHTS.domainMatch;
      matchedFactors++;
    }

    // 3. 路径模式匹配
    if (this.matchPathPattern(context.currentPath, backlink.url)) {
      score += MATCH_WEIGHTS.pathMatch;
      matchedFactors++;
    }

    // 4. 关键词匹配
    if (backlink.keywords && backlink.keywords.length > 0) {
      const keywordScore = this.calculateKeywordMatchScore(backlink.keywords, context);
      if (keywordScore > 0) {
        score += MATCH_WEIGHTS.keywordMatch * keywordScore;
        matchedFactors++;
      }
    }

    // 5. 表单检测加成
    if (context.formDetected && score > 0) {
      score += MATCH_WEIGHTS.formBonus;
    }

    // 归一化分数（确保不超过 1.0）
    return Math.min(score, 1.0);
  }

  /**
   * 计算关键词匹配分数
   * @param keywords 外链关键词
   * @param context 匹配上下文
   * @returns 关键词匹配分数 (0-1)
   */
  private calculateKeywordMatchScore(keywords: string[], context: MatchContext): number {
    if (keywords.length === 0) return 0;

    const textToMatch = [
      context.pageTitle.toLowerCase(),
      ...context.pageKeywords.map(k => k.toLowerCase()),
      context.currentPath.toLowerCase().replace(/[-_/]/g, ' '),
    ].join(' ');

    let matchedKeywords = 0;
    for (const keyword of keywords) {
      const normalizedKeyword = keyword.toLowerCase().trim();
      if (normalizedKeyword && textToMatch.includes(normalizedKeyword)) {
        matchedKeywords++;
      }
    }

    // 计算匹配率
    return matchedKeywords / keywords.length;
  }

  /**
   * 路径模式匹配
   * @param currentPath 当前路径
   * @param backlinkUrl 外链 URL
   * @returns 是否匹配
   */
  private matchPathPattern(currentPath: string, backlinkUrl: string): boolean {
    try {
      const backlinkPath = new URL(backlinkUrl).pathname;
      const normalizedCurrentPath = currentPath.replace(/\/+$/, '');
      const normalizedBacklinkPath = backlinkPath.replace(/\/+$/, '');

      // 完全匹配
      if (normalizedCurrentPath === normalizedBacklinkPath) {
        return true;
      }

      // 前缀匹配（例如 /blog/ 匹配 /blog/article-1）
      if (normalizedCurrentPath.startsWith(normalizedBacklinkPath + '/') ||
          normalizedBacklinkPath.startsWith(normalizedCurrentPath + '/')) {
        return true;
      }

      // 路径相似度检查（共享父路径）
      const currentSegments = normalizedCurrentPath.split('/').filter(s => s);
      const backlinkSegments = normalizedBacklinkPath.split('/').filter(s => s);

      // 如果前两个路径段相同，认为是相关路径
      if (currentSegments.length >= 2 && backlinkSegments.length >= 2) {
        if (currentSegments[0] === backlinkSegments[0] &&
            currentSegments[1] === backlinkSegments[1]) {
          return true;
        }
      }

      return false;
    } catch {
      return false;
    }
  }

  /**
   * 生成匹配原因
   * @param backlink 外链
   * @param context 匹配上下文
   * @param score 匹配分数
   * @returns 匹配原因列表
   */
  private generateMatchReasons(backlink: ManagedBacklink, context: MatchContext, score: number): string[] {
    const reasons: string[] = [];
    const normalizedBacklinkUrl = this.normalizeUrl(backlink.url);
    const normalizedCurrentUrl = this.normalizeUrl(context.currentUrl);
    const normalizedBacklinkDomain = this.normalizeDomain(backlink.domain);
    const normalizedCurrentDomain = this.normalizeDomain(context.currentDomain);

    if (normalizedBacklinkUrl === normalizedCurrentUrl) {
      reasons.push('URL 完全匹配');
    }

    if (normalizedBacklinkDomain === normalizedCurrentDomain) {
      reasons.push('域名匹配');
    }

    if (this.matchPathPattern(context.currentPath, backlink.url)) {
      reasons.push('路径模式匹配');
    }

    if (backlink.keywords && backlink.keywords.length > 0) {
      const matchedKeywords = backlink.keywords.filter(k => {
        const textToMatch = [context.pageTitle, ...context.pageKeywords, context.currentPath].join(' ').toLowerCase();
        return textToMatch.includes(k.toLowerCase());
      });
      if (matchedKeywords.length > 0) {
        reasons.push(`关键词匹配: ${matchedKeywords.join(', ')}`);
      }
    }

    if (context.formDetected) {
      reasons.push('检测到表单');
    }

    // 添加置信度标签
    if (score >= CONFIDENCE_THRESHOLDS.high) {
      reasons.push('高置信度匹配');
    } else if (score >= CONFIDENCE_THRESHOLDS.medium) {
      reasons.push('中等置信度匹配');
    }

    return reasons;
  }

  /**
   * 规范化 URL（使用统一的工具函数）
   * @param url URL 字符串
   * @returns 规范化后的 URL
   */
  private normalizeUrl(url: string): string {
    return normalizeUrlAdvanced(url, {
      removeHash: true,
      removeQuery: false,
      removeTrailingSlash: true,
      lowercase: true,
    });
  }

  /**
   * 规范化域名
   * @param domain 域名字符串
   * @returns 规范化后的域名
   */
  private normalizeDomain(domain: string): string {
    return domain.trim().toLowerCase().replace(/^www\./, '');
  }

  /**
   * 从 storage 获取外链数据
   * @returns 外链列表
   */
  private async fetchBacklinksFromStorage(): Promise<ManagedBacklink[]> {
    try {
      // 使用 Chrome Storage API 获取外链数据
      const result = await chrome.storage.local.get('managed-backlink-storage-key');
      const state = result['managed-backlink-storage-key'];
      if (state && Array.isArray(state.backlinks)) {
        return state.backlinks;
      }
      return [];
    } catch (error) {
      console.error('[BacklinkMatcher] 获取外链数据失败:', error);
      return [];
    }
  }

  /**
   * 生成缓存键
   * @param context 匹配上下文
   * @returns 缓存键
   */
  private generateCacheKey(context: MatchContext): string {
    return `${context.currentUrl}|${context.pageTitle}|${context.formDetected}`;
  }

  /**
   * 获取缓存结果
   * @param key 缓存键
   * @returns 缓存的匹配结果，如无缓存则返回 null
   */
  private getCachedResult(key: string): MatchResult[] | null {
    const item = this.cache.get(key);
    if (item && Date.now() - item.timestamp < this.cacheTtlMs) {
      return item.results;
    }
    // 清理过期缓存
    if (item) {
      this.cache.delete(key);
    }
    return null;
  }

  /**
   * 设置缓存结果
   * @param key 缓存键
   * @param results 匹配结果
   */
  private setCachedResult(key: string, results: MatchResult[]): void {
    this.cache.set(key, {
      results,
      timestamp: Date.now(),
    });

    // 清理过期缓存项
    this.cleanupExpiredCache();
  }

  /**
   * 清理过期缓存
   * 注意：LRU 缓存会自动管理大小，这里只需要清理过期的项
   */
  private cleanupExpiredCache(): void {
    const now = Date.now();
    // 遍历所有缓存项，删除过期的
    for (const key of this.cache.keys()) {
      const item = this.cache.get(key);
      if (item && now - item.timestamp > this.cacheTtlMs) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * 清除所有缓存
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * 检查是否为高置信度匹配
   * @param score 匹配分数
   * @returns 是否为高置信度
   */
  static isHighConfidence(score: number): boolean {
    return score >= CONFIDENCE_THRESHOLDS.high;
  }

  /**
   * 检查是否为中等置信度匹配
   * @param score 匹配分数
   * @returns 是否为中等置信度
   */
  static isMediumConfidence(score: number): boolean {
    return score >= CONFIDENCE_THRESHOLDS.medium && score < CONFIDENCE_THRESHOLDS.high;
  }
}

/**
 * 默认匹配器实例
 */
export const backlinkMatcher = new BacklinkMatcher();
