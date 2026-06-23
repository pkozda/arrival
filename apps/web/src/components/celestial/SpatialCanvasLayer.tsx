'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useSpatialParallax } from './SpatialParallaxProvider';

type Star = {
  x: number;
  y: number;
  radius: number;
  opacity: number;
  twinkleSpeed: number;
  twinkleOffset: number;
};

type Particle = {
  x: number;
  y: number;
  size: number;
  driftX: number;
  driftY: number;
  duration: number;
};

function seededRandom(seed: number): () => number {
  let value = seed;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function buildStars(count: number): Star[] {
  const rand = seededRandom(42);
  return Array.from({ length: count }, () => ({
    x: rand(),
    y: rand(),
    radius: rand() * 1.4 + 0.3,
    opacity: rand() * 0.55 + 0.15,
    twinkleSpeed: rand() * 2 + 3,
    twinkleOffset: rand() * Math.PI * 2,
  }));
}

function buildParticles(count: number): Particle[] {
  const rand = seededRandom(99);
  return Array.from({ length: count }, () => ({
    x: rand() * 100,
    y: rand() * 100,
    size: rand() * 2 + 1,
    driftX: (rand() - 0.5) * 30,
    driftY: (rand() - 0.5) * 20,
    duration: rand() * 40 + 50,
  }));
}

const STARS = buildStars(320);
const PARTICLES = buildParticles(24);

/**
 * Persistent spatial canvas — never unmounted between destination route changes.
 */
export function SpatialCanvasLayer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { offset } = useSpatialParallax();
  const driftRef = useRef(0);

  const particles = useMemo(() => PARTICLES, []);

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
      const t = time * 0.001;

      ctx.clearRect(0, 0, width, height);

      for (const star of STARS) {
        const twinkle = reduceMotion
          ? 1
          : 0.55 + 0.45 * Math.sin(t * star.twinkleSpeed + star.twinkleOffset);
        const x = ((star.x * width + driftX) % width + width) % width;
        const y = ((star.y * height + driftY) % height + height) % height;

        ctx.beginPath();
        ctx.fillStyle = `rgba(220, 230, 255, ${star.opacity * twinkle})`;
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
      <div
        className="spatial-canvas__particles"
        style={{
          transform: `translate(${offset.background.x * 0.6}px, ${offset.background.y * 0.5}px)`,
        }}
      >
        {particles.map((particle, index) => (
          <span
            key={index}
            className="spatial-canvas__particle"
            style={{
              left: `${particle.x}%`,
              top: `${particle.y}%`,
              width: particle.size,
              height: particle.size,
              ['--drift-x' as string]: `${particle.driftX}px`,
              ['--drift-y' as string]: `${particle.driftY}px`,
              animationDuration: `${particle.duration}s`,
            }}
          />
        ))}
      </div>
      <div className="spatial-canvas__nebula spatial-canvas__nebula--violet" />
      <div className="spatial-canvas__nebula spatial-canvas__nebula--cyan" />
      <div className="spatial-canvas__vignette" />
    </div>
  );
}
