import { describe, expect, it } from 'vitest';
import { validateResultStateTransition } from './result-state-transition.js';

describe('E7.2 result state transition rules', () => {
  it('allows idempotent same-state transitions', () => {
    expect(
      validateResultStateTransition({
        from: 'NOTIFIED',
        to: 'NOTIFIED',
        actor: 'notification',
      })
    ).toEqual({ ok: true });
  });

  it('allows notification actor to set NOTIFIED from NEW or SEEN', () => {
    expect(
      validateResultStateTransition({ from: 'NEW', to: 'NOTIFIED', actor: 'notification' })
    ).toEqual({ ok: true });
    expect(
      validateResultStateTransition({ from: 'SEEN', to: 'NOTIFIED', actor: 'notification' })
    ).toEqual({ ok: true });
  });

  it('rejects notification actor setting non-NOTIFIED states', () => {
    const result = validateResultStateTransition({
      from: 'NEW',
      to: 'SAVED',
      actor: 'notification',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('NOTIFICATION_CANNOT_SET_SAVED');
    }
  });

  it('rejects notification NOTIFIED from SAVED/DISMISSED', () => {
    expect(
      validateResultStateTransition({
        from: 'SAVED',
        to: 'NOTIFIED',
        actor: 'notification',
      }).ok
    ).toBe(false);
    expect(
      validateResultStateTransition({
        from: 'DISMISSED',
        to: 'NOTIFIED',
        actor: 'notification',
      }).ok
    ).toBe(false);
  });

  it('allows engine to expire a result', () => {
    expect(
      validateResultStateTransition({
        from: 'NEW',
        to: 'EXPIRED',
        actor: 'engine',
      })
    ).toEqual({ ok: true });
  });

  it('rejects mutating EXPIRED user state', () => {
    const result = validateResultStateTransition({
      from: 'EXPIRED',
      to: 'NOTIFIED',
      actor: 'notification',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('EXPIRED_STATE_IMMUTABLE');
    }
  });

  it('rejects DISMISSED → NEW', () => {
    const result = validateResultStateTransition({
      from: 'DISMISSED',
      to: 'NEW',
      actor: 'user',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('DISMISSED_CANNOT_REVERT_TO_NEW');
    }
  });

  it('allows user/ui attention transitions', () => {
    expect(
      validateResultStateTransition({ from: 'NEW', to: 'SEEN', actor: 'user' })
    ).toEqual({ ok: true });
    expect(
      validateResultStateTransition({ from: 'NOTIFIED', to: 'OPENED', actor: 'ui' })
    ).toEqual({ ok: true });
    expect(
      validateResultStateTransition({ from: 'OPENED', to: 'SAVED', actor: 'user' })
    ).toEqual({ ok: true });
    expect(
      validateResultStateTransition({ from: 'SAVED', to: 'DISMISSED', actor: 'user' })
    ).toEqual({ ok: true });
  });
});
