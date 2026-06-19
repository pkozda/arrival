import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const webSrcRoot = join(dirname(fileURLToPath(import.meta.url)), '../../../apps/web/src');
const explainPanelSource = readFileSync(join(webSrcRoot, 'components/ExplainPanel.tsx'), 'utf8');

const FORBIDDEN_EXPLAIN_PATTERNS = [
  '/trace',
  'moduleResult',
  'reason-mapping',
  'buildExplanationView',
  'GovernedModuleRegistry',
  'RegisteredModuleContract',
  'globalRegistry',
  '@arrival-atlas/module-runtime',
  'projection.explanation',
  'recommendation.reason',
] as const;

const FORBIDDEN_EXPLAIN_WORDS = [
  'governance',
  'registry',
  'normalizer',
  'pipeline',
  'authorization',
  'execution constraints',
  'trace',
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

describe('explain UI boundary policy', () => {
  it('exposes ModuleExplanationView through product contract client', () => {
    const apiSource = readFileSync(join(webSrcRoot, 'lib/api.ts'), 'utf8');
    const contractSource = readFileSync(join(webSrcRoot, 'lib/product-contract.ts'), 'utf8');

    expect(apiSource).toContain('ModuleExplanationView');
    expect(apiSource).toContain('fetchModuleExplanation');
    expect(contractSource).toContain('ModuleExplanationView');
  });

  it('loads explanations only through fetchModuleExplanation', () => {
    const violations: string[] = [];

    for (const filePath of listSourceFiles(webSrcRoot)) {
      const source = readFileSync(filePath, 'utf8');
      if (!source.includes('explain')) {
        continue;
      }

      if (source.includes('/explain') && !source.includes('fetchModuleExplanation')) {
        violations.push(`${filePath}: direct /explain usage without fetchModuleExplanation`);
      }

      if (source.includes('buildExplanationView')) {
        violations.push(`${filePath}: buildExplanationView`);
      }
    }

    expect(violations).toEqual([]);
  });

  it('forbids trace usage and projection-based reasoning reconstruction in web sources', () => {
    const violations: string[] = [];

    for (const filePath of listSourceFiles(webSrcRoot)) {
      const source = readFileSync(filePath, 'utf8');
      for (const pattern of FORBIDDEN_EXPLAIN_PATTERNS) {
        if (source.includes(pattern)) {
          violations.push(`${filePath}: ${pattern}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('keeps explain panel language product-facing', () => {
    const lowerSource = explainPanelSource.toLowerCase();
    const violations = FORBIDDEN_EXPLAIN_WORDS.filter((word) => lowerSource.includes(word));

    expect(violations).toEqual([]);
    expect(explainPanelSource).toContain('triggeredBecause');
    expect(explainPanelSource).toContain('ModuleExplanationView');
  });

  it('routes module and home execution views through explain-aware components', () => {
    const modulePageSource = readFileSync(
      join(webSrcRoot, 'app/modules/[moduleId]/page.tsx'),
      'utf8'
    );
    const contractPageSource = readFileSync(
      join(webSrcRoot, 'components/ContractModulePage.tsx'),
      'utf8'
    );
    const homeSource = readFileSync(
      join(webSrcRoot, 'components/home/HomeSnapshotRenderer.tsx'),
      'utf8'
    );
    const projectionRendererSource = readFileSync(
      join(webSrcRoot, 'components/ModuleProjectionRenderer.tsx'),
      'utf8'
    );

    expect(modulePageSource).toContain('ContractModulePage');
    expect(contractPageSource).toContain('fetchModuleSchema');
    expect(contractPageSource).toContain('registerExecution');
    expect(homeSource).toContain('ExecutionExplainToggle');
    expect(projectionRendererSource).not.toContain('Why this result');
    expect(projectionRendererSource).not.toContain('recommendation.reason');
  });
});
