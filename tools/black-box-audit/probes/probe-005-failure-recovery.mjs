import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const BASE_URL = 'https://arrival-atlas.pro';
const OUT = 'tools/black-box-audit/artifacts/probe-005';
const PROFILE_NAV_RE = /Профіль|Профиль|Profile/i;
const LIFE_EVENT_NAV_RE = /Життєві події|Life Events?/i;
const ANMELDUNG_RE = /Anmeldung|Завершити Anmeldung|Registration|реєстрац/i;

await fs.mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage();

const consoleErrors = [];
const pageErrors = [];
const requestFailures = [];
const captured = [];
const requestStartedAt = new WeakMap();
let seq = 0;
let phase = 'setup';
let stopReason = null;

page.on('console', msg => {
  if (msg.type() === 'error') {
    consoleErrors.push({ phase, text: msg.text() });
  }
});
page.on('pageerror', error => {
  pageErrors.push({ phase, message: error.message });
});
page.on('request', request => {
  requestStartedAt.set(request, Date.now());
});
page.on('requestfailed', request => {
  requestFailures.push({
    phase,
    seq: seq + 1,
    url: safeUrl(request.url()),
    method: request.method(),
    failure: request.failure()?.errorText ?? 'unknown',
  });
});

function safeUrl(raw) {
  try {
    const u = new URL(raw);
    u.searchParams.forEach((value, key) => {
      if (/token|key|secret|auth|password|session/i.test(key)) {
        u.searchParams.set(key, '[REDACTED]');
      }
    });
    return u.toString();
  } catch {
    return raw;
  }
}

function hostnameOf(raw) {
  try {
    return new URL(raw).hostname;
  } catch {
    return null;
  }
}

function redactSecrets(value) {
  if (value == null) {
    return value;
  }
  if (typeof value === 'string') {
    if (/^eyJ/.test(value) && value.length > 20) {
      return '[REDACTED]';
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(redactSecrets);
  }
  if (typeof value === 'object') {
    const out = {};
    for (const [key, child] of Object.entries(value)) {
      if (/token|secret|password|authorization|cookie|apikey|api_key|access_token|refresh_token/i.test(key)) {
        out[key] = '[REDACTED]';
      } else {
        out[key] = redactSecrets(child);
      }
    }
    return out;
  }
  return value;
}

function looksLikeExecution(entry) {
  const blob = `${entry.method} ${entry.url} ${entry.requestPayload || ''}`;
  return /\/execute|\/run(?!-summary)|\/generate|openai|anthropic|\/ai\/|prompt|generation/i.test(blob);
}

function looksLikeProvider(entry) {
  const host = hostnameOf(entry.url) || '';
  return /openai|anthropic|generativelanguage|groq|mistral|together|fireworks|openrouter/i.test(`${host} ${entry.url}`);
}

function isLanguagePref(entry) {
  const payload = String(entry.requestPayload || '');
  return /\/api\/mutations/i.test(entry.url) && /preferredLanguage|pref\.update/i.test(payload);
}

function isUnexpectedWriteOrExecution(entry) {
  if (looksLikeExecution(entry) || looksLikeProvider(entry)) {
    return true;
  }
  if (/\/execute/i.test(entry.url) || /\/run(?!-summary)/i.test(entry.url)) {
    return true;
  }
  if (/PUT|PATCH|DELETE/i.test(entry.method)) {
    if (/\/api\/sessions?\//i.test(entry.url) && phase === 'setup') {
      return false;
    }
    return true;
  }
  if (/POST/i.test(entry.method)) {
    if (isLanguagePref(entry)) {
      return false;
    }
    if (/\/api\/sessions?(\/|$|\?)/i.test(entry.url) && phase === 'setup') {
      return false;
    }
    return true;
  }
  return false;
}

function classifyRequest(entry) {
  return {
    languagePref: isLanguagePref(entry),
    pageNavigation: /GET/i.test(entry.method) && /\/(modules|profile)/i.test(entry.url) && !/\/api\//.test(entry.url),
    profileRead: /GET/i.test(entry.method) && /\/api\/(user-context|profile-insights|ui-snapshot|profile)/i.test(entry.url),
    lifeEventRead: /GET/i.test(entry.method) && /\/api\/modules\/life-event/i.test(entry.url),
    discoveryRead: /GET/i.test(entry.method) && /\/api\/modules\/discovery/i.test(entry.url),
    mutations: /\/api\/mutations/i.test(entry.url),
    writeMethod: /POST|PUT|PATCH|DELETE/i.test(entry.method),
    execute: /\/execute/i.test(entry.url),
    executionLike: looksLikeExecution(entry),
    providerLike: looksLikeProvider(entry),
    rsc: /[?&]_rsc=|_rsc/i.test(entry.url),
    unexpectedWriteOrExecution: isUnexpectedWriteOrExecution(entry),
  };
}

async function recordResponse(response) {
  const request = response.request();
  const url = safeUrl(response.url());
  const method = request.method();
  const host = hostnameOf(url);
  const resourceType = request.resourceType();
  const interesting =
    /\/api\/|\/modules\/|_rsc|rsc=|mutation|execute|\/run|ui-snapshot|user-context|profile|life-event|anmeld|openai|anthropic|\/ai\//i.test(
      `${method} ${url}`
    ) ||
    looksLikeProvider({ url }) ||
    ((/POST|PUT|PATCH|DELETE/i.test(method)) && /xhr|fetch|document/i.test(resourceType));
  if (!interesting) {
    return;
  }
  let responseBody = null;
  try {
    const contentType = response.headers()['content-type'] || '';
    if (contentType.includes('json')) {
      responseBody = await response.json();
    } else {
      responseBody = (await response.text()).slice(0, 4000);
    }
  } catch {
    responseBody = null;
  }
  seq += 1;
  const started = requestStartedAt.get(request);
  const entry = {
    seq,
    phase,
    timestamp: new Date().toISOString(),
    durationMs: started ? Date.now() - started : null,
    method,
    url,
    hostname: host,
    status: response.status(),
    resourceType,
    requestPayload: redactSecrets(request.postData() || null),
    responseBody: redactSecrets(responseBody),
  };
  entry.flags = classifyRequest(entry);
  captured.push(entry);
  if (/^action-/.test(phase) && isUnexpectedWriteOrExecution(entry)) {
    stopReason = `Unexpected write/execution: ${method} ${url} status=${response.status()}`;
  }
}

