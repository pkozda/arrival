'use client';

import type { ModuleUIProjection, SanitizedRecommendation } from '@/lib/product-contract';
import type { ModuleCapabilityVisibility } from '@/lib/module-catalog-utils';
import { humanizeActionKind, humanizePriority } from '@/lib/ux-labels';

type Props = {
  projection: ModuleUIProjection | null;
  visibility?: ModuleCapabilityVisibility;
};

function RecommendationList({
  recommendations,
}: {
  recommendations: readonly SanitizedRecommendation[];
}) {
  return (
    <>
      {recommendations.map((recommendation, index) => (
        <div
          key={`${recommendation.title}-${index}`}
          style={{
            marginBottom: '0.75rem',
            paddingBottom: '0.75rem',
            borderBottom:
              index < recommendations.length - 1 ? '1px solid var(--color-border)' : 'none',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '0.25rem',
            }}
          >
            <span className={`badge badge-${recommendation.priority}`}>
              {humanizePriority(recommendation.priority)}
            </span>
            <strong style={{ fontSize: '0.9375rem' }}>{recommendation.title}</strong>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
            {recommendation.description}
          </p>
        </div>
      ))}
    </>
  );
}

export function ModuleProjectionRenderer({ projection, visibility }: Props) {
  if (!projection) {
    return null;
  }

  if (projection.status === 'error') {
    return (
      <div className="card" style={{ color: 'var(--color-danger)' }}>
        {projection.error?.message ?? 'Something went wrong while running this tool'}
      </div>
    );
  }

  const showRecommendations = visibility?.showRecommendations ?? false;
  const showActions = visibility?.showActions ?? false;
  const showRiskModel = visibility?.showRiskModel ?? false;

  const riskRecommendations = showRiskModel
    ? projection.recommendations.filter((recommendation) => recommendation.priority === 'critical')
    : [];
  const standardRecommendations = showRecommendations
    ? projection.recommendations.filter(
        (recommendation) =>
          !showRiskModel || recommendation.priority !== 'critical'
      )
    : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {projection.summary && (
        <div className="card">
          <h3
            style={{
              fontSize: '0.875rem',
              color: 'var(--color-text-muted)',
              marginBottom: '0.5rem',
            }}
          >
            Summary
          </h3>
          <p>{projection.summary}</p>
        </div>
      )}

      {showRiskModel && riskRecommendations.length > 0 && (
        <div className="card">
          <h3
            style={{
              fontSize: '0.875rem',
              color: 'var(--color-text-muted)',
              marginBottom: '0.75rem',
            }}
          >
            Risk warnings
          </h3>
          <RecommendationList recommendations={riskRecommendations} />
        </div>
      )}

      {standardRecommendations.length > 0 && (
        <div className="card">
          <h3
            style={{
              fontSize: '0.875rem',
              color: 'var(--color-text-muted)',
              marginBottom: '0.75rem',
            }}
          >
            Recommendations
          </h3>
          <RecommendationList recommendations={standardRecommendations} />
        </div>
      )}

      {showActions && projection.actions.length > 0 && (
        <div className="card">
          <h3
            style={{
              fontSize: '0.875rem',
              color: 'var(--color-text-muted)',
              marginBottom: '0.75rem',
            }}
          >
            Actions
          </h3>
          {projection.actions.map((action, index) => (
            <div
              key={`${action.label}-${index}`}
              style={{
                marginBottom: '0.75rem',
                paddingBottom: '0.75rem',
                borderBottom:
                  index < projection.actions.length - 1 ? '1px solid var(--color-border)' : 'none',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  marginBottom: '0.25rem',
                }}
              >
                <span className={`badge badge-${action.priority}`}>
                  {humanizeActionKind(action.kind)}
                </span>
                <strong style={{ fontSize: '0.9375rem' }}>{action.label}</strong>
              </div>
              <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                {action.description}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
