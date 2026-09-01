import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { getTranslations } from '@arrival-atlas/core';
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
    refetch: vi.fn(async () => undefined),
    selectProfile: vi.fn(async () => undefined),
    selectResult: vi.fn(async () => undefined),
    createProfile: vi.fn(async () => undefined),
    updateProfile: vi.fn(async () => undefined),
    setProfileEnabled: vi.fn(async () => undefined),
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
