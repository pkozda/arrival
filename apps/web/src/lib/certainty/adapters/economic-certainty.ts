import type {
  EconomicBlockerId,
  EconomicEvaluationV1,
  GraphExecutionStateV1,
  PlanConfidence,
} from '@/lib/product-contract';
import type {
  CertaintyExpectedOutcome,
  CertaintyLevel,
  CertaintyReason,
  CertaintyState,
} from '../types';
import type { CertaintySurfaceBundle } from '../types-bundle';

const ECONOMIC_LOCATION = 'Economic Reality';

/** Semantic blocker tokens — formatters own phrasing. */
const BLOCKER_PREREQUISITE: Partial<Record<EconomicBlockerId, string>> = {
  'SC-REG': 'Municipal registration',
  'SC-ADDR': 'Housing details',
  'SC-INS': 'Health insurance coverage',
  'SC-DOC': 'Benefits status',
  'SC-HH': 'Household size',
  'SC-STATUS': 'Residency status',
  'SC-REPORT': 'Benefit reporting',
};

const BLOCKER_DESCRIPTION: Partial<Record<EconomicBlockerId, string>> = {
  'SC-REG': 'municipal registration is required',
  'SC-ADDR': 'housing details are required first',
  'SC-INS': 'health insurance coverage affects this assessment',
  'SC-DOC': 'benefits status is unknown',
  'SC-HH': 'household size must be confirmed',
  'SC-STATUS': 'residency status must be confirmed',
  'SC-REPORT': 'benefit reporting is overdue',
};

export type BuildEconomicCertaintyInput = {
  evaluation?: EconomicEvaluationV1;
  execution?: GraphExecutionStateV1;
  primaryFocusCardId: string | null;
  selectedCardId?: string | null;
  dependencySourceCardIds?: string[];
  titleForCard: (cardId: string) => string;
  primaryHighlightLabel: string;
  loading?: boolean;
  error?: string | null;
};

function mapPlanConfidence(confidence: PlanConfidence | undefined): CertaintyLevel {
  switch (confidence) {
    case 'high':
      return 'clear';
    case 'medium':
    case 'low':
      return 'needs_attention';
    case 'none':
    default:
      return 'unknown';
  }
}

function executionProgress(execution?: GraphExecutionStateV1): { completed: number; total: number } | undefined {
  if (!execution?.nodes) {
    return undefined;
  }

  const nodes = Object.values(execution.nodes);
  if (nodes.length === 0) {
    return undefined;
  }

  const completed = nodes.filter((node) => node.status === 'completed' || node.status === 'skipped').length;
  return { completed, total: nodes.length };
}

function isAssessmentComplete(input: BuildEconomicCertaintyInput): boolean {
  const progress = executionProgress(input.execution);
  if (progress && progress.completed === progress.total && progress.total > 0) {
    return true;
  }

  return (
    input.evaluation?.planConfidence === 'high' &&
    (input.evaluation.blockers?.length ?? 0) === 0 &&
    !input.loading &&
    !input.error
  );
}

function resolveEconomicConfidence(input: BuildEconomicCertaintyInput): CertaintyLevel {
  if (input.loading) {
    return 'unknown';
  }

  if (input.error) {
    return 'needs_attention';
  }

  if ((input.dependencySourceCardIds?.length ?? 0) > 0) {
    return 'blocked';
  }

  if (input.execution?.derivedState.blockedNodeIds.length) {
    return 'blocked';
  }

  if (isAssessmentComplete(input)) {
    return 'clear';
  }

  return mapPlanConfidence(input.evaluation?.planConfidence);
}

function primaryBlocker(blockers: EconomicBlockerId[] | undefined): EconomicBlockerId | undefined {
  if (!blockers?.length) {
    return undefined;
  }

  const priority: EconomicBlockerId[] = [
    'SC-ADDR',
    'SC-REG',
    'SC-DOC',
    'SC-STATUS',
    'SC-INS',
    'SC-HH',
    'SC-REPORT',
  ];

  return priority.find((id) => blockers.includes(id)) ?? blockers[0];
}

function actionLabelForFocus(input: BuildEconomicCertaintyInput, focusCardId: string): string {
  return input.titleForCard(focusCardId);
}

