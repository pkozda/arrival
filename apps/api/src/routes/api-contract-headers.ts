/** Response headers clarifying read-model authority for P1 contract lock. */

export const USER_CONTEXT_AUTHORITY_HEADERS = {
  'x-user-context-authority': 'authoritative',
  'x-read-model': 'UserContextV1',
} as const;

export const UI_SNAPSHOT_TRANSPORT_HEADERS = {
  'x-snapshot-layer': 'execution-ui-transport',
  'x-user-context-authority': 'derived-non-authoritative',
  'x-read-model': 'UiSnapshot',
} as const;

export const LEGACY_SNAPSHOT_CONTRACT_HEADERS = {
  ...UI_SNAPSHOT_TRANSPORT_HEADERS,
  'x-snapshot-contract': 'legacy-compatibility-only',
} as const;

export const PROFILE_INSIGHTS_AUTHORITY_HEADERS = {
  'x-profile-insights-authority': 'derived-non-authoritative',
  'x-read-model': 'ProfileInsightViewV1',
} as const;

export const LIFE_EVENT_PLAN_AUTHORITY_HEADERS = {
  'x-module-id': 'life-event',
  'x-module-version': 'v2',
  'x-read-model': 'LifeEventPlanV1',
  'x-plan-authority': 'derived-deterministic',
} as const;

export const ECONOMIC_REALITY_PLAN_AUTHORITY_HEADERS = {
  'x-module-id': 'economic-reality',
  'x-module-version': 'v1',
  'x-read-model': 'EconomicRealityPlanResponseV1',
  'x-plan-authority': 'derived-deterministic',
  'x-pipeline-version': 'ep1-ep6-v1',
} as const;

export function applyUserContextAuthorityHeaders(
  reply: { header: (name: string, value: string) => void }
): void {
  for (const [name, value] of Object.entries(USER_CONTEXT_AUTHORITY_HEADERS)) {
    reply.header(name, value);
  }
}

export function applyUiSnapshotTransportHeaders(
  reply: { header: (name: string, value: string) => void },
  options?: { legacy?: boolean }
): void {
  const headers = options?.legacy
    ? LEGACY_SNAPSHOT_CONTRACT_HEADERS
    : UI_SNAPSHOT_TRANSPORT_HEADERS;

  for (const [name, value] of Object.entries(headers)) {
    reply.header(name, value);
  }
}

export function applyProfileInsightsAuthorityHeaders(
  reply: { header: (name: string, value: string) => void }
): void {
  for (const [name, value] of Object.entries(PROFILE_INSIGHTS_AUTHORITY_HEADERS)) {
    reply.header(name, value);
  }
}

export function applyLifeEventPlanAuthorityHeaders(
  reply: { header: (name: string, value: string) => void }
): void {
  for (const [name, value] of Object.entries(LIFE_EVENT_PLAN_AUTHORITY_HEADERS)) {
    reply.header(name, value);
  }
}

export function applyEconomicRealityPlanAuthorityHeaders(
  reply: { header: (name: string, value: string) => void }
): void {
  for (const [name, value] of Object.entries(ECONOMIC_REALITY_PLAN_AUTHORITY_HEADERS)) {
    reply.header(name, value);
  }
}
