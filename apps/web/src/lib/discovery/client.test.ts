import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('E9.2 discovery web client boundary', () => {
  it('calls discovery module API only', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/lib/discovery/client.ts'),
      'utf8'
    );
    expect(source).toContain('/api/modules/discovery');
    expect(source).toContain("'/profiles'");
    expect(source).toContain("'/notification-email'");
    expect(source).not.toContain('/user/profiles');
    expect(source).not.toContain('/schedules');
    expect(source).not.toContain('/worker/');
  });
});
