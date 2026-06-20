import type { ConfidenceLevel, MutationEvent, ProfileDomain } from '@arrival-atlas/product-contract';
import { getFieldDefinition, isPersistentFactFieldId } from '@arrival-atlas/product-contract';
import type { ExecutionMetadata, MirrorSectionDefinition } from './types.js';
import { profileHasDomainData, sectionHasData } from './types.js';

const STALE_MS = 90 * 24 * 60 * 60 * 1000;

type DomainSignals = {
  moduleSourceCount: number;
  profileCorrectionCount: number;
  hasFollowUpModuleAfterCorrection: boolean;
  hasConflictingFieldUpdates: boolean;
  isStale: boolean;
  latestAt: number | null;
};

function eventTouchesDomain(event: MutationEvent, domains: ProfileDomain[]): boolean {
  if (event.domain && domains.includes(event.domain)) {
    return true;
  }

  return event.fieldDeltas.some((delta) => {
    if (!isPersistentFactFieldId(delta.fieldId)) {
      return false;
    }
    return domains.includes(getFieldDefinition(delta.fieldId).domain);
  });
}

function collectDomainSignals(
  domains: ProfileDomain[],
  events: readonly MutationEvent[],
  executionMeta: ExecutionMetadata | undefined,
  moduleIds: string[],
  nowMs: number
): DomainSignals {
  const moduleSources = new Set<string>();
  let profileCorrectionCount = 0;
  let latestCorrectionAt: number | null = null;
  let latestAt: number | null = null;
  const fieldWriters = new Map<string, Set<string>>();

  for (const event of events) {
    if (!eventTouchesDomain(event, domains)) {
      continue;
    }

    const committedMs = Date.parse(event.committedAt);
    if (!Number.isNaN(committedMs)) {
      latestAt = latestAt === null ? committedMs : Math.max(latestAt, committedMs);
    }

    if (event.source.kind === 'module') {
      moduleSources.add(event.source.moduleId);
    }

    if (event.source.kind === 'profile_ui' && event.type === 'fact.correct') {
      profileCorrectionCount += 1;
      if (!Number.isNaN(committedMs)) {
        latestCorrectionAt = committedMs;
      }
    }

    for (const delta of event.fieldDeltas) {
      const writers = fieldWriters.get(delta.fieldId) ?? new Set<string>();
      writers.add(event.source.kind === 'module' ? `module:${event.source.moduleId}` : event.source.kind);
      fieldWriters.set(delta.fieldId, writers);
    }
  }

  if (executionMeta) {
    for (const moduleId of moduleIds) {
      const history = executionMeta.executionsByModuleId[moduleId] ?? [];
      for (const entry of history) {
        moduleSources.add(moduleId);
        const ts = Date.parse(entry.createdAt);
        if (!Number.isNaN(ts)) {
          latestAt = latestAt === null ? ts : Math.max(latestAt, ts);
        }
      }
    }
  }

  let hasFollowUpModuleAfterCorrection = false;
  if (latestCorrectionAt !== null && executionMeta) {
    for (const moduleId of moduleIds) {
      for (const entry of executionMeta.executionsByModuleId[moduleId] ?? []) {
        const ts = Date.parse(entry.createdAt);
        if (!Number.isNaN(ts) && ts > latestCorrectionAt) {
          hasFollowUpModuleAfterCorrection = true;
        }
      }
    }
  }

  const hasConflictingFieldUpdates = [...fieldWriters.values()].some((writers) => writers.size > 1);

  const isStale = latestAt !== null && nowMs - latestAt > STALE_MS;

  return {
    moduleSourceCount: moduleSources.size,
    profileCorrectionCount,
    hasFollowUpModuleAfterCorrection,
    hasConflictingFieldUpdates,
    isStale,
    latestAt,
  };
}

export function resolveDomainConfidence(
  section: MirrorSectionDefinition,
  profile: Parameters<typeof profileHasDomainData>[0],
  events: readonly MutationEvent[],
  executionMeta: ExecutionMetadata | undefined,
  nowMs: number
): { level: ConfidenceLevel; reasons: string[] } {
  if (!sectionHasData(profile, section)) {
    return {
      level: 'none',
      reasons: ['No information saved in this area yet'],
    };
  }

  const signals = collectDomainSignals(section.domains, events, executionMeta, section.moduleIds, nowMs);
  const independentSources =
    signals.moduleSourceCount + (signals.profileCorrectionCount > 0 ? 1 : 0);

  if (
    independentSources >= 2 ||
    (signals.profileCorrectionCount > 0 && signals.hasFollowUpModuleAfterCorrection)
  ) {
    return {
      level: 'high',
      reasons: ['Confirmed from more than one source'],
    };
  }

  if (signals.hasConflictingFieldUpdates || signals.isStale) {
    return {
      level: 'low',
      reasons: signals.isStale
        ? ['Information may be outdated']
        : ['Information may need review'],
    };
  }

  const hasPartialWorkIncome =
    section.mirrorSlug === 'work-income' &&
    profile &&
    ((profileHasDomainData(profile, 'employment') && !profileHasDomainData(profile, 'income')) ||
      (!profileHasDomainData(profile, 'employment') && profileHasDomainData(profile, 'income')));

  if (hasPartialWorkIncome) {
    return {
      level: 'low',
      reasons: ['Only part of your work and income details are saved'],
    };
  }

  if (signals.moduleSourceCount === 1 || signals.profileCorrectionCount === 1) {
    return {
      level: 'medium',
      reasons: ['Based on a single update so far'],
    };
  }

  return {
    level: 'medium',
    reasons: ['Based on your saved situation'],
  };
}

export function resolveGlobalConfidence(
  levels: ConfidenceLevel[]
): 'high' | 'medium' | 'low' {
  const populated = levels.filter((level) => level !== 'none');
  if (populated.length === 0) {
    return 'low';
  }

  if (populated.every((level) => level === 'high')) {
    return 'high';
  }

  if (populated.some((level) => level === 'low')) {
    return 'low';
  }

  return 'medium';
}
