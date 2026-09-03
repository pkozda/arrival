import type { DiscoveryRunDiagnostics } from '@arrival-atlas/discovery';
import { getDiscoveryExecutionService } from './discovery-execution-runtime.js';
import {
  getDiscoveryPersistence,
  resolveDiscoveryUserId,
} from './discovery-user-runtime.js';

/**
 * Operator run diagnostics (E11.2): ownership enforced via profile.userId.
 * Returns null for unknown runs or runs owned by another account (404 at HTTP layer).
 */
export async function getDiscoveryOpsRunDiagnostics(input: {
  sessionId: string;
  accountId: string | null;
  runId: string;
}): Promise<DiscoveryRunDiagnostics | null> {
  const userId = resolveDiscoveryUserId({
    sessionId: input.sessionId,
    accountId: input.accountId,
  });
  const discoveryService = getDiscoveryExecutionService();
  await discoveryService.start();

  const run = await discoveryService.getRun(input.runId);
  if (!run) {
    return null;
  }

  const { profileStore } = getDiscoveryPersistence();
  const profile = await profileStore.get(run.profileId);
  if (!profile || profile.userId !== userId) {
    return null;
  }

  return discoveryService.getRunDiagnostics(input.runId);
}
