import { describe, expect, it } from 'vitest';
import {
  createMockHttpTransport,
  createProductionEmailNotificationAdapter,
  escapeHtml,
  loadDiscoveryProductionConfig,
  redactDiscoveryProductionConfig,
  renderDiscoveryEmail,
  RESEND_EMAIL_RATE_LIMIT_KEY,
  safeHttpUrl,
  validateDiscoveryProductionConfig,
  type NotificationPayload,
  type NotificationSendRequest,
} from '../../index.js';
import { createInMemoryRateLimiter } from '../../../adapter-infra/index.js';
import { createFakeClock } from '../../../scheduler/clock.js';
import { createDiscoveryNotificationService } from '../../../notifications/notification-service.js';
import { createInMemoryNotificationStore } from '../../../notifications/fakes/in-memory-notification-store.js';

const API_KEY = 're_test_secret_key_do_not_leak';

function samplePayload(
  overrides: Partial<NotificationPayload> = {}
): NotificationPayload {
  return {
    title: '2 new opportunities',
    summary: 'Discovery run completed with 2 notable result(s): 2 new, 0 updated.',
    resultIds: ['result-a', 'result-b'],
    items: [
      {
        resultId: 'result-a',
        rank: 1,
        rankValue: 0.9,
        novelty: 'NEW',
        priority: 'HIGH',
      },
      {
        resultId: 'result-b',
        rank: 2,
        rankValue: 0.7,
        novelty: 'NEW',
        priority: 'NORMAL',
      },
    ],
    runId: 'run-1',
    strategyId: 'job-discovery',
    strategyVersion: '1',
    period: { from: '2026-08-31T10:00:00.000Z', to: '2026-08-31T10:05:00.000Z' },
    ...overrides,
  };
}

function sendRequest(
  overrides: Partial<NotificationSendRequest> = {}
): NotificationSendRequest {
  return {
    notificationId: 'notification:profile-job:digest:run-1:EMAIL:user-1:user@example.com',
    profileId: 'profile-job',
    digestId: 'digest:run-1',
    channel: 'EMAIL',
    recipient: { userId: 'user-1', address: 'user@example.com' },
    payload: samplePayload(),
    runId: 'run-1',
    ...overrides,
  };
}

describe('E4.5 email renderer', () => {
  it('subject for one NEW result', () => {
    const rendered = renderDiscoveryEmail(
      samplePayload({
        items: [
          {
            resultId: 'result-a',
            rank: 1,
            rankValue: 0.9,
            novelty: 'NEW',
            priority: 'HIGH',
          },
        ],
        resultIds: ['result-a'],
      })
    );
    expect(rendered.subject).toBe('1 new opportunity in Arrival Atlas');
  });

  it('subject for multiple NEW results', () => {
    expect(renderDiscoveryEmail(samplePayload()).subject).toBe(
      '2 new opportunities in Arrival Atlas'
    );
  });

  it('subject for NEW + UPDATED', () => {
    const rendered = renderDiscoveryEmail(
      samplePayload({
        items: [
          {
            resultId: 'result-a',
            rank: 1,
            rankValue: 0.9,
            novelty: 'NEW',
            priority: 'HIGH',
          },
          {
            resultId: 'result-b',
            rank: 2,
            rankValue: 0.7,
            novelty: 'UPDATED',
            priority: 'NORMAL',
          },
        ],
      })
    );
    expect(rendered.subject).toBe(
      '1 new + 1 updated opportunities in Arrival Atlas'
    );
  });

  it('preserves digest ordering in text and html', () => {
    const rendered = renderDiscoveryEmail(samplePayload());
    const aIdx = rendered.text.indexOf('result-a');
    const bIdx = rendered.text.indexOf('result-b');
    expect(aIdx).toBeLessThan(bIdx);
    expect(rendered.html.indexOf('result-a')).toBeLessThan(
      rendered.html.indexOf('result-b')
    );
  });

  it('plain-text includes title, summary, and result ids', () => {
    const rendered = renderDiscoveryEmail(samplePayload());
    expect(rendered.text).toContain('2 new opportunities');
    expect(rendered.text).toContain('Discovery run completed');
    expect(rendered.text).toContain('result-a');
    expect(rendered.text).toContain('[NEW]');
  });

  it('html includes escaped title and summary', () => {
    const rendered = renderDiscoveryEmail(samplePayload());
    expect(rendered.html).toContain('<h1>2 new opportunities</h1>');
    expect(rendered.html).toContain('<code>result-a</code>');
  });

  it('rejects empty items via adapter INVALID_REQUEST', async () => {
    const transport = createMockHttpTransport(() => {
      throw new Error('should not call network');
    });
    const adapter = createProductionEmailNotificationAdapter({
      apiKey: API_KEY,
      from: 'Arrival Atlas <noreply@example.com>',
      transport,
    });
    const result = await adapter.send(
      sendRequest({
        payload: samplePayload({ items: [], resultIds: [] }),
      })
    );
    expect(result).toMatchObject({ ok: false, code: 'INVALID_REQUEST' });
    expect(transport.requests).toHaveLength(0);
  });
});

