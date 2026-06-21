import type { EconomicActionSetV1 } from '@/lib/product-contract';

export type EconomicActionExecutionContext = {
  sessionId: string;
  deterministicHash: string;
  actionSet: EconomicActionSetV1;
};

let activeContext: EconomicActionExecutionContext | null = null;

export function bindEconomicActionContext(context: EconomicActionExecutionContext | null): void {
  activeContext = context;
}

export function readEconomicActionContext(): EconomicActionExecutionContext | null {
  return activeContext;
}

export function clearEconomicActionContext(): void {
  activeContext = null;
}
