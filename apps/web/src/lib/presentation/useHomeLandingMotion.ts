'use client';

import { useEffect, useState, type RefObject } from 'react';

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  return reduced;
}

export function useHomeLandingMotion(rootRef: RefObject<HTMLElement | null>): {
  reducedMotion: boolean;
} {
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const root = rootRef.current;
    if (!root || reducedMotion) {
      return;
    }

    const idleTimer = window.setTimeout(() => {
      root.classList.add('home-experience--idle');
    }, 6500);

    let frame = 0;
    const onScroll = () => {
      if (frame) {
        return;
      }
      frame = window.requestAnimationFrame(() => {
        const y = Math.min(window.scrollY, 240);
        root.style.setProperty('--home-scroll-y', String(y));
        root.style.setProperty('--home-scroll-parallax', String(y * 0.045));
        frame = 0;
      });
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      window.clearTimeout(idleTimer);
      window.removeEventListener('scroll', onScroll);
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, [reducedMotion, rootRef]);

  return { reducedMotion };
}
