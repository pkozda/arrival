import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const webSrcRoot = join(dirname(fileURLToPath(import.meta.url)), '../../../apps/web/src');

const ALLOWED_FILES = new Set<string>();

const FORBIDDEN_UI_PATTERNS = [
  '@arrival-atlas/core',
  '@arrival-atlas/module-runtime',
  '@arrival-atlas/modules',
  '@arrival-atlas/observability',
  'moduleResult',
  'result?.data',
  'result.data',
  '@arrival-atlas/module-runtime',
  'GovernedModuleRegistry',
  'globalRegistry',
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
      (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) &&
      !entry.name.endsWith('.test.ts') &&
      !entry.name.endsWith('.test.tsx')
    ) {
      files.push(fullPath);
    }
  }

  return files;
}

describe('UI projection boundary policy', () => {
  it('requires ModuleUIProjection usage in execute client code', () => {
    const apiSource = readFileSync(join(webSrcRoot, 'lib/api.ts'), 'utf8');
    const contractSource = readFileSync(join(webSrcRoot, 'lib/product-contract.ts'), 'utf8');

    expect(contractSource).toContain('ModuleUIProjection');
    expect(apiSource).toContain('executeModule');
    expect(apiSource).not.toContain('interface ModuleResult');
  });

  it('forbids legacy execute response parsing patterns in module pages', () => {
    const violations: string[] = [];
    const modulePages = listSourceFiles(join(webSrcRoot, 'app/modules'));

    for (const filePath of modulePages) {
      const source = readFileSync(filePath, 'utf8');
      for (const pattern of ['res.success', 'res.error', 'res.data', 'toModuleResult']) {
        if (source.includes(pattern)) {
          violations.push(`${filePath}: ${pattern}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('forbids runtime registry imports and legacy envelope parsing in web sources', () => {
    const violations: string[] = [];

    for (const filePath of listSourceFiles(webSrcRoot)) {
      if (ALLOWED_FILES.has(filePath)) {
        continue;
      }

      const source = readFileSync(filePath, 'utf8');
      for (const pattern of FORBIDDEN_UI_PATTERNS) {
        if (source.includes(pattern)) {
          violations.push(`${filePath}: ${pattern}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('renders module output through ModuleProjectionRenderer', () => {
    const rendererSource = readFileSync(
      join(webSrcRoot, 'components/ModuleProjectionRenderer.tsx'),
      'utf8'
    );

    expect(rendererSource).toContain('ModuleUIProjection');
    expect(rendererSource).not.toContain('.data');
    expect(rendererSource).not.toContain('.ux');
  });
});
