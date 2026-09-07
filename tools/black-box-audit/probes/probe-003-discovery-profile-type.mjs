import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const BASE_URL = 'https://arrival-atlas.pro';
const OUT = 'tools/black-box-audit/artifacts/probe-003';
const DISCOVERY_NAV_RE = /Пошук|Поиск|Discovery/i;
const GUIDED_RE = /Почати супроводжуваний шлях/i;
const NEW_PROFILE_RE = /Новый профиль|Новий профіль|New profile/i;
const TYPE_COMBO_RE = /Работа \/ Розыгрыши|Jobs \/ Giveaways|Работа \/ Розіграші/i;
const JOBS_OPTION_RE = /Работа|Jobs/i;
const GIVEAWAYS_OPTION_RE = /Розыгрыши|Розіграші|Giveaways/i;

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
let phase = 'before-type-change';

page.on('console', msg => {
  if (msg.type() === 'error') {
    consoleErrors.push({ phase, text: msg.text() });
  }
});

page.on('pageerror', error => {
  pageErrors.push({ phase, message: error.message });
});

page.on('requestfailed', request => {
  requestFailures.push({
    phase,
    url: request.url(),
    method: request.method(),
    failure: request.failure()?.errorText ?? 'unknown',
  });
});

function isRscPrefetchAbort(failure) {
  const blob = `${failure.url} ${failure.method} ${failure.failure}`;
  return /_rsc|rsc=|prefetch|ERR_ABORTED|NS_BINDING_ABORTED|net::ERR_ABORTED/i.test(blob);
}

function looksLikeExecution(entry) {
  const blob = `${entry.method} ${entry.url} ${entry.requestPayload || ''}`;
  return /\/execute|\/generate|\/recommend|\/complet|openai|anthropic|\/ai\/|provider|prompt|generation/i.test(
    blob
  );
}

function looksLikeDiscoveryApi(entry) {
  return /\/api\/modules\/discovery/i.test(entry.url);
}

function looksLikeProfileMutation(entry) {
  const blob = `${entry.method} ${entry.url} ${entry.requestPayload || ''}`;
  const write = /POST|PUT|PATCH|DELETE/i.test(entry.method);
  return (
    write &&
    (/\/api\/modules\/discovery\/profiles/i.test(entry.url) ||
      /\/api\/mutations/i.test(entry.url) ||
      /profile.*(create|save|insert)|createProfile|saveProfile/i.test(blob))
  );
}

function classifyRequest(entry) {
  const payload = String(entry.requestPayload || '');
  return {
    discoveryApi: /\/api\/modules\/discovery/i.test(entry.url),
    discoveryPage: /\/modules\/discovery/i.test(entry.url) && !/\/api\//.test(entry.url),
    execute: /\/execute/i.test(entry.url),
    mutations: /\/api\/mutations/i.test(entry.url),
    uiSnapshot: /\/api\/ui-snapshot/i.test(entry.url),
    userContext: /\/api\/user-context/i.test(entry.url),
    payloadLooksLikeQueryOrPrompt: /prompt|query|search|generate|recommend|discovery|messages/i.test(
      payload
    ),
    executionLike: looksLikeExecution(entry),
    profileMutationLike: looksLikeProfileMutation(entry),
  };
}

async function recordResponse(response) {
  const request = response.request();
  const url = response.url();
  const method = request.method();
  const interesting =
    /\/api\/|\/modules\/discovery|_rsc|rsc=|mutation|execute|intent|ui-snapshot|user-context|profile|discover|openai|anthropic|\/ai\//i.test(
      `${method} ${url}`
    ) ||
    ((/POST|PUT|PATCH|DELETE/i.test(method)) && /xhr|fetch|document/i.test(request.resourceType()));
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
  const entry = {
    phase,
    method,
    url,
    status: response.status(),
    resourceType: request.resourceType(),
    requestPayload: request.postData() || null,
    responseBody,
  };
  entry.flags = classifyRequest(entry);
  captured.push(entry);
}

page.on('response', response => {
  recordResponse(response).catch(() => {});
});

function summarizeNetwork(list) {
  return list.map(entry => ({
    phase: entry.phase,
    method: entry.method,
    status: entry.status,
    url: entry.url,
    flags: entry.flags,
    requestPayload: entry.requestPayload,
  }));
}

