import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryProfileStore } from '../adapters/in-memory-store.js';
import { ProfileEngine } from './profile-engine.js';
import { resolveExecutionContext } from './resolve-execution-context.js';

describe('resolveExecutionContext', () => {
  let store: InMemoryProfileStore;
  let engine: ProfileEngine;
  const sessionId = 'sess_resolve_test';

  beforeEach(async () => {
    store = new InMemoryProfileStore();
    engine = new ProfileEngine(store);

    const profile = await engine.createProfile({ preferredLanguage: 'de' });
    await engine.bindSession(sessionId, profile.id);
    await engine.updateProfile(
      profile.id,
      {
        employment: {
          grossMonthlyIncome: 2500,
          taxClass: 1,
          churchTax: false,
          status: 'employed',
        },
        household: { size: 2, maritalStatus: 'single' },
        housing: { monthlyColdRent: 800 },
        insurance: { hasCoverage: true, type: 'public' },
        benefits: { daysInGermany: 90 },
      },
      1
    );
  });

  it('loads profile and merges module input from profile when request input is empty', async () => {
    const result = await resolveExecutionContext(engine, {
      sessionId,
      moduleId: 'financial-reality',
      requestInput: {},
    });

    expect(result.profile).not.toBeNull();
    expect(result.profile?.revision).toBe(2);
    expect(result.mergedInput.grossIncome).toBe(2500);
    expect(result.mergedInput.monthlyRent).toBe(800);
    expect(result.mergedInput.householdSize).toBe(2);

    expect(result.context.profileId).toBe(result.profile?.id);
    expect(result.context.profileVersion).toBe(2);
    expect(result.context.userProfile?.income).toBe(2500);
    expect(result.context.profileSlice?.employment).toEqual(
      expect.objectContaining({
        taxClass: 1,
        status: 'employed',
        churchTax: false,
      })
    );
    expect(
      (result.context.profileSlice?.employment as Record<string, unknown> | undefined)
        ?.grossMonthlyIncome
    ).toBeUndefined();
    expect(result.profileSlice?.employment?.grossMonthlyIncome).toBeUndefined();
    expect(result.context.profileSlice?.insurance).toEqual({
      hasCoverage: true,
      type: 'public',
    });
    expect(result.context.profileSlice?.benefits).toEqual({ daysInGermany: 90 });
    expect(result.profileSlice?.insurance?.hasCoverage).toBe(true);
    expect(result.profileSlice?.benefits?.daysInGermany).toBe(90);

    expect(result.context.dataProvenance).toEqual(
      expect.arrayContaining([
        { field: 'grossIncome', source: 'profile' },
        { field: 'monthlyRent', source: 'profile' },
        { field: 'userProfile.income', source: 'profile' },
      ])
    );

    expect(result.trace.sessionId).toBe(sessionId);
    expect(result.trace.moduleId).toBe('financial-reality');
    expect(result.trace.steps).toEqual(
      expect.arrayContaining([
        { type: 'PROFILE_LOADED', profileId: result.profile!.id },
        { type: 'POLICY_APPLIED', policyId: 'financial-reality' },
        { type: 'FIELD_ALLOWED', field: 'employment' },
        { type: 'FIELD_ALLOWED', field: 'insurance' },
        { type: 'FIELD_ALLOWED', field: 'benefits' },
        { type: 'FIELD_REDACTED', field: 'employment.grossMonthlyIncome' },
        { type: 'MERGE_DECISION', field: 'grossIncome', source: 'profile' },
        { type: 'FINAL_VALUE', field: 'grossIncome', value: 2500 },
      ])
    );
  });

  it('request input overrides profile values', async () => {
    const result = await resolveExecutionContext(engine, {
      sessionId,
      moduleId: 'financial-reality',
      requestInput: { grossIncome: 3200 },
    });

    expect(result.mergedInput.grossIncome).toBe(3200);
    expect(result.context.dataProvenance).toEqual(
      expect.arrayContaining([{ field: 'grossIncome', source: 'input' }])
    );
    expect(result.trace.steps).toEqual(
      expect.arrayContaining([
        { type: 'MERGE_DECISION', field: 'grossIncome', source: 'input' },
        { type: 'FINAL_VALUE', field: 'grossIncome', value: 3200 },
      ])
    );
  });

  it('request overrides sit between input and profile', async () => {
    const result = await resolveExecutionContext(engine, {
      sessionId,
      moduleId: 'financial-reality',
      requestInput: {},
      inputOverrides: { monthlyRent: 1100 },
    });

    expect(result.mergedInput.monthlyRent).toBe(1100);
    expect(result.context.dataProvenance).toEqual(
      expect.arrayContaining([{ field: 'monthlyRent', source: 'override' }])
    );
    expect(result.trace.steps).toEqual(
      expect.arrayContaining([
        { type: 'INPUT_OVERRIDE', field: 'monthlyRent', value: 1100 },
        { type: 'FINAL_VALUE', field: 'monthlyRent', value: 1100 },
      ])
    );
  });

  it('works without session profile using defaults', async () => {
    const result = await resolveExecutionContext(engine, {
      moduleId: 'financial-reality',
      requestInput: {},
    });

    expect(result.profile).toBeNull();
    expect(result.mergedInput.grossIncome).toBe(0);
    expect(result.mergedInput.householdSize).toBe(1);
    expect(result.context.dataProvenance).toEqual(
      expect.arrayContaining([{ field: 'grossIncome', source: 'default' }])
    );
  });
});
