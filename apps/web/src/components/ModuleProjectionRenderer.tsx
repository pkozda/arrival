'use client';

import type { ModuleUIProjection, SanitizedRecommendation } from '@/lib/product-contract';
import type { ModuleCapabilityVisibility } from '@/lib/module-catalog-utils';
import { AtlasSurface } from '@/components/atlas-runtime/legacy';
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
            <strong className="text-body">{recommendation.title}</strong>
          </div>
          <p className="text-meta">{recommendation.description}</p>
        </div>
      ))}
    </>
  );
}

function PanelSectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-eyebrow mb-sm" style={{ marginBottom: '0.75rem' }}>
      {children}
    </h3>
  );
}

export function ModuleProjectionRenderer({ projection, visibility }: Props) {
  if (!projection) {
    return null;
  }

  if (projection.status === 'error') {
    return (
      <AtlasSurface className="text-danger">
        {projection.error?.message ?? 'Something went wrong while running this tool'}
      </AtlasSurface>
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
    <div className="stack-md">
      {projection.summary && (
        <AtlasSurface>
          <PanelSectionTitle>Summary</PanelSectionTitle>
          <p className="text-body">{projection.summary}</p>
        </AtlasSurface>
      )}

      {showRiskModel && riskRecommendations.length > 0 && (
        <AtlasSurface>
          <PanelSectionTitle>Risk warnings</PanelSectionTitle>
          <RecommendationList recommendations={riskRecommendations} />
        </AtlasSurface>
      )}

      {standardRecommendations.length > 0 && (
        <AtlasSurface>
          <PanelSectionTitle>Recommendations</PanelSectionTitle>
          <RecommendationList recommendations={standardRecommendations} />
        </AtlasSurface>
      )}

      {showActions && projection.actions.length > 0 && (
        <AtlasSurface>
          <PanelSectionTitle>Actions</PanelSectionTitle>
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
                <strong className="text-body">{action.label}</strong>
              </div>
              <p className="text-meta">{action.description}</p>
            </div>
          ))}
        </AtlasSurface>
      )}
    </div>
  );
}
