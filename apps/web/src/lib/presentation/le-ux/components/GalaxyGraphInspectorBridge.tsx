'use client';

import { useMemo } from 'react';
import type { LifeEventPlanNode } from '@/lib/product-contract';
import { LifeEventPlanNodeActions } from '@/components/life-event/LifeEventPlanNodeActions';
import { useApp } from '@/components/AppProvider';
import type { ActionBreakdownSectionProps } from '@/lib/presentation/le-ux/types';
import { buildLifeEventGalaxyGraph } from '@/lib/presentation/le-ux/build-galaxy-graph';
import { GalaxyGraphStage, GalaxyInspectorShell, useGalaxyGraphModel, useGalaxyProgressReporter } from '@/lib/presentation/spatial-core';
import { lifeEventNodeDescription, lifeEventNodeTitle } from '@/lib/life-event/content-labels';

type GraphStatus = 'completed' | 'recommended' | 'blocked' | 'future' | 'core';

function truncateOutcome(text: string, max = 46): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

function stateDescriptor(node: LifeEventPlanNode | null, status: GraphStatus): string {
  if (!node) {
    return 'Current state';
  }

  const id = node.id.toLowerCase();
  if (id.includes('tax')) return 'System entry point';
  if (id.includes('employment') || id.includes('work')) return 'Active state';
  if (id.includes('insurance') || id.includes('health')) return 'Coverage state';
  if (id.includes('registration') || id.includes('residence')) return 'Dependency node';
  if (id.includes('language')) return 'Readiness state';
  if (id.includes('bank') || id.includes('finance')) return 'Financial state';
  if (status === 'blocked') return 'Blocked state';
  if (status === 'future') return 'Future state';
  if (status === 'completed') return 'Verified state';
  return 'Transition state';
}

function toStateFraming(text: string): string {
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();
  const replacements: Array<[string, string]> = [
    ['complete ', ''],
    ['submit ', ''],
    ['apply for ', ''],
    ['open ', ''],
    ['start ', ''],
    ['review ', ''],
    ['update ', ''],
    ['fix ', ''],
  ];
  for (const [from, to] of replacements) {
    if (lower.startsWith(from)) {
      const normalized = `${to}${trimmed.slice(from.length)}`.trim();
      return normalized.length > 0 ? normalized : trimmed;
    }
  }
  return trimmed;
}

type Props = Omit<ActionBreakdownSectionProps, 'variant' | 'contextualDefaultOpen'>;

