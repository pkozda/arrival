import { describe, expect, it, beforeEach } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { buildEconomicRealityPlan } from '@arrival-atlas/modules/economic-reality';
import { ECONOMIC_FIXTURES } from '@arrival-atlas/modules/economic-reality';
import { ECONOMIC_REALITY_SURFACE_V1 } from '@arrival-atlas/product-contract';
import { shouldShowEconomicRealitySurface } from '@/app-shell/navigation/visibility';
import {
  bindEconomicActionContext,
  clearEconomicActionContext,
  executeEconomicAction,
  hydrateEconomicPlan,
  reconcileEconomicPlanState,
} from '@/lib/economic-reality';
import { adaptPresentationToUi } from '@/lib/economic-reality';

const FIXED_META = {
  requestId: 'req_ep9_test',
  generatedAt: '2026-06-21T12:00:00.000Z',
};

const uiRoot = join(__dirname, '../ui');
const webModulesRoot = join(__dirname, '../../..');

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

function buildFixtureResponse(fixtureId: string) {
  const fixture = ECONOMIC_FIXTURES.find((entry) => entry.id === fixtureId)!;
  return buildEconomicRealityPlan(fixture.userContext, FIXED_META);
}

describe('EP-9 UI surface contract', () => {
  it('exports EconomicRealitySurfaceV1 with presentation-only UI contract', () => {
    expect(ECONOMIC_REALITY_SURFACE_V1.moduleId).toBe('economic-reality');
    expect(ECONOMIC_REALITY_SURFACE_V1.uiContract.acceptsPresentationV1).toBe(true);
    expect(ECONOMIC_REALITY_SURFACE_V1.uiContract.requiresDeterministicHash).toBe(true);
    expect(ECONOMIC_REALITY_SURFACE_V1.capabilities.supportsPartialRendering).toBe(false);
  });

  it('page module does not import EP-1–EP-6 engine functions', () => {
    const pageSource = readFileSync(
      join(webModulesRoot, 'app/modules/economic-reality/page.tsx'),
      'utf8'
    );
    expect(pageSource).toContain('useEconomicRealityPlan');
    expect(pageSource).not.toContain('buildEconomicRealityPlan');
    expect(pageSource).not.toContain('evaluate(');
  });

  it('UI renderer layer does not import engine functions', () => {
    const violations: string[] = [];
    const forbidden = [
      'buildEconomicRealityPlan',
      'evaluate(',
      'resolveGraphContext',
      'buildExecutionState',
      'buildActionSet',
      'buildPlan',
      'buildPresentation',
    ];

    for (const filePath of listSourceFiles(uiRoot)) {
      const source = readFileSync(filePath, 'utf8');
      for (const pattern of forbidden) {
        if (source.includes(pattern)) {
          violations.push(`${filePath}: ${pattern}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('navigation visibility hides self_sustained idle EF01 state', () => {
    const response = buildFixtureResponse('EF01');
    expect(
      shouldShowEconomicRealitySurface({
        evaluation: response.evaluation,
        presentation: response.presentation,
        actionSet: response.actionSet,
      })
    ).toBe(false);
  });

  it('navigation visibility shows EF03+ non-self-sustained states', () => {
    const response = buildFixtureResponse('EF03');
    expect(
      shouldShowEconomicRealitySurface({
        evaluation: response.evaluation,
        presentation: response.presentation,
        actionSet: response.actionSet,
      })
    ).toBe(true);
  });

  it('deterministic hash gating prevents redundant hydration', () => {
    const response = buildFixtureResponse('EF03');
    const hydrated = hydrateEconomicPlan(response);
    const reconciled = reconcileEconomicPlanState(hydrated, response);
    expect(reconciled).toBe(hydrated);
  });

  it('home card projection uses highlights only without secondary sections', () => {
    const response = buildFixtureResponse('EF03');
    const sections = adaptPresentationToUi(response.presentation);
    const homeCardSource = readFileSync(
      join(webModulesRoot, 'components/home/EconomicRealityCard.tsx'),
      'utf8'
    );

    expect(sections.some((section) => section.section.type === 'SECONDARY')).toBe(true);
    expect(homeCardSource).toContain('primaryHighlight.labelKey');
    expect(homeCardSource).toContain('systemHighlights');
    expect(homeCardSource).not.toContain('SecondarySection');
  });

  describe('action execution boundary', () => {
    beforeEach(() => {
      clearEconomicActionContext();
    });

    it('rejects execution without bound context', async () => {
      await expect(executeEconomicAction('missing-action')).rejects.toMatchObject({
        code: 'E_NO_CONTEXT',
      });
    });

    it('rejects actions outside the current action set', async () => {
      const response = buildFixtureResponse('EF03');
      bindEconomicActionContext({
        sessionId: 'sess_test',
        deterministicHash: response.meta.deterministicHash,
        actionSet: response.actionSet,
      });

      await expect(executeEconomicAction('not-in-action-set')).rejects.toMatchObject({
        code: 'E_ACTION_NOT_FOUND',
      });
    });

    it('targets the EP-9 action gateway only', () => {
      const source = readFileSync(
        join(webModulesRoot, 'lib/economic-reality/action-executor.ts'),
        'utf8'
      );
      expect(source).toContain('/api/modules/economic-reality/action/execute');
      expect(source).toContain('deterministicHash');
      expect(source).not.toContain('/api/mutations');
    });
  });
});
