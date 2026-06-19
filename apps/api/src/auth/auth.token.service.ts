import { createHmac, timingSafeEqual } from 'node:crypto';
import type { AuthSubject, AuthTokenPayload } from './auth.types.js';

const TOKEN_VERSION = 1;
const DEFAULT_TTL_SECONDS = 30 * 24 * 60 * 60;

export class InvalidAuthTokenError extends Error {
  constructor(message = 'Invalid authentication token') {
    super(message);
    this.name = 'InvalidAuthTokenError';
  }
}

export function resolveAuthSubject(accountId: string | null): AuthSubject {
  return accountId ? `account:${accountId}` : null;
}

export class AuthTokenService {
  private getSecret(): string {
    return (
      process.env.ARRIVAL_ATLAS_AUTH_SECRET ??
      'arrival-atlas-dev-auth-secret-change-in-production'
    );
  }

  createToken(params: {
    accountId: string | null;
    sessionId: string;
    authSubject?: AuthSubject;
  }): string {
    const authSubject = params.authSubject ?? resolveAuthSubject(params.accountId);
    const now = Math.floor(Date.now() / 1000);
    const payload: AuthTokenPayload = {
      v: TOKEN_VERSION,
      accountId: params.accountId,
      sessionId: params.sessionId,
      authSubject,
      iat: now,
      exp: now + DEFAULT_TTL_SECONDS,
    };
    const payloadSegment = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = this.sign(payloadSegment);
    return `${payloadSegment}.${signature}`;
  }

  verifyToken(token: string): AuthTokenPayload {
    const parts = token.split('.');
    if (parts.length !== 2) {
      throw new InvalidAuthTokenError();
    }

    const [payloadSegment, signature] = parts;
    const expectedSignature = this.sign(payloadSegment);

    try {
      const provided = Buffer.from(signature, 'base64url');
      const expected = Buffer.from(expectedSignature, 'base64url');
      if (
        provided.length !== expected.length ||
        !timingSafeEqual(provided, expected)
      ) {
        throw new InvalidAuthTokenError();
      }
    } catch (error) {
      if (error instanceof InvalidAuthTokenError) {
        throw error;
      }
      throw new InvalidAuthTokenError();
    }

    let payload: AuthTokenPayload;
    try {
      payload = JSON.parse(
        Buffer.from(payloadSegment, 'base64url').toString('utf8')
      ) as AuthTokenPayload;
    } catch {
      throw new InvalidAuthTokenError();
    }

    if (payload.v !== TOKEN_VERSION) {
      throw new InvalidAuthTokenError();
    }

    if (!payload.sessionId || typeof payload.sessionId !== 'string') {
      throw new InvalidAuthTokenError();
    }

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      throw new InvalidAuthTokenError('Authentication token expired');
    }

    return payload;
  }

  refreshToken(token: string): string | null {
    try {
      const payload = this.verifyToken(token);
      return this.createToken({
        accountId: payload.accountId,
        sessionId: payload.sessionId,
        authSubject: payload.authSubject,
      });
    } catch {
      return null;
    }
  }

  private sign(payloadSegment: string): string {
    return createHmac('sha256', this.getSecret())
      .update(payloadSegment)
      .digest('base64url');
  }
}

export const authTokenService = new AuthTokenService();
