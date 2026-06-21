import type {
  EconomicFeedbackSignalsV1,
  GraphContextV1,
  GraphExecutionStateV1,
  UserContextV1,
} from '@arrival-atlas/product-contract';

const ECONOMIC_GRAPH_EXECUTION_SCHEMA_VERSION = '1.0.0' as const;
import { fingerprintGraphContext, instantiateGraphNodes } from './graph-instantiator.js';
import { deriveNodeSets, evaluateNodeStates } from './node-evaluator.js';
import { computeProgressRatio } from './progress-calculator.js';
import {
  enrichSatisfactionSnapshotWithFeedback,
  evaluateEconomicSatisfactionKeys,
} from './satisfaction-keys.js';

export function buildExecutionState(
  graphContext: GraphContextV1,
  userContext: UserContextV1,
  options?: { feedbackSignals?: EconomicFeedbackSignalsV1 }
): GraphExecutionStateV1 {
  const satisfactionSnapshot = enrichSatisfactionSnapshotWithFeedback(
    evaluateEconomicSatisfactionKeys(userContext),
    options?.feedbackSignals
  );
  const instantiated = instantiateGraphNodes(graphContext);
  const nodes = evaluateNodeStates(instantiated, satisfactionSnapshot);
  const { activeNodeIds, completedNodeIds, readyNodeIds, blockedNodeIds } =
    deriveNodeSets(nodes);

  const metKeyCount = Object.values(satisfactionSnapshot).filter(Boolean).length;

  return {
    schemaVersion: ECONOMIC_GRAPH_EXECUTION_SCHEMA_VERSION,
    graphId: graphContext.graphId,
    ...(graphContext.variant ? { variant: graphContext.variant } : {}),
    entryNodeId: graphContext.entryNodeId,
    nodes,
    activeNodeIds,
    completedNodeIds,
    derivedState: {
      progressRatio: computeProgressRatio(nodes),
      blockedNodeIds,
      readyNodeIds,
    },
    reasoning: {
      initializedFrom: fingerprintGraphContext(graphContext),
      appliedRules: [
        `NODE_INIT:${graphContext.graphId}`,
        `SAT_KEYS_APPLIED:${metKeyCount}`,
        'NODE_STATE_DERIVED:deterministic',
      ],
    },
  };
}
