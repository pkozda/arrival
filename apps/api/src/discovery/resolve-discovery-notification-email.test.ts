import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  clearDiscoveryNotificationEmailOverrides,
  isDiscoveryNotificationEmailConfigured,
  resolveDiscoveryNotificationEmail,
  setDiscoveryNotificationEmailForUser,
} from './resolve-discovery-notification-email.js';
import {
  getDiscoveryUserNotificationEmailStore,
  resetDiscoveryUserNotificationEmailStoreForTests,
} from './user-notification-email-runtime.js';

describe('resolveDiscoveryNotificationEmail (E13.3.2)', () => {
  const dirs: string[] = [];
  let previousNotificationEmail: string | undefined;
  let previousStateDir: string | undefined;

  let previousMultiUser: string | undefined;

  beforeEach(() => {
    resetDiscoveryUserNotificationEmailStoreForTests();
    clearDiscoveryNotificationEmailOverrides();
    previousNotificationEmail = process.env.DISCOVERY_NOTIFICATION_EMAIL;
    previousStateDir = process.env.ARRIVAL_ATLAS_STATE_DIR;
    previousMultiUser = process.env.ARRIVAL_ATLAS_MULTI_USER;
    delete process.env.DISCOVERY_NOTIFICATION_EMAIL;
    delete process.env.ARRIVAL_ATLAS_MULTI_USER;

    const dir = mkdtempSync(path.join(tmpdir(), 'disc-email-resolve-'));
    dirs.push(dir);
    process.env.ARRIVAL_ATLAS_STATE_DIR = dir;
  });

  afterEach(() => {
    resetDiscoveryUserNotificationEmailStoreForTests();
    clearDiscoveryNotificationEmailOverrides();
    for (const dir of dirs.splice(0)) {
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
    if (previousNotificationEmail === undefined) {
      delete process.env.DISCOVERY_NOTIFICATION_EMAIL;
    } else {
      process.env.DISCOVERY_NOTIFICATION_EMAIL = previousNotificationEmail;
    }
    if (previousStateDir === undefined) {
      delete process.env.ARRIVAL_ATLAS_STATE_DIR;
    } else {
      process.env.ARRIVAL_ATLAS_STATE_DIR = previousStateDir;
    }
    if (previousMultiUser === undefined) {
      delete process.env.ARRIVAL_ATLAS_MULTI_USER;
    } else {
      process.env.ARRIVAL_ATLAS_MULTI_USER = previousMultiUser;
    }
  });

  it('returns null when nothing is configured', () => {
    expect(resolveDiscoveryNotificationEmail('user-1')).toBeNull();
    expect(isDiscoveryNotificationEmailConfigured('user-1')).toBe(false);
  });

  it('uses DISCOVERY_NOTIFICATION_EMAIL when no user email is set (single-tenant default)', () => {
    delete process.env.ARRIVAL_ATLAS_MULTI_USER;
    process.env.DISCOVERY_NOTIFICATION_EMAIL = 'env@example.com';
    expect(resolveDiscoveryNotificationEmail('user-1')).toBe('env@example.com');
    expect(isDiscoveryNotificationEmailConfigured('user-1')).toBe(true);
  });

  it('does not use shared env fallback when ARRIVAL_ATLAS_MULTI_USER is enabled', () => {
    process.env.ARRIVAL_ATLAS_MULTI_USER = 'true';
    process.env.DISCOVERY_NOTIFICATION_EMAIL = 'shared@example.com';
    expect(resolveDiscoveryNotificationEmail('user-1')).toBeNull();
    expect(isDiscoveryNotificationEmailConfigured('user-1')).toBe(false);
  });

  it('still uses personal email when multi-user mode is enabled', () => {
    process.env.ARRIVAL_ATLAS_MULTI_USER = 'true';
    process.env.DISCOVERY_NOTIFICATION_EMAIL = 'shared@example.com';
    getDiscoveryUserNotificationEmailStore().setUserNotificationEmail(
      'user-1',
      'personal@example.com'
    );
    expect(resolveDiscoveryNotificationEmail('user-1')).toBe('personal@example.com');
  });

  it('prefers user-persisted email over env fallback', () => {
    process.env.DISCOVERY_NOTIFICATION_EMAIL = 'env@example.com';
    getDiscoveryUserNotificationEmailStore().setUserNotificationEmail(
      'user-1',
      'user@example.com'
    );
    expect(resolveDiscoveryNotificationEmail('user-1')).toBe('user@example.com');
  });

  it('prefers test override over user-persisted and env', () => {
    process.env.DISCOVERY_NOTIFICATION_EMAIL = 'env@example.com';
    getDiscoveryUserNotificationEmailStore().setUserNotificationEmail(
      'user-1',
      'user@example.com'
    );
    setDiscoveryNotificationEmailForUser('user-1', 'override@example.com');
    expect(resolveDiscoveryNotificationEmail('user-1')).toBe('override@example.com');
  });

  it('falls back to env after clearing persisted email', () => {
    process.env.DISCOVERY_NOTIFICATION_EMAIL = 'env@example.com';
    const store = getDiscoveryUserNotificationEmailStore();
    store.setUserNotificationEmail('user-1', 'user@example.com');
    store.clearUserNotificationEmail('user-1');
    expect(resolveDiscoveryNotificationEmail('user-1')).toBe('env@example.com');
  });

  it('survives store singleton recreation on the same state dir', () => {
    getDiscoveryUserNotificationEmailStore().setUserNotificationEmail(
      'user-1',
      'persist@example.com'
    );
    resetDiscoveryUserNotificationEmailStoreForTests();
    expect(resolveDiscoveryNotificationEmail('user-1')).toBe('persist@example.com');
  });

  it('trims persisted email without lowercasing via resolver', () => {
    getDiscoveryUserNotificationEmailStore().setUserNotificationEmail(
      'user-1',
      '  User@Example.com  '
    );
    expect(resolveDiscoveryNotificationEmail('user-1')).toBe('User@Example.com');
  });

  it('isolates persisted emails by userId in the resolver', () => {
    const store = getDiscoveryUserNotificationEmailStore();
    store.setUserNotificationEmail('user-a', 'a@example.com');
    store.setUserNotificationEmail('user-b', 'b@example.com');
    expect(resolveDiscoveryNotificationEmail('user-a')).toBe('a@example.com');
    expect(resolveDiscoveryNotificationEmail('user-b')).toBe('b@example.com');
  });
});
