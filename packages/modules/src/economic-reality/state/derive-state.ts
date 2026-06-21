import type { EconomicStateId } from '@arrival-atlas/product-contract';
import { evaluate } from '../rule-engine/evaluate.js';

export function deriveEconomicState(context: Parameters<typeof evaluate>[0]): EconomicStateId {
  return evaluate(context).economicState;
}
