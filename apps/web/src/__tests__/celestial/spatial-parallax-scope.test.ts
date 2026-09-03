import { describe, expect, it } from 'vitest';
import { isSpatialCursorParallaxEnabled } from '@/components/celestial/spatial-parallax-scope';
import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('spatial cursor parallax scope', () => {
  it('enables only for the Home star-map shell', () => {
    expect(isSpatialCursorParallaxEnabled('star-map')).toBe(true);
    expect(isSpatialCursorParallaxEnabled('destination')).toBe(false);
  });

  it('SpatialParallaxProvider gates listeners via shellMode helper', () => {
    const source = readFileSync(
      path.join(
        process.cwd(),
        'src/components/celestial/SpatialParallaxProvider.tsx'
      ),
      'utf8'
    );
    expect(source).toContain('isSpatialCursorParallaxEnabled');
    expect(source).toContain('useAtlasRuntime');
    expect(source).toContain('shellMode');
  });

  it('AtlasRuntime derives star-map only for pathname /', () => {
    const source = readFileSync(
      path.join(process.cwd(), 'src/components/atlas-runtime/AtlasRuntimeProvider.tsx'),
      'utf8'
    );
    expect(source).toContain("pathname === '/' ? 'star-map' : 'destination'");
  });
});
