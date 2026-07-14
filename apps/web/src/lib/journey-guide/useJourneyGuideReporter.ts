'use client';

import { useEffect, useMemo } from 'react';
import { useOptionalJourneyGuideContext } from './JourneyGuideProvider';
import type { JourneyGuideCertaintySource, JourneyGuideGraphSnapshot } from './types';
import type { SpatialGraphEdge, SpatialGraphNode } from '@/lib/presentation/spatial-core';

type Input = {
  surfaceId: string;
  graphNodes: SpatialGraphNode[];
  graphEdges: SpatialGraphEdge[];
  lockedNodeIds: Set<string>;
  selectedNodeId: string | null;
  nodeTitles: Record<string, string>;
  onSelectNode?: (nodeId: string) => void;
  certaintySource?: JourneyGuideCertaintySource | null;
};

export function useJourneyGuideReporter({
  surfaceId,
  graphNodes,
  graphEdges,
  lockedNodeIds,
  selectedNodeId,
  nodeTitles,
  onSelectNode,
  certaintySource = null,
}: Input) {
  const guide = useOptionalJourneyGuideContext();

  const snapshot = useMemo<JourneyGuideGraphSnapshot | null>(() => {
    if (graphNodes.length === 0) {
      return null;
    }
    return {
      surfaceId,
      graphNodes,
      graphEdges,
      lockedNodeIds,
      selectedNodeId,
      nodeTitles,
    };
  }, [graphEdges, graphNodes, lockedNodeIds, nodeTitles, selectedNodeId, surfaceId]);

  useEffect(() => {
    if (!guide) {
      return;
    }
    guide.setGraphSnapshot(snapshot);
  }, [guide, snapshot]);

  useEffect(() => {
    if (!guide) {
      return;
    }
    guide.setCertaintySource(certaintySource ?? null);
  }, [certaintySource, guide]);

  useEffect(() => {
    if (!guide) {
      return;
    }
    graphNodes.forEach((node) => {
      if (node.status === 'completed' && node.id !== '__journey__') {
        guide.onNodeCompleted(node.id);
      }
    });
  }, [graphNodes, guide]);

  useEffect(() => {
    if (!guide || !onSelectNode) {
      return;
    }
    guide.selectNodeRef.current = onSelectNode;
    return () => {
      guide.selectNodeRef.current = null;
    };
  }, [guide, onSelectNode]);
}
