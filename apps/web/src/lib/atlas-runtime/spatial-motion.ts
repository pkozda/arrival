import type { TargetAndTransition } from 'framer-motion';
import type { SpatialTransition } from './types';
import { spatialTransitionConfig } from '@/lib/celestial/spatial-easing';

type SpatialVariants = {
  initial: TargetAndTransition;
  animate: TargetAndTransition;
  exit: TargetAndTransition;
};

export function buildSpatialVariants(
  transition: SpatialTransition,
  reduceMotion: boolean
): SpatialVariants {
  const { originNodeTransform: origin, cameraMotion: cam } = transition;
  const originX = origin.x * 120;
  const originY = origin.y * 84;
  const enterBlur = Math.min(10, origin.blur + 5);
  const exitBlur = Math.min(8, origin.blur + 3);

  if (reduceMotion) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1, transition: { duration: 0.25 } },
      exit: { opacity: 0, transition: { duration: 0.2 } },
    };
  }

  const enterTransition = spatialTransitionConfig(transition.easingProfile, 'enter');
  const exitTransition = spatialTransitionConfig(transition.easingProfile, 'exit');

  const { motionPrimitive } = transition;

  const initial = {
    opacity: 0,
    scale: 1 + cam.zoomDelta,
    x: cam.panVector.x,
    y: cam.panVector.y,
    rotateZ: cam.rotationZ,
    filter: `blur(${enterBlur}px)`,
  };

  const animate = {
    opacity: 1,
    scale: 1,
    x: 0,
    y: 0,
    rotateZ: 0,
    filter: 'blur(0px)',
    transition: enterTransition,
  };

  const exitBase = {
    opacity: 0,
    rotateZ: -cam.rotationZ * 0.85,
    filter: `blur(${exitBlur}px)`,
    transition: exitTransition,
  };

  switch (motionPrimitive) {
    case 'collapse-to-node':
      return {
        initial,
        animate,
        exit: {
          ...exitBase,
          scale: origin.scale * 0.88,
          x: -originX * 0.72,
          y: -originY * 0.72,
        },
      };
    case 'expand-from-node':
      return {
        initial: {
          ...initial,
          scale: 1 + cam.zoomDelta * 1.35,
        },
        animate,
        exit: {
          ...exitBase,
          scale: origin.scale * 0.94,
          x: -originX * 0.55,
          y: -originY * 0.55,
        },
      };
    case 'focus-in':
      return {
        initial: {
          ...initial,
          scale: 1 + cam.zoomDelta * 0.85,
        },
        animate,
        exit: {
          ...exitBase,
          scale: 0.97,
          x: -originX * 0.35,
          y: -originY * 0.35,
        },
      };
    case 'ambient-shift':
      return {
        initial: {
          opacity: 0.92,
          scale: 1,
          x: cam.panVector.x * 0.4,
          y: cam.panVector.y * 0.4,
          rotateZ: 0,
          filter: `blur(${enterBlur * 0.5}px)`,
        },
        animate: {
          opacity: 1,
          scale: 1,
          x: 0,
          y: 0,
          rotateZ: 0,
          filter: 'blur(0px)',
          transition: { ...enterTransition, duration: 0.55 },
        },
        exit: {
          opacity: 0.88,
          scale: 1,
          x: cam.panVector.x * -0.3,
          y: cam.panVector.y * -0.3,
          rotateZ: 0,
          filter: `blur(${exitBlur * 0.4}px)`,
          transition: exitTransition,
        },
      };
    case 'drift':
    default:
      return {
        initial,
        animate,
        exit: {
          ...exitBase,
          scale: origin.scale * 0.94,
          x: -originX * 0.55,
          y: -originY * 0.55,
        },
      };
  }
}
