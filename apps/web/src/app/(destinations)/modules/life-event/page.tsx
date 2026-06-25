'use client';

import { Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useApp } from '@/components/AppProvider';
import { LifeEventPlanView } from '@/components/life-event/LifeEventPlanView';
import { LifeEventPlanIntake } from '@/components/life-event/LifeEventPlanIntake';
import { LifeEventScenarioExplorer } from '@/components/life-event/LifeEventScenarioExplorer';
import { lifeEventModuleTitle } from '@/lib/life-event/content-labels';
import { shouldShowLifeEventPlanIntake } from '@/lib/life-event/cold-start-intake';
import { resolveScenario } from '@/lib/life-event/scenarios';
import { defaultScenarioExplorerOpen } from '@/lib/presentation/home-p0';
import { hasUserContextProfile } from '@/lib/user-context';
import { GalaxyViewport, WireframeSkeleton } from '@/lib/presentation/le-ux';
import { SurfaceErrorPanel } from '@/components/surface/SurfaceErrorPanel';
import { useSurfaceRetry } from '@/components/surface/useSurfaceRetry';

function GalaxyLoadingOverlay() {
  return (
    <div className="le-galaxy-viewport__overlay">
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
    refreshLifeEventPlan,
  } = useApp();
  const { retrying, onRetry } = useSurfaceRetry(refreshLifeEventPlan);
  const contract = modules.find((module) => module.id === 'life-event');
  const initialScenarioEvent = searchParams.get('event') ?? undefined;
  const scenariosMode = searchParams.get('mode') === 'scenarios';
  const moduleLabel = contract ? lifeEventModuleTitle(t, contract.title) : 'Life Events';

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
      <GalaxyViewport label={moduleLabel}>
        <div className="le-galaxy-viewport__overlay le-galaxy-viewport__overlay--message">
          {t('life-event.empty.loadingModule')}
        </div>
      </GalaxyViewport>
    );
  }

  if (modulesError || !contract || contract.status !== 'available') {
    return (
      <GalaxyViewport label={moduleLabel}>
        <div className="le-galaxy-viewport__overlay le-galaxy-viewport__overlay--message">
          {modulesError ?? t('life-event.empty.moduleNotFound')}
        </div>
      </GalaxyViewport>
    );
  }

  return (
    <GalaxyViewport label={moduleLabel}>
      {(lifeEventPlanLoading || retrying) && <GalaxyLoadingOverlay />}

      {!lifeEventPlanLoading && !retrying && lifeEventPlanError && !isProfileNotReadyPlanError && (
        <div className="le-galaxy-viewport__overlay">
          <SurfaceErrorPanel
            message={lifeEventPlanError}
            onRetry={onRetry}
            retrying={retrying}
            title={t('common.error')}
            retryLabel={t('common.retry')}
          />
        </div>
      )}

      {!lifeEventPlanLoading && !retrying && lifeEventPlan && (
        <LifeEventPlanView
          plan={lifeEventPlan}
          scenario={scenarioMatch}
          scenarioExplorer={scenarioExplorer}
          scenarioExplorerDefaultOpen={explorerDefaultOpen}
        />
      )}

      {showPlanIntakeForm && (
        <div className="le-galaxy-viewport__overlay le-galaxy-viewport__overlay--intake">
          <LifeEventPlanIntake />
        </div>
      )}

      {!showPlanIntakeForm &&
        !lifeEventPlanLoading &&
        !retrying &&
        !lifeEventPlan &&
        !lifeEventPlanError &&
        scenarioExplorer && (
          <details className="le-galaxy-hud le-galaxy-hud--explorer" open={explorerDefaultOpen}>
            <summary className="le-galaxy-hud__explorer-toggle">Scenarios</summary>
            <div className="le-galaxy-hud__explorer-body">{scenarioExplorer}</div>
          </details>
        )}
    </GalaxyViewport>
  );
}

export default function LifeEventModulePage() {
  return (
    <Suspense fallback={<GalaxyViewport label="Life Events"><GalaxyLoadingOverlay /></GalaxyViewport>}>
      <LifeEventModulePageContent />
    </Suspense>
  );
}
