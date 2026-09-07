import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const BASE_URL = 'https://arrival-atlas.pro';
const OUT = 'tools/black-box-audit/artifacts/probe-002';
const ADDRESS_RE = /Забезпечити адресу для реєстрації/i;
const TRACKED_NODES = [
  'Завершити Anmeldung',
  'Забезпечити адресу для реєстрації',
  'Зрозуміти обовʼязкове медичне страхування',
  'Налаштувати банк і податковий шлях',
];

await fs.mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage();

const consoleErrors = [];
const pageErrors = [];
const requestFailures = [];

page.on('console', msg => {
  if (msg.type() === 'error') {
    consoleErrors.push(msg.text());
  }
});

page.on('pageerror', error => {
  pageErrors.push(error.message);
});

page.on('requestfailed', request => {
  requestFailures.push({
    url: request.url(),
    method: request.method(),
    failure: request.failure()?.errorText ?? 'unknown',
  });
});

function isRscPrefetchAbort(failure) {
  const blob = `${failure.url} ${failure.method} ${failure.failure}`;
  return /_rsc|rsc=|prefetch|ERR_ABORTED|NS_BINDING_ABORTED|net::ERR_ABORTED/i.test(blob);
}

function trackedStates(graphNodes) {
  return TRACKED_NODES.map(label => {
    const re = new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ʼ/g, '.'), 'i');
    const matches = (graphNodes || []).filter(node => re.test(node.text || ''));
    return { label, found: matches.length > 0, matches };
  });
}

function tokenDiff(before, after) {
  const beforeSet = new Set(before);
  const afterSet = new Set(after);
  return {
    appeared: after.filter(item => !beforeSet.has(item)),
    disappeared: before.filter(item => !afterSet.has(item)),
  };
}

function buttonKeys(buttons) {
  return (buttons || []).map(
    button =>
      `${button.text}|disabled=${button.disabled}|ariaDisabled=${button.ariaDisabled}|selected=${button.ariaSelected}`
  );
}

function linkKeys(links) {
  return (links || []).map(link => `${link.text}|href=${link.href || ''}`);
}

function recommendedFromBanners(statusBanners) {
  const blob = (statusBanners || []).join(' ').replace(/\s+/g, ' ').trim();
  return blob || 'None';
}

function inspectorSections(complementary) {
  const text = (complementary || []).join('\n');
  if (!text) {
    return { raw: 'None' };
  }
  const keys = ['Status', 'Context', 'Unlocks', 'Blocked', 'Actions', 'Recommendations'];
  const found = {};
  for (const key of keys) {
    const re = new RegExp(`${key}\\s*[:\\n]?([\\s\\S]*?)(?=(?:Status|Context|Unlocks|Blocked|Actions|Recommendations)\\b|$)`, 'i');
    const match = text.match(re);
    found[key] = match ? match[1].replace(/\s+/g, ' ').trim().slice(0, 800) || '(empty)' : 'Not found';
  }
  return { raw: text.slice(0, 4000), sections: found };
}

function valueHits(visibleText, snapshot) {
  const blob = `${visibleText}\n${snapshot}`;
  const tokens = [
    { token: 'Bremen', re: /Bremen/ },
    { token: 'HB', re: /(^|[^A-Za-z])HB([^A-Za-z]|$)/ },
    { token: '€600', re: /€\s*600|600\s*€/ },
    { token: '€100', re: /€\s*100|100\s*€/ },
    { token: 'where-you-live', re: /where-you-live/i },
    { token: 'Anmeldung', re: /Anmeldung/i },
    { token: 'registration', re: /registr|реєстр/i },
    { token: 'profile editor', re: /Виправити дані|where-you-live\/edit|profile-field/i },
    { token: 'healthcare', re: /health|медичн|страхуван/i },
  ];
  return tokens.map(item => ({ token: item.token, present: item.re.test(blob) }));
}

