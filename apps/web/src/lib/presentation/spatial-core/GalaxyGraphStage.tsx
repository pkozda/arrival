'use client';

import { memo, useCallback, useContext, useMemo, useState } from 'react';
import {
  assignDependencyEdgeCurvatureOffsets,
  buildIncomingDependencyMap,
  getUnsatisfiedDependencySources,
  isDependencyEdgeSatisfied,
  JOURNEY_NODE_ID,
} from './galaxy-dependencies';
import { GALAXY_CENTER, GALAXY_ORBIT_RADII, galaxyEdgePath } from './galaxy-layout';
import { GalaxyNodeRenderer } from './GalaxyNodeRenderer';
import { GalaxyProgressContext } from './GalaxyProgressProvider';
import type { GalaxyGraphModel } from './useGalaxyGraphModel';
import type { GalaxyEdgeVisualState, GalaxyNodeVisualState, SpatialGraphEdge } from './types';
import type { ReactNode } from 'react';

type NodeContent<TPayload> = (node: GalaxyGraphModel<TPayload>['graphNodes'][number]) => {
  title: ReactNode;
  descriptor?: ReactNode;
  disabled?: boolean;
};

type Props<TPayload> = {
  model: GalaxyGraphModel<TPayload>;
  primaryNodeId?: string | null;
  renderNode: NodeContent<TPayload>;
};

