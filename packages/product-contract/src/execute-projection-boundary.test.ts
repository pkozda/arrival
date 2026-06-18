import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const apiSrcRoot = join(dirname(fileURLToPath(import.meta.url)), '../../../apps/api/src');

describe('execute projection API boundary policy', () => {
  it('uses projection response builder in execute route with legacy opt-in', () => {
    const source = readFileSync(join(apiSrcRoot, 'build-app.ts'), 'utf8');
    const executeHandler = source.slice(
      source.indexOf("'/api/modules/:id/execute'"),
      source.indexOf("'/api/modules/:id/trace'")
    );

    expect(source).toContain('buildProjectionExecuteResponse');
    expect(executeHandler).toContain('isLegacyExecuteContract');
    expect(executeHandler).not.toMatch(/return buildExecuteApiResponse\(/);
  });

  it('forbids default legacy execute fields in execute handler', () => {
    const source = readFileSync(join(apiSrcRoot, 'build-app.ts'), 'utf8');
    const executeHandler = source.slice(
      source.indexOf("'/api/modules/:id/execute'"),
      source.indexOf("'/api/modules/:id/trace'")
    );

    expect(executeHandler).not.toContain('attachUxToExecutionResult(result), moduleResult');
  });
});
