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
import {
  buildArrivalContext,
  buildDefaultSpatialTransition,
  buildSpatialTransition,
  consumeArrivalIntent,
  persistArrivalIntent,
  type ArrivalContext,
  type ArrivalEntryAnimationState,
} from '@/lib/celestial';
import type { SpatialPhase, SpatialTransition } from '@/lib/celestial/spatial-types';
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
  const previousPathRef = useRef<string | null>(null);
  const [arrival, setArrival] = useState<ArrivalContext | null>(null);
  const [entryAnimationState, setEntryAnimationState] = useState<ArrivalEntryAnimationState>('idle');
  const [spatialPhase, setSpatialPhase] = useState<SpatialPhase>('idle');

  const spatialTransition = useMemo(
    () => (arrival ? buildSpatialTransition(arrival) : buildDefaultSpatialTransition()),
    [arrival]
  );

  const recordArrivalIntent = useCallback(
    (destinationPath: string) => {
      const departedFromPath = pathname ?? '/';
      persistArrivalIntent(buildArrivalContext(departedFromPath, destinationPath));
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
        setSpatialPhase('exiting');
      }
    };

    document.addEventListener('click', onClickCapture, true);
    return () => document.removeEventListener('click', onClickCapture, true);
  }, []);

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
    if (previousPath && previousPath !== pathname && previousPath !== '/') {
      const synthesized = buildArrivalContext(previousPath, pathname);
      setArrival({
        ...synthesized,
        entryAnimationState: 'entering',
        capturedAt: Date.now(),
      });
    } else {
      setArrival({
        ...buildArrivalContext('/', pathname),
        entryAnimationState: 'entering',
        capturedAt: Date.now(),
      });
    }

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
