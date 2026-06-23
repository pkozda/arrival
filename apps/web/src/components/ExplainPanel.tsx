'use client';

import type { ExplanationFactor, ModuleExplanationView } from '@/lib/product-contract';
import { AtlasSurface } from '@/components/atlas-runtime/legacy';
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
    <ul className="explain-factors-list">
      {factors.map((factor) => (
        <li key={factor.id} className="text-meta">
          <strong style={{ color: 'var(--color-text)' }}>{factor.label}</strong>
          <span className="text-caption" style={{ marginLeft: '0.5rem' }}>
            ({factorTypeLabel(factor.type)})
          </span>
        </li>
      ))}
    </ul>
  );
}

export function ExplainPanel({ explanation }: Props) {
  return (
    <AtlasSurface as="section" aria-label="Result explanation">
      <p className="text-eyebrow mb-sm">Explanation</p>
      <h3 className="text-section-title--sm mb-sm">Why you received these results</h3>

      <div className="mb-md">
        <span className={`badge badge-${explanation.confidence}`} style={{ marginRight: '0.5rem' }}>
          {humanizeConfidence(explanation.confidence)}
        </span>
      </div>

      {explanation.triggeredBecause.length > 0 && (
        <div className="explain-panel__block">
          <h4 className="text-label explain-panel__block-title">What led to this outcome</h4>
          <FactorsList factors={explanation.triggeredBecause} />
        </div>
      )}

      {explanation.recommendations.length > 0 && (
        <div className="explain-panel__block">
          <h4 className="text-label explain-panel__block-title">Recommendation details</h4>
          <div className="stack-sm">
            {explanation.recommendations.map((entry, index) => (
              <div key={`recommendation-${index}`} className="explain-panel__entry">
                <p className="text-label" style={{ fontWeight: 600, marginBottom: '0.375rem' }}>
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
          <h4 className="text-label explain-panel__block-title">Suggested action details</h4>
          <div className="stack-sm">
            {explanation.actions.map((entry, index) => (
              <div key={`action-${index}`} className="explain-panel__entry">
                <p className="text-label" style={{ fontWeight: 600, marginBottom: '0.375rem' }}>
                  {explanationEntryTitle(entry.because, `Suggested step ${index + 1}`)}
                </p>
                <FactorsList factors={entry.because} />
              </div>
            ))}
          </div>
        </div>
      )}
    </AtlasSurface>
  );
}
