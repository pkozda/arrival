import type { ProfileMutationCommitErrorCode } from './apply-profile-mutation.js';

export class ProfileMutationCommitError extends Error {
  readonly code: ProfileMutationCommitErrorCode;
  readonly issues?: Array<{ code: string; message: string; fieldId?: string }>;

  constructor(
    code: ProfileMutationCommitErrorCode,
    message: string,
    issues?: Array<{ code: string; message: string; fieldId?: string }>
  ) {
    super(message);
    this.name = 'ProfileMutationCommitError';
    this.code = code;
    this.issues = issues;
  }
}

export type MutationApiErrorBody = {
  success: false;
  code: string;
  error: string;
  issues?: Array<{ code: string; message: string; fieldId?: string }>;
};

export function mapProfileMutationErrorToHttp(
  code: ProfileMutationCommitErrorCode,
  message: string,
  issues?: Array<{ code: string; message: string; fieldId?: string }>
): { statusCode: number; body: MutationApiErrorBody } {
  if (code === 'REVISION_CONFLICT') {
    return {
      statusCode: 409,
      body: { success: false, code: 'REVISION_CONFLICT', error: message },
    };
  }

  if (code === 'VALIDATION_FAILED') {
    const scenarioBlocked = issues?.some((issue) => issue.code === 'SCENARIO_FIELD_IN_PAYLOAD');
    return {
      statusCode: scenarioBlocked ? 422 : 400,
      body: {
        success: false,
        code: scenarioBlocked ? 'FIELD_BLOCKED' : 'INVALID_MUTATION',
        error: message,
        ...(issues ? { issues } : {}),
      },
    };
  }

  if (code === 'INVALID_REQUEST') {
    return {
      statusCode: 400,
      body: { success: false, code: 'INVALID_MUTATION', error: message },
    };
  }

  return {
    statusCode: 500,
    body: { success: false, code: 'INTERNAL_REDUCER_ERROR', error: message },
  };
}