function findAiWording(text) {
  const patterns = [
    /\bAI\b/gi,
    /\bLLM\b/gi,
    /OpenAI/gi,
    /Anthropic/gi,
    /provider/gi,
    /\btoken\b/gi,
    /\bcredits?\b/gi,
    /\bcost\b/gi,
    /generate/gi,
    /billable/gi,
  ];
  const hits = [];
  for (const re of patterns) {
    const found = String(text || '').match(re);
    if (found) {
      hits.push(...found);
    }
  }
  return [...new Set(hits.map(h => h.toLowerCase()))];
}

function controlKey(control) {
  return [control.tag, control.type || '', control.id || '', control.name || '', control.label || '']
    .join('|')
    .replace(/\s+/g, ' ')
    .trim();
}

function compareForms(beforeForm, afterForm) {
  const beforeMap = new Map((beforeForm.controls || []).map(c => [controlKey(c), c]));
  const afterMap = new Map((afterForm.controls || []).map(c => [controlKey(c), c]));
  const added = [];
  const removed = [];
  const changed = [];
  for (const [key, afterCtrl] of afterMap) {
    if (!beforeMap.has(key)) {
      added.push(afterCtrl);
    }
  }
  for (const [key, beforeCtrl] of beforeMap) {
    if (!afterMap.has(key)) {
      removed.push(beforeCtrl);
    } else {
      const afterCtrl = afterMap.get(key);
      const beforeState = JSON.stringify({
        value: beforeCtrl.value,
        checked: beforeCtrl.checked,
        disabled: beforeCtrl.disabled,
        selectedOptions: beforeCtrl.selectedOptions,
      });
      const afterState = JSON.stringify({
        value: afterCtrl.value,
        checked: afterCtrl.checked,
        disabled: afterCtrl.disabled,
        selectedOptions: afterCtrl.selectedOptions,
      });
      if (beforeState !== afterState) {
        changed.push({ before: beforeCtrl, after: afterCtrl });
      }
    }
  }
  const beforeLabels = new Set((beforeForm.fieldLabels || []).map(s => s.trim()).filter(Boolean));
  const afterLabels = new Set((afterForm.fieldLabels || []).map(s => s.trim()).filter(Boolean));
  const labelsAdded = [...afterLabels].filter(l => !beforeLabels.has(l));
  const labelsRemoved = [...beforeLabels].filter(l => !afterLabels.has(l));
  return { added, removed, changed, labelsAdded, labelsRemoved };
}

async function dumpDialog() {
  const dialog = page.getByRole('dialog');
  const visible = await dialog.first().isVisible().catch(() => false);
  if (!visible) {
    return { visible: false, count: await dialog.count().catch(() => 0) };
  }
  const first = dialog.first();
  const title = await first
    .evaluate(el => {
      const heading = el.querySelector('h1, h2, h3');
      return (el.getAttribute('aria-label') || heading?.textContent || '').replace(/\s+/g, ' ').trim();
    })
    .catch(() => null);
  const text = await first.innerText().catch(() => '');
  return {
    visible: true,
    count: await dialog.count().catch(() => 0),
    title,
    text: text.replace(/\s+/g, ' ').trim().slice(0, 1200),
  };
}

