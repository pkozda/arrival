import type { MutationRequest, UserContextV1 } from '@/lib/product-contract';
import type { MutationSubmitResult } from '@/lib/mutations';
import { isRevisionConflictError, parseRevisionConflictCurrentHead } from './revision-conflict.js';

export type SubmitDomainCorrectionOptions = {
  requests: MutationRequest[];
  profileHeadRevision: number;
  submitMutation: (request: MutationRequest) => Promise<MutationSubmitResult>;
};

export type SubmitDomainCorrectionResult = {
  userContext: UserContextV1;
  profileHeadRevision: number;
};

function withRevision(request: MutationRequest, revision: number): MutationRequest {
  if (request.type === 'pref.update') {
    return request;
  }

  return {
    ...request,
    expectedHeadRevision: revision,
  };
}

async function submitSingleWithRevisionRetry(
  request: MutationRequest,
  profileHeadRevision: number,
  submitMutation: SubmitDomainCorrectionOptions['submitMutation']
): Promise<MutationSubmitResult> {
  try {
    return await submitMutation(withRevision(request, profileHeadRevision));
  } catch (error) {
    if (!isRevisionConflictError(error) || request.type === 'pref.update') {
      throw error;
    }

    const currentHead = parseRevisionConflictCurrentHead(
      error instanceof Error ? error.message : String(error)
    );

    if (currentHead === null) {
      throw error;
    }

    return submitMutation(withRevision(request, currentHead));
  }
}

export async function submitDomainCorrectionRequests(
  options: SubmitDomainCorrectionOptions
): Promise<SubmitDomainCorrectionResult> {
  const { requests, submitMutation } = options;

  if (requests.length === 0) {
    throw new Error('No changes to save');
  }

  let profileHeadRevision = options.profileHeadRevision;
  let userContext: UserContextV1 | null = null;

  for (const request of requests) {
    const result = await submitSingleWithRevisionRetry(request, profileHeadRevision, submitMutation);
    userContext = result.userContext;
    profileHeadRevision = result.revision;
  }

  if (!userContext) {
    throw new Error('Correction did not return updated situation');
  }

  return { userContext, profileHeadRevision };
}
