export type AuthSubject = string | null;

export type AuthMode = 'token' | 'session';

export type AuthTokenPayload = {
  v: number;
  accountId: string | null;
  sessionId: string;
  authSubject: AuthSubject;
  iat: number;
  exp: number;
};

export type AuthContext = {
  accountId: string | null;
  sessionId: string;
  authSubject: AuthSubject;
  authMode: AuthMode;
  tokenPayload?: AuthTokenPayload;
};

export type BuildAuthContextResult =
  | { status: 'ok'; auth: AuthContext }
  | { status: 'invalid_token' }
  | { status: 'missing_credential' }
  | { status: 'session_not_found' }
  | { status: 'account_mismatch' };
