'use client';

import { useEffect } from 'react';
import { emitCertaintyTelemetry } from '@/lib/certainty/certainty-events';
import type { CertaintyState } from '@/lib/certainty/types';
import { BecauseExplanation } from './BecauseExplanation';
import { CertaintyHeader } from './CertaintyHeader';
import { NextStepCard } from './NextStepCard';
import { ProgressDelta } from './ProgressDelta';

type Props = {
  state: CertaintyState;
  surfaceId?: string;
};

export function CertaintyPanel({ state, surfaceId }: Props) {
  useEffect(() => {
    emitCertaintyTelemetry({
      name: 'certainty_panel_viewed',
      surface: surfaceId,
      location: state.location,
      confidence: state.confidence,
    });

    if (state.nextAction) {
      emitCertaintyTelemetry({
        name: 'certainty_next_step_seen',
        surface: surfaceId,
        location: state.location,
        confidence: state.confidence,
      });
    }
  }, [state.confidence, state.location, state.nextAction, surfaceId]);

  return (
    <section className="certainty-panel" data-ui-surface="certainty-panel">
      <CertaintyHeader
        location={state.location}
        title={state.title}
        confidence={state.confidence}
      />
      {state.nextAction && (
        <>
          <NextStepCard
            label={state.nextAction.label}
            expectedOutcome={state.nextAction.expectedOutcome}
          />
          <BecauseExplanation reason={state.nextAction.reason} />
        </>
      )}
      {state.progress && <ProgressDelta progress={state.progress} />}
    </section>
  );
}
