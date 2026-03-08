import { useState, useMemo } from 'react';
import type { CollectedBacklink, Opportunity } from '@extension/shared';

export interface BacklinkFilters {
  linkType?: string;
  businessTypes?: string[];
  status?: string;
  batchId?: string;
  minScore?: number;
  searchUrl?: string;
}

export interface OpportunityFilters {
  status?: string;
  linkType?: string;
  domain?: string;
}

export const useBacklinkFilters = (backlinks: CollectedBacklink[]) => {
  const [filters, setFilters] = useState<BacklinkFilters>({});

  const filteredBacklinks = useMemo(() => {
    return backlinks.filter(backlink => {
      if (filters.linkType && backlink.link_type !== filters.linkType) {
        return false;
      }

      if (filters.businessTypes && filters.businessTypes.length > 0) {
        if (!backlink.site_business_types || backlink.site_business_types.length === 0) {
          return false;
        }
        const hasMatch = filters.businessTypes.some(type =>
          backlink.site_business_types?.includes(type as any)
        );
        if (!hasMatch) return false;
      }

      if (filters.status && backlink.status !== filters.status) {
        return false;
      }

      if (filters.batchId && backlink.collection_batch_id !== filters.batchId) {
        return false;
      }

      if (filters.minScore !== undefined && (backlink.context_match_score || 0) < filters.minScore) {
        return false;
      }

      if (filters.searchUrl) {
        const searchLower = filters.searchUrl.toLowerCase();
        if (!backlink.target_url.toLowerCase().includes(searchLower) &&
            !backlink.referring_page_url.toLowerCase().includes(searchLower)) {
          return false;
        }
      }

      return true;
    });
  }, [backlinks, filters]);

  return { filters, setFilters, filteredBacklinks };
};

export const useOpportunityFilters = (opportunities: Opportunity[]) => {
  const [filters, setFilters] = useState<OpportunityFilters>({});

  const filteredOpportunities = useMemo(() => {
    return opportunities.filter(opportunity => {
      if (filters.status && opportunity.status !== filters.status) {
        return false;
      }

      if (filters.linkType && opportunity.link_type !== filters.linkType) {
        return false;
      }

      if (filters.domain && opportunity.domain !== filters.domain) {
        return false;
      }

      return true;
    });
  }, [opportunities, filters]);

  return { filters, setFilters, filteredOpportunities };
};
