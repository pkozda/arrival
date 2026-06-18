import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const webSrcRoot = join(dirname(fileURLToPath(import.meta.url)), '../../../apps/web/src');
const webPackageJson = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../../../apps/web/package.json'),
  'utf8'
);

const FORBIDDEN_PACKAGE_IMPORTS = [
  '@arrivalos/core',
  '@arrivalos/module-runtime',
  '@arrivalos/modules',
  '@arrivalos/observability',
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

describe('web package boundary policy', () => {
  it('does not declare forbidden runtime dependencies in apps/web/package.json', () => {
    for (const pkg of FORBIDDEN_PACKAGE_IMPORTS) {
      expect(webPackageJson).not.toContain(`"${pkg}"`);
    }
  });

  it('forbids runtime package imports anywhere in apps/web/src', () => {
    const violations: string[] = [];

    for (const filePath of listSourceFiles(webSrcRoot)) {
      const source = readFileSync(filePath, 'utf8');
      for (const pkg of FORBIDDEN_PACKAGE_IMPORTS) {
        if (source.includes(`from '${pkg}'`) || source.includes(`from "${pkg}"`)) {
          violations.push(`${filePath}: ${pkg}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('requires module catalog and schema clients in web api layer', () => {
    const apiSource = readFileSync(join(webSrcRoot, 'lib/api.ts'), 'utf8');

    expect(apiSource).toContain('fetchModuleCatalog');
    expect(apiSource).toContain('fetchModuleSchema');
    expect(apiSource).not.toContain('interface UiSnapshot');
    expect(apiSource).not.toContain('interface ModuleInfo');
  });

  it('uses contract-driven module page shell', () => {
    const modulePageSource = readFileSync(
      join(webSrcRoot, 'app/modules/[moduleId]/page.tsx'),
      'utf8'
    );
    const headerSource = readFileSync(join(webSrcRoot, 'components/Header.tsx'), 'utf8');

    expect(modulePageSource).toContain('ContractModulePage');
    expect(modulePageSource).toContain('modules.find');
    expect(headerSource).not.toContain('NAV_ITEMS');
    expect(headerSource).toContain('navModules');
  });
});
