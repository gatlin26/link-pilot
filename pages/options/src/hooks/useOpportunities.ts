import { useState, useEffect } from 'react';
import { opportunityStorage } from '@extension/storage';
import type { Opportunity } from '@extension/shared';

export const useOpportunities = () => {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadOpportunities = async () => {
      try {
        setLoading(true);
        const data = await opportunityStorage.getAll();
        setOpportunities(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载失败');
      } finally {
        setLoading(false);
      }
    };

    loadOpportunities();

    // 监听存储变化
    const unsubscribe = opportunityStorage.subscribe(() => {
      loadOpportunities();
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const refresh = async () => {
    try {
      setLoading(true);
      const data = await opportunityStorage.getAll();
      setOpportunities(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '刷新失败');
    } finally {
      setLoading(false);
    }
  };

  return { opportunities, loading, error, refresh };
};
