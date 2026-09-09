/**
 * PD-006 Discovery persistence — local browser validation.
 */
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../..');
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const API_URL = process.env.API_URL || 'http://localhost:3001';
const OUT = path.join(ROOT, 'tools/black-box-audit/artifacts/pd006-discovery-persistence');

await fs.mkdir(OUT, { recursive: true });

const observations = [];

function note(message) {
  observations.push(message);
  console.log(message);
}

async function settle(page, ms = 1500) {
  await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(ms);
}

async function enterAtlas(page) {
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await settle(page, 2000);
  await page.getByRole('button', { name: /Українська/i }).click();
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: /Продовжити/i }).click();
  await settle(page, 1000);
  await page.getByRole('button', { name: /Що далі протягом 7 днів/i }).click();
  await settle(page, 2500);
}

async function openDiscovery(page) {
  await page.goto(`${BASE_URL}/modules/discovery`, {
    waitUntil: 'domcontentloaded',
    timeout: 45000,
  });
  await settle(page, 3500);
  await page
    .locator('[data-spatial-phase="landed"], [data-spatial-phase="idle"]')
    .first()
    .waitFor({ state: 'attached', timeout: 10000 })
    .catch(() => {});
}

async function createViaSelfDirected(page, name) {
  const selfBtn = page.locator('[data-discovery-setup="self-directed"]').first();
  if (await selfBtn.isVisible().catch(() => false)) {
    await selfBtn.click();
    await settle(page, 800);
  }
  await page.locator('[data-ui-surface="discovery-self-directed-create"] input').nth(0).fill(name);
  // name is first text input after strategy select — use label association
  const nameInput = page
    .locator('[data-ui-surface="discovery-self-directed-create"] label')
    .filter({ hasText: /name|назв|Name|ім/i })
    .locator('input')
    .first();
  if (await nameInput.count()) {
    await nameInput.fill(name);
  } else {
    await page.locator('[data-ui-surface="discovery-self-directed-create"] input[required]').first().fill(name);
  }
  const countryInput = page
    .locator('[data-ui-surface="discovery-self-directed-create"] input')
    .nth(1);
  await countryInput.fill('DE');
  await page
    .locator('[data-ui-surface="discovery-self-directed-create"] button[type="submit"]')
    .click();
  await settle(page, 2500);
}

async function createViaGuided(page, name) {
  await page.locator('[data-discovery-setup="guided"]').first().click();
  await settle(page, 800);
  await page.locator('[data-guided-action="start"]').click();
  await settle(page, 400);
  await page.locator('[data-guided-intent="jobs"]').click();
  await settle(page, 300);
  await page.locator('[data-guided-action="next"]').click();
  await settle(page, 400);
  await page.locator('[data-guided-field="name"]').fill(name);
  await page.locator('[data-guided-field="country"]').fill('DE');
  await page.locator('[data-guided-action="next"]').click();
  await settle(page, 500);
  await page.locator('[data-guided-action="create"]').click();
  await settle(page, 2500);
  await page.locator('[data-guided-action="continue"]').click();
  await settle(page, 1500);
}

const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ||
    '/Users/benvolio/Library/Caches/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-mac-arm64/chrome-headless-shell',
});

