import { describe, expect, it } from 'vitest';
import { evaluateTokenAccountSemantics } from './token-account-semantics.js';

describe('evaluateTokenAccountSemantics', () => {
  it('detects drift when token accountId disagrees with state', () => {
    const result = evaluateTokenAccountSemantics({
      tokenAccountId: 'acct_token',
      stateAccountId: 'acct_state',
    });

    expect(result).toEqual({ ok: false, reason: 'drift' });
  });

  it('allows match when token accountId equals state', () => {
    const result = evaluateTokenAccountSemantics({
      tokenAccountId: 'acct_1',
      stateAccountId: 'acct_1',
    });

    expect(result).toEqual({ ok: true, ignoredTokenAccount: false });
  });

  it('allows anonymous token with claimed state and marks token account ignored', () => {
    const result = evaluateTokenAccountSemantics({
      tokenAccountId: null,
      stateAccountId: 'acct_1',
    });

    expect(result).toEqual({ ok: true, ignoredTokenAccount: true });
  });

  it('allows anonymous token with anonymous state', () => {
    const result = evaluateTokenAccountSemantics({
      tokenAccountId: null,
      stateAccountId: null,
    });

    expect(result).toEqual({ ok: true, ignoredTokenAccount: false });
  });
});
