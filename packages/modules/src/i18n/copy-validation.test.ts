import { describe, expect, it } from 'vitest';
import { buildEconomicRealityPlan } from '../api/economic-reality/pipeline.js';
import { ECONOMIC_FIXTURES } from '../economic-reality/fixtures.js';
import {
  validateActionSetCopyKeys,
  validateNoRawStringsInPresentation,
  validatePresentationCopyKeys,
  EconomicCopyValidationError,
} from './copy-validation.js';

const FIXED_META = {
  requestId: 'req_copy_validation',
  generatedAt: '2026-06-21T12:00:00.000Z',
};

describe('copy-validation EP-11', () => {
  it('validates presentation contains only keys for EF03', () => {
    const response = buildEconomicRealityPlan(ECONOMIC_FIXTURES[2]!.userContext, FIXED_META);
    validatePresentationCopyKeys(response.presentation);
    validateNoRawStringsInPresentation(response.presentation);
    validateActionSetCopyKeys(response.actionSet);
  });

  it('rejects raw title strings in presentation payloads', () => {
    expect(() =>
      validateNoRawStringsInPresentation({
        sections: [{ title: 'Primary path' }],
      })
    ).toThrow(EconomicCopyValidationError);
  });
});
