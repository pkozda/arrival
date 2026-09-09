'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { evaluateBenefitsAwarenessSummary } from '@arrival-atlas/mbde/awareness';
import type { BenefitsAwarenessResultV1 } from '@arrival-atlas/mbde/awareness';
import { AtlasLink as Link } from '@/components/atlas-runtime';
import { useApp } from '@/components/AppProvider';
import { AtlasSurface } from '@/components/atlas-runtime/legacy';
import { selectUserContextProfile } from '@/lib/user-context';

function BenefitAwarenessCard({
  awareness,
  t,
  isPrimaryFocus,
}: {
  awareness: BenefitsAwarenessResultV1;
  t: (key: string) => string;
  isPrimaryFocus: boolean;
}) {
  const stateLabel = t(`benefits.awareness.state.${awareness.state}`);
  const recordReceivingLabelKey =
    awareness.benefitId === 'de_federal_kindergeld'
      ? 'benefits.awareness.action.recordReceivingKindergeld'
      : 'benefits.awareness.action.recordReceiving';
  const secondaryHref =
    awareness.state === 'READY_TO_ACT' &&
    (awareness.benefitId === 'de_federal_wohngeld' ||
      awareness.benefitId === 'de_federal_kindergeld')
      ? '/profile/benefits-support/edit'
      : null;
  const completedMarker =
    awareness.state === 'COMPLETED' ? ` — ${t('benefits.awareness.aggregate.completedMarker')}` : '';

  return (
    <article
      className="mt-md er-benefits-awareness__item"
      data-benefits-benefit={awareness.benefitId}
      data-benefits-state={awareness.state}
      data-benefits-primary-focus={isPrimaryFocus ? 'true' : 'false'}
      aria-labelledby={`benefits-card-title-${awareness.benefitId}`}
    >
      <h3
        className="text-body"
        id={`benefits-card-title-${awareness.benefitId}`}
        data-benefits-benefit-title
      >
        {t(awareness.titleKey)}
      </h3>
      <p className="text-eyebrow mt-sm">{t('benefits.awareness.stateLabel')}</p>
      <p className="text-body mt-sm" data-benefits-state-label>
        {stateLabel}
        {completedMarker}
      </p>
      <p className="text-body mt-sm" data-benefits-explanation>
        {t(awareness.explanationKey)}
      </p>

      {awareness.missingFieldKeys.length > 0 && (
        <div className="mt-sm">
          <p className="text-eyebrow">{t('benefits.awareness.missing')}</p>
          <ul className="text-body mt-sm" data-benefits-missing>
            {awareness.missingFieldKeys.map((key) => (
              <li key={key}>{t(key)}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-sm">
        <p className="text-eyebrow">{t('benefits.awareness.next')}</p>
        {awareness.nextAction.href && awareness.nextAction.kind === 'open_official_source' ? (
          <a
            className="atlas-slide__cta mt-sm"
            href={awareness.nextAction.href}
            target="_blank"
            rel="noopener noreferrer"
            data-benefits-cta={awareness.nextAction.kind}
          >
            {t(awareness.nextAction.labelKey)}
            <span className="sr-only"> ({t('discovery.result.externalLink')})</span>
          </a>
        ) : awareness.nextAction.href ? (
          <Link
            href={awareness.nextAction.href}
            className="atlas-slide__cta mt-sm"
            data-benefits-cta={awareness.nextAction.kind}
          >
            {t(awareness.nextAction.labelKey)}
          </Link>
        ) : (
          <p className="text-body mt-sm">{t(awareness.nextAction.labelKey)}</p>
        )}

        {secondaryHref && (
          <p className="mt-sm">
            <Link href={secondaryHref} data-benefits-cta="record-receiving">
              {t(recordReceivingLabelKey)}
            </Link>
          </p>
        )}
      </div>
    </article>
  );
}

/**
 * E4–E7 — Benefits awareness panel (Economic Reality host).
 * Derived from profile facts via MBDE heuristics — not persisted as domain state.
 * E7: deterministic presentation ordering + aggregate focus chrome (no ranking scores).
 */
export function BenefitsAwarenessPanel() {
  const { t, userContext } = useApp();
  const [showRecalculated, setShowRecalculated] = useState(false);
  const previousFingerprintRef = useRef<string | null>(null);

  const profile = selectUserContextProfile(userContext);

  const summary = useMemo(() => {
    if (!profile) return null;
    return evaluateBenefitsAwarenessSummary(profile);
  }, [profile]);

  useEffect(() => {
    if (!summary) return;
    const fingerprint = summary.items
      .map(
        (a) =>
          `${a.benefitId}:${a.state}:${a.engine.missingFields.join(',')}:${a.engine.heuristicMatch}`
      )
      .join('|');
    if (previousFingerprintRef.current && previousFingerprintRef.current !== fingerprint) {
      setShowRecalculated(true);
    }
    previousFingerprintRef.current = fingerprint;
  }, [summary]);

  if (!summary || summary.items.length === 0) {
    return null;
  }

  const primaryId = summary.primaryFocus?.benefitId ?? null;
  const panelState =
    summary.primaryFocus?.state ??
    summary.items.find((item) => item.state === 'COMPLETED')?.state ??
    summary.items[0]?.state;

  return (
    <AtlasSurface
      as="section"
      className="mb-md er-benefits-awareness"
      data-ui-panel="BenefitsAwarenessPanel"
      data-benefits-count={summary.counts.total}
      data-benefits-actionable-count={
        summary.counts.readyToAct + summary.counts.potentiallyRelevant
      }
      data-benefits-completed-count={summary.counts.completed}
      data-benefits-focus-mode={summary.focusMode}
      data-benefits-state={panelState}
      aria-labelledby="benefits-awareness-heading"
    >
      <p className="text-eyebrow">{t('benefits.awareness.title')}</p>
      <h2 className="text-section-title mt-sm" id="benefits-awareness-heading">
        {t('benefits.awareness.subtitle')}
      </h2>
      <p className="text-meta mt-sm" data-benefits-disclaimer>
        {t('benefits.awareness.disclaimer')}
      </p>
      <p className="text-body mt-sm" data-benefits-aggregate-summary role="status">
        {t(summary.summaryKey)}
      </p>

      {summary.primaryFocus && summary.focusMode !== 'REVIEW_COMPLETED' && (
        <p className="text-meta mt-sm" data-benefits-primary-next>
          {t('benefits.awareness.aggregate.primaryNext')}:{' '}
          {t(summary.primaryFocus.titleKey)} —{' '}
          {t(`benefits.awareness.state.${summary.primaryFocus.state}`)}
        </p>
      )}

      {showRecalculated && (
        <p className="text-meta mt-sm" role="status" data-benefits-recalculated>
          {t('benefits.awareness.recalculated')}
        </p>
      )}

      {summary.items.map((awareness) => (
        <BenefitAwarenessCard
          key={awareness.benefitId}
          awareness={awareness}
          t={t}
          isPrimaryFocus={awareness.benefitId === primaryId}
        />
      ))}
    </AtlasSurface>
  );
}