page.on('response', response => {
  recordResponse(response).catch(() => {});
});

function summarizeNetwork(list) {
  return list.map(entry => ({
    seq: entry.seq,
    phase: entry.phase,
    method: entry.method,
    status: entry.status,
    resourceType: entry.resourceType,
    url: entry.url,
    flags: entry.flags,
    requestPayload: entry.requestPayload,
  }));
}

function isUiDisabled(control) {
  if (!control) {
    return null;
  }
  return Boolean(control.disabled) || control.ariaDisabled === 'true';
}

async function dumpGraphNodes() {
  return page
    .getByRole('listbox', { name: /Consequence graph nodes/i })
    .getByRole('button')
    .evaluateAll(els =>
      els.map((el, index) => ({
        index,
        text: (el.textContent || '').replace(/\s+/g, ' ').trim(),
        disabled: el.disabled,
        ariaDisabled: el.getAttribute('aria-disabled'),
        ariaSelected: el.getAttribute('aria-selected'),
        visible: el.offsetParent !== null || el.getClientRects().length > 0,
      }))
    )
    .catch(() => []);
}

async function dumpInspector() {
  return page.evaluate(() => {
    const textOf = el => (el.textContent || '').replace(/\s+/g, ' ').trim();
    const root = document.querySelector('[role="complementary"]') || document.querySelector('aside');
    if (!root) {
      return null;
    }
    const titleEl = root.querySelector('h3, h2, h1');
    const paragraphs = [...root.querySelectorAll('p')].map(el => textOf(el)).filter(Boolean);
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
    const actions = [...root.querySelectorAll('a, button, [role="button"], [role="link"]')].map(el => ({
      tag: el.tagName,
      role: el.getAttribute('role'),
      text: textOf(el),
      href: el.getAttribute('href'),
      disabled: Boolean(el.disabled) || el.getAttribute('aria-disabled') === 'true',
    }));
    return {
      title: titleEl ? textOf(titleEl) : null,
      statusParagraph: paragraphs[0] || null,
      paragraphs,
      sections,
      actions,
      raw: textOf(root).slice(0, 4000),
    };
  });
}

