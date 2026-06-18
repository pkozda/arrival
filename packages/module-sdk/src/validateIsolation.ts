import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export type IsolationViolation = {
  filePath: string;
  rule: string;
  detail: string;
};

const FORBIDDEN_IMPORT_PATTERNS: Array<{ rule: string; pattern: RegExp }> = [
  {
    rule: 'governance-kernel-import',
    pattern: /@arrivalos\/module-runtime(?:\/governance|\b).*GovernedModuleRegistry/,
  },
  {
    rule: 'governance-kernel-import',
    pattern: /from ['"]@arrivalos\/module-runtime['"];?/,
  },
  {
    rule: 'registry-import',
    pattern: /\b(ModuleRegistry|globalRegistry|registerModule)\b.*from ['"]@arrivalos\/core['"]/,
  },
  {
    rule: 'registry-import',
    pattern: /from ['"]@arrivalos\/core['"].*(ModuleRegistry|globalRegistry)/,
  },
];

const FORBIDDEN_SOURCE_PATTERNS: Array<{ rule: string; pattern: RegExp }> = [
  {
    rule: 'cross-module-execute',
    pattern: /\.execute\(\s*['"][a-z0-9-]+['"]\s*,/,
  },
  {
    rule: 'cross-module-execute',
    pattern: /executeGovernedModule\(/,
  },
  {
    rule: 'cross-module-execute',
    pattern: /bootstrapGovernedRuntime\(/,
  },
  {
    rule: 'shared-runtime-mutation',
    pattern: /globalRegistry\./,
  },
];

const ALLOWLIST_SUFFIXES = ['catalog.ts', 'index.ts', 'merge-strategy.ts', 'module-contracts.ts'];

function listSourceFiles(directory: string): string[] {
  const entries = readdirSync(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...listSourceFiles(fullPath));
      continue;
    }

    if (
      entry.name.endsWith('.ts') &&
      !entry.name.endsWith('.test.ts') &&
      !ALLOWLIST_SUFFIXES.some((suffix) => entry.name.endsWith(suffix))
    ) {
      files.push(fullPath);
    }
  }

  return files;
}

export function validateModuleIsolation(sourceRoot: string): IsolationViolation[] {
  const violations: IsolationViolation[] = [];

  for (const filePath of listSourceFiles(sourceRoot)) {
    const source = readFileSync(filePath, 'utf8');

    for (const { rule, pattern } of FORBIDDEN_IMPORT_PATTERNS) {
      if (pattern.test(source)) {
        violations.push({
          filePath,
          rule,
          detail: pattern.source,
        });
      }
    }

    for (const { rule, pattern } of FORBIDDEN_SOURCE_PATTERNS) {
      if (pattern.test(source)) {
        violations.push({
          filePath,
          rule,
          detail: pattern.source,
        });
      }
    }
  }

  return violations;
}

export function assertModuleIsolation(sourceRoot: string): void {
  const violations = validateModuleIsolation(sourceRoot);
  if (violations.length === 0) {
    return;
  }

  const details = violations
    .map((violation) => `${violation.filePath} (${violation.rule})`)
    .join('; ');
  throw new Error(`Module isolation contract violated: ${details}`);
}
