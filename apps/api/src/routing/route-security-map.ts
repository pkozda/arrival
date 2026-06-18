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
