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
