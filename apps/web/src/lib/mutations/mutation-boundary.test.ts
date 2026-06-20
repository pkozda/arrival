import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const webSrcRoot = join(__dirname, '../..');

function listSourceFiles(directory: string): string[] {
  const files: string[] = [];

  for (const entry of readdirSync(directory, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile()) {
      continue;
    }
    if (!entry.name.endsWith('.ts') && !entry.name.endsWith('.tsx')) {
      continue;
    }
    if (entry.name.endsWith('.test.ts')) {
      continue;
    }
    files.push(join(entry.parentPath ?? directory, entry.name));
  }

  return files;
}

describe('mutation boundary (P1.4–P1.5 + P1 cleanup)', () => {
  it('does not call legacy PATCH /api/profile from web source', () => {
    const violations: string[] = [];

    for (const filePath of listSourceFiles(webSrcRoot)) {
      const source = readFileSync(filePath, 'utf8');
      if (source.includes('/api/profile') && !source.includes('/api/profile-insights')) {
        violations.push(filePath);
      }
    }

    expect(violations).toEqual([]);
  });

  it('does not read snapshot.profile as a business source', () => {
    const violations: string[] = [];

    for (const filePath of listSourceFiles(webSrcRoot)) {
      const source = readFileSync(filePath, 'utf8');
      if (source.includes('snapshot.profile') || source.includes('uiSnapshot.profile')) {
        violations.push(filePath);
      }
    }

    expect(violations).toEqual([]);
  });

  it('routes profile writes through /api/mutations client', () => {
    const clientSource = readFileSync(join(webSrcRoot, 'lib/mutations/client.ts'), 'utf8');
    expect(clientSource).toContain('/api/mutations');
    expect(clientSource).toContain('/api/user-context');
  });

  it('does not read snapshot.userContext as a business source', () => {
    const violations: string[] = [];

    for (const filePath of listSourceFiles(webSrcRoot)) {
      const source = readFileSync(filePath, 'utf8');
      if (source.includes('snapshot.userContext') || source.includes('uiSnapshot.userContext')) {
        violations.push(filePath);
      }
    }

    expect(violations).toEqual([]);
  });
});
