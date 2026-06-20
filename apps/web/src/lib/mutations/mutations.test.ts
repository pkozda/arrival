import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchUserContext, submitMutation } from './client.js';
import { buildHeaderLanguageMutation } from './request-builders.js';
import { mergeUserProfileIntoDefaults } from './user-profile-prefill.js';
import type { UserProfileViewV1 } from '@/lib/product-contract';

describe('fetchUserContext', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('parses UserContextV1 from GET /api/user-context', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        profile: {
          schemaVersion: '1.0.0',
          preferences: { preferredLanguage: 'en' },
          completeness: { score: 10, missingDomains: ['housing'] },
          domains: {
            income: { grossMonthlyIncome: 2500 },
          },
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const context = await fetchUserContext('sess_1');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/api/user-context',
      expect.objectContaining({
        headers: expect.objectContaining({ 'x-session-id': 'sess_1' }),
      })
    );
    expect(context.profile?.domains.income?.grossMonthlyIncome).toBe(2500);
  });
});

describe('submitMutation', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns authoritative UserContextV1 from POST /api/mutations', async () => {
    const request = buildHeaderLanguageMutation('de');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        revision: 2,
        appliedEventId: 'evt_2_req',
        userContext: {
          profile: {
            schemaVersion: '1.0.0',
            preferences: { preferredLanguage: 'de' },
            completeness: { score: 0, missingDomains: [] },
            domains: {},
          },
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const context = await submitMutation(request, 'sess_1');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/api/mutations',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(request),
      })
    );
    expect(context.profile?.preferences.preferredLanguage).toBe('de');
  });

  it('requires requestId for idempotency', async () => {
    await expect(
      submitMutation(
        {
          ...buildHeaderLanguageMutation('en'),
          requestId: '',
          id: '',
        },
        'sess_1'
      )
    ).rejects.toThrow(/requestId is required/);
  });
});

describe('mergeUserProfileIntoDefaults', () => {
  it('maps UserProfileViewV1 domain fields to module input keys', () => {
    const profile: UserProfileViewV1 = {
      schemaVersion: '1.0.0',
      preferences: { preferredLanguage: 'en' },
      completeness: { score: 0, missingDomains: [] },
      domains: {
        income: { grossMonthlyIncome: 3200 },
        employment: { employmentStatus: 'employed' },
        housing: { monthlyColdRent: 950 },
      },
    };

    const merged = mergeUserProfileIntoDefaults(
      { grossIncome: 0, employmentStatus: 'unemployed', monthlyRent: 0 },
      profile
    );

    expect(merged).toEqual({
      grossIncome: 3200,
      employmentStatus: 'employed',
      monthlyRent: 950,
    });
  });
});
