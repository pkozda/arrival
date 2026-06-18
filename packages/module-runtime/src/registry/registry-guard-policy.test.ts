import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const apiSrcRoot = join(dirname(fileURLToPath(import.meta.url)), '../../../../apps/api/src');

function listSourceFiles(directory: string): string[] {
  const entries = readdirSync(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...listSourceFiles(fullPath));
      continue;
    }

    if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
      files.push(fullPath);
    }
  }

  return files;
}

describe('governance execution policy', () => {
  it('forbids unguarded globalRegistry.execute in API production sources', () => {
    const violations: string[] = [];

    for (const filePath of listSourceFiles(apiSrcRoot)) {
      const source = readFileSync(filePath, 'utf8');
      if (source.includes('globalRegistry.execute(')) {
        violations.push(filePath);
      }
    }

    expect(violations).toEqual([]);
  });

  it('forbids token-based guarded execution in API production sources', () => {
    const forbiddenPatterns = [
      'GUARDED_EXECUTION_TOKEN',
      'executeGuardedModule(',
      'executeGuarded(',
      'FrozenModuleContractRegistry',
    ];
    const violations: string[] = [];

    for (const filePath of listSourceFiles(apiSrcRoot)) {
      const source = readFileSync(filePath, 'utf8');
      for (const pattern of forbiddenPatterns) {
        if (source.includes(pattern)) {
          violations.push(`${filePath}: ${pattern}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('requires executeGovernedModule in module execute route', () => {
    const buildAppSource = readFileSync(join(apiSrcRoot, 'build-app.ts'), 'utf8');
    expect(buildAppSource).toContain('executeGovernedModule(');
    expect(buildAppSource).toContain('bootstrapGovernedRuntime');
  });
});
