import type { RouteSecurityRule } from './route-security.js';

export type RegisteredRouteRef = {
  method: string;
  path: string;
};

export class UndeclaredRouteSecurityError extends Error {
  readonly code = 'UNDECLARED_ROUTE_SECURITY';

  constructor(message: string) {
    super(message);
    this.name = 'UndeclaredRouteSecurityError';
  }
}

function routeContractKey(method: string, path: string): string {
  return `${method.toUpperCase()} ${path}`;
}

export function validateRouteSecurityMap(
  map: readonly RouteSecurityRule[],
  registeredRoutes: RegisteredRouteRef[]
): void {
  const seenRules = new Set<string>();
  for (const rule of map) {
    const key = routeContractKey(rule.method, rule.path);
    if (seenRules.has(key)) {
      throw new UndeclaredRouteSecurityError(
        `UNDECLARED_ROUTE_SECURITY: duplicate map entry ${key}`
      );
    }
    seenRules.add(key);
  }

  const mapKeys = new Set(map.map((rule) => routeContractKey(rule.method, rule.path)));
  const registeredKeys = new Set(
    registeredRoutes.map((route) => routeContractKey(route.method, route.path))
  );

  const missingFromMap = [...registeredKeys].filter((key) => !mapKeys.has(key));
  const missingFromApp = [...mapKeys].filter((key) => !registeredKeys.has(key));

  if (missingFromMap.length > 0 || missingFromApp.length > 0) {
    throw new UndeclaredRouteSecurityError(
      `UNDECLARED_ROUTE_SECURITY: unmapped=${missingFromMap.join(', ') || 'none'}; orphan-map=${missingFromApp.join(', ') || 'none'}`
    );
  }
}

