'use client';

import Link from 'next/link';
import { useApp } from '@/components/AppProvider';
import type { InsightWireframeContent } from '@/lib/presentation/le-ux/types';

type Props = InsightWireframeContent & {
  variant: 'home' | 'module';
};

function ReasoningList({ items }: { items: string[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <ul className="le-insight__list">
      {items.map((line) => (
        <li key={line} className="le-insight__item">
          {line}
        </li>
      ))}
    </ul>
  );
}

export function InsightBlock({
  variant,
  whyThisNow,
  whatIsBlocking,
  showProgressConstrained,
  completenessSummary,
  hints,
}: Props) {
  const { t } = useApp();

  const showPlanWhy = variant === 'module' && whyThisNow.length > 0;
  const showPlanBlocking = variant === 'module' && showProgressConstrained && whatIsBlocking.length > 0;
  const showP4 = Boolean(completenessSummary) || hints.length > 0;

  if (!showPlanWhy && !showPlanBlocking && !showP4) {
    return <section className="le-insight" aria-label={t('life-event.plan.whyThisNow')} />;
  }

  return (
    <section className="le-insight" aria-label={t('life-event.plan.whyThisNow')}>
      {showPlanWhy && (
        <div className="le-insight__chunk">
          <h2 className="le-insight__heading le-insight__heading--why">{t('life-event.plan.whyThisNow')}</h2>
          <ReasoningList items={whyThisNow} />
        </div>
      )}

      {showPlanBlocking && (
        <div className="le-insight__chunk">
          <h2 className="le-insight__heading le-insight__heading--blockers">
            {t('life-event.plan.whyProgressConstrained')}
          </h2>
          <ReasoningList items={whatIsBlocking} />
        </div>
      )}

      {showP4 && (
        <div className="le-insight__chunk">
          {completenessSummary && <p className="le-insight__summary">{completenessSummary}</p>}
          {hints.length > 0 && (
            <ul className="le-insight__hints">
              {hints.map((hint) => (
                <li key={`${hint.domain}-${hint.href}`}>
                  <Link href={hint.href} className="le-insight__hint-link">
                    {hint.message}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
