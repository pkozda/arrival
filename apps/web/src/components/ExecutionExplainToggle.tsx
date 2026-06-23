'use client';

import { useState } from 'react';
import { AtlasSecondaryButton } from '@/components/atlas-runtime';
import { AtlasSurface } from '@/components/atlas-runtime/legacy';
import { ExplainPanel } from '@/components/ExplainPanel';
import { useModuleExplanation } from '@/lib/useModuleExplanation';

type Props = {
  moduleId: string;
  executionId: string;
  sessionId: string;
};

export function ExecutionExplainToggle({ moduleId, executionId, sessionId }: Props) {
  const [open, setOpen] = useState(false);
  const { explanation, loading, error } = useModuleExplanation(
    moduleId,
    executionId,
    sessionId,
    open
  );

  return (
    <div style={{ marginTop: '0.75rem' }}>
      <AtlasSecondaryButton onClick={() => setOpen((current) => !current)} aria-expanded={open}>
        {open ? 'Hide explanation' : 'Why these results?'}
      </AtlasSecondaryButton>

      {open && (
        <div style={{ marginTop: '0.75rem' }}>
          {loading && <p className="text-meta">Loading explanation...</p>}
          {error && <AtlasSurface className="text-danger">{error}</AtlasSurface>}
          {explanation && <ExplainPanel explanation={explanation} />}
        </div>
      )}
    </div>
  );
}
