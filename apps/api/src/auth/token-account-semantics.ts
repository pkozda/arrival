export type TokenAccountSemanticsResult =
  | { ok: true; ignoredTokenAccount: boolean }
  | { ok: false; reason: 'drift' };

export function evaluateTokenAccountSemantics(params: {
  tokenAccountId?: string | null;
  stateAccountId: string | null;
}): TokenAccountSemanticsResult {
  const tokenAccountId = params.tokenAccountId ?? null;
  const stateAccountId = params.stateAccountId;

  if (tokenAccountId !== null && tokenAccountId !== stateAccountId) {
    return { ok: false, reason: 'drift' };
  }

  return {
    ok: true,
    ignoredTokenAccount: tokenAccountId === null && stateAccountId !== null,
  };
}
