import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const BASE_URL = 'https://arrival-atlas.pro';
const OUT = 'tools/black-box-audit/artifacts/probe-004';
const DISCOVERY_NAV_RE = /Пошук|Поиск|Discovery/i;
const PROFILE_NAV_RE = /Профіль|Профиль|Profile/i;
const FAMILY_RE =
  /family|families|partner|spouse|ehepartner|child(?:ren)?|household|familie|kinder|haushalt|kindergeld|elterngeld|сім[ʼ'’']?я|сім[ʼ'’']?ї|родин[аиеи]?|партнер|дитин(?:а|и|і)?|діте(?:й|и)?|подружж|чоловік|дружин|батьк|домогосподар/i;
const MUTATION_CTA_RE =
  /виправити дані|редагув|змінити|изменить|edit|зберег|сохран|save|створ|создать|create|видал|удал|remove|delete|запусти|execute|submit|надіслати|отправить/i;

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
  return /openai|anthropic|generativelanguage|groq|mistral|together|fireworks|openrouter|azure\.openai|bedrock|vertexai/i.test(
    `${host} ${entry.url}`
  );
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
    userContext: /\/api\/user-context/i.test(entry.url),
    profileInsights: /\/api\/profile-insights/i.test(entry.url),
    uiSnapshot: /\/api\/ui-snapshot/i.test(entry.url),
    lifeEventRead: /GET/i.test(entry.method) && /\/api\/modules\/life-event/i.test(entry.url),
    economicRead: /GET/i.test(entry.method) && /\/api\/modules\/economic-reality/i.test(entry.url),
    mutations: /\/api\/mutations/i.test(entry.url),
    writeMethod: /POST|PUT|PATCH|DELETE/i.test(entry.method),
    execute: /\/execute/i.test(entry.url),
    runEndpoint: /\/run(?!-summary)/i.test(entry.url),
    executionLike: looksLikeExecution(entry),
    providerLike: looksLikeProvider(entry),
    unexpectedWriteOrExecution: isUnexpectedWriteOrExecution(entry),
  };
}

async function recordResponse(response) {
  const request = response.request();
  const url = safeUrl(response.url());
  const method = request.method();
  const host = hostnameOf(url);
  const resourceType = request.resourceType();
  const isApp = /arrival-atlas\.pro$/i.test(host || '');
  const interesting =
    /\/api\/|\/modules\/|_rsc|rsc=|mutation|execute|\/run|intent|ui-snapshot|user-context|profile|openai|anthropic|\/ai\//i.test(
      `${method} ${url}`
    ) ||
    looksLikeProvider({ url }) ||
    (!isApp && /xhr|fetch/i.test(resourceType)) ||
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
      responseBody = (await response.text()).slice(0, 8000);
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
  if (phase !== 'setup' && isUnexpectedWriteOrExecution(entry)) {
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
    url: entry.url,
    flags: entry.flags,
    requestPayload: entry.requestPayload,
  }));
}

function findFamilyHits(text) {
  const source = String(text || '');
  const re = new RegExp(FAMILY_RE.source, 'gi');
  const hits = source.match(re) || [];
  return [...new Set(hits.map(h => h.toLowerCase()))];
}

function familyOccurrences(dump) {
  const rows = [];
  for (const h of dump.headings || []) {
    if (FAMILY_RE.test(h.text || '')) {
      rows.push({ kind: 'heading', tag: h.tag, text: h.text, enabled: null, href: null });
    }
  }
  for (const b of dump.buttons || []) {
    const blob = `${b.text} ${b.ariaLabel || ''}`;
    if (FAMILY_RE.test(blob)) {
      rows.push({
        kind: 'button',
        text: b.text,
        ariaLabel: b.ariaLabel,
        enabled: !(b.disabled || b.ariaDisabled === 'true'),
        href: null,
      });
    }
  }
  for (const l of dump.links || []) {
    const blob = `${l.text} ${l.ariaLabel || ''} ${l.href || ''}`;
    if (FAMILY_RE.test(blob)) {
      rows.push({
        kind: 'link',
        text: l.text,
        ariaLabel: l.ariaLabel,
        enabled: true,
        href: l.href,
      });
    }
  }
  for (const n of dump.navLinks || []) {
    if (FAMILY_RE.test(`${n.text} ${n.href || ''}`)) {
      rows.push({ kind: 'navigation', text: n.text, href: n.href, enabled: true });
    }
  }
  return rows;
}

