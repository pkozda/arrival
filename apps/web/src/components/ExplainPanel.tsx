'use client';

import type { ExplanationFactor, ModuleExplanationView } from '@/lib/product-contract';
import {
  explanationEntryTitle,
  humanizeConfidence,
} from '@/lib/ux-labels';

type Props = {
  explanation: ModuleExplanationView;
};

function factorTypeLabel(type: ExplanationFactor['type']): string {
  switch (type) {
    case 'input':
      return 'Your input';
    case 'rule':
      return 'Guidance rule';
    case 'context':
      return 'Your situation';
    case 'system':
      return 'Platform check';
    default:
      return 'Detail';
  }
}

function FactorsList({ factors }: { factors: ExplanationFactor[] }) {
  if (factors.length === 0) {
    return null;
  }

  return (
    <ul style={{ paddingLeft: '1.25rem', margin: 0, display: 'grid', gap: '0.375rem' }}>
      {factors.map((factor) => (
        <li key={factor.id} style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
          <strong style={{ color: 'var(--color-text)' }}>{factor.label}</strong>
          <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem' }}>
            ({factorTypeLabel(factor.type)})
          </span>
        </li>
      ))}
    </ul>
  );
}

export function ExplainPanel({ explanation }: Props) {
  return (
    <section className="card" aria-label="Result explanation">
      <h3 style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>
        Why you received these results
      </h3>

      <div style={{ marginBottom: '1rem' }}>
        <span className={`badge badge-${explanation.confidence}`} style={{ marginRight: '0.5rem' }}>
          {humanizeConfidence(explanation.confidence)}
        </span>
      </div>

      {explanation.triggeredBecause.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <h4 style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.5rem' }}>
            What led to this outcome
          </h4>
          <FactorsList factors={explanation.triggeredBecause} />
        </div>
      )}

      {explanation.recommendations.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <h4 style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.5rem' }}>
            Recommendation details
          </h4>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {explanation.recommendations.map((entry, index) => (
              <div
                key={`recommendation-${index}`}
                style={{ paddingBottom: '0.75rem', borderBottom: '1px solid var(--color-border)' }}
              >
                <p style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>
                  {explanationEntryTitle(entry.because, `Suggestion ${index + 1}`)}
                </p>
                <FactorsList factors={entry.because} />
              </div>
            ))}
          </div>
        </div>
      )}

      {explanation.actions.length > 0 && (
        <div>
          <h4 style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.5rem' }}>
            Suggested action details
          </h4>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {explanation.actions.map((entry, index) => (
              <div
                key={`action-${index}`}
                style={{ paddingBottom: '0.75rem', borderBottom: '1px solid var(--color-border)' }}
              >
                <p style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>
                  {explanationEntryTitle(entry.because, `Suggested step ${index + 1}`)}
                </p>
                <FactorsList factors={entry.because} />
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
