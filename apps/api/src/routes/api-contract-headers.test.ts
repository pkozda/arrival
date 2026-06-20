import { describe, expect, it } from 'vitest';
import {
  applyUiSnapshotTransportHeaders,
  applyUserContextAuthorityHeaders,
  LEGACY_SNAPSHOT_CONTRACT_HEADERS,
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
