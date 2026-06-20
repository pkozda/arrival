import type { ProfileInsightViewV1 } from '@arrival-atlas/product-contract';
import { resolveDomainConfidence, resolveGlobalConfidence } from './confidence.js';
import {
  buildAdvisorySuggestions,
  buildMissingContextHints,
} from './missing-context.js';
import { buildProvenanceNarrative } from './provenance.js';
import type { InterpretProfileInsightsInput } from './types.js';
import { MIRROR_SECTIONS, sectionHasData } from './types.js';

export function interpretProfileInsights(input: InterpretProfileInsightsInput): ProfileInsightViewV1 {
  const profile = input.userContext.profile ?? null;
  const events = input.mutationEvents ?? [];
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const nowMs = Date.parse(generatedAt);

  const domainInsights = MIRROR_SECTIONS.map((section) => {
    const hasData = sectionHasData(profile, section);
    const confidence = resolveDomainConfidence(
      section,
      profile,
      events,
      input.executionMeta,
      nowMs
    );

    return {
      domain: section.primaryDomain,
      mirrorSlug: section.mirrorSlug,
      confidence,
      provenanceNarrative: buildProvenanceNarrative(section, profile, events, input.executionMeta),
      suggestions: buildAdvisorySuggestions(section, hasData, confidence.level),
    };
  });

  const globalConfidence = resolveGlobalConfidence(domainInsights.map((insight) => insight.confidence.level));

  return {
    schemaVersion: '1.0.0',
    generatedAt,
    globalConfidence,
    missingContext: buildMissingContextHints(profile),
    domainInsights,
  };
}
