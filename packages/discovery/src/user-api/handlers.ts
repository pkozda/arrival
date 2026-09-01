import type { DiscoveryUserService } from './discovery-user-service.js';
import {
  DiscoveryUserConflictError,
  DiscoveryUserNotFoundError,
  DiscoveryUserValidationError,
} from './errors.js';
import {
  DiscoveryHttpError,
  errorResponse,
  jsonResponse,
} from '../http/errors.js';
import type { DiscoveryHttpRequest, DiscoveryHttpResponse } from '../http/types.js';
import { headerValue } from '../http/request-id.js';
import { MAX_ADMIN_BODY_BYTES } from '../http/types.js';
import { parseCreateProfileBody, parseUpdateProfileBody } from './discovery-user-service.js';
import type { StrategyRegistry } from '../registry/strategy-registry.js';
import {
  validateProfileId,
  validateResultId,
  validateUserStateBody,
} from './validation.js';
import type { DiscoveryUserPrincipal } from './types.js';

export type UserHandlerContext = {
  service: DiscoveryUserService;
  registry: StrategyRegistry;
  requestId: string;
  secrets: readonly string[];
  principal: DiscoveryUserPrincipal;
};

function parseJsonBody(req: DiscoveryHttpRequest): unknown {
  const ct = headerValue(req.headers, 'content-type')?.toLowerCase() ?? '';
  if (!ct.includes('application/json')) {
    throw new DiscoveryHttpError(
      400,
      'INVALID_REQUEST',
      'Content-Type must be application/json'
    );
  }
  const text = req.bodyText ?? '';
  if (Buffer.byteLength(text, 'utf8') > MAX_ADMIN_BODY_BYTES) {
    throw new DiscoveryHttpError(400, 'INVALID_REQUEST', 'Request body too large');
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

export async function handleListProfiles(
  ctx: UserHandlerContext
): Promise<DiscoveryHttpResponse> {
  const profiles = await ctx.service.listProfiles(ctx.principal.userId);
  return jsonResponse(200, { profiles }, ctx.requestId);
}

export async function handleGetProfile(
  ctx: UserHandlerContext,
  profileId: string
): Promise<DiscoveryHttpResponse> {
  const id = validateProfileId(profileId);
  if (!id.ok) {
    return errorResponse(400, 'INVALID_REQUEST', id.message, ctx.requestId);
  }
  const profile = await ctx.service.getProfile(ctx.principal.userId, id.value);
  return jsonResponse(200, { profile }, ctx.requestId);
}

export async function handleCreateProfile(
  ctx: UserHandlerContext,
  req: DiscoveryHttpRequest
): Promise<DiscoveryHttpResponse> {
  const parsed = parseCreateProfileBody(parseJsonBody(req), ctx.registry);
  const profile = await ctx.service.createProfile(ctx.principal.userId, parsed);
  return jsonResponse(201, { profile }, ctx.requestId);
}

export async function handleUpdateProfile(
  ctx: UserHandlerContext,
  profileId: string,
  req: DiscoveryHttpRequest
): Promise<DiscoveryHttpResponse> {
  const id = validateProfileId(profileId);
  if (!id.ok) {
    return errorResponse(400, 'INVALID_REQUEST', id.message, ctx.requestId);
  }
  const existing = await ctx.service.getProfile(ctx.principal.userId, id.value);
  const patch = parseUpdateProfileBody(parseJsonBody(req), existing);
  const profile = await ctx.service.updateProfile(
    ctx.principal.userId,
    id.value,
    patch
  );
  return jsonResponse(200, { profile }, ctx.requestId);
}

export async function handleEnableProfile(
  ctx: UserHandlerContext,
  profileId: string
): Promise<DiscoveryHttpResponse> {
  const id = validateProfileId(profileId);
  if (!id.ok) {
    return errorResponse(400, 'INVALID_REQUEST', id.message, ctx.requestId);
  }
  const profile = await ctx.service.enableProfile(ctx.principal.userId, id.value);
  return jsonResponse(200, { profile }, ctx.requestId);
}

export async function handleDisableProfile(
  ctx: UserHandlerContext,
  profileId: string
): Promise<DiscoveryHttpResponse> {
  const id = validateProfileId(profileId);
  if (!id.ok) {
    return errorResponse(400, 'INVALID_REQUEST', id.message, ctx.requestId);
  }
  const profile = await ctx.service.disableProfile(ctx.principal.userId, id.value);
  return jsonResponse(200, { profile }, ctx.requestId);
}

export async function handleListResults(
  ctx: UserHandlerContext,
  profileId: string
): Promise<DiscoveryHttpResponse> {
  const id = validateProfileId(profileId);
  if (!id.ok) {
    return errorResponse(400, 'INVALID_REQUEST', id.message, ctx.requestId);
  }
  const results = await ctx.service.listResults(ctx.principal.userId, id.value);
  return jsonResponse(200, { results }, ctx.requestId);
}

export async function handleGetResult(
  ctx: UserHandlerContext,
  profileId: string,
  resultId: string
): Promise<DiscoveryHttpResponse> {
  const pid = validateProfileId(profileId);
  if (!pid.ok) {
    return errorResponse(400, 'INVALID_REQUEST', pid.message, ctx.requestId);
  }
  const rid = validateResultId(resultId);
  if (!rid.ok) {
    return errorResponse(400, 'INVALID_REQUEST', rid.message, ctx.requestId);
  }
  const result = await ctx.service.getResult(
    ctx.principal.userId,
    pid.value,
    rid.value
  );
  return jsonResponse(200, { result }, ctx.requestId);
}

export async function handleUpdateResultUserState(
  ctx: UserHandlerContext,
  profileId: string,
  resultId: string,
  req: DiscoveryHttpRequest
): Promise<DiscoveryHttpResponse> {
  const pid = validateProfileId(profileId);
  if (!pid.ok) {
    return errorResponse(400, 'INVALID_REQUEST', pid.message, ctx.requestId);
  }
  const rid = validateResultId(resultId);
  if (!rid.ok) {
    return errorResponse(400, 'INVALID_REQUEST', rid.message, ctx.requestId);
  }
  const body = validateUserStateBody(parseJsonBody(req));
  if (!body.ok) {
    return errorResponse(400, 'INVALID_REQUEST', body.message, ctx.requestId);
  }
  const result = await ctx.service.updateResultUserState(
    ctx.principal.userId,
    pid.value,
    rid.value,
    body.value
  );
  return jsonResponse(200, { result }, ctx.requestId);
}

export async function handleGetProfileRunSummary(
  ctx: UserHandlerContext,
  profileId: string
): Promise<DiscoveryHttpResponse> {
  const id = validateProfileId(profileId);
  if (!id.ok) {
    return errorResponse(400, 'INVALID_REQUEST', id.message, ctx.requestId);
  }
  const summary = await ctx.service.getProfileRunSummary(
    ctx.principal.userId,
    id.value
  );
  return jsonResponse(200, summary, ctx.requestId);
}

export async function handleRunProfileNow(
  ctx: UserHandlerContext,
  profileId: string
): Promise<DiscoveryHttpResponse> {
  const id = validateProfileId(profileId);
  if (!id.ok) {
    return errorResponse(400, 'INVALID_REQUEST', id.message, ctx.requestId);
  }
  const result = await ctx.service.runProfileNow(ctx.principal.userId, id.value);
  return jsonResponse(202, result, ctx.requestId);
}

export function mapUserApiError(
  err: unknown,
  requestId: string,
  secrets: readonly string[] = []
): DiscoveryHttpResponse {
  if (err instanceof DiscoveryUserNotFoundError) {
    return errorResponse(404, 'NOT_FOUND', err.message, requestId, secrets);
  }
  if (err instanceof DiscoveryUserValidationError) {
    return errorResponse(400, 'INVALID_REQUEST', err.message, requestId, secrets);
  }
  if (err instanceof DiscoveryUserConflictError) {
    return errorResponse(409, 'CONFLICT', err.message, requestId, secrets);
  }
  if (err instanceof DiscoveryHttpError) {
    return errorResponse(err.status, err.code, err.message, requestId, secrets);
  }
  const raw = err instanceof Error ? err.message : 'Internal server error';
  return errorResponse(500, 'INTERNAL_ERROR', raw, requestId, secrets);
}
