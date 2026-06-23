'use client';

import { Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { PageHeader } from '@/components/atlas-runtime';
import { AtlasSurface } from '@/components/atlas-runtime/legacy';
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
import { SurfaceErrorPanel } from '@/components/surface/SurfaceErrorPanel';
import { useSurfaceRetry } from '@/components/surface/useSurfaceRetry';

function LoadingState() {
  return (
    <AtlasSurface className="le-plan-card">
      <WireframeSkeleton />
    </AtlasSurface>
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
    refreshLifeEventPlan,
  } = useApp();
  const { retrying, onRetry } = useSurfaceRetry(refreshLifeEventPlan);
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
  const isProfileNotReadyPlanError = Boolean(
    lifeEventPlanError?.includes('UserContext profile is available')
  );
  const showPlanIntakeForm =
    showPlanIntake && !lifeEventPlanLoading && !retrying && (!lifeEventPlanError || isProfileNotReadyPlanError);

  const scenarioExplorer = contract ? (
    <LifeEventScenarioExplorer
      contract={contract}
      initialScenarioEvent={initialScenarioEvent}
      embeddedInPanel
    />
  ) : null;

  if (modulesLoading) {
    return (
      <AtlasSurface className="text-center" style={{ padding: '2rem' }}>
        {t('life-event.empty.loadingModule')}
      </AtlasSurface>
    );
  }

  if (modulesError || !contract || contract.status !== 'available') {
    return (
      <AtlasSurface style={{ padding: '2rem' }}>
        {modulesError ?? t('life-event.empty.moduleNotFound')}
      </AtlasSurface>
    );
  }

  return (
    <div className="le-module-page">
      <PageHeader
        eyebrow="Module"
        title={lifeEventModuleTitle(t, contract.title)}
        description={
          contract.description ? lifeEventModuleDescription(t, contract.description) : undefined
        }
      />

      {(lifeEventPlanLoading || retrying) && <LoadingState />}

      {!lifeEventPlanLoading && !retrying && lifeEventPlanError && !isProfileNotReadyPlanError && (
        <AtlasSurface className="le-plan-card" data-ui-surface="life-event-module-body">
          <SurfaceErrorPanel
            message={lifeEventPlanError}
            onRetry={onRetry}
            retrying={retrying}
            title={t('common.error')}
            retryLabel={t('common.retry')}
          />
        </AtlasSurface>
      )}

      {!lifeEventPlanLoading && !retrying && lifeEventPlan && (
        <LifeEventPlanView
          plan={lifeEventPlan}
          scenario={scenarioMatch}
          scenarioExplorer={scenarioExplorer}
          scenarioExplorerDefaultOpen={explorerDefaultOpen}
        />
      )}

      {showPlanIntakeForm && <LifeEventPlanIntake />}

      {!showPlanIntakeForm && !lifeEventPlanLoading && !retrying && !lifeEventPlan && !lifeEventPlanError && scenarioExplorer && (
        <ScenarioExplorerPanel defaultOpen={explorerDefaultOpen}>
          {scenarioExplorer}
        </ScenarioExplorerPanel>
      )}
    </div>
  );
}

export default function LifeEventModulePage() {
  return (
    <main className="celestial-page-main">
      <div className="container">
        <Suspense fallback={<LoadingState />}>
          <LifeEventModulePageContent />
        </Suspense>
      </div>
    </main>
  );
}
