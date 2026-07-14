import type { LifeEventPlanNode } from '@/lib/product-contract';
import type {
  CertaintyExpectedOutcome,
  CertaintyLevel,
  CertaintyReason,
  CertaintyState,
} from '../types';

type BuildLifeEventCertaintyInput = {
  selectedNode: LifeEventPlanNode | null;
  primaryAction: LifeEventPlanNode | null;
  timeline: LifeEventPlanNode[];
  dependencyNodeIds: string[];
  titleForNode: (node: LifeEventPlanNode | { id: string; title: string }) => string;
  descriptionForNode: (node: LifeEventPlanNode) => string;
};

function resolveActionLabel(node: LifeEventPlanNode, titleForNode: BuildLifeEventCertaintyInput['titleForNode']): string {
  const label = node.actions[0]?.label ?? titleForNode(node);
  return label.trim();
}

function resolveConfidence(node: LifeEventPlanNode | null, primary: LifeEventPlanNode | null): CertaintyLevel {
  if (!node && !primary) {
    return 'unknown';
  }

  const focus = node ?? primary;
  if (!focus) {
    return 'unknown';
  }

  if (focus.blocked) {
    return 'blocked';
  }

  if (focus.satisfied) {
    return 'clear';
  }

  if (primary && focus.id === primary.id) {
    return 'needs_attention';
  }

  return 'clear';
}

function reasonFromDescription(node: LifeEventPlanNode, titleForNode: BuildLifeEventCertaintyInput['titleForNode'], descriptionForNode: BuildLifeEventCertaintyInput['descriptionForNode']): CertaintyReason {
  const description = descriptionForNode(node).trim();

  if (description.length > 0) {
    return { type: 'description', description };
  }

  return { type: 'progress', target: titleForNode(node) };
}

export function buildLifeEventInspectorCertaintyState(
  input: BuildLifeEventCertaintyInput
): CertaintyState {
  const { selectedNode, primaryAction, timeline, dependencyNodeIds, titleForNode, descriptionForNode } =
    input;

  const focusNode = selectedNode ?? primaryAction;
  const focusTitle = focusNode
    ? titleForNode(focusNode)
    : 'Your life plan in Germany';

  const satisfiedCount = timeline.filter((node) => node.satisfied).length;
  const totalCount = timeline.length;

  let nextActionLabel: string | undefined;
  let nextActionReason: CertaintyReason | undefined;
  let expectedOutcome: CertaintyExpectedOutcome | undefined;

  if (selectedNode?.blocked && dependencyNodeIds.length > 0) {
    const prerequisiteId = dependencyNodeIds[0]!;
    const prerequisite = timeline.find((node) => node.id === prerequisiteId) ?? {
      id: prerequisiteId,
      title: prerequisiteId,
    };
    const prerequisiteTitle = titleForNode(prerequisite);
    const blockedTitle = titleForNode(selectedNode);

    nextActionLabel = prerequisiteTitle;
    nextActionReason = {
      type: 'dependency',
      prerequisite: prerequisiteTitle,
      target: blockedTitle,
    };
    expectedOutcome = {
      type: 'unlock',
      target: blockedTitle,
    };
  } else if (primaryAction && !primaryAction.satisfied) {
    nextActionLabel = resolveActionLabel(primaryAction, titleForNode);
    nextActionReason = reasonFromDescription(primaryAction, titleForNode, descriptionForNode);

    const unlockHint = timeline.find(
      (node) => !node.satisfied && node.id !== primaryAction.id && !node.blocked
    );
    if (unlockHint) {
      expectedOutcome = {
        type: 'openPath',
        target: titleForNode(unlockHint),
      };
    }
  } else if (focusNode && !focusNode.satisfied && focusNode.actions[0]) {
    nextActionLabel = resolveActionLabel(focusNode, titleForNode);
    nextActionReason = reasonFromDescription(focusNode, titleForNode, descriptionForNode);
  }

  const confidence = resolveConfidence(selectedNode, primaryAction);

  return {
    location: 'Life Events',
    title: focusTitle,
    nextAction:
      nextActionLabel && nextActionReason
        ? {
            label: nextActionLabel,
            reason: nextActionReason,
            expectedOutcome,
          }
        : undefined,
    progress:
      totalCount > 0
        ? {
            completed: satisfiedCount,
            total: totalCount,
          }
        : undefined,
    confidence,
  };
}

function resolveRecommendedNodeId(
  input: BuildLifeEventCertaintyInput,
  state: CertaintyState
): string | null {
  const { selectedNode, primaryAction, dependencyNodeIds } = input;

  if (!state.nextAction) {
    return null;
  }

  if (selectedNode?.blocked && dependencyNodeIds.length > 0) {
    return dependencyNodeIds[0]!;
  }

  if (primaryAction && !primaryAction.satisfied) {
    if (selectedNode && !selectedNode.satisfied && selectedNode.actions[0]) {
      return selectedNode.id;
    }
    return primaryAction.id;
  }

  if (selectedNode && !selectedNode.satisfied && selectedNode.actions[0]) {
    return selectedNode.id;
  }

  return primaryAction?.id ?? selectedNode?.id ?? null;
}

export type LifeEventCertaintyBundle = {
  state: CertaintyState;
  recommendedNodeId: string | null;
};

export function buildLifeEventCertaintyBundle(
  input: BuildLifeEventCertaintyInput
): LifeEventCertaintyBundle {
  const state = buildLifeEventInspectorCertaintyState(input);

  return {
    state,
    recommendedNodeId: resolveRecommendedNodeId(input, state),
  };
}
