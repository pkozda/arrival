import type { LifeEventReasoning, LifeEventPlanNode, SecondaryConditionId } from '@arrival-atlas/product-contract';
import type { ProfileInsightViewV1 } from '@arrival-atlas/product-contract';
import type { LifeEventGraphDefinition } from './graph/types.js';
import { findNodeDefinition } from './graph/resolve.js';

const SECONDARY_BLOCKER_COPY: Record<SecondaryConditionId, string> = {
  registration_incomplete: 'Registration is not complete yet.',
  insurance_gap: 'Health insurance coverage needs attention.',
  housing_data_missing: 'Housing details are incomplete for planning.',
  housing_search_active: 'You are still looking for stable housing.',
  employment_data_missing: 'Employment information is missing.',
  income_data_missing: 'Income details are not recorded yet.',
  benefits_data_missing: 'Benefits information has not been assessed.',
  household_data_missing: 'Household details are incomplete.',
  banking_not_established: 'A suitable bank account is not set up yet.',
  re_registration_required: 'You need to re-register after your move.',
  life_transition_pending: 'A life change may require additional admin steps.',
  low_planning_confidence: 'Some situation details may need review for accuracy.',
  economic_setup_pending: 'Employment and income foundation still needs attention.',
};

export function buildReasoning(
  graph: LifeEventGraphDefinition,
  focus: LifeEventPlanNode,
  activeBlocks: LifeEventPlanNode[],
  secondaryConditions: SecondaryConditionId[],
  profileInsights?: ProfileInsightViewV1 | null
): LifeEventReasoning {
  const focusDefinition = findNodeDefinition(graph, focus.id);
  const whyThisNow = [
    graph.intent,
    focusDefinition?.rationale ?? focus.description,
  ].filter((line, index, array) => array.indexOf(line) === index);

  const whatIsBlocking: string[] = [];

  for (const block of activeBlocks) {
    whatIsBlocking.push(`${block.title} is waiting on earlier steps.`);
  }

  for (const condition of secondaryConditions) {
    const copy = SECONDARY_BLOCKER_COPY[condition];
    if (copy && !whatIsBlocking.includes(copy)) {
      whatIsBlocking.push(copy);
    }
  }

  if (whatIsBlocking.length === 0 && !focus.satisfied) {
    whatIsBlocking.push(focus.description);
  }

  const planConfidence =
    profileInsights?.globalConfidence ??
    (focus.priority === 'critical' ? 'medium' : 'high');

  return {
    whyThisNow,
    whatIsBlocking,
    planConfidence,
  };
}
