import { resolveExecutionResult } from '@arrivalos/module-runtime';
import type { ContractSnapshotStore } from '@arrivalos/product-contract';
import { buildExplanationView } from '@arrivalos/product-contract';
import type { SystemStateCoordinator } from './state/system-state-coordinator.js';
import { getStoredModuleExecution } from './state/system-state-apply.js';

export async function buildModuleExplanationResponse(params: {
  sessionId: string;
  moduleId: string;
  executionId: string;
  coordinator: SystemStateCoordinator;
  contractStore: ContractSnapshotStore;
}): Promise<
  | { ok: true; view: ReturnType<typeof buildExplanationView> }
  | { ok: false; statusCode: 404; error: string }
> {
  const state = await params.coordinator.getState(params.sessionId);
  if (!state) {
    return {
      ok: false,
      statusCode: 404,
      error: 'Session not found',
    };
  }

  const stored = getStoredModuleExecution(state, params.moduleId, params.executionId);
  if (!stored) {
    return {
      ok: false,
      statusCode: 404,
      error: 'Execution not found for this session and module',
    };
  }

  const sealedModuleResult = resolveExecutionResult(stored);
  const contractSnapshot = params.contractStore.getContractSnapshot(params.moduleId) ?? undefined;

  return {
    ok: true,
    view: buildExplanationView(sealedModuleResult, params.executionId, contractSnapshot),
  };
}
