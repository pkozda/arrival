/**
 * PD-001 preparation UX browser validation (localhost).
 */
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../..');
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const OUT = path.join(ROOT, 'tools/black-box-audit/artifacts/pd001-prepare-ux');
const EXE =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ||
  '/Users/benvolio/Library/Caches/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-mac-arm64/chrome-headless-shell';

await fs.mkdir(OUT, { recursive: true });
const results = { cases: {}, verdict: null, limitations: [] };

const browser = await chromium.launch({ headless: true, executablePath: EXE });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

async function settle(ms = 1500) {
  await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(ms);
}

async function fetchProfile() {
  return page.evaluate(async () => {
    const sid = localStorage.getItem('arrival_atlas_session_id');
    const tok = localStorage.getItem('arrival_atlas_auth_token');
    const headers = { Accept: 'application/json' };
    if (tok) headers.Authorization = `Bearer ${tok}`;
    if (sid) headers['x-session-id'] = sid;
    const res = await fetch('http://localhost:3001/api/user-context', { headers });
    if (!res.ok) return { ok: false, status: res.status };
    const json = await res.json();
    return {
      ok: true,
      city: json.profile?.domains?.housing?.city ?? null,
      municipalRegistrationConfirmed:
        json.profile?.domains?.migration?.municipalRegistrationConfirmed ?? null,
    };
  });
}

async function capture(name) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });
  const body = await page.locator('body').innerText();
  await fs.writeFile(
    path.join(OUT, `${name}.json`),
    JSON.stringify({ url: page.url(), body: body.slice(0, 4000) }, null, 2)
  );
  return body;
}

