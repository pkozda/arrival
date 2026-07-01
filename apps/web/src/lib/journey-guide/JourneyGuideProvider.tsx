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
  buildOverlayTitle,
  buildUnlockGuideMessage,
  buildUnlockSequence,
  CINEMATIC_TIMING,
  findNewlyCompletedNodeIds,
  findNewlyUnlockedNodeIds,
  sequenceToStoredEvent,
  storedEventToSequence,
} from './cinematic-unlock-engine';
import {
  buildLockedGuideState,
  buildRoutePreviewChain,
  getRecommendedNextPlanet,
} from './recommendation-engine';
import {
  deriveAssistanceStage,
  persistGuideMode,
  persistLockedClick,
  persistUnlockEvent,
  persistWelcomeDismissed,
  readJourneyGuideState,
  writeJourneyGuideState,
} from './storage';
import type {
  CinematicUnlockState,
  JourneyGuideGraphSnapshot,
  JourneyGuideMode,
  JourneyGuidePersistedState,
  LockedGuideState,
  PlanetRecommendation,
  RoutePreviewState,
  StoredUnlockEvent,
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
  cinematicUnlock: CinematicUnlockState | null;
  lockedGuide: LockedGuideState | null;
  guidedDimActive: boolean;
  ambientDimActive: boolean;
  assistantUiActive: boolean;
  recommendedNodeId: string | null;
  routePreviewNodeIds: Set<string>;
  routePreviewEdgeIds: Set<string>;
  cinematicRouteNodeIds: Set<string>;
  cinematicRouteEdgeIds: Set<string>;
  cinematicEmergenceNodeIds: Set<string>;
  lastUnlockEvent: StoredUnlockEvent | null;
  canReplayUnlock: boolean;
  setGraphSnapshot: (snapshot: JourneyGuideGraphSnapshot | null) => void;
  startGuidedJourney: () => void;
  exploreOnMyOwn: () => void;
  dismissWelcome: () => void;
  openPanel: () => void;
  closePanel: () => void;
  resumeGuidedJourney: () => void;
  triggerRoutePreview: (nodeId?: string) => void;
  replayCinematicUnlock: () => void;
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

function createCinematicState(
  sequence: ReturnType<typeof storedEventToSequence>,
  isReplay: boolean
): CinematicUnlockState {
  const guideMessage = buildUnlockGuideMessage(sequence.sourceTitle, sequence.newlyUnlockedTitles);
  return {
    ...sequence,
    phase: 'completion',
    routeProgress: 0,
    emergenceProgress: 0,
    phaseStartedAt: Date.now(),
    startedAt: Date.now(),
    isReplay,
    guideTitle: guideMessage.title,
    guideBody: guideMessage.body,
    overlayTitle: buildOverlayTitle(sequence.newlyUnlockedNodeIds.length),
  };
}

export function JourneyGuideProvider({ children, surfaceId }: ProviderProps) {
  const [persisted, setPersisted] = useState<JourneyGuidePersistedState>(() => readJourneyGuideState());
  const [graphSnapshot, setGraphSnapshotState] = useState<JourneyGuideGraphSnapshot | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelDismissed, setPanelDismissed] = useState(false);
  const [routePreview, setRoutePreview] = useState<RoutePreviewState | null>(null);
  const [cinematicUnlock, setCinematicUnlock] = useState<CinematicUnlockState | null>(null);
  const [lockedGuide, setLockedGuide] = useState<LockedGuideState | null>(null);
  const selectNodeRef = useRef<((nodeId: string) => void) | null>(null);
  const previousLockedRef = useRef<Set<string>>(new Set());
  const previousCompletedRef = useRef<Set<string>>(new Set());
  const cinematicTimersRef = useRef<number[]>([]);

  const mode = persisted.hasChosenMode ? persisted.mode : null;
  const assistanceStage = deriveAssistanceStage(persisted);
  const showWelcome =
    !persisted.dismissedWelcomeSurfaces.includes(surfaceId) && !persisted.hasChosenMode;
  const lastUnlockEvent = persisted.lastUnlockEvent;
  const canReplayUnlock = Boolean(
    lastUnlockEvent &&
      lastUnlockEvent.surfaceId === surfaceId &&
      (!cinematicUnlock || cinematicUnlock.phase === 'guide')
  );

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

  const assistantUiActive =
    showWelcome || panelOpen || Boolean(lockedGuide) || cinematicUnlock?.phase === 'guide';
  const ambientDimActive =
    assistantUiActive || Boolean(routePreview) || Boolean(cinematicUnlock);
  const guidedDimActive =
    mode === 'guided' &&
    assistanceStage <= 2 &&
    Boolean(recommendation) &&
    panelOpen &&
    !showWelcome &&
    !cinematicUnlock;

  const clearCinematicTimers = useCallback(() => {
    cinematicTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    cinematicTimersRef.current = [];
  }, []);

  const startCinematicUnlock = useCallback(
    (event: StoredUnlockEvent, isReplay = false) => {
      clearCinematicTimers();
      setRoutePreview(null);
      setLockedGuide(null);
      const sequence = storedEventToSequence(event);
      setCinematicUnlock(createCinematicState(sequence, isReplay));
    },
    [clearCinematicTimers]
  );

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
    if (!recommendation && panelOpen && !lockedGuide && cinematicUnlock?.phase !== 'guide') {
      setPanelOpen(false);
      setPanelDismissed(true);
    }
  }, [cinematicUnlock?.phase, lockedGuide, panelOpen, recommendation]);

  useEffect(() => {
    if (!graphSnapshot || cinematicUnlock) {
      return;
    }

    const locked = graphSnapshot.lockedNodeIds;
    const completed = new Set(
      graphSnapshot.graphNodes
        .filter((node) => node.status === 'completed' && node.id !== '__journey__')
        .map((node) => node.id)
    );

    const newlyCompleted = findNewlyCompletedNodeIds(previousCompletedRef.current, graphSnapshot.graphNodes);
    const newlyUnlocked = findNewlyUnlockedNodeIds(previousLockedRef.current, locked, graphSnapshot.graphNodes);

    if (previousLockedRef.current.size > 0 && newlyUnlocked.length > 0 && newlyCompleted.length > 0) {
      const sourceId = newlyCompleted[newlyCompleted.length - 1]!;
      const sequence = buildUnlockSequence(
        sourceId,
        newlyUnlocked,
        graphSnapshot.graphNodes,
        graphSnapshot.graphEdges,
        graphSnapshot.nodeTitles
      );

      if (sequence) {
        const event = sequenceToStoredEvent(surfaceId, sequence);
        const next = persistUnlockEvent(event);
        setPersisted(next);
        startCinematicUnlock(event);
      }
    }

    previousLockedRef.current = new Set(locked);
    previousCompletedRef.current = completed;
  }, [cinematicUnlock, graphSnapshot, startCinematicUnlock, surfaceId]);

  useEffect(() => {
    if (!cinematicUnlock) {
      return;
    }

    const timers: number[] = [];
    const { routeSteps, newlyUnlockedNodeIds } = cinematicUnlock;

    timers.push(
      window.setTimeout(() => {
        setCinematicUnlock((current) =>
          current ? { ...current, phase: 'routes', phaseStartedAt: Date.now() } : null
        );
      }, CINEMATIC_TIMING.completion)
    );

    routeSteps.forEach((_, index) => {
      timers.push(
        window.setTimeout(() => {
          setCinematicUnlock((current) =>
            current ? { ...current, routeProgress: index + 1, phaseStartedAt: Date.now() } : null
          );
        }, CINEMATIC_TIMING.completion + (index + 1) * CINEMATIC_TIMING.routeHop)
      );
    });

    const routesEnd =
      CINEMATIC_TIMING.completion + routeSteps.length * CINEMATIC_TIMING.routeHop + 180;

    newlyUnlockedNodeIds.forEach((_, index) => {
      timers.push(
        window.setTimeout(() => {
          setCinematicUnlock((current) =>
            current
              ? {
                  ...current,
                  phase: 'emergence',
                  emergenceProgress: index + 1,
                  phaseStartedAt: Date.now(),
                }
              : null
          );
        }, routesEnd + (index + 1) * CINEMATIC_TIMING.emergence)
      );
    });

    const emergenceEnd =
      routesEnd + newlyUnlockedNodeIds.length * CINEMATIC_TIMING.emergence + 180;

    timers.push(
      window.setTimeout(() => {
        setCinematicUnlock((current) =>
          current ? { ...current, phase: 'overlay', phaseStartedAt: Date.now() } : null
        );
      }, emergenceEnd)
    );

    timers.push(
      window.setTimeout(() => {
        setCinematicUnlock((current) =>
          current ? { ...current, phase: 'guide', phaseStartedAt: Date.now() } : null
        );
        setPanelDismissed(false);
        setPanelOpen(true);
      }, emergenceEnd + CINEMATIC_TIMING.overlay)
    );

    timers.push(
      window.setTimeout(() => {
        setCinematicUnlock(null);
      }, emergenceEnd + CINEMATIC_TIMING.overlay + CINEMATIC_TIMING.guide)
    );

    cinematicTimersRef.current = timers;
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [cinematicUnlock?.startedAt]);

  useEffect(() => {
    return () => clearCinematicTimers();
  }, [clearCinematicTimers]);

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
      if (!graphSnapshot || !nodeId || cinematicUnlock) {
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
    [cinematicUnlock, graphSnapshot]
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

  const replayCinematicUnlock = useCallback(() => {
    if (!lastUnlockEvent || lastUnlockEvent.surfaceId !== surfaceId) {
      return;
    }
    startCinematicUnlock(lastUnlockEvent, true);
  }, [lastUnlockEvent, startCinematicUnlock, surfaceId]);

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

  const cinematicRouteNodeIds = useMemo(() => {
    if (!cinematicUnlock) {
      return new Set<string>();
    }
    const revealed = new Set<string>();
    if (cinematicUnlock.phase !== 'completion') {
      revealed.add(cinematicUnlock.sourceNodeId);
    }
    cinematicUnlock.routeSteps.slice(0, cinematicUnlock.routeProgress).forEach((step) => {
      revealed.add(step.toNodeId);
    });
    return revealed;
  }, [cinematicUnlock]);

  const cinematicRouteEdgeIds = useMemo(() => {
    if (!cinematicUnlock) {
      return new Set<string>();
    }
    return new Set(
      cinematicUnlock.routeSteps.slice(0, cinematicUnlock.routeProgress).map((step) => step.edgeId)
    );
  }, [cinematicUnlock]);

  const cinematicEmergenceNodeIds = useMemo(() => {
    if (!cinematicUnlock) {
      return new Set<string>();
    }
    return new Set(
      cinematicUnlock.newlyUnlockedNodeIds.slice(0, cinematicUnlock.emergenceProgress)
    );
  }, [cinematicUnlock]);

  useEffect(() => {
    if (
      mode === 'guided' &&
      assistanceStage <= 2 &&
      recommendation &&
      !panelDismissed &&
      !showWelcome &&
      !lockedGuide &&
      !cinematicUnlock
    ) {
      setPanelOpen(true);
    }
  }, [assistanceStage, cinematicUnlock, lockedGuide, mode, panelDismissed, recommendation, showWelcome]);

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
      cinematicUnlock,
      lockedGuide,
      guidedDimActive,
      ambientDimActive,
      assistantUiActive,
      recommendedNodeId: recommendation?.nodeId ?? null,
      routePreviewNodeIds,
      routePreviewEdgeIds,
      cinematicRouteNodeIds,
      cinematicRouteEdgeIds,
      cinematicEmergenceNodeIds,
      lastUnlockEvent,
      canReplayUnlock,
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
        setCinematicUnlock(null);
        clearCinematicTimers();
      },
      resumeGuidedJourney: () => {
        const next = persistGuideMode('guided');
        setPersisted(next);
        setPanelDismissed(false);
        setPanelOpen(true);
      },
      triggerRoutePreview,
      replayCinematicUnlock,
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
      canReplayUnlock,
      cinematicEmergenceNodeIds,
      cinematicRouteEdgeIds,
      cinematicRouteNodeIds,
      cinematicUnlock,
      clearCinematicTimers,
      exploreOnMyOwn,
      goToPrerequisite,
      guidedDimActive,
      handleLockedNodeSelect,
      lastUnlockEvent,
      lockedGuide,
      mode,
      onNodeCompleted,
      panelOpen,
      panelDismissed,
      persisted,
      recommendation,
      replayCinematicUnlock,
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
