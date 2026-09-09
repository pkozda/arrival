'use client';

import { useApp } from '@/components/AppProvider';
import {
  buildOpportunityPresentation,
  buildTrustPresentationFromResult,
  formatMatchPercent,
  isActiveRunPresentation,
  isErrorPresentation,
  isNoResultsPresentation,
  orderOpportunitiesForDisplay,
  type DiscoveryExecutionLifecycle,
  type DiscoveryResultUserView,
} from '@/lib/discovery';

type Props = {
  results: DiscoveryResultUserView[];
  selectedResultId: string | null;
  executionLifecycle: DiscoveryExecutionLifecycle;
  currentRunId?: string | null;
  onSelect: (resultId: string) => void;
};

function noveltyKey(novelty: DiscoveryResultUserView['changeMetadata']['inferredNovelty']): string {
  switch (novelty) {
    case 'NEW':
      return 'discovery.novelty.new';
    case 'UPDATED':
      return 'discovery.novelty.updated';
    default:
      return 'discovery.novelty.unchanged';
  }
}

function noveltyClass(novelty: DiscoveryResultUserView['changeMetadata']['inferredNovelty']): string {
  switch (novelty) {
    case 'NEW':
      return 'discovery-badge--new';
    case 'UPDATED':
      return 'discovery-badge--updated';
    default:
      return 'discovery-badge--unchanged';
  }
}

export function DiscoveryResultsList({
  results,
  selectedResultId,
  executionLifecycle,
  currentRunId = null,
  onSelect,
}: Props) {
  const { t } = useApp();
  const opportunities = orderOpportunitiesForDisplay(
    results.map((result) => ({
      result,
      trust: buildTrustPresentationFromResult(result),
      ...buildOpportunityPresentation(result, { currentRunId }),
    }))
  );
  const currentCount = opportunities.filter((item) => item.fromCurrentRun).length;
  const active = isActiveRunPresentation(executionLifecycle);
  const noResults = isNoResultsPresentation(executionLifecycle);
  const errored = isErrorPresentation(executionLifecycle);
  const success = executionLifecycle === 'SUCCESS';

  return (
    <section
      className="discovery-panel"
      aria-label={t('discovery.results.title')}
      data-ui-surface="discovery-results-panel"
      data-lifecycle={executionLifecycle}
    >
      <div className="discovery-results__row">
        <h2 className="discovery-panel__title" style={{ margin: 0 }}>
          {t('discovery.results.title')}
        </h2>
        {success && currentCount > 0 ? (
          <span className="text-body text-body--muted" data-ui-surface="discovery-results-count">
            {t('discovery.results.count').replace('{count}', String(currentCount))}
          </span>
        ) : null}
      </div>

      {active ? (
        <p
          className="discovery-empty"
          role="status"
          data-ui-surface="discovery-results-in-progress"
        >
          {t('discovery.results.inProgress')}
        </p>
      ) : null}

      {noResults ? (
        <div data-ui-surface="discovery-results-no-results">
          <p className="discovery-empty" role="status">
            {t('discovery.execution.noResults')}
          </p>
          <p className="text-body text-body--muted">{t('discovery.execution.noResultsDetail')}</p>
        </div>
      ) : null}

      {errored ? (
        <p
          className="discovery-empty"
          role="alert"
          data-ui-surface="discovery-results-error"
        >
          {t('discovery.results.errorHint')}
        </p>
      ) : null}

      {!active && !noResults && !errored && opportunities.length === 0 ? (
        <p className="discovery-empty" data-ui-surface="discovery-empty-results">
          {t('discovery.empty.results')}
        </p>
      ) : null}

      {opportunities.length > 0 ? (
        <div className="discovery-results" style={{ marginTop: '0.75rem' }}>
          {noResults ? (
            <p
              className="text-body text-body--muted"
              data-ui-surface="discovery-results-previous-heading"
            >
              {t('discovery.results.previousHeading')}
            </p>
          ) : null}
          {opportunities.map(({ result, trust, ...opportunity }) => {
            const novelty = result.changeMetadata.inferredNovelty;
            const trustLine = t(trust.summaryKey);
            const accessibleName = [
              opportunity.title,
              opportunity.organization,
              trustLine,
              opportunity.fromCurrentRun ? t('discovery.results.currentRun') : null,
            ]
              .filter(Boolean)
              .join(', ');
            return (
              <button
                key={result.id}
                type="button"
                className="discovery-results__item"
                aria-label={accessibleName}
                aria-current={result.id === selectedResultId ? 'true' : undefined}
                data-novelty={novelty}
                data-from-current-run={opportunity.fromCurrentRun ? 'true' : 'false'}
                data-trust-status={trust.status}
                data-ui-surface="discovery-result-item"
                onClick={() => onSelect(result.id)}
              >
                <div className="discovery-results__row">
                  <strong>{opportunity.title}</strong>
                  <span className={`discovery-badge ${noveltyClass(novelty)}`}>
                    {t(noveltyKey(novelty))}
                  </span>
                </div>
                <div className="discovery-profile-list__meta">
                  <span>
                    {opportunity.organization ? `${opportunity.organization} · ` : ''}
                    {t('discovery.result.matchScore')}:{' '}
                    {formatMatchPercent(opportunity.matchScore)}
                  </span>
                  <span>
                    {opportunity.fromCurrentRun
                      ? t('discovery.results.currentRun')
                      : new Date(opportunity.discoveredAt).toLocaleString()}
                  </span>
                </div>
                <p
                  className="discovery-trust__list-line"
                  data-ui-surface="discovery-result-trust-line"
                >
                  {trustLine}
                </p>
              </button>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
