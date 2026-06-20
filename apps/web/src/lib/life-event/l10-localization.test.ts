import { describe, expect, it } from 'vitest';
import { getTranslations, t as platformT } from '@arrival-atlas/core';
import {
  lifeEventPlanConfidenceLabel,
  lifeEventSeverityLabel,
  lifeEventStateLabel,
} from '@/lib/life-event/ui-labels';

function localeT(language: 'en' | 'de' | 'ru' | 'ua') {
  const bundle = getTranslations(language);
  return (key: string) => bundle[key] ?? key;
}

describe('L10-A life event localization', () => {
  it('localizes arrival_unregistered life state', () => {
    expect(lifeEventStateLabel(localeT('de'), 'arrival_unregistered')).toBe('Neu angekommen');
    expect(lifeEventStateLabel(localeT('en'), 'arrival_unregistered')).toBe('New arrival');
  });

  it('localizes critical severity', () => {
    expect(lifeEventSeverityLabel(localeT('de'), 'critical')).toBe('Kritisch');
    expect(lifeEventSeverityLabel(localeT('ru'), 'critical')).toBe('Критический');
  });

  it('localizes home card copy', () => {
    const de = localeT('de');
    expect(de('life-event.home.title')).toBe('Ihre nächsten Schritte in Deutschland');
    expect(de('life-event.home.viewFullPlan')).toBe('Gesamten Plan ansehen');
    expect(de('life-event.plan.nextActions')).toBe('Nächste Schritte');
  });

  it('localizes scenario banner title', () => {
    expect(localeT('ua')('life-event.scenario.contextShiftTitle')).toBe('Виявлено зміну контексту');
  });

  it('falls back to English via platform getTranslations merge', () => {
    const de = getTranslations('de');
    expect(de['life-event.state.situation_stable']).toBe('Situation stabil');
    expect(de['common.submit']).toBe('Beratung erhalten');
  });

  it('does not crash on missing keys and uses platform fallback', () => {
    expect(() => platformT('life-event.state.unknown_state', 'de')).not.toThrow();
    expect(platformT('life-event.state.unknown_state', 'de')).toBe('life-event.state.unknown_state');
    expect(platformT('life-event.state.arrival_unregistered', 'de')).toBe('Neu angekommen');
  });

  it('localizes plan confidence labels', () => {
    expect(lifeEventPlanConfidenceLabel(localeT('de'), 'high')).toBe('Hohes Vertrauen');
    expect(lifeEventPlanConfidenceLabel(localeT('en'), 'unknown')).toBe('No confidence rating');
  });

  it('includes life-event keys for every supported locale', () => {
    for (const lang of ['en', 'de', 'ru', 'ua'] as const) {
      const bundle = getTranslations(lang);
      expect(bundle['life-event.empty.noPlan']).toBeTruthy();
      expect(bundle['life-event.timeline.title']).toBeTruthy();
    }
  });
});
