import type { TargetAndTransition, Variant } from 'framer-motion';
import type { SpatialTransition } from './spatial-types';
import { spatialTransitionConfig } from './spatial-easing';

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

  const initial: Variant = {
    opacity: 0,
    scale: 1 + cam.zoomDelta,
    x: cam.panVector.x,
    y: cam.panVector.y,
    rotateZ: cam.rotationZ,
    filter: `blur(${enterBlur}px)`,
  };

  const animate: Variant = {
    opacity: 1,
    scale: 1,
    x: 0,
    y: 0,
    rotateZ: 0,
    filter: 'blur(0px)',
    transition: enterTransition,
  };

  const exit: Variant = {
    opacity: 0,
    scale: origin.scale * 0.94,
    x: -originX * 0.55,
    y: -originY * 0.55,
    rotateZ: -cam.rotationZ * 0.85,
    filter: `blur(${exitBlur}px)`,
    transition: exitTransition,
  };

  return { initial, animate, exit };
}
