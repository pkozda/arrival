import type {
  EconomicGraphId,
  EconomicGraphVariant,
  EconomicStateId,
  EconomicSupportSystemId,
  InstitutionAxis,
} from '@arrival-atlas/product-contract';

export const ECONOMIC_STATE_E_LABEL: Record<EconomicStateId, string> = {
  self_sustained: 'E1',
  employment_active: 'E2',
  unemployment_transition: 'E3',
  benefits_jobcenter: 'E4',
  benefits_sozialamt: 'E5',
  application_pending: 'E6',
  financial_crisis: 'E7',
};

export type PrimaryGraphResolution = {
  graphId: EconomicGraphId;
  variant?: EconomicGraphVariant;
  selector: string;
};

export function resolvePrimaryGraph(state: EconomicStateId): PrimaryGraphResolution {
  switch (state) {
    case 'self_sustained':
      return { graphId: 'G1', variant: 'A', selector: 'economicState:E1' };
    case 'employment_active':
      return { graphId: 'G4', selector: 'economicState:E2' };
    case 'unemployment_transition':
      return { graphId: 'G2', selector: 'economicState:E3' };
    case 'benefits_jobcenter':
      return { graphId: 'G3', selector: 'economicState:E4' };
    case 'benefits_sozialamt':
      return { graphId: 'G6', selector: 'economicState:E5' };
    case 'application_pending':
      return { graphId: 'G1', variant: 'B', selector: 'economicState:E6' };
    case 'financial_crisis':
      return { graphId: 'G5', selector: 'economicState:E7' };
    default: {
      const exhaustive: never = state;
      throw new Error(`Unknown economic state: ${exhaustive}`);
    }
  }
}

export type SupportRefinementResult = {
  graphId: EconomicGraphId;
  trace: string;
};

export function applySupportRefinement(input: {
  state: EconomicStateId;
  supportSystem: EconomicSupportSystemId;
  institutionAxis: InstitutionAxis;
  primary: PrimaryGraphResolution;
}): SupportRefinementResult | null {
  const { state, supportSystem, institutionAxis, primary } = input;

  if (state === 'financial_crisis' || state === 'benefits_sozialamt') {
    return null;
  }

  if (state === 'application_pending') {
    if (supportSystem === 'none') {
      return null;
    }
    if (institutionAxis === 'jobcenter') {
      return { graphId: 'G2', trace: 'SUPPORT_OVERRIDE:E6→jobcenter→G2' };
    }
    if (institutionAxis === 'sozialamt') {
      return { graphId: 'G6', trace: 'SUPPORT_OVERRIDE:E6→sozialamt→G6' };
    }
  }

  if (state === 'unemployment_transition' && supportSystem === 'jobcenter') {
    return { graphId: 'G2', trace: 'SUPPORT_OVERRIDE:E3→jobcenter→G2' };
  }

  if (supportSystem === 'sozialamt' && primary.graphId !== 'G6') {
    return { graphId: 'G6', trace: 'SUPPORT_OVERRIDE:sozialamt' };
  }

  return null;
}

export const FORBIDDEN_GRAPH_TRANSITIONS: ReadonlyArray<{
  state: EconomicStateId;
  graphId: EconomicGraphId;
}> = [
  { state: 'benefits_sozialamt', graphId: 'G3' },
  { state: 'financial_crisis', graphId: 'G3' },
  { state: 'self_sustained', graphId: 'G5' },
];

export function isForbiddenGraphTransition(
  state: EconomicStateId,
  graphId: EconomicGraphId
): boolean {
  return FORBIDDEN_GRAPH_TRANSITIONS.some(
    (entry) => entry.state === state && entry.graphId === graphId
  );
}
