import type { OrderingStrategy, UiStrategy } from '@arrival-atlas/product-contract';
import { resolveUiStrategy } from './types.js';

export function resolvePresentationUiStrategy(orderingStrategy: OrderingStrategy): UiStrategy {
  return resolveUiStrategy(orderingStrategy);
}
