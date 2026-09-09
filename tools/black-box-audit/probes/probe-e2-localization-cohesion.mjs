/**
 * E2 — Localization cohesion & language integrity (browser).
 * Tests EN / DE / RU / UA across primary journey surfaces.
 * English product names / URLs / intentional identifiers are allowed.
 */
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../..');
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const OUT = path.join(ROOT, 'tools/black-box-audit/artifacts/e2-localization-cohesion');

await fs.mkdir(OUT, { recursive: true });

const observations = [];
const findings = [];
const languageResults = {};

function note(message) {
  observations.push(message);
  console.log(message);
}

function finding(classification, id, detail) {
  findings.push({ classification, id, detail });
  note(`[${classification}] ${id}: ${detail}`);
}

async function settle(page, ms = 900) {
  await page.waitForLoadState('domcontentloaded', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(ms);
}

const LANG_LABELS = { en: 'English', de: 'Deutsch', ru: 'Русский', ua: 'Українська' };
const CONTINUE = { en: 'Continue', de: 'Weiter', ru: 'Продолжить', ua: 'Продовжити' };
const DOC_LANG = { en: 'en', de: 'de', ru: 'ru', ua: 'uk' };

const EXPECT = {
  en: {
    discoveryHud: /Discovery/,
    atlasMarker: /Personal Life Navigation|Your new life|Enter Atlas|Enter Your Atlas/i,
    guideFab: /Journey Guide/i,
    leakRu: /\bПоиск\b|Исследовать Atlas|Путеводитель/i,
  },
  de: {
    discoveryHud: /Entdeckung/,
    atlasMarker: /Persönliche Lebensnavigation|Ihr neues Leben|Atlas betreten/i,
    guideFab: /Reisebegleiter/i,
    leakRu: /\bПоиск\b|\bПошук\b|Путеводитель|Провідник/i,
  },
  ru: {
    discoveryHud: /Поиск/,
    atlasMarker: /навигац|новая жизнь|Войти в Atlas|Исследовать/i,
    guideFab: /Путеводитель/i,
    leakRu: /\bПошук\b|Досліджувати Atlas|Провідник|Життєві події/i,
  },
  ua: {
    discoveryHud: /Пошук/,
    atlasMarker: /навігац|нове життя|Увійти в Atlas|Досліджувати|Реєстрація|Особист/i,
    guideFab: /Провідник/i,
    leakRu: /\bПоиск\b|Исследовать Atlas|Путеводитель|Жизненные события|Экономическая реальность/i,
  },
};

const MODULE_PATHS = [
  '/modules/life-event',
  '/modules/economic-reality',
  '/modules/healthcare-navigation',
  '/modules/employment',
  '/modules/discovery',
  '/profile',
];

async function freshWelcome(page) {
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await settle(page, 1500);
  await page.locator('[data-ui-surface="arrival-welcome"]').waitFor({
    state: 'visible',
    timeout: 30000,
  });
}

async function selectLanguage(page, langId) {
  const label = LANG_LABELS[langId];
  const btn = page.locator('.arrival-welcome__lang-btn', { hasText: label }).first();
  await btn.click();
  await page.waitForTimeout(500);
  // Persist may lag — poll
  for (let i = 0; i < 20; i++) {
    const stored = await page.evaluate(() =>
      localStorage.getItem('arrival_atlas_display_language')
    );
    const doc = await page.evaluate(() => document.documentElement.lang);
    if (stored === langId && doc === DOC_LANG[langId]) break;
    await page.waitForTimeout(400);
  }
}

async function continueWelcome(page, langId) {
  const cta = page.locator('.arrival-welcome__cta');
  await cta.click();
  await page.locator('[data-ui-surface="arrival-welcome"]').waitFor({
    state: 'hidden',
    timeout: 15000,
  }).catch(() => {});
  await settle(page, 2000);
}

async function enterMemberAtlas(page, langId) {
  // Guest home → enter atlas
  const entry = page.locator('[data-ui-surface="home-atlas-entry"]').first();
  if (await entry.isVisible().catch(() => false)) {
    await entry.click();
    await settle(page, 2500);
    return;
  }
  // Fallback: 7-day secondary
  const secondary = page
    .getByRole('link', { name: /7|Що далі|Was in 7|Что дальше|next/i })
    .first();
  if (await secondary.isVisible().catch(() => false)) {
    await secondary.click();
    await settle(page, 2500);
  }
}

async function assertDocLang(page, langId, phase) {
  const expected = DOC_LANG[langId];
  const doc = await page.evaluate(() => document.documentElement.lang);
  const stored = await page.evaluate(() =>
    localStorage.getItem('arrival_atlas_display_language')
  );
  if (doc !== expected) {
    finding('P1', `${langId}-doclang-${phase}`, `expected ${expected}, got ${doc}`);
  } else {
    finding('OBSERVED_PASS', `${langId}-doclang-${phase}`, doc);
  }
  if (stored !== langId) {
    finding('P1', `${langId}-storage-${phase}`, `expected ${langId}, got ${stored}`);
  }
  return { doc, stored };
}

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
});
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

note('=== E2 Localization cohesion probe ===');

