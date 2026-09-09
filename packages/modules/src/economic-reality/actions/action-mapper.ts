import type {
  EconomicActionV1,
  EconomicGraphId,
  NodeStateV1,
} from '@arrival-atlas/product-contract';
import type { EconomicSatisfactionSnapshot } from '../execution/types.js';
import { lookupNodeActionTemplates } from './node-action-catalog.js';
import type { ActionTemplate } from './types.js';

/** Registration-gated nodes that previously always emitted housing CTAs (ER-LOOP-001). */
export const REGISTRATION_ACTION_NODE_IDS = new Set([
  'g2-registration',
  'g5-registration',
  'g6-arrival-proof',
]);

export function filterTemplatesForNodeState(
  node: NodeStateV1,
  templates: ActionTemplate[]
): ActionTemplate[] {
  if (node.status === 'locked' || node.status === 'skipped') {
    return [];
  }

  if (node.status === 'completed') {
    return templates.filter((template) => template.type === 'update_profile');
  }

  if (node.status === 'active' && node.blockedBy.length > 0) {
    return templates.filter((template) => template.type === 'system_intent');
  }

  return templates;
}

/**
 * Context-aware registration actions:
 * - no address → housing update only (not confirm)
 * - address present, unconfirmed → confirm Anmeldung (not another housing CTA)
 * - confirmed → neither housing nor confirm as unresolved CTAs
 */
export function filterRegistrationTemplates(
  nodeId: string,
  templates: ActionTemplate[],
  satisfaction: EconomicSatisfactionSnapshot
): ActionTemplate[] {
  if (!REGISTRATION_ACTION_NODE_IDS.has(nodeId)) {
    return templates;
  }

  return templates.filter((template) => {
    if (template.templateId === 'profile-housing') {
      return !satisfaction.registrable_address;
    }
    if (template.templateId === 'profile-confirm-registration') {
      return satisfaction.registrable_address && !satisfaction.registration_confirmed;
    }
    return true;
  });
}

export function mapTemplateToAction(input: {
  graphId: EconomicGraphId;
  node: NodeStateV1;
  template: ActionTemplate;
}): EconomicActionV1 {
  const { graphId, node, template } = input;
  const blockedByExecutionState = node.status === 'locked' || node.blockedBy.length > 0;

  return {
    id: `${node.nodeId}:${template.templateId}`,
    sourceNodeId: node.nodeId,
    labelKey: template.labelKey,
    type: template.type,
    payload: {
      ...template.payload,
      ...(template.payload.systemIntent
        ? { intentKey: template.payload.intentKey ?? template.labelKey }
        : {}),
    },
    constraints: {
      ...(blockedByExecutionState ? { blockedByExecutionState: true } : {}),
      ...(template.requiresConfirmation ? { requiresConfirmation: true } : {}),
    },
    origin: {
      graphId,
      nodeId: node.nodeId,
    },
  };
}

export function mapNodeToActions(
  graphId: EconomicGraphId,
  node: NodeStateV1,
  satisfaction: EconomicSatisfactionSnapshot
): EconomicActionV1[] {
  const stateFiltered = filterTemplatesForNodeState(node, lookupNodeActionTemplates(node.nodeId));
  const templates = filterRegistrationTemplates(node.nodeId, stateFiltered, satisfaction);
  return templates.map((template) => mapTemplateToAction({ graphId, node, template }));
}
