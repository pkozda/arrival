import type { DiscoveryProductionConfig } from '../../production/production-composition.js';
import type { NotificationAdapter } from '../../../notifications/notification-adapter.js';
import {
  AdapterFailureError,
  createInMemoryRateLimiter,
  executeWithTimeout,
  type RateLimiter,
} from '../../../adapter-infra/index.js';
import type {
  NotificationDeliveryResult,
  NotificationFailureCode,
  NotificationSendRequest,
} from '../../../notifications/types.js';
import {
  createFetchHttpTransport,
  type HttpTransport,
} from '../../http-transport.js';
import { renderDiscoveryTelegram } from './render-discovery-telegram.js';

export const TELEGRAM_PROVIDER_ID = 'telegram' as const;
export const TELEGRAM_RATE_LIMIT_KEY = 'notification:telegram' as const;

const DEFAULT_API_ROOT = 'https://api.telegram.org';
const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * Production Telegram notification config — composition root supplies secrets.
 * Adapter never reads process.env.
 */
export type ProductionTelegramNotificationConfig = {
  botToken: string;
  /**
   * API root (default https://api.telegram.org).
   * Final URL: `${baseUrl}/bot${token}/sendMessage`
   */
  baseUrl?: string;
  transport?: HttpTransport;
  rateLimiter?: RateLimiter;
  timeoutMs?: number;
};

/** Alias matching E4.5/E4.6 naming. */
export type TelegramNotificationConfig = ProductionTelegramNotificationConfig;

/**
 * Production NotificationAdapter for Telegram Bot API sendMessage.
 * Provider-specific request/response types stay in this module.
 */
export function createProductionTelegramNotificationAdapter(
  config: ProductionTelegramNotificationConfig
): NotificationAdapter {
  return createTelegramNotificationAdapter(config);
}

/**
 * Build the production Telegram NotificationAdapter from DiscoveryProductionConfig.
 * Returns null when telegram is not configured.
 */
export function createProductionTelegramNotificationAdapterFromConfig(
  config: DiscoveryProductionConfig,
  overrides: {
    transport?: HttpTransport;
    rateLimiter?: RateLimiter;
  } = {}
): NotificationAdapter | null {
  if (!config.telegram) return null;
  return createProductionTelegramNotificationAdapter({
    botToken: config.telegram.botToken,
    baseUrl: config.telegram.baseUrl,
    timeoutMs: config.telegram.timeoutMs,
    transport: overrides.transport ?? config.transport,
    rateLimiter: overrides.rateLimiter ?? config.rateLimiter,
  });
}

export function createTelegramNotificationAdapter(
  config: ProductionTelegramNotificationConfig
): NotificationAdapter {
  const transport = config.transport ?? createFetchHttpTransport();
  const rateLimiter = config.rateLimiter ?? createInMemoryRateLimiter();
  const apiRoot = (config.baseUrl ?? DEFAULT_API_ROOT).replace(/\/$/, '');
  const defaultTimeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return {
    async send(request: NotificationSendRequest): Promise<NotificationDeliveryResult> {
      if (request.channel !== 'TELEGRAM') {
        return {
          ok: false,
          code: 'INVALID_REQUEST',
          message: 'Telegram adapter only supports TELEGRAM channel',
        };
      }

      const botToken = config.botToken?.trim();
      if (!botToken) {
        return {
          ok: false,
          code: 'INVALID_REQUEST',
          message: 'Telegram adapter missing bot token',
        };
      }

      const chatId = request.recipient.address?.trim();
      if (!chatId || !isValidTelegramChatId(chatId)) {
        return {
          ok: false,
          code: 'INVALID_REQUEST',
          message: 'Recipient address is not a valid Telegram chat id',
        };
      }

      if (!request.payload.items.length) {
        return {
          ok: false,
          code: 'INVALID_REQUEST',
          message: 'Notification payload has no items',
        };
      }

      const timeoutMs = request.timeoutMs ?? defaultTimeoutMs;
      const rendered = renderDiscoveryTelegram(request.payload);
      const sendUrl = `${apiRoot}/bot${botToken}/sendMessage`;

      try {
        await rateLimiter.acquire(TELEGRAM_RATE_LIMIT_KEY, {
          runId: request.runId,
          signal: request.signal,
          timeoutMs,
        });

        await executeWithTimeout(
          async (signal) => {
            const providerBody = {
              chat_id: chatId,
              text: rendered.text,
              disable_web_page_preview: true,
            };

            let response;
            try {
              response = await transport.request({
                url: sendUrl,
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Accept: 'application/json',
                },
                body: JSON.stringify(providerBody),
                signal,
                maxBytes: 256_000,
              });
            } catch (err) {
              if (AdapterFailureError.isAdapterFailure(err)) throw err;
              if (signal.aborted) {
                throw new AdapterFailureError({
                  code: 'CANCELLED',
                  message: 'Telegram delivery cancelled',
                  adapter: 'notification',
                  operation: 'send_message',
                  retryable: false,
                });
              }
              throw new AdapterFailureError({
                code: 'NETWORK_ERROR',
                message: 'Telegram transport network failure',
                adapter: 'notification',
                operation: 'send_message',
                retryable: true,
              });
            }

            mapHttpStatus(response.status);

            if (response.truncated) {
              throw new AdapterFailureError({
                code: 'INVALID_RESPONSE',
                message: 'Telegram provider response oversized',
                adapter: 'notification',
                operation: 'send_message',
                retryable: false,
              });
            }

            parseTelegramSuccessResponse(response.bodyText);
          },
          {
            adapter: 'notification',
            operation: 'send_message',
            timeoutMs,
            signal: request.signal,
            runId: request.runId,
          }
        );

        return { ok: true };
      } catch (err) {
        return mapCaughtFailure(err, botToken);
      }
    },
  };
}

