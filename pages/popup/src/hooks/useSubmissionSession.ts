import { useEffect, useState } from 'react';
import { submissionSessionStorage } from '@extension/storage';
import type { SubmissionSession } from '@extension/shared';

export function useSubmissionSession() {
  const [session, setSession] = useState<SubmissionSession>({
    queue_backlink_ids: [],
    queue_cursor: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setSession(await submissionSessionStorage.getSession());
      setLoading(false);
    };

    void load();
    const unsubscribe = submissionSessionStorage.subscribe(() => {
      void load();
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return {
    session,
    loading,
    updateSession: submissionSessionStorage.updateSession,
  };
}
