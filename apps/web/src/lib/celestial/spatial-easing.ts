import type { Transition } from 'framer-motion';
import type { SpatialEasingProfile } from './spatial-types';
import { CELESTIAL_EASE } from './motion-tokens';

export function spatialTransitionConfig(
  profile: SpatialEasingProfile,
  phase: 'enter' | 'exit'
): Transition {
  const durationScale = phase === 'exit' ? 0.72 : 1;

  switch (profile) {
    case 'soft-inertia':
      return {
        type: 'spring',
        stiffness: phase === 'enter' ? 240 : 300,
        damping: phase === 'enter' ? 26 : 32,
        mass: 0.92,
        restDelta: 0.001,
      };
    case 'elastic-drift':
      return {
        type: 'spring',
        stiffness: phase === 'enter' ? 170 : 220,
        damping: phase === 'enter' ? 20 : 28,
        mass: 1.05,
        restDelta: 0.001,
      };
    case 'linear-glide':
    default:
      return {
        type: 'tween',
        duration: (phase === 'enter' ? 0.78 : 0.52) * durationScale,
        ease: CELESTIAL_EASE,
      };
  }
}
