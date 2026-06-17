import { ThemePreferenceSchema, type SupportedLanguage } from '@arrivalos/core';
import type { ProfileDocument } from '@arrivalos/profile';
import { buildUXActionPlan, type UXSource } from '@arrivalos/ux';
import {
  SnapshotProjectionError,
  UI_SNAPSHOT_SCHEMA_VERSION,
} from './snapshot-schema.js';
import type { SystemState, StoredModuleExecution } from './system-state-types.js';

const UX_SOURCES = new Set<UXSource>([
  'financial-reality',
  'healthcare-navigation',
  'system-translation',
  'benefits-simulator',
  'life-event',
  'grocery-optimization',
]);

export type UiSnapshotExecution = {
  moduleId: string;
  result: unknown;
  timestamp: number;
  executionId: string;
  snapshotVersion: number;
};

export type UiSnapshot = {
  schemaVersion: number;
  snapshotVersion: number;
  lastMutationId: string | null;
  generatedAt: string;
  session: {
    sessionId: string;
    language: string;
    uiPreferences: {
      theme: 'light' | 'dark' | 'system';
    };
  };
  profile: ProfileDocument | null;
  modules: Array<{
    id: string;
    name: string;
    description?: string;
  }>;
  executions: UiSnapshotExecution[];
  executionsByModuleId: Record<string, UiSnapshotExecution[]>;
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

export type UiSnapshotFallback = UiSnapshot & {
  fallback: {
    reason: string;
    code: 'PROJECTION_ERROR';
  };
};

type SessionFtuMeta = {
  completed?: boolean;
  lastStep?: number;
};

function resolveLanguage(sessionLanguage: SupportedLanguage | undefined): string {
  return sessionLanguage ?? 'en';
}

function resolveUiPreferences(
  userProfile: { uiPreferences?: { theme?: string } } | undefined
): UiSnapshot['session']['uiPreferences'] {
  const parsed = ThemePreferenceSchema.safeParse(userProfile?.uiPreferences?.theme);
  return { theme: parsed.success ? parsed.data : 'light' };
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

function toSnapshotExecution(entry: StoredModuleExecution): UiSnapshotExecution {
  return {
    moduleId: entry.moduleId,
    result: entry.result,
    timestamp: entry.timestamp,
    executionId: entry.executionId,
    snapshotVersion: entry.snapshotVersion,
  };
}

function buildUxSnapshotFromState(
  state: SystemState,
  latestExecutions: UiSnapshotExecution[]
): UiSnapshot['uxSnapshot'] {
  if (!state.projectionConfig.uxSnapshotEnabled) {
    return {
      actionCards: [],
      prioritySignals: [],
      attentionLayer: [],
    };
  }

  try {
    const moduleOutputs = latestExecutions
      .filter((entry) => UX_SOURCES.has(entry.moduleId as UXSource))
      .map((entry) => ({
        domain: entry.moduleId as UXSource,
        result: entry.result,
      }));

    const uxPlan = buildUXActionPlan(moduleOutputs);
    const attentionLayer = uxPlan.actions.filter((action) => action.priority === 'high').slice(0, 2);

    return {
      actionCards: uxPlan.actions,
      prioritySignals: uxPlan.signals,
      attentionLayer,
    };
  } catch {
    return {
      actionCards: [],
      prioritySignals: [],
      attentionLayer: [],
    };
  }
}

export function validateSystemStateForProjection(state: SystemState): void {
  if (!state.session?.id) {
    throw new SnapshotProjectionError('INVALID_SYSTEM_STATE', 'SystemState.session.id is required');
  }

  if (
    typeof state.version?.snapshotVersion !== 'number' ||
    state.version.snapshotVersion < 0
  ) {
    throw new SnapshotProjectionError(
      'INVALID_SYSTEM_STATE',
      'SystemState.version.snapshotVersion must be a non-negative number'
    );
  }
}

/**
 * Pure projection: UiSnapshot is fully determined by SystemState only.
 */
export function buildUiSnapshot(state: SystemState): UiSnapshot {
  validateSystemStateForProjection(state);

  const sessionContext = state.session.context as Record<string, unknown>;
  const userProfile = state.session.context.userProfile;
  const profile = state.profileRecord?.document ?? null;

  const executionsByModuleId = Object.fromEntries(
    Object.entries(state.executionsByModuleId).map(([moduleId, history]) => [
      moduleId,
      history.map(toSnapshotExecution),
    ])
  ) as Record<string, UiSnapshotExecution[]>;

  const executions = Object.values(executionsByModuleId)
    .map((history) => history[history.length - 1])
    .filter((entry): entry is UiSnapshotExecution => entry !== undefined)
    .sort((a, b) => a.timestamp - b.timestamp);

  const uxSnapshot = buildUxSnapshotFromState(state, executions);

  return {
    schemaVersion: UI_SNAPSHOT_SCHEMA_VERSION,
    snapshotVersion: state.version.snapshotVersion,
    lastMutationId: state.version.lastMutationId,
    generatedAt: state.generatedAt,
    session: {
      sessionId: state.session.id,
      language: resolveLanguage(userProfile?.language),
      uiPreferences: resolveUiPreferences(userProfile),
    },
    profile,
    modules: state.modules.map((module) => ({
      id: module.id,
      name: module.name,
      ...(module.description ? { description: module.description } : {}),
    })),
    executions,
    executionsByModuleId,
    uxSnapshot,
    ftu: resolveFtuState(sessionContext, profile, executions.length),
  };
}

export function buildFallbackUiSnapshot(
  state: SystemState,
  reason: string
): UiSnapshotFallback {
  return {
    ...buildUiSnapshot(state),
    fallback: {
      reason,
      code: 'PROJECTION_ERROR',
    },
  };
}
