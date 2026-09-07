import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const BASE_URL = 'https://arrival-atlas.pro';
const OUT = 'tools/black-box-audit/artifacts/probe-005';
const WORK_GROWTH_RE = /Work\s*&\s*Growth|Work and Growth|Робота.*зростан|зростан/i;
const CONTINUE_PLAN_RE = /Continue Your Plan|Продовжити (ваш )?план/i;
const LIFE_PLAN_RE = /Open your life plan|Відкри(ти|йте) (свій )?план/i;
const EMPLOYMENT_RE =
  /work|jobs?|employment|employed|employer|career|profession|income|salary|opportunity|opportunities|network|skills?|вакан|зайнят|працевлашт|робот|кар[ʼ'’]?єр|дохід|зарплат|можливост|навичок|мереж/i;
const WORK_TERM_RE =
  /work|job|jobs|employment|employed|career|income|salary|profession|opportunity|вакан|зайнят|працевлашт|робот|кар[ʼ'’]?єр|дохід|зарплат/i;

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
    documentNav: /GET/i.test(entry.method) && /document/i.test(entry.resourceType || ''),
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
    /\/api\/|\/modules\/|_rsc|rsc=|mutation|execute|\/run|ui-snapshot|user-context|profile|work|job|employment|discovery|openai|anthropic|\/ai\//i.test(
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
  if (phase === 'after-continuation-click' && isUnexpectedWriteOrExecution(entry)) {
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

async function dumpJourneySlides() {
  return page.evaluate(() => {
    const textOf = el => (el.textContent || '').replace(/\s+/g, ' ').trim();
    const nav = [...document.querySelectorAll('nav, [role="navigation"]')].find(el =>
      /Journey slides|Journey/i.test(el.getAttribute('aria-label') || '')
    );
    const buttons = [...(nav ? nav.querySelectorAll('button, a, [role="button"]') : [])];
    return buttons.map((el, index) => ({
      index,
      tag: el.tagName,
      role: el.getAttribute('role'),
      href: el.getAttribute('href'),
      text: textOf(el),
      ariaLabel: el.getAttribute('aria-label'),
      ariaSelected: el.getAttribute('aria-selected'),
      ariaCurrent: el.getAttribute('aria-current'),
      ariaPressed: el.getAttribute('aria-pressed'),
      ariaDisabled: el.getAttribute('aria-disabled'),
      disabled: Boolean(el.disabled) || el.getAttribute('aria-disabled') === 'true',
      visible: !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length),
    }));
  });
}

async function dumpActionCandidates() {
  return page.evaluate(source => {
    const ACTION_RE = new RegExp(source, 'i');
    const textOf = el => (el.textContent || '').replace(/\s+/g, ' ').trim();
    const isVisible = el => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
    const blobOf = el =>
      `${textOf(el)} ${el.getAttribute('aria-label') || ''} ${el.getAttribute('href') || ''}`;
    const interactive = [...document.querySelectorAll('a, button, [role="button"], [role="link"]')]
      .filter(isVisible)
      .map(el => ({
        interactive: true,
        tag: el.tagName,
        role: el.getAttribute('role') || (el.tagName === 'A' ? 'link' : el.tagName === 'BUTTON' ? 'button' : null),
        href: el.getAttribute('href'),
        text: textOf(el).slice(0, 240),
        ariaLabel: el.getAttribute('aria-label'),
        disabled: Boolean(el.disabled) || el.getAttribute('aria-disabled') === 'true',
        inHeader: Boolean(el.closest('header, [role="banner"]')),
        inJourneyNav: Boolean(el.closest('[aria-label*="Journey" i]')),
        inMain: Boolean(el.closest('main')),
        employmentLike: ACTION_RE.test(blobOf(el)),
      }));
    const nonInteractive = [];
    const seen = new Set();
    for (const el of document.querySelectorAll('p, span, li, dt, dd, h1, h2, h3, h4, h5, label, div')) {
      if (!isVisible(el)) {
        continue;
      }
      if (el.closest('a, button, [role="button"], [role="link"]')) {
        continue;
      }
      const text = textOf(el);
      if (!text || text.length > 140) {
        continue;
      }
      if (!ACTION_RE.test(text) && !/continue your plan|see what'?s next|open your life plan|explore opportunities|grow your network|improve your skills|enter your atlas/i.test(text)) {
        continue;
      }
      const key = `${el.tagName}:${text}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      nonInteractive.push({
        interactive: false,
        tag: el.tagName,
        role: el.getAttribute('role'),
        href: null,
        text: text.slice(0, 240),
        ariaLabel: el.getAttribute('aria-label'),
        disabled: null,
        inHeader: Boolean(el.closest('header, [role="banner"]')),
        inJourneyNav: Boolean(el.closest('[aria-label*="Journey" i]')),
        inMain: Boolean(el.closest('main')),
        employmentLike: ACTION_RE.test(text),
      });
    }
    return { interactive, nonInteractive };
  }, EMPLOYMENT_RE.source);
}

async function dumpGraphNodes() {
  const fromListbox = await page
    .getByRole('listbox', { name: /Consequence graph nodes/i })
    .getByRole('button')
    .evaluateAll(els =>
      els.map(el => ({
        text: (el.textContent || '').replace(/\s+/g, ' ').trim(),
        disabled: el.disabled,
        ariaDisabled: el.getAttribute('aria-disabled'),
        ariaSelected: el.getAttribute('aria-selected'),
        visible: el.offsetParent !== null || el.getClientRects().length > 0,
      }))
    )
    .catch(() => []);
  if (fromListbox.length) {
    return fromListbox;
  }
  return page.evaluate(() => {
    const textOf = el => (el.textContent || '').replace(/\s+/g, ' ').trim();
    return [...document.querySelectorAll('[role="listbox"] button, [role="listbox"] [role="option"], [class*="galaxy"] button')]
      .map(el => ({
        text: textOf(el),
        disabled: Boolean(el.disabled),
        ariaDisabled: el.getAttribute('aria-disabled'),
        ariaSelected: el.getAttribute('aria-selected'),
        visible: !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length),
      }))
      .filter(n => n.text)
      .slice(0, 40);
  });
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
      selected: el.getAttribute('aria-selected'),
    }))
  );
  const links = await page.getByRole('link').evaluateAll(els =>
    els.map(el => ({
      text: (el.textContent || '').replace(/\s+/g, ' ').trim(),
      href: el.getAttribute('href'),
      ariaLabel: el.getAttribute('aria-label'),
    }))
  );
  const inputs = await page.locator('input, select, textarea').evaluateAll(els =>
    els.map(el => ({
      tag: el.tagName.toLowerCase(),
      type: el.getAttribute('type'),
      id: el.id || null,
      visible: el.offsetParent !== null || el.getClientRects().length > 0,
    }))
  );
  const snapshot = await page.locator('body').ariaSnapshot();
  const visibleText = await page.locator('body').innerText();
  const journeySlides = await dumpJourneySlides();
  const actionCandidates = await dumpActionCandidates();
  const graphNodes = await dumpGraphNodes();
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
  const blob = `${visibleText}\n${snapshot}`;
  return {
    url: page.url(),
    title: await page.title(),
    lang: await page.locator('html').getAttribute('lang'),
    headings,
    buttons,
    links,
    inputs,
    formCount: await page.locator('form').count(),
    journeySlides,
    currentSlide:
      journeySlides.find(
        s =>
          s.ariaSelected === 'true' ||
          s.ariaPressed === 'true' ||
          s.ariaCurrent === 'true' ||
          s.ariaCurrent === 'step' ||
          Boolean(s.ariaCurrent)
      ) || null,
    actionCandidates,
    graphNodes,
    currentItems,
    workTermHits: [...new Set((blob.match(new RegExp(WORK_TERM_RE.source, 'gi')) || []).map(s => s.toLowerCase()))],
    employmentHits: [...new Set((blob.match(new RegExp(EMPLOYMENT_RE.source, 'gi')) || []).map(s => s.toLowerCase()))],
    welcomeVisible: await page.getByRole('dialog').first().isVisible().catch(() => false),
    statusBanners: await page.locator('[role="status"]').allTextContents().catch(() => []),
    alerts: await page.locator('[role="alert"]').allTextContents().catch(() => []),
    snapshot,
    visibleText,
    loading: await page
      .locator('[class*="loading"], [class*="spinner"], [aria-busy="true"], [class*="skeleton"]')
      .count(),
  };
}

function logDump(label, dump) {
  console.log('');
  console.log(`--- ${label} ---`);
  console.log('URL:', dump.url);
  console.log('TITLE:', dump.title);
  console.log('LANG:', dump.lang);
  console.log('HEADINGS:', dump.headings);
  console.log('CURRENT SLIDE:', dump.currentSlide || 'None');
  console.log('JOURNEY SLIDES:', dump.journeySlides);
  console.log('BUTTONS:', dump.buttons);
  console.log('LINKS:', dump.links);
  console.log('INPUTS:', dump.inputs);
  console.log('FORM COUNT:', dump.formCount);
  console.log('GRAPH NODES:', dump.graphNodes?.length ? dump.graphNodes : 'None');
  console.log('CURRENT/SELECTED:', dump.currentItems);
  console.log('INTERACTIVE CONTROLS:', dump.actionCandidates?.interactive || []);
  console.log('ACTION-LOOKING NON-INTERACTIVE:', dump.actionCandidates?.nonInteractive || []);
  console.log('WORK TERM HITS:', dump.workTermHits?.length ? dump.workTermHits : 'None');
  console.log('EMPLOYMENT-LIKE HITS:', dump.employmentHits?.length ? dump.employmentHits : 'None');
  console.log('WELCOME DIALOG:', dump.welcomeVisible ? 'VISIBLE (left untouched)' : 'None');
  console.log('LOADING:', dump.loading > 0 ? `YES (${dump.loading})` : 'None');
  console.log('ALERTS:', dump.alerts?.length ? dump.alerts : 'None');
  console.log('MAIN VISIBLE TEXT (first 8000 chars):');
  console.log((dump.visibleText || '').slice(0, 8000));
  console.log('ACCESSIBILITY SNAPSHOT:');
  console.log(dump.snapshot);
}

function isHeaderNavOnly(control) {
  if (!control.inHeader) {
    return false;
  }
  const blob = `${control.text || ''} ${control.href || ''}`;
  return /\/modules\/(life-event|economic-reality|discovery)|\/profile\/?$|^\/$/i.test(control.href || '') ||
    /досліджувати atlas|життєві події|економічна|поиск|пошук|профіль|arrival atlas|вийти з демо/i.test(blob);
}

function pickContinuation(dump) {
  const interactive = (dump.actionCandidates?.interactive || []).filter(c => !c.disabled);
  const slideInteractive = interactive.filter(c => !c.inJourneyNav && !isHeaderNavOnly(c));

  const directEmployment = slideInteractive.filter(c => {
    const blob = `${c.text} ${c.ariaLabel || ''} ${c.href || ''}`;
    if (CONTINUE_PLAN_RE.test(blob) || LIFE_PLAN_RE.test(blob)) {
      return false;
    }
    return (
      /\/profile\/work|work-income|\/modules\/discovery|employment|job|career|вакан|зайнят/i.test(blob) ||
      (/work|робот|opportunity|можливост/i.test(blob) && /\/modules\/|\/profile\//i.test(c.href || ''))
    );
  });
  if (directEmployment.length) {
    return {
      control: directEmployment[0],
      reason: 'explicit employment-related interactive control on Work & Growth (not header nav)',
      fallback: false,
    };
  }

  const continuePlan = slideInteractive.find(c => CONTINUE_PLAN_RE.test(`${c.text} ${c.ariaLabel || ''}`));
  if (continuePlan) {
    return {
      control: continuePlan,
      reason: 'no explicit employment-related interactive control; Continue Your Plan is the interactive continuation',
      fallback: true,
    };
  }

  const lifeEventCta = slideInteractive.find(c => /\/modules\/life-event/i.test(c.href || ''));
  if (lifeEventCta) {
    return {
      control: lifeEventCta,
      reason: 'no explicit employment control; visible slide CTA navigates to /modules/life-event',
      fallback: true,
    };
  }

  return {
    control: null,
    reason: 'no interactive continuation found on Work & Growth',
    fallback: true,
  };
}

function classifyDestination(dump) {
  const url = dump.url || '';
  const text = dump.visibleText || '';
  const workNodes = (dump.graphNodes || []).filter(n => WORK_TERM_RE.test(n.text || ''));
  if (/\/modules\/life-event/i.test(url)) {
    if (workNodes.length) {
      return 'Life Events (work/employment node visible)';
    }
    return 'Life Events (no visible Work/Employment node)';
  }
  if (/\/profile\/work-income|\/profile\/work/i.test(url)) {
    return 'Work & income Profile';
  }
  if (/\/profile/i.test(url)) {
    return 'Profile (not specifically Work & income route)';
  }
  if (/\/modules\/discovery/i.test(url)) {
    return 'Discovery';
  }
  if (/\/modules\//i.test(url) && /work|job|employ/i.test(url)) {
    return 'dedicated employment module';
  }
  if (/\/modules\//i.test(url)) {
    return `another module surface (${url})`;
  }
  if (WORK_TERM_RE.test(text) && /complete|not added|work & income/i.test(text)) {
    return 'another surface with Work & income copy';
  }
  return 'no meaningful employment destination / still on landing';
}

async function settle() {
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
}

try {
  console.log('NETWORK CAPTURE: started before onboarding');
  console.log('READ-ONLY STEP 46: one continuation click after Work & Growth; no profile/discovery mutation');

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
  await page.getByRole('navigation', { name: /Journey slides/i }).waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});

  phase = 'initial-journey';
  const initial = await dumpUi();
  logDump('INITIAL JOURNEY', initial);
  await page.screenshot({ path: `${OUT}/step-46-initial-journey.png`, fullPage: true });

  console.log('SETUP: navigate to Work & Growth / slide 06');
  const journeyNav = page.getByRole('navigation', { name: /Journey slides/i });
  const slide06 = journeyNav.getByRole('button', { name: /Slide 06: Work & Growth|Work & Growth|^06$/i }).first();
  await slide06.click({ timeout: 8000 });
  await settle();
  await page.locator('a.atlas-slide__cta, a[href="/modules/life-event"]').filter({ hasText: CONTINUE_PLAN_RE }).first().waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(2000);

  phase = 'work-growth';
  const before = await dumpUi();
  logDump('WORK & GROWTH (BEFORE CONTINUATION)', before);
  await page.screenshot({ path: `${OUT}/step-46-work-growth.png`, fullPage: true });

  const picked = pickContinuation(before);
  console.log('CONTINUATION PICK:', picked);
  console.log('INTERACTIVE EMPLOYMENT-LIKE ON SLIDE:',
    (before.actionCandidates?.interactive || []).filter(c => c.employmentLike && !c.inJourneyNav && !isHeaderNavOnly(c))
  );
  console.log('NON-INTERACTIVE ACTION-LOOKING:', before.actionCandidates?.nonInteractive || []);

  let clickMode = 'skipped';
  let clickError = null;
  let clickedLabel = null;
  if (!picked.control) {
    console.log('CLICK SKIPPED:', picked.reason);
  } else {
    clickedLabel = `${picked.control.tag} text=${picked.control.text} href=${picked.control.href}`;
    console.log('ACTION: one click:', clickedLabel);
    console.log('WHY:', picked.reason);
    phase = 'after-continuation-click';
    try {
      let target;
      if (CONTINUE_PLAN_RE.test(picked.control.text || '')) {
        target = page.getByRole('link', { name: CONTINUE_PLAN_RE }).first();
      } else if (picked.control.href) {
        const href = picked.control.href;
        const text = (picked.control.text || '').replace(/[→⟶]/g, '').trim();
        target = page
          .locator(`a[href="${href}"]`)
          .filter({ hasText: text ? new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') : /./ })
          .first();
      } else {
        target = page.getByRole('button', { name: picked.control.text || picked.control.ariaLabel }).first();
      }
      try {
        await target.click({ timeout: 10000 });
        clickMode = 'normal';
      } catch (error) {
        const unstable = /not stable|Timeout|intercepts pointer/i.test(String(error.message || error));
        if (!unstable) {
          throw error;
        }
        console.log('CLICK MODE: force:true — element not stable for normal click');
        await target.click({ force: true, timeout: 8000 });
        clickMode = 'force';
      }
      await page.waitForURL(/\/modules\/|\/profile\//, { timeout: 15000 }).catch(() => {});
      await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
      await settle();
    } catch (error) {
      clickMode = 'failed';
      clickError = String(error.message || error).slice(0, 800);
      console.log('CLICK FAILED:', clickError);
    }
  }

  const after = await dumpUi();
  logDump('AFTER CONTINUATION CLICK', after);
  await page.screenshot({ path: `${OUT}/step-46-after-continuation.png`, fullPage: true });
  await fs.writeFile(
    `${OUT}/step-46-employment-entry-network.json`,
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

  const afterNet = captured.filter(e => e.phase === 'after-continuation-click');
  const writes = afterNet.filter(e => /POST|PUT|PATCH|DELETE/i.test(e.method));
  const mutations = afterNet.filter(e => e.flags?.mutations);
  const executions = afterNet.filter(looksLikeExecution);
  const providers = afterNet.filter(looksLikeProvider);
  const unexpected = afterNet.filter(e => e.flags?.unexpectedWriteOrExecution);
  const rsc = afterNet.filter(e => e.flags?.rsc);
  const reads = afterNet.filter(e => /GET/i.test(e.method));
  const urlChanged = before.url !== after.url;
  const destination = classifyDestination(after);
  const workNodes = (after.graphNodes || []).filter(n => WORK_TERM_RE.test(n.text || ''));

  console.log('');
  console.log('--- STEP 46 COMPARISON ---');
  console.log('CLICK MODE:', clickMode);
  if (clickError) console.log('CLICK ERROR:', clickError);
  console.log('CLICKED:', clickedLabel || 'none');
  console.log('WHY:', picked.reason);
  console.log('FALLBACK TO CONTINUE YOUR PLAN:', picked.fallback ? 'YES' : 'NO');
  console.log('URL BEFORE:', before.url);
  console.log('URL AFTER:', after.url);
  console.log('NAVIGATION:', urlChanged ? 'YES' : 'NO');
  console.log('DESTINATION CLASS:', destination);
  console.log('WORK-RELATED GRAPH NODES:', workNodes.length ? workNodes : 'None');
  console.log('AFTER-CLICK NETWORK:', afterNet.length ? summarizeNetwork(afterNet) : 'None');
  console.log(
    'CONSOLE ERRORS AFTER:',
    consoleErrors.filter(e => e.phase === 'after-continuation-click').length
      ? consoleErrors.filter(e => e.phase === 'after-continuation-click')
      : 'None'
  );
  console.log(
    'PAGE ERRORS AFTER:',
    pageErrors.filter(e => e.phase === 'after-continuation-click').length
      ? pageErrors.filter(e => e.phase === 'after-continuation-click')
      : 'None'
  );
  console.log(
    'REQUEST FAILURES AFTER:',
    requestFailures.filter(e => e.phase === 'after-continuation-click').length
      ? requestFailures.filter(e => e.phase === 'after-continuation-click')
      : 'None'
  );
  if (stopReason) console.log('STOP REASON:', stopReason);

  console.log('');
  console.log('========================================');
  console.log('STEP 46 SUMMARY');
  console.log('========================================');
  console.log('STEP: 46');
  console.log('classification:', destination);
  console.log('click mode:', clickMode);
  console.log('action chosen:', clickedLabel);
  console.log('why:', picked.reason);
  console.log('initial URL:', initial.url);
  console.log('work-growth URL:', before.url);
  console.log('after URL:', after.url);
  console.log('navigation:', urlChanged ? 'yes' : 'no');
  console.log('lang:', after.lang);
  console.log('work-growth H1:', (before.headings || []).filter(h => h.tag === 'H1'));
  console.log('forms/inputs after:', { forms: after.formCount, inputs: after.inputs });
  console.log('work terms after:', after.workTermHits);
  console.log('graph nodes after:', after.graphNodes);
  console.log('welcome after:', after.welcomeVisible);
  console.log('reads after click:', reads.length);
  console.log('rsc after click:', rsc.length);
  console.log('mutations after click:', mutations.length ? summarizeNetwork(mutations) : 'None');
  console.log('writes after click:', writes.length ? summarizeNetwork(writes) : 'None');
  console.log('execution/AI after click:', executions.length || providers.length ? 'YES' : 'None');
  console.log('unexpected writes after click:', unexpected.length ? summarizeNetwork(unexpected) : 'None');
  console.log('STEP 46 performed no intentional profile modification and no Discovery execution.');
  console.log('artifact paths:');
  console.log(`  ${OUT}/step-46-initial-journey.png`);
  console.log(`  ${OUT}/step-46-work-growth.png`);
  console.log(`  ${OUT}/step-46-after-continuation.png`);
  console.log(`  ${OUT}/step-46-employment-entry-network.json`);
} finally {
  await browser.close();
}
