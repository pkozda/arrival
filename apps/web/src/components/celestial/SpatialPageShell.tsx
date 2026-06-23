'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { useCallback } from 'react';
import { AtlasHUD } from '@/components/atlas-home/AtlasHUD';
import { NodeTrace } from './NodeTrace';
import { SpatialContentLayer } from './SpatialContentLayer';
import { useArrival } from './ArrivalProvider';
import { useSpatialParallax } from './SpatialParallaxProvider';

type Props = {
  children: ReactNode;
};

/**
 * Vision Pro–style spatial shell: persistent depth, camera enter/exit, parallax layers.
 */
export function SpatialPageShell({ children }: Props) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const { spatialTransition, spatialPhase, setSpatialPhase, setEntryAnimationState } = useArrival();
  const { offset } = useSpatialParallax();

  const onSpatialEnter = useCallback(() => {
    setSpatialPhase('entering');
  }, [setSpatialPhase]);

  const onSpatialExit = useCallback(() => {
    setSpatialPhase('exiting');
  }, [setSpatialPhase]);

  const onEnterComplete = useCallback(() => {
    setSpatialPhase('landed');
    setEntryAnimationState('arrived');
  }, [setSpatialPhase, setEntryAnimationState]);

  return (
    <div className="spatial-page-shell" data-spatial-phase={spatialPhase}>
      <AtlasHUD />
      <motion.div
        className="spatial-page-shell__structure"
        style={
          reduceMotion
            ? undefined
            : {
                transform: `translate3d(${offset.midground.x}px, ${offset.midground.y}px, 0)`,
              }
        }
      >
        <NodeTrace />
        <AnimatePresence mode="wait" initial={false}>
          <SpatialContentLayer
            key={pathname}
            transition={spatialTransition}
            onSpatialEnter={onSpatialEnter}
            onSpatialExit={onSpatialExit}
            onEnterComplete={onEnterComplete}
          >
            {children}
          </SpatialContentLayer>
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
