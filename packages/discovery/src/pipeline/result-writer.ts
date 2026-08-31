import type { DiscoveryResult } from '../types/result.js';

/**
 * Write port for DiscoveryResults (E2.7).
 * Separated from read-only ResultStore (E2.6).
 */
export interface ResultWriter {
  create(result: DiscoveryResult): Promise<DiscoveryResult>;
  update(result: DiscoveryResult): Promise<DiscoveryResult>;
}

export class ResultWriterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ResultWriterError';
  }
}
