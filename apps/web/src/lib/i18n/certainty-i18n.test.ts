import {
  CERTAINTY_I18N,
  CERTAINTY_I18N_KEYS,
  getTranslations,
  t,
} from '@arrival-atlas/core';
import { describe, expect, it } from 'vitest';
import {
  formatExpectedOutcome,
  formatProgressDelta,
  formatReason,
  getConfidencePresentation,
} from '@/lib/certainty/formatters';
import { resolveCertaintyMessage } from '@/lib/certainty/resolve-message';
import { formatGuideOutcome, formatGuideSpeech } from '@/lib/journey-guide/formatters';
import { buildJourneyGuideViewModelFromCertainty } from '@/lib/journey-guide/adapters/certainty';
import type { CertaintyState } from '@/lib/certainty/types';

const LOCALES = ['en', 'de', 'ru', 'ua'] as const;

describe('Certainty Phase 2B i18n dictionaries', () => {
  it('defines the same certainty.* keys for every supported language', () => {
    for (const locale of LOCALES) {
      expect(Object.keys(CERTAINTY_I18N[locale]).sort()).toEqual([...CERTAINTY_I18N_KEYS].sort());
    }
  });

  it('provides real Ukrainian translations (not English duplicates)', () => {
    expect(t('certainty.chrome.becauseHeading', 'ua')).toBe('Чому цей крок');
    expect(t('certainty.reason.dependency', 'ua')).toContain('{target}');
    expect(t('certainty.chrome.becauseHeading', 'ua')).not.toBe(
      t('certainty.chrome.becauseHeading', 'en')
    );
  });

  it('merges certainty keys into getTranslations for all locales', () => {
    for (const locale of LOCALES) {
      const bundle = getTranslations(locale);
      expect(bundle['certainty.outcome.unlock']).toBe(
        CERTAINTY_I18N[locale]['certainty.outcome.unlock']
      );
      expect(bundle['certainty.confidence.blocked']).toBe(
        CERTAINTY_I18N[locale]['certainty.confidence.blocked']
      );
    }
  });

  it('reuses guide.recommendedNextStep for Certainty next-step heading', () => {
    for (const locale of LOCALES) {
      expect(getTranslations(locale)['guide.recommendedNextStep']).toBeTruthy();
    }
  });
});

describe('Certainty Phase 2B formatter → resolve pipeline', () => {
  it.each(LOCALES)('resolves reason/outcome/progress in %s without English literals in formatters', (language) => {
    const translate = (key: string) => getTranslations(language)[key] ?? key;

    const reason = formatReason({
      type: 'dependency',
      prerequisite: 'Registration',
      target: 'Housing',
    });
    expect(reason?.key).toBe('certainty.reason.dependency');
    expect(JSON.stringify(reason)).not.toMatch(/To unlock/);

    const resolved = resolveCertaintyMessage(reason, translate);
    expect(resolved).toContain('Housing');
    expect(resolved).toContain('Registration');
    expect(resolved).not.toBe(reason!.key);

    expect(resolveCertaintyMessage(formatExpectedOutcome({ type: 'unlock', target: 'X' }), translate)).toContain(
      'X'
    );
    expect(
      resolveCertaintyMessage(formatProgressDelta({ completed: 1, total: 3 }), translate)
    ).toMatch(/1/);
    expect(translate(getConfidencePresentation('clear').labelKey)).not.toBe(
      getConfidencePresentation('clear').labelKey
    );
  });

  it('formatGuideSpeech does not construct English prose', () => {
    const state: CertaintyState = {
      location: 'Life Events',
      title: 'Registration',
      nextAction: {
        label: 'Go',
        reason: { type: 'progress', target: 'Registration' },
      },
    };
    const descriptor = formatGuideSpeech(state);
    expect(descriptor).toEqual({
      key: 'certainty.reason.progress',
      params: { target: 'Registration' },
    });
    expect(JSON.stringify(descriptor)).not.toMatch(/Do this now/);
  });

  it('formatGuideOutcome uses guide-specific keys', () => {
    expect(formatGuideOutcome({ type: 'unlock', target: 'A' }).key).toBe(
      'certainty.outcome.unlockGuide'
    );
  });
});

describe('Certainty Phase 2B Guide flag paths', () => {
  const state: CertaintyState = {
    location: 'Life Events',
    title: 'where-you-live',
    confidence: 'clear',
    nextAction: {
      label: 'Set home',
      reason: {
        type: 'dependency',
        prerequisite: 'Arrival',
        target: 'Housing',
      },
      expectedOutcome: { type: 'unlock', target: 'Housing' },
    },
    progress: { completed: 0, total: 3 },
  };

  it('Certainty-on path produces localized Ukrainian speech', () => {
    const translate = (key: string) => getTranslations('ua')[key] ?? key;
    const viewModel = buildJourneyGuideViewModelFromCertainty(state, {
      recommendedNodeId: 'where-you-live',
      unlockPreview: [],
      t: translate,
    });

    expect(viewModel!.explanation).toBe(
      'Щоб відкрити «Housing», спочатку потрібне «Arrival».'
    );
    expect(viewModel!.outcome).toBe('Це відкриє «Housing».');
    expect(viewModel!.progress?.label).toBe('У вашому плані 3 кроків.');
  });

  it('localizes known mission labels on the Certainty-on path', () => {
    const translate = (key: string) => getTranslations('de')[key] ?? key;
    const viewModel = buildJourneyGuideViewModelFromCertainty(
      {
        ...state,
        title: 'Where you live',
        nextAction: {
          label: 'Where you live',
          reason: { type: 'progress', target: 'Where you live' },
        },
      },
      {
        recommendedNodeId: 'where-you-live',
        unlockPreview: [{ nodeId: 'move-to-germany', title: 'Move to Germany' }],
        t: translate,
      }
    );

    expect(viewModel!.recommendedStep).toBe(translate('guide.mission.whereYouLive'));
    expect(viewModel!.unlockPreview[0]?.missionTitle).toBe(
      translate('guide.mission.moveToGermany')
    );
  });
});
