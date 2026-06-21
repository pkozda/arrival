import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const webSrcRoot = join(__dirname, '../..');
const economicRealityRoot = join(__dirname, '.');

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

describe('economic reality boundary (EP-8)', () => {
  it('web economic-reality client calls EP-7 plan API only', () => {
    const clientSource = readFileSync(join(economicRealityRoot, 'client.ts'), 'utf8');
    expect(clientSource).toContain('/api/modules/economic-reality/plan');
    expect(clientSource).not.toContain('/api/mutations');
  });

  it('EP-8 layer does not import EP-1–EP-6 engine functions', () => {
    const violations: string[] = [];
    const forbidden = [
      'buildEconomicRealityPlan',
      'evaluate(',
      'resolveGraphContext',
      'buildExecutionState',
      'buildActionSet',
      'buildPlan',
      'buildPresentation',
      'classifyEconomicState',
    ];

    for (const filePath of listSourceFiles(economicRealityRoot)) {
      const source = readFileSync(filePath, 'utf8');
      for (const pattern of forbidden) {
        if (source.includes(pattern)) {
          violations.push(`${filePath}: ${pattern}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('web source outside economic-reality does not import engine planner paths', () => {
    const violations: string[] = [];
    const forbidden = ['buildEconomicRealityPlan', 'resolveGraphContext', 'buildActionSet'];

    for (const filePath of listSourceFiles(webSrcRoot)) {
      if (filePath.includes('/lib/economic-reality/')) {
        continue;
      }
      if (filePath.includes('/modules/economic-reality/')) {
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
