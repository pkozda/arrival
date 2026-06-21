import type { OpenModuleEntrypoint } from '@arrival-atlas/product-contract';
import {
  buildModuleCatalogRoute,
  listModuleCatalogEntries,
  resolveCatalogTriggerEntrypoint,
  resolveTriggeredModules,
  type ModuleCatalogEntryV1,
} from '@arrival-atlas/product-contract';

export type CrossModuleLinkSource =
  | { type: 'life_event_node'; nodeId: string }
  | { type: 'life_state'; lifeStateId: string }
  | { type: 'life_event_type'; eventType: string }
  | { type: 'economic_state'; stateCode: string }
  | { type: 'system_intent'; intent: string };

export type CrossModuleLinkTarget = {
  moduleId: string;
  entrypoint?: OpenModuleEntrypoint;
  route: string;
  source: CrossModuleLinkSource;
};

function toTarget(
  entry: ModuleCatalogEntryV1,
  source: CrossModuleLinkSource,
  entrypoint: OpenModuleEntrypoint
): CrossModuleLinkTarget {
  return {
    moduleId: entry.id,
    entrypoint,
    route: buildModuleCatalogRoute(entry, entrypoint),
    source,
  };
}

export function resolveCrossModuleLink(source: CrossModuleLinkSource): CrossModuleLinkTarget | null {
  switch (source.type) {
    case 'life_event_node': {
      const modules = resolveTriggeredModules({ lifeEventNodeId: source.nodeId });
      const entry = modules[0];
      if (!entry) {
        return null;
      }
      const entrypoint = resolveCatalogTriggerEntrypoint(entry, {
        lifeEventNodeId: source.nodeId,
      });
      return toTarget(entry, source, entrypoint);
    }
    case 'life_state': {
      const modules = resolveTriggeredModules({ lifeStateId: source.lifeStateId });
      const entry = modules[0];
      if (!entry) {
        return null;
      }
      return toTarget(entry, source, 'OVERVIEW');
    }
    case 'life_event_type': {
      const modules = resolveTriggeredModules({ lifeEventType: source.eventType });
      const entry = modules[0];
      if (!entry) {
        return null;
      }
      const entrypoint = resolveCatalogTriggerEntrypoint(entry, {
        lifeEventType: source.eventType,
      });
      return toTarget(entry, source, entrypoint);
    }
    case 'economic_state': {
      const modules = resolveTriggeredModules({
        economicStateCode: source.stateCode as never,
      });
      const entry = modules[0];
      if (!entry) {
        return null;
      }
      const entrypoint = resolveCatalogTriggerEntrypoint(entry, {
        economicStateCode: source.stateCode as never,
      });
      return toTarget(entry, source, entrypoint);
    }
    case 'system_intent': {
      const modules = resolveTriggeredModules({ systemIntents: [source.intent] });
      const entry = modules[0];
      if (!entry) {
        return null;
      }
      return toTarget(entry, source, 'OVERVIEW');
    }
    default:
      return null;
  }
}

export function resolveSystemIntentModuleOpenAction(intent: string): CrossModuleLinkTarget | null {
  return resolveCrossModuleLink({ type: 'system_intent', intent });
}

export function suggestModulesForLifeContext(input: {
  lifeStateId?: string;
  lifeEventType?: string;
  nodeIds?: string[];
}): CrossModuleLinkTarget[] {
  const targets = new Map<string, CrossModuleLinkTarget>();

  if (input.lifeStateId) {
    const target = resolveCrossModuleLink({ type: 'life_state', lifeStateId: input.lifeStateId });
    if (target) {
      targets.set(target.moduleId, target);
    }
  }

  if (input.lifeEventType) {
    const target = resolveCrossModuleLink({ type: 'life_event_type', eventType: input.lifeEventType });
    if (target) {
      targets.set(target.moduleId, target);
    }
  }

  for (const nodeId of input.nodeIds ?? []) {
    const target = resolveCrossModuleLink({ type: 'life_event_node', nodeId });
    if (target) {
      targets.set(target.moduleId, target);
    }
  }

  return [...targets.values()];
}

export function listCatalogBackedModuleRoutes(): ModuleCatalogEntryV1[] {
  return listModuleCatalogEntries();
}
