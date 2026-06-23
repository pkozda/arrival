'use client';

import type { ModuleUIProjection, PublicModuleContract } from '@/lib/product-contract';
import { capabilityVisibilityFromContract } from '@/lib/module-catalog-utils';
import { AtlasSurface } from '@/components/atlas-runtime/legacy';
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
    <div className="stack-md">
      <ModuleProjectionRenderer projection={projection} visibility={visibility} />

      {visibility.showExplanation && executionId && projection?.status === 'success' && (
        <>
          {loading && <p className="text-meta">Loading explanation...</p>}
          {error && <AtlasSurface className="text-danger">{error}</AtlasSurface>}
          {explanation && <ExplainPanel explanation={explanation} />}
        </>
      )}
    </div>
  );
}
