'use client';

import { useEffect, useMemo } from 'react';
import { useApp } from '@/components/AppProvider';
import { ProfileCorrectionToast } from '@/components/profile/ProfileCorrectionToast';
import {
  ProfileDomainInspectorActions,
  ProfileDomainInspectorBody,
} from '@/components/profile/ProfileDomainInspectorContent';
import { selectUserContextProfile } from '@/lib/user-context';
import {
  buildProfileGalaxyGraph,
  type ProfileGalaxyNodePayload,
} from '@/lib/presentation/profile/build-galaxy-graph';
import {
  GalaxyGraphStage,
  GalaxyInspectorShell,
  galaxyStatusLabel,
  useGalaxyGraphModel,
  useGalaxyProgressReporter,
} from '@/lib/presentation/spatial-core';
import { useJourneyGuideReporter } from '@/lib/journey-guide';
import {
  GalaxyInspectorContext,
  GalaxyInspectorEmpty,
  GalaxyInspectorItems,
  GalaxyInspectorRequires,
  GalaxyInspectorSection,
  GalaxyInspectorTitle,
} from '@/lib/presentation/spatial-core/GalaxyInspectorSections';
import type { ProfileMirrorDomainSlug } from '@/lib/profile-mirror-utils';
import { formatDomainStatus } from '@/lib/profile-mirror-utils';

type Props = {
  initialSelectedSlug?: ProfileMirrorDomainSlug | null;
  inspectorDepth?: 'summary' | 'detail';
};

function domainContext(payload: ProfileGalaxyNodePayload | null): string {
  if (!payload) {
    return 'Select an identity domain in your situation graph.';
  }
  return payload.domain.whyItMatters;
}

export function ProfileGalaxyBridge({
  initialSelectedSlug = null,
  inspectorDepth = 'summary',
}: Props) {
  const { uiSnapshot, userContext, modules, profileInsights } = useApp();
  const profile = selectUserContextProfile(userContext);

  const graphData = useMemo(() => {
    if (!uiSnapshot) {
      return null;
    }

    return buildProfileGalaxyGraph({
      uiSnapshot,
      modules,
      profile,
      profileInsights,
    });
  }, [uiSnapshot, modules, profile, profileInsights]);

  const model = useGalaxyGraphModel({
    graphNodes: graphData?.graphNodes ?? [],
    graphEdges: graphData?.graphEdges ?? [],
    initialSelectedNodeId: initialSelectedSlug,
  });

  const selectedPayload = model.inspectorSelection.selectedNode?.payload ?? null;
  const domainsBySlug = graphData?.domainsBySlug ?? new Map<string, ProfileGalaxyNodePayload>();

  useGalaxyProgressReporter({
    graphNodes: model.graphNodes,
    selectedNodeId: model.selectedNodeId,
  });

  const nodeTitles = useMemo(() => {
    const titles: Record<string, string> = {};
    model.graphNodes.forEach((node) => {
      if (node.id === '__journey__') {
        titles[node.id] = 'Your situation';
        return;
      }
      titles[node.id] = node.payload?.domain.title ?? node.id;
    });
    return titles;
  }, [model.graphNodes]);

  useJourneyGuideReporter({
    surfaceId: 'profile-galaxy',
    graphNodes: model.graphNodes,
    graphEdges: model.graphEdges,
    lockedNodeIds: model.lockedNodeIds,
    selectedNodeId: model.selectedNodeId,
    nodeTitles,
    onSelectNode: model.setSelectedNodeId,
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

  if (!graphData || !uiSnapshot) {
    return null;
  }

  return (
    <>
      <ProfileCorrectionToast />

      <GalaxyGraphStage
        model={model}
        primaryNodeId={graphData.primaryFocusDomainSlug}
        renderNode={(graphNode) => {
          if (graphNode.id === '__journey__') {
            return {
              title: 'Your situation',
              descriptor: graphData.journeyLabel,
              disabled: true,
            };
          }

          const payload = graphNode.payload;
          return {
            title: payload?.domain.title ?? graphNode.id,
            descriptor: payload ? formatDomainStatus(payload.domain.status) : undefined,
          };
        }}
      />

      <GalaxyInspectorShell>
        <GalaxyInspectorTitle>
          {selectedPayload ? selectedPayload.domain.title : 'Node Inspector'}
        </GalaxyInspectorTitle>

        {selectedPayload && (
          <ProfileDomainInspectorBody payload={selectedPayload} depth={inspectorDepth} />
        )}

        {selectedPayload && model.inspectorSelection.dependencySources.size > 0 && (
          <GalaxyInspectorRequires>
            Requires:{' '}
            {Array.from(model.inspectorSelection.dependencySources)
              .map((nodeId) => domainsBySlug.get(nodeId)?.domain.title ?? nodeId)
              .join(', ')}
          </GalaxyInspectorRequires>
        )}

        <GalaxyInspectorSection title="Context">
          <GalaxyInspectorContext>{domainContext(selectedPayload)}</GalaxyInspectorContext>
        </GalaxyInspectorSection>

        <GalaxyInspectorSection title="Unlocks">
          {model.inspectorSelection.unlocks.length === 0 ? (
            <GalaxyInspectorEmpty>No direct unlocks.</GalaxyInspectorEmpty>
          ) : (
            <GalaxyInspectorItems
              items={model.inspectorSelection.unlocks.map((edge) => ({
                id: edge.id,
                title: domainsBySlug.get(edge.to)?.domain.title ?? edge.to,
              }))}
            />
          )}
        </GalaxyInspectorSection>

        <GalaxyInspectorSection title="Blocked">
          {model.inspectorSelection.dependencies.length === 0 ? (
            <GalaxyInspectorEmpty>No direct constraints.</GalaxyInspectorEmpty>
          ) : (
            <GalaxyInspectorItems
              items={model.inspectorSelection.dependencies.map((edge) => {
                const source = domainsBySlug.get(edge.from);
                const target = selectedPayload?.domain.title ?? 'selection';
                return {
                  id: edge.id,
                  title: source ? `${target} blocked until ${source.domain.title}` : edge.from,
                };
              })}
            />
          )}
        </GalaxyInspectorSection>

        {selectedPayload && (
          <GalaxyInspectorSection title="Actions">
            <ProfileDomainInspectorActions payload={selectedPayload} depth={inspectorDepth} />
          </GalaxyInspectorSection>
        )}

        {!selectedPayload && (
          <GalaxyInspectorSection title="State">
            <GalaxyInspectorContext>
              {galaxyStatusLabel('core')} — {graphData.journeyLabel}
            </GalaxyInspectorContext>
          </GalaxyInspectorSection>
        )}
      </GalaxyInspectorShell>
    </>
  );
}