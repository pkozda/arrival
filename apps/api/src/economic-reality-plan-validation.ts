import {
  EconomicRealityPlanResponseV1Schema,
  type EconomicRealityPlanResponseV1,
} from '@arrival-atlas/product-contract';
import { ZodError } from 'zod';

export class EconomicRealityPlanValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EconomicRealityPlanValidationError';
  }
}

export function validateEconomicRealityPlanResponse(
  response: unknown
): EconomicRealityPlanResponseV1 {
  try {
    return EconomicRealityPlanResponseV1Schema.parse(response);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new EconomicRealityPlanValidationError(error.message);
    }
    throw error;
  }
}