function GalaxyGraphStageComponent<TPayload>({ model, primaryNodeId = null, renderNode }: Props<TPayload>) {
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const {
    graphNodes,
    graphEdges,
    graphNodeById,
    neighborsByNode,
    lockedNodeIds,
    selectedNodeId,
    setSelectedNodeId,
    isRebalancing,
    onGraphKeyDown,
  } = model;

  const progressState = useContext(GalaxyProgressContext)?.progress;
  const nodeStarsById = progressState?.nodeStarsById ?? {};

  const incomingDependencyMap = useMemo(() => buildIncomingDependencyMap(graphEdges), [graphEdges]);
  const dependencyCurvatureOffsets = useMemo(
    () => assignDependencyEdgeCurvatureOffsets(graphEdges),
    [graphEdges]
  );

  const nodeContentById = useMemo(() => {
    const map = new Map<string, ReturnType<NodeContent<TPayload>>>();
    for (const graphNode of graphNodes) {
      map.set(graphNode.id, renderNode(graphNode));
    }
    return map;
  }, [graphNodes, renderNode]);

  const lockHintById = useMemo(() => {
    const hints = new Map<string, string>();
    lockedNodeIds.forEach((nodeId) => {
      const unsatisfied = getUnsatisfiedDependencySources(nodeId, incomingDependencyMap, graphNodeById);
      if (unsatisfied.length === 0) {
        return;
      }
      const labels = unsatisfied.map((sourceId) => {
        const content = nodeContentById.get(sourceId);
        if (typeof content?.title === 'string') {
          return content.title;
        }
        return sourceId;
      });
      hints.set(nodeId, `Requires: ${labels.join(', ')} completed`);
    });
    return hints;
  }, [graphNodeById, incomingDependencyMap, lockedNodeIds, nodeContentById]);

  const highlightNodeId = hoveredNodeId ?? selectedNodeId;
  const highlightedNeighbors = highlightNodeId
    ? neighborsByNode.get(highlightNodeId) ?? new Set<string>()
    : new Set<string>();

  const hoveredLockedSources = useMemo(() => {
    if (!hoveredNodeId || !lockedNodeIds.has(hoveredNodeId)) {
      return new Set<string>();
    }
    return new Set(getUnsatisfiedDependencySources(hoveredNodeId, incomingDependencyMap, graphNodeById));
  }, [graphNodeById, hoveredNodeId, incomingDependencyMap, lockedNodeIds]);

  const highlightedDependencyEdges = useMemo(() => {
    if (!highlightNodeId) {
      return new Set<string>();
    }
    const edgeIds = new Set<string>();
    graphEdges.forEach((edge) => {
      if (edge.type !== 'dependency') {
        return;
      }
      if (edge.from === highlightNodeId || edge.to === highlightNodeId) {
        edgeIds.add(edge.id);
      }
      if (hoveredLockedSources.has(edge.from) && edge.to === hoveredNodeId) {
        edgeIds.add(edge.id);
      }
    });
    return edgeIds;
  }, [graphEdges, highlightNodeId, hoveredLockedSources, hoveredNodeId]);

  const selectedOneHop = selectedNodeId
    ? neighborsByNode.get(selectedNodeId) ?? new Set<string>()
    : new Set<string>();

  const selectedTwoHop = useMemo(() => {
    if (!selectedNodeId) return new Set<string>();
    const twoHop = new Set<string>();
    selectedOneHop.forEach((nodeId) => {
      const neighbors = neighborsByNode.get(nodeId) ?? new Set<string>();
      neighbors.forEach((targetId) => {
        if (targetId !== selectedNodeId && !selectedOneHop.has(targetId)) {
          twoHop.add(targetId);
        }
      });
    });
    return twoHop;
  }, [neighborsByNode, selectedNodeId, selectedOneHop]);

  const constrainedDownstreamNodes = useMemo(
    () =>
      new Set(
        graphEdges
          .filter(
            (edge) =>
              edge.type === 'dependency' &&
              (edge.from === highlightNodeId || edge.to === highlightNodeId)
          )
          .map((edge) => edge.to)
      ),
    [graphEdges, highlightNodeId]
  );

  const getNodeVisualState = (nodeId: string): GalaxyNodeVisualState => {
    const isJourneyNode = nodeId === JOURNEY_NODE_ID;
    const isSelected = nodeId === selectedNodeId;
    const isNeighbor = highlightedNeighbors.has(nodeId);
    const isHovered = hoveredNodeId === nodeId;
    const isLocked = lockedNodeIds.has(nodeId);
    const isDependencySourceHighlight = hoveredLockedSources.has(nodeId);

    return {
      isJourneyNode,
      isSelected,
      isNeighbor,
      isHovered,
      isLocked,
      isDependencySourceHighlight,
      isDimmed:
        !isJourneyNode &&
        highlightNodeId != null &&
        !isSelected &&
        highlightNodeId !== nodeId &&
        !isNeighbor &&
        !isDependencySourceHighlight,
      isConstrainedDownstream:
        !isJourneyNode &&
        highlightNodeId != null &&
        constrainedDownstreamNodes.has(nodeId) &&
        nodeId !== highlightNodeId,
      isOneHopActive: selectedNodeId != null && selectedOneHop.has(nodeId),
      isTwoHopDim: !isJourneyNode && selectedNodeId != null && selectedTwoHop.has(nodeId),
      isPrimaryRecommended: nodeId === primaryNodeId && graphNodeById.get(nodeId)?.status === 'recommended',
    };
  };

  const getEdgeVisualState = (edge: SpatialGraphEdge): GalaxyEdgeVisualState => {
    const isDependency = edge.type === 'dependency';
    const isSatisfied = isDependencyEdgeSatisfied(edge, graphNodeById);
    const isLocked = isDependency && !isSatisfied;
    const isFlowHighlighted = highlightedDependencyEdges.has(edge.id);
    const isHighlighted =
      isFlowHighlighted ||
      (highlightNodeId != null &&
        (edge.from === highlightNodeId ||
          edge.to === highlightNodeId ||
          (highlightedNeighbors.has(edge.from) && highlightedNeighbors.has(edge.to))));

    return {
      isHighlighted,
      isCausalUnlock: isHighlighted && edge.type === 'unlock',
      isCausalDependency: isHighlighted && isDependency,
      isSelectionContext:
        selectedNodeId != null &&
        (edge.from === selectedNodeId ||
          edge.to === selectedNodeId ||
          (selectedOneHop.has(edge.from) && selectedOneHop.has(edge.to))),
      isPrimaryPulse:
        edge.type === 'unlock' &&
        primaryNodeId != null &&
        selectedNodeId === primaryNodeId &&
        edge.from === selectedNodeId,
      isSatisfied,
      isLocked,
      isFlowHighlighted,
      isDimmed:
        highlightNodeId != null &&
        !isHighlighted &&
        !isFlowHighlighted &&
        isDependency,
    };
  };

  const setHoveredNode = useCallback((nodeId: string | null) => {
    setHoveredNodeId(nodeId === JOURNEY_NODE_ID ? null : nodeId);
  }, []);

  return (
    <div
      className={`le-galaxy-viewport__stage${isRebalancing ? ' is-rebalancing' : ''}`}
      role="listbox"
      aria-label="Consequence graph nodes"
      tabIndex={0}
      onKeyDown={onGraphKeyDown}
    >
      <svg
        className="le-galaxy-viewport__orbits"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {GALAXY_ORBIT_RADII.map((ring, index) => (
          <ellipse
            key={ring.rx}
            cx={GALAXY_CENTER.x}
            cy={GALAXY_CENTER.y}
            rx={ring.rx}
            ry={ring.ry}
            className={`le-galaxy-orbit${index === GALAXY_ORBIT_RADII.length - 1 ? ' le-galaxy-orbit--outer' : ''}`}
          />
        ))}
      </svg>

      <svg className="le-consequence-map__edges" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <marker
            id="galaxy-dep-arrow-active"
            viewBox="0 0 10 10"
            refX="8.5"
            refY="5"
            markerWidth="4"
            markerHeight="4"
            orient="auto"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(120, 140, 255, 0.75)" />
          </marker>
          <marker
            id="galaxy-dep-arrow-locked"
            viewBox="0 0 10 10"
            refX="8.5"
            refY="5"
            markerWidth="4"
            markerHeight="4"
            orient="auto"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(140, 140, 140, 0.45)" />
          </marker>
          <marker
            id="galaxy-dep-arrow-flow"
            viewBox="0 0 10 10"
            refX="8.5"
            refY="5"
            markerWidth="4.5"
            markerHeight="4.5"
            orient="auto"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(150, 170, 255, 0.95)" />
          </marker>
        </defs>

        {graphEdges.map((edge) => {
          const from = graphNodeById.get(edge.from);
          const to = graphNodeById.get(edge.to);
          if (!from || !to) return null;

          const visual = getEdgeVisualState(edge);
          const curvatureOffset = dependencyCurvatureOffsets.get(edge.id) ?? 0;
          const markerEnd =
            edge.type === 'dependency'
              ? visual.isFlowHighlighted
                ? 'url(#galaxy-dep-arrow-flow)'
                : visual.isLocked
                  ? 'url(#galaxy-dep-arrow-locked)'
                  : 'url(#galaxy-dep-arrow-active)'
              : undefined;

          return (
            <path
              key={edge.id}
              d={galaxyEdgePath(from, to, curvatureOffset)}
              fill="none"
              markerEnd={markerEnd}
              className={`le-consequence-map__edge le-consequence-map__edge--${edge.type}${
                visual.isHighlighted ? ' is-highlighted' : ''
              }${visual.isCausalUnlock ? ' is-causal-unlock' : ''}${
                visual.isCausalDependency ? ' is-causal-dependency' : ''
              }${visual.isSelectionContext ? ' is-selection-context' : ''}${
                visual.isPrimaryPulse ? ' is-primary-pulse' : ''
              }${visual.isSatisfied ? ' is-satisfied' : ''}${
                visual.isLocked ? ' is-locked' : ''
              }${visual.isFlowHighlighted ? ' is-flow-highlighted' : ''}${
                visual.isDimmed ? ' is-dimmed' : ''
              }`}
            >
              <title>{edge.type === 'unlock' ? 'Unlock' : 'Dependency'}</title>
            </path>
          );
        })}
      </svg>

      {graphNodes.map((graphNode) => {
        const content = renderNode(graphNode);
        const visual = getNodeVisualState(graphNode.id);
        return (
          <GalaxyNodeRenderer
            key={graphNode.id}
            id={graphNode.id}
            status={graphNode.status}
            x={graphNode.x}
            y={graphNode.y}
            title={content.title}
            descriptor={content.descriptor}
            disabled={content.disabled}
            lockHint={lockHintById.get(graphNode.id)}
            nodeStars={nodeStarsById[graphNode.id] ?? 0}
            visual={visual}
            onHover={setHoveredNode}
            onSelect={setSelectedNodeId}
          />
        );
      })}
    </div>
  );
}

export const GalaxyGraphStage = memo(GalaxyGraphStageComponent) as typeof GalaxyGraphStageComponent;
