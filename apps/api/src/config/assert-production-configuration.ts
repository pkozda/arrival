/**
 * E16 — Production configuration fail-closed helpers.
 * Do not invent secrets; refuse to start when production lacks mandatory auth config.
 */

export const DEV_AUTH_SECRET_FALLBACK = 'arrival-atlas-dev-auth-secret-change-in-production';

export type ProductionConfigIssue = {
  code: 'AUTH_SECRET_MISSING' | 'AUTH_SECRET_IS_DEV_FALLBACK' | 'OPS_TOKEN_MISSING';
  message: string;
};

/**
 * Validate auth-related env for production-like processes.
 * Compose already requires AUTH_SECRET + OPS_TOKEN; this catches bare `node dist` deploys.
 */
export function collectProductionConfigIssues(
  env: NodeJS.ProcessEnv = process.env
): ProductionConfigIssue[] {
  const issues: ProductionConfigIssue[] = [];
  const nodeEnv = env.NODE_ENV;
  if (nodeEnv !== 'production') {
    return issues;
  }

  const authSecret = env.ARRIVAL_ATLAS_AUTH_SECRET?.trim();
  if (!authSecret) {
    issues.push({
      code: 'AUTH_SECRET_MISSING',
      message:
        'ARRIVAL_ATLAS_AUTH_SECRET is required when NODE_ENV=production (refusing insecure default)',
    });
  } else if (authSecret === DEV_AUTH_SECRET_FALLBACK) {
    issues.push({
      code: 'AUTH_SECRET_IS_DEV_FALLBACK',
      message:
        'ARRIVAL_ATLAS_AUTH_SECRET must not equal the development fallback when NODE_ENV=production',
    });
  }

  const opsToken = env.ARRIVAL_ATLAS_OPS_TOKEN?.trim();
  if (!opsToken) {
    issues.push({
      code: 'OPS_TOKEN_MISSING',
      message:
        'ARRIVAL_ATLAS_OPS_TOKEN is required when NODE_ENV=production (ops endpoints must not be ambiguously configured)',
    });
  }

  return issues;
}

export function assertProductionConfiguration(env: NodeJS.ProcessEnv = process.env): void {
  const issues = collectProductionConfigIssues(env);
  if (issues.length === 0) {
    return;
  }
  const detail = issues.map((issue) => `- ${issue.code}: ${issue.message}`).join('\n');
  throw new Error(`Production configuration invalid:\n${detail}`);
}
