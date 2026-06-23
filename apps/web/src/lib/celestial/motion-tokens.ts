import type { ArrivalIntensity, ArrivalTransitionType } from './types';

export const CELESTIAL_EASE = [0.16, 1, 0.3, 1] as const;

const INTENSITY_SCALE: Record<ArrivalIntensity, number> = {
  low: 0.72,
  medium: 1,
  high: 1.18,
};

export function arrivalDuration(intensity: ArrivalIntensity): number {
  return 0.55 + 0.28 * INTENSITY_SCALE[intensity];
}

export function arrivalBlurPeak(intensity: ArrivalIntensity): number {
  return 2 + 4 * INTENSITY_SCALE[intensity];
}

export function transitionMotion(transitionType: ArrivalTransitionType, intensity: ArrivalIntensity) {
  const scale = INTENSITY_SCALE[intensity];

  switch (transitionType) {
    case 'warp':
      return {
        initial: { opacity: 0, scale: 1 + 0.1 * scale, filter: `blur(${arrivalBlurPeak(intensity)}px)` },
        animate: { opacity: 1, scale: 1, filter: 'blur(0px)' },
      };
    case 'zoom-collapse':
      return {
        initial: { opacity: 0, scale: 1 - 0.06 * scale, filter: `blur(${arrivalBlurPeak(intensity) * 0.75}px)` },
        animate: { opacity: 1, scale: 1, filter: 'blur(0px)' },
      };
    case 'fade-through-space':
    default:
      return {
        initial: { opacity: 0, y: 10 * scale, filter: `blur(${arrivalBlurPeak(intensity) * 0.6}px)` },
        animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
      };
  }
}