/**
 * Map provider-neutral recipient.address → Telegram chat_id.
 * Accepts numeric ids (incl. negative group/supergroup) or @username.
 */
export function isValidTelegramChatId(value: string): boolean {
  if (!value || /\s/.test(value)) return false;
  if (/^-?\d{1,20}$/.test(value)) return true;
  if (/^@[A-Za-z][A-Za-z0-9_]{4,31}$/.test(value)) return true;
  return false;
}

function mapHttpStatus(status: number): void {
  if (status >= 200 && status < 300) return;
  if (status === 400 || status === 422) {
    throw new AdapterFailureError({
      code: 'INVALID_RESPONSE',
      message: `Telegram provider rejected request (HTTP ${status})`,
      adapter: 'notification',
      operation: 'send_message',
      retryable: false,
    });
  }
  if (status === 401) {
    throw new AdapterFailureError({
      code: 'AUTH_REQUIRED',
      message: 'Telegram provider authentication failed',
      adapter: 'notification',
      operation: 'send_message',
      retryable: false,
    });
  }
  if (status === 403) {
    throw new AdapterFailureError({
      code: 'POLICY_BLOCKED',
      message: 'Telegram provider denied the request',
      adapter: 'notification',
      operation: 'send_message',
      retryable: false,
    });
  }
  if (status === 408) {
    throw new AdapterFailureError({
      code: 'TIMEOUT',
      message: 'Telegram provider timed out',
      adapter: 'notification',
      operation: 'send_message',
      retryable: true,
    });
  }
  if (status === 429) {
    throw new AdapterFailureError({
      code: 'RATE_LIMITED',
      message: 'Telegram provider rate limited the request',
      adapter: 'notification',
      operation: 'send_message',
      retryable: true,
    });
  }
  if (status >= 500) {
    throw new AdapterFailureError({
      code: 'UNAVAILABLE',
      message: `Telegram provider unavailable (HTTP ${status})`,
      adapter: 'notification',
      operation: 'send_message',
      retryable: true,
    });
  }
  throw new AdapterFailureError({
    code: 'INVALID_RESPONSE',
    message: `Telegram provider unexpected HTTP status ${status}`,
    adapter: 'notification',
    operation: 'send_message',
    retryable: false,
  });
}

/**
 * Telegram success envelope: `{ "ok": true, "result": { ... } }`.
 * `{ "ok": false, ... }` on 2xx is INVALID_RESPONSE.
 */
function parseTelegramSuccessResponse(bodyText: string): void {
  let parsed: unknown;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    throw new AdapterFailureError({
      code: 'INVALID_RESPONSE',
      message: 'Telegram provider returned non-JSON success body',
      adapter: 'notification',
      operation: 'send_message',
      retryable: false,
    });
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new AdapterFailureError({
      code: 'INVALID_RESPONSE',
      message: 'Telegram provider success response malformed',
      adapter: 'notification',
      operation: 'send_message',
      retryable: false,
    });
  }

  const envelope = parsed as { ok?: unknown; result?: unknown; error_code?: unknown };
  if (envelope.ok === false) {
    throw new AdapterFailureError({
      code: 'INVALID_RESPONSE',
      message: 'Telegram provider returned ok:false',
      adapter: 'notification',
      operation: 'send_message',
      retryable: false,
    });
  }
  if (envelope.ok !== true || envelope.result === undefined || envelope.result === null) {
    throw new AdapterFailureError({
      code: 'INVALID_RESPONSE',
      message: 'Telegram provider success response missing ok/result',
      adapter: 'notification',
      operation: 'send_message',
      retryable: false,
    });
  }
}

function mapCaughtFailure(
  err: unknown,
  botToken: string
): NotificationDeliveryResult {
  if (AdapterFailureError.isAdapterFailure(err)) {
    const code = adapterCodeToNotificationCode(
      err.failure.code,
      err.failure.message
    );
    return {
      ok: false,
      code,
      message: sanitizeMessage(err.failure.message, botToken),
    };
  }
  const message =
    err instanceof Error
      ? sanitizeMessage(err.message, botToken)
      : 'Telegram delivery failed';
  return { ok: false, code: 'DELIVERY_FAILED', message };
}

function adapterCodeToNotificationCode(
  code: string,
  message: string
): NotificationFailureCode {
  if (
    code === 'INVALID_RESPONSE' &&
    (message.includes('HTTP 400') || message.includes('HTTP 422'))
  ) {
    return 'INVALID_REQUEST';
  }
  switch (code) {
    case 'TIMEOUT':
      return 'TIMEOUT';
    case 'CANCELLED':
      return 'CANCELLED';
    case 'UNAVAILABLE':
      return 'UNAVAILABLE';
    case 'AUTH_REQUIRED':
      return 'AUTH_REQUIRED';
    case 'POLICY_BLOCKED':
      return 'POLICY_BLOCKED';
    case 'RATE_LIMITED':
      return 'RATE_LIMITED';
    case 'NETWORK_ERROR':
      return 'NETWORK_ERROR';
    case 'INVALID_RESPONSE':
      return 'INVALID_RESPONSE';
    default:
      return 'DELIVERY_FAILED';
  }
}

/** Strip bot tokens from messages — never leak into domain failures. */
function sanitizeMessage(message: string, botToken: string): string {
  let out = message;
  if (botToken) {
    out = out.split(botToken).join('[redacted]');
  }
  // Common Telegram token shape: 123456:ABC-DEF...
  out = out.replace(/\b\d{6,}:[A-Za-z0-9_-]{20,}\b/g, '[redacted]');
  out = out.replace(/\/bot[A-Za-z0-9:_-]+\//gi, '/bot[redacted]/');
  return out;
}