try {
  for (const langId of ['en', 'de', 'ru', 'ua']) {
    note(`\n--- Language: ${langId} ---`);
    languageResults[langId] = {};
    const expect = EXPECT[langId];

    await freshWelcome(page);
    await selectLanguage(page, langId);
    await assertDocLang(page, langId, 'welcome');
    await continueWelcome(page, langId);
    await assertDocLang(page, langId, 'guest-home');

    const guestText =
      (await page.locator('[data-ui-surface="home-atlas"]').first().innerText().catch(() => '')) ||
      (await page.locator('body').innerText());
    languageResults[langId].guestSample = guestText.slice(0, 350);

    if (expect.atlasMarker.test(guestText)) {
      finding('OBSERVED_PASS', `${langId}-guest-home`, 'guest Atlas chrome matches locale');
    } else {
      finding('P2', `${langId}-guest-home`, 'guest Atlas marker not found');
    }

    if (langId === 'ua' && expect.leakRu.test(guestText.slice(0, 1200))) {
      finding('P1', 'ua-ru-leak-guest', 'Russian inheritance labels on guest home');
    }

    await enterMemberAtlas(page, langId);
    await assertDocLang(page, langId, 'member-atlas');

    const homeText =
      (await page.locator('[data-ui-surface="home-atlas"]').first().innerText().catch(() => '')) ||
      guestText;
    const hudText =
      (await page.locator('[data-ui-surface="atlas-hud"]').first().innerText().catch(() => '')) ||
      '';
    languageResults[langId].hudSample = hudText.slice(0, 250);
    languageResults[langId].memberSample = homeText.slice(0, 350);

    if (expect.atlasMarker.test(homeText) || expect.atlasMarker.test(hudText)) {
      finding('OBSERVED_PASS', `${langId}-member-home`, 'member Atlas chrome matches locale');
    } else {
      finding('P2', `${langId}-member-home`, 'member Atlas marker not found');
    }

    if (langId === 'ua' && expect.leakRu.test(hudText + '\n' + homeText.slice(0, 800))) {
      finding('P1', 'ua-ru-leak-member', 'Russian inheritance labels on member Atlas/HUD');
    }

    const guideFab = page.locator('.journey-guide-fab').first();
    if (await guideFab.isVisible().catch(() => false)) {
      const guideLabel =
        (await guideFab.getAttribute('aria-label').catch(() => null)) ||
        (await guideFab.innerText().catch(() => '')) ||
        '';
      languageResults[langId].guideFab = guideLabel;
      if (expect.guideFab.test(guideLabel)) {
        finding('OBSERVED_PASS', `${langId}-guide-fab`, guideLabel);
      } else {
        finding('P2', `${langId}-guide-fab`, `unexpected: ${guideLabel}`);
      }
      await guideFab.click().catch(() => {});
      await page.waitForTimeout(400);
      const speech =
        (await page.locator('.journey-guide-speech, .journey-guide-welcome').first().innerText().catch(() => '')) ||
        '';
      languageResults[langId].guideSpeech = speech.slice(0, 200);
      if (langId === 'ua' && speech && expect.leakRu.test(speech)) {
        finding('P2', 'ua-guide-ru-leak', 'Russian labels in Journey Guide panel');
      }
    } else {
      finding('P3', `${langId}-guide-fab`, 'Journey Guide FAB not visible');
    }

    for (const modPath of MODULE_PATHS) {
      await page.goto(`${BASE_URL}${modPath}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await settle(page, 1000);
      await assertDocLang(page, langId, modPath);

      const details = page.locator('details summary').first();
      if (await details.isVisible().catch(() => false)) {
        await details.click().catch(() => {});
      }

      if (modPath.includes('discovery')) {
        const discHud =
          (await page.locator('[data-ui-surface="atlas-hud"]').first().innerText().catch(() => '')) ||
          '';
        languageResults[langId].discoveryHud = discHud;
        if (expect.discoveryHud.test(discHud)) {
          finding('OBSERVED_PASS', `${langId}-discovery-hud`, discHud.replace(/\s+/g, ' ').slice(0, 80));
        } else {
          finding('P1', `${langId}-discovery-hud`, `marker missing in HUD: ${discHud.slice(0, 100)}`);
        }
        if (langId === 'ua' && /\bПоиск\b/.test(discHud)) {
          finding('P1', 'ua-discovery-ru-leak', 'Russian Поиск under UA Discovery HUD');
        }
      }
    }

    await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
    await settle(page, 1200);
    await assertDocLang(page, langId, 'home-return');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await settle(page, 1500);
    languageResults[langId].afterReload = await assertDocLang(page, langId, 'reload');

    await page.screenshot({ path: path.join(OUT, `${langId}-home.png`), fullPage: false });
  }
} catch (error) {
  finding('P0', 'probe-crash', String(error?.stack || error));
  console.error(error);
} finally {
  await browser.close();
}

const p0 = findings.filter((f) => f.classification === 'P0');
const p1 = findings.filter((f) => f.classification === 'P1');
const passCount = findings.filter((f) => f.classification === 'OBSERVED_PASS').length;

let verdict = 'E2 LOCALIZATION COHESION PASS WITH LIMITATIONS';
if (p0.length) verdict = 'E2 LOCALIZATION COHESION FAIL';
else if (p1.length >= 4) verdict = 'E2 LOCALIZATION COHESION FAIL';
else if (p1.length === 0 && passCount >= 12) verdict = 'E2 LOCALIZATION COHESION PASS';
else if (p1.length > 0) verdict = 'E2 LOCALIZATION COHESION PASS WITH LIMITATIONS';

const report = {
  verdict,
  generatedAt: new Date().toISOString(),
  baseUrl: BASE_URL,
  findings,
  languageResults,
  observations,
};

await fs.writeFile(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
note(`\n=== ${verdict} ===`);
note(`P0=${p0.length} P1=${p1.length} PASS=${passCount}`);
note(`Artifacts: ${OUT}`);
process.exit(p0.length || p1.length >= 4 ? 1 : 0);
