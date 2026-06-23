'use client';

import { useEffect, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import type { AtlasLoadPhase } from './useAtlasLoadSequence';
import type { ParallaxOffset } from './useAtlasParallax';

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
    x: rand() * 100,
    y: rand() * 100,
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

const CONSTELLATION_LINES: Array<[number, number, number, number]> = [
  [18, 22, 32, 18],
  [32, 18, 48, 28],
  [48, 28, 62, 20],
  [62, 20, 78, 32],
  [22, 45, 38, 52],
  [38, 52, 55, 48],
  [55, 48, 72, 55],
  [28, 68, 45, 72],
  [45, 72, 58, 65],
  [58, 65, 75, 78],
  [40, 35, 55, 48],
  [48, 28, 55, 48],
];

type Props = {
  loadPhase: AtlasLoadPhase;
  starsOffset: ParallaxOffset;
  constellationOffset: ParallaxOffset;
};

export function AtlasAmbientLayers({ loadPhase, starsOffset, constellationOffset }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stars = useMemo(() => buildStars(320), []);
  const particles = useMemo(() => buildParticles(28), []);
  const starsVisible = loadPhase >= 1;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frame = 0;
    let raf = 0;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener('resize', resize);

    const draw = (time: number) => {
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      ctx.clearRect(0, 0, w, h);

      if (!starsVisible) {
        raf = requestAnimationFrame(draw);
        return;
      }

      const t = time * 0.001;

      for (const star of stars) {
        const twinkle =
          0.55 +
          0.45 * Math.sin(t * star.twinkleSpeed + star.twinkleOffset);
        const alpha = star.opacity * twinkle * (loadPhase >= 1 ? 1 : 0);

        ctx.beginPath();
        ctx.arc((star.x / 100) * w, (star.y / 100) * h, star.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(220, 230, 255, ${alpha})`;
        ctx.fill();
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(raf);
    };
  }, [stars, starsVisible, loadPhase]);

  return (
    <div className="atlas-ambient" aria-hidden="true">
      <motion.div
        className="atlas-ambient__layer atlas-ambient__layer--stars"
        style={{
          transform: `translate(${starsOffset.x}px, ${starsOffset.y}px)`,
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: starsVisible ? 1 : 0 }}
        transition={{ duration: 0.9, ease: 'easeOut' }}
      >
        <canvas ref={canvasRef} className="atlas-ambient__star-canvas" />
      </motion.div>

      <motion.div
        className="atlas-ambient__layer atlas-ambient__layer--particles"
        style={{
          transform: `translate(${starsOffset.x * 0.6}px, ${starsOffset.y * 0.5}px)`,
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: loadPhase >= 1 ? 1 : 0 }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
      >
        {particles.map((particle, index) => (
          <span
            key={index}
            className="atlas-ambient__particle"
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
      </motion.div>

      <motion.svg
        className="atlas-ambient__layer atlas-ambient__layer--constellation"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{
          transform: `translate(${constellationOffset.x}px, ${constellationOffset.y}px)`,
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: loadPhase >= 2 ? 0.35 : 0 }}
        transition={{ duration: 1, ease: 'easeOut' }}
      >
        {CONSTELLATION_LINES.map(([x1, y1, x2, y2], index) => (
          <line
            key={index}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            className="atlas-ambient__constellation-line"
          />
        ))}
      </motion.svg>

      <div className="atlas-ambient__vignette" />
    </div>
  );
}
