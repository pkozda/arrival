import {
  redactDiscoveryProductionConfig,
  validateDiscoveryProductionConfig,
  type DiscoveryProductionConfig,
  type RedactedDiscoveryProductionConfig,
} from '../adapters/production/production-composition.js';
import { DiscoveryConfigurationError } from './errors.js';

/**
 * SQLite paths owned by the runtime when created via createDiscoveryRuntime.
 */
export type DiscoveryRuntimePersistencePaths = {
  /** SQLite file for Results (E4.1) — runtime-owned */
  resultsDatabasePath: string;
  /** SQLite file for schedules / run metadata (E4.2) — runtime-owned */
  schedulerDatabasePath: string;
  /** SQLite file for notification idempotency (E4.4) — runtime-owned */
  notificationsDatabasePath: string;
  /** SQLite file for durable execution queue (E5.2) — runtime-owned */
  queueDatabasePath: string;
  /** SQLite file for DiscoveryProfile durability (E7.1) — runtime-owned */
  profilesDatabasePath: string;
};

/**
 * Infrastructure slice used for validation / redaction (no domain objects).
 */
export type DiscoveryRuntimeInfrastructureSlice = {
  production: DiscoveryProductionConfig;
  persistence: DiscoveryRuntimePersistencePaths;
  adapterTimeoutMs?: number;
  schedulerLockLeaseMs?: number;
  retry?: {
    maxAttempts?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
  };
  transport?: unknown;
  rateLimiter?: unknown;
  rawContentStore?: unknown;
  queue?: unknown;
  schedulerLock?: unknown;
};

/**
 * Application/domain flags — not loaded from process.env.
 */
export type DiscoveryRuntimeApplicationConfig = {
  hasNotificationTargetResolver: boolean;
  hasEnginePolicy: boolean;
  hasCustomRunIdGenerator: boolean;
  hasCustomJobIdGenerator: boolean;
};

export type DiscoveryProviderEnablement = {
  search: 'brave';
  ai: 'openai';
  email: boolean;
  telegram: boolean;
};

export type DiscoveryRuntimeConfigValidation =
  | { ok: true; providers: DiscoveryProviderEnablement }
  | { ok: false; issues: string[] };

export type RedactedDiscoveryRuntimeConfig = {
  production: RedactedDiscoveryProductionConfig;
  persistence: DiscoveryRuntimePersistencePaths;
  adapterTimeoutMs?: number;
  schedulerLockLeaseMs?: number;
  retry?: {
    maxAttempts?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
  };
  providers: DiscoveryProviderEnablement;
  application: DiscoveryRuntimeApplicationConfig;
  ownership: {
    runtimeOwnsSqlite: true;
    callerOwnsInjectedTransport: boolean;
    callerOwnsInjectedRateLimiter: boolean;
    callerOwnsInjectedRawContentStore: boolean;
    callerOwnsInjectedQueue: boolean;
    callerOwnsInjectedSchedulerLock: boolean;
  };
};

type RuntimeConfigLike = DiscoveryRuntimeInfrastructureSlice & {
  resolveNotificationTarget?: unknown;
  enginePolicy?: unknown;
  runIdGenerator?: unknown;
  jobIdGenerator?: unknown;
};

/**
 * Explicit provider availability derived from production config presence.
 * Optional notification providers are never mandatory for discovery execution.
 */
export function getDiscoveryProviderEnablement(
  production: DiscoveryProductionConfig
): DiscoveryProviderEnablement {
  return {
    search: 'brave',
    ai: 'openai',
    email: production.email !== undefined,
    telegram: production.telegram !== undefined,
  };
}

/**
 * Side-effect-free runtime config validation (no network, no filesystem writes).
 */
