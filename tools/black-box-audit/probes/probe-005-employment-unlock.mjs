import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const BASE_URL = 'https://arrival-atlas.pro';
const OUT = 'tools/black-box-audit/artifacts/probe-005';
const PROFILE_NAV_RE = /Профіль|Профиль|Profile/i;
const WORK_INCOME_RE = /Work\s*&\s*income|Робота та дохід|Work and income/i;
const EMPLOYMENT_RE =
  /work|jobs?|employment|employed|employer|career|profession|income|salary|wage|earnings|job.?search|агент.*прац|зайнят|працевлашт|робот|кар[ʼ'’]?єр|дохід|зарплат|вакан|професі/i;
const UNLOCK_ACTION_RE =
  /unlock|розблок|enable|увімкн|open.*(work|job|employment|income)|оновити.*(робот|дохід)|update.*(work|income|employment)|edit.*(work|income)|виправити.*(робот|дохід)|start.*(job|work)|знайти робот|пошук вакан/i;

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
    discoveryRead: /GET/i.test(entry.method) && /\/api\/modules\/discovery/i.test(entry.url),
    mutations: /\/api\/mutations/i.test(entry.url),
    writeMethod: /POST|PUT|PATCH|DELETE/i.test(entry.method),
    execute: /\/execute/i.test(entry.url),
    executionLike: looksLikeExecution(entry),
    providerLike: looksLikeProvider(entry),
    workIncomePath: /work-income/i.test(entry.url),
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
  if (/after-unlock|inspect-node/.test(phase) && isUnexpectedWriteOrExecution(entry)) {
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
    return true;
  }
  return Boolean(control.disabled) || control.ariaDisabled === 'true';
}

function employmentHitsIn(text) {
  const matches = String(text || '').match(new RegExp(EMPLOYMENT_RE.source, 'gi')) || [];
  return [...new Set(matches.map(s => s.toLowerCase()))];
}

