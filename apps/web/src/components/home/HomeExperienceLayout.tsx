'use client';

import { useRef, type ReactNode } from 'react';
import type { HomePresenceModel, HomePresencePhase } from '@/lib/presentation/home-presence';
import { HomePresenceHero } from '@/components/home/HomePresenceHero';
import { HomePrimaryNarrative } from '@/components/home/HomePrimaryNarrative';
import { HomeSecondaryContext } from '@/components/home/HomeSecondaryContext';
import { HomeSystemSignals } from '@/components/home/HomeSystemSignals';
import { useHomeLandingMotion } from '@/lib/presentation/useHomeLandingMotion';
import type { EconomicRealityClientStateV1 } from '@/lib/economic-reality';
import type { ActionCard, MissingContextHint } from '@/lib/product-contract';
import type { ModuleSuggestion, SituationSummary } from '@/lib/situation-utils';

const TIMELINE_PHASES: HomePresencePhase[] = ['mapping', 'transition', 'stabilizing', 'mapped'];

type Props = {
  presence: HomePresenceModel;
  presenceLoading?: boolean;
  narrativeRevision?: string;
  primary: ReactNode;
  economicState: EconomicRealityClientStateV1;
  onEconomicRetry: () => Promise<void>;
  situationSummary: SituationSummary | null;
  hints: MissingContextHint[];
  priorityActions: ActionCard[];
  suggestions: ModuleSuggestion[];
  recentResultsCount: number;
  showBrowseLink: boolean;
  exploreSection?: ReactNode;
};

export function HomeExperienceLayout({
  presence,
  presenceLoading = false,
  narrativeRevision,
  primary,
  economicState,
  onEconomicRetry,
  situationSummary,
  hints,
  priorityActions,
  suggestions,
  recentResultsCount,
  showBrowseLink,
  exploreSection,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  useHomeLandingMotion(rootRef);

  return (
    <div ref={rootRef} className="home-experience" data-life-state={presence.phase}>
      <div className="home-experience__ambient" aria-hidden="true">
        <div className="home-experience__atmosphere" />
        <div className="home-experience__blob home-experience__blob--1" />
        <div className="home-experience__blob home-experience__blob--2" />
        <div className="home-experience__blob home-experience__blob--3" />
        <div className="home-experience__blob home-experience__blob--4" />
        <div className="home-experience__blob home-experience__blob--5" />
        <div className="home-experience__aurora" />
        <div className="home-experience__mesh" />
        <div className="home-experience__grain" />
        <div className="home-experience__focus-beam" />
        <div className="home-experience__life-glow" />
        <div className="home-experience__breath" />
      </div>

      <nav className="home-experience__timeline" aria-hidden="true">
        {TIMELINE_PHASES.map((phase) => (
          <span
            key={phase}
            className={`home-experience__timeline-node${
              presence.phase === phase ? ' is-active' : ''
            }`}
            data-phase={phase}
          />
        ))}
      </nav>

      <div className="home-experience__content">
        <HomePresenceHero presence={presence} loading={presenceLoading} />
        <HomePrimaryNarrative contentRevision={narrativeRevision} phase={presence.phase}>
          {primary}
        </HomePrimaryNarrative>
        <HomeSecondaryContext state={economicState} onRetry={onEconomicRetry} />
        <HomeSystemSignals
          situationSummary={situationSummary}
          hints={hints}
          priorityActions={priorityActions}
          suggestions={suggestions}
          recentResultsCount={recentResultsCount}
          showBrowseLink={showBrowseLink}
        />
        {exploreSection ? (
          <div className="home-experience__explore" data-home-layer="explore">
            {exploreSection}
          </div>
        ) : null}
      </div>
    </div>
  );
}
