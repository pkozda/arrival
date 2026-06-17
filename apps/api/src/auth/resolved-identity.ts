export type IdentitySource = 'token' | 'legacy';

export type ResolvedIdentity = {
  sessionId: string;
  accountId: string | null;
  authSubject: string | null;
  source: IdentitySource;
  verified: boolean;
  tokenAccountId?: string | null;
  stateAccountId?: string | null;
};
