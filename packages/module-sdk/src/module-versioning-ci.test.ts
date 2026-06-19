import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateModuleVersioningCatalog } from './validateModuleVersioning.js';

describe('module versioning CI gate', () => {
  it('matches the committed module version baseline', async () => {
    const { compiledModuleCatalog } = await import('@arrival-atlas/modules');
    const moduleVersionBaseline = JSON.parse(
      readFileSync(
        join(dirname(fileURLToPath(import.meta.url)), '../baselines/module-version-baseline.json'),
        'utf8'
      )
    );

    const violations = validateModuleVersioningCatalog({
      modules: Object.entries(compiledModuleCatalog.fingerprintsByModuleId).map(
        ([moduleId, fingerprints]) => ({
          moduleId,
          version:
            compiledModuleCatalog.contracts.find((contract) => contract.moduleId === moduleId)
              ?.version ?? '',
          fingerprints,
        })
      ),
      baseline: moduleVersionBaseline,
    });

    expect(violations).toEqual([]);
  });

  it('documents the module versioning policy', () => {
    const policyPath = join(
      dirname(fileURLToPath(import.meta.url)),
      '../../../docs/platform/module-versioning-policy.md'
    );
    const policy = readFileSync(policyPath, 'utf8');

    expect(policy).toContain('MAJOR');
    expect(policy).toContain('hashZodSchema');
  });
});
