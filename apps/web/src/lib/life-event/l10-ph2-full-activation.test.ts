import { describe, expect, it } from 'vitest';
import {
  getTranslations,
  LIFE_EVENT_CONTENT_I18N_KEYS,
  LIFE_EVENT_I18N_KEYS,
} from '@arrival-atlas/core';
import { SCENARIO_IDS } from '@/lib/life-event/scenarios/scenario-types';
import {
  createLifeEventSchemaLabelResolver,
  lifeEventModuleDescription,
  lifeEventModuleTitle,
} from '@/lib/life-event/content-labels';
import {
  lifeEventPlanConfidenceLabel,
  lifeEventScenarioLabel,
  lifeEventSeverityLabel,
  lifeEventStateLabel,
} from '@/lib/life-event/ui-labels';

const LIFE_STATES = [
  'arrival_unregistered',
  'arrival_stabilizing',
  'economic_setup_pending',
  'housing_instability',
  'insurance_gap',
  'benefits_exploration',
  'situation_stable',
] as const;
const SEVERITIES = ['critical', 'high', 'medium', 'low'] as const;
const CONFIDENCE_LEVELS = ['high', 'medium', 'low', 'none'] as const;
const NON_EN_LOCALES = ['de', 'ru', 'ua'] as const;

function localeT(language: 'en' | 'de' | 'ru' | 'ua') {
  const bundle = getTranslations(language);
  return (key: string) => bundle[key] ?? key;
}

describe('PH-2 L10-A full life event i18n activation', () => {
  it('defines every UI shell key for all supported locales', () => {
    for (const lang of ['en', 'de', 'ru', 'ua'] as const) {
      const bundle = getTranslations(lang);
      for (const key of LIFE_EVENT_I18N_KEYS) {
        expect(bundle[key], `${lang} missing ${key}`).toBeTruthy();
      }
    }
  });

  it('defines every content key for all supported locales', () => {
    for (const lang of ['en', 'de', 'ru', 'ua'] as const) {
      const bundle = getTranslations(lang);
      for (const key of LIFE_EVENT_CONTENT_I18N_KEYS) {
        expect(bundle[key], `${lang} missing ${key}`).toBeTruthy();
      }
    }
  });

  it('localizes life states without exposing raw IDs in non-English locales', () => {
    for (const state of LIFE_STATES) {
      for (const lang of NON_EN_LOCALES) {
        const label = lifeEventStateLabel(localeT(lang), state);
        expect(label).not.toBe(state);
        expect(label).not.toBe(`life-event.state.${state}`);
      }
    }
  });

  it('localizes severity labels for all planner severities', () => {
    for (const severity of SEVERITIES) {
      expect(lifeEventSeverityLabel(localeT('de'), severity)).not.toBe(severity);
      expect(lifeEventSeverityLabel(localeT('ru'), severity)).toBeTruthy();
    }
  });

  it('localizes plan confidence labels', () => {
    for (const confidence of CONFIDENCE_LEVELS) {
      const de = lifeEventPlanConfidenceLabel(localeT('de'), confidence);
      const en = lifeEventPlanConfidenceLabel(localeT('en'), confidence);
      expect(de).toBeTruthy();
      if (confidence !== 'none') {
        expect(de).not.toBe(en);
      }
    }
  });

  it('localizes scenario display labels', () => {
    for (const scenarioId of SCENARIO_IDS) {
      const de = lifeEventScenarioLabel(localeT('de'), scenarioId);
      const en = lifeEventScenarioLabel(localeT('en'), scenarioId);
      expect(de).not.toBe(scenarioId);
      expect(de).not.toBe(en);
    }
  });

  it('keeps non-English UI shell copy distinct from English for primary headings', () => {
    const en = getTranslations('en');
    const headingKeys = [
      'life-event.home.title',
      'life-event.plan.currentSituation',
      'life-event.plan.recommendedFocus',
      'life-event.plan.whyThisNow',
      'life-event.plan.blockedActions',
      'life-event.timeline.upcomingSteps',
      'life-event.explorer.title',
      'life-event.explorer.submit',
    ] as const;

    for (const lang of NON_EN_LOCALES) {
      const bundle = getTranslations(lang);
      for (const key of headingKeys) {
        expect(bundle[key]).not.toBe(en[key]);
      }
    }
  });

  it('localizes scenario explorer schema labels in German', () => {
    const resolver = createLifeEventSchemaLabelResolver(localeT('de'));

    expect(resolver.fieldLabel({ name: 'event', type: 'string' }, 'event')).toBe('Ereignis');
    expect(resolver.fieldLabel({ name: 'timeline', type: 'string' }, 'timeline')).toBe('Zeitrahmen');
    expect(resolver.fieldLabel({ name: 'currentStatus', type: 'object' }, 'currentStatus')).toBe(
      'Aktueller Status'
    );
    expect(
      resolver.fieldLabel({ name: 'employed', type: 'boolean' }, 'currentStatus.employed')
    ).toBe('Beschäftigt');
    expect(
      resolver.fieldLabel({ name: 'insured', type: 'boolean' }, 'currentStatus.insured')
    ).toBe('Versichert');
    expect(
      resolver.fieldLabel({ name: 'registered', type: 'boolean' }, 'currentStatus.registered')
    ).toBe('Angemeldet');
    expect(resolver.enumLabel({ name: 'timeline', type: 'string' }, 'timeline', 'planning')).toBe(
      'Planung'
    );
  });

  it('localizes module chrome without mutating planner fallbacks', () => {
    const t = localeT('ru');
    const fallbackTitle = 'Life Event Module';
    const fallbackDescription =
      'Scenario-based guidance and action plans for major life changes in Germany';

    expect(lifeEventModuleTitle(t, fallbackTitle)).not.toBe(fallbackTitle);
    expect(lifeEventModuleDescription(t, fallbackDescription)).not.toBe(fallbackDescription);
  });

  it('localizes empty states in Ukrainian', () => {
    const t = localeT('ua');
    expect(t('life-event.empty.noBlockers')).not.toBe('No active blockers');
    expect(t('life-event.empty.noTimelineItems')).not.toBe('No timeline items');
    expect(t('life-event.empty.noScenarioDetected')).not.toBe('No scenario shift detected');
    expect(t('life-event.empty.noRuntimeFeedback')).not.toBe('No cross-module signals');
  });
});
