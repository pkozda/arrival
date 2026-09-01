/**
 * Startup / configuration failure model for PDE runtime (E5.1).
 * Distinct from pipeline DiscoveryRunStatus and adapter execution failures.
 * Never put secrets in messages.
 */

export class DiscoveryConfigurationError extends Error {
  readonly issues: readonly string[];

  constructor(message: string, issues: readonly string[] = []) {
    super(message);
    this.name = 'DiscoveryConfigurationError';
    this.issues = issues;
  }
}

/**
 * Runtime failed while constructing owned resources after config validation.
 */
export class DiscoveryRuntimeConstructionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DiscoveryRuntimeConstructionError';
  }
}

/**
 * Runtime API invoked after close().
 */
export class DiscoveryRuntimeClosedError extends Error {
  constructor(message = 'Discovery runtime is closed') {
    super(message);
    this.name = 'DiscoveryRuntimeClosedError';
  }
}
