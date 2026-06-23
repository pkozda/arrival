'use client';

import { SpatialCanvasLayer } from '@/components/celestial/SpatialCanvasLayer';
import { useAtlasRuntime } from './AtlasRuntimeProvider';

type Props = {
  /** When star-map mode, canvas stays mounted but visually recessive. */
};

/**
 * Persistent spatial canvas — single background authority across the app runtime.
 * Never unmounted between route changes.
 */
export function PersistentSpatialCanvas(_props: Props) {
  const { shellMode } = useAtlasRuntime();

  return (
    <div
      className="persistent-spatial-canvas"
      data-shell-mode={shellMode}
      aria-hidden="true"
    >
      <SpatialCanvasLayer />
    </div>
  );
}