async function extraInventory() {
  return page.evaluate(() => {
    const textOf = el => (el.textContent || '').replace(/\s+/g, ' ').trim();
    const selected = [...document.querySelectorAll('[aria-selected="true"], [aria-current="true"]')]
      .map(el => ({
        tag: el.tagName,
        role: el.getAttribute('role'),
        text: textOf(el),
        ariaSelected: el.getAttribute('aria-selected'),
        ariaCurrent: el.getAttribute('aria-current'),
        disabled: Boolean(el.disabled) || el.getAttribute('aria-disabled') === 'true',
      }))
      .filter(item => item.text);
    const graphNodes = [...document.querySelectorAll('[role="listbox"] button, [role="listbox"] [role="option"]')]
      .map(el => ({
        tag: el.tagName,
        role: el.getAttribute('role'),
        text: textOf(el),
        href: el.getAttribute('href'),
        disabled: Boolean(el.disabled) || el.getAttribute('aria-disabled') === 'true',
        nativeDisabled: Boolean(el.disabled),
        ariaDisabled: el.getAttribute('aria-disabled'),
        ariaSelected: el.getAttribute('aria-selected'),
        ariaCurrent: el.getAttribute('aria-current'),
        ariaPressed: el.getAttribute('aria-pressed'),
        visible: !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length),
      }));
    const complementary = [...document.querySelectorAll('[role="complementary"], aside')]
      .map(el => textOf(el).slice(0, 4000));
    const inspectorActions = [
      ...document.querySelectorAll('[role="complementary"] a, [role="complementary"] button, aside a, aside button'),
    ].map(el => ({
      tag: el.tagName,
      text: textOf(el),
      href: el.getAttribute('href'),
      disabled: Boolean(el.disabled) || el.getAttribute('aria-disabled') === 'true',
    }));
    return {
      selected,
      graphNodes,
      complementary,
      inspectorActions,
      formCount: document.querySelectorAll('form').length,
      dialogs: [...document.querySelectorAll('[role="dialog"]')].map(el => textOf(el).slice(0, 240)),
    };
  });
}

async function dumpAddressCandidates() {
  return page.evaluate(source => {
    const re = new RegExp(source, 'i');
    const textOf = el => (el.textContent || '').replace(/\s+/g, ' ').trim();
    return [...document.querySelectorAll('button, a, [role="button"], [role="option"]')]
      .filter(el => re.test(textOf(el) + ' ' + (el.getAttribute('aria-label') || '')))
      .map((el, index) => ({
        index,
        tag: el.tagName,
        role: el.getAttribute('role'),
        type: el.getAttribute('type'),
        href: el.getAttribute('href'),
        text: textOf(el).slice(0, 240),
        visible: !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length),
        nativeDisabled: Boolean(el.disabled),
        ariaDisabled: el.getAttribute('aria-disabled'),
        ariaSelected: el.getAttribute('aria-selected'),
        inListbox: Boolean(el.closest('[role="listbox"]')),
      }));
  }, ADDRESS_RE.source);
}

