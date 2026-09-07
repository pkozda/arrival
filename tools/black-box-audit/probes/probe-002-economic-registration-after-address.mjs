import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const BASE_URL = 'https://arrival-atlas.pro';
const OUT = 'tools/black-box-audit/artifacts/probe-002';
const ADDRESS_RE = /Забезпечити адресу для реєстрації/i;
const ANMELDUNG_RE = /Завершити Anmeldung/i;
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

function explanationHits(visibleText, snapshot, inspector) {
  const blob = `${visibleText}\n${snapshot}\n${JSON.stringify(inspector || {})}`;
  const tokens = [
    { token: 'explicit prerequisite', re: /prerequisite|передумов|спочатку|requires|потрібн/i },
    { token: 'missing condition', re: /missing|немає|відсутн|incomplete|незавершен/i },
    { token: 'dependency', re: /depend|залежн|waiting on|очікує/i },
    { token: 'address/registration requirement', re: /адрес|реєстрац|Anmeldung|landlord|орендодав/i },
    { token: 'profile requirement', re: /profile|профіл|Виправити|housing|житл/i },
    { token: 'external institution', re: /Bürgeramt|institution|установа|appointment|запис/i },
    { token: 'Blocked / No direct constraints', re: /Blocked|No direct constraints|No direct unlocks/i },
    { token: 'Completed / Verified', re: /Completed|Verified/i },
  ];
  return tokens.map(item => ({ token: item.token, present: item.re.test(blob) }));
}

async function dumpInspector() {
  return page.evaluate(() => {
    const root = document.querySelector('[role="complementary"]') || document.querySelector('aside');
    if (!root) {
      return null;
    }
    const textOf = el => (el.textContent || '').replace(/\s+/g, ' ').trim();
    const titleEl = root.querySelector('h3, h2, h1');
    const firstParagraph = root.querySelector('p');
    const sections = {};
    for (const heading of root.querySelectorAll('h4')) {
      const key = textOf(heading);
      const parts = [];
      let next = heading.nextElementSibling;
      while (next && !/^H[1-4]$/.test(next.tagName)) {
        parts.push(textOf(next));
        next = next.nextElementSibling;
      }
      sections[key] = parts.join(' ').trim();
    }
    const actions = [...root.querySelectorAll('a, button')].map(el => ({
      tag: el.tagName,
      text: textOf(el),
      href: el.getAttribute('href'),
      disabled: Boolean(el.disabled) || el.getAttribute('aria-disabled') === 'true',
    }));
    return {
      title: titleEl ? textOf(titleEl) : null,
      statusParagraph: firstParagraph ? textOf(firstParagraph) : null,
      sections,
      actions,
      raw: textOf(root).slice(0, 4000),
    };
  });
}

