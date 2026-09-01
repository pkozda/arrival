export class DiscoveryUserNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DiscoveryUserNotFoundError';
  }
}

export class DiscoveryUserForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DiscoveryUserForbiddenError';
  }
}

export class DiscoveryUserValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DiscoveryUserValidationError';
  }
}

export class DiscoveryUserConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DiscoveryUserConflictError';
  }
}
