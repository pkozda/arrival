import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createSqliteUserNotificationEmailStore } from './sqlite-user-notification-email-store.js';

describe('sqlite-user-notification-email-store (E13.3.2)', () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const dir of dirs) {
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
  });

  function openStore(dir?: string) {
    const root = dir ?? mkdtempSync(path.join(tmpdir(), 'disc-notif-email-'));
    if (!dir) dirs.push(root);
    const databasePath = path.join(root, 'discovery.sqlite');
    return {
      root,
      databasePath,
      store: createSqliteUserNotificationEmailStore({ databasePath }),
    };
  }

  it('sets and retrieves a notification email', () => {
    const { store } = openStore();
    expect(store.getUserNotificationEmail('user-a')).toBeNull();
    store.setUserNotificationEmail('user-a', 'a@example.com');
    expect(store.getUserNotificationEmail('user-a')).toBe('a@example.com');
    store.close();
  });

  it('updates an existing email', () => {
    const { store } = openStore();
    store.setUserNotificationEmail('user-a', 'first@example.com');
    store.setUserNotificationEmail('user-a', 'second@example.com');
    expect(store.getUserNotificationEmail('user-a')).toBe('second@example.com');
    store.close();
  });

  it('clears an email', () => {
    const { store } = openStore();
    store.setUserNotificationEmail('user-a', 'a@example.com');
    store.clearUserNotificationEmail('user-a');
    expect(store.getUserNotificationEmail('user-a')).toBeNull();
    store.close();
  });

  it('isolates emails by userId', () => {
    const { store } = openStore();
    store.setUserNotificationEmail('user-a', 'a@example.com');
    store.setUserNotificationEmail('user-b', 'b@example.com');
    expect(store.getUserNotificationEmail('user-a')).toBe('a@example.com');
    expect(store.getUserNotificationEmail('user-b')).toBe('b@example.com');
    store.clearUserNotificationEmail('user-a');
    expect(store.getUserNotificationEmail('user-a')).toBeNull();
    expect(store.getUserNotificationEmail('user-b')).toBe('b@example.com');
    store.close();
  });

  it('trims surrounding whitespace without lowercasing', () => {
    const { store } = openStore();
    store.setUserNotificationEmail('user-a', '  User@Example.com  ');
    expect(store.getUserNotificationEmail('user-a')).toBe('User@Example.com');
    store.close();
  });

  it('persists across store recreation on the same database path', () => {
    const { root, databasePath, store } = openStore();
    store.setUserNotificationEmail('user-a', 'persist@example.com');
    store.close();

    const reopened = createSqliteUserNotificationEmailStore({ databasePath });
    expect(reopened.getUserNotificationEmail('user-a')).toBe('persist@example.com');
    reopened.close();
    void root;
  });
});
