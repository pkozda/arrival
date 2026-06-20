import {
  parseUserContextV1,
  type MutationRequest,
  type UserContextV1,
} from '@/lib/product-contract';
import { buildAuthHeaders } from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export type MutationSubmitResponse = {
  success: true;
  revision: number;
  userContext: UserContextV1;
  appliedEventId: string;
};

export type MutationSubmitError = {
  success: false;
  code: string;
  error: string;
  issues?: Array<{ code: string; message: string; fieldId?: string }>;
};

export type MutationSubmitResult = {
  userContext: UserContextV1;
  revision: number;
};

export class MutationClientError extends Error {
  readonly code: string;
  readonly issues?: MutationSubmitError['issues'];

  constructor(message: string, code: string, issues?: MutationSubmitError['issues']) {
    super(message);
    this.name = 'MutationClientError';
    this.code = code;
    this.issues = issues;
  }
}

export async function fetchUserContext(sessionId?: string): Promise<UserContextV1> {
  const res = await fetch(`${API_URL}/api/user-context`, {
    headers: buildAuthHeaders({ sessionId }),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `User context request failed (${res.status})`);
  }

  const body = await res.json();
  return parseUserContextV1(body);
}

export async function submitMutation(
  request: MutationRequest,
  sessionId?: string
): Promise<MutationSubmitResult> {
  if (!request.requestId || request.requestId.trim().length === 0) {
    throw new Error('MutationRequest.requestId is required for idempotency');
  }

  const res = await fetch(`${API_URL}/api/mutations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...buildAuthHeaders({ sessionId }),
    },
    body: JSON.stringify(request),
  });

  const body = (await res.json()) as MutationSubmitResponse | MutationSubmitError;

  if (!res.ok || !('success' in body) || body.success !== true) {
    const errorBody = body as MutationSubmitError;
    throw new MutationClientError(
      errorBody.error ?? `Mutation request failed (${res.status})`,
      errorBody.code ?? 'MUTATION_FAILED',
      errorBody.issues
    );
  }

  return {
    userContext: parseUserContextV1(body.userContext),
    revision: body.revision,
  };
}