async function dumpCreateForm() {
  const region = page.getByRole('region', { name: /Создать профиль поиска|Create search profile/i });
  const visible = await region.first().isVisible().catch(() => false);
  if (!visible) {
    return { visible: false };
  }
  const first = region.first();
  const combo = first.getByRole('combobox').first();
  const comboVisible = await combo.isVisible().catch(() => false);
  const profileType = comboVisible
    ? await combo
        .evaluate(el => {
          if (el.tagName === 'SELECT') {
            const opt = el.options[el.selectedIndex];
            return {
              tag: el.tagName,
              value: el.value,
              label: (opt?.textContent || '').replace(/\s+/g, ' ').trim(),
              options: [...el.options].map(o => ({
                value: o.value,
                label: (o.textContent || '').replace(/\s+/g, ' ').trim(),
                selected: o.selected,
              })),
            };
          }
          return {
            tag: el.tagName,
            value: el.value || null,
            label: (el.textContent || '').replace(/\s+/g, ' ').trim(),
            options: [],
          };
        })
        .catch(() => null)
    : null;
  const controls = await first
    .evaluate(root => {
      const textOf = el => (el.textContent || '').replace(/\s+/g, ' ').trim();
      const labelFor = el => {
        if (el.id) {
          const lab = root.querySelector(`label[for="${CSS.escape(el.id)}"]`);
          if (lab) {
            return textOf(lab);
          }
        }
        const wrap = el.closest('label');
        if (wrap) {
          return textOf(wrap);
        }
        return (
          el.getAttribute('aria-label') ||
          el.getAttribute('placeholder') ||
          el.getAttribute('name') ||
          el.id ||
          ''
        );
      };
      return [...root.querySelectorAll('input, textarea, select, button')].map(el => ({
        tag: el.tagName.toLowerCase(),
        type: el.getAttribute('type'),
        id: el.id || null,
        name: el.getAttribute('name'),
        placeholder: el.getAttribute('placeholder'),
        label: labelFor(el).slice(0, 240),
        value: 'value' in el ? el.value : null,
        checked: el.type === 'checkbox' || el.type === 'radio' ? el.checked : undefined,
        disabled: Boolean(el.disabled) || el.getAttribute('aria-disabled') === 'true',
        selectedOptions:
          el.tagName === 'SELECT'
            ? [...el.options]
                .filter(o => o.selected)
                .map(o => ({
                  value: o.value,
                  text: (o.textContent || '').replace(/\s+/g, ' ').trim(),
                }))
            : undefined,
      }));
    })
    .catch(() => []);
  const headings = await first.locator('h1, h2, h3, h4, h5, h6').evaluateAll(els =>
    els.map(e => ({ tag: e.tagName, text: e.textContent.trim() }))
  );
  const fieldLabels = await first.locator('label').evaluateAll(els =>
    els.map(e => (e.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean)
  );
  const text = await first.innerText().catch(() => '');
  const snapshot = await first.ariaSnapshot().catch(() => '');
  return {
    visible: true,
    headings,
    fieldLabels,
    profileType,
    controls,
    text: (text || '').replace(/\s+/g, ' ').trim(),
    snapshot,
  };
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
    }))
  );
  const snapshot = await page.locator('body').ariaSnapshot();
  const visibleText = await page.locator('body').innerText();
  const statusBanners = await page.locator('[role="status"]').allTextContents().catch(() => []);
  const alerts = await page.locator('[role="alert"]').allTextContents().catch(() => []);
  const arrivingFrom = await page.getByText(/Arriving from/i).allTextContents().catch(() => []);
  const dialog = await dumpDialog();
  const createForm = await dumpCreateForm();
  const saveCreateBtns = buttons.filter(b =>
    /сохран|зберег|create|создат|створ|save/i.test(`${b.text} ${b.ariaLabel || ''}`)
  );
  const executeSearchBtns = buttons.filter(b =>
    /execute|search|поиск|пошук|discover|generate|find|рекоменд|найти|знайти/i.test(
      `${b.text} ${b.ariaLabel || ''}`
    )
  );
  const cancelBtns = buttons.filter(b => /отмена|скасувати|cancel/i.test(`${b.text} ${b.ariaLabel || ''}`));
  const aiHits = findAiWording(`${visibleText}\n${snapshot}\n${createForm.text || ''}`);
  const inputs = await page.locator('input, textarea, select').evaluateAll(els =>
    els.map(el => ({
      tag: el.tagName.toLowerCase(),
      type: el.getAttribute('type'),
      id: el.id || null,
      name: el.getAttribute('name'),
      placeholder: el.getAttribute('placeholder'),
      ariaLabel: el.getAttribute('aria-label'),
      value: el.value,
      checked: el.type === 'checkbox' || el.type === 'radio' ? el.checked : undefined,
      disabled: el.disabled,
    }))
  );
  return {
    url: page.url(),
    title: await page.title(),
    lang: await page.locator('html').getAttribute('lang'),
    headings,
    buttons,
    snapshot,
    visibleText,
    statusBanners,
    alerts,
    arrivingFrom,
    dialog,
    createForm,
    saveCreateBtns,
    executeSearchBtns,
    cancelBtns,
    aiHits,
    inputs,
    formCount: await page.locator('form').count(),
    dialogCount: await page.locator('[role="dialog"]').count(),
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
  console.log('PATH:', (() => {
    try {
      return new URL(dump.url).pathname + new URL(dump.url).search;
    } catch {
      return dump.url;
    }
  })());
  console.log('HEADINGS:', dump.headings);
  console.log('BUTTONS:', dump.buttons);
  console.log('DIALOG:', dump.dialog);
  console.log('CREATE FORM VISIBLE:', dump.createForm.visible ? 'YES' : 'NO');
  console.log('PROFILE TYPE:', dump.createForm.profileType || 'not found');
  console.log('CREATE FORM HEADINGS:', dump.createForm.headings || []);
  console.log('CREATE FORM LABELS:', dump.createForm.fieldLabels || []);
  console.log('CREATE FORM CONTROLS:', dump.createForm.controls || []);
  console.log('CREATE FORM TEXT:', (dump.createForm.text || '').slice(0, 4000));
  console.log('CREATE FORM SNAPSHOT:');
  console.log(dump.createForm.snapshot || 'n/a');
  console.log('SAVE/CREATE BUTTONS:', dump.saveCreateBtns.length ? dump.saveCreateBtns : 'None');
  console.log('CANCEL BUTTONS:', dump.cancelBtns.length ? dump.cancelBtns : 'None');
  console.log('EXECUTE/SEARCH BUTTONS:', dump.executeSearchBtns.length ? dump.executeSearchBtns : 'None');
  console.log('ARRIVING FROM:', dump.arrivingFrom.length ? dump.arrivingFrom : 'Not found');
  console.log('STATUS BANNERS:', dump.statusBanners.length ? dump.statusBanners : 'None');
  console.log('FORMS:', dump.formCount);
  console.log('ALL INPUTS:', dump.inputs.length ? dump.inputs : 'None');
  console.log('AI / COST / PROVIDER WORD HITS:', dump.aiHits.length ? dump.aiHits : 'None');
  console.log('DIALOGS COUNT:', dump.dialogCount);
  console.log('LOADING:', dump.loading > 0 ? `YES (${dump.loading})` : 'None');
  console.log('ALERTS:', dump.alerts.length ? dump.alerts : 'None');
  console.log('MAIN VISIBLE TEXT (first 8000 chars):');
  console.log((dump.visibleText || '').slice(0, 8000));
  console.log('ACCESSIBILITY SNAPSHOT:');
  console.log(dump.snapshot);
}

