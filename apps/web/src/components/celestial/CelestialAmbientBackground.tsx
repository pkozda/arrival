'use client';

export function CelestialAmbientBackground() {
  return (
    <div className="celestial-ambient" aria-hidden="true">
      <div className="celestial-ambient__gradient" />
      <div className="celestial-ambient__noise" />
      <div className="celestial-ambient__glow celestial-ambient__glow--left" />
      <div className="celestial-ambient__glow celestial-ambient__glow--right" />
    </div>
  );
}