function extractFamilyFields(value, acc = [], path = '') {
  if (value == null) {
    return acc;
  }
  if (Array.isArray(value)) {
    value.forEach((item, i) => extractFamilyFields(item, acc, `${path}[${i}]`));
    return acc;
  }
  if (typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      const next = path ? `${path}.${key}` : key;
      if (/partner|child|children|household|family|hasPartner|hasChildren|spouse|kinder|familie/i.test(key)) {
        acc.push({ path: next, value: child });
      } else {
        extractFamilyFields(child, acc, next);
      }
    }
  }
  return acc;
}

function findAiWording(text) {
  const patterns = [/\bAI\b/gi, /\bLLM\b/gi, /OpenAI/gi, /Anthropic/gi, /\bcredits?\b/gi, /\bcost\b/gi, /generate/gi];
  const hits = [];
  for (const re of patterns) {
    const found = String(text || '').match(re);
    if (found) {
      hits.push(...found);
    }
  }
  return [...new Set(hits.map(h => h.toLowerCase()))];
}

async function dumpUi() {
  const headings = await page.locator('h1, h2, h3, h4, h5, h6').evaluateAll(
    els => els.map(e => ({ tag: e.tagName, text: e.textContent.trim() }))
  );
  const buttons = await page.getByRole('button').evaluateAll(els =>
    els.map(el => ({
      text: (el.textContent || '').replace(/\s+/g, ' ').trim(),
      type: el.getAttribute('type'),
      disabled: el.disabled,
      ariaDisabled: el.getAttribute('aria-disabled'),
      ariaLabel: el.getAttribute('aria-label'),
    }))
  );
  const links = await page.getByRole('link').evaluateAll(els =>
    els.map(el => ({
      text: (el.textContent || '').replace(/\s+/g, ' ').trim(),
      href: el.getAttribute('href'),
      ariaLabel: el.getAttribute('aria-label'),
    }))
  );
  const navLinks = await page
    .getByRole('navigation', { name: /Основна навігація/i })
    .getByRole('link')
    .evaluateAll(els =>
      els.map(el => ({
        text: (el.textContent || '').replace(/\s+/g, ' ').trim(),
        href: el.getAttribute('href'),
      }))
    )
    .catch(() => []);
  const snapshot = await page.locator('body').ariaSnapshot();
  const visibleText = await page.locator('body').innerText();
  const blob = `${visibleText}\n${snapshot}\n${buttons.map(b => b.text).join('\n')}\n${links.map(l => l.text).join('\n')}`;
  const tabs = await page
    .getByRole('tab')
    .evaluateAll(els =>
      els.map(el => ({
        text: (el.textContent || '').replace(/\s+/g, ' ').trim(),
        selected: el.getAttribute('aria-selected'),
        current: el.getAttribute('aria-current'),
        disabled: el.disabled || el.getAttribute('aria-disabled') === 'true',
      }))
    )
    .catch(() => []);
  const currentItems = await page.locator('[aria-current="page"], [aria-current="true"], [aria-selected="true"]').evaluateAll(
    els =>
      els.map(el => ({
        tag: el.tagName,
        role: el.getAttribute('role'),
        text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 160),
        ariaCurrent: el.getAttribute('aria-current'),
        ariaSelected: el.getAttribute('aria-selected'),
      }))
  ).catch(() => []);
  const dump = {
    url: page.url(),
    title: await page.title(),
    lang: await page.locator('html').getAttribute('lang'),
    headings,
    buttons,
    links,
    navLinks,
    tabs,
    currentItems,
    disabledControls: buttons.filter(b => b.disabled || b.ariaDisabled === 'true'),
    snapshot,
    visibleText,
    statusBanners: await page.locator('[role="status"]').allTextContents().catch(() => []),
    alerts: await page.locator('[role="alert"]').allTextContents().catch(() => []),
    arrivingFrom: await page.getByText(/Arriving from/i).allTextContents().catch(() => []),
    familyHits: findFamilyHits(blob),
    familyButtons: buttons.filter(b => FAMILY_RE.test(`${b.text} ${b.ariaLabel || ''}`)),
    familyLinks: links.filter(l => FAMILY_RE.test(`${l.text} ${l.ariaLabel || ''} ${l.href || ''}`)),
    discoveryNavPresent: navLinks.some(l => DISCOVERY_NAV_RE.test(l.text) || /discovery/i.test(l.href || '')),
    profileNavPresent: navLinks.some(l => PROFILE_NAV_RE.test(l.text) || /\/profile/i.test(l.href || '')),
    economicNavPresent: navLinks.some(l => /економічн|economic/i.test(`${l.text} ${l.href || ''}`)),
    benefitsNavPresent: navLinks.some(l => /benefit|допомог|виплат/i.test(`${l.text} ${l.href || ''}`)),
    editActionBtns: buttons.filter(b => MUTATION_CTA_RE.test(`${b.text} ${b.ariaLabel || ''}`)),
    aiHits: findAiWording(`${visibleText}\n${snapshot}`),
    loading: await page
      .locator('[class*="loading"], [class*="spinner"], [aria-busy="true"], [class*="skeleton"]')
      .count(),
  };
  dump.familyOccurrences = familyOccurrences(dump);
  return dump;
}

