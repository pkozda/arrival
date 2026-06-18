import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const webSrcRoot = join(dirname(fileURLToPath(import.meta.url)), '../../../../apps/web/src');

const FORBIDDEN_UI_PATTERNS = [
  'ModuleResult',
  'ExecutionResult',
  'GovernedModuleRegistry',
  'RegisteredModuleContract',
  'globalRegistry',
  'executions[].result',
  'execution.result',
  'uxSnapshot',
] as const;

function listSourceFiles(directory: string): string[] {
  const entries = readdirSync(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...listSourceFiles(fullPath));
      continue;
    }

    if (
      (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))
      && !entry.name.endsWith('.test.ts')
      && !entry.name.endsWith('.test.tsx')
    ) {
      files.push(fullPath);
    }
  }

  return files;
}

describe('UiSnapshot boundary policy', () => {
  it('forbids runtime imports and legacy snapshot parsing in web sources', () => {
    const violations: string[] = [];

    for (const filePath of listSourceFiles(webSrcRoot)) {
      const source = readFileSync(filePath, 'utf8');
      for (const pattern of FORBIDDEN_UI_PATTERNS) {
        if (source.includes(pattern)) {
          violations.push(`${filePath}: ${pattern}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('requires projection-based snapshot types in web contract client', () => {
    const contractSource = readFileSync(join(webSrcRoot, 'lib/product-contract.ts'), 'utf8');

    expect(contractSource).toContain('ExecutionSnapshot');
    expect(contractSource).toContain('ActionCard');
    expect(contractSource).toContain('SnapshotRecommendation');
    expect(contractSource).toContain('ModuleSnapshotSummary');
    expect(contractSource).toContain('UiSnapshot');
  });

  it('renders home snapshot through ModuleUIProjection', () => {
    const homeSource = readFileSync(
      join(webSrcRoot, 'components/home/HomeSnapshotRenderer.tsx'),
      'utf8'
    );

    expect(homeSource).toContain('ModuleProjectionRenderer');
    expect(homeSource).not.toContain('JSON.stringify(execution.result');
  });
});
