import { describe, expect, it } from 'vitest';
import {
  appendExcludedRole,
  buildCreateProfileInput,
  buildUpdateProfileInput,
  criteriaExcludedRoles,
  DEFAULT_DAILY_HOUR_UTC,
  defaultScheduleDraft,
  emptyCriteria,
  removeExcludedRole,
  scheduleDraftFromProfile,
  scheduleFromDraft,
  setScheduleCadence,
  setScheduleHourUtc,
  formatScheduleSummary,
} from './helpers';
import type { DiscoveryProfile } from './types';

function jobsProfile(
  overrides: Partial<DiscoveryProfile> = {}
): DiscoveryProfile {
  return {
    id: 'p1',
    userId: 'u1',
    name: 'Jobs DE',
    strategyId: 'job-discovery',
    strategyVersion: '1',
    criteria: {
      required: [{ key: 'country', value: 'DE' }],
      preferred: [{ key: 'role', value: 'Senior Frontend Engineer' }],
      excluded: [{ key: 'role', value: 'Team Lead' }],
      flexible: [{ key: 'note', value: 'keep-me' }],
    },
    schedule: { cadence: 'manual' },
    notification: { emailEnabled: true, skipEmptyDigest: true },
    enabled: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('discovery excluded-role helpers', () => {
  it('reads excluded roles from criteria.excluded role entries', () => {
    expect(criteriaExcludedRoles(jobsProfile())).toEqual(['Team Lead']);
  });

  it('trims and ignores empty drafts; prevents exact duplicates', () => {
    expect(appendExcludedRole([], '  ')).toEqual([]);
    expect(appendExcludedRole([], '  Backend  ')).toEqual(['Backend']);
    expect(appendExcludedRole(['Backend'], 'Backend')).toEqual(['Backend']);
    expect(appendExcludedRole(['Backend'], 'backend')).toEqual(['Backend', 'backend']);
  });

  it('removes an excluded role by exact value', () => {
    expect(removeExcludedRole(['Team Lead', 'QA'], 'Team Lead')).toEqual(['QA']);
  });

  it('includes excluded role criteria on create', () => {
    const input = buildCreateProfileInput({
      template: 'jobs',
      name: 'My Jobs',
      country: 'de',
      role: 'Senior Frontend Engineer',
      excludedRoles: ['Team Lead', 'QA Engineer'],
    });
    expect(input.criteria.excluded).toEqual([
      { key: 'role', value: 'Team Lead' },
      { key: 'role', value: 'QA Engineer' },
    ]);
    expect(input.criteria.required).toEqual([{ key: 'country', value: 'DE' }]);
    expect(input.criteria.preferred).toEqual([
      { key: 'role', value: 'Senior Frontend Engineer' },
    ]);
  });

  it('preserves flexible and non-role excluded entries on update', () => {
    const existing = emptyCriteria();
    existing.required = [{ key: 'country', value: 'DE' }];
    existing.preferred = [{ key: 'role', value: 'Senior Frontend Engineer' }];
    existing.excluded = [
      { key: 'role', value: 'Old Role' },
      { key: 'company', value: 'Acme' },
    ];
    existing.flexible = [{ key: 'note', value: 'keep-me' }];

    const input = buildUpdateProfileInput({
      template: 'jobs',
      name: 'Jobs DE',
      country: 'DE',
      role: 'Senior Frontend Engineer',
      excludedRoles: ['Team Lead'],
      existingCriteria: existing,
    });

    expect(input.criteria?.flexible).toEqual([{ key: 'note', value: 'keep-me' }]);
    expect(input.criteria?.excluded).toEqual([
      { key: 'company', value: 'Acme' },
      { key: 'role', value: 'Team Lead' },
    ]);
    expect(input.criteria?.required).toEqual([{ key: 'country', value: 'DE' }]);
  });
});

describe('discovery schedule helpers (E13.2b.2)', () => {
  it('defaults new profiles to manual schedule', () => {
    expect(defaultScheduleDraft()).toEqual({ kind: 'editable', cadence: 'manual' });
    const input = buildCreateProfileInput({
      template: 'jobs',
      name: 'My Jobs',
      country: 'DE',
    });
    expect(input.schedule).toEqual({ cadence: 'manual' });
  });

  it('create payload includes selected daily schedule', () => {
    const input = buildCreateProfileInput({
      template: 'jobs',
      name: 'My Jobs',
      country: 'DE',
      scheduleDraft: {
        kind: 'editable',
        cadence: 'daily',
        hourUtc: 6,
      },
    });
    expect(input.schedule).toEqual({ cadence: 'daily', hourUtc: 6 });
  });

  it('create payload remains manual when manual is selected', () => {
    const input = buildCreateProfileInput({
      template: 'jobs',
      name: 'My Jobs',
      country: 'DE',
      scheduleDraft: { kind: 'editable', cadence: 'manual' },
    });
    expect(input.schedule).toEqual({ cadence: 'manual' });
  });

  it('loads persisted daily schedule into draft', () => {
    expect(scheduleDraftFromProfile({ cadence: 'daily', hourUtc: 9 })).toEqual({
      kind: 'editable',
      cadence: 'daily',
      hourUtc: 9,
    });
  });

  it('preserves weekly schedule in unsupported draft and update payload', () => {
    const weekly = { cadence: 'weekly' as const, dayOfWeek: 2, hourUtc: 9 };
    const draft = scheduleDraftFromProfile(weekly);
    expect(draft).toEqual({ kind: 'unsupported', schedule: weekly });
    expect(scheduleFromDraft(draft)).toEqual(weekly);

    const input = buildUpdateProfileInput({
      template: 'jobs',
      name: 'Jobs DE',
      country: 'DE',
      role: 'Engineer',
      existingCriteria: jobsProfile().criteria,
      scheduleDraft: draft,
    });
    expect(input.schedule).toEqual(weekly);
    expect(input.criteria?.required).toEqual([{ key: 'country', value: 'DE' }]);
    expect(input.notification).toBeUndefined();
  });

  it('update payload can change daily hour without dropping criteria', () => {
    const input = buildUpdateProfileInput({
      template: 'jobs',
      name: 'Jobs DE',
      country: 'DE',
      role: 'Senior Frontend Engineer',
      excludedRoles: ['Team Lead'],
      existingCriteria: jobsProfile().criteria,
      scheduleDraft: {
        kind: 'editable',
        cadence: 'daily',
        hourUtc: 15,
      },
    });
    expect(input.schedule).toEqual({ cadence: 'daily', hourUtc: 15 });
    expect(input.criteria?.flexible).toEqual([{ key: 'note', value: 'keep-me' }]);
    expect(input.criteria?.excluded).toEqual([{ key: 'role', value: 'Team Lead' }]);
    expect(input.notification).toBeUndefined();
  });

  it('notification defaults remain emailEnabled + skipEmptyDigest', () => {
    const input = buildCreateProfileInput({
      template: 'jobs',
      name: 'My Jobs',
      country: 'DE',
    });
    expect(input.notification).toEqual({
      emailEnabled: true,
      skipEmptyDigest: true,
    });
  });

  it('update can change notification without dropping schedule or criteria', () => {
    const input = buildUpdateProfileInput({
      template: 'jobs',
      name: 'Jobs DE',
      country: 'DE',
      role: 'Senior Frontend Engineer',
      excludedRoles: ['Team Lead'],
      existingCriteria: jobsProfile().criteria,
      scheduleDraft: scheduleDraftFromProfile({ cadence: 'daily', hourUtc: 6 }),
      notificationDraft: { emailEnabled: false, skipEmptyDigest: false },
    });
    expect(input.notification).toEqual({
      emailEnabled: false,
      skipEmptyDigest: false,
    });
    expect(input.schedule).toEqual({ cadence: 'daily', hourUtc: 6 });
    expect(input.criteria?.excluded).toEqual([{ key: 'role', value: 'Team Lead' }]);
  });

  it('switching to daily uses default hour; hour updates clamp', () => {
    const daily = setScheduleCadence(defaultScheduleDraft(), 'daily');
    expect(daily).toEqual({
      kind: 'editable',
      cadence: 'daily',
      hourUtc: DEFAULT_DAILY_HOUR_UTC,
    });
    expect(setScheduleHourUtc(daily, 25)).toEqual({
      kind: 'editable',
      cadence: 'daily',
      hourUtc: 23,
    });
  });

  it('formats schedule summary for panel display', () => {
    const t = (key: string) => {
      const map: Record<string, string> = {
        'discovery.schedule.manual': 'Manual',
        'discovery.schedule.summary.daily': 'Daily · {hour} UTC',
        'discovery.schedule.summary.weekly': 'Weekly · {day} · {hour} UTC',
        'discovery.schedule.weekday.1': 'Monday',
        'discovery.schedule.weekday.2': 'Tuesday',
      };
      return map[key] ?? key;
    };
    expect(formatScheduleSummary({ cadence: 'manual' }, t)).toBe('Manual');
    expect(formatScheduleSummary({ cadence: 'daily', hourUtc: 6 }, t)).toBe(
      'Daily · 06:00 UTC'
    );
    expect(
      formatScheduleSummary({ cadence: 'weekly', dayOfWeek: 1, hourUtc: 6 }, t)
    ).toBe('Weekly · Monday · 06:00 UTC');
  });
});
