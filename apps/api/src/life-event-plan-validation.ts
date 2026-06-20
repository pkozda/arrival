import {
  LifeStateIdSchema,
  parseLifeEventPlanV1,
  type LifeEventPlanV1,
} from '@arrival-atlas/product-contract';

export class LifeEventPlanValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LifeEventPlanValidationError';
  }
}

export function validateLifeEventPlanResponse(plan: unknown): LifeEventPlanV1 {
  const parsed = parseLifeEventPlanV1(plan);

  LifeStateIdSchema.parse(parsed.currentLifeState);

  if (!parsed.currentFocus) {
    throw new LifeEventPlanValidationError('currentFocus is required');
  }

  if (!Array.isArray(parsed.nextBestActions) || parsed.nextBestActions.length > 5) {
    throw new LifeEventPlanValidationError('nextBestActions must contain at most 5 items');
  }

  if (!Array.isArray(parsed.reasoning.whyThisNow) || parsed.reasoning.whyThisNow.length === 0) {
    throw new LifeEventPlanValidationError('reasoning.whyThisNow must not be empty');
  }

  if (!Array.isArray(parsed.reasoning.whatIsBlocking)) {
    throw new LifeEventPlanValidationError('reasoning.whatIsBlocking must be an array');
  }

  if (!parsed.reasoning.planConfidence) {
    throw new LifeEventPlanValidationError('reasoning.planConfidence is required');
  }

  return parsed;
}
