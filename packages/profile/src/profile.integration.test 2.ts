import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryProfileStore } from './adapters/in-memory-store.js';
import { ProfileEngine } from './engine/profile-engine.js';
import { resolveExecutionContext } from './engine/resolve-execution-context.js';

describe('profile vertical slice (Phase 0)', () => {
  let store: InMemoryProfileStore;
  let engine: ProfileEngine;

  beforeEach(() => {
    store = new InMemoryProfileStore();
    engine = new ProfileEngine(store);
  });

  it('creates, updates, and resolves execution context for financial module', async () => {
    const sessionId = 'sess_integration';

    const profile = await engine.createProfile({ preferredLanguage: 'en' });
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
        benefits: { daysInGermany: 120 },
        insurance: { hasCoverage: true, type: 'public' },
      },
      1
    );

    const fromProfile = await resolveExecutionContext(engine, {
      sessionId,
      moduleId: 'financial-reality',
      requestInput: {},
    });

    expect(fromProfile.profile?.revision).toBe(2);
    expect(fromProfile.mergedInput.grossIncome).toBe(2500);
    expect(fromProfile.mergedInput.monthlyRent).toBe(800);
    expect(fromProfile.context.userProfile?.income).toBe(2500);
    expect(fromProfile.context.profileSlice?.insurance).toEqual({
      hasCoverage: true,
      type: 'public',
    });
    expect(fromProfile.context.profileSlice?.benefits).toEqual({
      daysInGermany: 120,
    });
    expect(fromProfile.profileSlice?.insurance?.hasCoverage).toBe(true);
    expect(fromProfile.profileSlice?.benefits?.daysInGermany).toBe(120);

    const withOverride = await resolveExecutionContext(engine, {
      sessionId,
      moduleId: 'financial-reality',
      requestInput: { grossIncome: 3200 },
    });

    expect(withOverride.mergedInput.grossIncome).toBe(3200);
    expect(withOverride.context.dataProvenance).toEqual(
      expect.arrayContaining([{ field: 'grossIncome', source: 'input' }])
    );
  });
});
