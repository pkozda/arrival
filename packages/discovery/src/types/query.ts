/**
 * Adapter-neutral search intent produced by Strategy.buildQueries().
 *
 * E1 Decision 3: no vendor SDK types, HTTP requests, or provider response shapes.
 * Search adapters map DiscoveryQuery → provider calls outside this package.
 */

export type DiscoveryQueryIntent =
  | 'web_search'
  | 'site_search'
  | 'catalog_lookup'
  | 'other';

export type DiscoveryQueryGeography = {
  countryCode?: string;
  region?: string;
  city?: string;
  radiusKm?: number;
};

export type DiscoveryQuery = {
  /** Stable id within a Run for observability */
  id: string;
  intent: DiscoveryQueryIntent;
  /** Primary free-text search intent */
  text: string;
  locale?: string;
  geography?: DiscoveryQueryGeography;
  /**
   * Structured constraints (role, tech, free-entry, …).
   * Values must be JSON-serializable primitives — never Request/Response/SDK objects.
   */
  constraints?: Record<string, string | number | boolean | null>;
  /** Lower runs earlier when adapters support prioritization */
  priority?: number;
  /** Strategy bookkeeping only (not vendor routing) */
  metadata?: Record<string, string>;
};