async function dumpUi() {
  const headings = await page.locator('h1, h2, h3, h4, h5, h6').evaluateAll(
    els => els.map(e => ({ tag: e.tagName, text: e.textContent.trim() }))
  );
  const buttons = await page.getByRole('button').evaluateAll(els =>
    els.map(el => ({
      text: (el.textContent || '').replace(/\s+/g, ' ').trim(),
      disabled: el.disabled,
      ariaDisabled: el.getAttribute('aria-disabled'),
      ariaLabel: el.getAttribute('aria-label'),
      selected: el.getAttribute('aria-selected'),
    }))
  );
  const links = await page.getByRole('link').evaluateAll(els =>
    els.map(el => ({
      text: (el.textContent || '').replace(/\s+/g, ' ').trim(),
      href: el.getAttribute('href'),
      ariaCurrent: el.getAttribute('aria-current'),
    }))
  );
  const snapshot = await page.locator('body').ariaSnapshot();
  const visibleText = await page.locator('body').innerText();
  const graphNodes = await dumpGraphNodes();
  const inspector = await dumpInspector();
  const currentItems = await page
    .locator('[aria-current="page"], [aria-current="true"], [aria-selected="true"]')
    .evaluateAll(els =>
      els.map(el => ({
        tag: el.tagName,
        text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 200),
        ariaCurrent: el.getAttribute('aria-current'),
        ariaSelected: el.getAttribute('aria-selected'),
      }))
    )
    .catch(() => []);
  const anmeldungNode = findAnmeldungNode(graphNodes);
  const welcomeVisible = await page.getByRole('dialog').first().isVisible().catch(() => false);
  return {
    url: page.url(),
    title: await page.title(),
    lang: await page.locator('html').getAttribute('lang'),
    headings,
    buttons,
    links,
    graphNodes,
    inspector,
    currentItems,
    anmeldungNode,
    anmeldungDisabled: isUiDisabled(anmeldungNode),
    anmeldungSelected: anmeldungNode?.ariaSelected === 'true',
    welcomeVisible,
    statusBanners: await page.locator('[role="status"]').allTextContents().catch(() => []),
    alerts: await page.locator('[role="alert"]').allTextContents().catch(() => []),
    successTexts: await page
      .getByText(/success|успіш|збереж|оновлен/i)
      .allTextContents()
      .catch(() => []),
    snapshot,
    visibleText,
    loading: await page
      .locator('[class*="loading"], [class*="spinner"], [aria-busy="true"], [class*="skeleton"]')
      .count(),
  };
}

function summarizeBlockedState(dump) {
  const inspector = dump.inspector || {};
  return {
    url: dump.url,
    lang: dump.lang,
    selected: dump.currentItems,
    anmeldung: {
      node: dump.anmeldungNode,
      disabled: dump.anmeldungDisabled,
      selected: dump.anmeldungSelected,
    },
    inspectorTitle: inspector.title,
    status: inspector.statusParagraph,
    context: inspector.sections?.Context || null,
    unlocks: inspector.sections?.Unlocks || null,
    blocked: inspector.sections?.Blocked || null,
    actions: inspector.actions || [],
    recommendations: inspector.sections?.Recommendations || null,
    welcomeVisible: dump.welcomeVisible,
    statusBanners: dump.statusBanners,
    loading: dump.loading,
  };
}