function looksLikeEmploymentUnlockAction(action) {
  const blob = `${action.text || ''} ${action.href || ''} ${action.ariaLabel || ''}`;
  if (/\/modules\/discovery|поиск|пошук/i.test(blob)) {
    return false;
  }
  if (/провідник|вийти з демо|скасув|cancel/i.test(blob)) {
    return false;
  }
  if (UNLOCK_ACTION_RE.test(blob)) {
    return true;
  }
  if (/\/profile\/work-income/i.test(action.href || '')) {
    return true;
  }
  if (EMPLOYMENT_RE.test(blob) && (/\/profile\/|\/modules\//i.test(action.href || '') || /button/i.test(action.tag || ''))) {
    // Edit of unrelated domains that merely mention "work" in English node labels elsewhere — require stronger match
    if (/language-display|where-you-live|household|health|benefits|move-to-germany/i.test(action.href || '')) {
      return /work-income|employment|income|job|salary|зайнят|дохід|робот/i.test(blob);
    }
    return true;
  }
  return false;
}

async function dumpGraphNodes() {
  return page
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
    const actions = [...root.querySelectorAll('a, button')].map(el => ({
      tag: el.tagName,
      text: textOf(el),
      href: el.getAttribute('href'),
      ariaLabel: el.getAttribute('aria-label'),
      disabled: Boolean(el.disabled) || el.getAttribute('aria-disabled') === 'true',
    }));
    const terms = [...root.querySelectorAll('dt, dd')].map(el => ({
      tag: el.tagName,
      text: textOf(el),
    }));
    return {
      title: titleEl ? textOf(titleEl) : null,
      statusParagraph: paragraphs[0] || null,
      paragraphs,
      sections,
      actions,
      terms,
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
      label: el.getAttribute('aria-label') || el.id,
      visible: el.offsetParent !== null || el.getClientRects().length > 0,
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
  return {
    url: page.url(),
    title: await page.title(),
    lang: await page.locator('html').getAttribute('lang'),
    headings,
    buttons,
    links,
    inputs,
    formCount: await page.locator('form').count(),
    graphNodes,
    inspector,
    currentItems,
    workIncomeNode: graphNodes.find(n => WORK_INCOME_RE.test(n.text || '')),
    employmentHits: employmentHitsIn(`${visibleText}\n${JSON.stringify(inspector || {})}`),
    statusBanners: await page.locator('[role="status"]').allTextContents().catch(() => []),
    alerts: await page.locator('[role="alert"]').allTextContents().catch(() => []),
    snapshot,
    visibleText,
    loading: await page
      .locator('[class*="loading"], [class*="spinner"], [aria-busy="true"], [class*="skeleton"]')
      .count(),
  };
}

function summarizeNodeInspection(nodeLabel, dump) {
  const inspector = dump.inspector || {};
  const actions = inspector.actions || [];
  const employmentUnlockActions = actions.filter(a => !a.disabled && looksLikeEmploymentUnlockAction(a));
  const employmentMentions = employmentHitsIn(
    `${inspector.raw || ''}\n${JSON.stringify(inspector.sections || {})}\n${JSON.stringify(inspector.terms || {})}`
  );
  return {
    nodeLabel,
    url: dump.url,
    selected: dump.currentItems,
    inspectorTitle: inspector.title,
    status: inspector.statusParagraph,
    sections: inspector.sections || {},
    terms: inspector.terms || [],
    actions,
    employmentMentions: employmentMentions.length ? employmentMentions : [],
    employmentUnlockActions,
    workIncomeStillDisabled: isUiDisabled(dump.workIncomeNode),
    workIncomeNode: dump.workIncomeNode || null,
  };
}

async function settle() {
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1200);
}

try {
  console.log('NETWORK CAPTURE: started before onboarding');
  console.log('READ-ONLY STEP 48: inspect enabled Profile nodes for employment unlock; no Discovery; no Work & income click');

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
  console.log('SETUP: open Профіль');
  await page
    .getByRole('navigation', { name: /Основна навігація/i })
    .getByRole('link', { name: PROFILE_NAV_RE })
    .click({ timeout: 8000 });
  await page.waitForURL(/\/profile/, { timeout: 15000 }).catch(() => {});
  await settle();

  const welcome = page.getByRole('dialog');
  if (await welcome.first().isVisible().catch(() => false)) {
    console.log('SETUP: dismiss welcome via Досліджувати самостійно');
    await welcome.getByRole('button', { name: /Досліджувати самостійно/i }).click({ timeout: 8000 });
    await welcome.waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
    await settle();
  }

  phase = 'baseline';
  const baseline = await dumpUi();
  console.log('');
  console.log('--- PROFILE BASELINE ---');
  console.log('URL:', baseline.url);
  console.log('TITLE:', baseline.title);
  console.log('LANG:', baseline.lang);
  console.log('GRAPH NODES:', baseline.graphNodes);
  console.log('SELECTED:', baseline.currentItems);
  console.log('WORK & INCOME:', baseline.workIncomeNode || 'not found');
  console.log('INSPECTOR:', baseline.inspector);
  console.log('EMPLOYMENT HITS:', baseline.employmentHits.length ? baseline.employmentHits : 'None');
  console.log('MAIN VISIBLE TEXT (first 4000 chars):');
  console.log((baseline.visibleText || '').slice(0, 4000));
  console.log('ACCESSIBILITY SNAPSHOT:');
  console.log(baseline.snapshot);
  await page.screenshot({ path: `${OUT}/step-48-baseline-profile.png`, fullPage: true });

  const nodeInspections = [];
  const candidates = (baseline.graphNodes || []).filter(n => n.visible);
  console.log('');
  console.log('NODES TO CONSIDER:', candidates.map(n => ({
    text: n.text,
    disabled: isUiDisabled(n),
    selected: n.ariaSelected,
    isWorkIncome: WORK_INCOME_RE.test(n.text || ''),
  })));

  let unlockCandidate = null;
  let unlockSourceNode = null;

  for (let index = 0; index < candidates.length; index += 1) {
    const node = candidates[index];
    const label = node.text;
    const isWorkIncome = WORK_INCOME_RE.test(label || '');
    if (isWorkIncome) {
      console.log(`SKIP (disabled Work & income policy): ${label}`);
      nodeInspections.push({
        nodeLabel: label,
        skipped: true,
        reason: 'Work & income is disabled in STEP 47; do not click',
        disabled: isUiDisabled(node),
        workIncomeNode: node,
      });
      continue;
    }
    if (isUiDisabled(node)) {
      console.log(`SKIP (disabled): ${label}`);
      nodeInspections.push({
        nodeLabel: label,
        skipped: true,
        reason: 'node disabled; force not used',
        disabled: true,
      });
      continue;
    }

    console.log(`INSPECT: select enabled node → ${label}`);
    phase = `inspect-node:${label.slice(0, 40)}`;
    const listbox = page.getByRole('listbox', { name: /Consequence graph nodes/i });
    const btn = listbox.getByRole('button').nth(index);
    try {
      await btn.click({ timeout: 8000 });
      await settle();
    } catch (error) {
      console.log('NODE SELECT FAILED; force NOT used:', String(error.message || error).slice(0, 400));
      nodeInspections.push({
        nodeLabel: label,
        skipped: true,
        reason: `select failed: ${String(error.message || error).slice(0, 200)}`,
        disabled: false,
      });
      continue;
    }

    const dump = await dumpUi();
    const summary = summarizeNodeInspection(label, dump);
    nodeInspections.push(summary);
    console.log('NODE INSPECTION SUMMARY:', JSON.stringify(summary, null, 2));
    await page.screenshot({
      path: `${OUT}/step-48-inspect-${label
        .toLowerCase()
        .replace(/[^a-z0-9]+/gi, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 48)}.png`,
      fullPage: true,
    });

    if (!unlockCandidate && summary.employmentUnlockActions.length) {
      unlockCandidate = summary.employmentUnlockActions[0];
      unlockSourceNode = label;
      console.log('EMPLOYMENT UNLOCK ACTION FOUND:', unlockCandidate, 'on node', label);
      break;
    }
  }

  let afterUnlock = null;
  let unlockClickMode = 'none';
  let unlockClickError = null;
  let workIncomeAfterUnlock = null;

  if (unlockCandidate) {
    console.log('ACTION: click single employment-related unlock action once');
    console.log('SOURCE NODE:', unlockSourceNode);
    console.log('ACTION DETAIL:', unlockCandidate);
    phase = 'after-unlock-action';
    try {
      if (unlockCandidate.href) {
        await page.locator(`a[href="${unlockCandidate.href}"]`).filter({ hasText: unlockCandidate.text || /./ }).first().click({ timeout: 8000 });
      } else {
        await page.getByRole('button', { name: unlockCandidate.text || unlockCandidate.ariaLabel }).first().click({ timeout: 8000 });
      }
      unlockClickMode = 'normal';
      await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
      await settle();
    } catch (error) {
      unlockClickMode = 'failed';
      unlockClickError = String(error.message || error).slice(0, 800);
      console.log('UNLOCK ACTION CLICK FAILED; force NOT used:', unlockClickError);
    }
    afterUnlock = await dumpUi();
    workIncomeAfterUnlock = afterUnlock.workIncomeNode;
    console.log('');
    console.log('--- AFTER UNLOCK ACTION ---');
    console.log('URL:', afterUnlock.url);
    console.log('TITLE:', afterUnlock.title);
    console.log('LANG:', afterUnlock.lang);
    console.log('HEADINGS:', afterUnlock.headings);
    console.log('SELECTED:', afterUnlock.currentItems);
    console.log('INSPECTOR:', afterUnlock.inspector);
    console.log('LINKS:', afterUnlock.links);
    console.log('BUTTONS:', afterUnlock.buttons);
    console.log('INPUTS:', afterUnlock.inputs);
    console.log('FORM COUNT:', afterUnlock.formCount);
    console.log('WORK & INCOME AFTER:', workIncomeAfterUnlock || 'not found');
    console.log('EMPLOYMENT HITS:', afterUnlock.employmentHits);
    console.log('MAIN VISIBLE TEXT (first 8000 chars):');
    console.log((afterUnlock.visibleText || '').slice(0, 8000));
    console.log('ACCESSIBILITY SNAPSHOT:');
    console.log(afterUnlock.snapshot);
    await page.screenshot({ path: `${OUT}/step-48-after-unlock-action.png`, fullPage: true });
  } else {
    console.log('No explicit employment unlock action found on enabled Profile inspectors. Stopping after inspection.');
    await page.screenshot({ path: `${OUT}/step-48-after-inspection.png`, fullPage: true });
  }

  await fs.writeFile(
    `${OUT}/step-48-employment-unlock-network.json`,
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
  await fs.writeFile(`${OUT}/step-48-node-inspections.json`, JSON.stringify(nodeInspections, null, 2));

  const actionNet = captured.filter(e => e.phase === 'after-unlock-action');
  const inspectNet = captured.filter(e => String(e.phase || '').startsWith('inspect-node:'));
  const writes = [...actionNet, ...inspectNet].filter(e => /POST|PUT|PATCH|DELETE/i.test(e.method));
  const mutations = [...actionNet, ...inspectNet].filter(e => e.flags?.mutations);
  const executions = [...actionNet, ...inspectNet].filter(looksLikeExecution);
  const providers = [...actionNet, ...inspectNet].filter(looksLikeProvider);
  const unexpected = [...actionNet, ...inspectNet].filter(e => e.flags?.unexpectedWriteOrExecution);
  const enabledWithEmploymentMention = nodeInspections.filter(
    n => !n.skipped && (n.employmentMentions?.length || n.employmentUnlockActions?.length)
  );

  let classification = 'employment unlock path not discovered';
  if (unlockCandidate && afterUnlock) {
    const enabledNow = workIncomeAfterUnlock && !isUiDisabled(workIncomeAfterUnlock);
    if (enabledNow) {
      classification = 'employment unlock path discovered';
    } else if (/work-income|employment|income|job/i.test(`${afterUnlock.url} ${afterUnlock.visibleText || ''}`)) {
      classification = 'employment path discovered';
    } else {
      classification = 'ambiguous';
    }
  } else if (enabledWithEmploymentMention.length) {
    classification = 'ambiguous';
  }

  console.log('');
  console.log('--- STEP 48 COMPARISON ---');
  console.log('CLASSIFICATION:', classification);
  console.log('UNLOCK CANDIDATE:', unlockCandidate || 'None');
  console.log('UNLOCK SOURCE NODE:', unlockSourceNode || 'None');
  console.log('UNLOCK CLICK MODE:', unlockClickMode);
  if (unlockClickError) console.log('UNLOCK CLICK ERROR:', unlockClickError);
  console.log('NODE INSPECTIONS COUNT:', nodeInspections.length);
  console.log('ENABLED NODES WITH EMPLOYMENT MENTION:', enabledWithEmploymentMention.length ? enabledWithEmploymentMention : 'None');
  console.log('WORK & INCOME BASELINE:', baseline.workIncomeNode || 'not found');
  console.log('WORK & INCOME AFTER UNLOCK:', workIncomeAfterUnlock || 'n/a (no unlock action)');
  console.log('INSPECT NETWORK:', inspectNet.length ? summarizeNetwork(inspectNet) : 'None');
  console.log('UNLOCK ACTION NETWORK:', actionNet.length ? summarizeNetwork(actionNet) : 'None');
  console.log('MUTATIONS:', mutations.length ? summarizeNetwork(mutations) : 'None');
  console.log('WRITES:', writes.length ? summarizeNetwork(writes) : 'None');
  console.log('EXECUTION/AI:', executions.length || providers.length ? 'YES' : 'None');
  console.log('UNEXPECTED WRITES:', unexpected.length ? summarizeNetwork(unexpected) : 'None');
  console.log(
    'CONSOLE ERRORS:',
    consoleErrors.filter(e => /inspect-node|after-unlock|baseline/.test(e.phase)).length
      ? consoleErrors.filter(e => /inspect-node|after-unlock|baseline/.test(e.phase))
      : 'None'
  );
  console.log(
    'PAGE ERRORS:',
    pageErrors.filter(e => /inspect-node|after-unlock|baseline/.test(e.phase)).length
      ? pageErrors.filter(e => /inspect-node|after-unlock|baseline/.test(e.phase))
      : 'None'
  );
  console.log(
    'REQUEST FAILURES:',
    requestFailures.filter(e => /inspect-node|after-unlock|baseline/.test(e.phase)).length
      ? requestFailures.filter(e => /inspect-node|after-unlock|baseline/.test(e.phase))
      : 'None'
  );
  if (stopReason) console.log('STOP REASON:', stopReason);

  console.log('');
  console.log('========================================');
  console.log('STEP 48 SUMMARY');
  console.log('========================================');
  console.log('STEP: 48');
  console.log('classification:', classification);
  console.log('baseline URL:', baseline.url);
  console.log('lang:', baseline.lang);
  console.log('profile nodes:', baseline.graphNodes);
  console.log('inspections:', nodeInspections.map(n => ({
    node: n.nodeLabel,
    skipped: Boolean(n.skipped),
    reason: n.reason || null,
    status: n.status || null,
    employmentMentions: n.employmentMentions || [],
    unlockActions: n.employmentUnlockActions || [],
  })));
  if (!unlockCandidate) {
    console.log(
      'No user-visible employment unlock path was discovered from the enabled Profile surfaces inspected in STEP 48.'
    );
  } else {
    console.log('unlock action:', unlockCandidate);
    console.log('unlock destination URL:', afterUnlock?.url);
    console.log('work & income enabled after:', workIncomeAfterUnlock && !isUiDisabled(workIncomeAfterUnlock));
  }
  console.log('STEP 48 performed no intentional profile modification and no Discovery execution.');
  console.log('artifact paths:');
  console.log(`  ${OUT}/step-48-baseline-profile.png`);
  console.log(`  ${OUT}/step-48-node-inspections.json`);
  console.log(`  ${OUT}/step-48-employment-unlock-network.json`);
  if (unlockCandidate) {
    console.log(`  ${OUT}/step-48-after-unlock-action.png`);
  } else {
    console.log(`  ${OUT}/step-48-after-inspection.png`);
  }
} finally {
  await browser.close();
}