describe('E4.5 HTML security', () => {
  it('escapes malicious title and summary', () => {
    const rendered = renderDiscoveryEmail(
      samplePayload({
        title: '<script>alert(1)</script>',
        summary: 'Hello <img src=x onerror=alert(1)>',
      })
    );
    expect(rendered.html).not.toContain('<script>');
    expect(rendered.html).toContain('&lt;script&gt;');
    expect(rendered.html).not.toContain('<img src=x');
    expect(rendered.html).toContain('&lt;img');
  });

  it('escapes malicious resultId', () => {
    const rendered = renderDiscoveryEmail(
      samplePayload({
        items: [
          {
            resultId: '"><script>alert(1)</script>',
            rank: 1,
            rankValue: 0.9,
            novelty: 'NEW',
            priority: 'HIGH',
          },
        ],
      })
    );
    expect(rendered.html).not.toContain('"><script>');
    expect(rendered.html).toContain('&quot;&gt;&lt;script&gt;');
  });

  it('escapeHtml covers attribute injection characters', () => {
    expect(escapeHtml(`a"b'c`)).toBe('a&quot;b&#39;c');
  });

  it('safeHttpUrl rejects javascript: and relative urls', () => {
    expect(safeHttpUrl('javascript:alert(1)')).toBeNull();
    expect(safeHttpUrl('/relative')).toBeNull();
    expect(safeHttpUrl('https://employer.example/jobs/1')).toBe(
      'https://employer.example/jobs/1'
    );
  });
});

