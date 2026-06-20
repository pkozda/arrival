import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const webSrcRoot = join(__dirname, '../..');

function listSourceFiles(directory: string): string[] {
  const files: string[] = [];

  for (const entry of readdirSync(directory, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile()) {
      continue;
    }
    if (!entry.name.endsWith('.ts') && !entry.name.endsWith('.tsx')) {
      continue;
    }
    if (entry.name.endsWith('.test.ts')) {
      continue;
    }
    files.push(join(entry.parentPath ?? directory, entry.name));
  }

  return files;
}

describe('life event plan boundary (LE-3)', () => {
  it('web life-event-plan client calls plan API only', () => {
    const clientSource = readFileSync(join(__dirname, 'client.ts'), 'utf8');
    expect(clientSource).toContain('/api/modules/life-event/plan');
    expect(clientSource).not.toContain('/api/mutations');
  });

  it('web source does not import LE-1 planner functions', () => {
    const violations: string[] = [];
    const forbidden = [
      'buildLifeEventPlan',
      'classifyLifeState',
      'GRAPH_CATALOG_V1',
      'resolveGraph',
      'computeSituationSignals',
    ];

    for (const filePath of listSourceFiles(webSrcRoot)) {
      if (filePath.includes('/lib/life-event-plan/life-event-plan.test.ts')) {
        continue;
      }
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
