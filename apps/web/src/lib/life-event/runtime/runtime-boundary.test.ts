import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const runtimeRoot = join(__dirname);

function listSourceFiles(directory: string): string[] {
  const files: string[] = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isFile()) {
      continue;
    }
    if (!entry.name.endsWith('.ts') && !entry.name.endsWith('.tsx')) {
      continue;
    }
    if (entry.name.endsWith('.test.ts')) {
      continue;
    }
    files.push(join(directory, entry.name));
  }

  return files;
}

describe('life event runtime boundary (LE-8)', () => {
  it('runtime layer does not import upstream planning or presentation layers', () => {
    const violations: string[] = [];
    const forbidden = [
      'buildLifeEventPlan',
      'classifyLifeState',
      'projectActionSurface',
      'buildExecutionSurface',
      'buildHomePlanViewModelV2',
      'resolveScenario',
      'LifeEventPlanV1',
      'ActionSurfaceV1',
      'ExecutionSurfaceV1',
    ];

    for (const filePath of listSourceFiles(runtimeRoot)) {
      const source = readFileSync(filePath, 'utf8');
      for (const pattern of forbidden) {
        if (source.includes(pattern)) {
          violations.push(`${filePath}: ${pattern}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
