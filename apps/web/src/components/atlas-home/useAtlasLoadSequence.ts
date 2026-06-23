'use client';

import { useEffect, useState } from 'react';

/** 0=idle 1=stars 2=constellation 3=nodes 4=center 5=ui 6=complete */
export type AtlasLoadPhase = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export function useAtlasLoadSequence(epoch = 0): AtlasLoadPhase {
  const [phase, setPhase] = useState<AtlasLoadPhase>(0);

  useEffect(() => {
    setPhase(0);

    const schedule: Array<[AtlasLoadPhase, number]> = [
      [1, 80],
      [2, 450],
      [3, 850],
      [4, 1550],
      [5, 1850],
      [6, 2400],
    ];

    const timers = schedule.map(([next, delay]) =>
      window.setTimeout(() => setPhase(next), delay)
    );

    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [epoch]);

  return phase;
}
