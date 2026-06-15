import { describe, it, expect } from 'vitest';
import type { AppContext } from '@arrivalos/core';
import {
  resolveSystemTranslationLanguage,
  systemTranslationModule,
} from './index.js';

const baseInput = {
  query: 'Anmeldung',
  mode: 'lookup' as const,
};

describe('resolveSystemTranslationLanguage', () => {
  it('Case A: prefers profileSlice.preferredLanguage over userProfile.language', () => {
    const context: AppContext = {
      profileSlice: { preferredLanguage: 'ua' },
      userProfile: { language: 'de' },
    };

    expect(resolveSystemTranslationLanguage(context)).toBe('ua');
  });

  it('Case B: falls back to userProfile.language when profileSlice is missing', () => {
    const context: AppContext = {
      userProfile: { language: 'de' },
    };

    expect(resolveSystemTranslationLanguage(context)).toBe('de');
  });

  it('Case C: defaults to en when both sources are missing', () => {
    expect(resolveSystemTranslationLanguage({})).toBe('en');
  });
});

describe('systemTranslationModule language resolution', () => {
  it('Case A: uses profileSlice language in lookup output', async () => {
    const output = await systemTranslationModule.execute(baseInput, {
      profileSlice: { preferredLanguage: 'ua' },
      userProfile: { language: 'de' },
    });

    expect(output.results[0]?.translation).toBe('Реєстрація');
  });

  it('Case B: falls back to userProfile.language in lookup output', async () => {
    const output = await systemTranslationModule.execute(baseInput, {
      userProfile: { language: 'de' },
    });

    expect(output.results[0]?.translation).toBe('Anmeldung');
  });

  it('Case C: defaults to en when both sources are missing', async () => {
    const output = await systemTranslationModule.execute(baseInput, {});

    expect(output.results[0]?.translation).toBe('Registration');
  });
});
