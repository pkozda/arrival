'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import type { UiSnapshot } from '@/lib/api';
import type { ActionCard, PublicModuleContract } from '@/lib/product-contract';
import {
  OnboardingChecklistCard,
  useOnboardingDismissed,
} from '@/components/home/OnboardingChecklistCard';
import { SuggestedModulesSection } from '@/components/home/SuggestedModulesSection';
import { NextStepsCard } from '@/components/home/NextStepsCard';
import { LifeEventColdStartCard } from '@/components/home/LifeEventColdStartCard';
import { HomeExperienceLayout } from '@/components/home/HomeExperienceLayout';
import { useEconomicRealityPlan } from '@/lib/economic-reality';
import {
  buildModuleContractLookup,
  formatCategoryLabel,
  groupModulesByCategory,
} from '@/lib/module-catalog-utils';
import { getGlobalUxActions, getAttentionLayer } from '@/lib/snapshot';
import {
  buildSituationSummary,
  deriveOnboardingSteps,
  shouldShowOnboardingChecklist,
  suggestModules,
} from '@/lib/situation-utils';
import { buildHomePlanViewModelV2 } from '@/lib/life-event-plan';
import { buildCatalogModuleSuggestions } from '@/lib/module-orchestration/life-event-bridge';
import { resolveScenario } from '@/lib/life-event/scenarios';
import { deriveHomePresenceModel } from '@/lib/presentation/home-presence';
import { useApp } from '@/components/AppProvider';
import { selectUserContextProfile } from '@/lib/user-context';
import { shouldShowLifeEventColdStart, shouldHideHomeSecondarySections } from '@/lib/presentation/home-p0';

type Props = {
  snapshot: UiSnapshot;
};

function ModuleCard({ module }: { module: PublicModuleContract }) {
  return (
    <Link
      href={`/modules/${module.id}`}
      className="card home-explore-topics__card"
      style={{ textDecoration: 'none', color: 'inherit' }}
    >
      <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.35rem' }}>{module.title}</h3>
      {module.description && (
        <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
          {module.description}
        </p>
      )}
    </Link>
  );
}

function filterActionCardsByCapability(
  items: ActionCard[],
  moduleLookup: Map<string, PublicModuleContract>
): ActionCard[] {
  return items.filter((item) => {
    const contract = moduleLookup.get(item.moduleId);
    return contract ? contract.capabilities.supports.actions : false;
  });
}

function mergePriorityActions(
  attentionLayer: ActionCard[],
  actionCards: ActionCard[]
): ActionCard[] {
  const seen = new Set<string>();
  const merged: ActionCard[] = [];

  for (const card of [...attentionLayer, ...actionCards]) {
    if (seen.has(card.actionId)) {
      continue;
    }
    seen.add(card.actionId);
    merged.push(card);
  }

  return merged;
}

