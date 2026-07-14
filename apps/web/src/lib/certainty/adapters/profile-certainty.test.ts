import { describe, expect, it } from 'vitest';
import {
  buildProfileCertaintyBundle,
  buildProfileCertaintyState,
} from '@/lib/certainty/adapters/profile-certainty';
import { validateCertaintyState } from '@/lib/certainty/validate-certainty-state';
import type { ProfileMirrorDomain } from '@/lib/profile-mirror-utils';

function domain(
  slug: ProfileMirrorDomain['slug'],
  status: ProfileMirrorDomain['status'],
  overrides: Partial<ProfileMirrorDomain> = {}
): ProfileMirrorDomain {
  return {
    slug,
    title: slug,
    status,
    previewLines: [],
    fields: [],
    emptyExplanation: `${slug} empty`,
    whyItMatters: `${slug} matters`,
    ...overrides,
  };
}

describe('profile certainty adapter', () => {
  const completeDomains: ProfileMirrorDomain[] = [
    domain('move-to-germany', 'complete', { title: 'Your move to Germany' }),
    domain('where-you-live', 'complete', { title: 'Where you live' }),
    domain('household-family', 'complete', { title: 'Household & family' }),
    domain('work-income', 'complete', { title: 'Work & income' }),
    domain('health-insurance', 'complete', { title: 'Health insurance' }),
    domain('benefits-support', 'complete', { title: 'Benefits support' }),
    domain('language-display', 'complete', { title: 'Language display' }),
  ];

  it('maps complete profile to clear certainty without next action', () => {
    const state = buildProfileCertaintyState({
      domains: completeDomains,
      primaryFocusSlug: null,
    });

    expect(state.location).toBe('Profile');
    expect(state.confidence).toBe('clear');
    expect(state.nextAction).toBeUndefined();
    expect(validateCertaintyState(state)).toBe(true);
  });

  it('maps partial profile to progress reason and needs_attention', () => {
    const domains = completeDomains.map((entry) =>
      entry.slug === 'household-family'
        ? domain('household-family', 'not_added', { title: 'Household & family' })
        : entry
    );

    const bundle = buildProfileCertaintyBundle({
      domains,
      primaryFocusSlug: 'household-family',
    });

    expect(bundle.recommendedFocusId).toBe('household-family');
    expect(bundle.state.confidence).toBe('needs_attention');
    expect(bundle.state.nextAction?.label).toBe('Complete your family information');
    expect(bundle.state.nextAction?.reason).toEqual({
      type: 'progress',
      target: 'Household & family',
    });
    expect(bundle.state.nextAction?.expectedOutcome).toEqual({
      type: 'unlock',
      target: 'Profile completeness',
    });
    expect(validateCertaintyState(bundle.state)).toBe(true);
  });

  it('maps blocked profile selection to dependency reason', () => {
    const domains = [
      domain('move-to-germany', 'not_added', { title: 'Your move to Germany' }),
      domain('benefits-support', 'needs_attention', { title: 'Benefits support' }),
    ];

    const state = buildProfileCertaintyState({
      domains,
      primaryFocusSlug: 'benefits-support',
      selectedDomainSlug: 'benefits-support',
      dependencySourceSlugs: ['move-to-germany'],
    });

    expect(state.confidence).toBe('blocked');
    expect(state.nextAction?.reason).toEqual({
      type: 'dependency',
      prerequisite: 'Your move to Germany',
      target: 'Benefits support',
    });
    expect(state.nextAction?.expectedOutcome).toEqual({
      type: 'unlock',
      target: 'Benefits support',
    });
    expect(validateCertaintyState(state)).toBe(true);
  });
});
