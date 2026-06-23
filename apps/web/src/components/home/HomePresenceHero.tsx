'use client';

import { useEffect, useMemo, useState } from 'react';
import type { HomePresenceModel } from '@/lib/presentation/home-presence';
import {
  getHeroEmphasisKey,
  getHeroMorphKeys,
  getHeroStatusKey,
  splitHeroStatement,
} from '@/lib/presentation/home-presence-display';
import { usePrefersReducedMotion } from '@/lib/presentation/useHomeLandingMotion';
import { useApp } from '@/components/AppProvider';

type Props = {
  presence: HomePresenceModel;
  loading?: boolean;
};

function HeroStatement({ statementKey, t }: { statementKey: string; t: (key: string) => string }) {
  const statement = t(statementKey);
  const emphasisKey = getHeroEmphasisKey(statementKey);
  const emphasisText = emphasisKey ? t(emphasisKey) : '';
  const parts = emphasisText ? splitHeroStatement(statement, emphasisText) : null;

  if (parts) {
    return (
      <>
        {parts.before}
        <span className="home-presence-hero__emphasis">{parts.emphasis}</span>
        {parts.after}
      </>
    );
  }

  return <>{statement}</>;
}

export function HomePresenceHero({ presence, loading = false }: Props) {
  const { t } = useApp();
  const reducedMotion = usePrefersReducedMotion();
  const morphKeys = useMemo(() => getHeroMorphKeys(presence.phase), [presence.phase]);
  const [morphIndex, setMorphIndex] = useState(0);

  useEffect(() => {
    setMorphIndex(0);
  }, [presence.phase]);

  useEffect(() => {
    if (loading || reducedMotion || morphKeys.length < 2) {
      return;
    }

    const timer = window.setInterval(() => {
      setMorphIndex((current) => (current + 1) % morphKeys.length);
    }, 7000);

    return () => window.clearInterval(timer);
  }, [loading, morphKeys.length, reducedMotion, presence.phase]);

  const activeKey = morphKeys[morphIndex] ?? morphKeys[0];

  return (
    <header
      className="home-presence-hero"
      data-home-layer="presence"
      data-life-phase={presence.phase}
      aria-live="polite"
    >
      <div className="home-presence-hero__aura" aria-hidden="true" />
      <div className="home-presence-hero__blob home-presence-hero__blob--a" aria-hidden="true" />
      <div className="home-presence-hero__blob home-presence-hero__blob--b" aria-hidden="true" />
      <div className="home-presence-hero__glow" aria-hidden="true" />

      <div className="home-presence-hero__inner">
        <p className="home-presence-hero__eyebrow">{t('life-event.home.presence.eyebrow')}</p>

        {loading ? (
          <div className="home-presence-hero__statement-skeleton" aria-hidden="true">
            <span />
            <span />
          </div>
        ) : reducedMotion || morphKeys.length < 2 ? (
          <h1 className="home-presence-hero__statement">
            <HeroStatement statementKey={activeKey} t={t} />
          </h1>
        ) : (
          <div className="home-presence-hero__morph">
            {morphKeys.map((key, index) => (
              <h1
                key={key}
                className={`home-presence-hero__statement home-presence-hero__statement--morph${
                  index === morphIndex ? ' is-active' : ''
                }`}
                aria-hidden={index !== morphIndex}
              >
                <HeroStatement statementKey={key} t={t} />
              </h1>
            ))}
          </div>
        )}

        {!loading && (
          <p className="home-presence-hero__status">
            <span className="home-presence-hero__status-dot" aria-hidden="true" />
            {t(getHeroStatusKey(presence.phase))}
          </p>
        )}

        {!loading && presence.contextLine && (
          <p className="home-presence-hero__context" key={presence.contextLine}>
            {presence.contextLine}
          </p>
        )}
      </div>
    </header>
  );
}
