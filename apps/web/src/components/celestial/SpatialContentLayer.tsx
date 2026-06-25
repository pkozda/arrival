'use client';

import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';
import { buildSpatialVariants } from '@/lib/atlas-runtime/spatial-motion';
import { spatialTransitionConfig } from '@/lib/celestial/spatial-easing';
import type { SpatialTransition } from '@/lib/atlas-runtime';
import { useSpatialParallax } from './SpatialParallaxProvider';
import { useSpatialLifecycle } from './useSpatialLifecycle';

type Props = {
  children: ReactNode;
  transition: SpatialTransition;
  onSpatialEnter?: () => void;
  onSpatialExit?: () => void;
  onEnterComplete?: () => void;
};

export function SpatialContentLayer({
  children,
  transition,
  onSpatialEnter,
  onSpatialExit,
  onEnterComplete,
}: Props) {
  const reduceMotion = useReducedMotion();
  const { offset } = useSpatialParallax();
  const baseVariants = buildSpatialVariants(transition, Boolean(reduceMotion));
  const enterTransition = spatialTransitionConfig(
    transition.easingProfile,
    'enter',
    transition.durationScale ?? 1
  );

  const variants = {
    ...baseVariants,
    animate: {
      ...baseVariants.animate,
      transition: {
        ...(typeof baseVariants.animate === 'object' &&
        baseVariants.animate !== null &&
        'transition' in baseVariants.animate
          ? baseVariants.animate.transition
          : enterTransition),
        onComplete: onEnterComplete,
      },
    },
  };

  useSpatialLifecycle({ onSpatialEnter, onSpatialExit });

  return (
    <motion.div
      className="spatial-content-layer"
      initial="initial"
      animate="animate"
      exit="exit"
      variants={variants}
    >
      <div className="spatial-content-layer__midground">
        <div
          className="spatial-content-layer__foreground"
          style={
            reduceMotion
              ? undefined
              : {
                  transform: `translate3d(${offset.foreground.x - offset.midground.x}px, ${offset.foreground.y - offset.midground.y}px, 0)`,
                }
          }
        >
          {children}
        </div>
      </div>
    </motion.div>
  );
}
