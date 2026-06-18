import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const apiSrcRoot = join(dirname(fileURLToPath(import.meta.url)), '../../../apps/api/src');

describe('explain API boundary policy', () => {
  it('uses buildModuleExplanationResponse without execute in explain route', () => {
    const source = readFileSync(join(apiSrcRoot, 'build-app.ts'), 'utf8');
    const explainHandler = source.slice(
      source.indexOf("'/api/modules/:id/explain'"),
      source.indexOf('await registerProfileRoutes(app)')
    );

    expect(source).toContain('buildModuleExplanationResponse');
    expect(explainHandler).toContain('executionId');
    expect(explainHandler).not.toContain('executeGovernedModule');
    expect(explainHandler).not.toContain('enrichModuleResult');
  });

  it('loads explanation from stored execution only', () => {
    const source = readFileSync(join(apiSrcRoot, 'module-explain.ts'), 'utf8');

    expect(source).toContain('resolveExecutionResult');
    expect(source).toContain('buildExplanationView');
    expect(source).not.toContain('executeGovernedModule');
    expect(source).not.toContain('getLatestTrace');
  });
});
