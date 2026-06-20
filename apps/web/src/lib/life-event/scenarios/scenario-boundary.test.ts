import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const scenariosRoot = join(__dirname);

function listSourceFiles(directory: string): string[] {
  const files: string[] = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isFile()) {
      continue;
    }
    if (!entry.name.endsWith('.ts')) {
      continue;
    }
    if (entry.name.endsWith('.test.ts')) {
      continue;
    }
    files.push(join(directory, entry.name));
  }

  return files;
}

describe('life event scenario boundary (LE-7)', () => {
  it('scenario layer does not import planner or presentation layers', () => {
    const violations: string[] = [];
    const forbidden = [
      'buildLifeEventPlan',
      'classifyLifeState',
      'projectActionSurface',
      'buildExecutionSurface',
      'buildHomePlanViewModelV2',
      'mergeP4WithPlan',
    ];

    for (const filePath of listSourceFiles(scenariosRoot)) {
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
