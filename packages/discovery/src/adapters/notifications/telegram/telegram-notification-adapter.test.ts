import { describe, expect, it } from 'vitest';
import {
  createMockHttpTransport,
  createProductionTelegramNotificationAdapter,
  createProductionTelegramNotificationAdapterFromConfig,
  loadDiscoveryProductionConfig,
  redactDiscoveryProductionConfig,
  renderDiscoveryTelegram,
  TELEGRAM_MAX_MESSAGE_LENGTH,
  TELEGRAM_RATE_LIMIT_KEY,
  validateDiscoveryProductionConfig,
  type NotificationPayload,
  type NotificationSendRequest,
} from '../../index.js';
import { createInMemoryRateLimiter } from '../../../adapter-infra/index.js';
import { createFakeClock } from '../../../scheduler/clock.js';
import { createDiscoveryNotificationService } from '../../../notifications/notification-service.js';
import { createInMemoryNotificationStore } from '../../../notifications/fakes/in-memory-notification-store.js';

const BOT_TOKEN = '123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw';

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
    notificationId:
      'notification:profile-job:digest:run-1:TELEGRAM:user-1:12345',
    profileId: 'profile-job',
    digestId: 'digest:run-1',
    channel: 'TELEGRAM',
    recipient: { userId: 'user-1', address: '12345' },
    payload: samplePayload(),
    runId: 'run-1',
    ...overrides,
  };
}

function okTelegramBody() {
  return JSON.stringify({
    ok: true,
    result: { message_id: 1, chat: { id: 12345 }, text: 'ok' },
  });
}

