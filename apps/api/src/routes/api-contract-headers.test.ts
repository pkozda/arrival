import { describe, expect, it } from 'vitest';
import {
  applyUiSnapshotTransportHeaders,
  applyUserContextAuthorityHeaders,
  LEGACY_SNAPSHOT_CONTRACT_HEADERS,
  LIFE_EVENT_PLAN_AUTHORITY_HEADERS,
  ECONOMIC_REALITY_PLAN_AUTHORITY_HEADERS,
  PROFILE_INSIGHTS_AUTHORITY_HEADERS,
  UI_SNAPSHOT_TRANSPORT_HEADERS,
  USER_CONTEXT_AUTHORITY_HEADERS,
} from './api-contract-headers.js';

describe('api contract headers (P1 lock)', () => {
  it('defines authoritative user-context headers', () => {
    expect(USER_CONTEXT_AUTHORITY_HEADERS['x-user-context-authority']).toBe('authoritative');
    expect(USER_CONTEXT_AUTHORITY_HEADERS['x-read-model']).toBe('UserContextV1');
  });

  it('defines execution-only ui-snapshot transport headers', () => {
    expect(UI_SNAPSHOT_TRANSPORT_HEADERS['x-snapshot-layer']).toBe('execution-ui-transport');
    expect(UI_SNAPSHOT_TRANSPORT_HEADERS['x-user-context-authority']).toBe('derived-non-authoritative');
    expect(UI_SNAPSHOT_TRANSPORT_HEADERS['x-read-model']).toBe('UiSnapshot');
  });

  it('marks legacy snapshot contract as compatibility-only', () => {
    expect(LEGACY_SNAPSHOT_CONTRACT_HEADERS['x-snapshot-contract']).toBe('legacy-compatibility-only');
  });

  it('defines profile insights derived headers', () => {
    expect(PROFILE_INSIGHTS_AUTHORITY_HEADERS['x-profile-insights-authority']).toBe(
      'derived-non-authoritative'
    );
    expect(PROFILE_INSIGHTS_AUTHORITY_HEADERS['x-read-model']).toBe('ProfileInsightViewV1');
  });

  it('defines life event plan derived headers', () => {
    expect(LIFE_EVENT_PLAN_AUTHORITY_HEADERS['x-module-id']).toBe('life-event');
    expect(LIFE_EVENT_PLAN_AUTHORITY_HEADERS['x-module-version']).toBe('v2');
    expect(LIFE_EVENT_PLAN_AUTHORITY_HEADERS['x-read-model']).toBe('LifeEventPlanV1');
    expect(LIFE_EVENT_PLAN_AUTHORITY_HEADERS['x-plan-authority']).toBe('derived-deterministic');
  });

  it('defines economic reality plan derived headers', () => {
    expect(ECONOMIC_REALITY_PLAN_AUTHORITY_HEADERS['x-module-id']).toBe('economic-reality');
    expect(ECONOMIC_REALITY_PLAN_AUTHORITY_HEADERS['x-module-version']).toBe('v1');
    expect(ECONOMIC_REALITY_PLAN_AUTHORITY_HEADERS['x-read-model']).toBe(
      'EconomicRealityPlanResponseV1'
    );
    expect(ECONOMIC_REALITY_PLAN_AUTHORITY_HEADERS['x-pipeline-version']).toBe('ep1-ep6-v1');
  });

  it('apply helpers set reply headers', () => {
    const headers: Record<string, string> = {};
    const reply = {
      header(name: string, value: string) {
        headers[name] = value;
      },
    };

    applyUserContextAuthorityHeaders(reply);
    expect(headers).toEqual({ ...USER_CONTEXT_AUTHORITY_HEADERS });

    applyUiSnapshotTransportHeaders(reply);
    expect(headers['x-snapshot-layer']).toBe('execution-ui-transport');

    applyUiSnapshotTransportHeaders(reply, { legacy: true });
    expect(headers['x-snapshot-contract']).toBe('legacy-compatibility-only');
  });
});
