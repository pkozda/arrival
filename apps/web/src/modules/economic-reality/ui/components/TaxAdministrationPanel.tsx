'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AtlasLink as Link } from '@/components/atlas-runtime';
import { useApp } from '@/components/AppProvider';
import { AtlasSurface } from '@/components/atlas-runtime/legacy';
import { buildTaxAdministrationViewModel } from '@/lib/finance/build-tax-administration-view-model';
import { selectUserContextProfile } from '@/lib/user-context';

/**
 * E10 — Tax Administration panel (Finance Option C).
 * Hosted on Economic Reality; does not own Action Planner or banking.
 */
export function TaxAdministrationPanel() {
  const { t, userContext } = useApp();
  const [showRecalculated, setShowRecalculated] = useState(false);
  const previousFingerprintRef = useRef<string | null>(null);

  const profile = selectUserContextProfile(userContext);
  const tax = useMemo(() => buildTaxAdministrationViewModel(profile), [profile]);

  useEffect(() => {
    const fingerprint = tax.knownFacts.map((f) => `${f.factId}:${f.presence}:${f.valueText ?? ''}`).join('|');
    if (previousFingerprintRef.current && previousFingerprintRef.current !== fingerprint) {
      setShowRecalculated(true);
    }
    previousFingerprintRef.current = fingerprint;
  }, [tax]);

  return (
    <AtlasSurface
      as="section"
      className="mb-md er-tax-administration"
      data-ui-panel="TaxAdministrationPanel"
      data-finance-slice="tax-administration"
      data-tax-state={tax.state}
      aria-labelledby="tax-administration-heading"
    >
      <p className="text-eyebrow">{t('finance.tax.title')}</p>
      <h2 className="text-section-title mt-sm" id="tax-administration-heading">
        {t('finance.tax.subtitle')}
      </h2>
      <p className="text-meta mt-sm" data-tax-disclaimer>
        {t(tax.disclaimerKey)}
      </p>
      <p className="text-meta mt-sm" data-tax-banking-note>
        {t(tax.bankingNoteKey)}
      </p>

      {showRecalculated && (
        <p className="text-meta mt-sm" role="status" data-tax-recalculated>
          {t('finance.tax.recalculated')}
        </p>
      )}

      <div className="mt-md">
        <p className="text-eyebrow">{t('finance.tax.stateLabel')}</p>
        <p className="text-body mt-sm" data-tax-state-label>
          {t(tax.stateLabelKey)}
        </p>
        <p className="text-body mt-sm" data-tax-explanation>
          {t(tax.explanationKey)}
        </p>
      </div>

      <div className="mt-md">
        <p className="text-eyebrow">{t('finance.tax.known')}</p>
        <ul className="text-body mt-sm" data-tax-known>
          {tax.knownFacts.map((fact) => (
            <li key={fact.factId} data-tax-fact={fact.factId} data-tax-fact-presence={fact.presence}>
              {t(fact.labelKey)}:{' '}
              {fact.presence === 'KNOWN'
                ? fact.valueText?.startsWith('finance.')
                  ? t(fact.valueText)
                  : fact.valueText
                : t('finance.tax.presence.unknown')}
            </li>
          ))}
        </ul>
      </div>

      {tax.missingFieldKeys.length > 0 && (
        <div className="mt-md">
          <p className="text-eyebrow">{t('finance.tax.missing')}</p>
          <ul className="text-body mt-sm" data-tax-missing>
            {tax.missingFieldKeys.map((key) => (
              <li key={key}>{t(key)}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-md">
        <p className="text-eyebrow">{t('finance.tax.next')}</p>
        {tax.nextAction.href ? (
          <Link
            href={tax.nextAction.href}
            className="atlas-slide__cta mt-sm"
            data-tax-cta={tax.nextAction.kind}
          >
            {t(tax.nextAction.labelKey)}
          </Link>
        ) : (
          <p className="text-body mt-sm">{t(tax.nextAction.labelKey)}</p>
        )}
      </div>
    </AtlasSurface>
  );
}