// One map entry per secured Fastify route — validated at bootstrap via validateRouteSecurityMap().
const ROUTE_SECURITY_MAP_SOURCE: RouteSecurityRule[] = [
  {
    method: 'GET',
    path: '/health',
    tier: 'public',
    description: 'Health check',
  },
  {
    method: 'GET',
    path: '/api/health/governance',
    tier: 'account-required',
    description: 'Governance health (ops-only)',
  },
  {
    method: 'GET',
    path: '/api/health/modules',
    tier: 'account-required',
    description: 'Module health summary (ops-only)',
  },
  {
    method: 'GET',
    path: '/api/modules',
    tier: 'public',
    description: 'Module catalog',
  },
  {
    method: 'GET',
    path: '/api/modules/:id',
    tier: 'public',
    description: 'Module metadata',
  },
  {
    method: 'GET',
    path: '/api/modules/:id/schema',
    tier: 'public',
    description: 'Module input/output JSON schema',
  },
  {
    method: 'GET',
    path: '/api/modules/:id/capabilities',
    tier: 'public',
    description: 'Module normalized capabilities',
  },
  {
    method: 'GET',
    path: '/api/i18n/languages',
    tier: 'public',
    description: 'Supported languages',
  },
  {
    method: 'GET',
    path: '/api/i18n/:lang',
    tier: 'public',
    description: 'Language translations',
  },
  {
    method: 'POST',
    path: '/api/sessions',
    tier: 'anonymous-create',
    description: 'Create anonymous session and issue token',
  },
  {
    method: 'GET',
    path: '/api/sessions/:id',
    tier: 'credential-required',
    description: 'Read session context',
  },
  {
    method: 'PATCH',
    path: '/api/sessions/:id',
    tier: 'credential-required',
    description: 'Patch session context',
  },
  {
    method: 'GET',
    path: '/api/events',
    tier: 'credential-required',
    description: 'Session-scoped event stream',
  },
  {
    method: 'GET',
    path: '/api/modules/:id/trace',
    tier: 'credential-required',
    description: 'Diagnostic execution trace',
  },
  {
    method: 'GET',
    path: '/api/modules/:id/explain',
    tier: 'credential-required',
    description: 'Product explainability view for a stored execution',
  },
  {
    method: 'POST',
    path: '/api/modules/:id/execute',
    tier: 'credential-required',
    description: 'Execute module against session state',
  },
  {
    method: 'GET',
    path: '/api/user-context',
    tier: 'credential-required',
    description: 'UI-safe profile projection (UserContextV1)',
  },
  {
    method: 'POST',
    path: '/api/mutations',
    tier: 'credential-required',
    description: 'Commit typed profile mutation request',
  },
  {
    method: 'GET',
    path: '/api/profile-insights',
    tier: 'credential-required',
    description: 'Derived profile interpretation (ProfileInsightViewV1)',
  },
  {
    method: 'GET',
    path: '/api/modules/life-event/plan',
    tier: 'credential-required',
    description: 'Deterministic life event plan (LifeEventPlanV1)',
  },
  {
    method: 'GET',
    path: '/api/modules/economic-reality/plan',
    tier: 'credential-required',
    description: 'Deterministic economic reality plan (EP-1 through EP-6)',
  },
  {
    method: 'POST',
    path: '/api/modules/economic-reality/action/execute',
    tier: 'credential-required',
    description: 'Execute economic reality action against current deterministic action set',
  },
  {
    method: 'POST',
    path: '/api/modules/economic-reality/events',
    tier: 'credential-required',
    description: 'Emit economic reality interaction events for feedback loop (EP-12)',
  },
  {
    method: 'GET',
    path: '/api/ui-snapshot',
    tier: 'credential-required',
    description: 'UI snapshot projection',
  },
  {
    method: 'POST',
    path: '/api/profile',
    tier: 'credential-required',
    description: 'Create profile',
  },
  {
    method: 'GET',
    path: '/api/profile',
    tier: 'credential-required',
    description: 'Read profile',
  },
  {
    method: 'PATCH',
    path: '/api/profile',
    tier: 'credential-required',
    description: 'Update profile',
  },
  {
    method: 'GET',
    path: '/api/profile/revisions',
    tier: 'credential-required',
    description: 'Profile revision history',
  },
  {
    method: 'POST',
    path: '/api/account/claim',
    tier: 'credential-required',
    description: 'Claim session to account',
  },
  {
    method: 'GET',
    path: '/api/accounts/:id/sessions',
    tier: 'account-required',
    description: 'List account sessions',
  },
  {
    method: 'POST',
    path: '/api/accounts/:id/sessions',
    tier: 'account-required',
    description: 'Create linked session for account',
  },
  {
    method: 'POST',
    path: '/api/accounts/:id/sessions/revoke-all',
    tier: 'account-required',
    description: 'Revoke all account sessions',
  },
  {
    method: 'POST',
    path: '/api/sessions/:id/revoke',
    tier: 'account-required',
    description: 'Revoke single session',
  },
  {
    method: 'POST',
    path: '/api/dev/reset-user-data',
    tier: 'credential-required',
    description: 'Dev-only: delete current session persisted state',
  },
  {
    method: 'POST',
    path: '/api/dev/reset-all-state',
    tier: 'credential-required',
    description: 'Dev-only: wipe local persisted state store',
  },
  {
    method: 'GET',
    path: '/api/dev/demo/presets',
    tier: 'credential-required',
    description: 'Dev-only: list life-event demo presets',
  },
  {
    method: 'POST',
    path: '/api/dev/demo/load-preset',
    tier: 'credential-required',
    description: 'Dev-only: seed session with life-event demo persona',
  },
  {
    method: 'GET',
    path: '/api/benefits/max',
    tier: 'credential-required',
    description: 'MBDE: ranked benefit opportunities for current profile',
  },
  {
    method: 'POST',
    path: '/api/benefits/recompute',
    tier: 'credential-required',
    description: 'MBDE: force recompute benefit opportunities',
  },
  {
    method: 'GET',
    path: '/api/benefits/clusters',
    tier: 'credential-required',
    description: 'MBDE: hidden/stackable benefit clusters',
  },
  {
    method: 'GET',
    path: '/api/benefits/impact-summary',
    tier: 'credential-required',
    description: 'MBDE: aggregate expected value summary',
  },
  {
    method: 'GET',
    path: '/api/benefits/admin/nodes',
    tier: 'credential-required',
    description: 'MBDE admin: list benefit graph nodes',
  },
  {
    method: 'PATCH',
    path: '/api/benefits/admin/nodes/:id',
    tier: 'credential-required',
    description: 'MBDE admin: update benefit node',
  },
  {
    method: 'POST',
    path: '/api/benefits/admin/nodes',
    tier: 'credential-required',
    description: 'MBDE admin: create benefit node',
  },
  {
    method: 'POST',
    path: '/api/benefits/admin/nodes/:id/deprecate',
    tier: 'credential-required',
    description: 'MBDE admin: mark benefit node deprecated',
  },
  {
    method: 'POST',
    path: '/api/benefits/admin/ingest',
    tier: 'credential-required',
    description: 'MBDE admin: ingest raw benefit documents',
  },
  {
    method: 'GET',
    path: '/api/modules/discovery/notification-email',
    tier: 'credential-required',
    description: 'Discovery: get current user notification email',
  },
  {
    method: 'PATCH',
    path: '/api/modules/discovery/notification-email',
    tier: 'credential-required',
    description: 'Discovery: set or clear current user notification email',
  },
  {
    method: 'GET',
    path: '/api/modules/discovery/profiles',
    tier: 'credential-required',
    description: 'Discovery: list user profiles',
  },
  {
    method: 'POST',
    path: '/api/modules/discovery/profiles',
    tier: 'credential-required',
    description: 'Discovery: create profile',
  },
  {
    method: 'GET',
    path: '/api/modules/discovery/profiles/:profileId',
    tier: 'credential-required',
    description: 'Discovery: get profile',
  },
  {
    method: 'PATCH',
    path: '/api/modules/discovery/profiles/:profileId',
    tier: 'credential-required',
    description: 'Discovery: update profile',
  },
  {
    method: 'POST',
    path: '/api/modules/discovery/profiles/:profileId/enable',
    tier: 'credential-required',
    description: 'Discovery: enable profile',
  },
  {
    method: 'POST',
    path: '/api/modules/discovery/profiles/:profileId/disable',
    tier: 'credential-required',
    description: 'Discovery: disable profile',
  },
  {
    method: 'GET',
    path: '/api/modules/discovery/profiles/:profileId/results',
    tier: 'credential-required',
    description: 'Discovery: list profile results',
  },
  {
    method: 'GET',
    path: '/api/modules/discovery/profiles/:profileId/results/:resultId',
    tier: 'credential-required',
    description: 'Discovery: get result detail',
  },
  {
    method: 'PATCH',
    path: '/api/modules/discovery/profiles/:profileId/results/:resultId/user-state',
    tier: 'credential-required',
    description: 'Discovery: update result user state',
  },
  {
    method: 'GET',
    path: '/api/modules/discovery/profiles/:profileId/run-summary',
    tier: 'credential-required',
    description: 'Discovery: latest run summary',
  },
  {
    method: 'POST',
    path: '/api/modules/discovery/profiles/:profileId/run-now',
    tier: 'credential-required',
    description: 'Discovery: trigger manual run for profile',
  },
  {
    method: 'POST',
    path: '/api/dev/discovery/seed-fixture',
    tier: 'credential-required',
    description: 'Dev-only: seed discovery E2E fixture',
  },
  {
    method: 'GET',
    path: '/api/ops/discovery/health',
    tier: 'ops-token-required',
    description: 'Ops: Discovery runtime health snapshot (E5.6 getHealth) — host-global',
  },
  {
    method: 'GET',
    path: '/api/ops/discovery/runs/:runId/diagnostics',
    tier: 'account-required',
    description: 'Ops: Discovery run diagnostic summary (E11.2)',
  },
  {
    method: 'POST',
    path: '/api/ops/discovery/trigger-due-runs',
    tier: 'ops-token-required',
    description:
      'Ops: pull-driven Discovery scheduler tick (triggerDueRuns + worker drain) — host-global',
  },
];

export const RouteSecurityMap: readonly RouteSecurityRule[] = Object.freeze(
  ROUTE_SECURITY_MAP_SOURCE.map((entry) => Object.freeze({ ...entry }))
);

export function requireRouteSecurityRule(method: string, path: string): RouteSecurityRule {
  const normalizedMethod = method.toUpperCase();
  const rule = RouteSecurityMap.find(
    (entry) =>
      entry.method.toUpperCase() === normalizedMethod && entry.path === path
  );

  if (!rule) {
    throw new UndeclaredRouteSecurityError(
      `UNDECLARED_ROUTE_SECURITY: missing map entry for ${normalizedMethod} ${path}`
    );
  }

  return rule;
}