export function validateDiscoveryRuntimeConfig(
  config: RuntimeConfigLike
): DiscoveryRuntimeConfigValidation {
  const issues: string[] = [];

  const productionValidation = validateDiscoveryProductionConfig(config.production);
  if (!productionValidation.ok) {
    issues.push(...productionValidation.issues);
  }

  assertDatabasePath(issues, 'persistence.resultsDatabasePath', config.persistence?.resultsDatabasePath);
  assertDatabasePath(
    issues,
    'persistence.schedulerDatabasePath',
    config.persistence?.schedulerDatabasePath
  );
  assertDatabasePath(
    issues,
    'persistence.notificationsDatabasePath',
    config.persistence?.notificationsDatabasePath
  );
  assertDatabasePath(
    issues,
    'persistence.queueDatabasePath',
    config.persistence?.queueDatabasePath
  );
  assertDatabasePath(
    issues,
    'persistence.profilesDatabasePath',
    config.persistence?.profilesDatabasePath
  );

  if (config.adapterTimeoutMs !== undefined) {
    if (!Number.isFinite(config.adapterTimeoutMs) || config.adapterTimeoutMs <= 0) {
      issues.push('adapterTimeoutMs must be a positive number');
    }
  }

  if (config.schedulerLockLeaseMs !== undefined) {
    if (
      !Number.isFinite(config.schedulerLockLeaseMs) ||
      config.schedulerLockLeaseMs <= 0 ||
      !Number.isInteger(config.schedulerLockLeaseMs)
    ) {
      issues.push('schedulerLockLeaseMs must be a positive integer');
    }
  }

  if (config.retry !== undefined) {
    const { maxAttempts, baseDelayMs, maxDelayMs } = config.retry;
    if (maxAttempts !== undefined) {
      if (
        !Number.isFinite(maxAttempts) ||
        !Number.isInteger(maxAttempts) ||
        maxAttempts < 1
      ) {
        issues.push('retry.maxAttempts must be an integer >= 1');
      }
    }
    if (baseDelayMs !== undefined) {
      if (
        !Number.isFinite(baseDelayMs) ||
        !Number.isInteger(baseDelayMs) ||
        baseDelayMs <= 0
      ) {
        issues.push('retry.baseDelayMs must be a positive integer');
      }
    }
    if (maxDelayMs !== undefined) {
      if (
        !Number.isFinite(maxDelayMs) ||
        !Number.isInteger(maxDelayMs) ||
        maxDelayMs <= 0
      ) {
        issues.push('retry.maxDelayMs must be a positive integer');
      }
    }
    if (
      baseDelayMs !== undefined &&
      maxDelayMs !== undefined &&
      maxDelayMs < baseDelayMs
    ) {
      issues.push('retry.maxDelayMs must be >= retry.baseDelayMs');
    }
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  return {
    ok: true,
    providers: getDiscoveryProviderEnablement(config.production),
  };
}

/**
 * Throw DiscoveryConfigurationError when runtime config is invalid.
 */
export function assertDiscoveryRuntimeConfig(
  config: RuntimeConfigLike
): DiscoveryProviderEnablement {
  const validated = validateDiscoveryRuntimeConfig(config);
  if (!validated.ok) {
    throw new DiscoveryConfigurationError(
      `Invalid discovery runtime config: ${validated.issues.join('; ')}`,
      validated.issues
    );
  }
  return validated.providers;
}

/**
 * Redacted runtime config for diagnostics — never includes secrets.
 */
export function redactDiscoveryRuntimeConfig(
  config: RuntimeConfigLike
): RedactedDiscoveryRuntimeConfig {
  return {
    production: redactDiscoveryProductionConfig(config.production),
    persistence: { ...config.persistence },
    adapterTimeoutMs: config.adapterTimeoutMs,
    schedulerLockLeaseMs: config.schedulerLockLeaseMs,
    retry: config.retry
      ? {
          maxAttempts: config.retry.maxAttempts,
          baseDelayMs: config.retry.baseDelayMs,
          maxDelayMs: config.retry.maxDelayMs,
        }
      : undefined,
    providers: getDiscoveryProviderEnablement(config.production),
    application: {
      hasNotificationTargetResolver: config.resolveNotificationTarget !== undefined,
      hasEnginePolicy: config.enginePolicy !== undefined,
      hasCustomRunIdGenerator: config.runIdGenerator !== undefined,
      hasCustomJobIdGenerator: config.jobIdGenerator !== undefined,
    },
    ownership: {
      runtimeOwnsSqlite: true,
      callerOwnsInjectedTransport: config.transport !== undefined,
      callerOwnsInjectedRateLimiter: config.rateLimiter !== undefined,
      callerOwnsInjectedRawContentStore: config.rawContentStore !== undefined,
      callerOwnsInjectedQueue: config.queue !== undefined,
      callerOwnsInjectedSchedulerLock: config.schedulerLock !== undefined,
    },
  };
}

/**
 * Strip credential-like substrings from an error message before rethrowing.
 */
export function sanitizeRuntimeErrorMessage(
  message: string,
  secrets: readonly string[] = []
): string {
  let out = message;
  for (const secret of secrets) {
    const trimmed = secret?.trim();
    if (trimmed && trimmed.length >= 8) {
      out = out.split(trimmed).join('[redacted]');
    }
  }
  out = out.replace(/Bearer\s+\S+/gi, 'Bearer [redacted]');
  out = out.replace(/\b\d{6,}:[A-Za-z0-9_-]{20,}\b/g, '[redacted]');
  out = out.replace(/\bre_[A-Za-z0-9_]+/g, '[redacted]');
  out = out.replace(/\bsk-[A-Za-z0-9_-]+/g, '[redacted]');
  return out;
}

export function collectConfigSecrets(
  production: DiscoveryProductionConfig
): string[] {
  const secrets: string[] = [];
  if (production.brave?.apiKey) secrets.push(production.brave.apiKey);
  if (production.openai?.apiKey) secrets.push(production.openai.apiKey);
  if (production.email?.apiKey) secrets.push(production.email.apiKey);
  if (production.telegram?.botToken) secrets.push(production.telegram.botToken);
  return secrets;
}

function assertDatabasePath(
  issues: string[],
  label: string,
  value: string | undefined
): void {
  if (value === undefined || !String(value).trim()) {
    issues.push(`${label} is required`);
    return;
  }
  if (/api[_-]?key|token|secret|password/i.test(value) && value.includes('=')) {
    issues.push(`${label} looks like a credential, not a database path`);
  }
}
