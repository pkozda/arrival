'use client';

import { memo, useCallback, useMemo, useState } from 'react';
import { GALAXY_CENTER, GALAXY_ORBIT_RADII, galaxyEdgePath } from './galaxy-layout';
import { GalaxyNodeRenderer } from './GalaxyNodeRenderer';
import type { GalaxyGraphModel } from './useGalaxyGraphModel';
import type { GalaxyNodeVisualState, SpatialGraphEdge } from './types';
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

const JOURNEY_NODE_ID = '__journey__';

function GalaxyGraphStageComponent<TPayload>({ model, primaryNodeId = null, renderNode }: Props<TPayload>) {
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const {
    graphNodes,
    graphEdges,
    graphNodeById,
    neighborsByNode,
    selectedNodeId,
    setSelectedNodeId,
    isRebalancing,
    onGraphKeyDown,
  } = model;

  const highlightNodeId = hoveredNodeId ?? selectedNodeId;
  const highlightedNeighbors = highlightNodeId
    ? neighborsByNode.get(highlightNodeId) ?? new Set<string>()
    : new Set<string>();
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

    return {
      isJourneyNode,
      isSelected,
      isNeighbor,
      isHovered,
      isDimmed:
        !isJourneyNode &&
        highlightNodeId != null &&
        !isSelected &&
        highlightNodeId !== nodeId &&
        !isNeighbor,
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

  const getEdgeVisualState = (edge: SpatialGraphEdge) => {
    const isHighlighted =
      highlightNodeId != null &&
      (edge.from === highlightNodeId ||
        edge.to === highlightNodeId ||
        (highlightedNeighbors.has(edge.from) && highlightedNeighbors.has(edge.to)));

    return {
      isHighlighted,
      isCausalUnlock: isHighlighted && edge.type === 'unlock',
      isCausalDependency: isHighlighted && edge.type === 'dependency',
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
        {graphEdges.map((edge) => {
          const from = graphNodeById.get(edge.from);
          const to = graphNodeById.get(edge.to);
          if (!from || !to) return null;

          const visual = getEdgeVisualState(edge);

          return (
            <path
              key={edge.id}
              d={galaxyEdgePath(from, to)}
              fill="none"
              className={`le-consequence-map__edge le-consequence-map__edge--${edge.type}${
                visual.isHighlighted ? ' is-highlighted' : ''
              }${visual.isCausalUnlock ? ' is-causal-unlock' : ''}${
                visual.isCausalDependency ? ' is-causal-dependency' : ''
              }${visual.isSelectionContext ? ' is-selection-context' : ''}${
                visual.isPrimaryPulse ? ' is-primary-pulse' : ''
              }`}
            >
              <title>{edge.type === 'unlock' ? 'Unlock' : 'Dependency'}</title>
            </path>
          );
        })}
      </svg>

      {graphNodes.map((graphNode) => {
        const content = renderNode(graphNode);
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
            visual={getNodeVisualState(graphNode.id)}
            onHover={setHoveredNode}
            onSelect={setSelectedNodeId}
          />
        );
      })}
    </div>
  );
}

export const GalaxyGraphStage = memo(GalaxyGraphStageComponent) as typeof GalaxyGraphStageComponent;