function hasVisibleRecoveryAffordance(dump) {
  const inspector = dump.inspector || {};
  const actions = inspector.actions || [];
  const actionsText = inspector.sections?.Actions || '';
  const blocked = `${inspector.sections?.Blocked || ''} ${inspector.raw || ''}`;
  const context = `${inspector.sections?.Context || ''} ${inspector.paragraphs?.join(' ') || ''}`;
  const actionable = actions.filter(a => !a.disabled && (a.href || a.tag === 'BUTTON' || a.tag === 'A'));
  const actionLookingTextOnly =
    actionable.length === 0 &&
    /вивчити|оновити|відкрити|редагув|керівниц|guide|update|open|edit/i.test(actionsText);
  const explainsWhy =
    /blocked|waiting|require|need|address|адрес|залеж|очіку|cannot|не мож|unavailable|earlier step|попередн|bürgeramt|burgeramt|термін/i.test(
      `${blocked} ${context} ${inspector.statusParagraph || ''}`
    );
  const blockedContradiction =
    /blocked/i.test(inspector.statusParagraph || '') && /no direct constraints/i.test(inspector.sections?.Blocked || '');
  const nextStepHint =
    /next|наступн|recommended|рекоменд|start|почат|open|відкри|update|онов|complete|заверш/i.test(
      `${JSON.stringify(actions)} ${inspector.sections?.Recommendations || ''} ${dump.visibleText || ''}`
    );
  const clear = explainsWhy && actionable.length > 0 && !actionLookingTextOnly && !blockedContradiction;
  return {
    explainsWhy,
    hasActions: actionable.length > 0,
    actionable,
    actionLookingTextOnly,
    blockedContradiction,
    nextStepHint,
    clear,
  };
}

function findAnmeldungNode(nodes) {
  return (
    (nodes || []).find(n => /Завершити Anmeldung/i.test(n.text || '')) ||
    (nodes || []).find(n => /^Anmeldung\b/i.test(n.text || '')) ||
    null
  );
}

function classifyRecovery(beforeLeave, afterReturn, recovery) {
  if (!beforeLeave) {
    return 'ambiguous';
  }
  const beforeSelectedText = (beforeLeave.currentItems || []).find(i => i.ariaSelected === 'true')?.text || '';
  const afterSelectedText = (afterReturn?.currentItems || []).find(i => i.ariaSelected === 'true')?.text || '';
  const beforeTitle = beforeLeave.inspector?.title;
  const afterTitle = afterReturn?.inspector?.title;
  const beforeStatus = beforeLeave.inspector?.statusParagraph;
  const afterStatus = afterReturn?.inspector?.statusParagraph;

  const stateLost =
    (/Anmeldung/i.test(beforeSelectedText) || /Anmeldung/i.test(beforeTitle || '')) &&
    !/Anmeldung/i.test(afterSelectedText) &&
    !/Anmeldung/i.test(afterTitle || '');

  if (stateLost) {
    return 'state lost after navigation';
  }

  const preserved =
    /Anmeldung/i.test(afterTitle || '') ||
    /Anmeldung/i.test(afterSelectedText) ||
    /blocked/i.test(afterStatus || '');

  if (preserved && recovery.clear) {
    return 'recovery path clear';
  }
  if (preserved && !recovery.clear) {
    return 'state preserved but recovery unclear';
  }
  if (!recovery.clear) {
    return 'recovery path unclear';
  }
  return 'ambiguous';
}

function logDump(label, dump) {
  console.log('');
  console.log(`--- ${label} ---`);
  console.log('URL:', dump.url);
  console.log('TITLE:', dump.title);
  console.log('LANG:', dump.lang);
  console.log('HEADINGS:', dump.headings);
  console.log('GRAPH NODES:', dump.graphNodes);
  console.log('SELECTED:', dump.currentItems);
  console.log('ANMELDUNG NODE:', dump.anmeldungNode || 'not found');
  console.log('ANMELDUNG DISABLED:', dump.anmeldungDisabled);
  console.log('ANMELDUNG SELECTED:', dump.anmeldungSelected);
  console.log('INSPECTOR:', dump.inspector);
  console.log('LINKS:', dump.links);
  console.log('BUTTONS:', dump.buttons);
  console.log('WELCOME:', dump.welcomeVisible ? 'VISIBLE' : 'None');
  console.log('LOADING:', dump.loading > 0 ? `YES (${dump.loading})` : 'None');
  console.log('ALERTS:', dump.alerts?.length ? dump.alerts : 'None');
  console.log('STATUS BANNERS:', dump.statusBanners?.length ? dump.statusBanners : 'None');
  console.log('SUCCESS TEXTS:', dump.successTexts?.length ? dump.successTexts : 'None');
  console.log('BLOCKED SUMMARY:', summarizeBlockedState(dump));
  console.log('MAIN VISIBLE TEXT (first 7000 chars):');
  console.log((dump.visibleText || '').slice(0, 7000));
  console.log('ACCESSIBILITY SNAPSHOT:');
  console.log(dump.snapshot);
}

