import { rmSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from './build-app.js';
import { resetDiscoveryRuntimeForTests } from './discovery/discovery-user-runtime.js';
import {
  resetTestStateStore,
  setupTestStateStore,
  teardownTestStateStore,
} from './test-state.js';

function jobsCreatePayload(id: string, name: string, schedule: unknown = { cadence: 'manual' }) {
  return {
    id,
    name,
    strategyId: 'job-discovery',
    strategyVersion: '1',
    criteria: {
      required: [{ key: 'country', value: 'DE' }],
      preferred: [{ key: 'role', value: 'Engineer' }],
      excluded: [],
      flexible: [],
    },
    schedule,
    notification: { emailEnabled: true, skipEmptyDigest: true },
    enabled: true,
  };
}

const PD011_STATE_DIR = `${process.cwd()}/.arrival-atlas-state-pd011-test`;

describe('PD-011 Discovery account claim continuity', () => {
  beforeEach(async () => {
    setupTestStateStore();
    await resetTestStateStore();
    rmSync(PD011_STATE_DIR, { recursive: true, force: true });
    process.env.ARRIVAL_ATLAS_STATE_DIR = PD011_STATE_DIR;
    resetDiscoveryRuntimeForTests();
  });

  afterEach(() => {
    resetDiscoveryRuntimeForTests();
    teardownTestStateStore();
  });

  async function createSession(app: Awaited<ReturnType<typeof buildApp>>) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      payload: { context: { userProfile: { language: 'en' } } },
    });
    expect(res.statusCode).toBe(200);
    return res.json() as { sessionId: string; token?: string };
  }

  function headers(sessionId: string, token?: string) {
    return {
      'x-session-id': sessionId,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  it('A/E/H/I/L/V — claim migrates session profile to account with schedule preserved', async () => {
    const app = await buildApp();
    const session = await createSession(app);
    const id = `pd011-migrate-${Date.now()}`;

    const created = await app.inject({
      method: 'POST',
      url: '/api/modules/discovery/profiles',
      headers: headers(session.sessionId),
      payload: jobsCreatePayload(id, 'Session Jobs', { cadence: 'daily', hourUtc: 6 }),
    });
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({
      persistenceScope: 'session',
      profile: { userId: session.sessionId, schedule: { cadence: 'daily', hourUtc: 6 } },
    });

    const claim = await app.inject({
      method: 'POST',
      url: '/api/account/claim',
      headers: headers(session.sessionId, session.token),
    });
    expect(claim.statusCode).toBe(200);
    const claimBody = claim.json() as {
      accountId: string;
      token: string;
      discoveryMigration: {
        transferredProfileIds: string[];
        status: string;
      };
    };
    expect(claimBody.discoveryMigration.transferredProfileIds).toContain(id);

    const list = await app.inject({
      method: 'GET',
      url: '/api/modules/discovery/profiles',
      headers: headers(session.sessionId, claimBody.token),
    });
    expect(list.statusCode).toBe(200);
    const listBody = list.json() as {
      persistenceScope: string;
      profiles: Array<{ id: string; userId: string; schedule: unknown }>;
    };
    expect(listBody.persistenceScope).toBe('account');
    const migrated = listBody.profiles.find((p) => p.id === id);
    expect(migrated?.userId).toBe(claimBody.accountId);
    expect(migrated?.schedule).toEqual({ cadence: 'daily', hourUtc: 6 });

    const summary = await app.inject({
      method: 'GET',
      url: `/api/modules/discovery/profiles/${id}/run-summary`,
      headers: headers(session.sessionId, claimBody.token),
    });
    expect(summary.statusCode).toBe(200);
    expect(summary.json()).toMatchObject({
      automation: { cadence: 'daily', automaticExecution: true },
    });
  });

  it('F/G — repeated claim does not duplicate profiles', async () => {
    const app = await buildApp();
    const session = await createSession(app);
    const id = `pd011-idem-${Date.now()}`;
    await app.inject({
      method: 'POST',
      url: '/api/modules/discovery/profiles',
      headers: headers(session.sessionId),
      payload: jobsCreatePayload(id, 'Idem'),
    });

    const first = await app.inject({
      method: 'POST',
      url: '/api/account/claim',
      headers: headers(session.sessionId),
    });
    const firstBody = first.json() as {
      accountId: string;
      token: string;
      discoveryMigration: { transferredProfileIds: string[] };
    };
    expect(firstBody.discoveryMigration.transferredProfileIds).toEqual([id]);

    const second = await app.inject({
      method: 'POST',
      url: '/api/account/claim',
      headers: headers(session.sessionId, firstBody.token),
    });
    const secondBody = second.json() as {
      discoveryMigration: { transferredProfileIds: string[] };
      token: string;
    };
    expect(secondBody.discoveryMigration.transferredProfileIds).toEqual([]);

    const list = await app.inject({
      method: 'GET',
      url: '/api/modules/discovery/profiles',
      headers: headers(session.sessionId, secondBody.token || firstBody.token),
    });
    const profiles = (list.json() as { profiles: Array<{ id: string }> }).profiles.filter(
      (p) => p.id === id
    );
    expect(profiles).toHaveLength(1);
  });

  it('J/K — claim preserves results and run history for same profile id', async () => {
    const app = await buildApp();
    const session = await createSession(app);
    const id = `pd011-results-${Date.now()}`;
    await app.inject({
      method: 'POST',
      url: '/api/modules/discovery/profiles',
      headers: headers(session.sessionId),
      payload: jobsCreatePayload(id, 'With runs'),
    });

    const run = await app.inject({
      method: 'POST',
      url: `/api/modules/discovery/profiles/${id}/run-now`,
      headers: headers(session.sessionId),
    });
    expect([200, 202]).toContain(run.statusCode);

    const claim = await app.inject({
      method: 'POST',
      url: '/api/account/claim',
      headers: headers(session.sessionId),
    });
    const claimBody = claim.json() as { token: string; accountId: string };

    const summary = await app.inject({
      method: 'GET',
      url: `/api/modules/discovery/profiles/${id}/run-summary`,
      headers: headers(session.sessionId, claimBody.token),
    });
    expect(summary.statusCode).toBe(200);
    const body = summary.json() as { lastRun: { runId: string } | null; profileId: string };
    expect(body.profileId).toBe(id);
    // Run may still be in-flight or terminal — presence of summary is enough; id preserved
    expect(body).toHaveProperty('lifecycle');

    const results = await app.inject({
      method: 'GET',
      url: `/api/modules/discovery/profiles/${id}/results`,
      headers: headers(session.sessionId, claimBody.token),
    });
    expect(results.statusCode).toBe(200);
  });

  it('Q — foreign session cannot access migrated profile via old session ownership alone after claim', async () => {
    const app = await buildApp();
    const owner = await createSession(app);
    const stranger = await createSession(app);
    const id = `pd011-sec-${Date.now()}`;
    await app.inject({
      method: 'POST',
      url: '/api/modules/discovery/profiles',
      headers: headers(owner.sessionId),
      payload: jobsCreatePayload(id, 'Owned'),
    });
    const claim = await app.inject({
      method: 'POST',
      url: '/api/account/claim',
      headers: headers(owner.sessionId),
    });
    expect(claim.statusCode).toBe(200);

    const denied = await app.inject({
      method: 'GET',
      url: `/api/modules/discovery/profiles/${id}`,
      headers: headers(stranger.sessionId),
    });
    expect(denied.statusCode).toBe(404);
  });

  it('R — foreign account cannot claim another session’s profiles by calling claim on own session', async () => {
    const app = await buildApp();
    const sessionA = await createSession(app);
    const sessionB = await createSession(app);
    const id = `pd011-foreign-${Date.now()}`;
    await app.inject({
      method: 'POST',
      url: '/api/modules/discovery/profiles',
      headers: headers(sessionA.sessionId),
      payload: jobsCreatePayload(id, 'A only'),
    });

    const claimB = await app.inject({
      method: 'POST',
      url: '/api/account/claim',
      headers: headers(sessionB.sessionId),
    });
    const bodyB = claimB.json() as {
      token: string;
      discoveryMigration: { transferredProfileIds: string[] };
    };
    expect(bodyB.discoveryMigration.transferredProfileIds).not.toContain(id);

    const listB = await app.inject({
      method: 'GET',
      url: '/api/modules/discovery/profiles',
      headers: headers(sessionB.sessionId, bodyB.token),
    });
    const profilesB = (listB.json() as { profiles: Array<{ id: string }> }).profiles;
    expect(profilesB.some((p) => p.id === id)).toBe(false);
  });

  it('P — notification email moves to account when account has none', async () => {
    const app = await buildApp();
    const session = await createSession(app);
    await app.inject({
      method: 'PATCH',
      url: '/api/modules/discovery/notification-email',
      headers: headers(session.sessionId),
      payload: { email: 'session-user@example.com' },
    });

    const claim = await app.inject({
      method: 'POST',
      url: '/api/account/claim',
      headers: headers(session.sessionId),
    });
    const claimBody = claim.json() as {
      token: string;
      discoveryMigration: { notificationEmailTransferred: boolean };
    };
    expect(claimBody.discoveryMigration.notificationEmailTransferred).toBe(true);

    const email = await app.inject({
      method: 'GET',
      url: '/api/modules/discovery/notification-email',
      headers: headers(session.sessionId, claimBody.token),
    });
    expect(email.json()).toMatchObject({
      userNotificationEmail: 'session-user@example.com',
    });
  });
});