describe('E4.6 Telegram renderer', () => {
  it('deterministic output preserves digest ordering', () => {
    const a = renderDiscoveryTelegram(samplePayload());
    const b = renderDiscoveryTelegram(samplePayload());
    expect(a).toEqual(b);
    expect(a.text.indexOf('result-a')).toBeLessThan(a.text.indexOf('result-b'));
    expect(a.truncated).toBe(false);
  });

  it('includes title, summary, and result ids', () => {
    const rendered = renderDiscoveryTelegram(samplePayload());
    expect(rendered.text).toContain('2 new opportunities');
    expect(rendered.text).toContain('Discovery run completed');
    expect(rendered.text).toContain('[NEW]');
    expect(rendered.text).toContain('result-a');
  });

  it('strips control characters from dynamic content', () => {
    const rendered = renderDiscoveryTelegram(
      samplePayload({
        title: 'Hello\u0000World',
        summary: 'Line\u0007break',
      })
    );
    expect(rendered.text).not.toContain('\u0000');
    expect(rendered.text).not.toContain('\u0007');
    expect(rendered.text).toContain('HelloWorld');
  });

  it('truncates oversized messages deterministically', () => {
    const longItems = Array.from({ length: 80 }, (_, i) => ({
      resultId: `result-${i}-${'x'.repeat(40)}`,
      rank: i + 1,
      rankValue: 1 - i * 0.001,
      novelty: 'NEW' as const,
      priority: 'NORMAL' as const,
    }));
    const rendered = renderDiscoveryTelegram(
      samplePayload({
        items: longItems,
        resultIds: longItems.map((i) => i.resultId),
        title: 'Many opportunities',
      })
    );
    expect(rendered.truncated).toBe(true);
    expect(rendered.text.length).toBeLessThanOrEqual(TELEGRAM_MAX_MESSAGE_LENGTH);
    expect(rendered.text).toContain('…[truncated]');
    expect(rendered.text.indexOf('result-0')).toBeLessThan(
      rendered.text.indexOf('…[truncated]')
    );
  });

  it('empty items rejected by adapter without network', async () => {
    const transport = createMockHttpTransport(() => {
      throw new Error('should not call network');
    });
    const adapter = createProductionTelegramNotificationAdapter({
      botToken: BOT_TOKEN,
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

describe('E4.6 Telegram NotificationAdapter HTTP', () => {
  it('posts to Bot API sendMessage with chat_id and text', async () => {
    const transport = createMockHttpTransport(() => ({
      status: 200,
      bodyText: okTelegramBody(),
    }));
    const adapter = createProductionTelegramNotificationAdapter({
      botToken: BOT_TOKEN,
      transport,
    });
    const result = await adapter.send(sendRequest());
    expect(result).toEqual({ ok: true });
    expect(transport.requests).toHaveLength(1);
    expect(transport.requests[0]?.url).toBe(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`
    );
    expect(transport.requests[0]?.method).toBe('POST');
    const body = JSON.parse(transport.requests[0]!.body!);
    expect(body.chat_id).toBe('12345');
    expect(body.text).toContain('result-a');
    expect(body.disable_web_page_preview).toBe(true);
  });

  it('malformed 2xx without ok/result → INVALID_RESPONSE', async () => {
    const transport = createMockHttpTransport(() => ({
      status: 200,
      bodyText: JSON.stringify({ status: 'fine' }),
    }));
    const adapter = createProductionTelegramNotificationAdapter({
      botToken: BOT_TOKEN,
      transport,
    });
    expect(await adapter.send(sendRequest())).toMatchObject({
      ok: false,
      code: 'INVALID_RESPONSE',
    });
  });

  it('ok:false envelope on 2xx → INVALID_RESPONSE', async () => {
    const transport = createMockHttpTransport(() => ({
      status: 200,
      bodyText: JSON.stringify({
        ok: false,
        error_code: 400,
        description: 'Bad Request',
      }),
    }));
    const adapter = createProductionTelegramNotificationAdapter({
      botToken: BOT_TOKEN,
      transport,
    });
    expect(await adapter.send(sendRequest())).toMatchObject({
      ok: false,
      code: 'INVALID_RESPONSE',
    });
  });
});

describe('E4.6 Telegram errors', () => {
  it('maps 401 → AUTH_REQUIRED', async () => {
    const transport = createMockHttpTransport(() => ({
      status: 401,
      bodyText: '{}',
    }));
    const adapter = createProductionTelegramNotificationAdapter({
      botToken: BOT_TOKEN,
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
    const adapter = createProductionTelegramNotificationAdapter({
      botToken: BOT_TOKEN,
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
    const adapter = createProductionTelegramNotificationAdapter({
      botToken: BOT_TOKEN,
      transport,
    });
    expect(await adapter.send(sendRequest())).toMatchObject({
      ok: false,
      code: 'RATE_LIMITED',
    });
  });

  it('maps 5xx → UNAVAILABLE', async () => {
    const transport = createMockHttpTransport(() => ({
      status: 502,
      bodyText: '{}',
    }));
    const adapter = createProductionTelegramNotificationAdapter({
      botToken: BOT_TOKEN,
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
    const adapter = createProductionTelegramNotificationAdapter({
      botToken: BOT_TOKEN,
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
    const adapter = createProductionTelegramNotificationAdapter({
      botToken: BOT_TOKEN,
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
      bodyText: okTelegramBody(),
    }));
    const adapter = createProductionTelegramNotificationAdapter({
      botToken: BOT_TOKEN,
      transport,
    });
    expect(
      await adapter.send(sendRequest({ signal: controller.signal }))
    ).toMatchObject({ ok: false, code: 'CANCELLED' });
  });

  it('invalid chat id → INVALID_REQUEST without network', async () => {
    const transport = createMockHttpTransport(() => {
      throw new Error('should not call');
    });
    const adapter = createProductionTelegramNotificationAdapter({
      botToken: BOT_TOKEN,
      transport,
    });
    const result = await adapter.send(
      sendRequest({
        recipient: { userId: 'user-1', address: 'not a chat' },
      })
    );
    expect(result).toMatchObject({ ok: false, code: 'INVALID_REQUEST' });
    expect(transport.requests).toHaveLength(0);
  });
});

describe('E4.6 Telegram security + rate limit', () => {
  it('bot token absent from failure messages', async () => {
    const transport = createMockHttpTransport(() => {
      throw new Error(`boom ${BOT_TOKEN}`);
    });
    const adapter = createProductionTelegramNotificationAdapter({
      botToken: BOT_TOKEN,
      transport,
    });
    const result = await adapter.send(sendRequest());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).not.toContain(BOT_TOKEN);
    }
  });

  it('rate-limit rejection uses notification:telegram key', async () => {
    const transport = createMockHttpTransport(() => ({
      status: 200,
      bodyText: okTelegramBody(),
    }));
    const rateLimiter = createInMemoryRateLimiter({ maxAcquiresPerKey: 0 });
    const adapter = createProductionTelegramNotificationAdapter({
      botToken: BOT_TOKEN,
      transport,
      rateLimiter,
    });
    expect(await adapter.send(sendRequest())).toMatchObject({
      ok: false,
      code: 'RATE_LIMITED',
    });
    expect(transport.requests).toHaveLength(0);
    expect(rateLimiter.acquireCount(TELEGRAM_RATE_LIMIT_KEY)).toBe(0);
  });
});

describe('E4.6 Telegram composition', () => {
  it('configured telegram creates adapter; missing returns null', () => {
    const withTg = createProductionTelegramNotificationAdapterFromConfig({
      brave: { apiKey: 'b' },
      openai: { apiKey: 'o' },
      telegram: { botToken: BOT_TOKEN },
    });
    expect(withTg).not.toBeNull();

    const without = createProductionTelegramNotificationAdapterFromConfig({
      brave: { apiKey: 'b' },
      openai: { apiKey: 'o' },
    });
    expect(without).toBeNull();
  });

  it('validation and redaction for telegram config', () => {
    expect(
      validateDiscoveryProductionConfig({
        brave: { apiKey: 'b' },
        openai: { apiKey: 'o' },
        telegram: { botToken: '' },
      }).ok
    ).toBe(false);

    const redacted = redactDiscoveryProductionConfig({
      brave: { apiKey: 'brave-secret' },
      openai: { apiKey: 'openai-secret' },
      telegram: { botToken: BOT_TOKEN },
    });
    expect(redacted.telegram?.botToken).toBe('[redacted]');
    expect(JSON.stringify(redacted)).not.toContain(BOT_TOKEN);

    const loaded = loadDiscoveryProductionConfig({
      BRAVE_SEARCH_API_KEY: 'b',
      OPENAI_API_KEY: 'o',
      TELEGRAM_BOT_TOKEN: BOT_TOKEN,
    });
    expect(loaded.telegram?.botToken).toBe(BOT_TOKEN);
  });
});

describe('E4.6 Telegram notification service integration', () => {
  it('success SENT, failure FAILED, idempotency skips second send', async () => {
    let calls = 0;
    const transport = createMockHttpTransport(() => {
      calls += 1;
      if (calls === 1) {
        return { status: 200, bodyText: okTelegramBody() };
      }
      return { status: 503, bodyText: '{}' };
    });
    const adapter = createProductionTelegramNotificationAdapter({
      botToken: BOT_TOKEN,
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
      period: {
        from: '2026-08-31T10:00:00.000Z',
        to: '2026-08-31T10:05:00.000Z',
      },
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

    const recipient = { userId: 'user-1', address: '12345' };
    const first = await service.deliverDigest({
      digest,
      recipient,
      channel: 'TELEGRAM',
    });
    expect(first.kind).toBe('delivered');
    expect(transport.requests).toHaveLength(1);

    const duplicate = await service.deliverDigest({
      digest,
      recipient,
      channel: 'TELEGRAM',
    });
    expect(duplicate).toEqual({ kind: 'skipped', reason: 'already_delivered' });
    expect(transport.requests).toHaveLength(1);

    const digest2 = { ...digest, id: 'digest:run-2', runId: 'run-2' };
    const failed = await service.deliverDigest({
      digest: digest2,
      recipient,
      channel: 'TELEGRAM',
    });
    expect(failed.kind).toBe('failed');
    if (failed.kind === 'failed') {
      expect(failed.failure.code).toBe('UNAVAILABLE');
      const record = await store.findById(failed.notificationId);
      expect(record?.status).toBe('FAILED');
    }
  });
});
