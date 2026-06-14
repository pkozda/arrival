import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryProfileStore } from '../adapters/in-memory-store.js';
import { ProfileEngine } from './profile-engine.js';
import { ProfileRevisionConflictError } from '../errors/profile-revision-conflict.js';

describe('ProfileEngine.resolveForModule', () => {
  let engine: ProfileEngine;

  beforeEach(() => {
    engine = new ProfileEngine(new InMemoryProfileStore());
  });

  it('returns core fields and module-specific extensions only', async () => {
    const profile = await engine.createProfile({
      preferredLanguage: 'ru',
      location: { bundesland: 'BE', city: 'Berlin' },
      employment: { grossMonthlyIncome: 1800, status: 'employed' },
      extensions: {
        'financial-reality': { lastScenario: 'compare' },
        'healthcare-navigation': { preferredClinic: 'Charité' },
      },
    });

    const slice = engine.resolveForModule('financial-reality', profile);

    expect(slice.preferredLanguage).toBe('ru');
    expect(slice.location?.city).toBe('Berlin');
    expect(slice.employment?.grossMonthlyIncome).toBe(1800);
    expect(slice.extensions).toEqual({
      'financial-reality': { lastScenario: 'compare' },
    });
    expect(slice.extensions?.['healthcare-navigation']).toBeUndefined();
  });

  it('increments revision on update and enforces optimistic concurrency', async () => {
    const profile = await engine.createProfile({ preferredLanguage: 'en' });
    expect(profile.revision).toBe(1);

    const updated = await engine.updateProfile(
      profile.id,
      { household: { size: 2 } },
      1
    );
    expect(updated.revision).toBe(2);
    expect(updated.document.household?.size).toBe(2);

    await expect(
      engine.updateProfile(profile.id, { household: { size: 4 } }, 1)
    ).rejects.toBeInstanceOf(ProfileRevisionConflictError);
  });

  it('lists revisions after updates', async () => {
    const profile = await engine.createProfile({ preferredLanguage: 'de' });
    await engine.updateProfile(profile.id, { household: { size: 2 } }, 1);

    const revisions = await engine.listRevisions(profile.id);
    expect(revisions).toHaveLength(2);
    expect(revisions[0]?.revision).toBe(2);
  });
});

describe('InMemoryProfileStore session binding', () => {
  it('binds and resolves profile by session', async () => {
    const store = new InMemoryProfileStore();
    const engine = new ProfileEngine(store);
    const profile = await engine.createProfile({ preferredLanguage: 'ua' });

    await engine.bindSession('sess_test', profile.id);

    const bySession = await engine.getProfileBySession('sess_test');
    expect(bySession?.id).toBe(profile.id);
  });
});
