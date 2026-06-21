'use client';

import Link from 'next/link';
import { useApp } from '@/components/AppProvider';

export function LifeEventColdStartCard() {
  const { t } = useApp();

  return (
    <section className="card le-cold-start" style={{ marginBottom: '1rem' }}>
      <h2 className="le-cold-start__title">{t('life-event.home.coldStart.title')}</h2>
      <p className="le-cold-start__description">{t('life-event.home.coldStart.description')}</p>
      <div className="le-cold-start__actions">
        <div className="le-cold-start__primary">
          <Link href="/modules/life-event" className="btn btn-primary">
            {t('life-event.home.coldStart.startPlanning')}
          </Link>
          <p className="le-cold-start__meta">{t('life-event.home.coldStart.duration')}</p>
        </div>
        <Link href="/modules/life-event?mode=scenarios" className="btn btn-secondary">
          {t('life-event.home.coldStart.exploreScenarios')}
        </Link>
      </div>
      <p className="le-cold-start__reassurance">{t('life-event.home.coldStart.reassurance')}</p>
    </section>
  );
}
