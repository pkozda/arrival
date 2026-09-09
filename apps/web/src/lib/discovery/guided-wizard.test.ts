import { describe, expect, it } from 'vitest';
import {
  buildGuidedCreateInput,
  canSubmitGuidedDraft,
  createInitialGuidedDraft,
  guidedWizardClaimsDiscoveryResults,
  guidedWizardClaimsDiscoveryRun,
  nextGuidedStep,
  previousGuidedStep,
  shouldShowJourneyGuideWelcomeOnSurface,
  validateGuidedCriteria,
} from './guided-wizard.js';
import { shouldShowJourneyGuideWelcomeOnSurface as journeyGuideSurfaceGate } from '@/lib/journey-guide/JourneyGuideProvider';

describe('PD-005 Guided Discovery wizard', () => {
  it('A — Guided Discovery surface suppresses Journey Guide welcome', () => {
    expect(shouldShowJourneyGuideWelcomeOnSurface('discovery-galaxy')).toBe(false);
    expect(journeyGuideSurfaceGate('discovery-galaxy')).toBe(false);
    expect(shouldShowJourneyGuideWelcomeOnSurface('life-event-galaxy')).toBe(true);
  });

  it('B — intent is required before create', () => {
    const draft = createInitialGuidedDraft();
    expect(validateGuidedCriteria(draft)).toContain('intent');
    draft.template = 'jobs';
    draft.name = 'My jobs';
    draft.country = 'DE';
    expect(validateGuidedCriteria(draft)).toEqual([]);
  });

  it('C — minimum Jobs criteria map to existing create contract', () => {
    const input = buildGuidedCreateInput({
      template: 'jobs',
      name: 'Berlin jobs',
      country: 'de',
      role: 'Engineer',
    });
    expect(input.strategyId).toBe('job-discovery');
    expect(input.name).toBe('Berlin jobs');
    expect(input.criteria.required.some((item) => item.key === 'country' && item.value === 'DE')).toBe(
      true
    );
    expect(input.criteria.preferred.some((item) => item.key === 'role' && item.value === 'Engineer')).toBe(
      true
    );
    expect(input.schedule).toEqual({ cadence: 'manual' });
  });

  it('D — incomplete required data blocks submit', () => {
    expect(
      canSubmitGuidedDraft({
        template: 'jobs',
        name: '',
        country: 'DE',
        role: '',
      })
    ).toBe(false);
    expect(
      canSubmitGuidedDraft({
        template: 'jobs',
        name: 'Jobs',
        country: 'D',
        role: '',
      })
    ).toBe(false);
  });

  it('E — review/create payload reflects selected intent and criteria', () => {
    const jobs = buildGuidedCreateInput({
      template: 'jobs',
      name: 'Jobs profile',
      country: 'DE',
      role: 'Designer',
    });
    const giveaways = buildGuidedCreateInput({
      template: 'giveaways',
      name: 'Giveaways profile',
      country: 'DE',
      role: 'ignored',
    });
    expect(jobs.strategyId).toBe('job-discovery');
    expect(giveaways.strategyId).toBe('giveaway-discovery');
    expect(giveaways.criteria.preferred.some((item) => item.key === 'role')).toBe(false);
  });

  it('G/K — wizard completion never claims Discovery run/results', () => {
    expect(guidedWizardClaimsDiscoveryRun()).toBe(false);
    expect(guidedWizardClaimsDiscoveryResults()).toBe(false);
  });

  it('step model advances and retreats explicitly', () => {
    expect(nextGuidedStep('welcome')).toBe('intent');
    expect(nextGuidedStep('intent')).toBe('criteria');
    expect(nextGuidedStep('criteria')).toBe('review');
    expect(nextGuidedStep('review')).toBe('created');
    expect(nextGuidedStep('created')).toBeNull();
    expect(previousGuidedStep('criteria')).toBe('intent');
    expect(previousGuidedStep('welcome')).toBeNull();
  });
});
