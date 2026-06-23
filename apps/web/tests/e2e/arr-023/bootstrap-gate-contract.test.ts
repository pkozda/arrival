import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const WEB_ROOT = join(import.meta.dirname, '../../..');

describe('BootstrapGate contract', () => {
  it('renders bootstrap error surface with retry binding (REL-02)', () => {
    const source = readFileSync(join(WEB_ROOT, 'src/components/BootstrapGate.tsx'), 'utf8');
    expect(source).toContain('data-ui-surface="bootstrap-error"');
    expect(source).toContain('SurfaceErrorPanel');
    expect(source).toContain('retryBootstrap');
  });
});