function buildEconomicReason(input: {
  focusCardId: string;
  focusLabel: string;
  dependencySourceCardIds: string[];
  titleForCard: (cardId: string) => string;
  evaluation?: EconomicEvaluationV1;
}): CertaintyReason {
  const prerequisiteId = input.dependencySourceCardIds[0];
  if (prerequisiteId) {
    return {
      type: 'dependency',
      prerequisite: input.titleForCard(prerequisiteId),
      target: input.focusLabel,
    };
  }

  const blocker = primaryBlocker(input.evaluation?.blockers);
  if (blocker && BLOCKER_PREREQUISITE[blocker]) {
    if (blocker === 'SC-ADDR' || blocker === 'SC-REG') {
      return {
        type: 'dependency',
        prerequisite: BLOCKER_PREREQUISITE[blocker]!,
        target: input.focusLabel,
      };
    }

    if (BLOCKER_DESCRIPTION[blocker]) {
      return { type: 'description', description: BLOCKER_DESCRIPTION[blocker]! };
    }
  }

  if (input.evaluation?.axes.incomeAxis === 'none') {
    return { type: 'progress', target: 'Income' };
  }

  return { type: 'progress', target: input.focusLabel };
}

function buildEconomicExpectedOutcome(input: {
  focusLabel: string;
  dependencySourceCardIds: string[];
  evaluation?: EconomicEvaluationV1;
}): CertaintyExpectedOutcome | undefined {
  if (input.dependencySourceCardIds.length > 0) {
    return { type: 'unlock', target: input.focusLabel };
  }

  if (input.evaluation?.economicState) {
    return { type: 'openPath', target: input.evaluation.economicState };
  }

  return { type: 'unlock', target: input.focusLabel };
}

export function buildEconomicCertaintyState(input: BuildEconomicCertaintyInput): CertaintyState {
  const {
    evaluation,
    execution,
    primaryFocusCardId,
    selectedCardId,
    dependencySourceCardIds = [],
    titleForCard,
    primaryHighlightLabel,
    loading,
    error,
  } = input;

  const focusCardId = selectedCardId ?? primaryFocusCardId;
  const title = focusCardId ? titleForCard(focusCardId) : primaryHighlightLabel;
  const progress = executionProgress(execution);
  const confidence = resolveEconomicConfidence(input);

  if (isAssessmentComplete(input)) {
    return {
      location: ECONOMIC_LOCATION,
      title: primaryHighlightLabel,
      progress,
      confidence: 'clear',
    };
  }

  if (!focusCardId) {
    return {
      location: ECONOMIC_LOCATION,
      title: primaryHighlightLabel,
      progress,
      confidence,
    };
  }

  const focusLabel = titleForCard(focusCardId);
  const reason = buildEconomicReason({
    focusCardId,
    focusLabel,
    dependencySourceCardIds,
    titleForCard,
    evaluation,
  });

  return {
    location: ECONOMIC_LOCATION,
    title,
    nextAction: {
      label: actionLabelForFocus(input, focusCardId),
      reason,
      expectedOutcome: buildEconomicExpectedOutcome({
        focusLabel,
        dependencySourceCardIds,
        evaluation,
      }),
    },
    progress,
    confidence: loading || error ? confidence : confidence,
  };
}

function resolveEconomicRecommendedFocusId(
  input: BuildEconomicCertaintyInput,
  state: CertaintyState
): string | null {
  if (!state.nextAction) {
    return null;
  }

  if (input.dependencySourceCardIds?.[0]) {
    return input.dependencySourceCardIds[0]!;
  }

  return input.selectedCardId ?? input.primaryFocusCardId;
}

export type EconomicCertaintyBundle = CertaintySurfaceBundle;

export function buildEconomicCertaintyBundle(
  input: BuildEconomicCertaintyInput
): EconomicCertaintyBundle {
  const state = buildEconomicCertaintyState(input);

  return {
    state,
    recommendedFocusId: resolveEconomicRecommendedFocusId(input, state),
    meta: {
      primaryFocusCardId: input.primaryFocusCardId,
      selectedCardId: input.selectedCardId ?? null,
      economicState: input.evaluation?.economicState ?? null,
    },
  };
}
