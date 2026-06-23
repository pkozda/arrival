'use client';

import { useEffect, useState, type ReactNode } from 'react';
import type { HomePresencePhase } from '@/lib/presentation/home-presence';

type Props = {
  children: ReactNode;
  contentRevision?: string;
  phase?: HomePresencePhase;
};

/** Layer 2 — Life Event dominant narrative surface. */
export function HomePrimaryNarrative({ children, contentRevision, phase }: Props) {
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!contentRevision) {
      return;
    }

    setRefreshing(true);
    const timer = window.setTimeout(() => setRefreshing(false), 520);
    return () => window.clearTimeout(timer);
  }, [contentRevision]);

  return (
    <section
      className={`home-primary-narrative${refreshing ? ' home-primary-narrative--refreshing' : ''}`}
      data-home-layer="primary"
      data-phase={phase}
      aria-label="Your life plan"
    >
      <div className="home-primary-narrative__frame">{children}</div>
    </section>
  );
}
