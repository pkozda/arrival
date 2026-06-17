import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { RouteSecurityRule } from './route-security.js';
import { RouteSecurityMap } from './route-security-map.js';

const SRC_ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');

const ROUTE_SCAN_ROOTS = ['routes', 'build-app.ts'];

const FORBIDDEN_ROUTE_PATTERNS = [
  /request\.auth\b/,
  /request\.accountContext\b/,
];

const PIPELINE_ORDER_MARKERS = [
  'resolveActiveRouteRule',
  "activeRule.tier === 'public' || activeRule.tier === 'anonymous-create'",
  'buildAuthContext',
  'buildResolvedIdentity',
  'emitIdentityObservabilityEvents',
  'assertSessionNotRevoked',
  'enforceTokenAccountIdentity',
  'evaluateRouteAccess(request.identity, activeRule)',
  'applyAccountAuthorization',
  'applySessionLifecycle',
] as const;

function collectSourceFiles(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const absolutePath = join(dir, entry);
    const stats = statSync(absolutePath);

    if (stats.isDirectory()) {
      collectSourceFiles(absolutePath, files);
      continue;
    }

    if (entry.endsWith('.ts') && !entry.endsWith('.test.ts')) {
      files.push(absolutePath);
    }
  }

  return files;
}

function collectRouteProductionFiles(): string[] {
  const files: string[] = [];

  for (const root of ROUTE_SCAN_ROOTS) {
    const absolutePath = join(SRC_ROOT, root);
    const stats = statSync(absolutePath);

    if (stats.isFile()) {
      files.push(absolutePath);
      continue;
    }

    collectSourceFiles(absolutePath, files);
  }

  return files;
}

function readSource(relativePath: string): string {
  return readFileSync(join(SRC_ROOT, relativePath), 'utf8');
}

describe('IAM contract finalization', () => {
  it('route handlers do not read request.auth or request.accountContext', () => {
    const violations: string[] = [];

    for (const filePath of collectRouteProductionFiles()) {
      const relativePath = relative(SRC_ROOT, filePath);
      const contents = readFileSync(filePath, 'utf8');
      const lines = contents.split('\n');

      for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index]!;
        for (const pattern of FORBIDDEN_ROUTE_PATTERNS) {
          if (pattern.test(line)) {
            violations.push(`${relativePath}:${index + 1}: ${line.trim()}`);
          }
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('applySecurityPipeline does not attach request.auth or request.accountContext', () => {
    const pipelineSource = readSource('routing/apply-route-security.ts');
    const forbiddenAssignments = [
      /request\.auth\s*=/,
      /request\.accountContext\s*=/,
    ];

    const violations = forbiddenAssignments.filter((pattern) => pattern.test(pipelineSource));
    expect(violations).toEqual([]);
  });

  it('RouteSecurityMap is frozen and rejects runtime mutation', () => {
    expect(Object.isFrozen(RouteSecurityMap)).toBe(true);
    for (const entry of RouteSecurityMap) {
      expect(Object.isFrozen(entry)).toBe(true);
    }

    expect(() => {
      (RouteSecurityMap as unknown as RouteSecurityRule[]).push({
        method: 'GET',
        path: '/api/ghost',
        tier: 'public',
      });
    }).toThrow();

    expect(() => {
      (RouteSecurityMap[0] as RouteSecurityRule).tier = 'public';
    }).toThrow();
  });

  it('applySecurityPipeline preserves IAM stage ordering invariants', () => {
    const pipelineSource = readSource('routing/apply-route-security.ts');
    const applySecurityPipelineStart = pipelineSource.indexOf(
      'export async function applySecurityPipeline'
    );
    expect(applySecurityPipelineStart).toBeGreaterThanOrEqual(0);

    const applySecurityPipelineSource = pipelineSource.slice(applySecurityPipelineStart);
    const applySecurityPipelineEnd = applySecurityPipelineSource.indexOf('\nexport function wrapRouteWithSecurity');
    const pipelineBody =
      applySecurityPipelineEnd >= 0
        ? applySecurityPipelineSource.slice(0, applySecurityPipelineEnd)
        : applySecurityPipelineSource;

    let previousIndex = -1;
    for (const marker of PIPELINE_ORDER_MARKERS) {
      const markerIndex = pipelineBody.indexOf(marker);
      expect(markerIndex).toBeGreaterThan(previousIndex);
      previousIndex = markerIndex;
    }
  });

  it('legacy session credential parsing is isolated to legacy-auth-adapter', () => {
    const adapterSource = readSource('auth/legacy-auth-adapter.ts');
    expect(adapterSource).toContain("request.headers['x-session-id']");

    const authContextSource = readSource('auth/auth.context.ts');
    expect(authContextSource).not.toContain("request.headers['x-session-id']");
    expect(authContextSource).toContain('extractLegacySessionId');

    const pipelineSource = readSource('routing/apply-route-security.ts');
    expect(pipelineSource).not.toContain("request.headers['x-session-id']");
    expect(pipelineSource).toContain('hasLegacySessionCredential');
  });

  it('IAM observability emissions use emitIAMEvent with IAMEventType enum', () => {
    const pipelineSource = readSource('routing/apply-route-security.ts');
    expect(pipelineSource).not.toMatch(/request\.log\.warn\(\{\s*\n?\s*iamEvent:/);
    expect(pipelineSource).toContain('emitIAMEvent(request.log, IAMEventType.REGISTRY_BACKFILL');
  });
});
