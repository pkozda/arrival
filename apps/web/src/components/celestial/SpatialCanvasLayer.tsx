'use client';

import { useEffect, useRef } from 'react';
import { useSpatialParallax } from './SpatialParallaxProvider';

type Star = {
  x: number;
  y: number;
  radius: number;
  alpha: number;
  twinkle: number;
};

function buildStars(count: number): Star[] {
  const stars: Star[] = [];
  let seed = 91;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  for (let i = 0; i < count; i += 1) {
    stars.push({
      x: rand(),
      y: rand(),
      radius: rand() * 1.2 + 0.25,
      alpha: rand() * 0.45 + 0.12,
      twinkle: rand() * Math.PI * 2,
    });
  }

  return stars;
}

const STARS = buildStars(110);

/**
 * Persistent spatial canvas — never unmounted between destination route changes.
 */
export function SpatialCanvasLayer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { offset } = useSpatialParallax();
  const driftRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    let frameId = 0;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const draw = (time: number) => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = window.innerWidth;
      const height = window.innerHeight;

      if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }

      driftRef.current = reduceMotion ? 0 : time * 0.00002;
      const driftX = driftRef.current * 28 + offset.background.x;
      const driftY = driftRef.current * 18 + offset.background.y;

      ctx.clearRect(0, 0, width, height);

      for (const star of STARS) {
        const twinkle = reduceMotion
          ? 1
          : 0.72 + Math.sin(time * 0.0012 + star.twinkle) * 0.28;
        const x = ((star.x * width + driftX) % width + width) % width;
        const y = ((star.y * height + driftY) % height + height) % height;

        ctx.beginPath();
        ctx.fillStyle = `rgba(186, 210, 255, ${star.alpha * twinkle})`;
        ctx.arc(x, y, star.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      frameId = window.requestAnimationFrame(draw);
    };

    frameId = window.requestAnimationFrame(draw);
    return () => window.cancelAnimationFrame(frameId);
  }, [offset.background.x, offset.background.y]);

  return (
    <div className="spatial-canvas" aria-hidden="true">
      <canvas ref={canvasRef} className="spatial-canvas__stars" />
      <div className="spatial-canvas__nebula spatial-canvas__nebula--violet" />
      <div className="spatial-canvas__nebula spatial-canvas__nebula--cyan" />
      <div className="spatial-canvas__vignette" />
    </div>
  );
}
