import type { DiscoveryResult } from '../types/result.js';
import type { ResultState, ResultStateActor } from '../types/state.js';
import type { ResultStore } from './result-store.js';
import type { ResultWriter } from './result-writer.js';
import { validateResultStateTransition } from './result-state-transition.js';
import { ResultStoreError } from './result-store.js';
import { ResultWriterError } from './result-writer.js';

export class ResultStateWriterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ResultStateWriterError';
  }
}

export type ResultStateTransitionRequest = {
  profileId: string;
  resultId: string;
  to: ResultState;
  actor: ResultStateActor;
  at: string;
};

/**
 * User-facing Result state transitions (E7.2).
 * Storage-neutral — SQLite adapter composes ResultStore + ResultWriter.
 */
export interface ResultStateWriter {
  transitionUserState(
    request: ResultStateTransitionRequest
  ): Promise<DiscoveryResult>;
}

export type CreateResultStateWriterDeps = {
  store: ResultStore;
  writer: ResultWriter;
};

export function createResultStateWriter(
  deps: CreateResultStateWriterDeps
): ResultStateWriter {
  return {
    async transitionUserState(request) {
      const existing = await deps.store.getById(request.profileId, request.resultId);
      if (!existing) {
        throw new ResultStateWriterError(`Result not found: ${request.resultId}`);
      }

      const validation = validateResultStateTransition({
        from: existing.userState,
        to: request.to,
        actor: request.actor,
      });
      if (!validation.ok) {
        throw new ResultStateWriterError(validation.reason);
      }

      if (existing.userState === request.to) {
        return structuredClone(existing);
      }

      const updated: DiscoveryResult = {
        ...structuredClone(existing),
        userState: request.to,
      };

      try {
        return await deps.writer.update(updated);
      } catch (err) {
        if (err instanceof ResultWriterError) {
          throw new ResultStateWriterError(err.message);
        }
        throw err;
      }
    },
  };
}

/** Batch NOTIFIED transition after successful digest delivery (idempotent). */
export async function transitionResultsToNotified(input: {
  writer: ResultStateWriter;
  profileId: string;
  resultIds: readonly string[];
  at: string;
}): Promise<void> {
  for (const resultId of input.resultIds) {
    try {
      await input.writer.transitionUserState({
        profileId: input.profileId,
        resultId,
        to: 'NOTIFIED',
        actor: 'notification',
        at: input.at,
      });
    } catch (err) {
      if (
        err instanceof ResultStateWriterError &&
        err.message === 'EXPIRED_STATE_IMMUTABLE'
      ) {
        continue;
      }
      if (existingIsAlreadyNotified(err)) {
        continue;
      }
      throw err;
    }
  }
}

function existingIsAlreadyNotified(err: unknown): boolean {
  return (
    err instanceof ResultStateWriterError &&
    err.message.includes('NOTIFICATION_CANNOT_SET')
  );
}

export function mapResultStateStoreError(err: unknown): never {
  if (err instanceof ResultStateWriterError) throw err;
  if (err instanceof ResultStoreError) {
    throw new ResultStateWriterError(err.message);
  }
  throw new ResultStateWriterError('Result state transition failed');
}
