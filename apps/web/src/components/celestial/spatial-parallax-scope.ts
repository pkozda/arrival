import type { AtlasShellMode } from '@/lib/atlas-runtime';

/**
 * Cursor-driven SpatialParallax is scoped to the Home (star-map) shell only.
 * Destination routes (Discovery, modules, etc.) keep a static spatial frame.
 * Homepage guest/member map parallax uses `useAtlasParallax` separately.
 */
export function isSpatialCursorParallaxEnabled(shellMode: AtlasShellMode): boolean {
  return shellMode === 'star-map';
}
