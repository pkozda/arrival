'use client';

import { useEffect, useState } from 'react';
import type { ModuleExplanationView } from '@/lib/product-contract';
import { fetchModuleExplanation } from '@/lib/api';

export function useModuleExplanation(
  moduleId: string | null,
  executionId: string | null,
  sessionId: string | null,
  enabled = true
) {
  const [explanation, setExplanation] = useState<ModuleExplanationView | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !moduleId || !executionId || !sessionId) {
      setExplanation(null);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchModuleExplanation(moduleId, executionId, sessionId)
      .then((view) => {
        if (!cancelled) {
          setExplanation(view);
        }
      })
      .catch((fetchError) => {
        if (!cancelled) {
          setExplanation(null);
          setError(
            fetchError instanceof Error
              ? fetchError.message
              : 'Unable to load explanation'
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, moduleId, executionId, sessionId]);

  return { explanation, loading, error };
}

export function useExplainExecutionId(snapshotExecutionId: string | null) {
  const [pendingExecutionId, setPendingExecutionId] = useState<string | null>(null);
  const executionId = pendingExecutionId ?? snapshotExecutionId;

  const registerExecution = (nextExecutionId: string | undefined) => {
    if (nextExecutionId) {
      setPendingExecutionId(nextExecutionId);
    }
  };

  return { executionId, registerExecution };
}
