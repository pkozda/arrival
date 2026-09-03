import type {
  CreateDiscoveryProfileInput,
  DiscoveryCriteria,
  DiscoveryCriterion,
  DiscoveryProfile,
  DiscoveryStrategyTemplate,
  UpdateDiscoveryProfileInput,
} from './types';

export function emptyCriteria(): DiscoveryCriteria {
  return { required: [], preferred: [], excluded: [], flexible: [] };
}

/** Roles stored as `criteria.excluded[]` with `key: 'role'` (domain Criterion shape). */
export function criteriaExcludedRoles(profile: DiscoveryProfile): string[] {
  return profile.criteria.excluded
    .filter((item) => item.key === 'role' && item.value != null && String(item.value).trim() !== '')
    .map((item) => String(item.value));
}

export function normalizeExcludedRoleDraft(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/** Exact-duplicate prevention after trim; preserves user capitalization. */
export function appendExcludedRole(roles: readonly string[], draft: string): string[] {
  const next = normalizeExcludedRoleDraft(draft);
  if (!next) return [...roles];
  if (roles.includes(next)) return [...roles];
  return [...roles, next];
}

export function removeExcludedRole(roles: readonly string[], role: string): string[] {
  return roles.filter((item) => item !== role);
}

function excludedCriteriaFromRoles(
  roles: readonly string[],
  existingExcluded: readonly DiscoveryCriterion[] = []
): DiscoveryCriterion[] {
  const preserved = existingExcluded.filter((item) => item.key !== 'role');
  const roleEntries: DiscoveryCriterion[] = roles.map((value) => ({
    key: 'role',
    value,
  }));
  return [...preserved, ...roleEntries];
}

/** Default UTC hour when the user first selects Daily (no domain default exists). */
export const DEFAULT_DAILY_HOUR_UTC = 6;

/**
 * Editable Manual/Daily draft, or preserved weekly (UI does not edit weekly yet).
 */
export type ScheduleDraft =
  | { kind: 'editable'; cadence: 'manual' }
  | { kind: 'editable'; cadence: 'daily'; hourUtc: number }
  | {
      kind: 'unsupported';
      schedule: Extract<DiscoveryProfile['schedule'], { cadence: 'weekly' }>;
    };

export function defaultScheduleDraft(): ScheduleDraft {
  return { kind: 'editable', cadence: 'manual' };
}

export function clampHourUtc(hour: number): number {
  if (!Number.isFinite(hour)) return DEFAULT_DAILY_HOUR_UTC;
  return Math.min(23, Math.max(0, Math.trunc(hour)));
}

export function scheduleDraftFromProfile(
  schedule: DiscoveryProfile['schedule']
): ScheduleDraft {
  if (schedule.cadence === 'weekly') {
    return { kind: 'unsupported', schedule: { ...schedule } };
  }
  if (schedule.cadence === 'daily') {
    return {
      kind: 'editable',
      cadence: 'daily',
      hourUtc: clampHourUtc(schedule.hourUtc),
    };
  }
  return { kind: 'editable', cadence: 'manual' };
}

/** Maps draft → API schedule DTO (preserves weekly unchanged). */
export function scheduleFromDraft(
  draft: ScheduleDraft
): DiscoveryProfile['schedule'] {
  if (draft.kind === 'unsupported') {
    return { ...draft.schedule };
  }
  if (draft.cadence === 'daily') {
    return { cadence: 'daily', hourUtc: clampHourUtc(draft.hourUtc) };
  }
  return { cadence: 'manual' };
}

export function setScheduleCadence(
  draft: ScheduleDraft,
  cadence: 'manual' | 'daily'
): ScheduleDraft {
  if (draft.kind === 'unsupported') return draft;
  if (cadence === 'manual') {
    return { kind: 'editable', cadence: 'manual' };
  }
  const hourUtc =
    draft.cadence === 'daily' ? draft.hourUtc : DEFAULT_DAILY_HOUR_UTC;
  return { kind: 'editable', cadence: 'daily', hourUtc: clampHourUtc(hourUtc) };
}

export function setScheduleHourUtc(draft: ScheduleDraft, hourUtc: number): ScheduleDraft {
  if (draft.kind === 'unsupported' || draft.cadence !== 'daily') return draft;
  return {
    kind: 'editable',
    cadence: 'daily',
    hourUtc: clampHourUtc(hourUtc),
  };
}

export function formatHourUtcLabel(hour: number): string {
  return `${String(clampHourUtc(hour)).padStart(2, '0')}:00`;
}

/**
 * Human-readable schedule line for profile summary (read-only).
 * Uses translation keys via the provided `t` callback.
 */
export function formatScheduleSummary(
  schedule: DiscoveryProfile['schedule'],
  t: (key: string) => string
): string {
  if (schedule.cadence === 'manual') {
    return t('discovery.schedule.manual');
  }
  if (schedule.cadence === 'daily') {
    return t('discovery.schedule.summary.daily').replace(
      '{hour}',
      formatHourUtcLabel(schedule.hourUtc)
    );
  }
  const dayLabel = t(`discovery.schedule.weekday.${schedule.dayOfWeek}`);
  return t('discovery.schedule.summary.weekly')
    .replace('{day}', dayLabel)
    .replace('{hour}', formatHourUtcLabel(schedule.hourUtc));
}

/** Existing create defaults for notification preferences. */
export type NotificationDraft = DiscoveryProfile['notification'];

export function defaultNotificationDraft(): NotificationDraft {
  return { emailEnabled: true, skipEmptyDigest: true };
}

export function notificationDraftFromProfile(
  profile: DiscoveryProfile
): NotificationDraft {
  return {
    emailEnabled: profile.notification.emailEnabled,
    skipEmptyDigest: profile.notification.skipEmptyDigest,
  };
}

export function buildCreateProfileInput(opts: {
  template: DiscoveryStrategyTemplate;
  name: string;
  country: string;
  role?: string;
  excludedRoles?: readonly string[];
  /** Jobs only; defaults to manual when omitted. */
  scheduleDraft?: ScheduleDraft;
  /** Defaults to emailEnabled/skipEmptyDigest true when omitted. */
  notificationDraft?: NotificationDraft;
}): CreateDiscoveryProfileInput {
  const id = `profile-${opts.template}-${Date.now()}`;
  const criteria = emptyCriteria();
  criteria.required.push({ key: 'country', value: opts.country.trim().toUpperCase() });
  const notification = opts.notificationDraft ?? defaultNotificationDraft();

  if (opts.template === 'jobs') {
    if (opts.role?.trim()) {
      criteria.preferred.push({ key: 'role', value: opts.role.trim() });
    }
    criteria.excluded = excludedCriteriaFromRoles(opts.excludedRoles ?? []);
    return {
      id,
      name: opts.name.trim(),
      strategyId: 'job-discovery',
      strategyVersion: '1',
      criteria,
      schedule: scheduleFromDraft(opts.scheduleDraft ?? defaultScheduleDraft()),
      notification: { ...notification },
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
    notification: { ...notification },
    enabled: true,
  };
}

export function buildUpdateProfileInput(opts: {
  template: DiscoveryStrategyTemplate;
  name: string;
  country: string;
  role?: string;
  excludedRoles?: readonly string[];
  /** Preserve flexible + non-role excluded keys from the current profile. */
  existingCriteria?: DiscoveryCriteria;
  /** When set, included in PATCH; weekly unsupported drafts are re-emitted unchanged. */
  scheduleDraft?: ScheduleDraft;
  notificationDraft?: NotificationDraft;
}): UpdateDiscoveryProfileInput {
  const existing = opts.existingCriteria ?? emptyCriteria();
  const criteria = emptyCriteria();
  criteria.required.push({ key: 'country', value: opts.country.trim().toUpperCase() });
  criteria.flexible = existing.flexible.map((item) => ({ ...item }));

  if (opts.template === 'jobs') {
    if (opts.role?.trim()) {
      criteria.preferred.push({ key: 'role', value: opts.role.trim() });
    }
    criteria.excluded = excludedCriteriaFromRoles(
      opts.excludedRoles ?? [],
      existing.excluded
    );
  } else {
    criteria.required.push({ key: 'freeParticipation', value: true });
    criteria.excluded = existing.excluded.map((item) => ({ ...item }));
  }

  const input: UpdateDiscoveryProfileInput = {
    name: opts.name.trim(),
    criteria,
  };
  if (opts.scheduleDraft !== undefined) {
    input.schedule = scheduleFromDraft(opts.scheduleDraft);
  }
  if (opts.notificationDraft !== undefined) {
    input.notification = { ...opts.notificationDraft };
  }
  return input;
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
