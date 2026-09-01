'use client';

import { AtlasSecondaryButton } from '@/components/atlas-runtime';
import { useApp } from '@/components/AppProvider';
import {
  USER_ACTIONABLE_STATES,
  companyFromResult,
  formatMatchPercent,
  type DiscoveryResultUserView,
  type ResultState,
} from '@/lib/discovery';

type Props = {
  result: DiscoveryResultUserView | null;
  stateUpdateError: string | null;
  stateUpdating: boolean;
  onUserState: (userState: ResultState) => void;
};

function verificationLabel(status: string, t: (key: string) => string): string {
  switch (status) {
    case 'PASS':
      return t('discovery.verification.pass');
    case 'FAIL':
      return t('discovery.verification.fail');
    case 'PARTIAL':
      return t('discovery.verification.partial');
    default:
      return t('discovery.verification.unknown');
  }
}

function userStateLabel(state: ResultState, t: (key: string) => string): string {
  const key = `discovery.userState.${state.toLowerCase()}` as const;
  const translated = t(key);
  return translated === key ? state : translated;
}

export function DiscoveryResultDetail({
  result,
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

  const company = companyFromResult(result);
  const changedFields = result.changeMetadata.changedFields;

  return (
    <section
      className="discovery-panel"
      aria-label={result.canonicalPresentation.title}
      data-ui-surface="discovery-result-detail"
    >
      <h2 className="text-heading" style={{ marginTop: 0 }}>
        {result.canonicalPresentation.title}
      </h2>
      {result.canonicalPresentation.summary ? (
        <p className="text-body">{result.canonicalPresentation.summary}</p>
      ) : null}

      <dl className="discovery-detail-grid" style={{ marginTop: '1rem' }}>
        {company ? (
          <div>
            <dt>{t('discovery.result.company')}</dt>
            <dd>{company}</dd>
          </div>
        ) : null}
        <div>
          <dt>{t('discovery.result.matchScore')}</dt>
          <dd>{formatMatchPercent(result.score.matchScore)}</dd>
        </div>
        <div>
          <dt>{t('discovery.result.confidence')}</dt>
          <dd>{formatMatchPercent(result.score.confidenceScore)}</dd>
        </div>
        <div>
          <dt>{t('discovery.result.verification')}</dt>
          <dd>{verificationLabel(result.verification.status, t)}</dd>
        </div>
        <div>
          <dt>{t('discovery.result.userState')}</dt>
          <dd>{result.userState}</dd>
        </div>
        <div>
          <dt>{t('discovery.result.lifecycle')}</dt>
          <dd>{result.lifecycle}</dd>
        </div>
        <div className="discovery-detail-grid__full">
          <dt>{t('discovery.result.scoreBreakdown')}</dt>
          <dd>
            <ul className="discovery-criteria-list">
              {(result.score.breakdown?.dimensions ?? []).map((dimension) => (
                <li key={dimension.id}>
                  {t(dimension.labelKey)}: {dimension.value} (w={dimension.weight})
                </li>
              ))}
            </ul>
          </dd>
        </div>
        <div className="discovery-detail-grid__full">
          <dt>{t('discovery.result.evidence')}</dt>
          <dd>
            {result.evidence.length === 0 ? (
              <span className="discovery-empty">—</span>
            ) : (
              <ul className="discovery-criteria-list">
                {result.evidence.map((item) => (
                  <li key={item.id}>
                    {item.statement ?? item.type}
                    {item.sourceUrl ? ` (${item.sourceUrl})` : ''}
                  </li>
                ))}
              </ul>
            )}
          </dd>
        </div>
        <div>
          <dt>{t('discovery.result.firstSeen')}</dt>
          <dd>{new Date(result.firstSeenAt).toLocaleString()}</dd>
        </div>
        <div>
          <dt>{t('discovery.result.lastChanged')}</dt>
          <dd>{new Date(result.lastChangedAt).toLocaleString()}</dd>
        </div>
        <div>
          <dt>{t('discovery.result.lastVerified')}</dt>
          <dd>{new Date(result.lastVerifiedAt).toLocaleString()}</dd>
        </div>
        <div className="discovery-detail-grid__full">
          <dt>{t('discovery.result.changedFields')}</dt>
          <dd>
            {changedFields.length === 0
              ? t('discovery.result.changedFields.none')
              : changedFields.join(', ')}
          </dd>
        </div>
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
        <p className="discovery-empty" role="alert" style={{ color: '#fca5a5' }}>
          {t('discovery.error.stateUpdate')} {stateUpdateError}
        </p>
      ) : null}
    </section>
  );
}
