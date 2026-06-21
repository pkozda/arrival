'use client';

import { Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { Header } from '@/components/Header';
import { useApp } from '@/components/AppProvider';
import { LifeEventPlanView } from '@/components/life-event/LifeEventPlanView';
import { LifeEventPlanIntake } from '@/components/life-event/LifeEventPlanIntake';
import { LifeEventScenarioExplorer } from '@/components/life-event/LifeEventScenarioExplorer';
import { ScenarioExplorerPanel } from '@/components/life-event/ScenarioExplorerPanel';
import { lifeEventModuleDescription, lifeEventModuleTitle } from '@/lib/life-event/content-labels';
import { shouldShowLifeEventPlanIntake } from '@/lib/life-event/cold-start-intake';
import { resolveScenario } from '@/lib/life-event/scenarios';
import { defaultScenarioExplorerOpen } from '@/lib/presentation/home-p0';
import { hasUserContextProfile } from '@/lib/user-context';
import { WireframeSkeleton } from '@/lib/presentation/le-ux';

function LoadingState() {
  return (
    <div className="card le-plan-card">
      <WireframeSkeleton />
    </div>
  );
}

function LifeEventModulePageContent() {
  const searchParams = useSearchParams();
  const {
    modules,
    modulesLoading,
    modulesError,
    lifeEventPlan,
    lifeEventPlanLoading,
    lifeEventPlanError,
    userContext,
    t,
  } = useApp();
  const contract = modules.find((module) => module.id === 'life-event');
  const initialScenarioEvent = searchParams.get('event') ?? undefined;
  const scenariosMode = searchParams.get('mode') === 'scenarios';

  const scenarioMatch = useMemo(() => {
    if (!lifeEventPlan || !userContext) {
      return null;
    }

    return resolveScenario({
      userContext,
      currentPlan: lifeEventPlan,
    });
  }, [lifeEventPlan, userContext]);

  const explorerDefaultOpen = defaultScenarioExplorerOpen({
    hasPlan: Boolean(lifeEventPlan),
    mode: scenariosMode ? 'scenarios' : null,
  });

  const showPlanIntake = shouldShowLifeEventPlanIntake({
    planLoading: lifeEventPlanLoading,
    hasPlan: Boolean(lifeEventPlan),
    hasProfile: hasUserContextProfile(userContext),
    scenariosMode,
  });

  const scenarioExplorer = contract ? (
    <LifeEventScenarioExplorer
      contract={contract}
      initialScenarioEvent={initialScenarioEvent}
      embeddedInPanel
    />
  ) : null;

  if (modulesLoading) {
    return (
      <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
        {t('life-event.empty.loadingModule')}
      </div>
    );
  }

  if (modulesError || !contract || contract.status !== 'available') {
    return (
      <div className="card" style={{ padding: '2rem' }}>
        {modulesError ?? t('life-event.empty.moduleNotFound')}
      </div>
    );
  }

  return (
    <div className="le-module-page">
      <header className="le-module-page__header">
        <h1>{lifeEventModuleTitle(t, contract.title)}</h1>
        {contract.description && (
          <p>{lifeEventModuleDescription(t, contract.description)}</p>
        )}
      </header>

      {lifeEventPlanLoading && <LoadingState />}

      {!lifeEventPlanLoading && lifeEventPlanError && (
        <div className="card" style={{ padding: '1.5rem', color: 'var(--color-text-muted)' }}>
          {lifeEventPlanError}
        </div>
      )}

      {!lifeEventPlanLoading && lifeEventPlan && (
        <LifeEventPlanView
          plan={lifeEventPlan}
          scenario={scenarioMatch}
          scenarioExplorer={scenarioExplorer}
          scenarioExplorerDefaultOpen={explorerDefaultOpen}
        />
      )}

      {showPlanIntake && <LifeEventPlanIntake />}

      {!showPlanIntake && !lifeEventPlanLoading && !lifeEventPlan && !lifeEventPlanError && scenarioExplorer && (
        <ScenarioExplorerPanel defaultOpen={explorerDefaultOpen}>
          {scenarioExplorer}
        </ScenarioExplorerPanel>
      )}
    </div>
  );
}

export default function LifeEventModulePage() {
  return (
    <>
      <Header />
      <main style={{ padding: '2rem 0 4rem' }}>
        <div className="container">
          <Suspense fallback={<LoadingState />}>
            <LifeEventModulePageContent />
          </Suspense>
        </div>
      </main>
    </>
  );
}
