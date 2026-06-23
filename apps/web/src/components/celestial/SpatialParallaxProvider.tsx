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
import type { SpatialParallaxOffset } from '@/lib/celestial/spatial-types';

type SpatialParallaxContextValue = {
  offset: SpatialParallaxOffset;
};

const ZERO: SpatialParallaxOffset = {
  foreground: { x: 0, y: 0 },
  midground: { x: 0, y: 0 },
  background: { x: 0, y: 0 },
};

const Context = createContext<SpatialParallaxContextValue>({ offset: ZERO });

const LERP = 0.08;
const FOREGROUND_GAIN = 0.55;
const MIDGROUND_GAIN = 0.32;
const BACKGROUND_GAIN = 0.14;

export function SpatialParallaxProvider({ children }: { children: ReactNode }) {
  const [offset, setOffset] = useState<SpatialParallaxOffset>(ZERO);
  const targetRef = useRef({ x: 0, y: 0 });
  const currentRef = useRef({ x: 0, y: 0 });
  const frameRef = useRef<number | null>(null);

  const tick = useCallback(() => {
    const target = targetRef.current;
    const current = currentRef.current;

    current.x += (target.x - current.x) * LERP;
    current.y += (target.y - current.y) * LERP;

    setOffset({
      foreground: { x: current.x * FOREGROUND_GAIN, y: current.y * FOREGROUND_GAIN },
      midground: { x: current.x * MIDGROUND_GAIN, y: current.y * MIDGROUND_GAIN },
      background: { x: current.x * BACKGROUND_GAIN, y: current.y * BACKGROUND_GAIN },
    });

    frameRef.current = window.requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      const nx = (event.clientX / window.innerWidth - 0.5) * 2;
      const ny = (event.clientY / window.innerHeight - 0.5) * 2;
      targetRef.current = { x: nx * 18, y: ny * 12 };
    };

    const onPointerLeave = () => {
      targetRef.current = { x: 0, y: 0 };
    };

    frameRef.current = window.requestAnimationFrame(tick);
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerleave', onPointerLeave);

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerleave', onPointerLeave);
      if (frameRef.current != null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, [tick]);

  const value = useMemo(() => ({ offset }), [offset]);

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useSpatialParallax(): SpatialParallaxContextValue {
  return useContext(Context);
}
