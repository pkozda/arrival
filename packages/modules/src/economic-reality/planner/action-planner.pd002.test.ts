import { describe, expect, it } from 'vitest';
import type { UserContextV1 } from '@arrival-atlas/product-contract';
import { ER_COPY_KEYS } from '@arrival-atlas/product-contract';
import { evaluate } from '../rule-engine/index.js';
import { resolveGraphContext } from '../graph/resolve-graph.js';
import { buildExecutionState } from '../execution/build-execution-state.js';
import { evaluateEconomicSatisfactionKeys } from '../execution/satisfaction-keys.js';
import { buildActionSet } from '../actions/build-action-set.js';
import { buildPlan } from '../planner/build-plan.js';
import { buildActionPlannerViewModel } from '../planner/action-planner.js';

function context(partial: {
  city?: string;
  municipalRegistrationConfirmed?: boolean;
  residencyStatus?: 'temporary-resident' | 'tourist' | 'permanent-resident';
  daysInGermany?: number;
  employmentStatus?: 'unemployed' | 'employed';
  grossMonthlyIncome?: number;
}): UserContextV1 {
  return {
    schemaVersion: '1.0.0',
    profile: {
      schemaVersion: '1.0.0',
      preferences: {},
      completeness: { score: 0, missingDomains: [] },
      domains: {
        housing: partial.city ? { city: partial.city } : undefined,
        migration: {
          residencyStatus: partial.residencyStatus ?? 'temporary-resident',
          ...(partial.municipalRegistrationConfirmed !== undefined
            ? { municipalRegistrationConfirmed: partial.municipalRegistrationConfirmed }
            : {}),
        },
        benefits: { daysInGermany: partial.daysInGermany ?? 45 },
        employment:
          partial.employmentStatus !== undefined
            ? { employmentStatus: partial.employmentStatus }
            : undefined,
        income:
          partial.grossMonthlyIncome !== undefined
            ? { grossMonthlyIncome: partial.grossMonthlyIncome }
            : undefined,
      },
    },
  };
}

function pipeline(userContext: UserContextV1) {
  const evaluation = evaluate(userContext);
  const graphContext = resolveGraphContext(evaluation);
  const execution = buildExecutionState(graphContext, userContext);
  const actionSet = buildActionSet(execution, userContext);
  const plan = buildPlan(execution, actionSet, userContext);
  const planner = buildActionPlannerViewModel({
    userContext,
    execution,
    actionSet,
    plan,
  });
  return { evaluation, execution, actionSet, plan, planner };
}

describe('PD-002 Action Planner v1 registration gate', () => {
  it('A — prerequisite missing: confirm is not READY without address; housing is READY', () => {
    const { planner, actionSet } = pipeline(
      context({ residencyStatus: 'tourist', daysInGermany: 5, employmentStatus: 'unemployed' })
    );

    expect(planner.focus).toBe('registration_gate');
    expect(planner.status).toBe('READY');
    expect(planner.nextAction?.id).toContain('profile-housing');
    expect(planner.missingReasonKeys).toContain(ER_COPY_KEYS.PLANNER_MISSING_ADDRESS);
    expect(
      actionSet.actions.some((action) => action.id.endsWith(':profile-confirm-registration'))
    ).toBe(false);
  });

  it('B — prerequisite satisfied: address present makes confirm READY (not housing)', () => {
    const { planner, actionSet } = pipeline(
      context({
        city: 'Bremen',
        residencyStatus: 'temporary-resident',
        daysInGermany: 45,
        employmentStatus: 'unemployed',
      })
    );

    expect(planner.focus).toBe('registration_gate');
    expect(planner.status).toBe('READY');
    expect(planner.nextAction?.id).toContain('profile-confirm-registration');
    expect(planner.missingReasonKeys).toContain(ER_COPY_KEYS.PLANNER_MISSING_CONFIRMATION);
    expect(
      actionSet.actions.some(
        (action) =>
          action.sourceNodeId.includes('registration') &&
          action.payload.profileKey === 'where-you-live'
      )
    ).toBe(false);
  });

  it('C — action completion: registration_confirmed after address + explicit confirm', () => {
    const snapshot = evaluateEconomicSatisfactionKeys(
      context({
        city: 'Bremen',
        municipalRegistrationConfirmed: true,
        residencyStatus: 'temporary-resident',
      })
    );
    expect(snapshot.registrable_address).toBe(true);
    expect(snapshot.registration_confirmed).toBe(true);
  });

  it('D — recalculation: after address, unresolved action is confirm not housing', () => {
    const before = pipeline(
      context({ residencyStatus: 'tourist', daysInGermany: 5, employmentStatus: 'unemployed' })
    );
    expect(before.planner.nextAction?.id).toContain('profile-housing');

    const after = pipeline(
      context({
        city: 'Berlin',
        residencyStatus: 'tourist',
        daysInGermany: 5,
        employmentStatus: 'unemployed',
      })
    );

    expect(after.planner.nextAction?.id).toContain('profile-confirm-registration');
    expect(after.planner.nextAction?.id).not.toBe(before.planner.nextAction?.id);
    expect(
      after.actionSet.actions.some(
        (action) =>
          action.sourceNodeId.includes('registration') &&
          action.id.endsWith(':profile-housing')
      )
    ).toBe(false);
  });

  it('E — missing ≠ false: absent income/employment stay UNKNOWN, not invented negatives', () => {
    const { planner } = pipeline(
      context({ city: 'Cologne', residencyStatus: 'temporary-resident', daysInGermany: 60 })
    );

    const income = planner.knownFacts.find((fact) => fact.factId === 'income');
    const employment = planner.knownFacts.find((fact) => fact.factId === 'employment');
    expect(income?.presence).toBe('UNKNOWN');
    expect(employment?.presence).toBe('UNKNOWN');

    const snapshot = evaluateEconomicSatisfactionKeys(
      context({ city: 'Cologne', residencyStatus: 'temporary-resident', daysInGermany: 60 })
    );
    expect(snapshot.income_declared).toBe(false);
    expect(snapshot.employment_status_known).toBe(false);
  });

  it('F — registration dependency: address alone does not satisfy; explicit confirm does', () => {
    const addressOnly = evaluateEconomicSatisfactionKeys(
      context({ city: 'Bremen', residencyStatus: 'temporary-resident' })
    );
    expect(addressOnly.registrable_address).toBe(true);
    expect(addressOnly.registration_confirmed).toBe(false);

    const confirmed = evaluateEconomicSatisfactionKeys(
      context({
        city: 'Bremen',
        municipalRegistrationConfirmed: true,
        residencyStatus: 'temporary-resident',
      })
    );
    expect(confirmed.registration_confirmed).toBe(true);

    const { planner } = pipeline(
      context({
        city: 'Bremen',
        municipalRegistrationConfirmed: true,
        residencyStatus: 'temporary-resident',
        employmentStatus: 'unemployed',
        daysInGermany: 45,
      })
    );
    expect(planner.focus).toBe('primary_plan');
    expect(planner.nextAction?.id.includes('profile-confirm-registration') ?? false).toBe(false);
    expect(planner.nextAction?.id.includes('profile-housing') ?? false).toBe(false);
  });
});
