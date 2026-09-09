import type {
  EconomicActionSetV1,
  EconomicActionV1,
  EconomicPlanV1,
  UserContextV1,
} from '@/lib/product-contract';
import { ER_COPY_KEYS } from '@/lib/product-contract';

/** Mirrors modules Action Planner v1; kept browser-safe (no Node barrel imports). */
export type ActionPlannerStatusV1 = 'NOT_READY' | 'READY' | 'COMPLETE';

export type ActionPlannerFactV1 = {
  factId: 'address' | 'registration' | 'income' | 'employment';
  labelKey: string;
  presence: 'KNOWN' | 'UNKNOWN';
};

export type ActionPlannerViewModelV1 = {
  status: ActionPlannerStatusV1;
  statusLabelKey: string;
  knownFacts: ActionPlannerFactV1[];
  missingReasonKeys: string[];
  recommendationKey: string;
  nextAction: EconomicActionV1 | null;
  focus: 'registration_gate' | 'primary_plan';
};

const REGISTRATION_ACTION_NODE_IDS = new Set([
  'g2-registration',
  'g5-registration',
  'g6-arrival-proof',
]);

function statusLabelKey(status: ActionPlannerStatusV1): string {
  switch (status) {
    case 'NOT_READY':
      return ER_COPY_KEYS.PLANNER_STATUS_NOT_READY;
    case 'READY':
      return ER_COPY_KEYS.PLANNER_STATUS_READY;
    case 'COMPLETE':
      return ER_COPY_KEYS.PLANNER_STATUS_COMPLETE;
  }
}

function deriveFacts(userContext: UserContextV1) {
  const domains = userContext.profile?.domains ?? {};
  const hasAddress = Boolean(domains.housing?.city?.trim());
  const hasConfirmation = domains.migration?.municipalRegistrationConfirmed === true;
  const incomeDeclared = domains.income?.grossMonthlyIncome !== undefined;
  const employmentKnown = domains.employment?.employmentStatus !== undefined;

  return {
    registrable_address: hasAddress,
    registration_confirmed: hasAddress && hasConfirmation,
    income_declared: incomeDeclared,
    employment_status_known: employmentKnown,
  };
}

function buildFacts(satisfaction: ReturnType<typeof deriveFacts>): ActionPlannerFactV1[] {
  return [
    {
      factId: 'address',
      labelKey: ER_COPY_KEYS.PLANNER_ADDRESS_KNOWN,
      presence: satisfaction.registrable_address ? 'KNOWN' : 'UNKNOWN',
    },
    {
      factId: 'registration',
      labelKey: ER_COPY_KEYS.PLANNER_REGISTRATION_KNOWN,
      presence: satisfaction.registration_confirmed ? 'KNOWN' : 'UNKNOWN',
    },
    {
      factId: 'income',
      labelKey: ER_COPY_KEYS.PLANNER_INCOME_KNOWN,
      presence: satisfaction.income_declared ? 'KNOWN' : 'UNKNOWN',
    },
    {
      factId: 'employment',
      labelKey: ER_COPY_KEYS.PLANNER_EMPLOYMENT_KNOWN,
      presence: satisfaction.employment_status_known ? 'KNOWN' : 'UNKNOWN',
    },
  ];
}

function findRegistrationAction(
  actionSet: EconomicActionSetV1,
  templateSuffix: 'profile-housing' | 'profile-confirm-registration'
): EconomicActionV1 | null {
  return (
    actionSet.actions.find(
      (action) =>
        REGISTRATION_ACTION_NODE_IDS.has(action.sourceNodeId) &&
        action.id.endsWith(`:${templateSuffix}`)
    ) ?? null
  );
}

export function buildActionPlannerViewModel(input: {
  userContext: UserContextV1;
  actionSet: EconomicActionSetV1;
  plan: EconomicPlanV1;
  recommendationKey?: string;
}): ActionPlannerViewModelV1 {
  const satisfaction = deriveFacts(input.userContext);
  const knownFacts = buildFacts(satisfaction);
  const recommendationKey = input.recommendationKey ?? ER_COPY_KEYS.PLANNER_SITUATION;
  const primaryFallback = input.plan.primaryTrack.actions[0] ?? null;

  if (!satisfaction.registrable_address) {
    const housing = findRegistrationAction(input.actionSet, 'profile-housing');
    return {
      status: housing ? 'READY' : 'NOT_READY',
      statusLabelKey: statusLabelKey(housing ? 'READY' : 'NOT_READY'),
      knownFacts,
      missingReasonKeys: [ER_COPY_KEYS.PLANNER_MISSING_ADDRESS],
      recommendationKey,
      nextAction: housing ?? primaryFallback,
      focus: 'registration_gate',
    };
  }

  if (!satisfaction.registration_confirmed) {
    const confirm = findRegistrationAction(input.actionSet, 'profile-confirm-registration');
    const confirmReady = Boolean(confirm) && !confirm?.constraints.blockedByExecutionState;
    return {
      status: confirmReady ? 'READY' : 'NOT_READY',
      statusLabelKey: statusLabelKey(confirmReady ? 'READY' : 'NOT_READY'),
      knownFacts,
      missingReasonKeys: [ER_COPY_KEYS.PLANNER_MISSING_CONFIRMATION],
      recommendationKey,
      nextAction: confirm ?? primaryFallback,
      focus: 'registration_gate',
    };
  }

  const missingReasonKeys: string[] = [];
  if (!satisfaction.income_declared) {
    missingReasonKeys.push(ER_COPY_KEYS.PLANNER_MISSING_INCOME);
  }
  if (!satisfaction.employment_status_known) {
    missingReasonKeys.push(ER_COPY_KEYS.PLANNER_MISSING_EMPLOYMENT);
  }

  if (!primaryFallback && missingReasonKeys.length === 0) {
    return {
      status: 'COMPLETE',
      statusLabelKey: statusLabelKey('COMPLETE'),
      knownFacts,
      missingReasonKeys: [],
      recommendationKey,
      nextAction: null,
      focus: 'primary_plan',
    };
  }

  return {
    status: primaryFallback ? 'READY' : 'NOT_READY',
    statusLabelKey: statusLabelKey(primaryFallback ? 'READY' : 'NOT_READY'),
    knownFacts,
    missingReasonKeys,
    recommendationKey,
    nextAction: primaryFallback,
    focus: 'primary_plan',
  };
}