describe('E4.5 Resend email NotificationAdapter', () => {
  it('successful provider response → ok', async () => {
    const transport = createMockHttpTransport(() => ({
      status: 200,
      bodyText: JSON.stringify({ id: 'email_123' }),
    }));
    const adapter = createProductionEmailNotificationAdapter({
      apiKey: API_KEY,
      from: 'Arrival Atlas <noreply@example.com>',
      transport,
    });
    const result = await adapter.send(sendRequest());
    expect(result).toEqual({ ok: true });
    expect(transport.requests).toHaveLength(1);
    expect(transport.requests[0]?.url).toBe('https://api.resend.com/emails');
    expect(transport.requests[0]?.method).toBe('POST');
    expect(transport.requests[0]?.headers?.Authorization).toBe(
      `Bearer ${API_KEY}`
    );
    const body = JSON.parse(transport.requests[0]!.body!);
    expect(body.to).toEqual(['user@example.com']);
    expect(body.from).toBe('Arrival Atlas <noreply@example.com>');
    expect(body.subject).toBe('2 new opportunities in Arrival Atlas');
    expect(body.html).toContain('result-a');
    expect(body.text).toContain('result-a');
  });

  it('malformed 2xx response → INVALID_RESPONSE', async () => {
    const transport = createMockHttpTransport(() => ({
      status: 200,
      bodyText: JSON.stringify({ ok: true }),
    }));
    const adapter = createProductionEmailNotificationAdapter({
      apiKey: API_KEY,
      from: 'Arrival Atlas <noreply@example.com>',
      transport,
    });
    const result = await adapter.send(sendRequest());
    expect(result).toMatchObject({ ok: false, code: 'INVALID_RESPONSE' });
  });

  it('maps 400/422 → INVALID_REQUEST', async () => {
    for (const status of [400, 422]) {
      const transport = createMockHttpTransport(() => ({
        status,
        bodyText: '{}',
      }));
      const adapter = createProductionEmailNotificationAdapter({
        apiKey: API_KEY,
        from: 'Arrival Atlas <noreply@example.com>',
        transport,
      });
      const result = await adapter.send(sendRequest());
      expect(result).toMatchObject({ ok: false, code: 'INVALID_REQUEST' });
    }
  });

  it('maps 401 → AUTH_REQUIRED', async () => {
    const transport = createMockHttpTransport(() => ({
      status: 401,
      bodyText: '{}',
    }));
    const adapter = createProductionEmailNotificationAdapter({
      apiKey: API_KEY,
      from: 'Arrival Atlas <noreply@example.com>',
      transport,
    });
    expect(await adapter.send(sendRequest())).toMatchObject({
      ok: false,
      code: 'AUTH_REQUIRED',
    });
  });

  it('maps 403 → POLICY_BLOCKED', async () => {
    const transport = createMockHttpTransport(() => ({
      status: 403,
      bodyText: '{}',
    }));
    const adapter = createProductionEmailNotificationAdapter({
      apiKey: API_KEY,
      from: 'Arrival Atlas <noreply@example.com>',
      transport,
    });
    expect(await adapter.send(sendRequest())).toMatchObject({
      ok: false,
      code: 'POLICY_BLOCKED',
    });
  });

  it('maps 429 → RATE_LIMITED', async () => {
    const transport = createMockHttpTransport(() => ({
      status: 429,
      bodyText: '{}',
    }));
    const adapter = createProductionEmailNotificationAdapter({
      apiKey: API_KEY,
      from: 'Arrival Atlas <noreply@example.com>',
      transport,
    });
    expect(await adapter.send(sendRequest())).toMatchObject({
      ok: false,
      code: 'RATE_LIMITED',
    });
  });

  it('maps 5xx → UNAVAILABLE', async () => {
    const transport = createMockHttpTransport(() => ({
      status: 503,
      bodyText: '{}',
    }));
    const adapter = createProductionEmailNotificationAdapter({
      apiKey: API_KEY,
      from: 'Arrival Atlas <noreply@example.com>',
      transport,
    });
    expect(await adapter.send(sendRequest())).toMatchObject({
      ok: false,
      code: 'UNAVAILABLE',
    });
  });

  it('network failure → NETWORK_ERROR', async () => {
    const transport = createMockHttpTransport(() => {
      throw new Error('ECONNRESET');
    });
    const adapter = createProductionEmailNotificationAdapter({
      apiKey: API_KEY,
      from: 'Arrival Atlas <noreply@example.com>',
      transport,
    });
    expect(await adapter.send(sendRequest())).toMatchObject({
      ok: false,
      code: 'NETWORK_ERROR',
    });
  });

  it('timeout → TIMEOUT', async () => {
    const transport = createMockHttpTransport(
      () =>
        new Promise(() => {
          /* never resolves */
        })
    );
    const adapter = createProductionEmailNotificationAdapter({
      apiKey: API_KEY,
      from: 'Arrival Atlas <noreply@example.com>',
      transport,
      timeoutMs: 20,
    });
    expect(await adapter.send(sendRequest({ timeoutMs: 20 }))).toMatchObject({
      ok: false,
      code: 'TIMEOUT',
    });
  });

  it('cancellation → CANCELLED', async () => {
    const controller = new AbortController();
    controller.abort();
    const transport = createMockHttpTransport(() => ({
      status: 200,
      bodyText: JSON.stringify({ id: 'x' }),
    }));
    const adapter = createProductionEmailNotificationAdapter({
      apiKey: API_KEY,
      from: 'Arrival Atlas <noreply@example.com>',
      transport,
    });
    expect(
      await adapter.send(sendRequest({ signal: controller.signal }))
    ).toMatchObject({ ok: false, code: 'CANCELLED' });
  });

  it('rate-limit rejection → RATE_LIMITED', async () => {
    const transport = createMockHttpTransport(() => ({
      status: 200,
      bodyText: JSON.stringify({ id: 'email_1' }),
    }));
    const rateLimiter = createInMemoryRateLimiter({ maxAcquiresPerKey: 0 });
    const adapter = createProductionEmailNotificationAdapter({
      apiKey: API_KEY,
      from: 'Arrival Atlas <noreply@example.com>',
      transport,
      rateLimiter,
    });
    expect(await adapter.send(sendRequest())).toMatchObject({
      ok: false,
      code: 'RATE_LIMITED',
    });
    expect(transport.requests).toHaveLength(0);
    expect(rateLimiter.acquireCount(RESEND_EMAIL_RATE_LIMIT_KEY)).toBe(0);
  });

  it('invalid recipient → INVALID_REQUEST without network', async () => {
    const transport = createMockHttpTransport(() => {
      throw new Error('should not call');
    });
    const adapter = createProductionEmailNotificationAdapter({
      apiKey: API_KEY,
      from: 'Arrival Atlas <noreply@example.com>',
      transport,
    });
    const result = await adapter.send(
      sendRequest({
        recipient: { userId: 'user-1', address: 'not-an-email' },
      })
    );
    expect(result).toMatchObject({ ok: false, code: 'INVALID_REQUEST' });
    expect(transport.requests).toHaveLength(0);
  });
});