function logDump(label, dump) {
  console.log('');
  console.log(`--- ${label} ---`);
  console.log('URL:', dump.url);
  console.log('TITLE:', dump.title);
  console.log('LANG:', dump.lang);
  console.log('HEADINGS:', dump.headings);
  console.log('NAV LINKS:', dump.navLinks);
  console.log('BUTTONS:', dump.buttons);
  console.log('LINKS:', dump.links);
  console.log('FAMILY TERM HITS:', dump.familyHits.length ? dump.familyHits : 'None visible');
  console.log('FAMILY OCCURRENCES:', dump.familyOccurrences?.length ? dump.familyOccurrences : 'None');
  console.log('FAMILY BUTTONS:', dump.familyButtons.length ? dump.familyButtons : 'None');
  console.log('FAMILY LINKS:', dump.familyLinks.length ? dump.familyLinks : 'None');
  console.log('TABS / JOURNEY SLIDES:', dump.tabs?.length ? dump.tabs : 'None');
  console.log('CURRENT/SELECTED:', dump.currentItems?.length ? dump.currentItems : 'None');
  console.log('DISABLED CONTROLS:', dump.disabledControls?.length ? dump.disabledControls : 'None');
  console.log('MUTATION/ACTION CTAs:', dump.editActionBtns.length ? dump.editActionBtns : 'None');
  console.log('ARRIVING FROM:', dump.arrivingFrom.length ? dump.arrivingFrom : 'Not found');
  console.log('AI / COST / PROVIDER WORD HITS:', dump.aiHits.length ? dump.aiHits : 'None');
  console.log('LOADING:', dump.loading > 0 ? `YES (${dump.loading})` : 'None');
  console.log('ALERTS:', dump.alerts.length ? dump.alerts : 'None');
  console.log('MAIN VISIBLE TEXT (first 8000 chars):');
  console.log((dump.visibleText || '').slice(0, 8000));
  console.log('ACCESSIBILITY SNAPSHOT:');
  console.log(dump.snapshot);
}

function isDiscoveryControl(item) {
  const blob = `${item.text || ''} ${item.ariaLabel || ''} ${item.href || ''}`;
  return DISCOVERY_NAV_RE.test(blob) || /\/modules\/discovery/i.test(blob);
}

