'use client';

import { useEffect, useRef, type RefObject } from 'react';

export type ParallaxOffset = { x: number; y: number };

const LAYER_MULTIPLIERS = {
  stars: 10,
  constellation: 6,
  map: 4,
  ui: 1.5,
} as const;

export type ParallaxLayer = keyof typeof LAYER_MULTIPLIERS;

const LERP = 0.14;

/**
 * Homepage parallax — updates CSS variables on the root ref via rAF.
 * No React state updates during pointer movement.
 */
export function useAtlasParallax(): {
  parallaxRef: RefObject<HTMLDivElement | null>;
  /** Legacy API — returns zero; layers use CSS variables under `.atlas-parallax-root`. */
  offset: (layer: ParallaxLayer) => ParallaxOffset;
} {
  const parallaxRef = useRef<HTMLDivElement | null>(null);
  const targetRef = useRef({ x: 0, y: 0 });
  const currentRef = useRef({ x: 0, y: 0 });
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      targetRef.current = {
        x: (event.clientX / window.innerWidth - 0.5) * 2,
        y: (event.clientY / window.innerHeight - 0.5) * 2,
      };
    };

    const tick = () => {
      const root = parallaxRef.current;
      if (root) {
        const current = currentRef.current;
        const target = targetRef.current;
        current.x += (target.x - current.x) * LERP;
        current.y += (target.y - current.y) * LERP;

        (Object.keys(LAYER_MULTIPLIERS) as ParallaxLayer[]).forEach((layer) => {
          const gain = LAYER_MULTIPLIERS[layer];
          root.style.setProperty(`--atlas-parallax-${layer}-x`, `${current.x * gain}px`);
          root.style.setProperty(`--atlas-parallax-${layer}-y`, `${current.y * gain}px`);
        });
      }

      frameRef.current = window.requestAnimationFrame(tick);
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    frameRef.current = window.requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('mousemove', onMove);
      if (frameRef.current != null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  const offset = (_layer: ParallaxLayer): ParallaxOffset => ({ x: 0, y: 0 });

  return { parallaxRef, offset };
}
