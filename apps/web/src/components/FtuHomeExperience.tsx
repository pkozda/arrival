'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { ProfileInsightBannerFromStore } from '@/components/ProfileInsightBanner';
import { ProfileSurfacePanelFromStore } from '@/components/ProfileSurfacePanel';
import { UxAttentionLayer } from '@/components/UxAttentionLayer';
import { GlobalUxPanel } from '@/components/GlobalUxPanel';
import { ExploreModulesSection } from '@/components/ExploreModulesSection';
import {
  advanceFTUStep,
  getFTUCtaLabel,
  getFTUServerSnapshot,
  getFTUSnapshot,
  getFTUStepDescription,
  getFTUStepNumber,
  subscribeFTUStore,
  type FTUState,
} from '@/lib/ftu';
import { hasGlobalUx } from '@/lib/ux-aggregator';

type ModuleCard = {
  id: string;
  href: string;
  titleKey: string;
  descKey: string;
  icon: string;
  color: string;
  priority: boolean;
};

type Props = {
  modules: ModuleCard[];
  t: (key: string) => string;
};

function FtuOnboardingCard({
  ftu,
  onAdvance,
}: {
  ftu: FTUState;
  onAdvance: () => void;
}) {
  const stepNumber = getFTUStepNumber(ftu.step);
  const hasUx = hasGlobalUx();

  return (
    <section
      className="card"
      style={{
        marginBottom: '1.5rem',
        padding: '1.5rem',
        textAlign: 'center',
        borderColor: 'var(--color-primary)',
        background: 'var(--color-primary-subtle)',
      }}
    >
      <p
        style={{
          fontSize: '0.75rem',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: 'var(--color-primary)',
          marginBottom: '0.75rem',
        }}
      >
        Step {stepNumber} of 3
      </p>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>
        Welcome to Arrive Atlas
      </h2>
      <p
        style={{
          fontSize: '0.9375rem',
          color: 'var(--color-text-muted)',
          lineHeight: 1.6,
          maxWidth: '520px',
          margin: '0 auto 1rem',
        }}
      >
        {getFTUStepDescription(ftu.step)}
      </p>
      {!hasUx && ftu.step === 'insight' && (
        <p
          style={{
            fontSize: '0.875rem',
            color: 'var(--color-text-muted)',
            marginBottom: '1rem',
          }}
        >
          Run a module first to generate personalized guidance, or continue to learn how the
          assistant layers work together.
        </p>
      )}
      <button type="button" className="btn btn-primary" onClick={onAdvance}>
        {getFTUCtaLabel(ftu.step)}
      </button>
    </section>
  );
}

export function FtuHomeExperience({ modules, t }: Props) {
  const ftu = useSyncExternalStore(subscribeFTUStore, getFTUSnapshot, getFTUServerSnapshot);

  const handleAdvance = useCallback(() => {
    advanceFTUStep(ftu);
  }, [ftu]);

  const ftuActive = ftu.isFirstTime && ftu.step !== 'complete';

  if (!ftuActive) {
    return (
      <>
        <ProfileInsightBannerFromStore />
        <ProfileSurfacePanelFromStore />
        <UxAttentionLayer />
        <GlobalUxPanel />
        <ExploreModulesSection modules={modules} t={t} />
      </>
    );
  }

  const showInsight = ftu.step === 'insight' || ftu.step === 'surface' || ftu.step === 'actions';
  const showSurface = ftu.step === 'surface' || ftu.step === 'actions';
  const showActions = ftu.step === 'actions';
  const showModulesCollapsed = ftu.step === 'actions';

  return (
    <>
      <FtuOnboardingCard ftu={ftu} onAdvance={handleAdvance} />
      {showInsight && <ProfileInsightBannerFromStore />}
      {showSurface && <ProfileSurfacePanelFromStore />}
      {showActions && (
        <>
          <UxAttentionLayer />
          <GlobalUxPanel />
        </>
      )}
      {showModulesCollapsed && (
        <ExploreModulesSection modules={modules} t={t} forceCollapsed />
      )}
    </>
  );
}
