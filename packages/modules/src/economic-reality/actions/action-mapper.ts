import type {
  EconomicActionV1,
  EconomicGraphId,
  NodeStateV1,
} from '@arrival-atlas/product-contract';
import { lookupNodeActionTemplates } from './node-action-catalog.js';
import type { ActionTemplate } from './types.js';

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
  node: NodeStateV1
): EconomicActionV1[] {
  const templates = filterTemplatesForNodeState(node, lookupNodeActionTemplates(node.nodeId));
  return templates.map((template) => mapTemplateToAction({ graphId, node, template }));
}