async function dumpUi() {
  const headings = await page.locator('h1, h2, h3, h4, h5, h6').evaluateAll(
    els => els.map(e => ({ tag: e.tagName, text: e.textContent.trim() }))
  );
  const buttons = await page.getByRole('button').evaluateAll(els =>
    els.map(el => ({
      text: el.textContent.trim(),
      type: el.getAttribute('type'),
      disabled: el.disabled,
      ariaDisabled: el.getAttribute('aria-disabled'),
      ariaLabel: el.getAttribute('aria-label'),
      ariaSelected: el.getAttribute('aria-selected'),
    }))
  );
  const links = await page.getByRole('link').evaluateAll(els =>
    els.map(el => ({
      text: el.textContent.trim(),
      href: el.getAttribute('href'),
    }))
  );
  const snapshot = await page.locator('body').ariaSnapshot();
  const visibleText = await page.locator('body').innerText();
  const inventory = await extraInventory();
  const statusBanners = await page.locator('[role="status"]').allTextContents().catch(() => []);
  const alerts = await page.locator('[role="alert"]').allTextContents().catch(() => []);
  const arrivingFrom = await page.getByText(/Arriving from/i).allTextContents().catch(() => []);
  const fields = await page.locator('input, select, textarea').evaluateAll(elements =>
    elements.map(element => ({
      tag: element.tagName.toLowerCase(),
      type: element.getAttribute('type'),
      id: element.id || null,
      name: element.getAttribute('name'),
      value: element.value,
      disabled: element.disabled,
      required: element.required,
    }))
  );
  return {
    url: page.url(),
    title: await page.title(),
    lang: await page.locator('html').getAttribute('lang'),
    headings,
    buttons,
    links,
    snapshot,
    visibleText,
    inventory,
    statusBanners,
    alerts,
    arrivingFrom,
    fields,
    formCount: await page.locator('form').count(),
    dialogCount: await page.locator('[role="dialog"]').count(),
    loading: await page
      .locator('[class*="loading"], [class*="spinner"], [aria-busy="true"], [class*="skeleton"]')
      .count(),
    startVisible: await page.getByRole('button', { name: /Start intent|^Start$/i }).isVisible().catch(() => false),
    showRouteVisible: await page.getByRole('button', { name: /Показати маршрут/i }).isVisible().catch(() => false),
    addressCandidates: await dumpAddressCandidates(),
  };
}

function logDump(label, dump) {
  console.log('');
  console.log(`--- ${label} ---`);
  console.log('URL:', dump.url);
  console.log('TITLE:', dump.title);
  console.log('LANG:', dump.lang);
  console.log('PATH:', (() => {
    try {
      return new URL(dump.url).pathname + new URL(dump.url).search;
    } catch {
      return dump.url;
    }
  })());
  console.log('HEADINGS:', dump.headings);
  console.log('BUTTONS:', dump.buttons);
  console.log('LINKS:', dump.links);
  console.log('GRAPH NODES:', dump.inventory.graphNodes);
  console.log('TRACKED NODE STATES:', trackedStates(dump.inventory.graphNodes));
  console.log('ADDRESS CANDIDATES:', dump.addressCandidates.length ? dump.addressCandidates : 'None');
  console.log('SELECTED NODE:', dump.inventory.selected.length ? dump.inventory.selected : 'None detected');
  console.log('GUIDED / STATUS BANNERS:', dump.statusBanners.length ? dump.statusBanners : 'None');
  console.log('RECOMMENDED / BANNER BLOB:', recommendedFromBanners(dump.statusBanners));
  console.log('COMPLEMENTARY / INSPECTOR:', dump.inventory.complementary.length ? dump.inventory.complementary : 'None');
  console.log('INSPECTOR SECTIONS:', inspectorSections(dump.inventory.complementary));
  console.log('INSPECTOR ACTIONS (a/button):', dump.inventory.inspectorActions.length ? dump.inventory.inspectorActions : 'None');
  console.log('ARRIVING FROM:', dump.arrivingFrom.length ? dump.arrivingFrom : 'Not found');
  console.log('FORMS:', dump.formCount);
  console.log('FIELDS:', dump.fields.length ? dump.fields : 'None');
  console.log('DIALOGS:', dump.dialogCount, dump.inventory.dialogs.length ? dump.inventory.dialogs : '');
  console.log('LOADING:', dump.loading > 0 ? `YES (${dump.loading})` : 'None');
  console.log('ALERTS:', dump.alerts.length ? dump.alerts : 'None');
  console.log('START / START INTENT:', dump.startVisible ? 'VISIBLE' : 'NOT VISIBLE');
  console.log('SHOW ROUTE:', dump.showRouteVisible ? 'VISIBLE' : 'NOT VISIBLE');
  console.log('MAIN VISIBLE TEXT (first 8000 chars):');
  console.log((dump.visibleText || '').slice(0, 8000));
  console.log('ACCESSIBILITY SNAPSHOT:');
  console.log(dump.snapshot);
}

