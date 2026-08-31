import type { StageDiagnostic, StageId } from '../pipeline/types.js';
import { stageDiagnostic } from '../pipeline/diagnostics.js';
import type { AdapterFailure, AdapterFailureCode } from './types.js';
import { adapterFailureReasonCode } from './errors.js';

/**
 * Adapter lifecycle diagnostic — reuses StageDiagnostic; no second system.
 * Sensitive fields (secrets, headers, payloads) must never be placed in message.
 */
export type AdapterLifecycleOutcome =
  | 'start'
  | 'success'
  | 'failure'
  | 'timeout'
  | 'cancelled';

export type AdapterLifecycleInput = {
  runId: string;
  stage: StageId;
  adapter: string;
  operation: string;
  startedAtMs: number;
  outcome: AdapterLifecycleOutcome;
  failureCode?: AdapterFailureCode;
  message?: string;
  candidateId?: string;
  attempt?: number;
};

const SENSITIVE_HINT =
  /(authorization|cookie|set-cookie|api[_-]?key|password|secret|bearer\s+)/i;

/**
 * Strip / reject messages that appear to contain credentials.
 * Returns a safe fallback rather than leaking.
 */
export function sanitizeAdapterDiagnosticMessage(message: string | undefined): string | undefined {
  if (message === undefined) return undefined;
  if (SENSITIVE_HINT.test(message)) {
    return '[redacted: sensitive adapter diagnostic content]';
  }
  return message;
}

export function adapterLifecycleDiagnostic(input: AdapterLifecycleInput): StageDiagnostic {
  const reasonCode =
    input.outcome === 'success' || input.outcome === 'start'
      ? undefined
      : input.failureCode
        ? adapterFailureReasonCode(input.failureCode)
        : input.outcome === 'timeout'
          ? 'ADAPTER_TIMEOUT'
          : input.outcome === 'cancelled'
            ? 'ADAPTER_CANCELLED'
            : 'ADAPTER_UNKNOWN';

  const outcome: StageDiagnostic['outcome'] =
    input.outcome === 'success' || input.outcome === 'start'
      ? 'ok'
      : 'error';

  return stageDiagnostic({
    runId: input.runId,
    stage: input.stage,
    candidateId: input.candidateId,
    startedAtMs: input.startedAtMs,
    outcome,
    reasonCode,
    adapter: input.adapter,
    operation: input.operation,
    attempt: input.attempt,
    message: sanitizeAdapterDiagnosticMessage(
      input.message ??
        `${input.adapter}.${input.operation} ${input.outcome}${
          input.failureCode ? ` (${input.failureCode})` : ''
        }`
    ),
  });
}

export function adapterFailureDiagnostic(
  input: Omit<AdapterLifecycleInput, 'outcome' | 'failureCode'> & {
    failure: AdapterFailure;
  }
): StageDiagnostic {
  const outcome: AdapterLifecycleOutcome =
    input.failure.code === 'TIMEOUT'
      ? 'timeout'
      : input.failure.code === 'CANCELLED'
        ? 'cancelled'
        : 'failure';
  return adapterLifecycleDiagnostic({
    ...input,
    outcome,
    failureCode: input.failure.code,
    message: input.message ?? input.failure.message,
  });
}
