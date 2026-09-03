/**
 * Explicit discovery search provider selection (E12.3a).
 * Default remains Brave. Tavily is opt-in for temporary validation only.
 * No automatic fallback between providers.
 */

export const DISCOVERY_SEARCH_PROVIDERS = ['brave', 'tavily'] as const;

export type DiscoverySearchProviderId =
  (typeof DISCOVERY_SEARCH_PROVIDERS)[number];

/**
 * Resolve provider from env/config string.
 * Invalid values fail closed (throw) — never silently fall back.
 */
export function resolveDiscoverySearchProvider(
  value: string | undefined | null
): DiscoverySearchProviderId {
  const normalized = (value ?? '').trim().toLowerCase();
  if (!normalized) {
    return 'brave';
  }
  if (normalized === 'brave' || normalized === 'tavily') {
    return normalized;
  }
  throw new Error(
    `Invalid DISCOVERY_SEARCH_PROVIDER="${value}". Expected "brave" | "tavily".`
  );
}
