'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import type { UiSnapshot } from '@/lib/api';
import type { ActionCard, PublicModuleContract } from '@/lib/product-contract';
import { ModuleProjectionRenderer } from '@/components/ModuleProjectionRenderer';
import { ExecutionExplainToggle } from '@/components/ExecutionExplainToggle';
import {
  OnboardingChecklistCard,
  useOnboardingDismissed,
} from '@/components/home/OnboardingChecklistCard';
import { SuggestedModulesSection } from '@/components/home/SuggestedModulesSection';
import { YourSituationSummaryCard } from '@/components/home/YourSituationSummaryCard';
import { NextStepsCard } from '@/components/home/NextStepsCard';
import { LifeEventColdStartCard } from '@/components/home/LifeEventColdStartCard';
import { EconomicRealityCard } from '@/components/home/EconomicRealityCard';
import { useEconomicRealityPlan } from '@/lib/economic-reality';
import {
  buildModuleContractLookup,
  capabilityVisibilityFromContract,
  formatCategoryLabel,
  groupModulesByCategory,
} from '@/lib/module-catalog-utils';
import { getGlobalUxActions, getAttentionLayer } from '@/lib/snapshot';
import {
  buildSituationSummary,
  deriveOnboardingSteps,
  formatExecutionDate,
  shouldShowOnboardingChecklist,
  suggestModules,
} from '@/lib/situation-utils';
import { buildHomePlanViewModelV2 } from '@/lib/life-event-plan';
import { buildCatalogModuleSuggestions } from '@/lib/module-orchestration/life-event-bridge';
import { resolveScenario } from '@/lib/life-event/scenarios';
import { humanizePriority } from '@/lib/ux-labels';
import { useApp } from '@/components/AppProvider';
import { selectUserContextProfile } from '@/lib/user-context';
import { shouldShowLifeEventColdStart, shouldHideHomeSecondarySections } from '@/lib/presentation/home-p0';

type Props = {
  snapshot: UiSnapshot;
};

const cardStyle = {
  marginBottom: '1rem',
} as const;

function SectionTitle({ children }: { children: string }) {
  return (
    <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.75rem' }}>
      {children}
    </h2>
  );
}

function ActionCardItem({ card }: { card: ActionCard }) {
  return (
    <div
      style={{
        padding: '0.75rem 0',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      <strong style={{ fontSize: '0.9375rem' }}>{card.label}</strong>
      <span className={`badge badge-${card.priority}`} style={{ marginLeft: '0.5rem' }}>
        {humanizePriority(card.priority)}
      </span>
      <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
        {card.description}
      </p>
    </div>
  );
}

function PriorityActionsSection({ items }: { items: ActionCard[] }) {
  const { t } = useApp();

  if (items.length === 0) {
    return null;
  }

  return (
    <section style={cardStyle}>
      <SectionTitle>{t('life-event.home.priorityActions')}</SectionTitle>
      <div className="card">
        {items.map((item) => (
          <ActionCardItem key={item.actionId} card={item} />
        ))}
      </div>
    </section>
  );
}

function ModuleCard({ module }: { module: PublicModuleContract }) {
  return (
    <Link
      href={`/modules/${module.id}`}
      className="card"
      style={{ textDecoration: 'none', color: 'inherit' }}
    >
      <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.5rem' }}>
        {module.title}
      </h3>
      {module.description && (
        <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
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

function EconomicRealityHomeSection() {
  const economicState = useEconomicRealityPlan();
  return <EconomicRealityCard state={economicState} />;
}

export function HomeSnapshotRenderer({ snapshot }: Props) {
  const { executions, session } = snapshot;
  const {
    modules,
    userContext,
    profileInsights,
    lifeEventPlan,
    lifeEventPlanLoading,
    lifeEventPlanError,
    t,
  } = useApp();
  const profile = selectUserContextProfile(userContext);
  const [onboardingDismissed, dismissOnboarding] = useOnboardingDismissed();

  const moduleLookup = useMemo(() => buildModuleContractLookup(modules), [modules]);
  const groupedModules = useMemo(() => groupModulesByCategory(modules), [modules]);

  const situationSummary = useMemo(
    () => buildSituationSummary(profile, session.language),
    [profile, session.language]
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

  return (
    <>
      {showOnboarding && (
        <OnboardingChecklistCard steps={onboardingSteps} onDismiss={dismissOnboarding} />
      )}

      {!showColdStart && <YourSituationSummaryCard summary={situationSummary} />}

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

      {!hideSecondarySections && <EconomicRealityHomeSection />}

      {homePlanView.suggestedModules.showSection &&
        !hideSecondarySections &&
        !homePlanView.nextSteps.showCard && (
        <div style={{ opacity: 0.88, marginTop: '0.25rem' }}>
          <SuggestedModulesSection suggestions={homePlanView.suggestedModules.items} />
        </div>
      )}

      {!hideSecondarySections && !homePlanView.nextSteps.showCard && (
        <PriorityActionsSection items={priorityActions} />
      )}

      {!hideSecondarySections && groupedModules.length > 0 && (
        <section style={cardStyle}>
          <SectionTitle>{t('life-event.home.browseTopics')}</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {groupedModules.map(({ category, modules: categoryModules }) => (
              <div key={category}>
                <h3
                  style={{
                    fontSize: '0.875rem',
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: 'var(--color-text-muted)',
                    marginBottom: '0.75rem',
                  }}
                >
                  {formatCategoryLabel(category)}
                </h3>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                    gap: '1rem',
                  }}
                >
                  {categoryModules.map((module) => (
                    <ModuleCard key={module.id} module={module} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {executions.length > 0 && (
        <section style={cardStyle}>
          <SectionTitle>{t('life-event.home.recentResults')}</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {executions.map((execution) => {
              const contract = moduleLookup.get(execution.moduleId);
              const visibility = contract
                ? capabilityVisibilityFromContract(contract)
                : {
                    showRecommendations: false,
                    showActions: false,
                    showExplanation: false,
                    showRiskModel: false,
                  };
              const formattedDate = formatExecutionDate(execution.createdAt);

              return (
                <div key={execution.executionId} className="card">
                  <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                    {execution.projection.title}
                  </h3>
                  {formattedDate && (
                    <p
                      style={{
                        fontSize: '0.75rem',
                        color: 'var(--color-text-muted)',
                        marginBottom: '0.75rem',
                      }}
                    >
                      {formattedDate}
                    </p>
                  )}
                  <ModuleProjectionRenderer
                    projection={execution.projection}
                    visibility={visibility}
                  />
                  {visibility.showExplanation && execution.projection.status === 'success' && (
                    <ExecutionExplainToggle
                      moduleId={execution.moduleId}
                      executionId={execution.executionId}
                      sessionId={snapshot.session.sessionId}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </>
  );
}
