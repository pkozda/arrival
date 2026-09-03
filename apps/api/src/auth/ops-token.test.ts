import { afterEach, describe, expect, it } from 'vitest';
import {
  evaluateOpsTokenAccess,
  resolveArrivalOpsTokenFromEnv,
} from './ops-token.js';
import type { FastifyRequest } from 'fastify';

function fakeRequest(headers: Record<string, string | string[] | undefined>): FastifyRequest {
  return { headers } as FastifyRequest;
}

describe('ops-token (H3)', () => {
  const previous = process.env.ARRIVAL_ATLAS_OPS_TOKEN;

  afterEach(() => {
    if (previous === undefined) {
      delete process.env.ARRIVAL_ATLAS_OPS_TOKEN;
    } else {
      process.env.ARRIVAL_ATLAS_OPS_TOKEN = previous;
    }
  });

  it('fails closed when ARRIVAL_ATLAS_OPS_TOKEN is unset', () => {
    delete process.env.ARRIVAL_ATLAS_OPS_TOKEN;
    expect(resolveArrivalOpsTokenFromEnv()).toBeNull();
    expect(evaluateOpsTokenAccess(fakeRequest({ authorization: 'Bearer anything' }))).toEqual({
      ok: false,
      reason: 'ops_token_not_configured',
    });
  });

  it('accepts matching Bearer token', () => {
    process.env.ARRIVAL_ATLAS_OPS_TOKEN = 'secret-ops';
    expect(
      evaluateOpsTokenAccess(fakeRequest({ authorization: 'Bearer secret-ops' }))
    ).toEqual({ ok: true });
  });

  it('accepts matching x-arrival-ops-token header', () => {
    process.env.ARRIVAL_ATLAS_OPS_TOKEN = 'secret-ops';
    expect(
      evaluateOpsTokenAccess(fakeRequest({ 'x-arrival-ops-token': 'secret-ops' }))
    ).toEqual({ ok: true });
  });

  it('rejects wrong token', () => {
    process.env.ARRIVAL_ATLAS_OPS_TOKEN = 'secret-ops';
    expect(
      evaluateOpsTokenAccess(fakeRequest({ authorization: 'Bearer wrong' }))
    ).toEqual({ ok: false, reason: 'ops_token_invalid' });
  });
});