try {
  note(`PD-006 browser validation @ ${BASE_URL}`);

  // —— Demo/session path ——
  const contextA = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const pageA = await contextA.newPage();
  await enterAtlas(pageA);
  await openDiscovery(pageA);
  await pageA.screenshot({ path: path.join(OUT, '01-session-entry.png'), fullPage: true });

  const sessionDisclosure = await pageA
    .locator('[data-ui-surface="discovery-persistence-disclosure"][data-persistence-scope="session"]')
    .isVisible()
    .catch(() => false);
  note(`Case E session disclosure visible: ${sessionDisclosure}`);

  const sessionProfileName = `PD006 Session ${Date.now()}`;
  await createViaGuided(pageA, sessionProfileName);
  await pageA.screenshot({ path: path.join(OUT, '02-session-created.png'), fullPage: true });
  const sessionCreatedVisible = await pageA.getByText(sessionProfileName).first().isVisible();
  note(`Case F guided create visible: ${sessionCreatedVisible}`);

  await pageA.reload({ waitUntil: 'domcontentloaded' });
  await settle(pageA, 3500);
  const sessionReloadVisible = await pageA.getByText(sessionProfileName).first().isVisible();
  note(`Case C same-session reload visible: ${sessionReloadVisible}`);
  await pageA.screenshot({ path: path.join(OUT, '03-session-reload.png'), fullPage: true });

  // Session isolation — new browser context ⇒ new session
  const contextB = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const pageB = await contextB.newPage();
  await enterAtlas(pageB);
  await openDiscovery(pageB);
  const leaked = await pageB.getByText(sessionProfileName).first().isVisible().catch(() => false);
  note(`Case D session isolation (B cannot see A): ${!leaked}`);
  await pageB.screenshot({ path: path.join(OUT, '04-session-isolation.png'), fullPage: true });

  const selfDirectedOk = await pageB
    .locator('[data-discovery-setup="self-directed"]')
    .first()
    .isVisible();
  if (selfDirectedOk) {
    const selfName = `PD006 Self ${Date.now()}`;
    await createViaSelfDirected(pageB, selfName);
    const selfVisible = await pageB.getByText(selfName).first().isVisible().catch(() => false);
    note(`Case G self-directed create visible: ${selfVisible}`);
  } else {
    note('Case G self-directed create visible: false');
  }

  await contextA.close();
  await contextB.close();

  // —— Account-backed API + browser disclosure (claim) ——
  // Local Atlas UI does not expose claim chrome; validate account persistence via API,
  // then inject claimed session into a browser context when possible.
  let accountBrowserPass = false;
  let accountApiPass = false;
  try {
    const sessionRes = await fetch(`${API_URL}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context: { userProfile: { language: 'en' } } }),
    });
    const sessionBody = await sessionRes.json();
    const sessionId = sessionBody.sessionId;
    const claimRes = await fetch(`${API_URL}/api/account/claim`, {
      method: 'POST',
      headers: {
        'x-session-id': sessionId,
        ...(sessionBody.token ? { Authorization: `Bearer ${sessionBody.token}` } : {}),
      },
    });
    const claimBody = await claimRes.json();
    const accountId = claimBody.accountId;
    const token = claimBody.token;

    const profileId = `pd006-browser-account-${Date.now()}`;
    const createRes = await fetch(`${API_URL}/api/modules/discovery/profiles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-session-id': sessionId,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        id: profileId,
        name: 'PD006 Account Browser',
        strategyId: 'job-discovery',
        strategyVersion: '1',
        criteria: {
          required: [{ key: 'country', value: 'DE' }],
          preferred: [],
          excluded: [],
          flexible: [],
        },
        schedule: { cadence: 'manual' },
        notification: { emailEnabled: true, skipEmptyDigest: true },
        enabled: true,
      }),
    });
    const created = await createRes.json();
    note(
      `Case A account create status=${createRes.status} scope=${created.persistenceScope} ownerMatch=${created.profile?.userId === accountId}`
    );

    const linkedRes = await fetch(`${API_URL}/api/accounts/${accountId}/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-session-id': sessionId,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({}),
    });
    const linked = await linkedRes.json();
    const listRes = await fetch(`${API_URL}/api/modules/discovery/profiles`, {
      headers: {
        'x-session-id': linked.sessionId,
        Authorization: `Bearer ${linked.token}`,
      },
    });
    const listBody = await listRes.json();
    const survivesLinkedSession = (listBody.profiles ?? []).some((p) => p.id === profileId);
    accountApiPass =
      createRes.status === 201 &&
      created.persistenceScope === 'account' &&
      created.profile?.userId === accountId &&
      linkedRes.status === 200 &&
      listRes.status === 200 &&
      listBody.persistenceScope === 'account' &&
      survivesLinkedSession;
    note(
      `Case B linked-session persistence: ${survivesLinkedSession} (accountApiPass=${accountApiPass})`
    );

    // Browser cannot easily adopt claimed identity without product claim UX.
    // Document as API-proven for account continuity; UI disclosure covered in session path.
    accountBrowserPass = false;
    note(
      'Case A/B browser account disclosure: UNVERIFIED (no claim chrome in Atlas demo UI); covered by API + session disclosure UI'
    );
  } catch (error) {
    note(`Account API path error: ${error instanceof Error ? error.message : String(error)}`);
  }

  const pass =
    sessionDisclosure &&
    sessionCreatedVisible &&
    sessionReloadVisible &&
    !leaked &&
    accountApiPass;

  note(`VERDICT: ${pass ? 'BROWSER PASS' : 'BROWSER FAIL'}`);
  await fs.writeFile(
    path.join(OUT, 'observations.json'),
    JSON.stringify(
      {
        observations,
        pass,
        accountApiPass,
        accountBrowserPass,
      },
      null,
      2
    )
  );

  await browser.close();
  process.exit(pass ? 0 : 1);
} catch (error) {
  note(`ERROR: ${error instanceof Error ? error.message : String(error)}`);
  await fs.writeFile(
    path.join(OUT, 'observations.json'),
    JSON.stringify({ observations, pass: false }, null, 2)
  );
  await browser.close();
  process.exit(1);
}
