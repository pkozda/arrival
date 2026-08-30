import { describe, expect, it, vi, afterEach } from 'vitest';
import { getTranslations } from '@arrival-atlas/core';
import {
  buildJourneyGuideViewModelFromCertainty,
  isGuideCertaintyComplete,
  viewModelToPlanetRecommendation,
} from '@/lib/journey-guide/adapters/certainty';
import { formatGuideOutcome, formatGuideSpeech } from '@/lib/journey-guide/formatters';
import { isGuideUseCertaintyEnabled } from '@/lib/journey-guide/guide-certainty-feature-flag';
import { resolveCertaintyMessage } from '@/lib/certainty/resolve-message';
import type { CertaintyState } from '@/lib/certainty/types';

const en = (key: string) => getTranslations('en')[key] ?? key;
const ua = (key: string) => getTranslations('ua')[key] ?? key;
const de = (key: string) => getTranslations('de')[key] ?? key;
const ru = (key: string) => getTranslations('ru')[key] ?? key;

const baseState: CertaintyState = {
  location: 'Life Events',
  title: 'Registration',
  confidence: 'needs_attention',
  nextAction: {
    label: 'Register your address',
    reason: {
      type: 'description',
      description: 'housing support becomes available after registration',
    },
    expectedOutcome: {
      type: 'openPath',
      target: 'Housing support',
    },
  },
  progress: { completed: 1, total: 4 },
};

describe('journey guide certainty adapter', () => {
  it('detects complete certainty state', () => {
    expect(isGuideCertaintyComplete(baseState)).toBe(true);
    expect(isGuideCertaintyComplete({ ...baseState, nextAction: undefined })).toBe(false);
  });

  it('maps certainty to guide view model with resolved English copy', () => {
    const viewModel = buildJourneyGuideViewModelFromCertainty(baseState, {
      recommendedNodeId: 'registration',
      unlockPreview: [{ nodeId: 'housing', title: 'Housing support' }],
      t: en,
    });

    expect(viewModel).not.toBeNull();
    expect(viewModel!.recommendedStep).toBe('Register your address');
    expect(viewModel!.explanation).toContain('housing support becomes available after registration');
    expect(viewModel!.outcome).toBe('That opens the path to Housing support.');
    expect(viewModel!.tone).toBe('attentive');
    expect(viewModel!.confidencePresentation.badgeVariant).toBe('needs_attention');
    expect(viewModel!.confidencePresentation.labelKey).toBe('certainty.confidence.needsAttention');
    expect(viewModel!.unlockPreview[0]?.missionTitle).toBeTruthy();
    expect(viewModel!.progress?.label).toBe('1 of 4 steps are already in place.');
  });

  it('maps dependency reason and unlock outcome', () => {
    const blockedState: CertaintyState = {
      ...baseState,
      confidence: 'blocked',
      nextAction: {
        label: 'Registration',
        reason: {
          type: 'dependency',
          prerequisite: 'Registration',
          target: 'Housing support',
        },
        expectedOutcome: {
          type: 'unlock',
          target: 'Housing support',
        },
      },
    };

    const viewModel = buildJourneyGuideViewModelFromCertainty(blockedState, {
      recommendedNodeId: 'registration',
      unlockPreview: [],
      t: en,
    });

    expect(viewModel!.explanation).toBe(
      'To unlock Housing support, Registration is needed first.'
    );
    expect(viewModel!.tone).toBe('blocked');
  });

  it.each([
    ['de', de, 'Um Housing support freizuschalten, wird zuerst Registration benötigt.'],
    ['ru', ru, 'Чтобы открыть «Housing support», сначала нужно «Registration».'],
    ['ua', ua, 'Щоб відкрити «Housing support», спочатку потрібне «Registration».'],
  ] as const)('localizes certainty explanation in %s', (_locale, translate, expected) => {
    const blockedState: CertaintyState = {
      ...baseState,
      nextAction: {
        label: 'Registration',
        reason: {
          type: 'dependency',
          prerequisite: 'Registration',
          target: 'Housing support',
        },
      },
    };

    const viewModel = buildJourneyGuideViewModelFromCertainty(blockedState, {
      recommendedNodeId: 'registration',
      unlockPreview: [],
      t: translate,
    });

    expect(viewModel!.explanation).toBe(expected);
  });

  it('converts view model to planet recommendation for existing UI', () => {
    const viewModel = buildJourneyGuideViewModelFromCertainty(baseState, {
      recommendedNodeId: 'registration',
      unlockPreview: [],
      t: en,
    })!;

    const recommendation = viewModelToPlanetRecommendation(viewModel);
    expect(recommendation.nodeId).toBe('registration');
    expect(recommendation.reason).toBe(viewModel.explanation);
    expect(recommendation.missionTitle).toBe(viewModel.recommendedStep);
  });

  it('returns null when certainty is incomplete', () => {
    expect(
      buildJourneyGuideViewModelFromCertainty(
        { location: 'Life Events', title: 'Registration' },
        { recommendedNodeId: 'registration', unlockPreview: [], t: en }
      )
    ).toBeNull();
  });
});

describe('journey guide formatters', () => {
  it('emits language-neutral speech descriptors without English prose', () => {
    expect(formatGuideSpeech(baseState)).toEqual({
      key: 'certainty.reason.description',
      params: {
        description: 'housing support becomes available after registration',
      },
    });
  });

  it('wraps expected outcome with guide phrasing keys', () => {
    expect(
      formatGuideOutcome({
        type: 'openPath',
        target: 'Housing support',
      })
    ).toEqual({
      key: 'certainty.outcome.openPathGuide',
      params: { target: 'Housing support' },
    });

    expect(
      resolveCertaintyMessage(
        formatGuideOutcome({
          type: 'openPath',
          target: 'Housing support',
        }),
        en
      )
    ).toBe('That opens the path to Housing support.');
  });
});

describe('guide certainty feature flag', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('is disabled by default', () => {
    expect(isGuideUseCertaintyEnabled({})).toBe(false);
    expect(isGuideUseCertaintyEnabled({ NEXT_PUBLIC_GUIDE_USE_CERTAINTY: 'true' })).toBe(true);
  });
});
