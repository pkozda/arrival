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
import { renderDiscoveryEmail } from './render-discovery-email.js';

export const RESEND_EMAIL_PROVIDER_ID = 'resend' as const;
export const RESEND_EMAIL_RATE_LIMIT_KEY = 'notification:email:resend' as const;

const DEFAULT_BASE_URL = 'https://api.resend.com/emails';
const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * Production email notification config — composition root supplies secrets.
 * Adapter never reads process.env.
 */
export type ProductionEmailNotificationConfig = {
  apiKey: string;
  /** Verified sender identity, e.g. `Arrival Atlas <noreply@example.com>` */
  from: string;
  baseUrl?: string;
  transport?: HttpTransport;
  rateLimiter?: RateLimiter;
  timeoutMs?: number;
};

/** Alias matching E4.5 naming. */
export type EmailNotificationConfig = ProductionEmailNotificationConfig;

/**
 * Production NotificationAdapter for transactional email via Resend HTTP API.
 * Provider-specific request/response types stay in this module.
 */
export function createProductionEmailNotificationAdapter(
  config: ProductionEmailNotificationConfig
): NotificationAdapter {
  return createResendEmailNotificationAdapter(config);
}

/**
 * Build the production email NotificationAdapter from DiscoveryProductionConfig.
 * Returns null when email is not configured.
 * Pipeline composition deliberately excludes notifications — wire this at the
 * composition root alongside createDiscoveryNotificationService.
 */
export function createProductionEmailNotificationAdapterFromConfig(
  config: DiscoveryProductionConfig,
  overrides: {
    transport?: HttpTransport;
    rateLimiter?: RateLimiter;
  } = {}
): NotificationAdapter | null {
  if (!config.email) return null;
  return createProductionEmailNotificationAdapter({
    apiKey: config.email.apiKey,
    from: config.email.from,
    baseUrl: config.email.baseUrl,
    timeoutMs: config.email.timeoutMs,
    transport: overrides.transport ?? config.transport,
    rateLimiter: overrides.rateLimiter ?? config.rateLimiter,
  });
}