try {
  console.log('NETWORK CAPTURE: started before any app interaction');

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
  await page.waitForTimeout(2000);

  console.log('SETUP: click Discovery nav');
  await page
    .getByRole('navigation', { name: /Основна навігація/i })
    .getByRole('link', { name: DISCOVERY_NAV_RE })
    .click({ timeout: 8000 });
  await page.waitForURL(/\/modules\/discovery/, { timeout: 15000 }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.getByRole('dialog').waitFor({ state: 'visible', timeout: 15000 });
  await page.waitForTimeout(1000);

  console.log('SETUP: click Почати супроводжуваний шлях');
  await page.getByRole('dialog').getByRole('button', { name: GUIDED_RE }).click({ timeout: 8000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.getByRole('dialog').waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);

  console.log('SETUP: click Новый профиль');
  const newProfileBtn = page.getByRole('button', { name: NEW_PROFILE_RE });
  await newProfileBtn.first().waitFor({ state: 'visible', timeout: 15000 });
  await newProfileBtn.first().click({ timeout: 8000 });
  await page.getByRole('region', { name: /Создать профиль поиска/i }).waitFor({
    state: 'visible',
    timeout: 15000,
  });
  await page.waitForTimeout(1500);

  const typeCombo = page.getByRole('combobox', { name: TYPE_COMBO_RE });
  await typeCombo.waitFor({ state: 'visible', timeout: 15000 });
  const setupType = await typeCombo.evaluate(el => {
    if (el.tagName === 'SELECT') {
      const opt = el.options[el.selectedIndex];
      return {
        value: el.value,
        label: (opt?.textContent || '').replace(/\s+/g, ' ').trim(),
      };
    }
    return { value: el.value || null, label: (el.textContent || '').replace(/\s+/g, ' ').trim() };
  });
  console.log('SETUP: create-profile form visible; profile type:', setupType);
  const jobsSelected = JOBS_OPTION_RE.test(`${setupType.label} ${setupType.value}`);
  console.log('SETUP: Jobs/Работа currently selected:', jobsSelected ? 'YES' : 'NO');
  console.log('SETUP: type / name / country / role / schedule / email / save / execute NOT used');

  await page.waitForTimeout(500);
  const baseline = captured.slice();
  console.log('');
  console.log('========================================');
  console.log('PRE-ACTION NETWORK BASELINE');
  console.log('========================================');
  console.log('BASELINE REQUEST COUNT (interesting):', baseline.length);
  console.log(
    'BASELINE EXECUTION-LIKE:',
    baseline.filter(looksLikeExecution).length ? summarizeNetwork(baseline.filter(looksLikeExecution)) : 'None'
  );
  console.log(
    'BASELINE DISCOVERY API:',
    baseline.filter(looksLikeDiscoveryApi).length
      ? summarizeNetwork(baseline.filter(looksLikeDiscoveryApi))
      : 'None'
  );
  console.log(
    'BASELINE MUTATIONS:',
    baseline.filter(e => /\/api\/mutations/i.test(e.url)).length
      ? summarizeNetwork(baseline.filter(e => /\/api\/mutations/i.test(e.url)))
      : 'None'
  );
  console.log(
    'BASELINE PROFILE-MUTATION-LIKE:',
    baseline.filter(looksLikeProfileMutation).length
      ? summarizeNetwork(baseline.filter(looksLikeProfileMutation))
      : 'None'
  );

  console.log('');
  console.log('========================================');
  console.log('PROBE-002 / STEP 30 — DISCOVERY SWITCH PROFILE TYPE');
  console.log('========================================');
  console.log('INTENT/ACTION: change Работа → Розыгрыши only; do not save/execute/type');

  const before = await dumpUi();
  logDump('BEFORE PROFILE TYPE CHANGE', before);
  await page.screenshot({
    path: `${OUT}/step-30-before-profile-type.png`,
    fullPage: true,
  });
  console.log('SCREENSHOT BEFORE:', `${OUT}/step-30-before-profile-type.png`);

  const comboVisible = await typeCombo.isVisible().catch(() => false);
  const comboEnabled = comboVisible ? await typeCombo.isEnabled().catch(() => false) : false;
  const comboTag = comboVisible ? await typeCombo.evaluate(el => el.tagName).catch(() => null) : null;
  console.log('TYPE COMBO VISIBLE/ENABLED:', comboVisible, comboEnabled);
  console.log('TYPE COMBO TAG:', comboTag);
  console.log('TYPE BEFORE:', before.createForm.profileType || setupType);

  let actionMode = 'skipped';
  let actionError = null;
  if (!comboVisible || !comboEnabled) {
    console.log('ACTION: SKIPPED — profile type combobox not available');
  } else if (!jobsSelected) {
    console.log('ACTION: SKIPPED — current type is not Работа/Jobs');
  } else {
    console.log('ACTION: select Розыгрыши (normal combobox). No further Discovery interaction.');
    phase = 'after-type-change';
    try {
      await typeCombo.selectOption({ label: GIVEAWAYS_OPTION_RE });
      actionMode = 'selectOption-label';
      console.log('ACTION MODE: selectOption by label regex');
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(2000);
    } catch (error) {
      try {
        await typeCombo.selectOption({ label: 'Розыгрыши' });
        actionMode = 'selectOption-label-exact';
        console.log('ACTION MODE: selectOption by exact label');
        await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
        await page.waitForTimeout(2000);
      } catch (error2) {
        actionMode = 'failed';
        actionError = `${String(error.message || error).slice(0, 400)} | ${String(error2.message || error2).slice(0, 400)}`;
        console.log('ACTION MODE: failed; force NOT used; typing NOT used');
        console.log('ACTION ERROR:', actionError);
      }
    }
  }

  console.log('ACTION MODE USED:', actionMode);
  console.log('STOP: name / country / role / excluded / schedule / email / save / execute NOT USED');

  const after = await dumpUi();
  logDump('AFTER PROFILE TYPE CHANGE', after);
  await page.screenshot({
    path: `${OUT}/step-30-after-profile-type.png`,
    fullPage: true,
  });

  await fs.writeFile(`${OUT}/step-30-profile-type-network.json`, JSON.stringify(captured, null, 2));

  const afterChange = captured.filter(entry => entry.phase === 'after-type-change');
  const executionAfter = afterChange.filter(looksLikeExecution);
  const discoveryAfter = afterChange.filter(looksLikeDiscoveryApi);
  const mutationsAfter = afterChange.filter(e => /\/api\/mutations/i.test(e.url));
  const profileMutAfter = afterChange.filter(looksLikeProfileMutation);
  const executeUrls = [...new Set(executionAfter.map(e => `${e.method} ${e.url}`))];
  const newFailures = requestFailures.filter(f => f.phase === 'after-type-change');
  const rscPrefetchAborts = newFailures.filter(isRscPrefetchAbort);
  const otherFailures = newFailures.filter(failure => !isRscPrefetchAbort(failure));
  const urlChanged = before.url !== after.url;
  const autoExecution = executionAfter.length > 0;
  const profileMutation = profileMutAfter.length > 0;
  const errorsYes =
    consoleErrors.filter(e => e.phase === 'after-type-change').length > 0 ||
    pageErrors.filter(e => e.phase === 'after-type-change').length > 0 ||
    otherFailures.length > 0;
  const diff = compareForms(before.createForm || {}, after.createForm || {});
  const typeBefore = before.createForm.profileType
    ? `${before.createForm.profileType.label} (${before.createForm.profileType.value})`
    : 'unknown';
  const typeAfter = after.createForm.profileType
    ? `${after.createForm.profileType.label} (${after.createForm.profileType.value})`
    : 'unknown';
  const explicitAi =
    after.aiHits.filter(h => !['email'].includes(h) && h !== 'ai').length > 0
      ? after.aiHits
      : after.aiHits;
  const aiIndication =
    after.aiHits.filter(h => ['ai', 'llm', 'openai', 'anthropic', 'provider', 'token', 'credit', 'credits', 'cost', 'generate', 'billable'].includes(h) && h !== 'ai').length >
      0 || after.aiHits.some(h => ['llm', 'openai', 'anthropic', 'provider', 'token', 'credit', 'credits', 'cost', 'generate', 'billable'].includes(h));

  console.log('');
  console.log('--- STEP 30 COMPARISON ---');
  console.log('TYPE BEFORE:', typeBefore);
  console.log('TYPE AFTER:', typeAfter);
  console.log('URL BEFORE:', before.url);
  console.log('URL AFTER:', after.url);
  console.log('NAVIGATION OCCURRED:', urlChanged ? 'YES' : 'NO');
  console.log('TITLE AFTER:', after.title);
  console.log('LANG BEFORE/AFTER:', before.lang, '→', after.lang);
  console.log('ACTION MODE USED:', actionMode);
  if (actionError) {
    console.log('ACTION ERROR:', actionError);
  }
  console.log('FIELDS ADDED (controls):', diff.added.length ? diff.added : 'None');
  console.log('FIELDS REMOVED (controls):', diff.removed.length ? diff.removed : 'None');
  console.log('FIELDS CHANGED/RESET (controls):', diff.changed.length ? diff.changed : 'None');
  console.log('LABELS ADDED:', diff.labelsAdded.length ? diff.labelsAdded : 'None');
  console.log('LABELS REMOVED:', diff.labelsRemoved.length ? diff.labelsRemoved : 'None');
  console.log(
    'AFTER-TYPE-CHANGE INTERESTING NETWORK:',
    afterChange.length ? summarizeNetwork(afterChange) : 'None'
  );
  console.log(
    'AFTER-TYPE-CHANGE EXECUTION-LIKE:',
    executionAfter.length ? summarizeNetwork(executionAfter) : 'None'
  );
  console.log(
    'AFTER-TYPE-CHANGE DISCOVERY API:',
    discoveryAfter.length ? summarizeNetwork(discoveryAfter) : 'None'
  );
  console.log(
    'AFTER-TYPE-CHANGE MUTATIONS:',
    mutationsAfter.length ? summarizeNetwork(mutationsAfter) : 'None'
  );
  console.log(
    'AFTER-TYPE-CHANGE PROFILE-MUTATION-LIKE:',
    profileMutAfter.length ? summarizeNetwork(profileMutAfter) : 'None'
  );
  console.log(
    autoExecution
      ? 'Changing the Discovery profile type triggered an automatic execution request. No further Discovery interaction was performed.'
      : 'Changing the Discovery profile type caused no observed AI/execution request.'
  );
  console.log('NETWORK ARTIFACT:', `${OUT}/step-30-profile-type-network.json`);
  console.log(
    'CONSOLE ERRORS (after type change):',
    consoleErrors.filter(e => e.phase === 'after-type-change').length
      ? consoleErrors.filter(e => e.phase === 'after-type-change')
      : 'None'
  );
  console.log(
    'PAGE ERRORS (after type change):',
    pageErrors.filter(e => e.phase === 'after-type-change').length
      ? pageErrors.filter(e => e.phase === 'after-type-change')
      : 'None'
  );
  console.log('REQUEST FAILURES (after type change):', newFailures.length ? newFailures : 'None');
  console.log(
    'RSC/PREFETCH ABORTS (technical observation):',
    rscPrefetchAborts.length ? rscPrefetchAborts : 'None'
  );
  console.log('OTHER REQUEST FAILURES (after type change):', otherFailures.length ? otherFailures : 'None');
  console.log('SCREENSHOT AFTER:', `${OUT}/step-30-after-profile-type.png`);

  console.log('');
  console.log('========================================');
  console.log('STEP 30 SUMMARY');
  console.log('========================================');
  console.log('STEP: 30');
  console.log('profile type before:', typeBefore);
  console.log('profile type after:', typeAfter);
  console.log('URL before:', before.url);
  console.log('URL after:', after.url);
  console.log('navigation yes/no:', urlChanged ? 'yes' : 'no');
  console.log('document language:', after.lang);
  console.log(
    'resulting form summary:',
    `visible=${after.createForm.visible}; type=${typeAfter}; headings=${(after.createForm.headings || []).map(h => h.text).join(' | ')}; controls=${(after.createForm.controls || []).length}`
  );
  console.log(
    'fields added:',
    diff.labelsAdded.length || diff.added.length
      ? JSON.stringify({ labels: diff.labelsAdded, controls: diff.added })
      : 'None'
  );
  console.log(
    'fields removed:',
    diff.labelsRemoved.length || diff.removed.length
      ? JSON.stringify({ labels: diff.labelsRemoved, controls: diff.removed })
      : 'None'
  );
  console.log(
    'fields changed/reset:',
    diff.changed.length ? JSON.stringify(diff.changed) : 'None'
  );
  console.log('create/save controls visible yes/no:', after.saveCreateBtns.length ? 'yes' : 'no');
  console.log(
    'execute/search controls visible yes/no:',
    after.executeSearchBtns.length ? 'yes' : 'no'
  );
  console.log(
    'AI/cost/provider indication yes/no:',
    aiIndication ? `yes (${explicitAi.join(', ')})` : after.aiHits.length ? `no explicit (${after.aiHits.join(', ')})` : 'no'
  );
  console.log('execution request observed yes/no:', autoExecution ? 'yes' : 'no');
  console.log('potentially relevant execution endpoint(s):', executeUrls.length ? executeUrls : 'None');
  console.log('profile mutation observed yes/no:', profileMutation ? 'yes' : 'no');
  console.log('/api/mutations observed yes/no:', mutationsAfter.length ? 'yes' : 'no');
  console.log('automatic execution on type change yes/no:', autoExecution ? 'yes' : 'no');
  console.log('errors yes/no:', errorsYes ? 'yes' : 'no');
  console.log(
    autoExecution
      ? 'Changing the Discovery profile type triggered an automatic execution request. No further Discovery interaction was performed.'
      : 'Changing the Discovery profile type caused no observed AI/execution request.'
  );
  console.log('artifact paths:');
  console.log(`  ${OUT}/step-30-before-profile-type.png`);
  console.log(`  ${OUT}/step-30-after-profile-type.png`);
  console.log(`  ${OUT}/step-30-profile-type-network.json`);
} finally {
  await browser.close();
}
