'use client';

import { useApp } from '@/components/AppProvider';
import {
  outcomeLabelKey,
  type TrustPresentation,
} from '@/lib/discovery/trust-presentation';

type Props = {
  trust: TrustPresentation;
};

export function DiscoveryTrustPanel({ trust }: Props) {
  const { t } = useApp();
  const summary = t(trust.summaryKey);
  const statusText =
    trust.status === 'passed'
      ? t('discovery.trust.status.passed')
      : trust.status === 'failed'
        ? t('discovery.trust.status.failed')
        : t('discovery.trust.status.unknown');

  return (
    <div
      className="discovery-trust"
      data-ui-surface="discovery-trust-panel"
      data-trust-status={trust.status}
      data-strategy-kind={trust.strategyKind}
    >
      <p
        className="discovery-trust__summary"
        role="status"
        aria-label={`${statusText}: ${summary}`}
        data-ui-surface="discovery-trust-summary"
      >
        <span className="discovery-trust__status">{statusText}</span>
        <span aria-hidden="true"> — </span>
        <span>{summary}</span>
      </p>

      <dl className="discovery-detail-grid" style={{ marginTop: '0.75rem' }}>
        {trust.sourceTrustLabelKey ? (
          <div>
            <dt>{t('discovery.trust.sourceTrust.label')}</dt>
            <dd data-ui-surface="discovery-trust-source-trust">
              {t(trust.sourceTrustLabelKey)}
            </dd>
          </div>
        ) : null}
        {trust.freshnessLabelKey ? (
          <div>
            <dt>{t('discovery.trust.freshness.label')}</dt>
            <dd data-ui-surface="discovery-trust-freshness">{t(trust.freshnessLabelKey)}</dd>
          </div>
        ) : null}
        {trust.verifiedAt ? (
          <div>
            <dt>{t('discovery.trust.verifiedAt')}</dt>
            <dd data-ui-surface="discovery-trust-verified-at">
              {new Date(trust.verifiedAt).toLocaleString()}
            </dd>
          </div>
        ) : null}
      </dl>

      <details className="discovery-trust__details" data-ui-surface="discovery-trust-details">
        <summary>{t('discovery.trust.whyChecked')}</summary>
        <div className="discovery-trust__details-body">
          {trust.checks.length === 0 ? (
            <p className="text-body text-body--muted">{t('discovery.trust.noChecks')}</p>
          ) : (
            <ul className="discovery-criteria-list" data-ui-surface="discovery-trust-checks">
              {trust.checks.map((check) => (
                <li key={check.id} data-check-id={check.id} data-outcome={check.outcome}>
                  {check.labelKey === 'discovery.trust.check.generic'
                    ? check.id
                    : t(check.labelKey)}
                  {': '}
                  {t(outcomeLabelKey(check.outcome))}
                  {check.required ? ` (${t('discovery.trust.required')})` : null}
                  {check.detail ? ` — ${check.detail}` : null}
                </li>
              ))}
            </ul>
          )}

          {trust.evidenceStatements.length > 0 ? (
            <div style={{ marginTop: '0.75rem' }}>
              <h3 className="text-label">{t('discovery.result.evidence')}</h3>
              <ul className="discovery-criteria-list" data-ui-surface="discovery-trust-evidence">
                {trust.evidenceStatements.map((item) => (
                  <li key={item.id}>
                    {item.statement}
                    {item.sourceUrl ? ` (${item.sourceUrl})` : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <p className="text-body text-body--muted" style={{ marginTop: '0.75rem' }}>
            {t('discovery.trust.boundary')}
          </p>
        </div>
      </details>
    </div>
  );
}
