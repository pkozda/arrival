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

describe('profile insights boundary (P4)', () => {
  it('web profile-insights client does not call mutation API', () => {
    const clientSource = readFileSync(join(__dirname, 'client.ts'), 'utf8');
    expect(clientSource).toContain('/api/profile-insights');
    expect(clientSource).not.toContain('/api/mutations');
  });

  it('web source does not import profile-engine reducer paths', () => {
    const violations: string[] = [];
    const forbidden = ['reduceProfileEvents', 'MutationEventLog', 'profileMutationEvents'];

    for (const filePath of listSourceFiles(webSrcRoot)) {
      const source = readFileSync(filePath, 'utf8');
      for (const pattern of forbidden) {
        if (source.includes(pattern)) {
          violations.push(`${filePath}: ${pattern}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
