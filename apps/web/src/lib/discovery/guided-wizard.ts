import { buildCreateProfileInput } from './helpers';
import type { CreateDiscoveryProfileInput, DiscoveryStrategyTemplate } from './types';

export type GuidedDiscoveryStep =
  | 'welcome'
  | 'intent'
  | 'criteria'
  | 'review'
  | 'created';

export const GUIDED_DISCOVERY_STEPS: readonly GuidedDiscoveryStep[] = [
  'welcome',
  'intent',
  'criteria',
  'review',
  'created',
] as const;

export type GuidedDiscoveryDraft = {
  template: DiscoveryStrategyTemplate | null;
  name: string;
  country: string;
  role: string;
};

export type GuidedDiscoveryValidationField = 'intent' | 'name' | 'country';

export function createInitialGuidedDraft(): GuidedDiscoveryDraft {
  return {
    template: null,
    name: '',
    country: 'DE',
    role: '',
  };
}

export function nextGuidedStep(step: GuidedDiscoveryStep): GuidedDiscoveryStep | null {
  const index = GUIDED_DISCOVERY_STEPS.indexOf(step);
  if (index < 0 || index >= GUIDED_DISCOVERY_STEPS.length - 1) {
    return null;
  }
  return GUIDED_DISCOVERY_STEPS[index + 1] ?? null;
}

export function previousGuidedStep(step: GuidedDiscoveryStep): GuidedDiscoveryStep | null {
  const index = GUIDED_DISCOVERY_STEPS.indexOf(step);
  if (index <= 0) {
    return null;
  }
  return GUIDED_DISCOVERY_STEPS[index - 1] ?? null;
}

export function validateGuidedCriteria(
  draft: GuidedDiscoveryDraft
): GuidedDiscoveryValidationField[] {
  const missing: GuidedDiscoveryValidationField[] = [];
  if (!draft.template) {
    missing.push('intent');
  }
  if (!draft.name.trim()) {
    missing.push('name');
  }
  if (!/^[A-Za-z]{2}$/.test(draft.country.trim())) {
    missing.push('country');
  }
  return missing;
}

export function canSubmitGuidedDraft(draft: GuidedDiscoveryDraft): boolean {
  return validateGuidedCriteria(draft).length === 0;
}

/**
 * Builds the same create payload as the self-directed form for the progressive subset.
 * Does not invent schedule/notification — uses existing defaults.
 */
export function buildGuidedCreateInput(
  draft: GuidedDiscoveryDraft
): CreateDiscoveryProfileInput {
  if (!draft.template) {
    throw new Error('Guided Discovery requires an intent before create');
  }
  return buildCreateProfileInput({
    template: draft.template,
    name: draft.name,
    country: draft.country,
    role: draft.template === 'jobs' ? draft.role : undefined,
  });
}

/** Wizard completion never implies a Discovery execution. */
export function guidedWizardClaimsDiscoveryRun(): false {
  return false;
}

export function guidedWizardClaimsDiscoveryResults(): false {
  return false;
}

export const DISCOVERY_GALAXY_SURFACE_ID = 'discovery-galaxy';

/** Journey Guide welcome must not impersonate Guided Discovery. */
export function shouldShowJourneyGuideWelcomeOnSurface(surfaceId: string): boolean {
  return surfaceId !== DISCOVERY_GALAXY_SURFACE_ID;
}
