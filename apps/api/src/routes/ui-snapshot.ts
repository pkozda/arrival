import type { FastifyInstance, FastifyRequest } from 'fastify';
import { getSession, globalRegistry, type SupportedLanguage } from '@arrivalos/core';
import type { ProfileDocument } from '@arrivalos/profile';
import { profileEngine } from '../profile-runtime.js';
import { listModuleExecutionsForSession } from '../module-execution-store.js';
import { getSnapshotVersionState } from '../snapshot-version-store.js';
import {
  buildUxSnapshot,
  isUxSource,
  type UxModuleOutput,
} from '../ux-integration.js';

export type UiSnapshot = {
  snapshotVersion: number;
  lastMutationId: string | null;
  generatedAt: string;
  session: {
    sessionId: string;
    language: string;
  };
  profile: ProfileDocument | null;
  modules: Array<{
    id: string;
    name: string;
    description?: string;
  }>;
  executions: Array<{
    moduleId: string;
    result: unknown;
    timestamp: number;
    executionId: string;
    snapshotVersion: number;
  }>;
  uxSnapshot: {
    actionCards: unknown[];
    prioritySignals: unknown[];
    attentionLayer: unknown[];
  };
  ftu: {
    isFirstTimeUser: boolean;
    step?: number;
  };
};

type SessionFtuMeta = {
  completed?: boolean;
  lastStep?: number;
};

function getSessionId(request: FastifyRequest): string | undefined {
  const header = request.headers['x-session-id'];
  return typeof header === 'string' && header.length > 0 ? header : undefined;
}

function resolveLanguage(
  sessionLanguage: SupportedLanguage | undefined,
  profile: ProfileDocument | null
): string {
  return sessionLanguage ?? profile?.preferredLanguage ?? 'en';
}

function readSessionFtuMeta(context: Record<string, unknown>): SessionFtuMeta | undefined {
  const direct = context.ftu;
  if (direct && typeof direct === 'object') {
    return direct as SessionFtuMeta;
  }

  const systemState = context.systemState;
  if (systemState && typeof systemState === 'object') {
    const nested = (systemState as Record<string, unknown>).ftu;
    if (nested && typeof nested === 'object') {
      return nested as SessionFtuMeta;
    }
  }

  return undefined;
}

function resolveFtuState(
  context: Record<string, unknown>,
  profile: ProfileDocument | null,
  executionCount: number
): UiSnapshot['ftu'] {
  const meta = readSessionFtuMeta(context);

  if (meta?.completed === true) {
    return { isFirstTimeUser: false };
  }

  if (typeof meta?.lastStep === 'number' && meta.lastStep >= 1 && meta.lastStep <= 3) {
    return { isFirstTimeUser: true, step: meta.lastStep };
  }

  if (!profile && executionCount === 0) {
    return { isFirstTimeUser: true, step: 1 };
  }

  return { isFirstTimeUser: false };
}

function collectUxModuleOutputs(
  executions: Array<{ moduleId: string; result: unknown }>
): UxModuleOutput[] {
  return executions
    .filter((entry) => isUxSource(entry.moduleId))
    .map((entry) => ({
      domain: entry.moduleId as UxModuleOutput['domain'],
      result: entry.result,
    }));
}

export async function buildUiSnapshot(sessionId: string): Promise<UiSnapshot | null> {
  const session = getSession(sessionId);
  if (!session) {
    return null;
  }

  let profile: ProfileDocument | null = null;

  try {
    const profileRecord = await profileEngine.getProfileBySession(sessionId);
    profile = profileRecord?.document ?? null;
  } catch {
    profile = null;
  }

  const executions = listModuleExecutionsForSession(sessionId).map((entry) => ({
    moduleId: entry.moduleId,
    result: entry.result,
    timestamp: entry.timestamp,
    executionId: entry.executionId,
    snapshotVersion: entry.snapshotVersion,
  }));

  const modules = globalRegistry.list().map((module) => ({
    id: module.id,
    name: module.name,
    ...(module.description ? { description: module.description } : {}),
  }));

  const uxSnapshot = buildUxSnapshot(collectUxModuleOutputs(executions));

  const sessionContext = session.context as Record<string, unknown>;
  const userProfile = session.context.userProfile;

  const versionState = getSnapshotVersionState(sessionId);

  return {
    snapshotVersion: versionState.snapshotVersion,
    lastMutationId: versionState.lastMutationId,
    generatedAt: new Date().toISOString(),
    session: {
      sessionId: session.id,
      language: resolveLanguage(userProfile?.language, profile),
    },
    profile,
    modules,
    executions,
    uxSnapshot,
    ftu: resolveFtuState(sessionContext, profile, executions.length),
  };
}

export async function registerUiSnapshotRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/ui-snapshot', async (request, reply) => {
    const sessionId = getSessionId(request);
    if (!sessionId) {
      return reply.status(400).send({ error: 'X-Session-Id header is required' });
    }

    try {
      const snapshot = await buildUiSnapshot(sessionId);
      if (!snapshot) {
        return reply.status(404).send({ error: 'Session not found' });
      }

      return snapshot;
    } catch {
      return reply.status(200).send({
        snapshotVersion: 0,
        lastMutationId: null,
        generatedAt: new Date().toISOString(),
        session: {
          sessionId,
          language: 'en',
        },
        profile: null,
        modules: globalRegistry.list().map((module) => ({
          id: module.id,
          name: module.name,
          ...(module.description ? { description: module.description } : {}),
        })),
        executions: [],
        uxSnapshot: {
          actionCards: [],
          prioritySignals: [],
          attentionLayer: [],
        },
        ftu: {
          isFirstTimeUser: true,
          step: 1,
        },
      } satisfies UiSnapshot);
    }
  });
}
