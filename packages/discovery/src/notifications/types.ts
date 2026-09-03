import type { DiscoveryDigest } from '../types/digest.js';
import type { NoveltyStatus } from '../types/novelty.js';

/** Provider-neutral channel — no vendor names. */
export type NotificationChannel = 'EMAIL' | 'TELEGRAM' | 'PUSH' | 'IN_APP';

export type NotificationRecipient = {
  userId: string;
  /** Opaque routing address supplied by composition root (never secrets in diagnostics). */
  address: string;
};

export type NotificationPriority = 'HIGH' | 'NORMAL' | 'LOW';

/** Single digest entry reference for provider rendering. */
export type NotificationItem = {
  resultId: string;
  rank: number;
  rankValue: number;
  novelty: NoveltyStatus;
  priority: NotificationPriority;
};

/** Provider-neutral payload — describes what to communicate, not how to render. */
export type NotificationPayload = {
  title: string;
  summary: string;
  resultIds: string[];
  items: NotificationItem[];
  runId: string;
  strategyId: string;
  strategyVersion: string;
  period: { from: string; to: string };
};

export type NotificationDeliveryStatus = 'PENDING' | 'SENT' | 'FAILED';

export type NotificationFailureCode =
  | 'INVALID_REQUEST'
  | 'DELIVERY_FAILED'
  | 'ALREADY_DELIVERED'
  | 'UNAVAILABLE'
  | 'TIMEOUT'
  | 'CANCELLED'
  /** Additive E4.5 — provider / transport failure detail */
  | 'AUTH_REQUIRED'
  | 'POLICY_BLOCKED'
  | 'RATE_LIMITED'
  | 'NETWORK_ERROR'
  | 'INVALID_RESPONSE';

export type NotificationFailure = {
  code: NotificationFailureCode;
  message: string;
};

export type NotificationRecord = {
  id: string;
  profileId: string;
  digestId: string;
  runId: string;
  channel: NotificationChannel;
  recipient: NotificationRecipient;
  payload: NotificationPayload;
  status: NotificationDeliveryStatus;
  createdAt: string;
  sentAt?: string;
  failure?: NotificationFailure;
};

/** Built from an authoritative DiscoveryDigest — eligibility is not recomputed. */
export type NotificationPlan = {
  digestId: string;
  profileId: string;
  runId: string;
  channel: NotificationChannel;
  recipient: NotificationRecipient;
  payload: NotificationPayload;
};

export type NotificationDeliveryResult =
  | { ok: true }
  | { ok: false; code: NotificationFailureCode; message: string };

export type NotificationSendRequest = {
  notificationId: string;
  profileId: string;
  digestId: string;
  channel: NotificationChannel;
  recipient: NotificationRecipient;
  payload: NotificationPayload;
  runId: string;
  signal?: AbortSignal;
  timeoutMs?: number;
};

export type DeliverDigestInput = {
  digest: DiscoveryDigest;
  recipient: NotificationRecipient;
  channel: NotificationChannel;
  /** Profile preference — when true (default), empty digests skip delivery. */
  skipEmptyDigest?: boolean;
  signal?: AbortSignal;
  timeoutMs?: number;
};

export type DeliverDigestOutcome =
  | { kind: 'skipped'; reason: 'empty_digest' | 'already_delivered' }
  | { kind: 'delivered'; notificationId: string }
  | { kind: 'failed'; notificationId: string; failure: NotificationFailure };

/** Idempotency key components — documented in ADR E4.4. */
export type NotificationIdempotencyKey = {
  profileId: string;
  digestId: string;
  channel: NotificationChannel;
  recipient: NotificationRecipient;
};
