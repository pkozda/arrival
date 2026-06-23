import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const WEB_ROOT = join(import.meta.dirname, '../../..');
const SRC = join(WEB_ROOT, 'src');

const P0_SURFACE_BINDINGS = [
  { id: 'UX-RETRY-BOOT', marker: 'data-ui-surface="bootstrap-error"' },
  { id: 'UX-RETRY-H', marker: 'data-ui-surface="home-next-steps"' },
  { id: 'UX-RETRY-ER-H', marker: 'data-ui-surface="economic-reality-home-card"' },
  { id: 'UX-RETRY-LE', marker: 'data-ui-surface="life-event-module-body"' },
  { id: 'UX-RETRY-ER', marker: 'data-ui-surface="economic-reality-module-body"' },
  { id: 'UX-ENG-01', marker: 'data-ui-surface="error-panel"' },
  { id: 'REL-05', marker: 'data-ui-surface="profile-load-error"' },
] as const;

function readSrc(relativePath: string): string {
  return readFileSync(join(SRC, relativePath), 'utf8');
}

/** Contract consistency — runtime markers map to EXECUTION-LOCK surfaces. */
describe('ARR-023 P0 surface contract lock', () => {
  it('maps every retry surface ID to a data-ui-surface marker in source', () => {
    const corpus = [
      readSrc('components/BootstrapGate.tsx'),
      readSrc('lib/presentation/le-ux/components/HomeLifeEventWireframe.tsx'),
      readSrc('components/home/HomeSecondaryContext.tsx'),
      readSrc('components/home/EconomicRealityCard.tsx'),
      readSrc('app/modules/life-event/page.tsx'),
      readSrc('modules/economic-reality/ui/EconomicRealityPage.tsx'),
      readSrc('components/surface/SurfaceErrorPanel.tsx'),
      readSrc('components/ProfileLoadErrorBanner.tsx'),
    ].join('\n');

    for (const binding of P0_SURFACE_BINDINGS) {
      expect(corpus, `${binding.id} missing ${binding.marker}`).toContain(binding.marker);
    }
  });

  it('wires SurfaceErrorPanel retry on all P0 failure paths', () => {
    expect(readSrc('lib/presentation/le-ux/components/HomeLifeEventWireframe.tsx')).toContain(
      'SurfaceErrorPanel'
    );
    expect(readSrc('components/home/HomeSecondaryContext.tsx')).toContain('handleRetry');
    expect(readSrc('components/home/EconomicRealityCard.tsx')).toContain('SurfaceErrorPanel');
    expect(readSrc('app/modules/life-event/page.tsx')).toContain('SurfaceErrorPanel');
    expect(readSrc('modules/economic-reality/ui/EconomicRealityPage.tsx')).toContain(
      'SurfaceErrorPanel'
    );
    expect(readSrc('components/BootstrapGate.tsx')).toContain('SurfaceErrorPanel');
  });

  it('registers Playwright specs for E2E-01 and E2E-03', () => {
    const e2eDir = join(WEB_ROOT, 'tests/e2e/arr-023');
    expect(readFileSync(join(e2eDir, 'e2e-01-first-visit.spec.ts'), 'utf8')).toContain('E2E-01');
    expect(readFileSync(join(e2eDir, 'e2e-03-profile-update.spec.ts'), 'utf8')).toContain('E2E-03');
  });
});