function isHeaderProfileNav(item) {
  const blob = `${item.text || ''} ${item.ariaLabel || ''} ${item.href || ''}`;
  return PROFILE_NAV_RE.test(blob) || /\/profile\/?$/i.test(item.href || '');
}

function pickJourneyFamilyControl(dump) {
  const candidates = [...dump.familyButtons, ...dump.familyLinks].filter(item => {
    const blob = `${item.text || ''} ${item.ariaLabel || ''} ${item.href || ''}`;
    if (!FAMILY_RE.test(blob)) {
      return false;
    }
    if (isDiscoveryControl(item)) {
      return false;
    }
    if (MUTATION_CTA_RE.test(blob)) {
      return false;
    }
    if (isHeaderProfileNav(item)) {
      return false;
    }
    return true;
  });
  return candidates[0] || null;
}

async function settle() {
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
}

try {
  console.log('NETWORK CAPTURE: started before onboarding');
  console.log('READ-ONLY STEP 41: no create/edit/save/execute; do not enter Discovery');

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

  phase = 'after-journey';
  const journey = await dumpUi();
  logDump('AFTER SETUP / JOURNEY VISIBLE', journey);
  await page.screenshot({ path: `${OUT}/step-41-family-entry.png`, fullPage: true });

  let action = 'none';
  let actionLabel = null;
  let profileOpened = false;
  let after = journey;

  const journeyFamily = pickJourneyFamilyControl(journey);
  if (stopReason) {
    console.log('ACTION SKIPPED:', stopReason);
  } else if (journeyFamily) {
    actionLabel = journeyFamily.text || journeyFamily.ariaLabel || journeyFamily.href;
    console.log('ACTION: click one family-related Journey control:', actionLabel);
    phase = 'after-family-surface';
    const locator = journeyFamily.href
      ? page.getByRole('link', { name: new RegExp(String(journeyFamily.text || journeyFamily.ariaLabel).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }).first()
      : page.getByRole('button', { name: new RegExp(String(journeyFamily.text || journeyFamily.ariaLabel).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }).first();
    await locator.click({ timeout: 8000 });
    await settle();
    action = 'journey-family-control';
    after = await dumpUi();
    await page.screenshot({ path: `${OUT}/step-41-family-entry.png`, fullPage: true });
  } else if (journey.profileNavPresent) {
    console.log('No family Journey control visible. Opening Профіль once (read-only navigation).');
    phase = 'after-profile';
    await page
      .getByRole('navigation', { name: /Основна навігація/i })
      .getByRole('link', { name: PROFILE_NAV_RE })
      .click({ timeout: 8000 });
    await page.waitForURL(/\/profile/, { timeout: 15000 }).catch(() => {});
    await settle();
    action = 'profile-nav';
    profileOpened = true;
    after = await dumpUi();
    await page.screenshot({ path: `${OUT}/step-41-family-profile.png`, fullPage: true });
  } else {
    console.log('No family Journey control and no Profile nav. No further click.');
  }

  logDump('INSPECTED SURFACE', after);
  await fs.writeFile(
    `${OUT}/step-41-family-entry-network.json`,
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

  const langPrefs = captured.filter(e => e.flags?.languagePref);
  const pageNav = captured.filter(e => e.flags?.pageNavigation);
  const profileReads = captured.filter(e => e.flags?.profileRead);
  const lifeEventReads = captured.filter(e => e.flags?.lifeEventRead);
  const economicReads = captured.filter(e => e.flags?.economicRead);
  const writes = captured.filter(e => /POST|PUT|PATCH|DELETE/i.test(e.method));
  const unexpected = captured.filter(e => e.flags?.unexpectedWriteOrExecution && e.phase !== 'setup');
  const executions = captured.filter(looksLikeExecution);
  const providers = captured.filter(looksLikeProvider);
  const setupNet = captured.filter(e => e.phase === 'setup');
  const inspectNet = captured.filter(e => e.phase !== 'setup');
  const backendFamily = captured.flatMap(e =>
    extractFamilyFields(e.responseBody).map(f => ({ seq: e.seq, phase: e.phase, url: e.url, ...f }))
  );
  const surfaceFamily = (after.familyOccurrences || []).length > 0 || (after.familyHits || []).length > 0;
  const journeyFamilyVisible = (journey.familyOccurrences || []).length > 0;
  let classification = 'none';
  if (action === 'profile-nav') {
    classification = after.editActionBtns.length ? 'read-only state display (edit controls present, not clicked)' : 'read-only state display';
  } else if (action === 'journey-family-control') {
    classification = 'presentation/navigation';
  } else if (journeyFamilyVisible) {
    classification = 'presentation/navigation';
  } else if (!surfaceFamily) {
    classification = 'none — no family-related surface found after Journey and navigation inspection';
  }

  console.log('');
  console.log('--- NETWORK ---');
  console.log('SETUP PHASE COUNT:', setupNet.length);
  console.log('INSPECTION PHASE COUNT:', inspectNet.length);
  console.log('A SESSION/LANGUAGE SETUP:', langPrefs.length ? summarizeNetwork(langPrefs) : 'None');
  console.log('B PAGE NAVIGATION:', pageNav.length ? summarizeNetwork(pageNav) : 'None');
  console.log('C PROFILE GET/READ:', profileReads.length ? summarizeNetwork(profileReads) : 'None');
  console.log('D LIFE-EVENT READS:', lifeEventReads.length ? summarizeNetwork(lifeEventReads) : 'None');
  console.log('E ECONOMIC READS:', economicReads.length ? summarizeNetwork(economicReads) : 'None');
  console.log('F MUTATIONS/WRITES:', writes.length ? summarizeNetwork(writes) : 'None');
  console.log('G EXECUTION/AI/PROVIDER:', executions.length || providers.length ? { executions: summarizeNetwork(executions), providers: summarizeNetwork(providers) } : 'None');
  console.log('UNEXPECTED AFTER SETUP:', unexpected.length ? summarizeNetwork(unexpected) : 'None');
  console.log('BACKEND/READ FAMILY FIELDS:', backendFamily.length ? backendFamily : 'None');
  if (stopReason) {
    console.log('STOP REASON:', stopReason);
  }

  console.log('');
  console.log('========================================');
  console.log('STEP 41 SUMMARY');
  console.log('========================================');
  console.log('STEP: 41');
  console.log('classification:', classification);
  console.log('family-related surface discovered:', surfaceFamily || action !== 'none' ? 'yes' : 'no');
  console.log('first meaningful family surface:', action === 'profile-nav' ? 'Profile (if family fields present)' : action === 'journey-family-control' ? actionLabel : journeyFamilyVisible ? 'Journey copy/control' : 'none');
  console.log('how it was reached:', action);
  console.log('read-only: yes');
  console.log('profile opened:', profileOpened ? 'yes' : 'no');
  console.log('URL:', after.url);
  console.log('title:', after.title);
  console.log('lang:', after.lang);
  console.log('family terminology visible:', after.familyHits.length ? after.familyHits : 'None');
  console.log('family occurrences:', after.familyOccurrences?.length ? after.familyOccurrences : 'None');
  console.log('execution/AI/provider traffic:', executions.length || providers.length ? 'YES' : 'None');
  console.log('Discovery entered:', /\/modules\/discovery/i.test(after.url) ? 'yes' : 'no');
  console.log('Economic Reality entered:', /economic-reality/i.test(after.url) ? 'yes' : 'no');
  console.log('STEP 41 performed no intentional profile modification and no Discovery execution.');
  if (!unexpected.length && !executions.length && !providers.length) {
    console.log('No unexpected write or AI/execution request was observed.');
  }
  console.log('artifact paths:');
  console.log(`  ${OUT}/step-41-family-entry.png`);
  if (profileOpened) {
    console.log(`  ${OUT}/step-41-family-profile.png`);
  }
  console.log(`  ${OUT}/step-41-family-entry-network.json`);
} finally {
  await browser.close();
}
