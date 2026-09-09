'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AtlasLink as Link } from '@/components/atlas-runtime';
import { useApp } from '@/components/AppProvider';
import { AtlasSurface } from '@/components/atlas-runtime/legacy';
import { buildHousingSituationViewModel } from '@/lib/housing/build-housing-situation-view-model';
import { selectUserContextProfile } from '@/lib/user-context';

/**
 * E9 — Housing Situation panel (Economic Reality host).
 * Derived from profile facts — not a marketplace, not registration ownership.
 */
export function HousingSituationPanel() {
  const { t, userContext } = useApp();
  const [showRecalculated, setShowRecalculated] = useState(false);
  const previousFingerprintRef = useRef<string | null>(null);

  const profile = selectUserContextProfile(userContext);
  const situation = useMemo(() => buildHousingSituationViewModel(profile), [profile]);

  useEffect(() => {
    const fingerprint = [
      situation.state,
      situation.registration.confirmed ? '1' : '0',
      situation.knownFacts.map((f) => `${f.factId}:${f.presence}`).join(','),
    ].join('|');
    if (previousFingerprintRef.current && previousFingerprintRef.current !== fingerprint) {
      setShowRecalculated(true);
    }
    previousFingerprintRef.current = fingerprint;
  }, [situation]);

  return (
    <AtlasSurface
      as="section"
      className="mb-md er-housing-situation"
      data-ui-panel="HousingSituationPanel"
      data-housing-state={situation.state}
      data-housing-registration={
        situation.registration.confirmed
          ? 'confirmed'
          : situation.registration.hasRegistrableAddress
            ? 'pending'
            : 'needs-address'
      }
      aria-labelledby="housing-situation-heading"
    >
      <p className="text-eyebrow">{t('housing.situation.title')}</p>
      <h2 className="text-section-title mt-sm" id="housing-situation-heading">
        {t('housing.situation.subtitle')}
      </h2>
      <p className="text-meta mt-sm" data-housing-disclaimer>
        {t(situation.disclaimerKey)}
      </p>

      {showRecalculated && (
        <p className="text-meta mt-sm" role="status" data-housing-recalculated>
          {t('housing.situation.recalculated')}
        </p>
      )}

      <div className="mt-md">
        <p className="text-eyebrow">{t('housing.situation.stateLabel')}</p>
        <p className="text-body mt-sm" data-housing-state-label>
          {t(situation.stateLabelKey)}
        </p>
        <p className="text-body mt-sm" data-housing-explanation>
          {t(situation.explanationKey)}
        </p>
      </div>

      <div className="mt-md">
        <p className="text-eyebrow">{t('housing.situation.known')}</p>
        <ul className="text-body mt-sm" data-housing-known>
          {situation.knownFacts.map((fact) => (
            <li key={fact.factId} data-housing-fact={fact.factId} data-housing-fact-presence={fact.presence}>
              {t(fact.labelKey)}:{' '}
              {fact.presence === 'KNOWN'
                ? fact.valueText ?? t('housing.situation.presence.known')
                : t('housing.situation.presence.unknown')}
            </li>
          ))}
        </ul>
      </div>

      {situation.missingFieldKeys.length > 0 && (
        <div className="mt-md">
          <p className="text-eyebrow">{t('housing.situation.missing')}</p>
          <ul className="text-body mt-sm" data-housing-missing>
            {situation.missingFieldKeys.map((key) => (
              <li key={key}>{t(key)}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-md">
        <p className="text-eyebrow">{t('housing.situation.registrationLabel')}</p>
        <p className="text-body mt-sm" data-housing-registration-status>
          {t(situation.registration.statusKey)}
        </p>
      </div>

      <div className="mt-md">
        <p className="text-eyebrow">{t('housing.situation.next')}</p>
        {situation.nextAction.href ? (
          <Link
            href={situation.nextAction.href}
            className="atlas-slide__cta mt-sm"
            data-housing-cta={situation.nextAction.kind}
          >
            {t(situation.nextAction.labelKey)}
          </Link>
        ) : (
          <p className="text-body mt-sm">{t(situation.nextAction.labelKey)}</p>
        )}
      </div>
    </AtlasSurface>
  );
}
