import type { Transition } from 'framer-motion';
import type { SpatialEasingProfile } from './spatial-types';
import { CELESTIAL_EASE } from './motion-tokens';

export function spatialTransitionConfig(
  profile: SpatialEasingProfile,
  phase: 'enter' | 'exit',
  durationScale = 1
): Transition {
  const phaseScale = phase === 'exit' ? 0.72 : 1;
  const combinedScale = phaseScale * durationScale;

  switch (profile) {
    case 'soft-inertia':
      return {
        type: 'spring',
        stiffness: Math.round((phase === 'enter' ? 240 : 300) / durationScale),
        damping: phase === 'enter' ? 26 : 32,
        mass: 0.92 * durationScale,
        restDelta: 0.001,
      };
    case 'elastic-drift':
      return {
        type: 'spring',
        stiffness: Math.round((phase === 'enter' ? 170 : 220) / durationScale),
        damping: phase === 'enter' ? 20 : 28,
        mass: 1.05 * durationScale,
        restDelta: 0.001,
      };
    case 'linear-glide':
    default:
      return {
        type: 'tween',
        duration: (phase === 'enter' ? 0.78 : 0.52) * combinedScale,
        ease: CELESTIAL_EASE,
      };
  }
}
