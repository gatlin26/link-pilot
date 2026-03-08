import { useState, useEffect } from 'react';
import { backlinkStorage } from '@extension/storage';
import type { CollectedBacklink } from '@extension/shared';

export const useBacklinks = () => {
  const [backlinks, setBacklinks] = useState<CollectedBacklink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadBacklinks = async () => {
      try {
        setLoading(true);
        const data = await backlinkStorage.getAll();
        setBacklinks(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载失败');
      } finally {
        setLoading(false);
      }
    };

    loadBacklinks();

    // 监听存储变化
    const unsubscribe = backlinkStorage.subscribe(() => {
      loadBacklinks();
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const refresh = async () => {
    try {
      setLoading(true);
      const data = await backlinkStorage.getAll();
      setBacklinks(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '刷新失败');
    } finally {
      setLoading(false);
    }
  };

  return { backlinks, loading, error, refresh };
};