async function dumpNamedCandidates(source) {
  return page.evaluate(pattern => {
    const re = new RegExp(pattern, 'i');
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
  }, source);
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
    return {
      selected,
      graphNodes,
      complementary,
      formCount: document.querySelectorAll('form').length,
      dialogs: [...document.querySelectorAll('[role="dialog"]')].map(el => textOf(el).slice(0, 240)),
    };
  });
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
  const inspector = await dumpInspector();
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
    inspector,
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
    anmeldungCandidates: await dumpNamedCandidates(ANMELDUNG_RE.source),
    addressCandidates: await dumpNamedCandidates(ADDRESS_RE.source),
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
  console.log('ANMELDUNG CANDIDATES:', dump.anmeldungCandidates.length ? dump.anmeldungCandidates : 'None');
  console.log('ADDRESS CANDIDATES:', dump.addressCandidates.length ? dump.addressCandidates : 'None');
  console.log('SELECTED NODE:', dump.inventory.selected.length ? dump.inventory.selected : 'None detected');
  console.log('GUIDED / STATUS BANNERS:', dump.statusBanners.length ? dump.statusBanners : 'None');
  console.log('RECOMMENDED / BANNER BLOB:', recommendedFromBanners(dump.statusBanners));
  console.log('INSPECTOR STRUCTURED:', dump.inspector || 'None');
  console.log('INSPECTOR TITLE:', dump.inspector?.title || 'None');
  console.log('INSPECTOR STATUS PARAGRAPH:', dump.inspector?.statusParagraph || 'None');
  console.log('INSPECTOR SHOWS ANMELDUNG:', ANMELDUNG_RE.test(dump.inspector?.title || '') ? 'YES' : 'NO');
  console.log('COMPLEMENTARY RAW:', dump.inventory.complementary.length ? dump.inventory.complementary : 'None');
  console.log('ARRIVING FROM:', dump.arrivingFrom.length ? dump.arrivingFrom : 'Not found');
  console.log('FORMS:', dump.formCount);
  console.log('FIELDS:', dump.fields.length ? dump.fields : 'None');
  console.log('DIALOGS:', dump.dialogCount, dump.inventory.dialogs.length ? dump.inventory.dialogs : '');
  console.log('LOADING:', dump.loading > 0 ? `YES (${dump.loading})` : 'None');
  console.log('ALERTS:', dump.alerts.length ? dump.alerts : 'None');
  console.log('START / START INTENT:', dump.startVisible ? 'VISIBLE' : 'NOT VISIBLE');
  console.log('SHOW ROUTE:', dump.showRouteVisible ? 'VISIBLE' : 'NOT VISIBLE');
  console.log('EXPLANATION TOKEN HITS:', explanationHits(dump.visibleText, dump.snapshot, dump.inspector));
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

  const addressNode = page
    .getByRole('listbox', { name: /Consequence graph nodes/i })
    .getByRole('button', { name: ADDRESS_RE })
    .filter({ hasNot: page.locator('[aria-disabled="true"]') });
  const addressCount = await addressNode.count().catch(() => 0);
  console.log('SETUP: enabled address node count', addressCount);
  if (addressCount < 1) {
    throw new Error('SETUP failed — enabled Забезпечити адресу для реєстрації not found');
  }
  console.log('SETUP: click Забезпечити адресу для реєстрації');
  await addressNode.first().click({ timeout: 8000 });
  await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2500);
  console.log('SETUP: post-STEP-23 state settled');

  console.log('');
  console.log('========================================');
  console.log('PROBE-002 / STEP 24 — ANMELDUNG AFTER ADDRESS VERIFIED');
  console.log('========================================');
  console.log('INTENT/ACTION: interact with Завершити Anmeldung (no force if disabled)');

  const before = await dumpUi();
  logDump('BEFORE ACTION', before);
  await page.screenshot({
    path: `${OUT}/step-24-before-registration-after-address.png`,
    fullPage: true,
  });
  console.log('SCREENSHOT BEFORE:', `${OUT}/step-24-before-registration-after-address.png`);

  const graphAnmeldung = page
    .getByRole('listbox', { name: /Consequence graph nodes/i })
    .getByRole('button', { name: ANMELDUNG_RE });
  const target = graphAnmeldung.first();
  const targetCount = await graphAnmeldung.count().catch(() => 0);
  const targetVisible = targetCount > 0 ? await target.isVisible().catch(() => false) : false;
  const targetNativeEnabled = targetVisible ? await target.isEnabled().catch(() => false) : false;
  const targetAriaDisabled = targetCount > 0
    ? await target.getAttribute('aria-disabled').catch(() => null)
    : null;
  const targetAriaSelected = targetCount > 0
    ? await target.getAttribute('aria-selected').catch(() => null)
    : null;
  const targetHref = targetCount > 0 ? await target.getAttribute('href').catch(() => null) : null;
  const targetTag = targetCount > 0
    ? await target.evaluate(el => el.tagName).catch(() => null)
    : null;
  const targetNativeDisabled = targetCount > 0
    ? await target.evaluate(el => Boolean(el.disabled)).catch(() => null)
    : null;
  const targetText = targetCount > 0
    ? await target.innerText().catch(() => '')
    : '';
  const uiDisabled = targetAriaDisabled === 'true' || targetNativeDisabled === true;
  const dumpNode = (before.inventory.graphNodes || []).find(node => ANMELDUNG_RE.test(node.text || ''));

  console.log('ANMELDUNG COUNT:', targetCount);
  console.log('ANMELDUNG TAG:', targetTag);
  console.log('ANMELDUNG VISIBLE:', targetVisible ? 'YES' : 'NO');
  console.log('ANMELDUNG TEXT/LABEL:', targetText.replace(/\s+/g, ' ').trim());
  console.log('ANMELDUNG NATIVE DISABLED:', targetNativeDisabled);
  console.log('ANMELDUNG PLAYWRIGHT isEnabled:', targetNativeEnabled ? 'YES' : 'NO');
  console.log('ANMELDUNG ARIA-DISABLED:', targetAriaDisabled);
  console.log('ANMELDUNG ARIA-SELECTED:', targetAriaSelected);
  console.log('ANMELDUNG HREF:', targetHref);
  console.log('ANMELDUNG DUMP NODE:', dumpNode || 'None');
  console.log('UI EXPOSES AS DISABLED:', uiDisabled ? 'YES' : 'NO');
  console.log('CURRENT INSPECTOR TITLE:', before.inspector?.title || 'None');
  console.log(
    'ANMELDUNG INSPECTOR AVAILABLE WITHOUT CLICK:',
    ANMELDUNG_RE.test(before.inspector?.title || '') ? 'YES' : 'NO'
  );

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
  if (!targetVisible) {
    console.log('ACTION: SKIPPED — Завершити Anmeldung not visible');
    console.log('NO SUBSTITUTE ACTION PERFORMED');
  } else if (uiDisabled) {
    console.log('ACTION: UI exposes Завершити Anmeldung as disabled (aria-disabled and/or native disabled)');
    console.log('ACTION: normal user click NOT dispatched — disabled state respected; force NOT used');
    console.log('NO SUBSTITUTE ACTION PERFORMED');
    clickMode = 'unavailable-disabled';
    await page.waitForTimeout(1500);
  } else {
    console.log('ACTION: Click Завершити Anmeldung (normal)');
    try {
      await target.click({ timeout: 8000 });
      clickMode = 'normal';
      console.log('CLICK MODE: normal');
      await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(2500);
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
  logDump('AFTER ACTION', after);
  await page.screenshot({
    path: `${OUT}/step-24-after-registration-after-address.png`,
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
      `${OUT}/step-24-registration-after-address-network.json`,
      JSON.stringify(interestingNetwork, null, 2)
    );
  }

  const newFailures = requestFailures.slice(errorCountsBefore.request);
  const rscPrefetchAborts = newFailures.filter(isRscPrefetchAbort);
  const otherFailures = newFailures.filter(failure => !isRscPrefetchAbort(failure));
  const buttonDiff = tokenDiff(buttonKeys(before.buttons), buttonKeys(after.buttons));
  const linkDiff = tokenDiff(linkKeys(before.links), linkKeys(after.links));
  const urlChanged = before.url !== after.url;
  const inspectorChanged = JSON.stringify(before.inspector) !== JSON.stringify(after.inspector);
  const selectedChanged =
    JSON.stringify(before.inventory.selected) !== JSON.stringify(after.inventory.selected);
  const textChanged = before.visibleText !== after.visibleText;
  const uiChanged = urlChanged || inspectorChanged || selectedChanged || textChanged;
  const afterAnmeldung = (after.inventory.graphNodes || []).find(node =>
    ANMELDUNG_RE.test(node.text || '')
  );
  const beforeAnmeldung = dumpNode;
  const errorsYes =
    consoleErrors.slice(errorCountsBefore.console).length > 0 ||
    pageErrors.slice(errorCountsBefore.page).length > 0 ||
    otherFailures.length > 0;

  const blockedText = after.inspector?.sections?.Blocked || after.inspector?.sections?.blocked || '';
  const inspectorIsAnmeldung = ANMELDUNG_RE.test(after.inspector?.title || '');
  const blockedHasSpecificReason =
    Boolean(String(blockedText).trim()) &&
    !/^No direct constraints\.?$/i.test(String(blockedText).trim());
  const explicitAnmeldungReason = /Anmeldung.{0,80}(block|disabled|waiting|prerequisite|depend)|завершити Anmeldung.{0,80}(заблок|очікує|передумов|залежн)/i.test(
    `${after.visibleText || ''}\n${after.snapshot || ''}`
  );
  const visibleExplanation =
    (inspectorIsAnmeldung && (blockedHasSpecificReason || /Blocked/i.test(after.inspector?.statusParagraph || ''))) ||
    explicitAnmeldungReason;

  console.log('');
  console.log('--- STEP 24 COMPARISON ---');
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
  console.log('TARGET UI-DISABLED BEFORE:', uiDisabled ? 'YES' : 'NO');
  console.log('SELECTED BEFORE:', before.inventory.selected);
  console.log('SELECTED AFTER:', after.inventory.selected);
  console.log('SELECTED CHANGED:', selectedChanged ? 'YES' : 'NO');
  console.log('ANMELDUNG NODE BEFORE:', beforeAnmeldung || 'None');
  console.log('ANMELDUNG NODE AFTER:', afterAnmeldung || 'None');
  console.log('INSPECTOR BEFORE TITLE/STATUS:', before.inspector?.title, '|', before.inspector?.statusParagraph);
  console.log('INSPECTOR AFTER TITLE/STATUS:', after.inspector?.title, '|', after.inspector?.statusParagraph);
  console.log('INSPECTOR CHANGED:', inspectorChanged ? 'YES' : 'NO');
  console.log('INSPECTOR AFTER SECTIONS:', after.inspector?.sections || 'None');
  console.log('INSPECTOR AFTER ACTIONS:', after.inspector?.actions || 'None');
  console.log('RECOMMENDED BEFORE:', recommendedFromBanners(before.statusBanners));
  console.log('RECOMMENDED AFTER:', recommendedFromBanners(after.statusBanners));
  console.log('ARRIVING FROM BEFORE:', before.arrivingFrom);
  console.log('ARRIVING FROM AFTER:', after.arrivingFrom);
  console.log('BUTTONS APPEARED:', buttonDiff.appeared.length ? buttonDiff.appeared : 'None');
  console.log('BUTTONS DISAPPEARED:', buttonDiff.disappeared.length ? buttonDiff.disappeared : 'None');
  console.log('LINKS APPEARED:', linkDiff.appeared.length ? linkDiff.appeared : 'None');
  console.log('LINKS DISAPPEARED:', linkDiff.disappeared.length ? linkDiff.disappeared : 'None');
  console.log('FORMS BEFORE/AFTER:', before.formCount, '→', after.formCount);
  console.log('DIALOGS BEFORE/AFTER:', before.dialogCount, '→', after.dialogCount);
  console.log('LOADING AFTER:', after.loading > 0 ? `YES (${after.loading})` : 'None');
  console.log('ALERTS AFTER:', after.alerts.length ? after.alerts : 'None');
  console.log('VISIBLE TEXT CHANGED:', textChanged ? 'YES' : 'NO');
  console.log('UI CHANGE:', uiChanged ? 'YES' : 'NO');
  console.log(
    'NETWORK:',
    interestingNetwork.length
      ? interestingNetwork
      : 'No network activity caused by the attempted interaction.'
  );
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
      ? `${OUT}/step-24-registration-after-address-network.json`
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
  console.log('ACTION: Inspector links / address node / healthcare / Back / profile NOT CLICKED');
  console.log('SCREENSHOT AFTER:', `${OUT}/step-24-after-registration-after-address.png`);

  console.log('');
  console.log('========================================');
  console.log('STEP 24 SUMMARY');
  console.log('========================================');
  console.log('STEP: 24');
  console.log(
    'intended action:',
    'click Завершити Anmeldung (respect disabled; no force; no substitute)'
  );
  console.log('target enabled/disabled:', uiDisabled ? 'disabled' : 'enabled');
  console.log('click mode:', clickMode);
  console.log('URL before:', before.url);
  console.log('URL after:', after.url);
  console.log('selected node before:', JSON.stringify(before.inventory.selected));
  console.log('selected node after:', JSON.stringify(after.inventory.selected));
  console.log('Anmeldung status/label:', (afterAnmeldung?.text || targetText).replace(/\s+/g, ' ').trim());
  console.log('Inspector Status:', after.inspector?.statusParagraph || 'None');
  console.log('Inspector Blocked:', after.inspector?.sections?.Blocked || after.inspector?.sections?.blocked || 'None');
  console.log('Inspector Actions:', after.inspector?.actions?.length ? after.inspector.actions : after.inspector?.sections?.Actions || 'None');
  console.log('Inspector Unlocks:', after.inspector?.sections?.Unlocks || after.inspector?.sections?.unlocks || 'None');
  console.log('Inspector currently for:', after.inspector?.title || 'None');
  console.log('visible explanation of the block: yes/no:', visibleExplanation ? 'yes' : 'no');
  console.log('navigation: yes/no:', urlChanged ? 'yes' : 'no');
  console.log('UI change: yes/no:', uiChanged ? 'yes' : 'no');
  console.log('network: yes/no:', interestingNetwork.length ? 'yes' : 'no');
  console.log('errors: yes/no:', errorsYes ? 'yes' : 'no');
  console.log('artifact paths:');
  console.log(`  ${OUT}/step-24-before-registration-after-address.png`);
  console.log(`  ${OUT}/step-24-after-registration-after-address.png`);
  if (interestingNetwork.length) {
    console.log(`  ${OUT}/step-24-registration-after-address-network.json`);
  }
} finally {
  await browser.close();
}
