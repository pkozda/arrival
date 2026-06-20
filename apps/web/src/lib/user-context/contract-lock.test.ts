import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

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

function relativePath(filePath: string): string {
  return relative(webSrcRoot, filePath);
}

describe('P1 contract lock (web boundary enforcement)', () => {
  it('does not read snapshot.userContext or uiSnapshot.userContext for domain logic', () => {
    const violations: string[] = [];
    const forbidden = ['snapshot.userContext', 'uiSnapshot.userContext'];

    for (const filePath of listSourceFiles(webSrcRoot)) {
      const source = readFileSync(filePath, 'utf8');
      for (const pattern of forbidden) {
        if (source.includes(pattern)) {
          violations.push(`${relativePath(filePath)}: ${pattern}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('does not request legacy snapshot contract from web source', () => {
    const violations: string[] = [];
    const forbidden = ["snapshotVersion=legacy", "snapshotVersion === 'legacy'", 'snapshotVersion: "legacy"'];

    for (const filePath of listSourceFiles(webSrcRoot)) {
      const source = readFileSync(filePath, 'utf8');
      for (const pattern of forbidden) {
        if (source.includes(pattern)) {
          violations.push(`${relativePath(filePath)}: ${pattern}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('allows userContext.profile access only in selectors.ts', () => {
    const violations: string[] = [];
    const allowedFile = join(webSrcRoot, 'lib/user-context/selectors.ts');

    for (const filePath of listSourceFiles(webSrcRoot)) {
      if (filePath === allowedFile) {
        continue;
      }
      const source = readFileSync(filePath, 'utf8');
      if (source.includes('userContext?.profile') || source.includes('userContext.profile')) {
        violations.push(relativePath(filePath));
      }
    }

    expect(violations).toEqual([]);
  });

  it('does not merge or fallback between snapshot and userContext for profile reads', () => {
    const violations: string[] = [];
    const forbiddenPatterns = [
      'uiSnapshot ?? userContext',
      'userContext ?? uiSnapshot',
      'snapshot ?? userContext',
      'userContext ?? snapshot',
      'mergeUserContext',
      'mergeSnapshot',
    ];

    for (const filePath of listSourceFiles(webSrcRoot)) {
      const source = readFileSync(filePath, 'utf8');
      for (const pattern of forbiddenPatterns) {
        if (source.includes(pattern)) {
          violations.push(`${relativePath(filePath)}: ${pattern}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('routes situation reads through selectUserContextProfile in UI components', () => {
    const profileUiFiles = [
      join(webSrcRoot, 'components/home/HomeSnapshotRenderer.tsx'),
      join(webSrcRoot, 'components/profile/ProfileMirrorOverview.tsx'),
      join(webSrcRoot, 'components/profile/ProfileDomainDetail.tsx'),
      join(webSrcRoot, 'components/profile/DomainMutationEditor.tsx'),
      join(webSrcRoot, 'components/ContractModulePage.tsx'),
      join(webSrcRoot, 'lib/snapshot/useSnapshotReconstruction.ts'),
    ];

    for (const filePath of profileUiFiles) {
      const source = readFileSync(filePath, 'utf8');
      expect(source, relativePath(filePath)).toContain('selectUserContextProfile');
    }
  });
});
