import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { getTranslations, LIFE_EVENT_I18N_KEYS } from '@arrival-atlas/core';
import { buildCompletenessSummary } from '@/lib/profile-insights/selectors';
import {
  defaultScenarioExplorerOpen,
  homeHasMeaningfulLifeEventState,
  scenarioExplorerPanelLabelIncludesSimulation,
  shouldHideHomeSecondarySections,
  shouldShowLifeEventColdStart,
} from '@/lib/presentation/home-p0';

const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');

const PH5_HOME_KEYS = [
  'life-event.home.situationTitle',
  'life-event.home.browseTopics',
  'life-event.home.suggestedModules',
  'life-event.home.situationMostlyComplete',
  'life-event.home.coldStart.title',
  'life-event.home.coldStart.duration',
  'life-event.home.coldStart.reassurance',
  'life-event.home.prefill.high',
  'life-event.explorer.panelTitle',
  'life-event.explorer.notPersonalizedPlan',
  'life-event.explorer.simulationOnly',
  'life-event.explorer.doesNotAffectPlan',
  'life-event.intake.title',
  'life-event.intake.description',
  'life-event.intake.submit',
] as const;

const LEGACY_EN_MARKERS = [
  'Browse topics by category',
  'Priority actions',
  'Suggested for you',
  'Your situation is mostly complete.',
  'Advanced simulation (optional)',
  'Start your life situation plan',
  'Using information from your situation',
] as const;

const LE_HOME_UI_FILES = [
  'src/components/home/LifeEventColdStartCard.tsx',
  'src/components/home/YourSituationSummaryCard.tsx',
  'src/components/home/MissingContextHintsCard.tsx',
  'src/components/home/SuggestedModulesSection.tsx',
  'src/components/home/HomeSnapshotRenderer.tsx',
  'src/components/life-event/ScenarioExplorerPanel.tsx',
  'src/components/life-event/LifeEventScenarioExplorer.tsx',
] as const;

function readWebFile(relativePath: string): string {
  return readFileSync(join(WEB_ROOT, relativePath), 'utf8');
}

describe('PH-5 final stabilization', () => {
  it('defines PH-5 i18n keys in LIFE_EVENT_I18N_KEYS for all locales', () => {
    for (const key of PH5_HOME_KEYS) {
      expect(LIFE_EVENT_I18N_KEYS).toContain(key);
    }

    for (const lang of ['en', 'de', 'ru', 'ua'] as const) {
      const bundle = getTranslations(lang);
      for (const key of PH5_HOME_KEYS) {
        expect(bundle[key], `${lang} missing ${key}`).toBeTruthy();
      }
    }
  });

  it('uses Simulation mode panel title in EN and localized equivalents elsewhere', () => {
    expect(getTranslations('en')['life-event.explorer.panelTitle']).toBe('Simulation mode');

    for (const lang of ['de', 'ru', 'ua'] as const) {
      const title = getTranslations(lang)['life-event.explorer.panelTitle']!;
      expect(title).not.toBe('Simulation mode');
      expect(
        scenarioExplorerPanelLabelIncludesSimulation(title, 'simul') ||
          scenarioExplorerPanelLabelIncludesSimulation(title, 'симул')
      ).toBe(true);
    }
  });

  it('does not contain legacy English UI markers in LE Home components', () => {
    for (const relativePath of LE_HOME_UI_FILES) {
      const source = readWebFile(relativePath);
      for (const marker of LEGACY_EN_MARKERS) {
        expect(source.includes(marker), `${relativePath} contains "${marker}"`).toBe(false);
      }
    }
  });

  it('shows cold start for FTU and hides secondary catalog noise', () => {
    expect(
      shouldShowLifeEventColdStart({
        plan: null,
        planLoading: false,
        executionSurface: null,
      })
    ).toBe(true);

    expect(
      shouldHideHomeSecondarySections({
        planLoading: false,
        showPlanCard: false,
        showColdStart: true,
      })
    ).toBe(true);
  });

  it('guarantees meaningful Home life-event state coverage', () => {
    expect(
      homeHasMeaningfulLifeEventState({
        planLoading: true,
        showPlanCard: false,
        showColdStart: false,
      })
    ).toBe(true);

    expect(
      homeHasMeaningfulLifeEventState({
        planLoading: false,
        showPlanCard: false,
        showColdStart: true,
      })
    ).toBe(true);

    expect(
      homeHasMeaningfulLifeEventState({
        planLoading: false,
        showPlanCard: true,
        showColdStart: false,
      })
    ).toBe(true);

    expect(
      homeHasMeaningfulLifeEventState({
        planLoading: false,
        showPlanCard: false,
        showColdStart: false,
      })
    ).toBe(false);
  });

  it('keeps scenario explorer collapsed unless mode=scenarios', () => {
    expect(defaultScenarioExplorerOpen({ hasPlan: true, mode: null })).toBe(false);
    expect(defaultScenarioExplorerOpen({ hasPlan: true, mode: 'scenarios' })).toBe(true);
    expect(defaultScenarioExplorerOpen({ hasPlan: false, mode: null })).toBe(false);
  });

  it('stores completeness and prefill messages as i18n keys', () => {
    expect(
      buildCompletenessSummary({
        globalConfidence: 'high',
        missingContext: [],
        domainInsights: [],
      } as never)
    ).toBe('life-event.home.situationMostlyComplete');
  });
});