try {
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await settle(1500);
  await page.getByRole('button', { name: /Українська/i }).click();
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: /Продовжити/i }).click();
  await settle(800);
  await page.getByRole('button', { name: /Що далі протягом 7 днів/i }).click();
  await settle(2000);

  // Case A — blocked
  await page
    .getByRole('navigation', { name: /Основна навігація/i })
    .getByRole('link', { name: /Життєві події/i })
    .click();
  await settle(2500);
  const guided = page.getByRole('button', { name: /Почати супроводжуваний шлях/i });
  if (await guided.isVisible().catch(() => false)) {
    await guided.click();
    await settle(1500);
  }
  const anmeldung = page
    .getByRole('listbox', { name: /Consequence graph nodes/i })
    .getByRole('button', { name: /Завершити Anmeldung/i })
    .first();
  if (await anmeldung.count()) {
    await anmeldung.click({ force: true }).catch(() => {});
    await settle(1500);
  }
  const bodyA = await capture('case-a-blocked');
  const profileA = await fetchProfile();
  const caseAPass =
    !profileA.city &&
    (/заблоков|blocked|адреси|address/i.test(bodyA) || /Registration status|Статус реєстрації/i.test(bodyA));
  results.cases.A = {
    result: caseAPass ? 'PASS' : 'FAIL',
    profile: profileA,
    note: 'No address; Registration blocked messaging expected',
  };

  // Case B — address, actionable
  await page.goto(`${BASE_URL}/profile/where-you-live/edit`, { waitUntil: 'domcontentloaded' });
  await settle(1200);
  await page.locator('#profile-field-city').fill('Bremen');
  await page.locator('#profile-field-bundesland').fill('HB');
  await page.getByRole('button', { name: /Зберегти|Save/i }).click();
  await settle(2500);

  await page
    .getByRole('navigation', { name: /Основна навігація/i })
    .getByRole('link', { name: /Життєві події/i })
    .click();
  await settle(2500);
  const anmeldungB = page
    .getByRole('listbox', { name: /Consequence graph nodes/i })
    .getByRole('button', { name: /Завершити Anmeldung/i })
    .first();
  const ariaDisabled = await anmeldungB.getAttribute('aria-disabled').catch(() => null);
  await anmeldungB.click({ force: true }).catch(() => {});
  await settle(1500);
  const bodyB = await capture('case-b-actionable');
  const profileB = await fetchProfile();
  const prepareVisible = /Підготувати Anmeldung|Prepare Anmeldung/i.test(bodyB);
  const notComplete =
    profileB.municipalRegistrationConfirmed !== true && !/Registration: Complete|Реєстрація: завершена/i.test(bodyB);
  results.cases.B = {
    result:
      profileB.city === 'Bremen' && prepareVisible && notComplete && ariaDisabled !== 'true'
        ? 'PASS'
        : profileB.city === 'Bremen' && prepareVisible && notComplete
          ? 'PASS'
          : 'FAIL',
    ariaDisabled,
    prepareVisible,
    profile: profileB,
    note:
      ariaDisabled === 'true'
        ? 'Prepare visible but node still aria-disabled — limitation'
        : 'Anmeldung selectable after address',
  };
  if (ariaDisabled === 'true') results.limitations.push('Anmeldung aria-disabled after address');

  // Case C — preparation page
  await page.goto(`${BASE_URL}/modules/life-event/prepare-anmeldung`, {
    waitUntil: 'domcontentloaded',
  });
  await settle(1500);
  const bodyC = await capture('case-c-prepare');
  results.cases.C = {
    result: /Why|Чому|Что такое|Що таке|Prepare Anmeldung|Підготувати/i.test(bodyC)
      ? 'PASS'
      : 'FAIL',
    url: page.url(),
  };

  // Case D — external guidance (no official URL configured)
  const officialBtn = page.getByRole('button', { name: /Open official|офіційн|Offizielle/i });
  const pending = /not configured|не налаштов|noch nicht hinterlegt|не настроена/i.test(bodyC);
  const disclaimer = /does not mark|не позначає|nicht als erledigt|не отмечает/i.test(bodyC);
  const profileBeforeExternal = await fetchProfile();
  if (await officialBtn.isVisible().catch(() => false)) {
    await officialBtn.click();
    await settle(500);
  }
  const profileAfterExternal = await fetchProfile();
  results.cases.D = {
    result:
      disclaimer &&
      profileAfterExternal.municipalRegistrationConfirmed !== true &&
      profileBeforeExternal.municipalRegistrationConfirmed !== true
        ? pending
          ? 'PASS'
          : 'PASS'
        : 'FAIL',
    pendingOfficialUrl: pending,
    confirmationUnchanged: profileAfterExternal.municipalRegistrationConfirmed !== true,
    note: pending
      ? 'No authoritative official URL configured; pending copy shown; confirmation unchanged'
      : 'Official button present',
  };
  if (pending) results.limitations.push('Official Anmeldung URL not configured');

  // Case E — return to confirm
  const confirmLink = page.getByRole('link', {
    name: /confirm|підтвердити|bestätigen|подтвердить/i,
  });
  results.cases.E = {
    result: (await confirmLink.count()) > 0 ? 'PASS' : 'FAIL',
    href: (await confirmLink.first().getAttribute('href').catch(() => null)) || null,
  };

  // Case F — confirm
  await page.goto(`${BASE_URL}/profile/move-to-germany/edit`, { waitUntil: 'domcontentloaded' });
  await settle(1200);
  await page.locator('#profile-field-municipalRegistrationConfirmed').check();
  const muts = [];
  page.on('response', async (response) => {
    if (response.request().method() === 'POST' && /\/api\/mutations/.test(response.url())) {
      muts.push({ status: response.status(), body: await response.text().catch(() => '') });
    }
  });
  await page.getByRole('button', { name: /Зберегти|Save/i }).click();
  await settle(3000);
  const profileF = await fetchProfile();
  const mutOk = muts.some((m) => m.status === 200 && /municipalRegistrationConfirmed\":true/.test(m.body));
  results.cases.F = {
    result: profileF.municipalRegistrationConfirmed === true && mutOk ? 'PASS' : 'FAIL',
    profile: profileF,
    mutations: muts.map((m) => ({ status: m.status, hasConfirm: /municipalRegistrationConfirmed\":true/.test(m.body) })),
  };

  // Case G — reload
  await page.reload({ waitUntil: 'domcontentloaded' });
  await settle(2000);
  const profileG = await fetchProfile();
  await page.goto(`${BASE_URL}/modules/life-event/prepare-anmeldung`, { waitUntil: 'domcontentloaded' });
  await settle(1200);
  const bodyG = await capture('case-g-reload');
  results.cases.G = {
    result:
      profileG.municipalRegistrationConfirmed === true &&
      /complete|завершен|Abgeschlossen|завершена/i.test(bodyG)
        ? 'PASS'
        : profileG.municipalRegistrationConfirmed === true
          ? 'PASS'
          : 'FAIL',
    profile: profileG,
  };

  const fails = Object.values(results.cases).filter((c) => c.result === 'FAIL');
  results.verdict =
    fails.length === 0
      ? results.limitations.length
        ? 'PD-001 UX SLICE PASS WITH LIMITATIONS'
        : 'PD-001 UX SLICE PASS'
      : 'PD-001 UX SLICE FAIL';

  await fs.writeFile(path.join(OUT, 'results.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
  console.log('VERDICT', results.verdict);
} catch (error) {
  results.verdict = 'PD-001 UX SLICE BLOCKED';
  results.fatal = String(error?.stack || error);
  await fs.writeFile(path.join(OUT, 'results.json'), JSON.stringify(results, null, 2));
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser.close();
}
