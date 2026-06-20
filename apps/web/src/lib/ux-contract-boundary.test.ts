import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const webSrcRoot = join(__dirname, '..');

const UI_COMPONENT_DIRS = [
  join(webSrcRoot, 'components'),
  join(webSrcRoot, 'app'),
];

const FORBIDDEN_UI_STRINGS = [
  'RecordFields',
  'Attention layer',
  'Priority signals',
  'First-time user',
  'Failed to load snapshot',
  'Failed to refresh snapshot',
  'Unable to load module schema',
  'Execution failed',
] as const;

const FORBIDDEN_USER_COPY_STRINGS = [
  'your profile',
  'the profile',
  'session language',
  'module schema',
] as const;

function listUiSourceFiles(): string[] {
  const files: string[] = [];

  for (const directory of UI_COMPONENT_DIRS) {
    for (const entry of readdirSync(directory, { withFileTypes: true, recursive: true })) {
      if (!entry.isFile()) {
        continue;
      }
      if (!entry.name.endsWith('.tsx')) {
        continue;
      }
      files.push(join(entry.parentPath ?? directory, entry.name));
    }
  }

  return files;
}

function quotedUserCopy(source: string): string {
  const literals: string[] = [];
  const patterns = [
    /'([^'\\]|\\.)*'/g,
    /"([^"\\]|\\.)*"/g,
    /`([^`\\]|\\.)*`/g,
  ];

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      literals.push(match[0].slice(1, -1).toLowerCase());
    }
  }

  return literals.join('\n');
}

describe('UX Contract v1 boundary (Phase 3B)', () => {
  it('forbids debug structures and internal identifiers in UI components', () => {
    const violations: string[] = [];

    for (const filePath of listUiSourceFiles()) {
      const source = readFileSync(filePath, 'utf8');
      for (const pattern of FORBIDDEN_UI_STRINGS) {
        if (source.includes(pattern)) {
          violations.push(`${filePath}: ${pattern}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('forbids banned user-facing vocabulary in UI copy literals', () => {
    const violations: string[] = [];

    for (const filePath of listUiSourceFiles()) {
      const copy = quotedUserCopy(readFileSync(filePath, 'utf8'));
      for (const phrase of FORBIDDEN_USER_COPY_STRINGS) {
        if (copy.includes(phrase)) {
          violations.push(`${filePath}: ${phrase}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('requires profile mirror route and home situation link', () => {
    const headerSource = readFileSync(join(webSrcRoot, 'components/Header.tsx'), 'utf8');
    const homeCardSource = readFileSync(
      join(webSrcRoot, 'components/home/YourSituationSummaryCard.tsx'),
      'utf8'
    );

    expect(headerSource).toContain('Your situation');
    expect(headerSource).toContain('/profile');
    expect(homeCardSource).toContain('View your situation');
  });
});
