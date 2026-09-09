'use client';

import type { ModuleUIProjection, SanitizedRecommendation } from '@/lib/product-contract';
import type { ModuleCapabilityVisibility } from '@/lib/module-catalog-utils';
import { AtlasSurface } from '@/components/atlas-runtime/legacy';
import { AtlasSecondaryLink } from '@/components/atlas-runtime';
import { useApp } from '@/components/AppProvider';
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

function insuranceAssumptionKey(
  assumption: NonNullable<ModuleUIProjection['insuranceAssumption']>
): string {
  switch (assumption) {
    case 'insured':
      return 'healthcare.insurance.insured';
    case 'uninsured':
      return 'healthcare.insurance.uninsured';
    case 'unknown':
      return 'healthcare.insurance.unknown';
  }
}

export function ModuleProjectionRenderer({ projection, visibility }: Props) {
  const { t } = useApp();

  if (!projection) {
    return null;
  }

  if (projection.status === 'error' || projection.outcome === 'TECHNICAL_ERROR') {
    return (
      <AtlasSurface className="text-danger" data-module-outcome="TECHNICAL_ERROR">
        <PanelSectionTitle>{t('healthcare.outcome.technicalError')}</PanelSectionTitle>
        <p className="text-body">
          {projection.error?.message ?? t('common.error')}
        </p>
      </AtlasSurface>
    );
  }

  if (projection.outcome === 'MORE_INFO_REQUIRED') {
    const missing = projection.missingContext ?? [];
    return (
      <AtlasSurface data-module-outcome="MORE_INFO_REQUIRED">
        <PanelSectionTitle>{t('healthcare.outcome.moreInfo')}</PanelSectionTitle>
        {projection.insuranceAssumption && (
          <p className="text-meta" data-insurance-assumption={projection.insuranceAssumption}>
            {t(insuranceAssumptionKey(projection.insuranceAssumption))}
          </p>
        )}
        <div className="stack-sm" style={{ marginTop: '0.75rem' }}>
          <p className="text-eyebrow">{t('healthcare.missing.why')}</p>
          {missing.length === 0 ? (
            <p className="text-body">{t('healthcare.missing.insurance')}</p>
          ) : (
            missing.map((item) => (
              <div key={item.field} style={{ marginBottom: '0.75rem' }}>
                <p className="text-body">{t(item.reasonKey)}</p>
                {item.profileHref && (
                  <div style={{ marginTop: '0.5rem' }}>
                    <p className="text-eyebrow">{t('healthcare.missing.how')}</p>
                    <AtlasSecondaryLink href={item.profileHref}>
                      {t('healthcare.missing.provideInsurance')}
                    </AtlasSecondaryLink>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </AtlasSurface>
    );
  }

  if (projection.outcome === 'NO_APPLICABLE_RESULT') {
    return (
      <AtlasSurface data-module-outcome="NO_APPLICABLE_RESULT">
        <PanelSectionTitle>{t('healthcare.outcome.noApplicable')}</PanelSectionTitle>
        {projection.insuranceAssumption && (
          <p className="text-meta" data-insurance-assumption={projection.insuranceAssumption}>
            {t(insuranceAssumptionKey(projection.insuranceAssumption))}
          </p>
        )}
        <p className="text-body" style={{ marginTop: '0.75rem' }}>
          {t('healthcare.noApplicable.body')}
        </p>
        {projection.summary && <p className="text-meta mt-sm">{projection.summary}</p>}
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
        (recommendation) => !showRiskModel || recommendation.priority !== 'critical'
      )
    : [];

  const hasVisibleContent =
    Boolean(projection.summary) ||
    riskRecommendations.length > 0 ||
    standardRecommendations.length > 0 ||
    (showActions && projection.actions.length > 0) ||
    projection.outcome === 'RECOMMENDATIONS';

  if (!hasVisibleContent) {
    return null;
  }

  return (
    <div className="stack-md" data-module-outcome={projection.outcome ?? 'RECOMMENDATIONS'}>
      {projection.summary && (
        <AtlasSurface>
          <PanelSectionTitle>
            {projection.outcome === 'RECOMMENDATIONS'
              ? t('healthcare.outcome.recommendations')
              : 'Summary'}
          </PanelSectionTitle>
          {projection.insuranceAssumption && (
            <p className="text-meta" data-insurance-assumption={projection.insuranceAssumption}>
              {t(insuranceAssumptionKey(projection.insuranceAssumption))}
            </p>
          )}
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
