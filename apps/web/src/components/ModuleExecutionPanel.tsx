'use client';

import type { ModuleUIProjection, PublicModuleContract } from '@/lib/product-contract';
import { capabilityVisibilityFromContract } from '@/lib/module-catalog-utils';
import { ExplainPanel } from '@/components/ExplainPanel';
import { ModuleProjectionRenderer } from '@/components/ModuleProjectionRenderer';
import { useModuleExplanation } from '@/lib/useModuleExplanation';

type Props = {
  moduleId: string;
  contract: PublicModuleContract;
  sessionId: string | null;
  executionId: string | null;
  projection: ModuleUIProjection | null;
};

export function ModuleExecutionPanel({
  moduleId,
  contract,
  sessionId,
  executionId,
  projection,
}: Props) {
  const visibility = capabilityVisibilityFromContract(contract);
  const explainEnabled =
    visibility.showExplanation &&
    projection?.status === 'success' &&
    Boolean(executionId);

  const { explanation, loading, error } = useModuleExplanation(
    moduleId,
    executionId,
    sessionId,
    explainEnabled
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <ModuleProjectionRenderer projection={projection} visibility={visibility} />

      {visibility.showExplanation && executionId && projection?.status === 'success' && (
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
