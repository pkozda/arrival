'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  buildLockedGuideState,
  buildRoutePreviewChain,
  getRecommendedNextPlanet,
} from './recommendation-engine';
import {
  deriveAssistanceStage,
  persistGuideMode,
  persistLockedClick,
  persistWelcomeDismissed,
  readJourneyGuideState,
  writeJourneyGuideState,
} from './storage';
import type {
  DiscoveryState,
  JourneyGuideGraphSnapshot,
  JourneyGuideMode,
  JourneyGuidePersistedState,
  LockedGuideState,
  PlanetRecommendation,
  RoutePreviewState,
} from './types';

type JourneyGuideContextValue = {
  surfaceId: string;
  persisted: JourneyGuidePersistedState;
  mode: JourneyGuideMode | null;
  assistanceStage: 1 | 2 | 3 | 4;
  showWelcome: boolean;
  panelOpen: boolean;
  panelDismissed: boolean;
  recommendation: PlanetRecommendation | null;
  routePreview: RoutePreviewState | null;
  discovery: DiscoveryState | null;
  lockedGuide: LockedGuideState | null;
  guidedDimActive: boolean;
  ambientDimActive: boolean;
  assistantUiActive: boolean;
  recommendedNodeId: string | null;
  routePreviewNodeIds: Set<string>;
  routePreviewEdgeIds: Set<string>;
  setGraphSnapshot: (snapshot: JourneyGuideGraphSnapshot | null) => void;
  startGuidedJourney: () => void;
  exploreOnMyOwn: () => void;
  dismissWelcome: () => void;
  openPanel: () => void;
  closePanel: () => void;
  resumeGuidedJourney: () => void;
  triggerRoutePreview: (nodeId?: string) => void;
  handleLockedNodeSelect: (nodeId: string) => void;
  goToPrerequisite: (nodeId: string) => void;
  clearLockedGuide: () => void;
  onNodeCompleted: (nodeId: string) => void;
  selectNodeRef: React.MutableRefObject<((nodeId: string) => void) | null>;
};

const JourneyGuideContext = createContext<JourneyGuideContextValue | null>(null);

type ProviderProps = {
  children: ReactNode;
  surfaceId: string;
};

