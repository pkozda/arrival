import type { EconomicActionV1, EconomicRealityEventV1 } from '@arrival-atlas/product-contract';
import { ECONOMIC_REALITY_EVENT_SCHEMA_VERSION } from '@arrival-atlas/product-contract';

export function buildEconomicRealityEventFromAction(input: {
  action: EconomicActionV1;
  contextHash: string;
  timestamp: number;
  type?: EconomicRealityEventV1['type'];
}): EconomicRealityEventV1 {
  const eventType =
    input.type ??
    (input.action.type === 'system_intent' ? 'INTENT_TRIGGERED' : 'ACTION_EXECUTED');

  return {
    schemaVersion: ECONOMIC_REALITY_EVENT_SCHEMA_VERSION,
    type: eventType,
    actionId: input.action.id,
    moduleId: input.action.payload.moduleId ?? 'economic-reality',
    actionType: input.action.type,
    profileKey: input.action.payload.profileKey,
    systemIntent: input.action.payload.systemIntent,
    contextHash: input.contextHash,
    timestamp: input.timestamp,
  };
}

export function buildEconomicRealityModuleEnteredEvent(input: {
  contextHash: string;
  timestamp: number;
}): EconomicRealityEventV1 {
  return {
    schemaVersion: ECONOMIC_REALITY_EVENT_SCHEMA_VERSION,
    type: 'MODULE_ENTERED',
    moduleId: 'economic-reality',
    contextHash: input.contextHash,
    timestamp: input.timestamp,
  };
}
