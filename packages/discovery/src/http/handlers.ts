import type { DiscoveryService } from '../service/discovery-service.js';
import type { DiscoveryProviderEnablement } from '../runtime/runtime-config.js';
import type { DiscoveryRuntimeHealth } from '../runtime/health.js';
import type { TriggerRunOutcome } from '../scheduler/types.js';
import {
  DiscoveryHttpError,
  errorResponse,
  jsonResponse,
} from './errors.js';
import {
  validateRegisterScheduleBody,
  validateRunId,
  validateScheduleId,
} from './validation.js';
import { headerValue } from './request-id.js';
import {
  MAX_ADMIN_BODY_BYTES,
  type DiscoveryHttpRequest,
  type DiscoveryHttpResponse,
} from './types.js';

export type HandlerContext = {
  service: DiscoveryService;
  requestId: string;
  secrets: readonly string[];
};

function requireJsonContentType(req: DiscoveryHttpRequest): void {
  const ct = headerValue(req.headers, 'content-type')?.toLowerCase() ?? '';
  if (!ct.includes('application/json')) {
    throw new DiscoveryHttpError(
      400,
      'INVALID_REQUEST',
      'Content-Type must be application/json'
    );
  }
}

function parseJsonBody(req: DiscoveryHttpRequest): unknown {
  requireJsonContentType(req);
  const text = req.bodyText ?? '';
  if (Buffer.byteLength(text, 'utf8') > MAX_ADMIN_BODY_BYTES) {
    throw new DiscoveryHttpError(
      400,
      'INVALID_REQUEST',
      'Request body too large'
    );
  }
  if (!text.trim()) {
    throw new DiscoveryHttpError(400, 'INVALID_REQUEST', 'Request body is required');
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new DiscoveryHttpError(400, 'INVALID_REQUEST', 'Malformed JSON body');
  }
}

function safeStatusPayload(
  service: DiscoveryService,
  health: DiscoveryRuntimeHealth
): {
  lifecycle: string;
  health: DiscoveryRuntimeHealth;
  providers: DiscoveryProviderEnablement | null;
  runtimeInstanceId?: string;
} {
  const redacted = service.redactedConfig();
  return {
    lifecycle: service.lifecycle(),
    health,
    providers: redacted?.providers ?? null,
    runtimeInstanceId: health.runtimeInstanceId,
  };
}

export async function handleGetHealth(
  ctx: HandlerContext
): Promise<DiscoveryHttpResponse> {
  const health = await ctx.service.getHealth();
  return jsonResponse(200, health, ctx.requestId);
}

export async function handleGetStatus(
  ctx: HandlerContext
): Promise<DiscoveryHttpResponse> {
  const health = await ctx.service.getHealth();
  return jsonResponse(200, safeStatusPayload(ctx.service, health), ctx.requestId);
}

export async function handleListSchedules(
  ctx: HandlerContext
): Promise<DiscoveryHttpResponse> {
  const schedules = await ctx.service.listSchedules();
  return jsonResponse(200, { schedules }, ctx.requestId);
}

export async function handleCreateSchedule(
  ctx: HandlerContext,
  req: DiscoveryHttpRequest
): Promise<DiscoveryHttpResponse> {
  const parsed = parseJsonBody(req);
  const validated = validateRegisterScheduleBody(parsed);
  if (!validated.ok) {
    return errorResponse(400, 'INVALID_REQUEST', validated.message, ctx.requestId);
  }
  const schedule = await ctx.service.registerSchedule(validated.value);
  return jsonResponse(201, { schedule }, ctx.requestId);
}

export async function handleEnableSchedule(
  ctx: HandlerContext,
  scheduleId: string
): Promise<DiscoveryHttpResponse> {
  const id = validateScheduleId(scheduleId);
  if (!id.ok) {
    return errorResponse(400, 'INVALID_REQUEST', id.message, ctx.requestId);
  }
  const schedule = await ctx.service.enableSchedule(id.value);
  if (!schedule) {
    return errorResponse(404, 'NOT_FOUND', 'Schedule not found', ctx.requestId);
  }
  return jsonResponse(200, { schedule }, ctx.requestId);
}

export async function handleDisableSchedule(
  ctx: HandlerContext,
  scheduleId: string
): Promise<DiscoveryHttpResponse> {
  const id = validateScheduleId(scheduleId);
  if (!id.ok) {
    return errorResponse(400, 'INVALID_REQUEST', id.message, ctx.requestId);
  }
  const schedule = await ctx.service.disableSchedule(id.value);
  if (!schedule) {
    return errorResponse(404, 'NOT_FOUND', 'Schedule not found', ctx.requestId);
  }
  return jsonResponse(200, { schedule }, ctx.requestId);
}

function runNowResponse(
  outcome: TriggerRunOutcome,
  requestId: string
): DiscoveryHttpResponse {
  if (outcome.kind === 'enqueued') {
    return jsonResponse(
      202,
      {
        kind: 'enqueued',
        scheduleId: outcome.scheduleId,
        runId: outcome.runId,
        jobId: outcome.jobId,
        trigger: outcome.trigger,
      },
      requestId
    );
  }
  if (outcome.kind === 'skipped') {
    if (outcome.reason === 'not_found') {
      return errorResponse(404, 'NOT_FOUND', 'Schedule not found', requestId);
    }
    if (
      outcome.reason === 'already_running' ||
      outcome.reason === 'duplicate_enqueue' ||
      outcome.reason === 'lock_contended' ||
      outcome.reason === 'claim_failed'
    ) {
      return errorResponse(
        409,
        'CONFLICT',
        `Schedule trigger skipped: ${outcome.reason}`,
        requestId
      );
    }
    return errorResponse(
      409,
      'CONFLICT',
      `Schedule trigger skipped: ${outcome.reason}`,
      requestId
    );
  }
  return errorResponse(
    500,
    'INTERNAL_ERROR',
    outcome.errorMessage || 'Schedule trigger failed',
    requestId
  );
}

export async function handleRunSchedule(
  ctx: HandlerContext,
  scheduleId: string
): Promise<DiscoveryHttpResponse> {
  const id = validateScheduleId(scheduleId);
  if (!id.ok) {
    return errorResponse(400, 'INVALID_REQUEST', id.message, ctx.requestId);
  }
  const outcome = await ctx.service.runNow({ scheduleId: id.value });
  return runNowResponse(outcome, ctx.requestId);
}

export async function handleGetRun(
  ctx: HandlerContext,
  runId: string
): Promise<DiscoveryHttpResponse> {
  const id = validateRunId(runId);
  if (!id.ok) {
    return errorResponse(400, 'INVALID_REQUEST', id.message, ctx.requestId);
  }
  const run = await ctx.service.getRun(id.value);
  if (!run) {
    return errorResponse(404, 'NOT_FOUND', 'Run not found', ctx.requestId);
  }
  return jsonResponse(200, { run }, ctx.requestId);
}

export async function handleProcessNext(
  ctx: HandlerContext
): Promise<DiscoveryHttpResponse> {
  const result = await ctx.service.processNext();
  return jsonResponse(200, { result }, ctx.requestId);
}
