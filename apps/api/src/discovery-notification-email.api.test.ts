import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from './build-app.js';
import {
  resetDiscoveryExecutionForTests,
} from './discovery/discovery-execution-runtime.js';
import { resetDiscoveryRuntimeForTests } from './discovery/discovery-user-runtime.js';
import {
  clearDiscoveryNotificationEmailOverrides,
  resolveDiscoveryNotificationEmail,
  setDiscoveryNotificationEmailForUser,
} from './discovery/resolve-discovery-notification-email.js';
import { resolveDiscoveryUserId } from './discovery/discovery-user-runtime.js';

describe('Discovery notification email API (E13.3.3)', () => {
  const dirs: string[] = [];
  let previousNotificationEmail: string | undefined;

  beforeEach(() => {
    process.env.DISCOVERY_USE_SMOKE_TRANSPORT = 'true';
    resetDiscoveryRuntimeForTests();
    resetDiscoveryExecutionForTests();
    clearDiscoveryNotificationEmailOverrides();
    previousNotificationEmail = process.env.DISCOVERY_NOTIFICATION_EMAIL;
    delete process.env.DISCOVERY_NOTIFICATION_EMAIL;
  });

  afterEach(() => {
    for (const dir of dirs) {
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
    clearDiscoveryNotificationEmailOverrides();
    delete process.env.DISCOVERY_USE_SMOKE_TRANSPORT;
    if (previousNotificationEmail === undefined) {
      delete process.env.DISCOVERY_NOTIFICATION_EMAIL;
    } else {
      process.env.DISCOVERY_NOTIFICATION_EMAIL = previousNotificationEmail;
    }
  });

  async function startApp() {
    const dir = mkdtempSync(path.join(tmpdir(), 'discovery-email-api-'));
    dirs.push(dir);
    process.env.ARRIVAL_ATLAS_STATE_DIR = dir;
    return buildApp({ logger: false });
  }

  async function createSession(app: Awaited<ReturnType<typeof buildApp>>) {
    const sessionRes = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      payload: { context: { userProfile: { language: 'en' } } },
    });
    expect(sessionRes.statusCode).toBe(200);
    return (sessionRes.json() as { sessionId: string }).sessionId;
  }

  it('GET returns null when no user email is configured', async () => {
    const app = await startApp();
    const sessionId = await createSession(app);

    const res = await app.inject({
      method: 'GET',
      url: '/api/modules/discovery/notification-email',
      headers: { 'x-session-id': sessionId },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ userNotificationEmail: null });

    await app.close();
  });

  it('GET returns only the persisted user email, never env fallback', async () => {
    process.env.DISCOVERY_NOTIFICATION_EMAIL = 'env-fallback@example.com';
    const app = await startApp();
    const sessionId = await createSession(app);

    const unset = await app.inject({
      method: 'GET',
      url: '/api/modules/discovery/notification-email',
      headers: { 'x-session-id': sessionId },
    });
    expect(unset.statusCode).toBe(200);
    expect(unset.json()).toEqual({ userNotificationEmail: null });
    expect(JSON.stringify(unset.json())).not.toContain('env-fallback@example.com');

    await app.inject({
      method: 'PATCH',
      url: '/api/modules/discovery/notification-email',
      headers: { 'x-session-id': sessionId },
      payload: { email: 'user@example.com' },
    });

    const set = await app.inject({
      method: 'GET',
      url: '/api/modules/discovery/notification-email',
      headers: { 'x-session-id': sessionId },
    });
    expect(set.json()).toEqual({ userNotificationEmail: 'user@example.com' });
    expect(JSON.stringify(set.json())).not.toContain('env-fallback@example.com');

    await app.close();
  });

  it('GET never returns the test override value', async () => {
    const app = await startApp();
    const sessionId = await createSession(app);
    const userId = resolveDiscoveryUserId({ sessionId, accountId: null });
    setDiscoveryNotificationEmailForUser(userId, 'override@example.com');

    const res = await app.inject({
      method: 'GET',
      url: '/api/modules/discovery/notification-email',
      headers: { 'x-session-id': sessionId },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ userNotificationEmail: null });
    expect(JSON.stringify(res.json())).not.toContain('override@example.com');

    await app.close();
  });

  it('PATCH persists a valid email, trimming whitespace and preserving casing', async () => {
    const app = await startApp();
    const sessionId = await createSession(app);

    const put = await app.inject({
      method: 'PATCH',
      url: '/api/modules/discovery/notification-email',
      headers: { 'x-session-id': sessionId },
      payload: { email: '  User@Example.com  ' },
    });
    expect(put.statusCode).toBe(200);
    expect(put.json()).toEqual({ userNotificationEmail: 'User@Example.com' });

    const get = await app.inject({
      method: 'GET',
      url: '/api/modules/discovery/notification-email',
      headers: { 'x-session-id': sessionId },
    });
    expect(get.json()).toEqual({ userNotificationEmail: 'User@Example.com' });

    await app.close();
  });

  it('PATCH with email null clears the persisted value', async () => {
    process.env.DISCOVERY_NOTIFICATION_EMAIL = 'env@example.com';
    const app = await startApp();
    const sessionId = await createSession(app);
    const userId = resolveDiscoveryUserId({ sessionId, accountId: null });

    await app.inject({
      method: 'PATCH',
      url: '/api/modules/discovery/notification-email',
      headers: { 'x-session-id': sessionId },
      payload: { email: 'user@example.com' },
    });

    const clear = await app.inject({
      method: 'PATCH',
      url: '/api/modules/discovery/notification-email',
      headers: { 'x-session-id': sessionId },
      payload: { email: null },
    });
    expect(clear.statusCode).toBe(200);
    expect(clear.json()).toEqual({ userNotificationEmail: null });

    const get = await app.inject({
      method: 'GET',
      url: '/api/modules/discovery/notification-email',
      headers: { 'x-session-id': sessionId },
    });
    expect(get.json()).toEqual({ userNotificationEmail: null });

    // Resolver may fall back to env after clear — API still returns null.
    expect(resolveDiscoveryNotificationEmail(userId)).toBe('env@example.com');

    await app.close();
  });

  it('rejects malformed, whitespace-only, and oversized emails with 400', async () => {
    const app = await startApp();
    const sessionId = await createSession(app);

    const cases = [
      { email: 'not-an-email' },
      { email: '   ' },
      { email: `${'a'.repeat(250)}@x.com` },
      {},
      { email: '' },
    ];

    for (const payload of cases) {
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/modules/discovery/notification-email',
        headers: { 'x-session-id': sessionId },
        payload,
      });
      expect(res.statusCode).toBe(400);
      expect(res.json()).toEqual({
        error: 'Invalid notification email',
        code: 'INVALID_REQUEST',
      });
    }

    await app.close();
  });

  it('requires authentication', async () => {
    const app = await startApp();

    const get = await app.inject({
      method: 'GET',
      url: '/api/modules/discovery/notification-email',
    });
    expect(get.statusCode).toBe(401);

    const put = await app.inject({
      method: 'PATCH',
      url: '/api/modules/discovery/notification-email',
      payload: { email: 'a@example.com' },
    });
    expect(put.statusCode).toBe(401);

    await app.close();
  });

  it('isolates notification email by Discovery user (session)', async () => {
    const app = await startApp();
    const sessionA = await createSession(app);
    const sessionB = await createSession(app);

    await app.inject({
      method: 'PATCH',
      url: '/api/modules/discovery/notification-email',
      headers: { 'x-session-id': sessionA },
      payload: { email: 'a@example.com' },
    });
    await app.inject({
      method: 'PATCH',
      url: '/api/modules/discovery/notification-email',
      headers: { 'x-session-id': sessionB },
      payload: { email: 'b@example.com' },
    });

    const getA = await app.inject({
      method: 'GET',
      url: '/api/modules/discovery/notification-email',
      headers: { 'x-session-id': sessionA },
    });
    const getB = await app.inject({
      method: 'GET',
      url: '/api/modules/discovery/notification-email',
      headers: { 'x-session-id': sessionB },
    });
    expect(getA.json()).toEqual({ userNotificationEmail: 'a@example.com' });
    expect(getB.json()).toEqual({ userNotificationEmail: 'b@example.com' });

    // User A clears only their own email.
    await app.inject({
      method: 'PATCH',
      url: '/api/modules/discovery/notification-email',
      headers: { 'x-session-id': sessionA },
      payload: { email: null },
    });
    const getAAfter = await app.inject({
      method: 'GET',
      url: '/api/modules/discovery/notification-email',
      headers: { 'x-session-id': sessionA },
    });
    const getBAfter = await app.inject({
      method: 'GET',
      url: '/api/modules/discovery/notification-email',
      headers: { 'x-session-id': sessionB },
    });
    expect(getAAfter.json()).toEqual({ userNotificationEmail: null });
    expect(getBAfter.json()).toEqual({ userNotificationEmail: 'b@example.com' });

    // Client-supplied userId in body is ignored / not a write target.
    const ignoreUserId = await app.inject({
      method: 'PATCH',
      url: '/api/modules/discovery/notification-email',
      headers: { 'x-session-id': sessionA },
      payload: { email: 'spoof@example.com', userId: sessionB },
    });
    expect(ignoreUserId.statusCode).toBe(200);
    expect(ignoreUserId.json()).toEqual({ userNotificationEmail: 'spoof@example.com' });

    const getBFinal = await app.inject({
      method: 'GET',
      url: '/api/modules/discovery/notification-email',
      headers: { 'x-session-id': sessionB },
    });
    expect(getBFinal.json()).toEqual({ userNotificationEmail: 'b@example.com' });

    await app.close();
  });

  it('keeps emailRecipientConfigured distinct from userNotificationEmail', async () => {
    process.env.DISCOVERY_NOTIFICATION_EMAIL = 'ops@example.com';
    const app = await startApp();
    const sessionId = await createSession(app);

    await app.inject({
      method: 'POST',
      url: '/api/dev/discovery/seed-fixture',
      headers: { 'x-session-id': sessionId },
    });

    const list = await app.inject({
      method: 'GET',
      url: '/api/modules/discovery/profiles',
      headers: { 'x-session-id': sessionId },
    });
    expect(list.statusCode).toBe(200);
    const listBody = list.json() as { emailRecipientConfigured: boolean };
    expect(listBody.emailRecipientConfigured).toBe(true);
    expect(JSON.stringify(listBody)).not.toContain('ops@example.com');
    expect(listBody).not.toHaveProperty('userNotificationEmail');

    const emailGet = await app.inject({
      method: 'GET',
      url: '/api/modules/discovery/notification-email',
      headers: { 'x-session-id': sessionId },
    });
    expect(emailGet.json()).toEqual({ userNotificationEmail: null });

    await app.close();
  });
});