export function createResendEmailNotificationAdapter(
  config: ProductionEmailNotificationConfig
): NotificationAdapter {
  const transport = config.transport ?? createFetchHttpTransport();
  const rateLimiter = config.rateLimiter ?? createInMemoryRateLimiter();
  const baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
  const defaultTimeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return {
    async send(request: NotificationSendRequest): Promise<NotificationDeliveryResult> {
      if (request.channel !== 'EMAIL') {
        return {
          ok: false,
          code: 'INVALID_REQUEST',
          message: 'Email adapter only supports EMAIL channel',
        };
      }

      const apiKey = config.apiKey?.trim();
      if (!apiKey) {
        return {
          ok: false,
          code: 'INVALID_REQUEST',
          message: 'Email adapter missing API key',
        };
      }

      const from = config.from?.trim();
      if (!from) {
        return {
          ok: false,
          code: 'INVALID_REQUEST',
          message: 'Email adapter missing sender',
        };
      }

      const to = request.recipient.address?.trim();
      if (!to || !isValidEmailAddress(to)) {
        return {
          ok: false,
          code: 'INVALID_REQUEST',
          message: 'Recipient address is not a valid email',
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
      const rendered = renderDiscoveryEmail(request.payload);

      try {
        await rateLimiter.acquire(RESEND_EMAIL_RATE_LIMIT_KEY, {
          runId: request.runId,
          signal: request.signal,
          timeoutMs,
        });

        await executeWithTimeout(
          async (signal) => {
            // Provider request body — never log apiKey
            const providerBody = {
              from,
              to: [to],
              subject: rendered.subject,
              html: rendered.html,
              text: rendered.text,
            };

            let response;
            try {
              response = await transport.request({
                url: baseUrl,
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${apiKey}`,
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
                  message: 'Email delivery cancelled',
                  adapter: 'notification',
                  operation: 'send_email',
                  retryable: false,
                });
              }
              throw new AdapterFailureError({
                code: 'NETWORK_ERROR',
                message: 'Email transport network failure',
                adapter: 'notification',
                operation: 'send_email',
                retryable: true,
              });
            }

            mapHttpStatus(response.status);

            if (response.truncated) {
              throw new AdapterFailureError({
                code: 'INVALID_RESPONSE',
                message: 'Email provider response oversized',
                adapter: 'notification',
                operation: 'send_email',
                retryable: false,
              });
            }

            parseResendSuccessResponse(response.bodyText);
          },
          {
            adapter: 'notification',
            operation: 'send_email',
            timeoutMs,
            signal: request.signal,
            runId: request.runId,
          }
        );

        return { ok: true };
      } catch (err) {
        return mapCaughtFailure(err);
      }
    },
  };
}

function isValidEmailAddress(value: string): boolean {
  // Practical validation — not full RFC. Rejects empty, spaces, missing @.
  if (value.length > 320) return false;
  if (/\s/.test(value)) return false;
  const at = value.indexOf('@');
  if (at <= 0 || at !== value.lastIndexOf('@')) return false;
  const domain = value.slice(at + 1);
  if (!domain.includes('.') || domain.startsWith('.') || domain.endsWith('.')) {
    return false;
  }
  return true;
}

function mapHttpStatus(status: number): void {
  if (status >= 200 && status < 300) return;
  if (status === 400 || status === 422) {
    throw new AdapterFailureError({
      code: 'INVALID_RESPONSE',
      message: `Email provider rejected request (HTTP ${status})`,
      adapter: 'notification',
      operation: 'send_email',
      retryable: false,
    });
  }
  if (status === 401) {
    throw new AdapterFailureError({
      code: 'AUTH_REQUIRED',
      message: 'Email provider authentication failed',
      adapter: 'notification',
      operation: 'send_email',
      retryable: false,
    });
  }
  if (status === 403) {
    throw new AdapterFailureError({
      code: 'POLICY_BLOCKED',
      message: 'Email provider denied the request',
      adapter: 'notification',
      operation: 'send_email',
      retryable: false,
    });
  }
  if (status === 408) {
    throw new AdapterFailureError({
      code: 'TIMEOUT',
      message: 'Email provider timed out',
      adapter: 'notification',
      operation: 'send_email',
      retryable: true,
    });
  }
  if (status === 429) {
    throw new AdapterFailureError({
      code: 'RATE_LIMITED',
      message: 'Email provider rate limited the request',
      adapter: 'notification',
      operation: 'send_email',
      retryable: true,
    });
  }
  if (status >= 500) {
    throw new AdapterFailureError({
      code: 'UNAVAILABLE',
      message: `Email provider unavailable (HTTP ${status})`,
      adapter: 'notification',
      operation: 'send_email',
      retryable: true,
    });
  }
  throw new AdapterFailureError({
    code: 'INVALID_RESPONSE',
    message: `Email provider unexpected HTTP status ${status}`,
    adapter: 'notification',
    operation: 'send_email',
    retryable: false,
  });
}

/**
 * Resend success: `{ "id": "..." }`. Malformed 2xx → INVALID_RESPONSE.
 * Never includes API key in thrown messages.
 */
function parseResendSuccessResponse(bodyText: string): { id: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    throw new AdapterFailureError({
      code: 'INVALID_RESPONSE',
      message: 'Email provider returned non-JSON success body',
      adapter: 'notification',
      operation: 'send_email',
      retryable: false,
    });
  }
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    typeof (parsed as { id?: unknown }).id !== 'string' ||
    !(parsed as { id: string }).id.trim()
  ) {
    throw new AdapterFailureError({
      code: 'INVALID_RESPONSE',
      message: 'Email provider success response missing id',
      adapter: 'notification',
      operation: 'send_email',
      retryable: false,
    });
  }
  return { id: (parsed as { id: string }).id };
}

function mapCaughtFailure(err: unknown): NotificationDeliveryResult {
  if (AdapterFailureError.isAdapterFailure(err)) {
    const code = adapterCodeToNotificationCode(err.failure.code, err.failure.message);
    return {
      ok: false,
      code,
      message: sanitizeMessage(err.failure.message),
    };
  }
  const message =
    err instanceof Error ? sanitizeMessage(err.message) : 'Email delivery failed';
  return { ok: false, code: 'DELIVERY_FAILED', message };
}

function adapterCodeToNotificationCode(
  code: string,
  message: string
): NotificationFailureCode {
  // Prefer INVALID_REQUEST for client 400/422 (message includes HTTP 400/422)
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

/** Strip anything that looks like a bearer token / API key from messages. */
function sanitizeMessage(message: string): string {
  return message
    .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
    .replace(/re_[A-Za-z0-9_]+/g, '[redacted]');
}
