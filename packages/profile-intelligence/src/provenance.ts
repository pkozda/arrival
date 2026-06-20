import type { MutationEvent, ProfileDomain, UserProfileViewV1 } from '@arrival-atlas/product-contract';
import type { ExecutionMetadata, MirrorSectionDefinition } from './types.js';
import { sectionHasData } from './types.js';

function formatMonthYear(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return 'a previous session';
  }

  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function latestModuleExecution(
  section: MirrorSectionDefinition,
  executionMeta: ExecutionMetadata | undefined
): { moduleTitle: string; createdAt: string } | null {
  if (!executionMeta) {
    return null;
  }

  let latest: { moduleTitle: string; createdAt: string; ts: number } | null = null;

  for (const moduleId of section.moduleIds) {
    for (const entry of executionMeta.executionsByModuleId[moduleId] ?? []) {
      const ts = Date.parse(entry.createdAt);
      if (Number.isNaN(ts)) {
        continue;
      }

      if (!latest || ts >= latest.ts) {
        latest = {
          moduleTitle: entry.moduleTitle ?? moduleId,
          createdAt: entry.createdAt,
          ts,
        };
      }
    }
  }

  return latest ? { moduleTitle: latest.moduleTitle, createdAt: latest.createdAt } : null;
}

function latestProfileCorrection(
  domains: ProfileDomain[],
  events: readonly MutationEvent[]
): MutationEvent | null {
  let latest: MutationEvent | null = null;

  for (const event of events) {
    if (event.source.kind !== 'profile_ui') {
      continue;
    }

    if (event.domain && domains.includes(event.domain)) {
      if (!latest || event.sequence > latest.sequence) {
        latest = event;
      }
    }
  }

  return latest;
}

export function buildProvenanceNarrative(
  section: MirrorSectionDefinition,
  profile: UserProfileViewV1 | null | undefined,
  events: readonly MutationEvent[],
  executionMeta: ExecutionMetadata | undefined
): string | undefined {
  if (!sectionHasData(profile, section)) {
    return undefined;
  }

  const profileCorrection = latestProfileCorrection(section.domains, events);
  const moduleExecution = latestModuleExecution(section, executionMeta);

  if (profileCorrection && moduleExecution) {
    const profileTs = Date.parse(profileCorrection.committedAt);
    const moduleTs = Date.parse(moduleExecution.createdAt);

    if (!Number.isNaN(profileTs) && !Number.isNaN(moduleTs) && profileTs >= moduleTs) {
      return 'You updated this in Your situation.';
    }

    return `We know this because you used ${moduleExecution.moduleTitle} in ${formatMonthYear(moduleExecution.createdAt)}.`;
  }

  if (profileCorrection) {
    return 'You updated this in Your situation.';
  }

  if (moduleExecution) {
    return `We know this because you used ${moduleExecution.moduleTitle} in ${formatMonthYear(moduleExecution.createdAt)}.`;
  }

  return 'Based on your previous module usage.';
}
