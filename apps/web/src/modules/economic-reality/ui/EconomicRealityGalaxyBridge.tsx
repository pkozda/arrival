'use client';

import { useEffect, useMemo } from 'react';
import type { EconomicPresentationV1 } from '@/lib/product-contract';
import type { EconomicUiSectionProjection } from '@/lib/economic-reality';
import { useEconomicCopy } from '@/lib/economic-reality';
import {
  buildEconomicRealityGalaxyGraph,
  type EconomicGalaxyNodePayload,
} from '@/lib/presentation/economic-reality/build-galaxy-graph';
import {
  GalaxyGraphStage,
  GalaxyInspectorShell,
  galaxyStatusLabel,
  useGalaxyGraphModel,
  useGalaxyProgressReporter,
} from '@/lib/presentation/spatial-core';
import {
  GalaxyInspectorContext,
  GalaxyInspectorEmpty,
  GalaxyInspectorItems,
  GalaxyInspectorRequires,
  GalaxyInspectorSection,
  GalaxyInspectorStatus,
  GalaxyInspectorTitle,
} from '@/lib/presentation/spatial-core/GalaxyInspectorSections';
import { EconomicCardInspectorActions } from './EconomicCardInspectorActions';

type Props = {
  presentation: EconomicPresentationV1;
  sections: EconomicUiSectionProjection[];
};

function cardContext(copy: (key: string) => string, payload: EconomicGalaxyNodePayload | null): string {
  if (!payload) {
    return 'Select a node in the economic system.';
  }

  const sectionLabel = copy(payload.sectionTitleKey);
  const cardLabel = copy(payload.card.titleKey);

  switch (payload.card.uiType) {
    case 'PROFILE_CARD':
      return `${cardLabel} — profile data that affects eligibility and system routing. Group: ${sectionLabel}.`;
    case 'INTENT_CARD':
      return `${cardLabel} — institution process entry point. Group: ${sectionLabel}.`;
    case 'RESOURCE_CARD':
      return `${cardLabel} — external support resource. Group: ${sectionLabel}.`;
    case 'ACTION_CARD':
    default:
      return `${cardLabel} — recommended system action. Group: ${sectionLabel}.`;
  }
}

export function EconomicRealityGalaxyBridge({ presentation, sections }: Props) {
  const copy = useEconomicCopy();

  const cardsById = useMemo(() => {
    const map = new Map<string, EconomicGalaxyNodePayload>();
    sections.forEach((section) => {
      section.cards.forEach((entry) => {
        map.set(entry.card.cardId, {
          card: entry.card,
          sectionType: section.section.type,
          sectionTitleKey: section.section.titleKey,
        });
      });
    });
    return map;
  }, [sections]);

  const { graphNodes, graphEdges, primaryFocusCardId, journeyLabelKey } = useMemo(
    () => buildEconomicRealityGalaxyGraph({ presentation, sections }),
    [presentation, sections]
  );

  const model = useGalaxyGraphModel({
    graphNodes,
    graphEdges,
  });

  const selectedPayload = model.inspectorSelection.selectedNode?.payload ?? null;

  useGalaxyProgressReporter({
    graphNodes: model.graphNodes,
    selectedNodeId: model.selectedNodeId,
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        model.setSelectedNodeId(null);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [model.setSelectedNodeId]);

  return (
    <>
      <GalaxyGraphStage
        model={model}
        primaryNodeId={primaryFocusCardId}
        renderNode={(graphNode) => {
          if (graphNode.id === '__journey__') {
            return {
              title: copy(journeyLabelKey),
              descriptor: 'Economic state anchor',
              disabled: true,
            };
          }

          const payload = graphNode.payload;
          return {
            title: payload ? copy(payload.card.titleKey) : graphNode.id,
            descriptor: payload ? copy(payload.sectionTitleKey) : undefined,
          };
        }}
      />

      <GalaxyInspectorShell>
        <GalaxyInspectorTitle>
          {selectedPayload ? copy(selectedPayload.card.titleKey) : 'Node Inspector'}
        </GalaxyInspectorTitle>

        {selectedPayload && (
          <GalaxyInspectorStatus>
            {galaxyStatusLabel(model.inspectorSelection.selectedNode?.status ?? 'future')}
          </GalaxyInspectorStatus>
        )}

        {selectedPayload && model.inspectorSelection.dependencySources.size > 0 && (
          <GalaxyInspectorRequires>
            Requires:{' '}
            {Array.from(model.inspectorSelection.dependencySources)
              .map((nodeId) => {
                const payload = cardsById.get(nodeId);
                return payload ? copy(payload.card.titleKey) : nodeId;
              })
              .join(', ')}
          </GalaxyInspectorRequires>
        )}

        <GalaxyInspectorSection title="Context">
          <GalaxyInspectorContext>{cardContext(copy, selectedPayload)}</GalaxyInspectorContext>
        </GalaxyInspectorSection>

        <GalaxyInspectorSection title="Unlocks">
          {model.inspectorSelection.unlocks.length === 0 ? (
            <GalaxyInspectorEmpty>No direct unlocks.</GalaxyInspectorEmpty>
          ) : (
            <GalaxyInspectorItems
              items={model.inspectorSelection.unlocks.map((edge) => {
                const payload = cardsById.get(edge.to);
                return {
                  id: edge.id,
                  title: payload ? copy(payload.card.titleKey) : edge.to,
                };
              })}
            />
          )}
        </GalaxyInspectorSection>

        <GalaxyInspectorSection title="Blocked">
          {model.inspectorSelection.dependencies.length === 0 ? (
            <GalaxyInspectorEmpty>No direct constraints.</GalaxyInspectorEmpty>
          ) : (
            <GalaxyInspectorItems
              items={model.inspectorSelection.dependencies.map((edge) => {
                const payload = cardsById.get(edge.from);
                const target = selectedPayload ? copy(selectedPayload.card.titleKey) : 'selection';
                return {
                  id: edge.id,
                  title: payload
                    ? `${target} blocked until ${copy(payload.card.titleKey)}`
                    : edge.from,
                };
              })}
            />
          )}
        </GalaxyInspectorSection>

        {selectedPayload && (
          <GalaxyInspectorSection title="Actions">
            <EconomicCardInspectorActions card={selectedPayload.card} />
          </GalaxyInspectorSection>
        )}
      </GalaxyInspectorShell>
    </>
  );
}
