'use client';

import { useEffect, useState } from 'react';

export type ParallaxOffset = { x: number; y: number };

const LAYER_MULTIPLIERS = {
  stars: 10,
  constellation: 6,
  map: 4,
  ui: 1.5,
} as const;

export type ParallaxLayer = keyof typeof LAYER_MULTIPLIERS;

export function useAtlasParallax(): {
  offset: (layer: ParallaxLayer) => ParallaxOffset;
} {
  const [normalized, setNormalized] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      const x = (event.clientX / window.innerWidth - 0.5) * 2;
      const y = (event.clientY / window.innerHeight - 0.5) * 2;
      setNormalized({ x, y });
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  const offset = (layer: ParallaxLayer): ParallaxOffset => {
    const multiplier = LAYER_MULTIPLIERS[layer];
    return {
      x: normalized.x * multiplier,
      y: normalized.y * multiplier,
    };
  };

  return { offset };
}
