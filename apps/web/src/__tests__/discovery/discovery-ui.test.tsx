import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { getTranslations } from '@arrival-atlas/core';
import { type DiscoveryProfile } from '@/lib/discovery';
import { DiscoveryPage } from '@/modules/discovery/ui/DiscoveryPage';
import type { DiscoveryModuleState } from '@/lib/discovery/useDiscoveryModule';

const mockState = vi.fn<() => DiscoveryModuleState>();

vi.mock('@/components/AppProvider', () => ({
  useApp: () => ({
    t: (key: string) => getTranslations('en')[key] ?? key,
    sessionId: 'sess_test',
  }),
}));

vi.mock('@/lib/discovery/useDiscoveryModule', () => ({
  useDiscoveryModule: () => mockState(),
}));

function baseState(overrides: Partial<DiscoveryModuleState> = {}): DiscoveryModuleState {
  return {
    loading: false,
    error: null,
    unauthorized: false,
    profiles: [],
    selectedProfileId: null,
    selectedProfile: null,
    results: [],
    selectedResultId: null,
    selectedResult: null,
    runSummary: null,
    runNowStatus: 'idle',
    runNowError: null,
    runNowResult: null,
    stateUpdateError: null,
    stateUpdating: false,
    emailRecipientConfigured: null,
    userNotificationEmail: null,
    userNotificationEmailKnown: true,
    userNotificationEmailLoading: false,
    userNotificationEmailLoadError: null,
    notificationEmailSaving: false,
    notificationEmailError: null,
    refetch: vi.fn(async () => undefined),
    selectProfile: vi.fn(async () => undefined),
    selectResult: vi.fn(async () => undefined),
    createProfile: vi.fn(async () => undefined),
    updateProfile: vi.fn(async () => undefined),
    setProfileEnabled: vi.fn(async () => undefined),
    setUserNotificationEmail: vi.fn(async () => undefined),
    runNow: vi.fn(async () => undefined),
    updateUserState: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe('E9.2 Discovery UI', () => {
  beforeEach(() => {
    mockState.mockReset();
  });

  it('renders discovery route body surface', () => {
    mockState.mockReturnValue(baseState());
    render(<DiscoveryPage sessionId="sess_test" />);
    expect(screen.getByText('Discovery')).toBeTruthy();
    expect(document.querySelector('[data-ui-surface="discovery-module-body"]')).toBeTruthy();
  });

  it('renders profile list with enabled/disabled badges', () => {
    mockState.mockReturnValue(
      baseState({
        profiles: [
          {
            id: 'p1',
            userId: 'u1',
            name: 'Jobs DE',
            strategyId: 'job-discovery',
            strategyVersion: '1',
            criteria: { required: [], preferred: [], excluded: [], flexible: [] },
            schedule: { cadence: 'manual' },
            notification: { emailEnabled: true, skipEmptyDigest: true },
            enabled: true,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
          {
            id: 'p2',
            userId: 'u1',
            name: 'Giveaways',
            strategyId: 'giveaway-discovery',
            strategyVersion: '1',
            criteria: { required: [], preferred: [], excluded: [], flexible: [] },
            schedule: { cadence: 'manual' },
            notification: { emailEnabled: true, skipEmptyDigest: true },
            enabled: false,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        selectedProfileId: 'p1',
        selectedProfile: {
          id: 'p1',
          userId: 'u1',
          name: 'Jobs DE',
          strategyId: 'job-discovery',
          strategyVersion: '1',
          criteria: {
            required: [{ key: 'country', value: 'DE' }],
            preferred: [],
            excluded: [],
            flexible: [],
          },
          schedule: { cadence: 'manual' },
          notification: { emailEnabled: true, skipEmptyDigest: true },
          enabled: true,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      })
    );

    render(<DiscoveryPage sessionId="sess_test" />);
    expect(screen.getAllByText('Jobs DE').length).toBeGreaterThan(0);
    expect(screen.getByText('Giveaways')).toBeTruthy();
    expect(screen.getByText('Enabled')).toBeTruthy();
    expect(screen.getByText('Disabled')).toBeTruthy();
  });

  it('renders results with NEW and UPDATED badges', () => {
    mockState.mockReturnValue(
      baseState({
        profiles: [
          {
            id: 'p1',
            userId: 'u1',
            name: 'Jobs DE',
            strategyId: 'job-discovery',
            strategyVersion: '1',
            criteria: { required: [], preferred: [], excluded: [], flexible: [] },
            schedule: { cadence: 'manual' },
            notification: { emailEnabled: true, skipEmptyDigest: true },
            enabled: true,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        selectedProfileId: 'p1',
        selectedProfile: {
          id: 'p1',
          userId: 'u1',
          name: 'Jobs DE',
          strategyId: 'job-discovery',
          strategyVersion: '1',
          criteria: { required: [], preferred: [], excluded: [], flexible: [] },
          schedule: { cadence: 'manual' },
          notification: { emailEnabled: true, skipEmptyDigest: true },
          enabled: true,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
        results: [
          {
            id: 'r-new',
            profileId: 'p1',
            strategyId: 'job-discovery',
            strategyVersion: '1',
            canonicalPresentation: { title: 'Frontend Engineer' },
            source: { trust: 'AGGREGATOR' },
            verification: { status: 'PASS' },
            evidence: [
              {
                id: 'ev-1',
                type: 'OFFICIAL_SOURCE',
                statement: 'Hiring now',
                capturedAt: '2026-01-01T00:00:00.000Z',
              },
            ],
            score: {
              matchScore: 0.9,
              confidenceScore: 0.8,
              scoredAt: '2026-01-01T00:00:00.000Z',
            },
            lifecycle: 'ACTIVE',
            userState: 'NEW',
            firstSeenAt: '2026-01-01T00:00:00.000Z',
            lastVerifiedAt: '2026-01-01T00:00:00.000Z',
            lastChangedAt: '2026-01-01T00:00:00.000Z',
            changeMetadata: { inferredNovelty: 'NEW', changedFields: [] },
          },
          {
            id: 'r-upd',
            profileId: 'p1',
            strategyId: 'job-discovery',
            strategyVersion: '1',
            canonicalPresentation: { title: 'Backend Engineer' },
            source: { trust: 'AGGREGATOR' },
            verification: { status: 'PASS' },
            evidence: [],
            score: {
              matchScore: 0.7,
              confidenceScore: 0.6,
              scoredAt: '2026-01-01T00:00:00.000Z',
            },
            lifecycle: 'ACTIVE',
            userState: 'SEEN',
            firstSeenAt: '2026-01-01T00:00:00.000Z',
            lastVerifiedAt: '2026-01-02T00:00:00.000Z',
            lastChangedAt: '2026-01-02T00:00:00.000Z',
            changeMetadata: { inferredNovelty: 'UPDATED', changedFields: ['salary'] },
          },
        ],
      })
    );

    render(<DiscoveryPage sessionId="sess_test" />);
    expect(screen.getByText('Frontend Engineer')).toBeTruthy();
    expect(screen.getByText('Backend Engineer')).toBeTruthy();
    expect(screen.getByText('New')).toBeTruthy();
    expect(screen.getByText('Updated')).toBeTruthy();
  });

  it('shows result detail evidence and verification', () => {
    mockState.mockReturnValue(
      baseState({
        profiles: [
          {
            id: 'p1',
            userId: 'u1',
            name: 'Jobs DE',
            strategyId: 'job-discovery',
            strategyVersion: '1',
            criteria: { required: [], preferred: [], excluded: [], flexible: [] },
            schedule: { cadence: 'manual' },
            notification: { emailEnabled: true, skipEmptyDigest: true },
            enabled: true,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        selectedProfileId: 'p1',
        selectedProfile: {
          id: 'p1',
          userId: 'u1',
          name: 'Jobs DE',
          strategyId: 'job-discovery',
          strategyVersion: '1',
          criteria: { required: [], preferred: [], excluded: [], flexible: [] },
          schedule: { cadence: 'manual' },
          notification: { emailEnabled: true, skipEmptyDigest: true },
          enabled: true,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
        selectedResultId: 'r-new',
        selectedResult: {
          id: 'r-new',
          profileId: 'p1',
          strategyId: 'job-discovery',
          strategyVersion: '1',
          canonicalPresentation: { title: 'Frontend Engineer', summary: 'Great role' },
          source: { trust: 'AGGREGATOR', url: 'https://example.com/job' },
          verification: { status: 'PASS' },
          evidence: [
            {
              id: 'ev-1',
              type: 'OFFICIAL_SOURCE',
              statement: 'Hiring now',
              capturedAt: '2026-01-01T00:00:00.000Z',
            },
          ],
          score: {
            matchScore: 0.9,
            confidenceScore: 0.8,
            scoredAt: '2026-01-01T00:00:00.000Z',
          },
          lifecycle: 'ACTIVE',
          userState: 'NEW',
          firstSeenAt: '2026-01-01T00:00:00.000Z',
          lastVerifiedAt: '2026-01-01T00:00:00.000Z',
          lastChangedAt: '2026-01-01T00:00:00.000Z',
          changeMetadata: { inferredNovelty: 'NEW', changedFields: [] },
        },
        results: [],
      })
    );

    render(<DiscoveryPage sessionId="sess_test" />);
    expect(screen.getByText('Hiring now')).toBeTruthy();
    expect(screen.getByText('Verified')).toBeTruthy();
  });

  it('calls user-state update action from detail panel', async () => {
    const updateUserState = vi.fn(async () => undefined);
    mockState.mockReturnValue(
      baseState({
        profiles: [
          {
            id: 'p1',
            userId: 'u1',
            name: 'Jobs DE',
            strategyId: 'job-discovery',
            strategyVersion: '1',
            criteria: { required: [], preferred: [], excluded: [], flexible: [] },
            schedule: { cadence: 'manual' },
            notification: { emailEnabled: true, skipEmptyDigest: true },
            enabled: true,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        selectedProfileId: 'p1',
        selectedProfile: {
          id: 'p1',
          userId: 'u1',
          name: 'Jobs DE',
          strategyId: 'job-discovery',
          strategyVersion: '1',
          criteria: { required: [], preferred: [], excluded: [], flexible: [] },
          schedule: { cadence: 'manual' },
          notification: { emailEnabled: true, skipEmptyDigest: true },
          enabled: true,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
        selectedResultId: 'r-new',
        selectedResult: {
          id: 'r-new',
          profileId: 'p1',
          strategyId: 'job-discovery',
          strategyVersion: '1',
          canonicalPresentation: { title: 'Frontend Engineer' },
          source: { trust: 'AGGREGATOR' },
          verification: { status: 'PASS' },
          evidence: [],
          score: {
            matchScore: 0.9,
            confidenceScore: 0.8,
            scoredAt: '2026-01-01T00:00:00.000Z',
          },
          lifecycle: 'ACTIVE',
          userState: 'NEW',
          firstSeenAt: '2026-01-01T00:00:00.000Z',
          lastVerifiedAt: '2026-01-01T00:00:00.000Z',
          lastChangedAt: '2026-01-01T00:00:00.000Z',
          changeMetadata: { inferredNovelty: 'NEW', changedFields: [] },
        },
        updateUserState,
      })
    );

    render(<DiscoveryPage sessionId="sess_test" />);
    fireEvent.click(screen.getByRole('button', { name: 'Mark opened' }));
    await waitFor(() => {
      expect(updateUserState).toHaveBeenCalledWith('OPENED');
    });
  });

  it('renders empty results state', () => {
    mockState.mockReturnValue(
      baseState({
        profiles: [
          {
            id: 'p1',
            userId: 'u1',
            name: 'Jobs DE',
            strategyId: 'job-discovery',
            strategyVersion: '1',
            criteria: { required: [], preferred: [], excluded: [], flexible: [] },
            schedule: { cadence: 'manual' },
            notification: { emailEnabled: true, skipEmptyDigest: true },
            enabled: true,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        selectedProfileId: 'p1',
        selectedProfile: {
          id: 'p1',
          userId: 'u1',
          name: 'Jobs DE',
          strategyId: 'job-discovery',
          strategyVersion: '1',
          criteria: { required: [], preferred: [], excluded: [], flexible: [] },
          schedule: { cadence: 'manual' },
          notification: { emailEnabled: true, skipEmptyDigest: true },
          enabled: true,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
        results: [],
        runSummary: {
          profileId: 'p1',
          lastRun: {
            runId: 'run-1',
            scheduleId: 'sched-1',
            profileId: 'p1',
            trigger: 'scheduled',
            startedAt: '2026-01-01T00:00:00.000Z',
            finishedAt: '2026-01-01T00:05:00.000Z',
            status: 'SUCCESS',
          },
        },
      })
    );

    render(<DiscoveryPage sessionId="sess_test" />);
    expect(document.querySelector('[data-ui-surface="discovery-empty-results"]')).toBeTruthy();
    expect(document.querySelector('[data-ui-surface="discovery-zero-new-run"]')).toBeTruthy();
  });

  it('renders API error state when profiles cannot load', () => {
    mockState.mockReturnValue(
      baseState({
        error: 'Discovery API failed (500)',
        profiles: [],
      })
    );

    render(<DiscoveryPage sessionId="sess_test" />);
    expect(document.querySelector('[data-ui-surface="error-panel"]')).toBeTruthy();
    expect(screen.getByText('Discovery API failed (500)')).toBeTruthy();
  });
});

describe('E9.3 Discovery UI', () => {
  beforeEach(() => {
    mockState.mockReset();
  });

  it('opens edit profile form and calls updateProfile', async () => {
    const updateProfile = vi.fn(async () => undefined);
    mockState.mockReturnValue(
      baseState({
        profiles: [
          {
            id: 'p1',
            userId: 'u1',
            name: 'Jobs DE',
            strategyId: 'job-discovery',
            strategyVersion: '1',
            criteria: {
              required: [{ key: 'country', value: 'DE' }],
              preferred: [{ key: 'role', value: 'Engineer' }],
              excluded: [],
              flexible: [],
            },
            schedule: { cadence: 'manual' },
            notification: { emailEnabled: true, skipEmptyDigest: true },
            enabled: true,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        selectedProfileId: 'p1',
        selectedProfile: {
          id: 'p1',
          userId: 'u1',
          name: 'Jobs DE',
          strategyId: 'job-discovery',
          strategyVersion: '1',
          criteria: {
            required: [{ key: 'country', value: 'DE' }],
            preferred: [{ key: 'role', value: 'Engineer' }],
            excluded: [],
            flexible: [],
          },
          schedule: { cadence: 'manual' },
          notification: { emailEnabled: true, skipEmptyDigest: true },
          enabled: true,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
        updateProfile,
      })
    );

    render(<DiscoveryPage sessionId="sess_test" />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit criteria' }));
    expect(document.querySelector('[data-ui-surface="discovery-edit-profile"]')).toBeTruthy();

    const nameInput = screen.getAllByDisplayValue('Jobs DE')[0]!;
    fireEvent.change(nameInput, { target: { value: 'Jobs DE Updated' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      expect(updateProfile).toHaveBeenCalled();
    });
  });

  it('shows run-now loading, success, and error states', () => {
    mockState.mockReturnValue(
      baseState({
        profiles: [
          {
            id: 'p1',
            userId: 'u1',
            name: 'Jobs DE',
            strategyId: 'job-discovery',
            strategyVersion: '1',
            criteria: { required: [], preferred: [], excluded: [], flexible: [] },
            schedule: { cadence: 'manual' },
            notification: { emailEnabled: true, skipEmptyDigest: true },
            enabled: true,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        selectedProfileId: 'p1',
        selectedProfile: {
          id: 'p1',
          userId: 'u1',
          name: 'Jobs DE',
          strategyId: 'job-discovery',
          strategyVersion: '1',
          criteria: { required: [], preferred: [], excluded: [], flexible: [] },
          schedule: { cadence: 'manual' },
          notification: { emailEnabled: true, skipEmptyDigest: true },
          enabled: true,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
        runNowStatus: 'running',
      })
    );
    const { rerender } = render(<DiscoveryPage sessionId="sess_test" />);
    expect(screen.getByText('Running…')).toBeTruthy();

    mockState.mockReturnValue(
      baseState({
        profiles: [
          {
            id: 'p1',
            userId: 'u1',
            name: 'Jobs DE',
            strategyId: 'job-discovery',
            strategyVersion: '1',
            criteria: { required: [], preferred: [], excluded: [], flexible: [] },
            schedule: { cadence: 'manual' },
            notification: { emailEnabled: true, skipEmptyDigest: true },
            enabled: true,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        selectedProfileId: 'p1',
        selectedProfile: {
          id: 'p1',
          userId: 'u1',
          name: 'Jobs DE',
          strategyId: 'job-discovery',
          strategyVersion: '1',
          criteria: { required: [], preferred: [], excluded: [], flexible: [] },
          schedule: { cadence: 'manual' },
          notification: { emailEnabled: true, skipEmptyDigest: true },
          enabled: true,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
        runNowStatus: 'success',
      })
    );
    rerender(<DiscoveryPage sessionId="sess_test" />);
    expect(document.querySelector('[data-ui-surface="discovery-run-now-success"]')).toBeTruthy();

    mockState.mockReturnValue(
      baseState({
        profiles: [
          {
            id: 'p1',
            userId: 'u1',
            name: 'Jobs DE',
            strategyId: 'job-discovery',
            strategyVersion: '1',
            criteria: { required: [], preferred: [], excluded: [], flexible: [] },
            schedule: { cadence: 'manual' },
            notification: { emailEnabled: true, skipEmptyDigest: true },
            enabled: true,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        selectedProfileId: 'p1',
        selectedProfile: {
          id: 'p1',
          userId: 'u1',
          name: 'Jobs DE',
          strategyId: 'job-discovery',
          strategyVersion: '1',
          criteria: { required: [], preferred: [], excluded: [], flexible: [] },
          schedule: { cadence: 'manual' },
          notification: { emailEnabled: true, skipEmptyDigest: true },
          enabled: true,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
        runNowStatus: 'error',
        runNowError: 'Pipeline failed',
      })
    );
    rerender(<DiscoveryPage sessionId="sess_test" />);
    expect(document.querySelector('[data-ui-surface="discovery-run-now-error"]')).toBeTruthy();
    expect(screen.getByText(/Pipeline failed/)).toBeTruthy();
  });

  it('renders score breakdown i18n labels and changed fields from API', () => {
    mockState.mockReturnValue(
      baseState({
        profiles: [
          {
            id: 'p1',
            userId: 'u1',
            name: 'Jobs DE',
            strategyId: 'job-discovery',
            strategyVersion: '1',
            criteria: { required: [], preferred: [], excluded: [], flexible: [] },
            schedule: { cadence: 'manual' },
            notification: { emailEnabled: true, skipEmptyDigest: true },
            enabled: true,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        selectedProfileId: 'p1',
        selectedProfile: {
          id: 'p1',
          userId: 'u1',
          name: 'Jobs DE',
          strategyId: 'job-discovery',
          strategyVersion: '1',
          criteria: { required: [], preferred: [], excluded: [], flexible: [] },
          schedule: { cadence: 'manual' },
          notification: { emailEnabled: true, skipEmptyDigest: true },
          enabled: true,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
        selectedResultId: 'r-upd',
        selectedResult: {
          id: 'r-upd',
          profileId: 'p1',
          strategyId: 'job-discovery',
          strategyVersion: '1',
          canonicalPresentation: { title: 'Backend Engineer' },
          source: { trust: 'AGGREGATOR' },
          verification: { status: 'PASS' },
          evidence: [],
          score: {
            matchScore: 0.7,
            confidenceScore: 0.6,
            scoredAt: '2026-01-01T00:00:00.000Z',
            breakdown: {
              dimensions: [
                {
                  id: 'role',
                  labelKey: 'discovery.score.role',
                  value: 80,
                  weight: 0.3,
                },
              ],
            },
          },
          lifecycle: 'ACTIVE',
          userState: 'SEEN',
          firstSeenAt: '2026-01-01T00:00:00.000Z',
          lastVerifiedAt: '2026-01-02T00:00:00.000Z',
          lastChangedAt: '2026-01-02T00:00:00.000Z',
          changeMetadata: {
            inferredNovelty: 'UPDATED',
            changedFields: ['extracted.salary'],
          },
        },
        results: [],
      })
    );

    render(<DiscoveryPage sessionId="sess_test" />);
    expect(screen.getByText(/Role fit:/)).toBeTruthy();
    expect(screen.getByText('extracted.salary')).toBeTruthy();
  });
});

describe('E10.4 / E13.2b.3 Discovery notification & delivery UX', () => {
  beforeEach(() => {
    mockState.mockReset();
  });

  function profileWithNotification(
    notification: { emailEnabled: boolean; skipEmptyDigest: boolean },
    overrides: Partial<DiscoveryModuleState> = {}
  ) {
    const profile: DiscoveryProfile = {
      id: 'p1',
      userId: 'u1',
      name: 'Jobs DE',
      strategyId: 'job-discovery',
      strategyVersion: '1',
      criteria: {
        required: [{ key: 'country', value: 'DE' }],
        preferred: [{ key: 'role', value: 'Engineer' }],
        excluded: [{ key: 'role', value: 'Team Lead' }],
        flexible: [{ key: 'note', value: 'keep-me' }],
      },
      schedule: { cadence: 'daily', hourUtc: 6 },
      notification,
      enabled: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    const updateProfile = (overrides.updateProfile ??
      vi.fn(async () => undefined)) as DiscoveryModuleState['updateProfile'];
    mockState.mockReturnValue(
      baseState({
        profiles: [profile],
        selectedProfileId: 'p1',
        selectedProfile: profile,
        updateProfile,
        emailRecipientConfigured: true,
        ...overrides,
      })
    );
    return { profile, updateProfile };
  }

  it('renders delivery prefs and recipient configured status (read-only on panel)', () => {
    profileWithNotification({ emailEnabled: true, skipEmptyDigest: false });
    render(<DiscoveryPage sessionId="sess_test" />);
    expect(document.querySelector('[data-ui-surface="discovery-notification-prefs"]')).toBeTruthy();
    expect(screen.getAllByText('Delivery').length).toBeGreaterThan(0);
    expect(document.querySelector('[data-ui-surface="discovery-schedule-summary"]')).toBeTruthy();
    expect(screen.getByText('Daily · 06:00 UTC')).toBeTruthy();
    const emailToggle = screen.getByRole('checkbox', {
      name: /Email notifications/i,
    }) as HTMLInputElement;
    const skipToggle = screen.getByRole('checkbox', {
      name: /Skip empty digests/i,
    }) as HTMLInputElement;
    expect(emailToggle.checked).toBe(true);
    expect(emailToggle.disabled).toBe(true);
    expect(skipToggle.checked).toBe(false);
    expect(screen.getByText('Configured')).toBeTruthy();
    expect(
      document.querySelector(
        '[data-ui-surface="discovery-notification-recipient"][data-recipient-configured="true"]'
      )
    ).toBeTruthy();
    expect(
      document.querySelector('[data-ui-surface="discovery-notification-recipient-gap"]')
    ).toBeNull();
  });

  it('shows not-configured recipient and delivery gap when email is enabled', () => {
    profileWithNotification(
      { emailEnabled: true, skipEmptyDigest: true },
      { emailRecipientConfigured: false }
    );
    render(<DiscoveryPage sessionId="sess_test" />);
    expect(screen.getByText(/Not configured/)).toBeTruthy();
    expect(
      document.querySelector('[data-ui-surface="discovery-notification-recipient-gap"]')
    ).toBeTruthy();
  });

  it('notifications off + recipient configured is not shown as a delivery gap', () => {
    profileWithNotification(
      { emailEnabled: false, skipEmptyDigest: true },
      { emailRecipientConfigured: true }
    );
    render(<DiscoveryPage sessionId="sess_test" />);
    expect(screen.getByText('Email notifications are off.')).toBeTruthy();
    expect(
      document.querySelector('[data-ui-surface="discovery-notification-recipient-gap"]')
    ).toBeNull();
  });

  it('edit loads notification prefs and saves with criteria/schedule preserved', async () => {
    const { updateProfile, profile } = profileWithNotification({
      emailEnabled: true,
      skipEmptyDigest: true,
    });
    render(<DiscoveryPage sessionId="sess_test" />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit criteria' }));

    expect(
      document.querySelector('[data-ui-surface="discovery-notification-compact"]')
    ).toBeTruthy();
    expect(screen.getAllByRole('checkbox', { name: /Email notifications/i })).toHaveLength(1);

    const editEmail = screen.getByRole('checkbox', {
      name: /Email notifications/i,
    }) as HTMLInputElement;
    expect(editEmail.checked).toBe(true);
    expect(editEmail.disabled).toBe(false);

    fireEvent.click(editEmail);
    const skipToggle = screen.getByRole('checkbox', { name: /Skip empty digests/i });
    fireEvent.click(skipToggle);
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      expect(updateProfile).toHaveBeenCalledWith(
        'p1',
        expect.objectContaining({
          notification: { emailEnabled: false, skipEmptyDigest: false },
          schedule: { cadence: 'daily', hourUtc: 6 },
          criteria: expect.objectContaining({
            excluded: [{ key: 'role', value: 'Team Lead' }],
            flexible: [{ key: 'note', value: 'keep-me' }],
          }),
        })
      );
    });
    expect(profile.schedule).toEqual({ cadence: 'daily', hourUtc: 6 });
  });

  it('includes notification delivery i18n keys in all locales', () => {
    for (const locale of ['en', 'de', 'ru', 'ua'] as const) {
      const translations = getTranslations(locale);
      expect(translations['discovery.notification.title']).toBeTruthy();
      expect(translations['discovery.notification.emailEnabled.label']).toBeTruthy();
      expect(translations['discovery.notification.skipEmptyDigest.label']).toBeTruthy();
      expect(translations['discovery.notification.recipient.label']).toBeTruthy();
      expect(translations['discovery.notification.recipient.configured']).toBeTruthy();
      expect(translations['discovery.notification.recipient.notConfigured']).toBeTruthy();
      expect(translations['discovery.notification.recipient.unavailable']).toBeTruthy();
      expect(translations['discovery.notification.address.label']).toBeTruthy();
      expect(translations['discovery.notification.address.systemAvailable']).toBeTruthy();
      expect(translations['discovery.notification.address.unavailable']).toBeTruthy();
      expect(translations['discovery.notification.compact.deliveryReady']).toBeTruthy();
      expect(translations['discovery.notification.compact.personalEmail']).toBeTruthy();
    }
  });

  it('displays configured personal email on the delivery panel', () => {
    profileWithNotification(
      { emailEnabled: true, skipEmptyDigest: true },
      {
        userNotificationEmail: 'User@Example.com',
        emailRecipientConfigured: true,
      }
    );
    render(<DiscoveryPage sessionId="sess_test" />);
    expect(screen.getByText('User@Example.com')).toBeTruthy();
    expect(screen.getByText('Personal notification email is configured.')).toBeTruthy();
    expect(document.body.textContent).not.toContain('DISCOVERY_NOTIFICATION_EMAIL');
  });

  it('shows system-available status when no personal email but delivery is configured', () => {
    profileWithNotification(
      { emailEnabled: true, skipEmptyDigest: true },
      {
        userNotificationEmail: null,
        emailRecipientConfigured: true,
      }
    );
    render(<DiscoveryPage sessionId="sess_test" />);
    expect(
      screen.getByText(
        'Email delivery is available. No personal notification email is configured.'
      )
    ).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/ops@|env-fallback|DISCOVERY_NOTIFICATION/);
  });

  it('shows unavailable status when neither personal email nor delivery is configured', () => {
    profileWithNotification(
      { emailEnabled: true, skipEmptyDigest: true },
      {
        userNotificationEmail: null,
        emailRecipientConfigured: false,
      }
    );
    render(<DiscoveryPage sessionId="sess_test" />);
    expect(screen.getByText('No notification email is configured.')).toBeTruthy();
  });

  it('Save email calls setUserNotificationEmail only; profile Save does not', async () => {
    const setUserNotificationEmail = vi.fn(async () => undefined);
    const { updateProfile } = profileWithNotification(
      { emailEnabled: true, skipEmptyDigest: true },
      {
        userNotificationEmail: null,
        emailRecipientConfigured: false,
        setUserNotificationEmail,
      }
    );
    render(<DiscoveryPage sessionId="sess_test" />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit criteria' }));

    const input = screen.getByRole('textbox', {
      name: 'Notification email',
    }) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '  Me@Example.com  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save email' }));

    await waitFor(() => {
      expect(setUserNotificationEmail).toHaveBeenCalledWith('Me@Example.com');
    });
    expect(updateProfile).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => {
      expect(updateProfile).toHaveBeenCalled();
    });
    const payload = (updateProfile as ReturnType<typeof vi.fn>).mock.calls[0][1] as Record<
      string,
      unknown
    >;
    expect(payload).not.toHaveProperty('userNotificationEmail');
    expect(payload).not.toHaveProperty('email');
    expect(JSON.stringify(payload)).not.toContain('Me@Example.com');
  });

  it('Clear sends null via setUserNotificationEmail', async () => {
    const setUserNotificationEmail = vi.fn(async () => undefined);
    profileWithNotification(
      { emailEnabled: true, skipEmptyDigest: true },
      {
        userNotificationEmail: 'keep@example.com',
        emailRecipientConfigured: true,
        setUserNotificationEmail,
      }
    );
    render(<DiscoveryPage sessionId="sess_test" />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit criteria' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));

    await waitFor(() => {
      expect(setUserNotificationEmail).toHaveBeenCalledWith(null);
    });
  });

  it('save failure preserves the typed email input', async () => {
    const setUserNotificationEmail = vi.fn(async () => {
      throw new Error('Invalid notification email');
    });
    profileWithNotification(
      { emailEnabled: true, skipEmptyDigest: true },
      {
        userNotificationEmail: null,
        emailRecipientConfigured: false,
        setUserNotificationEmail,
      }
    );
    render(<DiscoveryPage sessionId="sess_test" />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit criteria' }));
    const input = screen.getByRole('textbox', {
      name: 'Notification email',
    }) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'keep-me@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save email' }));
    await waitFor(() => {
      expect(setUserNotificationEmail).toHaveBeenCalledWith('keep-me@example.com');
    });
    expect(
      (screen.getByRole('textbox', { name: 'Notification email' }) as HTMLInputElement).value
    ).toBe('keep-me@example.com');
  });

  it('shows mutation error from module state', () => {
    profileWithNotification(
      { emailEnabled: true, skipEmptyDigest: true },
      {
        userNotificationEmail: null,
        emailRecipientConfigured: false,
        notificationEmailError: 'Invalid notification email',
      }
    );
    render(<DiscoveryPage sessionId="sess_test" />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit criteria' }));
    expect(screen.getByText('Invalid notification email')).toBeTruthy();
  });

  it('disables Save while notification email mutation is in progress', () => {
    profileWithNotification(
      { emailEnabled: true, skipEmptyDigest: true },
      {
        userNotificationEmail: null,
        emailRecipientConfigured: false,
        notificationEmailSaving: true,
      }
    );
    render(<DiscoveryPage sessionId="sess_test" />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit criteria' }));
    const input = screen.getByRole('textbox', {
      name: 'Notification email',
    }) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'a@example.com' } });
    const save = screen.getByRole('button', { name: 'Save email' }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
  });

  it('does not render infrastructure fallback terminology', () => {
    profileWithNotification(
      { emailEnabled: true, skipEmptyDigest: true },
      {
        userNotificationEmail: null,
        emailRecipientConfigured: true,
      }
    );
    render(<DiscoveryPage sessionId="sess_test" />);
    const text = document.body.textContent ?? '';
    expect(text).not.toContain('DISCOVERY_NOTIFICATION_EMAIL');
    expect(text).not.toContain('infrastructure');
    expect(text).not.toContain('fallback');
  });
});

describe('Discovery UI — excluded roles (E13.2b.1)', () => {
  beforeEach(() => {
    mockState.mockReset();
  });

  it('renders persisted excluded roles when editing a jobs profile', async () => {
    const profile: DiscoveryProfile = {
      id: 'p1',
      userId: 'u1',
      name: 'Jobs DE',
      strategyId: 'job-discovery',
      strategyVersion: '1',
      criteria: {
        required: [{ key: 'country', value: 'DE' }],
        preferred: [{ key: 'role', value: 'Senior Frontend Engineer' }],
        excluded: [
          { key: 'role', value: 'Team Lead' },
          { key: 'role', value: 'QA Engineer' },
        ],
        flexible: [],
      },
      schedule: { cadence: 'manual' },
      notification: { emailEnabled: true, skipEmptyDigest: true },
      enabled: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    mockState.mockReturnValue(
      baseState({
        profiles: [profile],
        selectedProfileId: 'p1',
        selectedProfile: profile,
      })
    );

    render(<DiscoveryPage sessionId="sess_test" />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit criteria' }));

    expect(screen.getByText('Excluded roles')).toBeTruthy();
    expect(screen.getByText('Team Lead')).toBeTruthy();
    expect(screen.getByText('QA Engineer')).toBeTruthy();
  });

  it('adds and removes excluded roles; ignores whitespace and duplicates', async () => {
    const createProfile = vi.fn(async () => undefined);
    mockState.mockReturnValue(baseState({ createProfile }));

    render(<DiscoveryPage sessionId="sess_test" />);
    fireEvent.click(screen.getByRole('button', { name: 'New profile' }));

    const input = screen.getByRole('textbox', { name: /Excluded roles/ });
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByText('No excluded roles')).toBeTruthy();

    fireEvent.change(input, { target: { value: 'Team Lead' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByText('Team Lead')).toBeTruthy();

    fireEvent.change(input, { target: { value: 'Team Lead' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getAllByText('Team Lead')).toHaveLength(1);

    fireEvent.change(input, { target: { value: 'Engineering Manager' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByText('Engineering Manager')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Remove Team Lead' }));
    expect(screen.queryByText('Team Lead')).toBeNull();
    expect(screen.getByText('Engineering Manager')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Profile name'), {
      target: { value: 'My Jobs' },
    });
    fireEvent.change(screen.getByLabelText('Country code'), { target: { value: 'DE' } });
    fireEvent.change(screen.getByLabelText(/Preferred role/), {
      target: { value: 'Senior Frontend Engineer' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create profile' }));

    await waitFor(() => {
      expect(createProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          criteria: expect.objectContaining({
            excluded: [{ key: 'role', value: 'Engineering Manager' }],
          }),
        })
      );
    });
  });

  it('update payload includes excluded roles and preserves flexible criteria', async () => {
    const updateProfile = vi.fn(async () => undefined);
    const profile: DiscoveryProfile = {
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
    };
    mockState.mockReturnValue(
      baseState({
        profiles: [profile],
        selectedProfileId: 'p1',
        selectedProfile: profile,
        updateProfile,
      })
    );

    render(<DiscoveryPage sessionId="sess_test" />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit criteria' }));

    const input = screen.getByRole('textbox', { name: /Excluded roles/ });
    fireEvent.change(input, { target: { value: 'Backend Developer' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      expect(updateProfile).toHaveBeenCalledWith(
        'p1',
        expect.objectContaining({
          criteria: expect.objectContaining({
            excluded: [
              { key: 'role', value: 'Team Lead' },
              { key: 'role', value: 'Backend Developer' },
            ],
            flexible: [{ key: 'note', value: 'keep-me' }],
          }),
        })
      );
    });
  });

  it('includes excluded-roles i18n keys in all locales', () => {
    for (const locale of ['en', 'de', 'ru', 'ua'] as const) {
      const translations = getTranslations(locale);
      expect(translations['discovery.criteria.excludedRoles.label']).toBeTruthy();
      expect(translations['discovery.criteria.excludedRoles.description']).toBeTruthy();
      expect(translations['discovery.criteria.excludedRoles.add']).toBeTruthy();
      expect(translations['discovery.criteria.excludedRoles.remove']).toBeTruthy();
      expect(translations['discovery.criteria.excludedRoles.empty']).toBeTruthy();
    }
  });
});

describe('Discovery UI — schedule (E13.2b.2)', () => {
  beforeEach(() => {
    mockState.mockReset();
  });

  it('new profile defaults to Manual schedule', () => {
    mockState.mockReturnValue(baseState());
    render(<DiscoveryPage sessionId="sess_test" />);
    fireEvent.click(screen.getByRole('button', { name: 'New profile' }));

    const manual = screen.getByRole('radio', { name: /Manual/i }) as HTMLInputElement;
    expect(manual.checked).toBe(true);
    expect(screen.queryByLabelText(/Daily run time \(UTC\)/i)).toBeNull();
  });

  it('create with Daily schedule includes hourUtc in payload', async () => {
    const createProfile = vi.fn(async () => undefined);
    mockState.mockReturnValue(baseState({ createProfile }));

    render(<DiscoveryPage sessionId="sess_test" />);
    fireEvent.click(screen.getByRole('button', { name: 'New profile' }));
    fireEvent.change(screen.getByLabelText('Profile name'), {
      target: { value: 'My Jobs' },
    });
    fireEvent.change(screen.getByLabelText('Country code'), { target: { value: 'DE' } });

    fireEvent.click(screen.getByRole('radio', { name: /Daily/i }));
    const hourSelect = screen.getByLabelText(/Daily run time \(UTC\)/i);
    fireEvent.change(hourSelect, { target: { value: '9' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create profile' }));

    await waitFor(() => {
      expect(createProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          schedule: { cadence: 'daily', hourUtc: 9 },
        })
      );
    });
  });

  it('create with Manual keeps manual schedule', async () => {
    const createProfile = vi.fn(async () => undefined);
    mockState.mockReturnValue(baseState({ createProfile }));

    render(<DiscoveryPage sessionId="sess_test" />);
    fireEvent.click(screen.getByRole('button', { name: 'New profile' }));
    fireEvent.change(screen.getByLabelText('Profile name'), {
      target: { value: 'My Jobs' },
    });
    fireEvent.change(screen.getByLabelText('Country code'), { target: { value: 'DE' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create profile' }));

    await waitFor(() => {
      expect(createProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          schedule: { cadence: 'manual' },
        })
      );
    });
  });

  it('loads persisted Daily schedule and saves changed hourUtc', async () => {
    const updateProfile = vi.fn(async () => undefined);
    const profile: DiscoveryProfile = {
      id: 'p1',
      userId: 'u1',
      name: 'Jobs DE',
      strategyId: 'job-discovery',
      strategyVersion: '1',
      criteria: {
        required: [{ key: 'country', value: 'DE' }],
        preferred: [{ key: 'role', value: 'Engineer' }],
        excluded: [],
        flexible: [{ key: 'note', value: 'keep-me' }],
      },
      schedule: { cadence: 'daily', hourUtc: 6 },
      notification: { emailEnabled: true, skipEmptyDigest: true },
      enabled: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    mockState.mockReturnValue(
      baseState({
        profiles: [profile],
        selectedProfileId: 'p1',
        selectedProfile: profile,
        updateProfile,
      })
    );

    render(<DiscoveryPage sessionId="sess_test" />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit criteria' }));

    const daily = screen.getByRole('radio', { name: /Daily/i }) as HTMLInputElement;
    expect(daily.checked).toBe(true);
    const hourSelect = screen.getByLabelText(/Daily run time \(UTC\)/i) as HTMLSelectElement;
    expect(hourSelect.value).toBe('6');

    fireEvent.change(hourSelect, { target: { value: '15' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      expect(updateProfile).toHaveBeenCalledWith(
        'p1',
        expect.objectContaining({
          schedule: { cadence: 'daily', hourUtc: 15 },
          criteria: expect.objectContaining({
            flexible: [{ key: 'note', value: 'keep-me' }],
          }),
        })
      );
    });
    const patch = (updateProfile.mock.calls as unknown as Array<[string, Record<string, unknown>]>)[0]?.[1];
    expect(patch?.schedule).toEqual({ cadence: 'daily', hourUtc: 15 });
    expect(patch?.notification).toEqual({
      emailEnabled: true,
      skipEmptyDigest: true,
    });
  });

  it('preserves weekly schedule as read-only on edit/save', async () => {
    const updateProfile = vi.fn(async () => undefined);
    const profile: DiscoveryProfile = {
      id: 'p1',
      userId: 'u1',
      name: 'Jobs Weekly',
      strategyId: 'job-discovery',
      strategyVersion: '1',
      criteria: {
        required: [{ key: 'country', value: 'DE' }],
        preferred: [],
        excluded: [],
        flexible: [],
      },
      schedule: { cadence: 'weekly', dayOfWeek: 2, hourUtc: 9 },
      notification: { emailEnabled: true, skipEmptyDigest: true },
      enabled: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    mockState.mockReturnValue(
      baseState({
        profiles: [profile],
        selectedProfileId: 'p1',
        selectedProfile: profile,
        updateProfile,
      })
    );

    render(<DiscoveryPage sessionId="sess_test" />);
    expect(screen.getByText('Weekly · Tuesday · 09:00 UTC')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Edit criteria' }));

    expect(document.querySelector('[data-ui-surface="discovery-schedule-weekly"]')).toBeTruthy();
    expect(screen.queryByRole('radio', { name: /Manual/i })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      expect(updateProfile).toHaveBeenCalledWith(
        'p1',
        expect.objectContaining({
          schedule: { cadence: 'weekly', dayOfWeek: 2, hourUtc: 9 },
        })
      );
    });
  });

  it('includes schedule i18n keys in all locales', () => {
    for (const locale of ['en', 'de', 'ru', 'ua'] as const) {
      const translations = getTranslations(locale);
      expect(translations['discovery.schedule.title']).toBeTruthy();
      expect(translations['discovery.schedule.manual']).toBeTruthy();
      expect(translations['discovery.schedule.daily']).toBeTruthy();
      expect(translations['discovery.schedule.hourUtc.label']).toBeTruthy();
      expect(translations['discovery.schedule.utc']).toBeTruthy();
      expect(translations['discovery.schedule.weeklyUnsupported']).toBeTruthy();
    }
  });
});
