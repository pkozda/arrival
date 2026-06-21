import { describe, expect, it } from 'vitest';
import { isMissingUserContextProfilePlanResponse } from './plan-fetch';

describe('isMissingUserContextProfilePlanResponse', () => {
  it('returns true for profile-required 400 responses', () => {
    expect(
      isMissingUserContextProfilePlanResponse(400, {
        error: 'UserContext profile required for life event planning',
      })
    ).toBe(true);
    expect(
      isMissingUserContextProfilePlanResponse(400, {
        error: 'UserContext profile required for economic reality planning',
        code: 'ECONOMIC_CONTEXT_INVALID',
      })
    ).toBe(true);
  });

  it('returns false for other failures', () => {
    expect(
      isMissingUserContextProfilePlanResponse(422, {
        error: 'UserContext profile required for economic reality planning',
        code: 'ACTION_SET_EMPTY',
      })
    ).toBe(false);
    expect(
      isMissingUserContextProfilePlanResponse(500, { error: 'Internal error' })
    ).toBe(false);
  });
});
