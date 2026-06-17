import { describe, expect, it } from 'vitest';
import { resolveAuthError } from './auth-error-mapper.js';

describe('auth-error-mapper', () => {
  it('maps credential failures to 401', () => {
    expect(resolveAuthError('invalid_token')).toEqual({
      status: 401,
      error: 'Invalid authentication token',
    });
    expect(resolveAuthError('authentication_required')).toEqual({
      status: 401,
      error: 'Authentication required',
    });
  });

  it('maps authorization failures to 403', () => {
    expect(resolveAuthError('session_revoked')).toEqual({
      status: 403,
      error: 'Session revoked',
    });
    expect(resolveAuthError('identity_drift')).toEqual({
      status: 403,
      error: 'Account identity drift detected',
    });
  });

  it('preserves legacy missing credential response', () => {
    expect(resolveAuthError('missing_credential')).toEqual({
      status: 400,
      error: 'X-Session-Id header is required',
    });
  });
});
