import { describe, expect, it } from 'vitest';
import { PRODUCT_NAME, SupportedLanguageSchema, ThemePreferenceSchema } from './index.js';

describe('@arrival-atlas/ui-contract', () => {
  it('exports stable UI primitives', () => {
    expect(PRODUCT_NAME).toBe('Arrival Atlas');
    expect(SupportedLanguageSchema.parse('en')).toBe('en');
    expect(ThemePreferenceSchema.parse('system')).toBe('system');
  });
});
