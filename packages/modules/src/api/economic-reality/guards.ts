import type { UserContextV1, EconomicFeedbackSignalsV1 } from '@arrival-atlas/product-contract';
import type { EconomicRealityPlanErrorCode } from '@arrival-atlas/product-contract';

export type PipelineMetaInput = {
  requestId: string;
  generatedAt: string;
  feedbackSignals?: EconomicFeedbackSignalsV1;
};

export class EconomicRealityPlanError extends Error {
  readonly code: EconomicRealityPlanErrorCode;

  constructor(code: EconomicRealityPlanErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = 'EconomicRealityPlanError';
    this.code = code;
    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}

export function assertValidEconomicUserContext(userContext: UserContextV1): void {
  if (!userContext?.profile) {
    throw new EconomicRealityPlanError(
      'ECONOMIC_CONTEXT_INVALID',
      'UserContext profile required for economic reality planning'
    );
  }

  if (!userContext.profile.domains) {
    throw new EconomicRealityPlanError(
      'ECONOMIC_CONTEXT_INVALID',
      'UserContext profile domains required for economic reality planning'
    );
  }
}
