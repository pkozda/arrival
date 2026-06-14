export class ProfileRevisionConflictError extends Error {
  readonly code = 'PROFILE_REVISION_CONFLICT';
  readonly expectedRevision: number;
  readonly actualRevision: number;

  constructor(expectedRevision: number, actualRevision: number) {
    super(
      `Profile revision conflict: expected ${expectedRevision}, actual ${actualRevision}`
    );
    this.name = 'ProfileRevisionConflictError';
    this.expectedRevision = expectedRevision;
    this.actualRevision = actualRevision;
  }
}

export class ProfileNotFoundError extends Error {
  readonly code = 'PROFILE_NOT_FOUND';

  constructor(profileId: string) {
    super(`Profile not found: ${profileId}`);
    this.name = 'ProfileNotFoundError';
  }
}
