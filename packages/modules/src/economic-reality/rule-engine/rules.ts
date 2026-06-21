import type {
  EconomicBlockerId,
  EconomicEvaluationV1,
  EconomicRuleId,
  EconomicStateId,
  EconomicSupportSystemId,
} from '@arrival-atlas/product-contract';
import type { EconomicSignalBundle } from './axes.js';
import { toEconomicAxes } from './axes.js';

export type RuleMatch = {
  id: EconomicRuleId;
  matched: boolean;
  weight: number;
  economicState?: EconomicStateId;
  supportSystem?: EconomicSupportSystemId;
  debugReason: string;
};

const RULE_ORDER: EconomicRuleId[] = ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7'];

export function runEconomicRules(signals: EconomicSignalBundle): {
  winningRule: EconomicRuleId;
  economicState: EconomicStateId;
  supportSystem: EconomicSupportSystemId;
  appliedRules: RuleMatch[];
} {
  const appliedRules: RuleMatch[] = [];

  for (const id of RULE_ORDER) {
    const match = evaluateRule(id, signals);
    appliedRules.push(match);
    if (match.matched) {
      return {
        winningRule: id,
        economicState: match.economicState!,
        supportSystem: match.supportSystem ?? signals.supportSystem,
        appliedRules,
      };
    }
  }

  // unreachable — R7 always matches
  throw new Error('Rule engine exhausted without match');
}

function evaluateRule(id: EconomicRuleId, signals: EconomicSignalBundle): RuleMatch {
  switch (id) {
    case 'R1':
      return ruleR1(signals);
    case 'R2':
      return ruleR2(signals);
    case 'R3':
      return ruleR3(signals);
    case 'R4':
      return ruleR4(signals);
    case 'R5':
      return ruleR5(signals);
    case 'R6':
      return ruleR6(signals);
    case 'R7':
      return ruleR7(signals);
    default:
      return {
        id,
        matched: false,
        weight: 0,
        debugReason: 'unknown rule',
      };
  }
}

function ruleR1(signals: EconomicSignalBundle): RuleMatch {
  const matched =
    signals.incomeAxis === 'none' &&
    signals.supportSystem === 'none' &&
    signals.institutionAxis === 'none' &&
    signals.survivalCrisis;

  return {
    id: 'R1',
    matched,
    weight: matched ? 1 : 0,
    economicState: 'financial_crisis',
    supportSystem: 'none',
    debugReason: matched
      ? 'No income, no support, survival crisis indicators'
      : 'Crisis predicates not satisfied',
  };
}

function ruleR2(signals: EconomicSignalBundle): RuleMatch {
  const intentOnly =
    signals.benefitApplicationIntent && signals.supportSystem !== 'pending';
  const matched = signals.supportSystem === 'pending' || intentOnly;

  return {
    id: 'R2',
    matched,
    weight: matched ? 1 : 0,
    economicState: 'application_pending',
    supportSystem: intentOnly ? 'none' : 'pending',
    debugReason: matched
      ? intentOnly
        ? 'Support application intent without resolved rail'
        : 'Support application in progress'
      : 'No pending application',
  };
}

function ruleR3(signals: EconomicSignalBundle): RuleMatch {
  const matched =
    signals.institutionAxis === 'sozialamt' &&
    (signals.supportSystem === 'sozialamt' || isSozialamtInstitutionWithoutPayments(signals));

  return {
    id: 'R3',
    matched,
    weight: matched ? 1 : 0,
    economicState: 'benefits_sozialamt',
    supportSystem: 'sozialamt',
    debugReason: matched ? 'Active or residency-mandated Sozialamt path' : 'Sozialamt path not active',
  };
}

function isSozialamtInstitutionWithoutPayments(signals: EconomicSignalBundle): boolean {
  return signals.supportSystem === 'none' && signals.institutionAxis === 'sozialamt';
}

function ruleR4(signals: EconomicSignalBundle): RuleMatch {
  const matched = signals.supportSystem === 'jobcenter';

  return {
    id: 'R4',
    matched,
    weight: matched ? 1 : 0,
    economicState: 'benefits_jobcenter',
    supportSystem: 'jobcenter',
    debugReason: matched ? 'Active Jobcenter / Bürgergeld support' : 'Jobcenter support not active',
  };
}

function ruleR5(signals: EconomicSignalBundle): RuleMatch {
  const matched = signals.employmentAxis === 'transition';

  return {
    id: 'R5',
    matched,
    weight: matched ? 1 : 0,
    economicState: 'unemployment_transition',
    supportSystem: 'none',
    debugReason: matched ? 'Unemployment transition without active support' : 'Not in transition',
  };
}

function ruleR6(signals: EconomicSignalBundle): RuleMatch {
  const matched = signals.employmentAxis === 'employed';

  if (!matched) {
    return {
      id: 'R6',
      matched: false,
      weight: 0,
      debugReason: 'Not employed',
    };
  }

  const selfSustained =
    signals.incomeAxis === 'stable' || (signals.isStudent && signals.incomeAxis === 'none');
  const economicState: EconomicStateId = selfSustained ? 'self_sustained' : 'employment_active';
  const supportSystem: EconomicSupportSystemId =
    signals.institutionAxis === 'jobcenter' ? 'jobcenter' : 'none';

  return {
    id: 'R6',
    matched: true,
    weight: 1,
    economicState,
    supportSystem,
    debugReason: selfSustained
      ? 'Employed with stable income or self-sufficient student'
      : 'Employed with partial or unstable income',
  };
}

function ruleR7(_signals: EconomicSignalBundle): RuleMatch {
  return {
    id: 'R7',
    matched: true,
    weight: 1,
    economicState: 'unemployment_transition',
    supportSystem: 'none',
    debugReason:
      'R7 catch-all: explicit fallback when R1–R6 do not match (FIRST MATCH WINS)',
  };
}

export function buildEvaluationFromRules(
  signals: EconomicSignalBundle,
  _blockers: EconomicBlockerId[],
  _confidenceScore: number,
  _planConfidence: EconomicEvaluationV1['planConfidence']
): Pick<
  EconomicEvaluationV1,
  'economicState' | 'supportSystem' | 'axes' | 'appliedRules'
> {
  const result = runEconomicRules(signals);

  return {
    economicState: result.economicState,
    supportSystem: result.supportSystem,
    axes: toEconomicAxes(signals),
    appliedRules: result.appliedRules.map((rule) => ({
      id: rule.id,
      matched: rule.matched,
      weight: rule.weight,
      output: rule.matched
        ? {
            economicState: rule.economicState,
            supportSystem: rule.supportSystem,
          }
        : undefined,
      debugReason: rule.debugReason,
    })),
  };
}
