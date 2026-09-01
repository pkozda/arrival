import type {
  CreateDiscoveryProfileInput,
  DiscoveryCriteria,
  DiscoveryProfile,
  DiscoveryStrategyTemplate,
  UpdateDiscoveryProfileInput,
} from './types';

export function emptyCriteria(): DiscoveryCriteria {
  return { required: [], preferred: [], excluded: [], flexible: [] };
}

export function buildCreateProfileInput(opts: {
  template: DiscoveryStrategyTemplate;
  name: string;
  country: string;
  role?: string;
}): CreateDiscoveryProfileInput {
  const id = `profile-${opts.template}-${Date.now()}`;
  const criteria = emptyCriteria();
  criteria.required.push({ key: 'country', value: opts.country.trim().toUpperCase() });

  if (opts.template === 'jobs') {
    if (opts.role?.trim()) {
      criteria.preferred.push({ key: 'role', value: opts.role.trim() });
    }
    return {
      id,
      name: opts.name.trim(),
      strategyId: 'job-discovery',
      strategyVersion: '1',
      criteria,
      schedule: { cadence: 'manual' },
      notification: { emailEnabled: true, skipEmptyDigest: true },
      enabled: true,
    };
  }

  criteria.required.push({ key: 'freeParticipation', value: true });
  return {
    id,
    name: opts.name.trim(),
    strategyId: 'giveaway-discovery',
    strategyVersion: '1',
    criteria,
    schedule: { cadence: 'manual' },
    notification: { emailEnabled: true, skipEmptyDigest: true },
    enabled: true,
  };
}

export function buildUpdateProfileInput(opts: {
  template: DiscoveryStrategyTemplate;
  name: string;
  country: string;
  role?: string;
}): UpdateDiscoveryProfileInput {
  const criteria = emptyCriteria();
  criteria.required.push({ key: 'country', value: opts.country.trim().toUpperCase() });

  if (opts.template === 'jobs') {
    if (opts.role?.trim()) {
      criteria.preferred.push({ key: 'role', value: opts.role.trim() });
    }
  } else {
    criteria.required.push({ key: 'freeParticipation', value: true });
  }

  return {
    name: opts.name.trim(),
    criteria,
  };
}

export function strategyTemplateFromProfile(
  profile: DiscoveryProfile
): DiscoveryStrategyTemplate {
  return profile.strategyId === 'giveaway-discovery' ? 'giveaways' : 'jobs';
}

export function criteriaCountry(profile: DiscoveryProfile): string {
  const entry = profile.criteria.required.find((item) => item.key === 'country');
  return entry ? String(entry.value) : '';
}

export function criteriaRole(profile: DiscoveryProfile): string {
  const entry = profile.criteria.preferred.find((item) => item.key === 'role');
  return entry ? String(entry.value) : '';
}

export const USER_ACTIONABLE_STATES = ['SEEN', 'OPENED', 'SAVED', 'DISMISSED'] as const;

export function formatMatchPercent(score: number): string {
  return `${Math.round(score * 100)}%`;
}

export function companyFromResult(result: {
  identity?: { fingerprintMaterial?: Record<string, string | null> };
  canonicalPresentation: { title: string };
}): string | null {
  const material = result.identity?.fingerprintMaterial;
  return material?.company ?? material?.organizer ?? null;
}
