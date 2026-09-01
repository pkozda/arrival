/**
 * Application-layer errors for DiscoveryService (E6.1).
 * Distinct from runtime construction/config errors.
 * Never put secrets in messages.
 */

export class DiscoveryServiceStoppedError extends Error {
  constructor(message = 'Discovery service is stopped') {
    super(message);
    this.name = 'DiscoveryServiceStoppedError';
  }
}

export class DiscoveryServiceNotStartedError extends Error {
  constructor(message = 'Discovery service is not started') {
    super(message);
    this.name = 'DiscoveryServiceNotStartedError';
  }
}

export class DiscoveryServiceStartupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DiscoveryServiceStartupError';
  }
}
