'use client';

import { useState } from 'react';
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
      <button
        type="button"
        className="btn btn-secondary"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
      >
        {open ? 'Hide explanation' : 'Why these results?'}
      </button>

      {open && (
        <div style={{ marginTop: '0.75rem' }}>
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
        </div>
      )}
    </div>
  );
}