export function GalaxyGraphInspectorBridge({
  plan,
  primaryAction,
  secondaryActions,
  blockedActions,
  contextualActions,
  isNodeDisabled,
}: Props) {
  const { t } = useApp();

  const nodesById = useMemo(() => {
    const map = new Map<string, LifeEventPlanNode>();
    const put = (node: LifeEventPlanNode | null) => {
      if (node && !map.has(node.id)) {
        map.set(node.id, node);
      }
    };

    put(primaryAction);
    blockedActions.forEach(put);
    secondaryActions.forEach(put);
    contextualActions.forEach(put);
    plan.timeline.forEach(put);
    return map;
  }, [blockedActions, contextualActions, plan.timeline, primaryAction, secondaryActions]);

  const completedNodes = useMemo(() => {
    const reserved = new Set<string>([
      primaryAction?.id ?? '',
      ...blockedActions.map((node) => node.id),
      ...secondaryActions.map((node) => node.id),
      ...contextualActions.map((node) => node.id),
    ]);

    return plan.timeline
      .filter((node) => node.satisfied && !reserved.has(node.id))
      .slice(0, 4);
  }, [blockedActions, contextualActions, plan.timeline, primaryAction, secondaryActions]);

  const { graphNodes, graphEdges } = useMemo(
    () =>
      buildLifeEventGalaxyGraph({
        primaryAction,
        blockedActions,
        completedNodes,
        secondaryActions,
        contextualActions: contextualActions.slice(0, 4),
      }),
    [blockedActions, completedNodes, contextualActions, primaryAction, secondaryActions]
  );

  const model = useGalaxyGraphModel({
    graphNodes,
    graphEdges,
  });

  const selectedNodeRef = model.inspectorSelection.selectedNode?.payload ?? null;
  const recommendedHints = secondaryActions
    .filter((node) => node.id !== selectedNodeRef?.id)
    .slice(0, 3);

  useGalaxyProgressReporter({
    graphNodes: model.graphNodes,
    selectedNodeId: model.selectedNodeId,
  });

  return (
    <>
      <GalaxyGraphStage
        model={model}
        primaryNodeId={primaryAction?.id ?? null}
        renderNode={(graphNode) => {
          const node = graphNode.payload;
          const title =
            graphNode.id === '__journey__'
              ? 'Your Journey'
              : node
                ? lifeEventNodeTitle(t, node)
                : t('life-event.plan.recommendedFocus');

          return {
            title,
            descriptor:
              graphNode.id === '__journey__'
                ? 'Current state'
                : stateDescriptor(node, graphNode.status as GraphStatus),
            disabled: graphNode.id === '__journey__',
          };
        }}
      />

      <GalaxyInspectorShell>
        <h3 className="le-consequence-inspector__title">
          {selectedNodeRef ? lifeEventNodeTitle(t, selectedNodeRef) : 'Node Inspector'}
        </h3>
        {selectedNodeRef && (
          <p className="le-consequence-inspector__status">
            {selectedNodeRef.satisfied
              ? 'Completed'
              : selectedNodeRef.blocked
                ? 'Blocked'
                : selectedNodeRef.id === primaryAction?.id
                  ? 'Recommended now'
                  : 'Future'}
          </p>
        )}
        {selectedNodeRef && model.inspectorSelection.dependencySources.size > 0 && (
          <p className="le-consequence-inspector__requires">
            Requires:{' '}
            {Array.from(model.inspectorSelection.dependencySources)
              .map((nodeId) => lifeEventNodeTitle(t, nodesById.get(nodeId) ?? { id: nodeId, title: nodeId }))
              .join(', ')}
          </p>
        )}

        <div className="le-consequence-inspector__section">
          <h4>Context</h4>
          <p className="le-consequence-inspector__why">
            {selectedNodeRef ? lifeEventNodeDescription(t, selectedNodeRef) : 'Select a state node.'}
          </p>
        </div>

        <div className="le-consequence-inspector__section">
          <h4>Unlocks</h4>
          {model.inspectorSelection.unlocks.length === 0 ? (
            <p className="text-caption">No direct unlocks.</p>
          ) : (
            <div className="le-consequence-inspector__items">
              {model.inspectorSelection.unlocks.map((edge) => {
                const unlockNode = nodesById.get(edge.to) ?? null;
                const outcomeHint = unlockNode
                  ? truncateOutcome(
                      toStateFraming(unlockNode.actions[0]?.label ?? lifeEventNodeDescription(t, unlockNode))
                    )
                  : '';
                return (
                  <div key={edge.id} className="le-consequence-inspector__item">
                    <p className="le-consequence-inspector__item-title">
                      {selectedNodeRef
                        ? `${toStateFraming(lifeEventNodeTitle(t, selectedNodeRef))} → ${toStateFraming(
                            lifeEventNodeTitle(t, unlockNode ?? { id: edge.to, title: edge.to })
                          )}`
                        : toStateFraming(lifeEventNodeTitle(t, unlockNode ?? { id: edge.to, title: edge.to }))}
                    </p>
                    {outcomeHint && <span className="le-consequence-inspector__outcome">Outcome: {outcomeHint}</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="le-consequence-inspector__section">
          <h4>Blocked</h4>
          {model.inspectorSelection.dependencies.length === 0 ? (
            <p className="text-caption">No direct constraints.</p>
          ) : (
            <div className="le-consequence-inspector__items">
              {model.inspectorSelection.dependencies.map((edge) => (
                <div key={edge.id} className="le-consequence-inspector__item">
                  <p className="le-consequence-inspector__item-title">
                    {selectedNodeRef
                      ? `${toStateFraming(lifeEventNodeTitle(t, selectedNodeRef))} blocked until ${toStateFraming(
                          lifeEventNodeTitle(t, nodesById.get(edge.from) ?? { id: edge.from, title: edge.from })
                        )}`
                      : toStateFraming(
                          lifeEventNodeTitle(t, nodesById.get(edge.from) ?? { id: edge.from, title: edge.from })
                        )}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {selectedNodeRef && (
          <div className="le-consequence-inspector__section">
            <h4>Actions</h4>
            <LifeEventPlanNodeActions
              actions={selectedNodeRef.actions}
              disabled={isNodeDisabled(selectedNodeRef.id, selectedNodeRef.blocked)}
            />
          </div>
        )}

        {recommendedHints.length > 0 && (
          <div className="le-consequence-inspector__section">
            <h4>Recommendations</h4>
            <div className="le-consequence-inspector__items">
              {recommendedHints.map((node) => (
                <div key={node.id} className="le-consequence-inspector__item">
                  <p className="le-consequence-inspector__item-title">
                    {toStateFraming(lifeEventNodeTitle(t, node))}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </GalaxyInspectorShell>
    </>
  );
}
