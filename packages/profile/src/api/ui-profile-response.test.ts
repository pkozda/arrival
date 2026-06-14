import { describe, it, expect } from 'vitest';
import { toUIProfileResponse } from './ui-profile-response.js';

describe('toUIProfileResponse', () => {
  it('maps engine record to UI contract without internal fields', () => {
    const response = toUIProfileResponse({
      revision: 2,
      document: {
        schemaVersion: '1.0.0',
        preferredLanguage: 'de',
        employment: {
          grossMonthlyIncome: 2500,
          taxClass: 1,
          status: 'employed',
        },
      },
    });

    expect(response).toEqual({
      profile: {
        schemaVersion: '1.0.0',
        preferredLanguage: 'de',
        employment: {
          grossMonthlyIncome: 2500,
          taxClass: 1,
          status: 'employed',
        },
      },
      version: 2,
      schemaVersion: '1.0.0',
    });
    expect(response).not.toHaveProperty('profileId');
    expect(response).not.toHaveProperty('trace');
  });
});