export function HomeSnapshotRenderer({ snapshot }: Props) {
  const { executions } = snapshot;
  const {
    modules,
    userContext,
    profileInsights,
    lifeEventPlan,
    lifeEventPlanLoading,
    lifeEventPlanError,
    t,
  } = useApp();
  const economicState = useEconomicRealityPlan();
  const profile = selectUserContextProfile(userContext);
  const [onboardingDismissed, dismissOnboarding] = useOnboardingDismissed();

  const moduleLookup = useMemo(() => buildModuleContractLookup(modules), [modules]);
  const groupedModules = useMemo(() => groupModulesByCategory(modules), [modules]);

  const situationSummary = useMemo(
    () => buildSituationSummary(profile, snapshot.session.language),
    [profile, snapshot.session.language]
  );
  const onboardingSteps = useMemo(
    () => deriveOnboardingSteps(snapshot, profile),
    [snapshot, profile]
  );
  const moduleSuggestions = useMemo(() => {
    const catalogSuggestions = buildCatalogModuleSuggestions(lifeEventPlan, modules);
    if (catalogSuggestions.length > 0) {
      return catalogSuggestions;
    }
    return suggestModules(snapshot, modules, profile);
  }, [lifeEventPlan, modules, snapshot, profile]);

  const homePlanView = useMemo(
    () =>
      buildHomePlanViewModelV2({
        plan: lifeEventPlan,
        insights: profileInsights,
        moduleSuggestions,
      }),
    [lifeEventPlan, profileInsights, moduleSuggestions]
  );

  const scenarioMatch = useMemo(() => {
    if (!lifeEventPlan || !userContext) {
      return null;
    }

    return resolveScenario({
      userContext,
      currentPlan: lifeEventPlan,
    });
  }, [lifeEventPlan, userContext]);

  const showOnboarding = shouldShowOnboardingChecklist(snapshot, profile, onboardingDismissed);
  const showActionsSection = modules.some((module) => module.capabilities.supports.actions);

  const priorityActions = showActionsSection
    ? mergePriorityActions(
        filterActionCardsByCapability(getAttentionLayer(snapshot), moduleLookup),
        filterActionCardsByCapability(getGlobalUxActions(snapshot), moduleLookup)
      )
    : [];

  const showColdStart = shouldShowLifeEventColdStart({
    plan: lifeEventPlan,
    planLoading: lifeEventPlanLoading,
    executionSurface: homePlanView.nextSteps.executionSurface,
  });

  const hideSecondarySections = shouldHideHomeSecondarySections({
    planLoading: lifeEventPlanLoading,
    showPlanCard: homePlanView.nextSteps.showCard,
    showColdStart,
  });

  const presence = useMemo(
    () =>
      deriveHomePresenceModel({
        showColdStart,
        planLoading: lifeEventPlanLoading,
        hasPlan: Boolean(lifeEventPlan),
        situationSummary,
        scenarioTitle: scenarioMatch?.reasoning ?? null,
        t,
      }),
    [showColdStart, lifeEventPlanLoading, lifeEventPlan, situationSummary, scenarioMatch, t]
  );

  const hints = homePlanView.p4.showCard ? homePlanView.p4.hints : [];
  const suggestions = homePlanView.suggestedModules.showSection
    ? homePlanView.suggestedModules.items
    : [];

  const exploreSection =
    !hideSecondarySections && groupedModules.length > 0 ? (
      <section id="home-explore-topics" className="home-explore-topics">
        <h2 className="home-explore-topics__title">{t('life-event.home.browseTopics')}</h2>
        <div className="home-explore-topics__grid">
          {groupedModules.map(({ category, modules: categoryModules }) => (
            <div key={category} className="home-explore-topics__group">
              <h3 className="home-explore-topics__category">{formatCategoryLabel(category)}</h3>
              <div className="home-explore-topics__cards">
                {categoryModules.map((module) => (
                  <ModuleCard key={module.id} module={module} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    ) : null;

  return (
    <HomeExperienceLayout
      presence={presence}
      presenceLoading={lifeEventPlanLoading && !lifeEventPlan}
      narrativeRevision={
        lifeEventPlan
          ? `${lifeEventPlan.generatedAt}-${lifeEventPlan.currentLifeState}`
          : lifeEventPlanLoading
            ? 'loading'
            : showColdStart
              ? 'cold-start'
              : 'no-plan'
      }
      economicState={economicState}
      onEconomicRetry={economicState.refetch}
      situationSummary={situationSummary}
      hints={hints}
      priorityActions={priorityActions}
      suggestions={suggestions}
      recentResultsCount={executions.length}
      showBrowseLink={!hideSecondarySections && groupedModules.length > 0}
      exploreSection={exploreSection}
      primary={
        <>
          {showOnboarding && (
            <OnboardingChecklistCard steps={onboardingSteps} onDismiss={dismissOnboarding} />
          )}
          {showColdStart && <LifeEventColdStartCard />}
          <NextStepsCard
            plan={lifeEventPlan}
            loading={lifeEventPlanLoading}
            error={lifeEventPlanError}
            executionSurface={homePlanView.nextSteps.executionSurface}
            scenario={scenarioMatch}
            insight={{
              completenessSummary: homePlanView.p4.completenessSummary,
              hints: homePlanView.p4.showCard ? homePlanView.p4.hints : [],
            }}
          />
          {!hideSecondarySections && suggestions.length > 0 && (
            <div className="home-primary-narrative__aside">
              <SuggestedModulesSection suggestions={suggestions} />
            </div>
          )}
        </>
      }
    />
  );
}
