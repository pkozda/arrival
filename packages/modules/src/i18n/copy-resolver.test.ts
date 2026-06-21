import { describe, expect, it } from 'vitest';
import { ER_COPY_KEYS } from '@arrival-atlas/product-contract';
import { resolveCopy, EconomicCopyResolutionError } from './copy-resolver.js';

describe('resolveCopy EP-11', () => {
  it('resolves DE locale strings deterministically', () => {
    expect(resolveCopy(ER_COPY_KEYS.SECTION_PRIMARY, 'de')).toBe('Hauptbereich');
    expect(resolveCopy(ER_COPY_KEYS.INTENT_START_JOBCENTER, 'de')).toBe(
      'Jobcenter-Prozess starten'
    );
  });

  it('falls back to EN for unsupported locales', () => {
    expect(resolveCopy(ER_COPY_KEYS.MODULE_TITLE, 'ru')).toBe('Economic Reality');
  });

  it('throws deterministic error for missing keys in non-production', () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    expect(() => resolveCopy('ER.MISSING.KEY', 'en')).toThrow(EconomicCopyResolutionError);
    process.env.NODE_ENV = previous;
  });
});