export function JourneyGuideProvider({ children, surfaceId }: ProviderProps) {
  const [persisted, setPersisted] = useState<JourneyGuidePersistedState>(() => readJourneyGuideState());
  const [graphSnapshot, setGraphSnapshotState] = useState<JourneyGuideGraphSnapshot | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelDismissed, setPanelDismissed] = useState(false);
  const [routePreview, setRoutePreview] = useState<RoutePreviewState | null>(null);
  const [discovery, setDiscovery] = useState<DiscoveryState | null>(null);
  const [lockedGuide, setLockedGuide] = useState<LockedGuideState | null>(null);
  const selectNodeRef = useRef<((nodeId: string) => void) | null>(null);
  const previousUnlockedRef = useRef<Set<string>>(new Set());

  const mode = persisted.hasChosenMode ? persisted.mode : null;
  const assistanceStage = deriveAssistanceStage(persisted);
  const showWelcome =
    !persisted.dismissedWelcomeSurfaces.includes(surfaceId) && !persisted.hasChosenMode;

  const completedNodeIds = useMemo(() => {
    if (!graphSnapshot) {
      return new Set<string>();
    }
    const fromGraph = graphSnapshot.graphNodes
      .filter((node) => node.status === 'completed' && node.id !== '__journey__')
      .map((node) => node.id);
    return new Set([...persisted.completedMissionIds, ...fromGraph]);
  }, [graphSnapshot, persisted.completedMissionIds]);

  const recommendation = useMemo(() => {
    if (!graphSnapshot) {
      return null;
    }
    return getRecommendedNextPlanet({
      graphNodes: graphSnapshot.graphNodes,
      graphEdges: graphSnapshot.graphEdges,
      lockedNodeIds: graphSnapshot.lockedNodeIds,
      nodeTitles: graphSnapshot.nodeTitles,
      primaryNodeId: recommendationPrimary(graphSnapshot, completedNodeIds),
      completedNodeIds,
    });
  }, [completedNodeIds, graphSnapshot]);

  const assistantUiActive = showWelcome || panelOpen || Boolean(lockedGuide);
  const ambientDimActive =
    assistantUiActive || Boolean(routePreview) || Boolean(discovery);
  const guidedDimActive =
    mode === 'guided' &&
    assistanceStage <= 2 &&
    Boolean(recommendation) &&
    panelOpen &&
    !showWelcome;

  useEffect(() => {
    if (!graphSnapshot) {
      return;
    }
    const fromGraph = graphSnapshot.graphNodes
      .filter((node) => node.status === 'completed' && node.id !== '__journey__')
      .map((node) => node.id);
    if (fromGraph.length === 0) {
      return;
    }

    const current = readJourneyGuideState();
    const merged = new Set([...current.completedMissionIds, ...fromGraph]);
    if (merged.size === current.completedMissionIds.length) {
      return;
    }

    const next = {
      ...current,
      completedMissionIds: [...merged],
      lastActiveAt: new Date().toISOString(),
    };
    writeJourneyGuideState(next);
    setPersisted(next);
  }, [graphSnapshot]);

  useEffect(() => {
    if (!recommendation && panelOpen && !lockedGuide) {
      setPanelOpen(false);
      setPanelDismissed(true);
    }
  }, [lockedGuide, panelOpen, recommendation]);

  useEffect(() => {
    if (!graphSnapshot) {
      return;
    }
    const unlocked = new Set(
      graphSnapshot.graphNodes
        .filter((node) => !graphSnapshot.lockedNodeIds.has(node.id))
        .map((node) => node.id)
    );
    const newlyUnlocked = [...unlocked].filter((id) => !previousUnlockedRef.current.has(id));
    if (previousUnlockedRef.current.size > 0 && newlyUnlocked.length > 0) {
      setDiscovery({
        nodeIds: newlyUnlocked,
        titles: newlyUnlocked.map((id) => graphSnapshot.nodeTitles[id] ?? id),
        startedAt: Date.now(),
      });
    }
    previousUnlockedRef.current = unlocked;
  }, [graphSnapshot]);

  useEffect(() => {
    if (!discovery) {
      return;
    }
    const timer = window.setTimeout(() => setDiscovery(null), 3200);
    return () => window.clearTimeout(timer);
  }, [discovery]);

  useEffect(() => {
    if (!routePreview) {
      return;
    }
    const remaining = routePreview.startedAt + 3500 - Date.now();
    const timer = window.setTimeout(() => setRoutePreview(null), Math.max(remaining, 0));
    return () => window.clearTimeout(timer);
  }, [routePreview]);

  const setGraphSnapshot = useCallback((snapshot: JourneyGuideGraphSnapshot | null) => {
    setGraphSnapshotState(snapshot);
  }, []);

  const applyRoutePreview = useCallback(
    (nodeId: string | undefined) => {
      if (!graphSnapshot || !nodeId) {
        return;
      }
      const chain = buildRoutePreviewChain(
        nodeId,
        graphSnapshot.graphNodes,
        graphSnapshot.graphEdges,
        graphSnapshot.nodeTitles
      );
      if (chain.nodeIds.length < 2 && chain.edgeIds.length === 0) {
        return;
      }
      setRoutePreview({
        nodeIds: chain.nodeIds,
        edgeIds: chain.edgeIds,
        startedAt: Date.now(),
      });
    },
    [graphSnapshot]
  );

  const startGuidedJourney = useCallback(() => {
    const next = persistGuideMode('guided');
    setPersisted(next);
    persistWelcomeDismissed(surfaceId);
    setPanelDismissed(false);
    setPanelOpen(true);
    if (recommendation) {
      applyRoutePreview(recommendation.nodeId);
    }
  }, [applyRoutePreview, recommendation, surfaceId]);

  const exploreOnMyOwn = useCallback(() => {
    const next = persistGuideMode('independent');
    setPersisted(next);
    persistWelcomeDismissed(surfaceId);
    setPanelOpen(false);
  }, [surfaceId]);

  const dismissWelcome = useCallback(() => {
    const next = persistWelcomeDismissed(surfaceId);
    setPersisted(next);
  }, [surfaceId]);

  const triggerRoutePreview = useCallback(
    (nodeId?: string) => {
      applyRoutePreview(nodeId ?? recommendation?.nodeId);
    },
    [applyRoutePreview, recommendation?.nodeId]
  );

  const handleLockedNodeSelect = useCallback(
    (nodeId: string) => {
      if (!graphSnapshot) {
        return;
      }
      const nextPersisted = persistLockedClick();
      setPersisted(nextPersisted);
      setLockedGuide(
        buildLockedGuideState(
          nodeId,
          graphSnapshot.graphNodes,
          graphSnapshot.graphEdges,
          graphSnapshot.nodeTitles
        )
      );
      setPanelOpen(true);
    },
    [graphSnapshot]
  );

  const goToPrerequisite = useCallback((nodeId: string) => {
    selectNodeRef.current?.(nodeId);
    setLockedGuide(null);
    setPanelOpen(false);
  }, []);

  const onNodeCompleted = useCallback((nodeId: string) => {
    const current = readJourneyGuideState();
    if (current.completedMissionIds.includes(nodeId)) {
      return;
    }
    const next = {
      ...current,
      completedMissionIds: [...current.completedMissionIds, nodeId],
      lastActiveAt: new Date().toISOString(),
    };
    writeJourneyGuideState(next);
    setPersisted(next);
  }, []);

  const routePreviewNodeIds = useMemo(
    () => new Set(routePreview?.nodeIds ?? []),
    [routePreview?.nodeIds]
  );
  const routePreviewEdgeIds = useMemo(
    () => new Set(routePreview?.edgeIds ?? []),
    [routePreview?.edgeIds]
  );

  useEffect(() => {
    if (
      mode === 'guided' &&
      assistanceStage <= 2 &&
      recommendation &&
      !panelDismissed &&
      !showWelcome &&
      !lockedGuide
    ) {
      setPanelOpen(true);
    }
  }, [assistanceStage, lockedGuide, mode, panelDismissed, recommendation, showWelcome]);

  const value = useMemo(
    () => ({
      surfaceId,
      persisted,
      mode,
      assistanceStage,
      showWelcome,
      panelOpen,
      panelDismissed,
      recommendation,
      routePreview,
      discovery,
      lockedGuide,
      guidedDimActive,
      ambientDimActive,
      assistantUiActive,
      recommendedNodeId: recommendation?.nodeId ?? null,
      routePreviewNodeIds,
      routePreviewEdgeIds,
      setGraphSnapshot,
      startGuidedJourney,
      exploreOnMyOwn,
      dismissWelcome,
      openPanel: () => {
        setPanelDismissed(false);
        setPanelOpen(true);
      },
      closePanel: () => {
        setPanelOpen(false);
        setPanelDismissed(true);
        setLockedGuide(null);
        setRoutePreview(null);
      },
      resumeGuidedJourney: () => {
        const next = persistGuideMode('guided');
        setPersisted(next);
        setPanelDismissed(false);
        setPanelOpen(true);
      },
      triggerRoutePreview,
      handleLockedNodeSelect,
      goToPrerequisite,
      clearLockedGuide: () => setLockedGuide(null),
      onNodeCompleted,
      selectNodeRef,
    }),
    [
      assistanceStage,
      ambientDimActive,
      assistantUiActive,
      discovery,
      exploreOnMyOwn,
      goToPrerequisite,
      guidedDimActive,
      handleLockedNodeSelect,
      lockedGuide,
      mode,
      onNodeCompleted,
      panelOpen,
      panelDismissed,
      persisted,
      recommendation,
      routePreview,
      routePreviewEdgeIds,
      routePreviewNodeIds,
      setGraphSnapshot,
      showWelcome,
      startGuidedJourney,
      surfaceId,
      triggerRoutePreview,
      dismissWelcome,
    ]
  );

  return <JourneyGuideContext.Provider value={value}>{children}</JourneyGuideContext.Provider>;
}

function recommendationPrimary(
  snapshot: JourneyGuideGraphSnapshot,
  completedNodeIds: Set<string>
): string | null {
  const recommended = snapshot.graphNodes.find(
    (node) =>
      node.status === 'recommended' &&
      !snapshot.lockedNodeIds.has(node.id) &&
      !completedNodeIds.has(node.id)
  );
  if (recommended) {
    return recommended.id;
  }

  if (
    snapshot.selectedNodeId &&
    snapshot.selectedNodeId !== '__journey__' &&
    !completedNodeIds.has(snapshot.selectedNodeId)
  ) {
    const selected = snapshot.graphNodes.find((node) => node.id === snapshot.selectedNodeId);
    if (selected && selected.status !== 'completed') {
      return snapshot.selectedNodeId;
    }
  }

  return null;
}

export function useJourneyGuideContext(): JourneyGuideContextValue {
  const context = useContext(JourneyGuideContext);
  if (!context) {
    throw new Error('useJourneyGuideContext must be used within JourneyGuideProvider');
  }
  return context;
}

export function useOptionalJourneyGuideContext(): JourneyGuideContextValue | null {
  return useContext(JourneyGuideContext);
}

export { JourneyGuideContext };
