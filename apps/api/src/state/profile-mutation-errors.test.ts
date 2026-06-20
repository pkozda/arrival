import { describe, expect, it } from 'vitest';
import { mapProfileMutationErrorToHttp } from './profile-mutation-errors.js';

describe('mapProfileMutationErrorToHttp', () => {
  it('maps scenario validation issues to FIELD_BLOCKED (422)', () => {
    const mapped = mapProfileMutationErrorToHttp('VALIDATION_FAILED', 'Payload validation failed', [
      {
        code: 'SCENARIO_FIELD_IN_PAYLOAD',
        message: 'Scenario field "proposedGrossIncome" cannot be stored in profile mutations',
        fieldId: 'proposedGrossIncome',
      },
    ]);

    expect(mapped.statusCode).toBe(422);
    expect(mapped.body.code).toBe('FIELD_BLOCKED');
  });
});
