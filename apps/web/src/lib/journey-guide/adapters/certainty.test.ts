import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  buildJourneyGuideViewModelFromCertainty,
  isGuideCertaintyComplete,
  viewModelToPlanetRecommendation,
} from '@/lib/journey-guide/adapters/certainty';
import { formatGuideOutcome, formatGuideSpeech } from '@/lib/journey-guide/formatters';
import { isGuideUseCertaintyEnabled } from '@/lib/journey-guide/guide-certainty-feature-flag';
import type { CertaintyState } from '@/lib/certainty/types';

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

  it('maps certainty to guide view model', () => {
    const viewModel = buildJourneyGuideViewModelFromCertainty(baseState, {
      recommendedNodeId: 'registration',
      unlockPreview: [{ nodeId: 'housing', title: 'Housing support' }],
    });

    expect(viewModel).not.toBeNull();
    expect(viewModel!.recommendedStep).toBe('Register your address');
    expect(viewModel!.explanation).toContain('housing support becomes available after registration');
    expect(viewModel!.outcome).toBe('That opens the path to Housing support.');
    expect(viewModel!.tone).toBe('attentive');
    expect(viewModel!.confidencePresentation.badgeVariant).toBe('needs_attention');
    expect(viewModel!.unlockPreview[0]?.missionTitle).toBeTruthy();
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
    });

    expect(viewModel!.explanation).toBe(
      'To unlock Housing support, Registration is needed first.'
    );
    expect(viewModel!.tone).toBe('blocked');
  });

  it('converts view model to planet recommendation for existing UI', () => {
    const viewModel = buildJourneyGuideViewModelFromCertainty(baseState, {
      recommendedNodeId: 'registration',
      unlockPreview: [],
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
        { recommendedNodeId: 'registration', unlockPreview: [] }
      )
    ).toBeNull();
  });
});

describe('journey guide formatters', () => {
  it('uses certainty formatters for speech without inventing reasoning', () => {
    expect(formatGuideSpeech(baseState)).toBe(
      'Do this now because housing support becomes available after registration.'
    );
  });

  it('wraps expected outcome with guide phrasing', () => {
    expect(
      formatGuideOutcome({
        type: 'openPath',
        target: 'Housing support',
      })
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
