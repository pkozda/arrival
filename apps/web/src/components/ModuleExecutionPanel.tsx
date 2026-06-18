'use client';

import type { ModuleUIProjection } from '@/lib/product-contract';
import { ExplainPanel } from '@/components/ExplainPanel';
import { ModuleProjectionRenderer } from '@/components/ModuleProjectionRenderer';
import { useModuleExplanation } from '@/lib/useModuleExplanation';

type Props = {
  moduleId: string;
  sessionId: string | null;
  executionId: string | null;
  projection: ModuleUIProjection | null;
};

export function ModuleExecutionPanel({
  moduleId,
  sessionId,
  executionId,
  projection,
}: Props) {
  const { explanation, loading, error } = useModuleExplanation(
    moduleId,
    executionId,
    sessionId,
    projection?.status === 'success'
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <ModuleProjectionRenderer projection={projection} />

      {executionId && projection?.status === 'success' && (
        <>
          {loading && (
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
              Loading explanation...
            </p>
          )}
          {error && (
            <div className="card" style={{ color: 'var(--color-danger)' }}>
              {error}
            </div>
          )}
          {explanation && <ExplainPanel explanation={explanation} />}
        </>
      )}
    </div>
  );
}
