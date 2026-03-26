/**
 * AI 元数据采集服务
 * MVP 阶段：通过 chrome.runtime 消息与 content script 交互采集页面信息
 * 后续可扩展为直接 LLM API 调用
 */

import { classifySiteType } from './site-type-classifier.js';
import type { SiteAnalysisInput } from './site-type-classifier.js';
import type { ExternalLinkMetadata, OwnedSiteMetadata, DynamicFieldDefinition } from '../types/index.js';

const collectSiteInfo = (function () {
  // eslint-disable-next-line func-style
  async function impl(url: string): Promise<SiteInfo | null> {
    return new Promise(resolve => {
      if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
        resolve(null);
        return;
      }

      chrome.runtime.sendMessage({ type: 'COLLECT_SITE_INFO', payload: { url } }, response => {
        if (response?.success && response.data) {
          resolve(response.data);
        } else {
          resolve(null);
        }
      });
    });
  }

  return impl;
})();

const analyzeFormFields = (function () {
  // eslint-disable-next-line func-style
  function impl(formFields: string[]): DynamicFieldDefinition[] {
    const fieldMap: Array<{
      key: string;
      label: string;
      type: DynamicFieldDefinition['type'];
      keywords: string[];
    }> = [
      {
        key: 'name',
        label: '姓名',
        type: 'text',
        keywords: ['name', 'author', '用户名', 'your name'],
      },
      {
        key: 'email',
        label: '邮箱',
        type: 'email',
        keywords: ['email', 'mail', '邮箱', 'e-mail'],
      },
      {
        key: 'website',
        label: '网站',
        type: 'url',
        keywords: ['website', 'url', 'site', '博客', 'blog url'],
      },
      {
        key: 'comment',
        label: '评论',
        type: 'textarea',
        keywords: ['comment', 'message', 'reply', '评论', '留言'],
      },
      {
        key: 'title',
        label: '标题',
        type: 'text',
        keywords: ['title', 'subject', '标题', '主题'],
      },
    ];

    return formFields.map(fieldName => {
      const normalized = fieldName.toLowerCase();
      const match = fieldMap.find(f => f.keywords.some(kw => normalized.includes(kw)));
      return {
        key: fieldName,
        label: fieldName,
        type: match?.type || 'text',
        source: 'ai' as const,
        required: false,
        visible: true,
        group: 'submission' as const,
        order: 0,
      };
    });
  }

  return impl;
})();

const generateExternalLinkMetadata = (function () {
  // eslint-disable-next-line func-style
  async function impl(url: string, pageContent?: string): Promise<ExternalLinkMetadata | null> {
    const siteInfo = await collectSiteInfo(url);
    if (!siteInfo) {
      return {
        linkId: '',
        siteName: '',
        pageTitle: '',
        summary: '',
        description: '',
        formFields: [],
        dataFields: [],
        recommendedTemplates: [],
        generatedAt: new Date().toISOString(),
      };
    }

    const urlObj = new URL(url);
    const analysisInput: SiteAnalysisInput = {
      url,
      pageTitle: siteInfo.title,
      metaDescription: siteInfo.description,
      pageText: pageContent || siteInfo.description,
      hasForm: true,
      formFields: [],
      ctaText: [],
      urlPath: urlObj.pathname,
    };

    const { type, confidence, reason } = classifySiteType(analysisInput);

    return {
      linkId: '',
      siteName: siteInfo.title,
      pageTitle: siteInfo.title,
      summary: siteInfo.description,
      description: siteInfo.description,
      language: siteInfo.language,
      detectedSiteType: type,
      typeConfidence: confidence,
      analysisSummary: reason,
      formFields: [],
      dataFields: [],
      recommendedTemplates: [],
      generatedAt: new Date().toISOString(),
    };
  }

  return impl;
})();

const generateOwnedSiteMetadata = (function () {
  // eslint-disable-next-line func-style
  async function impl(url: string): Promise<OwnedSiteMetadata | null> {
    const siteInfo = await collectSiteInfo(url);
    if (!siteInfo) {
      return null;
    }

    return {
      siteId: '',
      siteName: siteInfo.title,
      siteTitle: siteInfo.title,
      shortDescription: siteInfo.description.slice(0, 100),
      fullDescription: siteInfo.description,
      faviconUrl: siteInfo.favicon,
      screenshotUrl: siteInfo.screenshot,
      language: siteInfo.language,
      extractedFields: [],
      analysisSummary: `已从 ${url} 采集网站信息`,
      generatedAt: new Date().toISOString(),
    };
  }

  return impl;
})();

export interface SiteInfo {
  url: string;
  title: string;
  description: string;
  favicon: string;
  screenshot?: string;
  language?: string;
}

export { collectSiteInfo, analyzeFormFields, generateExternalLinkMetadata, generateOwnedSiteMetadata };
