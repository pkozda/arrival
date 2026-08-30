import { getTranslations, GUIDE_I18N, GUIDE_I18N_KEYS, t } from '@arrival-atlas/core';
import { describe, expect, it } from 'vitest';
import { buildOverlayTitle, buildUnlockGuideMessage } from '@/lib/journey-guide/cinematic-unlock-engine';
import { toMissionTitle } from '@/lib/journey-guide/mission-labels';
import { getRecommendedNextPlanet } from '@/lib/journey-guide/recommendation-engine';
import type { SpatialGraphEdge, SpatialGraphNode } from '@/lib/presentation/spatial-core';

const LOCALES = ['en', 'de', 'ru', 'ua'] as const;

describe('Journey Guide Phase 2A i18n dictionaries', () => {
  it('defines the same guide.* keys for every supported language', () => {
    for (const locale of LOCALES) {
      expect(Object.keys(GUIDE_I18N[locale]).sort()).toEqual([...GUIDE_I18N_KEYS].sort());
    }
  });

  it('provides real Ukrainian translations (not English duplicates)', () => {
    expect(t('guide.welcome.title', 'ua')).toBe('Ласкаво просимо до Arrival Atlas.');
    expect(t('guide.fabLabel', 'ua')).toBe('Провідник');
    expect(t('guide.mission.moveToGermany', 'ua')).toBe('Створити базу прибуття');
    expect(t('guide.welcome.title', 'ua')).not.toBe(t('guide.welcome.title', 'en'));
    expect(t('guide.recommendedNextStep', 'ua')).not.toBe(t('guide.recommendedNextStep', 'en'));
  });

  it('merges guide keys into getTranslations for all locales', () => {
    for (const locale of LOCALES) {
      const bundle = getTranslations(locale);
      expect(bundle['guide.welcome.startGuided']).toBe(GUIDE_I18N[locale]['guide.welcome.startGuided']);
      expect(bundle['guide.unlock.overlayOne']).toBe(GUIDE_I18N[locale]['guide.unlock.overlayOne']);
      expect(bundle['guide.dismissAria']).toBe(GUIDE_I18N[locale]['guide.dismissAria']);
    }
  });
});

describe('Journey Guide Phase 2A engine localization', () => {
  const nodes: SpatialGraphNode[] = [
    { id: '__journey__', status: 'core', x: 50, y: 50, payload: null },
    { id: 'where-you-live', status: 'recommended', x: 30, y: 40, payload: null },
    { id: 'tax-id', status: 'future', x: 60, y: 35, payload: null },
  ];
  const edges: SpatialGraphEdge[] = [
    { id: 'u1', from: 'where-you-live', to: 'tax-id', type: 'unlock' },
  ];
  const titles = {
    'where-you-live': 'Where you live',
    'tax-id': 'Tax ID',
  };

  it.each(LOCALES)('localizes mission labels and recommendation reasons in %s', (language) => {
    const translate = (key: string) => getTranslations(language)[key] ?? key;
    const result = getRecommendedNextPlanet({
      graphNodes: nodes,
      graphEdges: edges,
      lockedNodeIds: new Set(['tax-id']),
      nodeTitles: titles,
      t: translate,
    });

    expect(result?.missionTitle).toBe(translate('guide.mission.whereYouLive'));
    expect(result?.reason).toBe(translate('guide.reason.recommended'));
  });

  it.each(LOCALES)('localizes cinematic unlock chrome in %s', (language) => {
    const translate = (key: string) => getTranslations(language)[key] ?? key;
    const message = buildUnlockGuideMessage('Anmeldung', ['Tax ID'], translate);
    expect(message.title).toBe(translate('guide.unlock.newRouteTitle'));
    expect(message.body).toContain('Tax ID');
    expect(buildOverlayTitle(1, translate)).toBe(translate('guide.unlock.overlayOne'));
    expect(buildOverlayTitle(3, translate)).toContain('3');
  });

  it('keeps English mission fallback when translate is omitted', () => {
    expect(toMissionTitle('move-to-germany', 'Move to Germany')).toBe('Establish Your Arrival Base');
  });
});
