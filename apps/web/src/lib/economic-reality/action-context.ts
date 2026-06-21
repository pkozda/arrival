import type { EconomicActionSetV1 } from '@/lib/product-contract';

export type EconomicActionExecutionContext = {
  sessionId: string;
  deterministicHash: string;
  actionSet: EconomicActionSetV1;
};

export const economicActionContextRef: {
  current: EconomicActionExecutionContext | null;
} = {
  current: null,
};

export function setEconomicActionContext(context: EconomicActionExecutionContext | null): void {
  economicActionContextRef.current = context;
}

export function readEconomicActionContext(): EconomicActionExecutionContext | null {
  return economicActionContextRef.current;
}

/** @deprecated Use setEconomicActionContext during render */
export function bindEconomicActionContext(context: EconomicActionExecutionContext | null): void {
  setEconomicActionContext(context);
}

/** @deprecated Use setEconomicActionContext(null) */
export function clearEconomicActionContext(): void {
  setEconomicActionContext(null);
}