try {
  await page.goto(`${BASE_URL}/`, {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

  console.log('SETUP: select Українська');
  await page.getByRole('button', { name: /Українська/i }).click();
  await page.waitForTimeout(500);

  console.log('SETUP: click Продовжити');
  await page.getByRole('button', { name: /Продовжити/i }).click();
  await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1000);

  console.log('SETUP: click Що далі протягом 7 днів');
  await page.getByRole('button', { name: /Що далі протягом 7 днів/i }).click();
  await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2500);

  console.log('SETUP: click Економічна реальність');
  await page.getByRole('link', { name: /Економічна реальність/i }).click();
  await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(3000);

  const welcomeDialog = page.getByRole('dialog', {
    name: /Ласкаво просимо до Arrival Atlas/i,
  });
  await welcomeDialog.waitFor({ state: 'visible', timeout: 15000 });
  console.log('SETUP: Welcome dialog VISIBLE');

  console.log('SETUP: click Почати супроводжуваний шлях');
  await page.getByRole('button', { name: /Почати супроводжуваний шлях/i }).click();
  await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2500);

  const startIntent = page.getByRole('button', { name: /Start intent/i });
  await startIntent.waitFor({ state: 'visible', timeout: 15000 });
  console.log('SETUP: click Start intent');
  const executeResponse = page
    .waitForResponse(
      response =>
        response.url().includes('/api/modules/economic-reality/action/execute') &&
        response.request().method() === 'POST',
      { timeout: 15000 }
    )
    .catch(() => {});
  await startIntent.click();
  await executeResponse;
  await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.getByRole('button', { name: /Update profile/i }).waitFor({
    state: 'visible',
    timeout: 15000,
  });
  await page.waitForTimeout(2500);
  console.log('SETUP: Start intent settled');

  const updateProfileBtn = page.getByRole('button', { name: /^Update profile$/i });
  console.log('SETUP: click Update profile');
  try {
    await updateProfileBtn.click({ timeout: 8000 });
    console.log('SETUP CLICK MODE (Update profile): normal');
  } catch (error) {
    const unstable = /not stable|Timeout|intercepts pointer/i.test(String(error.message || error));
    if (!unstable) {
      throw error;
    }
    console.log('SETUP CLICK MODE (Update profile): force:true — element not stable for normal click');
    console.log('SETUP CLICK DETAIL:', String(error.message || error).slice(0, 400));
    await updateProfileBtn.click({ force: true });
  }
  await page.waitForURL(/\/profile\/where-you-live\/edit/, { timeout: 15000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.locator('#profile-field-city').waitFor({ state: 'visible', timeout: 15000 });
  await page.waitForTimeout(1000);
  console.log('SETUP: housing editor settled');

  console.log('SETUP: fill city Bremen');
  await page.locator('#profile-field-city').fill('Bremen');
  console.log('SETUP: fill bundesland HB');
  await page.locator('#profile-field-bundesland').fill('HB');
  console.log('SETUP: fill monthlyColdRent 600');
  await page.locator('#profile-field-monthlyColdRent').fill('600');
  console.log('SETUP: fill monthlyUtilities 100');
  await page.locator('#profile-field-monthlyUtilities').fill('100');
  await page.waitForTimeout(500);

  console.log('SETUP: click Зберегти');
  await page.getByRole('button', { name: /Зберегти/i }).click();
  await page.waitForURL(/\/profile\/where-you-live/, { timeout: 15000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);
  console.log('SETUP: saved, on', page.url());

  console.log('SETUP: click Життєві події');
  await page
    .getByRole('navigation', { name: /Основна навігація/i })
    .getByRole('link', { name: /Життєві події/i })
    .click();
  await page.waitForURL(/\/modules\/life-event/, { timeout: 15000 }).catch(() => {});
  await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(3000);
  console.log('SETUP: Life Events settled', page.url());

  console.log('');
  console.log('========================================');
  console.log('PROBE-002 / STEP 23 — REGISTRATION ADDRESS PREREQUISITE');
  console.log('========================================');
  console.log('INTENT/ACTION: click enabled Забезпечити адресу для реєстрації');

  const before = await dumpUi();
  logDump('BEFORE CLICK', before);
  await page.screenshot({
    path: `${OUT}/step-23-before-registration-address.png`,
    fullPage: true,
  });
  console.log('SCREENSHOT BEFORE:', `${OUT}/step-23-before-registration-address.png`);

  const graphAddress = page
    .getByRole('listbox', { name: /Consequence graph nodes/i })
    .getByRole('button', { name: ADDRESS_RE });
  const enabledGraphAddress = graphAddress.filter({
    hasNot: page.locator('[aria-disabled="true"]'),
  });

  const candidateDump = before.addressCandidates;
  const enabledDump = (before.inventory.graphNodes || []).filter(
    node => ADDRESS_RE.test(node.text || '') && node.visible && !node.disabled && node.ariaDisabled !== 'true'
  );
  console.log('ENABLED GRAPH ADDRESS NODES (dump):', enabledDump.length ? enabledDump : 'None');
  console.log('ADDRESS CANDIDATE COUNT:', candidateDump.length);
  console.log('GRAPH ADDRESS COUNT:', await graphAddress.count().catch(() => 0));
  console.log('ENABLED GRAPH ADDRESS COUNT:', await enabledGraphAddress.count().catch(() => 0));

  const target = (await enabledGraphAddress.count().catch(() => 0)) > 0
    ? enabledGraphAddress.first()
    : null;
  const targetVisible = target ? await target.isVisible().catch(() => false) : false;
  const targetEnabled = targetVisible ? await target.isEnabled().catch(() => false) : false;
  const targetAriaDisabled = target
    ? await target.getAttribute('aria-disabled').catch(() => null)
    : null;
  const targetAriaSelected = target
    ? await target.getAttribute('aria-selected').catch(() => null)
    : null;
  const targetHref = target ? await target.getAttribute('href').catch(() => null) : null;
  const targetTag = target
    ? await target.evaluate(el => el.tagName).catch(() => null)
    : null;

  console.log('TARGET FOUND:', target ? 'YES' : 'NO');
  console.log('TARGET TAG:', targetTag);
  console.log('TARGET VISIBLE:', targetVisible ? 'YES' : 'NO');
  console.log('TARGET ENABLED (native):', targetEnabled ? 'YES' : 'NO');
  console.log('TARGET ARIA-DISABLED:', targetAriaDisabled);
  console.log('TARGET ARIA-SELECTED:', targetAriaSelected);
  console.log('TARGET HREF:', targetHref);

  const errorCountsBefore = {
    console: consoleErrors.length,
    page: pageErrors.length,
    request: requestFailures.length,
  };

  const rawResponses = [];
  const onResponse = response => {
    rawResponses.push(response);
  };
  page.on('response', onResponse);

  let clickMode = 'skipped';
  let clickError = null;
  const canClick =
    Boolean(target) &&
    targetVisible &&
    targetAriaDisabled !== 'true' &&
    (targetEnabled || enabledDump.length > 0);

  if (!canClick) {
    console.log('ACTION: SKIPPED — enabled Забезпечити адресу для реєстрації not available');
    console.log('NO SUBSTITUTE ACTION PERFORMED');
  } else {
    console.log('ACTION: Click Забезпечити адресу для реєстрації (normal)');
    try {
      await target.click({ timeout: 8000 });
      clickMode = 'normal';
      console.log('CLICK MODE: normal');
      await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(3000);
    } catch (error) {
      clickMode = 'failed';
      clickError = String(error.message || error).slice(0, 800);
      console.log('CLICK MODE: failed — normal click did not succeed; force NOT used');
      console.log('CLICK ERROR:', clickError);
    }
  }

  page.off('response', onResponse);
  console.log('CLICK MODE USED:', clickMode);

  const after = await dumpUi();
  logDump('AFTER CLICK', after);
  await page.screenshot({
    path: `${OUT}/step-23-after-registration-address.png`,
    fullPage: true,
  });

  const interestingNetwork = [];
  for (const response of rawResponses) {
    const request = response.request();
    const method = request.method();
    const url = response.url();
    const interesting =
      /\/api\/|mutation|execute|intent|life-event|ui-snapshot|user-context|profile/i.test(`${method} ${url}`) ||
      /_rsc|rsc=/i.test(url) ||
      ((/POST|PUT|PATCH|DELETE/i.test(method)) &&
        /xhr|fetch|document/i.test(request.resourceType()));
    if (!interesting) {
      continue;
    }
    let responseBody = null;
    try {
      const contentType = response.headers()['content-type'] || '';
      if (contentType.includes('json')) {
        responseBody = await response.json();
      } else {
        responseBody = (await response.text()).slice(0, 8000);
      }
    } catch {
      responseBody = null;
    }
    interestingNetwork.push({
      method,
      url,
      status: response.status(),
      resourceType: request.resourceType(),
      requestPayload: request.postData() || null,
      responseBody,
    });
  }

  if (interestingNetwork.length) {
    await fs.writeFile(
      `${OUT}/step-23-registration-address-network.json`,
      JSON.stringify(interestingNetwork, null, 2)
    );
  }

  const newFailures = requestFailures.slice(errorCountsBefore.request);
  const rscPrefetchAborts = newFailures.filter(isRscPrefetchAbort);
  const otherFailures = newFailures.filter(failure => !isRscPrefetchAbort(failure));
  const buttonDiff = tokenDiff(buttonKeys(before.buttons), buttonKeys(after.buttons));
  const linkDiff = tokenDiff(linkKeys(before.links), linkKeys(after.links));
  const persistenceHits = valueHits(after.visibleText, after.snapshot);
  const urlChanged = before.url !== after.url;
  const inspectorChanged =
    JSON.stringify(before.inventory.complementary) !== JSON.stringify(after.inventory.complementary);
  const selectedChanged =
    JSON.stringify(before.inventory.selected) !== JSON.stringify(after.inventory.selected);
  const headingChanged = JSON.stringify(before.headings) !== JSON.stringify(after.headings);
  const textChanged = before.visibleText !== after.visibleText;
  const afterInspector = inspectorSections(after.inventory.complementary);
  const opensProfileEditor = /\/profile\/where-you-live/.test(after.url);
  const opensAnmeldungLike = /anmeld|registr/i.test(after.url) && !/life-event/i.test(after.url);
  const opensModule = /\/modules\//.test(after.url) && !/\/modules\/life-event/.test(after.url);
  const newForm = after.formCount > before.formCount;
  const newDialog = after.dialogCount > before.dialogCount;

  console.log('');
  console.log('--- STEP 23 COMPARISON ---');
  console.log('URL BEFORE:', before.url);
  console.log('URL AFTER:', after.url);
  console.log('URL CHANGED:', urlChanged ? `YES (${before.url} → ${after.url})` : 'NO');
  console.log('NAVIGATION OCCURRED:', urlChanged ? 'YES' : 'NO');
  console.log('TITLE AFTER:', after.title);
  console.log('LANG BEFORE/AFTER:', before.lang, '→', after.lang);
  console.log('CLICK MODE USED:', clickMode);
  if (clickError) {
    console.log('CLICK ERROR:', clickError);
  }
  console.log('TARGET ENABLED/DISABLED BEFORE:', canClick ? 'enabled' : 'disabled-or-absent');
  console.log('SELECTED BEFORE:', before.inventory.selected);
  console.log('SELECTED AFTER:', after.inventory.selected);
  console.log('SELECTED CHANGED:', selectedChanged ? 'YES' : 'NO');
  console.log('RECOMMENDED BEFORE:', recommendedFromBanners(before.statusBanners));
  console.log('RECOMMENDED AFTER:', recommendedFromBanners(after.statusBanners));
  console.log('INSPECTOR CHANGED:', inspectorChanged ? 'YES' : 'NO');
  console.log('INSPECTOR AFTER SECTIONS:', afterInspector.sections || afterInspector);
  console.log('HEADINGS CHANGED:', headingChanged ? 'YES' : 'NO');
  console.log('VISIBLE TEXT CHANGED:', textChanged ? 'YES' : 'NO');
  console.log('BUTTONS APPEARED:', buttonDiff.appeared.length ? buttonDiff.appeared : 'None');
  console.log('BUTTONS DISAPPEARED:', buttonDiff.disappeared.length ? buttonDiff.disappeared : 'None');
  console.log('LINKS APPEARED:', linkDiff.appeared.length ? linkDiff.appeared : 'None');
  console.log('LINKS DISAPPEARED:', linkDiff.disappeared.length ? linkDiff.disappeared : 'None');
  console.log('FORMS BEFORE/AFTER:', before.formCount, '→', after.formCount);
  console.log('FIELDS AFTER:', after.fields.length ? after.fields : 'None');
  console.log('DIALOGS BEFORE/AFTER:', before.dialogCount, '→', after.dialogCount);
  console.log('LOADING AFTER:', after.loading > 0 ? `YES (${after.loading})` : 'None');
  console.log('ALERTS AFTER:', after.alerts.length ? after.alerts : 'None');
  console.log('ARRIVING FROM BEFORE:', before.arrivingFrom);
  console.log('ARRIVING FROM AFTER:', after.arrivingFrom);
  console.log('OPENS PROFILE EDITOR ROUTE:', opensProfileEditor ? 'YES' : 'NO');
  console.log('OPENS NON-LIFE-EVENT MODULE:', opensModule ? 'YES' : 'NO');
  console.log('URL LOOKS LIKE ANMELDUNG/REGISTRATION MODULE:', opensAnmeldungLike ? 'YES' : 'NO');
  console.log('NEW FORM APPEARED:', newForm ? 'YES' : 'NO');
  console.log('NEW DIALOG APPEARED:', newDialog ? 'YES' : 'NO');
  console.log('PERSISTENCE / CONTEXT HITS:', persistenceHits);
  console.log('TRACKED NODES AFTER:', trackedStates(after.inventory.graphNodes));
  console.log('NETWORK / API (interesting):', interestingNetwork.length ? interestingNetwork : 'None');
  console.log(
    'LIFE-EVENT API:',
    interestingNetwork.filter(e => /\/api\/modules\/life-event/.test(e.url)).length
      ? interestingNetwork.filter(e => /\/api\/modules\/life-event/.test(e.url))
      : 'None'
  );
  console.log(
    'UI-SNAPSHOT:',
    interestingNetwork.filter(e => /\/api\/ui-snapshot/.test(e.url)).length
      ? interestingNetwork.filter(e => /\/api\/ui-snapshot/.test(e.url))
      : 'None'
  );
  console.log(
    'USER-CONTEXT:',
    interestingNetwork.filter(e => /\/api\/user-context/.test(e.url)).length
      ? interestingNetwork.filter(e => /\/api\/user-context/.test(e.url))
      : 'None'
  );
  console.log(
    'MUTATIONS:',
    interestingNetwork.filter(e => /\/api\/mutations/.test(e.url)).length
      ? interestingNetwork.filter(e => /\/api\/mutations/.test(e.url))
      : 'None'
  );
  console.log(
    'PROFILE API:',
    interestingNetwork.filter(e => /\/api\/profile/.test(e.url)).length
      ? interestingNetwork.filter(e => /\/api\/profile/.test(e.url))
      : 'None'
  );
  console.log(
    'EXECUTE / MODULE EXECUTION:',
    interestingNetwork.filter(e => /\/execute|\/action\/execute/.test(e.url)).length
      ? interestingNetwork.filter(e => /\/execute|\/action\/execute/.test(e.url))
      : 'None'
  );
  console.log(
    'NETWORK ARTIFACT:',
    interestingNetwork.length
      ? `${OUT}/step-23-registration-address-network.json`
      : 'not written (no interesting requests)'
  );
  console.log(
    'CONSOLE ERRORS (new):',
    consoleErrors.slice(errorCountsBefore.console).length
      ? consoleErrors.slice(errorCountsBefore.console)
      : 'None'
  );
  console.log(
    'PAGE ERRORS (new):',
    pageErrors.slice(errorCountsBefore.page).length ? pageErrors.slice(errorCountsBefore.page) : 'None'
  );
  console.log('REQUEST FAILURES (new):', newFailures.length ? newFailures : 'None');
  console.log(
    'RSC/PREFETCH ABORTS (technical observation):',
    rscPrefetchAborts.length ? rscPrefetchAborts : 'None'
  );
  console.log('OTHER REQUEST FAILURES (new):', otherFailures.length ? otherFailures : 'None');
  console.log('ACTION: forms / new CTA / Back / other graph nodes / Anmeldung / healthcare NOT CLICKED');
  console.log('SCREENSHOT AFTER:', `${OUT}/step-23-after-registration-address.png`);

  const newCtaOrLink = buttonDiff.appeared.length > 0 || linkDiff.appeared.length > 0;
  const errorsYes =
    consoleErrors.slice(errorCountsBefore.console).length > 0 ||
    pageErrors.slice(errorCountsBefore.page).length > 0 ||
    otherFailures.length > 0;

  console.log('');
  console.log('========================================');
  console.log('STEP 23 SUMMARY');
  console.log('========================================');
  console.log('STEP: 23');
  console.log('action:', clickMode === 'skipped' ? 'unavailable — no click' : 'click Забезпечити адресу для реєстрації');
  console.log('URL before:', before.url);
  console.log('URL after:', after.url);
  console.log('target enabled/disabled:', canClick ? 'enabled' : 'disabled-or-absent');
  console.log('selected node before:', JSON.stringify(before.inventory.selected));
  console.log('selected node after:', JSON.stringify(after.inventory.selected));
  console.log('visible result:', textChanged || inspectorChanged || urlChanged || selectedChanged ? 'UI changed' : 'no observable UI change');
  console.log('navigation yes/no:', urlChanged ? 'yes' : 'no');
  console.log('forms yes/no:', after.formCount > 0 ? `yes (${after.formCount})` : 'no');
  console.log('dialogs yes/no:', after.dialogCount > 0 ? `yes (${after.dialogCount})` : 'no');
  console.log('new CTA/link yes/no:', newCtaOrLink ? 'yes' : 'no');
  console.log(
    'network summary:',
    interestingNetwork.length
      ? interestingNetwork.map(e => `${e.method} ${e.status} ${e.url}`).join(' | ')
      : 'none'
  );
  console.log('errors yes/no:', errorsYes ? 'yes' : 'no');
  console.log('artifact paths:');
  console.log(`  ${OUT}/step-23-before-registration-address.png`);
  console.log(`  ${OUT}/step-23-after-registration-address.png`);
  if (interestingNetwork.length) {
    console.log(`  ${OUT}/step-23-registration-address-network.json`);
  }
} finally {
  await browser.close();
}
