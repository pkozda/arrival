import { ThemePreferenceSchema, type SupportedLanguage } from '@arrivalos/core';
import { getLegacyDomainResult } from '@arrivalos/module-runtime';
import type { ProfileDocument } from '@arrivalos/profile';
import { buildUXActionPlan, type UXSource } from '@arrivalos/ux';
import {
  buildUiSnapshotProjection,
  type ActionCard,
  type ExecutionSnapshot,
  type ModuleSnapshotSummary,
  type SnapshotRecommendation,
} from '@arrivalos/product-contract';
import {
  SnapshotProjectionError,
  UI_SNAPSHOT_SCHEMA_VERSION,
} from './snapshot-schema.js';
import type { AccountEntitlements } from '../entitlements/entitlement.types.js';
import { entitlementService } from '../entitlements/entitlement.service.js';
import type { SystemState, StoredModuleExecution } from './system-state-types.js';

const UX_SOURCES = new Set<UXSource>([
  'financial-reality',
  'healthcare-navigation',
  'system-translation',
  'benefits-simulator',
  'life-event',
  'grocery-optimization',
]);

export type LegacyUiSnapshotExecution = {
  moduleId: string;
  result: unknown;
  projection?: import('@arrivalos/product-contract').ModuleUIProjection;
  timestamp: number;
  executionId: string;
  snapshotVersion: number;
};

export type LegacyUiSnapshot = {
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
    access?: 'available' | 'locked' | 'premium-required';
  }>;
  executions: LegacyUiSnapshotExecution[];
  executionsByModuleId: Record<string, LegacyUiSnapshotExecution[]>;
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

export type UiSnapshot = {
  schemaVersion: number;
  snapshotVersion: number;
  lastMutationId: string | null;
  generatedAt: string;
  session: LegacyUiSnapshot['session'];
  profile: ProfileDocument | null;
  modules: LegacyUiSnapshot['modules'];
  executions: ExecutionSnapshot[];
  executionsByModuleId: Record<string, ExecutionSnapshot[]>;
  actionCards: ActionCard[];
  recommendations: SnapshotRecommendation[];
  summaries: ModuleSnapshotSummary[];
  ftu: LegacyUiSnapshot['ftu'];
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

function toSnapshotExecutionInput(entry: StoredModuleExecution) {
  return {
    moduleId: entry.moduleId,
    executionId: entry.executionId,
    timestamp: entry.timestamp,
    ...(entry.projection !== undefined ? { projection: entry.projection } : {}),
  };
}

function toLegacySnapshotExecution(entry: StoredModuleExecution): LegacyUiSnapshotExecution {
  return {
    moduleId: entry.moduleId,
    result: getLegacyDomainResult(entry),
    ...(entry.projection !== undefined ? { projection: entry.projection } : {}),
    timestamp: entry.timestamp,
    executionId: entry.executionId,
    snapshotVersion: entry.snapshotVersion,
  };
}

function buildLegacyUxSnapshotFromState(
  state: SystemState,
  latestExecutions: LegacyUiSnapshotExecution[]
): LegacyUiSnapshot['uxSnapshot'] {
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

function buildSnapshotMetadata(
  state: SystemState,
  options?: { entitlements?: AccountEntitlements | null }
) {
  const userProfile = state.session.context.userProfile;
  const profile = state.profileRecord?.document ?? null;
  const entitlements =
    state.accountId !== null
      ? (options?.entitlements ?? null)
      : null;

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
    modules: state.modules.map((module) => {
      const access = entitlementService.resolveModuleAccess(
        entitlements,
        module.id,
        state.accountId
      );
      return {
        id: module.id,
        name: module.name,
        ...(module.description ? { description: module.description } : {}),
        ...(access ? { access } : {}),
      };
    }),
  };
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
 * Pure projection: UiSnapshot is fully determined by SystemState,
 * with optional entitlement context for module access metadata.
 */
export function buildUiSnapshot(
  state: SystemState,
  options?: { entitlements?: AccountEntitlements | null }
): UiSnapshot {
  validateSystemStateForProjection(state);

  const metadata = buildSnapshotMetadata(state, options);
  const executionInputs = Object.values(state.executionsByModuleId).flatMap((history) =>
    history.map(toSnapshotExecutionInput)
  );

  const executionsByModuleId = Object.fromEntries(
    Object.entries(state.executionsByModuleId).map(([moduleId, history]) => [
      moduleId,
      buildUiSnapshotProjection(history.map(toSnapshotExecutionInput)).executions,
    ])
  ) as Record<string, ExecutionSnapshot[]>;

  const latestExecutions = Object.values(executionsByModuleId)
    .map((history) => history[history.length - 1])
    .filter((entry): entry is ExecutionSnapshot => entry !== undefined)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));

  const projectionPayload = buildUiSnapshotProjection(executionInputs);

  return {
    ...metadata,
    executions: latestExecutions,
    executionsByModuleId,
    actionCards: projectionPayload.actionCards,
    recommendations: projectionPayload.recommendations,
    summaries: projectionPayload.summaries,
    ftu: resolveFtuState(
      state.session.context as Record<string, unknown>,
      metadata.profile,
      latestExecutions.length
    ),
  };
}

export function buildLegacyUiSnapshot(
  state: SystemState,
  options?: { entitlements?: AccountEntitlements | null }
): LegacyUiSnapshot {
  validateSystemStateForProjection(state);

  const metadata = buildSnapshotMetadata(state, options);
  const executionsByModuleId = Object.fromEntries(
    Object.entries(state.executionsByModuleId).map(([moduleId, history]) => [
      moduleId,
      history.map(toLegacySnapshotExecution),
    ])
  ) as Record<string, LegacyUiSnapshotExecution[]>;

  const executions = Object.values(executionsByModuleId)
    .map((history) => history[history.length - 1])
    .filter((entry): entry is LegacyUiSnapshotExecution => entry !== undefined)
    .sort((left, right) => left.timestamp - right.timestamp);

  const uxSnapshot = buildLegacyUxSnapshotFromState(state, executions);

  return {
    ...metadata,
    executions,
    executionsByModuleId,
    uxSnapshot,
    ftu: resolveFtuState(
      state.session.context as Record<string, unknown>,
      metadata.profile,
      executions.length
    ),
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
