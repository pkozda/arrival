import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { buildEconomicRealityPlan } from '@arrival-atlas/modules/economic-reality';
import { ECONOMIC_FIXTURES } from '@arrival-atlas/modules/economic-reality';
import { resolveCopy } from '@arrival-atlas/modules';
import { ER_COPY_KEYS } from '@arrival-atlas/product-contract';

const uiRoot = join(__dirname, '../ui');
const navRoot = join(__dirname, '../../../app-shell/navigation');

function listUiFiles(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.tsx')) {
      continue;
    }
    if (entry.name.endsWith('.test.ts')) {
      continue;
    }
    files.push(join(entry.parentPath ?? directory, entry.name));
  }
  return files;
}

describe('EP-11 i18n + copy governance', () => {
  it('resolves all registered DE keys', () => {
    for (const key of Object.values(ER_COPY_KEYS)) {
      expect(resolveCopy(key, 'de').length).toBeGreaterThan(0);
    }
  });

  it('presentation from pipeline contains only titleKey and labelKey fields', () => {
    const response = buildEconomicRealityPlan(ECONOMIC_FIXTURES[2]!.userContext, {
      requestId: 'req_ep11',
      generatedAt: '2026-06-21T12:00:00.000Z',
    });

    const serialized = JSON.stringify(response.presentation);
    expect(serialized).not.toContain('"title":');
    expect(serialized).not.toContain('"label":');
    expect(serialized).toContain('"titleKey":');
    expect(serialized).toContain('"labelKey":');
  });

  it('action set uses labelKey for all actions', () => {
    const response = buildEconomicRealityPlan(ECONOMIC_FIXTURES[2]!.userContext, {
      requestId: 'req_ep11_actions',
      generatedAt: '2026-06-21T12:00:00.000Z',
    });

    for (const action of response.actionSet.actions) {
      expect(action.labelKey.startsWith('ER.')).toBe(true);
      if (action.payload.systemIntent) {
        expect(action.payload.intentKey?.startsWith('ER.INTENT.')).toBe(true);
      }
    }
  });

  it('navigation uses labelKey not hardcoded label', () => {
    const modulesSource = readFileSync(join(navRoot, 'modules.ts'), 'utf8');
    expect(modulesSource).toContain('labelKey');
    expect(modulesSource).not.toMatch(/label:\s*'Economic Reality'/);
  });

  it('UI tree resolves copy via useEconomicCopy without embedded section titles', () => {
    const forbiddenUiStrings = [
      'Primary path',
      'Supporting tasks',
      'System resources',
      'Open Economic Reality plan',
      'Economic Reality plan',
    ];
    const violations: string[] = [];

    for (const filePath of listUiFiles(uiRoot)) {
      const source = readFileSync(filePath, 'utf8');
      expect(source).toContain('useEconomicCopy');
      for (const phrase of forbiddenUiStrings) {
        if (source.includes(phrase)) {
          violations.push(`${filePath}: ${phrase}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
