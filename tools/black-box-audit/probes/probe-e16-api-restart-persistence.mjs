/**
 * E16 — Isolated API persistence/restart smoke (no Docker required).
 * Starts API with dedicated state dir, writes profile facts, restarts, verifies reconstruction.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../..');
const STATE = path.join(ROOT, 'tools/black-box-audit/artifacts/e16-release/api-state');
const PORT = process.env.E16_API_PORT || '3016';
const BASE = `http://127.0.0.1:${PORT}`;

await fs.rm(STATE, { recursive: true, force: true });
await fs.mkdir(STATE, { recursive: true });

function startApi() {
  const child = spawn('node', ['dist/index.js'], {
    cwd: path.join(ROOT, 'apps/api'),
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT,
      HOST: '127.0.0.1',
      ARRIVAL_ATLAS_AUTH_SECRET: 'e16-controlled-release-auth-secret',
      ARRIVAL_ATLAS_OPS_TOKEN: 'e16-controlled-release-ops-token',
      ARRIVAL_ATLAS_DEV_TOOLS: 'false',
      ARRIVAL_ATLAS_STATE_DIR: path.join(STATE, 'state'),
      ARRIVAL_ATLAS_ACCOUNTS_DIR: path.join(STATE, 'accounts'),
      ARRIVAL_ATLAS_SESSIONS_DIR: path.join(STATE, 'sessions'),
      ARRIVAL_ATLAS_ENTITLEMENTS_DIR: path.join(STATE, 'entitlements'),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return child;
}

async function waitHealth(timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${BASE}/health`);
      if (res.ok) {
        const body = await res.json();
        if (body?.status === 'ok') return body;
      }
    } catch {
      // retry
    }
    await delay(400);
  }
  throw new Error('API health timeout');
}

async function createSession() {
  const res = await fetch(`${BASE}/api/sessions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ preferredLanguage: 'en' }),
  });
  if (!res.ok) throw new Error(`session create ${res.status}`);
  return res.json();
}

async function submitMutation(sessionId, token, mutation) {
  const res = await fetch(`${BASE}/api/mutations`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-session-id': sessionId,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(mutation),
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function getUserContext(sessionId, token) {
  const res = await fetch(`${BASE}/api/user-context`, {
    headers: {
      'x-session-id': sessionId,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  });
  return { status: res.status, body: await res.json() };
}

function killApi(child) {
  return new Promise((resolve) => {
    child.once('exit', () => resolve());
    child.kill('SIGTERM');
    setTimeout(() => {
      try {
        child.kill('SIGKILL');
      } catch {
        // ignore
      }
    }, 3000);
  });
}

const report = { ok: false, steps: [] };
let child = startApi();

try {
  // Fail-closed: missing secret must not start (spot-check via helper already unit-tested).
  // Dev tools must be closed.
  const health = await waitHealth();
  report.steps.push({ health });

  const session = await createSession();
  const sessionId = session.sessionId || session.id;
  const token = session.token || session.authToken || null;
  report.steps.push({ sessionId: Boolean(sessionId) });

  const mutations = [
    {
      id: 'e16-city',
      requestId: 'e16-city',
      timestamp: new Date().toISOString(),
      type: 'fact.correct',
      intent: 'correction',
      domain: 'housing',
      source: { kind: 'profile_ui', domain: 'housing' },
      payload: { kind: 'domain_facts', domain: 'housing', fields: { city: 'Bremen', monthlyColdRent: 650 } },
      confidence: 1,
      userConfirmationRequired: true,
      expectedHeadRevision: 0,
    },
    {
      id: 'e16-reg',
      requestId: 'e16-reg',
      timestamp: new Date().toISOString(),
      type: 'fact.correct',
      intent: 'correction',
      domain: 'migration',
      source: { kind: 'profile_ui', domain: 'migration' },
      payload: {
        kind: 'domain_facts',
        domain: 'migration',
        fields: { municipalRegistrationConfirmed: true },
      },
      confidence: 1,
      userConfirmationRequired: true,
      expectedHeadRevision: 1,
    },
    {
      id: 'e16-wg',
      requestId: 'e16-wg',
      timestamp: new Date().toISOString(),
      type: 'fact.correct',
      intent: 'correction',
      domain: 'benefits',
      source: { kind: 'profile_ui', domain: 'benefits' },
      payload: { kind: 'domain_facts', domain: 'benefits', fields: { receivingWohngeld: true } },
      confidence: 1,
      userConfirmationRequired: true,
      expectedHeadRevision: 2,
    },
    {
      id: 'e16-tax',
      requestId: 'e16-tax',
      timestamp: new Date().toISOString(),
      type: 'fact.correct',
      intent: 'correction',
      domain: 'employment',
      source: { kind: 'profile_ui', domain: 'employment' },
      payload: { kind: 'domain_facts', domain: 'employment', fields: { taxClass: 3 } },
      confidence: 1,
      userConfirmationRequired: true,
      expectedHeadRevision: 3,
    },
  ];

  let revision = 0;
  for (const mutation of mutations) {
    mutation.expectedHeadRevision = revision;
    let result = await submitMutation(sessionId, token, mutation);
    if (result.status === 409 && result.body?.error) {
      const match = /current is (\d+)/i.exec(String(result.body.error));
      if (match) {
        revision = Number(match[1]);
        mutation.expectedHeadRevision = revision;
        result = await submitMutation(sessionId, token, mutation);
      }
    }
    if (result.status !== 200 || !result.body?.success) {
      throw new Error(`mutation failed ${mutation.id}: ${JSON.stringify(result)}`);
    }
    revision = result.body.revision ?? revision + 1;
    report.steps.push({ mutation: mutation.id, revision, status: result.status });
  }

  const before = await getUserContext(sessionId, token);
  const beforeDomains = before.body?.profile?.domains || before.body?.userContext?.profile?.domains;
  report.steps.push({ beforeDomains });

  await killApi(child);
  await delay(800);
  child = startApi();
  await waitHealth();

  const after = await getUserContext(sessionId, token);
  const afterDomains = after.body?.profile?.domains || after.body?.userContext?.profile?.domains;
  report.steps.push({ afterDomains });

  const ok =
    afterDomains?.housing?.city === 'Bremen' &&
    afterDomains?.housing?.monthlyColdRent === 650 &&
    afterDomains?.migration?.municipalRegistrationConfirmed === true &&
    afterDomains?.benefits?.receivingWohngeld === true &&
    afterDomains?.employment?.taxClass === 3 &&
    afterDomains?.employment?.churchTax === undefined;

  // Dev tools closed
  const devRes = await fetch(`${BASE}/api/dev/reset-user-data`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-session-id': sessionId },
    body: '{}',
  });
  report.steps.push({ devToolsStatus: devRes.status });

  // Ops without token fail-closed
  const opsRes = await fetch(`${BASE}/api/ops/discovery/health`);
  report.steps.push({ opsUnauthStatus: opsRes.status });

  report.ok = ok && (devRes.status === 403 || devRes.status === 404 || devRes.status === 401);
  report.devToolsClosed = devRes.status === 403 || devRes.status === 404 || devRes.status === 401;
  report.opsFailClosed = opsRes.status === 401 || opsRes.status === 403;

  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exit(1);
} catch (error) {
  console.error(error);
  report.error = String(error?.stack || error);
  console.log(JSON.stringify(report, null, 2));
  process.exit(1);
} finally {
  await killApi(child).catch(() => {});
  await fs.writeFile(
    path.join(ROOT, 'tools/black-box-audit/artifacts/e16-release/restart-report.json'),
    JSON.stringify(report, null, 2)
  );
}