describe('E4.5 secrets', () => {
  it('API key absent from failure messages', async () => {
    const transport = createMockHttpTransport(() => {
      throw new Error(`boom ${API_KEY}`);
    });
    const adapter = createProductionEmailNotificationAdapter({
      apiKey: API_KEY,
      from: 'Arrival Atlas <noreply@example.com>',
      transport,
    });
    const result = await adapter.send(sendRequest());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).not.toContain(API_KEY);
    }
  });

  it('API key redacted in production config view', () => {
    const redacted = redactDiscoveryProductionConfig({
      brave: { apiKey: 'brave-secret' },
      openai: { apiKey: 'openai-secret' },
      email: {
        apiKey: API_KEY,
        from: 'Arrival Atlas <noreply@example.com>',
      },
    });
    expect(redacted.email?.apiKey).toBe('[redacted]');
    expect(JSON.stringify(redacted)).not.toContain(API_KEY);
  });

  it('missing email credentials fail validation / load', () => {
    expect(
      validateDiscoveryProductionConfig({
        brave: { apiKey: 'b' },
        openai: { apiKey: 'o' },
        email: { apiKey: '', from: 'x@example.com' },
      }).ok
    ).toBe(false);

    expect(() =>
      loadDiscoveryProductionConfig({
        BRAVE_SEARCH_API_KEY: 'b',
        OPENAI_API_KEY: 'o',
        DISCOVERY_EMAIL_FROM: 'Arrival Atlas <noreply@example.com>',
      })
    ).toThrow(/RESEND_API_KEY/);
  });
});

describe('E4.5 notification service integration', () => {
  it('production email adapter + service: success, failure, idempotency', async () => {
    let calls = 0;
    const transport = createMockHttpTransport(() => {
      calls += 1;
      if (calls === 1) {
        return { status: 200, bodyText: JSON.stringify({ id: 'email_ok' }) };
      }
      return { status: 503, bodyText: '{}' };
    });
    const adapter = createProductionEmailNotificationAdapter({
      apiKey: API_KEY,
      from: 'Arrival Atlas <noreply@example.com>',
      transport,
    });
    const clock = createFakeClock('2026-08-31T10:10:00.000Z');
    const store = createInMemoryNotificationStore();
    const service = createDiscoveryNotificationService({
      store,
      adapter,
      clock,
    });

    const digest = {
      id: 'digest:run-1',
      runId: 'run-1',
      profileId: 'profile-job',
      strategyId: 'job-discovery',
      strategyVersion: '1',
      generatedAt: '2026-08-31T10:05:00.000Z',
      period: { from: '2026-08-31T10:00:00.000Z', to: '2026-08-31T10:05:00.000Z' },
      resultIds: ['result-a'],
      entries: [
        {
          resultId: 'result-a',
          rank: 1,
          rankValue: 0.9,
          novelty: 'NEW' as const,
          userState: 'NEW' as const,
          lifecycle: 'ACTIVE' as const,
          shouldNotify: true,
        },
      ],
      newResultIds: ['result-a'],
      updatedResultIds: [] as string[],
      summary: {
        totalResults: 1,
        newResults: 1,
        updatedResults: 0,
        unchangedResults: 0,
        notifiedResults: 1,
      },
    };

    const recipient = { userId: 'user-1', address: 'user@example.com' };
    const first = await service.deliverDigest({
      digest,
      recipient,
      channel: 'EMAIL',
    });
    expect(first.kind).toBe('delivered');
    expect(transport.requests).toHaveLength(1);

    const duplicate = await service.deliverDigest({
      digest,
      recipient,
      channel: 'EMAIL',
    });
    expect(duplicate).toEqual({ kind: 'skipped', reason: 'already_delivered' });
    expect(transport.requests).toHaveLength(1);

    // Separate digest → provider failure recorded; discovery concern is separate
    const digest2 = { ...digest, id: 'digest:run-2', runId: 'run-2' };
    const failed = await service.deliverDigest({
      digest: digest2,
      recipient,
      channel: 'EMAIL',
    });
    expect(failed.kind).toBe('failed');
    if (failed.kind === 'failed') {
      expect(failed.failure.code).toBe('UNAVAILABLE');
      const record = await store.findById(failed.notificationId);
      expect(record?.status).toBe('FAILED');
    }
  });
});
