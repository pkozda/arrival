'use client';

import { AtlasSecondaryButton } from '@/components/atlas-runtime';
import { useApp } from '@/components/AppProvider';
import {
  USER_ACTIONABLE_STATES,
  buildOpportunityPresentation,
  buildTrustPresentationFromResult,
  formatMatchPercent,
  resolveOpportunityUrl,
  type DiscoveryResultUserView,
  type ResultState,
} from '@/lib/discovery';
import { DiscoveryTrustPanel } from './DiscoveryTrustPanel';

type Props = {
  result: DiscoveryResultUserView | null;
  currentRunId?: string | null;
  stateUpdateError: string | null;
  stateUpdating: boolean;
  onUserState: (userState: ResultState) => void;
};

function userStateLabel(state: ResultState, t: (key: string) => string): string {
  const key = `discovery.userState.${state.toLowerCase()}` as const;
  const translated = t(key);
  return translated === key ? state : translated;
}

export function DiscoveryResultDetail({
  result,
  currentRunId = null,
  stateUpdateError,
  stateUpdating,
  onUserState,
}: Props) {
  const { t } = useApp();

  if (!result) {
    return (
      <section className="discovery-panel" aria-label={t('discovery.results.title')}>
        <p className="discovery-empty">{t('discovery.results.select')}</p>
      </section>
    );
  }

  const opportunity = buildOpportunityPresentation(result, { currentRunId });
  const trust = buildTrustPresentationFromResult(result);
  const changedFields = result.changeMetadata.changedFields;
  const hasUrl = Boolean(resolveOpportunityUrl(result));

  return (
    <section
      className="discovery-panel"
      aria-label={opportunity.title}
      data-ui-surface="discovery-result-detail"
      data-from-current-run={opportunity.fromCurrentRun ? 'true' : 'false'}
      data-trust-status={trust.status}
    >
      <h2 className="text-heading" style={{ marginTop: 0 }}>
        {opportunity.title}
      </h2>
      {opportunity.fromCurrentRun ? (
        <p className="text-body text-body--muted" data-ui-surface="discovery-result-current-run">
          {t('discovery.results.currentRun')}
        </p>
      ) : null}
      {opportunity.summary ? <p className="text-body">{opportunity.summary}</p> : null}

      <div style={{ marginTop: '0.75rem' }}>
        <DiscoveryTrustPanel trust={trust} />
      </div>

      {opportunity.sourceAction ? (
        <p style={{ marginTop: '0.75rem' }}>
          <a
            className="btn btn-primary"
            href={opportunity.sourceAction.href}
            target="_blank"
            rel="noopener noreferrer"
            data-ui-surface="discovery-result-open-source"
            aria-label={`${t('discovery.result.openSource')} (${t('discovery.result.externalLink')})`}
          >
            {t('discovery.result.openSource')}
            <span className="visually-hidden"> {t('discovery.result.externalLink')}</span>
          </a>
        </p>
      ) : (
        <p
          className="text-body text-body--muted"
          data-ui-surface="discovery-result-source-unavailable"
        >
          {trust.status !== 'passed'
            ? t('discovery.result.sourceNotVerified')
            : hasUrl
              ? t('discovery.result.sourceUnavailable')
              : t('discovery.result.sourceMissingUrl')}
        </p>
      )}

      <dl className="discovery-detail-grid" style={{ marginTop: '1rem' }}>
        {opportunity.organization ? (
          <div>
            <dt>{t('discovery.result.company')}</dt>
            <dd>{opportunity.organization}</dd>
          </div>
        ) : null}
        {opportunity.salary ? (
          <div>
            <dt>{t('discovery.result.salary')}</dt>
            <dd>{opportunity.salary}</dd>
          </div>
        ) : null}
        <div>
          <dt>{t('discovery.result.matchScore')}</dt>
          <dd>
            {formatMatchPercent(opportunity.matchScore)}
            <span className="text-body text-body--muted">
              {' '}
              ({t('discovery.trust.relevanceNote')})
            </span>
          </dd>
        </div>
        <div>
          <dt>{t('discovery.result.confidence')}</dt>
          <dd>{formatMatchPercent(opportunity.confidenceScore)}</dd>
        </div>
        <div>
          <dt>{t('discovery.result.userState')}</dt>
          <dd>{userStateLabel(result.userState, t)}</dd>
        </div>
        <div>
          <dt>{t('discovery.result.firstSeen')}</dt>
          <dd>{new Date(opportunity.discoveredAt).toLocaleString()}</dd>
        </div>
        <div>
          <dt>{t('discovery.result.lastChanged')}</dt>
          <dd>{new Date(opportunity.lastChangedAt).toLocaleString()}</dd>
        </div>
        {(result.score.breakdown?.dimensions?.length ?? 0) > 0 ? (
          <div className="discovery-detail-grid__full">
            <dt>{t('discovery.result.scoreBreakdown')}</dt>
            <dd>
              <ul className="discovery-criteria-list">
                {(result.score.breakdown?.dimensions ?? []).map((dimension) => (
                  <li key={dimension.id}>
                    {t(dimension.labelKey)}: {formatMatchPercent(dimension.value)}
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        ) : null}
        {changedFields.length > 0 ? (
          <div className="discovery-detail-grid__full">
            <dt>{t('discovery.result.changedFields')}</dt>
            <dd>{changedFields.join(', ')}</dd>
          </div>
        ) : null}
      </dl>

      <div className="discovery-actions" style={{ marginTop: '1rem' }}>
        {USER_ACTIONABLE_STATES.map((state) => (
          <AtlasSecondaryButton
            key={state}
            type="button"
            disabled={stateUpdating || result.userState === state}
            aria-label={userStateLabel(state, t)}
            onClick={() => onUserState(state)}
          >
            {userStateLabel(state, t)}
          </AtlasSecondaryButton>
        ))}
      </div>

      {stateUpdateError ? (
        <p className="discovery-empty" role="alert">
          {t('discovery.error.stateUpdate')} {stateUpdateError}
        </p>
      ) : null}
    </section>
  );
}
