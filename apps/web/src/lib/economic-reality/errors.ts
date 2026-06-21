import type { EconomicRealityPlanErrorCode } from '@/lib/product-contract';

export type EconomicRealityClientErrorCode = EconomicRealityPlanErrorCode | 'FETCH_FAILED';

const ECONOMIC_REALITY_PLAN_ERROR_CODES = new Set<string>([
  'ECONOMIC_CONTEXT_INVALID',
  'GRAPH_RESOLUTION_FAILED',
  'EXECUTION_BUILD_FAILED',
  'ACTION_SET_EMPTY',
  'PLAN_BUILD_FAILED',
  'PRESENTATION_BUILD_FAILED',
]);

export function isEconomicRealityPlanErrorCode(
  value: string | undefined
): value is EconomicRealityPlanErrorCode {
  return value !== undefined && ECONOMIC_REALITY_PLAN_ERROR_CODES.has(value);
}

export class EconomicRealityPlanFetchError extends Error {
  readonly code: EconomicRealityClientErrorCode;

  constructor(message: string, code: EconomicRealityClientErrorCode) {
    super(message);
    this.name = 'EconomicRealityPlanFetchError';
    this.code = code;
  }
}
