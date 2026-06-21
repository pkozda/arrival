import type {
  EconomicActionSetV1,
  EconomicPlanV1,
  GraphExecutionStateV1,
  OrderingStrategy,
  UserContextV1,
} from '@arrival-atlas/product-contract';
import { lookupGraphDefinition } from '../graph/registry.js';
import { sortActionsDeterministically, sortPrimaryTrackActions } from './ordering.js';
import { assertNoCrossTrackDuplicates } from './rule-filter.js';
import { resolveOrderingStrategy } from './strategy-resolver.js';
import { enrichEconomicOpenModuleActions } from '../actions/enrich-action-set.js';
import {
  classifyActionsIntoTracks,
  deduplicateAcrossTracks,
} from './track-builder.js';
import { RULE_IDS } from './types.js';

const ECONOMIC_PLAN_SCHEMA_VERSION = '1.0.0' as const;

const TRACK_PRIORITY_BY_STRATEGY: Record<
  OrderingStrategy,
  { primary: number; secondary: number; system: number }
> = {
  CRISIS_FIRST: { primary: 100, secondary: 35, system: 20 },
  INSTITUTION_FIRST: { primary: 90, secondary: 45, system: 20 },
  PROGRESSION_FIRST: { primary: 80, secondary: 40, system: 20 },
};

function buildPlanId(execution: GraphExecutionStateV1, actionSet: EconomicActionSetV1): string {
  return `${execution.reasoning.initializedFrom}|${actionSet.metadata.sourceExecutionId}`;
}

function strategyRuleId(strategy: EconomicPlanV1['orderingStrategy']): string {
  switch (strategy) {
    case 'CRISIS_FIRST':
      return RULE_IDS.P0;
    case 'INSTITUTION_FIRST':
      return RULE_IDS.P1;
    case 'PROGRESSION_FIRST':
      return RULE_IDS.P2;
  }
}

export function buildPlan(
  execution: GraphExecutionStateV1,
  actionSet: EconomicActionSetV1,
  userContext: UserContextV1
): EconomicPlanV1 {
  const { strategy, path } = resolveOrderingStrategy(execution, userContext);
  const enrichedActionSet = enrichEconomicOpenModuleActions(actionSet, strategy);
  const graphDefinition = lookupGraphDefinition(execution.graphId, execution.variant);
  const graphNodeIds = graphDefinition.nodeIds;

  const classified = classifyActionsIntoTracks(enrichedActionSet, execution, strategy);
  const deduped = deduplicateAcrossTracks(classified);

  const primaryActions = sortPrimaryTrackActions(deduped.primary, graphNodeIds, strategy);
  const secondaryActions = sortActionsDeterministically(deduped.secondary, graphNodeIds);
  const systemActions = sortActionsDeterministically(deduped.system, graphNodeIds);

  assertNoCrossTrackDuplicates({
    primary: primaryActions,
    secondary: secondaryActions,
    system: systemActions,
  });

  const priorities = TRACK_PRIORITY_BY_STRATEGY[strategy];

  const plan: EconomicPlanV1 = {
    schemaVersion: ECONOMIC_PLAN_SCHEMA_VERSION,
    planId: buildPlanId(execution, enrichedActionSet),
    graphId: execution.graphId,
    orderingStrategy: strategy,
    primaryTrack: {
      trackId: 'primary',
      actions: primaryActions,
      priority: priorities.primary,
    },
    systemTrack: {
      trackId: 'system',
      actions: systemActions,
      priority: priorities.system,
    },
    reasoning: {
      appliedRules: [
        strategyRuleId(strategy),
        RULE_IDS.P3,
        RULE_IDS.P4,
        RULE_IDS.P5,
      ],
      prioritizationPath: path,
    },
  };

  if (secondaryActions.length > 0) {
    plan.secondaryTrack = {
      trackId: 'secondary',
      actions: secondaryActions,
      priority: priorities.secondary,
    };
  }

  return plan;
}
