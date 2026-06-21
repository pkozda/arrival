import { describe, expect, it, vi } from 'vitest';
import { commitStateTransaction } from './RuntimeConsistencyProvider';
import { EMPTY_ECONOMIC_REALITY_CLIENT_STATE } from '@/lib/economic-reality/economic-reality-client-state';
import type { DomainStateTransaction } from './stateTransaction';

describe('commitStateTransaction', () => {
  it('applies all domain payloads atomically through a single commit callback', () => {
    let userContext: unknown = 'unset';
    let economicPlan: unknown = 'unset';
    let loadingCalls = 0;

    const transaction: DomainStateTransaction = {
      domains: {
        PROFILE: {
          userContext: {
            schemaVersion: '1.0.0',
            profile: { language: 'en' },
          },
          profileInsights: null,
        },
        ECONOMIC: {
          economicPlan: {
            ...EMPTY_ECONOMIC_REALITY_CLIENT_STATE,
            deterministicHash: 'hash-1',
          },
        },
      },
      loading: {
        PROFILE: false,
        ECONOMIC: false,
      },
      consistencyPolicy: 'satisfied',
    };

    commitStateTransaction(transaction, {
      setUserContext: (value) => {
        userContext = value;
      },
      setProfileInsights: () => {},
      setLifeEventPlan: () => {},
      setUiSnapshot: () => {},
      setEconomicPlan: (value) => {
        economicPlan = value;
      },
      setProfileHeadRevision: () => {},
      setLoading: (updater) => {
        loadingCalls += 1;
        const next = updater({
          userContext: true,
          profileInsights: true,
          lifeEventPlan: true,
          uiSnapshot: true,
          economicPlan: true,
        });
        expect(next.userContext).toBe(false);
        expect(next.economicPlan).toBe(false);
      },
      setErrors: () => {},
    });

    expect(userContext).not.toBe('unset');
    expect(economicPlan).not.toBe('unset');
    expect(loadingCalls).toBe(1);
  });

  it('does not commit domain payloads when consistency policy is degraded', () => {
    const setUserContext = vi.fn();
    const setEconomicPlan = vi.fn();
    const setLoading = vi.fn((updater: (current: {
      userContext: boolean;
      profileInsights: boolean;
      lifeEventPlan: boolean;
      uiSnapshot: boolean;
      economicPlan: boolean;
    }) => unknown) => {
      updater({
        userContext: true,
        profileInsights: true,
        lifeEventPlan: true,
        uiSnapshot: true,
        economicPlan: true,
      });
    });

    commitStateTransaction(
      {
        domains: {
          PROFILE: {
            userContext: { schemaVersion: '1.0.0', profile: { language: 'en' } },
            profileInsights: null,
          },
        },
        loading: { PROFILE: false },
        errors: { PROFILE: 'profile unavailable' },
        consistencyPolicy: 'degraded',
      },
      {
        setUserContext,
        setProfileInsights: () => {},
        setLifeEventPlan: () => {},
        setUiSnapshot: () => {},
        setEconomicPlan,
        setProfileHeadRevision: () => {},
        setLoading,
        setErrors: () => {},
      }
    );

    expect(setUserContext).not.toHaveBeenCalled();
    expect(setEconomicPlan).not.toHaveBeenCalled();
    expect(setLoading).toHaveBeenCalledTimes(1);
  });
});