async function settle() {
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
}

try {
  console.log('NETWORK CAPTURE: started before onboarding');
  console.log('READ-ONLY STEP 50: blocked Anmeldung failure/recovery; leave to Profile and return');

  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
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
  await settle();
  console.log('SETUP: open Життєві події');
  await page
    .getByRole('navigation', { name: /Основна навігація/i })
    .getByRole('link', { name: LIFE_EVENT_NAV_RE })
    .click({ timeout: 8000 });
  await page.waitForURL(/\/modules\/life-event/, { timeout: 15000 }).catch(() => {});
  await settle();

  const welcome = page.getByRole('dialog');
  if (await welcome.first().isVisible().catch(() => false)) {
    console.log('SETUP: dismiss welcome via Досліджувати самостійно');
    await welcome.getByRole('button', { name: /Досліджувати самостійно/i }).click({ timeout: 8000 });
    await welcome.waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
    await settle();
  }

  phase = 'baseline-life-events';
  const baseline = await dumpUi();
  logDump('BASELINE LIFE EVENTS (AFTER WELCOME DISMISS)', baseline);
  await page.screenshot({ path: `${OUT}/step-50-baseline-life-events.png`, fullPage: true });

  // ACTION 1 — select Anmeldung if interactable
  phase = 'action-1-anmeldung';
  let action1Mode = 'skipped';
  let action1Error = null;
  const anmeldungBtn = page
    .getByRole('listbox', { name: /Consequence graph nodes/i })
    .getByRole('button', { name: /Завершити Anmeldung|Anmeldung/i })
    .first();
  const anmeldungVisible = await anmeldungBtn.isVisible().catch(() => false);
  const anmeldungDisabledAttr = anmeldungVisible
    ? await anmeldungBtn.getAttribute('aria-disabled').catch(() => null)
    : null;
  const anmeldungNativeDisabled = anmeldungVisible ? await anmeldungBtn.isDisabled().catch(() => true) : true;
  const anmeldungUiDisabled = anmeldungNativeDisabled || anmeldungDisabledAttr === 'true';
  console.log('ACTION 1 TARGET:', {
    visible: anmeldungVisible,
    nativeDisabled: anmeldungNativeDisabled,
    ariaDisabled: anmeldungDisabledAttr,
    uiDisabled: anmeldungUiDisabled,
  });

  if (!anmeldungVisible) {
    console.log('ACTION 1 SKIPPED: Anmeldung node not visible');
  } else if (anmeldungUiDisabled) {
    console.log('ACTION 1 SKIPPED: Anmeldung node disabled; force NOT used');
    action1Mode = 'skipped-disabled';
  } else {
    console.log('ACTION 1: select Anmeldung / registration node once');
    try {
      await anmeldungBtn.click({ timeout: 8000 });
      action1Mode = 'normal';
      await settle();
    } catch (error) {
      action1Mode = 'failed';
      action1Error = String(error.message || error).slice(0, 800);
      console.log('ACTION 1 FAILED; force NOT used:', action1Error);
    }
  }

  const afterAnmeldung = await dumpUi();
  logDump('AFTER ACTION 1 (ANMELDUNG SELECTED / INSPECTED)', afterAnmeldung);
  await page.screenshot({ path: `${OUT}/step-50-after-anmeldung.png`, fullPage: true });
  const recovery = hasVisibleRecoveryAffordance(afterAnmeldung);
  console.log('RECOVERY AFFORDANCE:', recovery);

  // ACTION 2 — leave to Profile
  phase = 'action-2-to-profile';
  let action2Mode = 'skipped';
  let action2Error = null;
  console.log('ACTION 2: navigate to Профіль via main nav');
  try {
    await page
      .getByRole('navigation', { name: /Основна навігація/i })
      .getByRole('link', { name: PROFILE_NAV_RE })
      .click({ timeout: 8000 });
    action2Mode = 'normal';
    await page.waitForURL(/\/profile/, { timeout: 15000 }).catch(() => {});
    await settle();
    const profileWelcome = page.getByRole('dialog');
    if (await profileWelcome.first().isVisible().catch(() => false)) {
      console.log('Profile welcome visible — dismiss via Досліджувати самостійно for readable Profile state');
      await profileWelcome.getByRole('button', { name: /Досліджувати самостійно/i }).click({ timeout: 8000 });
      await profileWelcome.waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
      await settle();
    }
  } catch (error) {
    action2Mode = 'failed';
    action2Error = String(error.message || error).slice(0, 800);
    console.log('ACTION 2 FAILED; force NOT used:', action2Error);
  }

  const afterProfile = await dumpUi();
  logDump('AFTER ACTION 2 (PROFILE)', afterProfile);
  await page.screenshot({ path: `${OUT}/step-50-after-profile.png`, fullPage: true });

  // ACTION 3 — return to Life Events
  phase = 'action-3-return-life-events';
  let action3Mode = 'skipped';
  let action3Error = null;
  console.log('ACTION 3: return to Життєві події via main nav');
  try {
    await page
      .getByRole('navigation', { name: /Основна навігація/i })
      .getByRole('link', { name: LIFE_EVENT_NAV_RE })
      .click({ timeout: 8000 });
    action3Mode = 'normal';
    await page.waitForURL(/\/modules\/life-event/, { timeout: 15000 }).catch(() => {});
    await settle();
  } catch (error) {
    action3Mode = 'failed';
    action3Error = String(error.message || error).slice(0, 800);
    console.log('ACTION 3 FAILED; force NOT used:', action3Error);
  }

  const afterReturn = await dumpUi();
  logDump('AFTER ACTION 3 (RETURN LIFE EVENTS)', afterReturn);
  await page.screenshot({ path: `${OUT}/step-50-after-return-life-events.png`, fullPage: true });

  const classification = classifyRecovery(afterAnmeldung, afterReturn, recovery);
  const action1Net = captured.filter(e => e.phase === 'action-1-anmeldung');
  const action2Net = captured.filter(e => e.phase === 'action-2-to-profile');
  const action3Net = captured.filter(e => e.phase === 'action-3-return-life-events');
  const allActionNet = [...action1Net, ...action2Net, ...action3Net];
  const mutations = allActionNet.filter(e => e.flags?.mutations);
  const writes = allActionNet.filter(e => /POST|PUT|PATCH|DELETE/i.test(e.method));
  const executions = allActionNet.filter(looksLikeExecution);
  const providers = allActionNet.filter(looksLikeProvider);
  const unexpected = allActionNet.filter(e => e.flags?.unexpectedWriteOrExecution);
  const discovery = allActionNet.filter(e => e.flags?.discoveryRead || /\/modules\/discovery/i.test(e.url));

  await fs.writeFile(
    `${OUT}/step-50-failure-recovery-network.json`,
    JSON.stringify(
      captured.map(e => ({
        ...e,
        requestPayload: redactSecrets(e.requestPayload),
        responseBody: redactSecrets(e.responseBody),
      })),
      null,
      2
    )
  );
  await fs.writeFile(
    `${OUT}/step-50-state-comparison.json`,
    JSON.stringify(
      {
        classification,
        recovery,
        actionModes: { action1Mode, action2Mode, action3Mode },
        beforeLeave: summarizeBlockedState(afterAnmeldung),
        atProfile: summarizeBlockedState(afterProfile),
        afterReturn: summarizeBlockedState(afterReturn),
      },
      null,
      2
    )
  );

  console.log('');
  console.log('--- STEP 50 COMPARISON ---');
  console.log('CLASSIFICATION:', classification);
  console.log('ACTION MODES:', { action1Mode, action2Mode, action3Mode });
  if (action1Error) console.log('ACTION 1 ERROR:', action1Error);
  if (action2Error) console.log('ACTION 2 ERROR:', action2Error);
  if (action3Error) console.log('ACTION 3 ERROR:', action3Error);
  console.log('BEFORE LEAVE:', summarizeBlockedState(afterAnmeldung));
  console.log('AT PROFILE:', summarizeBlockedState(afterProfile));
  console.log('AFTER RETURN:', summarizeBlockedState(afterReturn));
  console.log('RECOVERY:', recovery);
  console.log('ACTION1 NETWORK:', action1Net.length ? summarizeNetwork(action1Net) : 'None');
  console.log('ACTION2 NETWORK:', action2Net.length ? summarizeNetwork(action2Net) : 'None');
  console.log('ACTION3 NETWORK:', action3Net.length ? summarizeNetwork(action3Net) : 'None');
  console.log('MUTATIONS:', mutations.length ? summarizeNetwork(mutations) : 'None');
  console.log('WRITES:', writes.length ? summarizeNetwork(writes) : 'None');
  console.log('DISCOVERY:', discovery.length ? summarizeNetwork(discovery) : 'None');
  console.log('EXECUTION/AI:', executions.length || providers.length ? 'YES' : 'None');
  console.log('UNEXPECTED WRITES:', unexpected.length ? summarizeNetwork(unexpected) : 'None');
  console.log(
    'CONSOLE ERRORS:',
    consoleErrors.filter(e => /^action-/.test(e.phase)).length
      ? consoleErrors.filter(e => /^action-/.test(e.phase))
      : 'None'
  );
  console.log(
    'PAGE ERRORS:',
    pageErrors.filter(e => /^action-/.test(e.phase)).length
      ? pageErrors.filter(e => /^action-/.test(e.phase))
      : 'None'
  );
  console.log(
    'REQUEST FAILURES:',
    requestFailures.filter(e => /^action-/.test(e.phase)).length
      ? requestFailures.filter(e => /^action-/.test(e.phase))
      : 'None'
  );
  if (stopReason) console.log('STOP REASON:', stopReason);

  console.log('');
  console.log('========================================');
  console.log('STEP 50 SUMMARY');
  console.log('========================================');
  console.log('STEP: 50');
  console.log('classification:', classification);
  console.log('lang:', afterReturn.lang);
  console.log('anmeldung before leave:', afterAnmeldung.anmeldungNode);
  console.log('inspector before leave:', {
    title: afterAnmeldung.inspector?.title,
    status: afterAnmeldung.inspector?.statusParagraph,
    context: afterAnmeldung.inspector?.sections?.Context,
    unlocks: afterAnmeldung.inspector?.sections?.Unlocks,
    blocked: afterAnmeldung.inspector?.sections?.Blocked,
    recommendations: afterAnmeldung.inspector?.sections?.Recommendations,
    actions: afterAnmeldung.inspector?.actions,
  });
  console.log('anmeldung after return:', afterReturn.anmeldungNode);
  console.log('inspector after return:', {
    title: afterReturn.inspector?.title,
    status: afterReturn.inspector?.statusParagraph,
    context: afterReturn.inspector?.sections?.Context,
    unlocks: afterReturn.inspector?.sections?.Unlocks,
    blocked: afterReturn.inspector?.sections?.Blocked,
    recommendations: afterReturn.inspector?.sections?.Recommendations,
    actions: afterReturn.inspector?.actions,
  });
  console.log('recovery clear?:', recovery.clear);
  console.log('explains why blocked?:', recovery.explainsWhy);
  console.log('has actionable recovery controls?:', recovery.hasActions);
  console.log('STEP 50 performed no intentional profile modification and no Discovery execution.');
  console.log('artifact paths:');
  console.log(`  ${OUT}/step-50-baseline-life-events.png`);
  console.log(`  ${OUT}/step-50-after-anmeldung.png`);
  console.log(`  ${OUT}/step-50-after-profile.png`);
  console.log(`  ${OUT}/step-50-after-return-life-events.png`);
  console.log(`  ${OUT}/step-50-failure-recovery-network.json`);
  console.log(`  ${OUT}/step-50-state-comparison.json`);
} finally {
  await browser.close();
}
