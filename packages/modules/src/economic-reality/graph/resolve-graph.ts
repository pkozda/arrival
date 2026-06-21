import type { EconomicEvaluationV1, GraphContextV1 } from '@arrival-atlas/product-contract';

const ECONOMIC_GRAPH_CONTEXT_SCHEMA_VERSION = '1.0.0' as const;
import { resolveEntryNodeId } from './entry-nodes.js';
import {
  applySupportRefinement,
  ECONOMIC_STATE_E_LABEL,
  isForbiddenGraphTransition,
  resolvePrimaryGraph,
} from './mappings.js';
import { lookupGraphDefinition } from './registry.js';

function buildRuleTrace(input: {
  stateMap: string;
  secondary?: string;
  entryNodeId: string;
  appliedRules: EconomicEvaluationV1['appliedRules'];
}): string[] {
  const trace = [`STATE_MAP:${input.stateMap}`];

  if (input.secondary) {
    trace.push(input.secondary);
  }

  for (const rule of input.appliedRules) {
    if (rule.matched) {
      trace.push(`RULE:${rule.id}`);
    }
  }

  trace.push(`ENTRY_NODE:${input.entryNodeId}`);
  return trace;
}

export function resolveGraphContext(evaluation: EconomicEvaluationV1): GraphContextV1 {
  const primary = resolvePrimaryGraph(evaluation.economicState);

  let graphId = primary.graphId;
  let variant = primary.variant;
  let secondarySelector: string | undefined;
  const ruleTraceParts: string[] = [];

  const eLabel = ECONOMIC_STATE_E_LABEL[evaluation.economicState];
  const graphLabel = `${graphId}${variant ? `-${variant}` : ''}`;
  const stateMapLabel = `${eLabel}→${graphLabel}`;

  const refinement = applySupportRefinement({
    state: evaluation.economicState,
    supportSystem: evaluation.supportSystem,
    institutionAxis: evaluation.axes.institutionAxis,
    primary,
  });

  if (refinement) {
    graphId = refinement.graphId;
    variant = undefined;
    secondarySelector =
      refinement.trace === 'SUPPORT_OVERRIDE:sozialamt'
        ? 'supportSystem:sozialamt'
        : refinement.trace.replace('SUPPORT_OVERRIDE:', '');
    ruleTraceParts.push(refinement.trace);
  }

  if (isForbiddenGraphTransition(evaluation.economicState, graphId)) {
    throw new Error(
      `Forbidden graph transition: ${evaluation.economicState} → ${graphId}`
    );
  }

  const entryNodeId = resolveEntryNodeId(graphId, variant);

  lookupGraphDefinition(graphId, variant);

  const ruleTrace = buildRuleTrace({
    stateMap: stateMapLabel,
    secondary: ruleTraceParts[0],
    entryNodeId,
    appliedRules: evaluation.appliedRules,
  });

  return {
    schemaVersion: ECONOMIC_GRAPH_CONTEXT_SCHEMA_VERSION,
    graphId,
    ...(variant ? { variant } : {}),
    entryNodeId,
    reasoning: {
      primarySelector: primary.selector,
      ...(secondarySelector ? { secondarySelector } : {}),
      ruleTrace,
    },
  };
}
