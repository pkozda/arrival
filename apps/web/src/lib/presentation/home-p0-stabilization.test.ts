import { describe, expect, it } from 'vitest';
import { getTranslations } from '@arrival-atlas/core';
import { buildCompletenessSummary } from '@/lib/profile-insights/selectors';
import {
  defaultScenarioExplorerOpen,
  scenarioExplorerPanelLabelIncludesSimulation,
  shouldShowLifeEventColdStart,
} from '@/lib/presentation/home-p0';

const HOME_SHELL_KEYS = [
  'life-event.home.situationTitle',
  'life-event.home.browseTopics',
  'life-event.home.suggestedModules',
  'life-event.home.situationMostlyComplete',
  'life-event.home.coldStart.title',
  'life-event.home.coldStart.startPlanning',
  'life-event.home.coldStart.duration',
  'life-event.explorer.panelTitle',
  'life-event.explorer.notPersonalizedPlan',
  'life-event.explorer.simulationOnly',
  'life-event.explorer.doesNotAffectPlan',
] as const;

const EN_HOME_MARKERS = [
  'Browse topics by category',
  'Priority actions',
  'Suggested for you',
  'Your situation is mostly complete.',
  'Advanced simulation (optional)',
  'Simulation only',
  'Start your life situation plan',
] as const;

describe('P0 Home stabilization', () => {
  it('shows LifeEventColdStartCard when plan and execution surface are absent', () => {
    expect(
      shouldShowLifeEventColdStart({
        plan: null,
        planLoading: false,
        executionSurface: null,
      })
    ).toBe(true);

    expect(
      shouldShowLifeEventColdStart({
        plan: null,
        planLoading: true,
        executionSurface: null,
      })
    ).toBe(false);
  });

  it('hides cold start when a plan is available', () => {
    expect(
      shouldShowLifeEventColdStart({
        plan: { currentLifeState: 'arrival_unregistered' } as never,
        planLoading: false,
        executionSurface: null,
      })
    ).toBe(false);
  });

  it('defines localized Home shell keys for all supported locales', () => {
    for (const lang of ['en', 'de', 'ru', 'ua'] as const) {
      const bundle = getTranslations(lang);
      for (const key of HOME_SHELL_KEYS) {
        expect(bundle[key], `${lang} missing ${key}`).toBeTruthy();
      }
    }
  });

  it('does not leak raw English Home shell markers into DE/RU/UA bundles', () => {
    for (const lang of ['de', 'ru', 'ua'] as const) {
      const bundle = getTranslations(lang);
      for (const key of HOME_SHELL_KEYS) {
        const value = bundle[key]!;
        for (const marker of EN_HOME_MARKERS) {
          expect(value).not.toBe(marker);
        }
      }
    }
  });

  it('stores completeness summary as an i18n key', () => {
    expect(
      buildCompletenessSummary({
        globalConfidence: 'high',
        missingContext: [],
        domainInsights: [],
      } as never)
    ).toBe('life-event.home.situationMostlyComplete');
  });
});

describe('P0 scenario explorer demotion', () => {
  it('keeps explorer collapsed by default when plan exists', () => {
    expect(
      defaultScenarioExplorerOpen({
        hasPlan: true,
        mode: null,
      })
    ).toBe(false);
  });

  it('opens explorer when mode=scenarios', () => {
    expect(
      defaultScenarioExplorerOpen({
        hasPlan: true,
        mode: 'scenarios',
      })
    ).toBe(true);
  });

  it('uses localized simulation markers in panel labels', () => {
    for (const lang of ['en', 'de', 'ru', 'ua'] as const) {
      const bundle = getTranslations(lang);
      const panelTitle = bundle['life-event.explorer.panelTitle']!;
      const simulationOnly = bundle['life-event.explorer.simulationOnly']!;

      expect(
        scenarioExplorerPanelLabelIncludesSimulation(panelTitle, simulationOnly) ||
          scenarioExplorerPanelLabelIncludesSimulation(panelTitle, 'simulation') ||
          scenarioExplorerPanelLabelIncludesSimulation(panelTitle, 'simul') ||
          scenarioExplorerPanelLabelIncludesSimulation(panelTitle, 'симуля') ||
          scenarioExplorerPanelLabelIncludesSimulation(panelTitle, 'симул')
      ).toBe(true);
    }
  });
});
