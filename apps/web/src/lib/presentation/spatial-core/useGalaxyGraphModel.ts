'use client';

import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import type { GalaxyInspectorSelection, SpatialGraphEdge, SpatialGraphNode } from './types';

const JOURNEY_NODE_ID = '__journey__';

type Input<TPayload> = {
  graphNodes: SpatialGraphNode<TPayload>[];
  graphEdges: SpatialGraphEdge[];
};

function buildNeighborMap(edges: SpatialGraphEdge[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  edges.forEach((edge) => {
    if (!map.has(edge.from)) map.set(edge.from, new Set());
    if (!map.has(edge.to)) map.set(edge.to, new Set());
    map.get(edge.from)?.add(edge.to);
    map.get(edge.to)?.add(edge.from);
  });
  return map;
}

export function useGalaxyGraphModel<TPayload>({ graphNodes, graphEdges }: Input<TPayload>) {
  const graphNodeById = useMemo(
    () => new Map(graphNodes.map((node) => [node.id, node])),
    [graphNodes]
  );

  const selectableNodeIds = useMemo(
    () => graphNodes.filter((node) => node.id !== JOURNEY_NODE_ID).map((node) => node.id),
    [graphNodes]
  );

  const neighborsByNode = useMemo(() => buildNeighborMap(graphEdges), [graphEdges]);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(selectableNodeIds[0] ?? null);
  const [isRebalancing, setIsRebalancing] = useState(false);

  useEffect(() => {
    if (!selectedNodeId || !selectableNodeIds.includes(selectedNodeId)) {
      setSelectedNodeId(selectableNodeIds[0] ?? null);
    }
  }, [selectableNodeIds, selectedNodeId]);

  useEffect(() => {
    if (!selectedNodeId) return;
    setIsRebalancing(true);
    const timer = window.setTimeout(() => setIsRebalancing(false), 260);
    return () => window.clearTimeout(timer);
  }, [selectedNodeId]);

  const inspectorSelection = useMemo<GalaxyInspectorSelection<TPayload>>(() => {
    const selectedNode = selectedNodeId ? graphNodeById.get(selectedNodeId) ?? null : null;
    const unlocks = selectedNodeId
      ? graphEdges.filter((edge) => edge.from === selectedNodeId && edge.type === 'unlock')
      : [];
    const dependencies = selectedNodeId
      ? graphEdges.filter((edge) => edge.to === selectedNodeId && edge.type === 'dependency')
      : [];
    const dependencySources = new Set(dependencies.map((edge) => edge.from));

    return {
      selectedNodeId,
      selectedNode,
      unlocks,
      dependencies,
      dependencySources,
    };
  }, [graphEdges, graphNodeById, selectedNodeId]);

  const onGraphKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (selectableNodeIds.length === 0) return;
    const currentIndex = Math.max(0, selectableNodeIds.indexOf(selectedNodeId ?? selectableNodeIds[0]!));

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      setSelectedNodeId(selectableNodeIds[(currentIndex + 1) % selectableNodeIds.length] ?? null);
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      setSelectedNodeId(
        selectableNodeIds[(currentIndex - 1 + selectableNodeIds.length) % selectableNodeIds.length] ?? null
      );
    }
  };

  return {
    graphNodes,
    graphEdges,
    graphNodeById,
    neighborsByNode,
    selectableNodeIds,
    selectedNodeId,
    setSelectedNodeId,
    isRebalancing,
    inspectorSelection,
    onGraphKeyDown,
  };
}

export type GalaxyGraphModel<TPayload> = ReturnType<typeof useGalaxyGraphModel<TPayload>>;
