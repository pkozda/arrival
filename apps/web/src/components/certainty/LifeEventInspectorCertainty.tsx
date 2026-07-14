'use client';

import { useMemo } from 'react';
import type { LifeEventPlanNode } from '@/lib/product-contract';
import { CertaintyPanel } from '@/components/certainty/CertaintyPanel';
import {
  buildLifeEventCertaintyBundle,
  isCertaintyLayerEnabled,
} from '@/lib/certainty';

type Props = {
  selectedNode: LifeEventPlanNode | null;
  primaryAction: LifeEventPlanNode | null;
  timeline: LifeEventPlanNode[];
  dependencyNodeIds: string[];
  titleForNode: (node: LifeEventPlanNode | { id: string; title: string }) => string;
  descriptionForNode: (node: LifeEventPlanNode) => string;
};

export function LifeEventInspectorCertainty({
  selectedNode,
  primaryAction,
  timeline,
  dependencyNodeIds,
  titleForNode,
  descriptionForNode,
}: Props) {
  const enabled = isCertaintyLayerEnabled();

  const state = useMemo(() => {
    if (!enabled) {
      return null;
    }

    return buildLifeEventCertaintyBundle({
      selectedNode,
      primaryAction,
      timeline,
      dependencyNodeIds,
      titleForNode,
      descriptionForNode,
    }).state;
  }, [
    dependencyNodeIds,
    descriptionForNode,
    enabled,
    primaryAction,
    selectedNode,
    timeline,
    titleForNode,
  ]);

  if (!enabled || !state) {
    return null;
  }

  return <CertaintyPanel state={state} surfaceId="life-event-inspector" />;
}
