'use client';

import { useEffect, useMemo, useState } from 'react';
import { computeModuleProgressUI } from './module-progress';
import { useGalaxyProgressContext } from './GalaxyProgressProvider';
import type { SpatialGraphNode } from './types';

export { GalaxyProgressProvider, useGalaxyProgressContext, useGalaxyProgressState } from './GalaxyProgressProvider';

export function useGalaxyProgressReporter(input: {
  graphNodes: SpatialGraphNode[];
  selectedNodeId: string | null;
}) {
  const { setProgress } = useGalaxyProgressContext();
  const [visitedNodeIds, setVisitedNodeIds] = useState<Set<string>>(() => new Set());
  const [interactionStarted, setInteractionStarted] = useState(false);

  useEffect(() => {
    setInteractionStarted(true);
  }, []);

  useEffect(() => {
    if (!input.selectedNodeId || input.selectedNodeId === '__journey__') {
      return;
    }

    setVisitedNodeIds((previous) => {
      if (previous.has(input.selectedNodeId!)) {
        return previous;
      }
      const next = new Set(previous);
      next.add(input.selectedNodeId!);
      return next;
    });
  }, [input.selectedNodeId]);

  const state = useMemo(
    () => computeModuleProgressUI(input.graphNodes, visitedNodeIds, interactionStarted),
    [input.graphNodes, visitedNodeIds, interactionStarted]
  );

  useEffect(() => {
    if (input.graphNodes.length === 0) {
      setProgress(null);
      return;
    }

    setProgress(state);
  }, [input.graphNodes.length, setProgress, state]);

  useEffect(
    () => () => {
      setProgress(null);
    },
    [setProgress]
  );
}
