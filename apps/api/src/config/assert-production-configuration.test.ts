import { afterEach, describe, expect, it } from 'vitest';
import {
  DEV_AUTH_SECRET_FALLBACK,
  assertProductionConfiguration,
  collectProductionConfigIssues,
} from './assert-production-configuration.js';

describe('E16 production configuration fail-closed', () => {
  const previous = { ...process.env };

  afterEach(() => {
    process.env = { ...previous };
  });

  it('allows non-production without secrets', () => {
    expect(
      collectProductionConfigIssues({
        NODE_ENV: 'development',
      })
    ).toEqual([]);
  });

  it('requires AUTH_SECRET and OPS_TOKEN in production', () => {
    const issues = collectProductionConfigIssues({
      NODE_ENV: 'production',
    });
    expect(issues.map((i) => i.code)).toEqual([
      'AUTH_SECRET_MISSING',
      'OPS_TOKEN_MISSING',
    ]);
  });

  it('rejects known development auth fallback in production', () => {
    const issues = collectProductionConfigIssues({
      NODE_ENV: 'production',
      ARRIVAL_ATLAS_AUTH_SECRET: DEV_AUTH_SECRET_FALLBACK,
      ARRIVAL_ATLAS_OPS_TOKEN: 'ops-ok',
    });
    expect(issues.map((i) => i.code)).toEqual(['AUTH_SECRET_IS_DEV_FALLBACK']);
  });

  it('passes when production secrets are set', () => {
    expect(() =>
      assertProductionConfiguration({
        NODE_ENV: 'production',
        ARRIVAL_ATLAS_AUTH_SECRET: 'prod-secret-not-default',
        ARRIVAL_ATLAS_OPS_TOKEN: 'ops-token',
      })
    ).not.toThrow();
  });
});
