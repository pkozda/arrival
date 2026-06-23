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
import { usePathname } from 'next/navigation';
import { useAtlasRuntime } from '@/components/atlas-runtime/AtlasRuntimeProvider';
import {
  buildFallbackArrivalContext,
  consumeArrivalIntent,
  type ArrivalContext,
  type ArrivalEntryAnimationState,
} from '@/lib/celestial';
import type { SpatialPhase, SpatialTransition } from '@/lib/atlas-runtime';
import { spatialNavigationInterceptor } from '@/lib/atlas-runtime/spatial-navigation-interceptor';
import { captureArrivalIntentFromClick } from '@/lib/celestial/capture-arrival-intent';

type ArrivalContextValue = {
  arrival: ArrivalContext | null;
  spatialTransition: SpatialTransition;
  spatialPhase: SpatialPhase;
  entryAnimationState: ArrivalEntryAnimationState;
  setEntryAnimationState: (state: ArrivalEntryAnimationState) => void;
  setSpatialPhase: (phase: SpatialPhase) => void;
  recordArrivalIntent: (destinationPath: string) => void;
  onSpatialEnter: () => void;
  onSpatialExit: () => void;
};

const Context = createContext<ArrivalContextValue | null>(null);

export function ArrivalProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { motionEngine } = useAtlasRuntime();
  const previousPathRef = useRef<string | null>(null);
  const pathnameRef = useRef(pathname ?? '/');
  const spatialPhaseRef = useRef<SpatialPhase>('idle');
  const [arrival, setArrival] = useState<ArrivalContext | null>(null);
  const [entryAnimationState, setEntryAnimationState] = useState<ArrivalEntryAnimationState>('idle');
  const [spatialPhase, setSpatialPhase] = useState<SpatialPhase>('idle');

  useEffect(() => {
    pathnameRef.current = pathname ?? '/';
  }, [pathname]);

  useEffect(() => {
    spatialPhaseRef.current = spatialPhase;
  }, [spatialPhase]);

  const spatialTransition = useMemo(() => {
    if (!arrival) {
      return motionEngine.fallback();
    }

    if (arrival.navigationMode === 'fallback-spatial') {
      return motionEngine.fallback(arrival.sourceNodeId);
    }

    return motionEngine.buildSpatialTransition(arrival);
  }, [arrival, motionEngine]);

  const recordArrivalIntent = useCallback(
    (destinationPath: string) => {
      const departedFromPath = pathname ?? '/';
      spatialNavigationInterceptor.ensureSpatialIntent(departedFromPath, destinationPath);
      setSpatialPhase('exiting');
    },
    [pathname]
  );

  const onSpatialEnter = useCallback(() => {
    setSpatialPhase('entering');
    setEntryAnimationState('entering');
  }, []);

  const onSpatialExit = useCallback(() => {
    setSpatialPhase('exiting');
  }, []);

  useEffect(() => {
    const onClickCapture = (event: MouseEvent) => {
      if (captureArrivalIntentFromClick(event)) {
        if (spatialPhaseRef.current === 'idle') {
          motionEngine.fallback();
        }
        setSpatialPhase('exiting');
      }
    };

    document.addEventListener('click', onClickCapture, true);
    return () => document.removeEventListener('click', onClickCapture, true);
  }, [motionEngine]);

  useEffect(() => {
    return spatialNavigationInterceptor.install({
      getCurrentPath: () => pathnameRef.current,
      onNavigationStart: () => {
        if (spatialPhaseRef.current === 'idle') {
          motionEngine.fallback();
        }
        setSpatialPhase('exiting');
      },
      onFallbackRequired: () => {
        if (spatialPhaseRef.current === 'idle') {
          motionEngine.fallback();
        }
      },
    });
  }, [motionEngine]);

  useEffect(() => {
    if (!pathname || pathname === '/') {
      previousPathRef.current = pathname;
      setArrival(null);
      setEntryAnimationState('idle');
      setSpatialPhase('idle');
      return;
    }

    const pending = consumeArrivalIntent(pathname);
    if (pending) {
      setArrival(pending);
      setEntryAnimationState('entering');
      setSpatialPhase('entering');
      previousPathRef.current = pathname;
      return;
    }

    const previousPath = previousPathRef.current;
    const fallback = buildFallbackArrivalContext(
      previousPath && previousPath !== pathname ? previousPath : '/',
      pathname,
      'router-fallback'
    );

    setArrival({
      ...fallback,
      entryAnimationState: 'entering',
      capturedAt: Date.now(),
    });
    setEntryAnimationState('entering');
    setSpatialPhase('entering');
    previousPathRef.current = pathname;
  }, [pathname]);

  const value = useMemo(
    () => ({
      arrival,
      spatialTransition,
      spatialPhase,
      entryAnimationState,
      setEntryAnimationState,
      setSpatialPhase,
      recordArrivalIntent,
      onSpatialEnter,
      onSpatialExit,
    }),
    [
      arrival,
      spatialTransition,
      spatialPhase,
      entryAnimationState,
      recordArrivalIntent,
      onSpatialEnter,
      onSpatialExit,
    ]
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useArrival(): ArrivalContextValue {
  const context = useContext(Context);
  if (!context) {
    throw new Error('useArrival must be used within ArrivalProvider');
  }
  return context;
}
