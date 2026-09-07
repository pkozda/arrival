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
const captured = [];
let phase = 'setup';

page.on('console', msg => {
  if (msg.type() === 'error') {
    consoleErrors.push({ phase, text: msg.text() });
  }
});

page.on('pageerror', error => {
  pageErrors.push({ phase, message: error.message });
});

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
      if (/token|secret|password|authorization|cookie|apikey|api_key|access_token/i.test(key)) {
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
  return /\/execute|\/generate|\/recommend|openai|anthropic|\/ai\/|prompt|generation/i.test(blob);
}

function looksLikeProvider(entry) {
  try {
    const host = new URL(entry.url).hostname;
    return /openai|anthropic|generativelanguage|groq|mistral|together|fireworks|openrouter/i.test(
      `${host} ${entry.url}`
    );
  } catch {
    return false;
  }
}

function classifyRequest(entry) {
  const payload = String(entry.requestPayload || '');
  return {
    languagePref: /\/api\/mutations/i.test(entry.url) && /preferredLanguage/i.test(payload),
    discoveryRead: /GET/i.test(entry.method) && /\/api\/modules\/discovery/i.test(entry.url),
    profileRead: /GET/i.test(entry.method) && /\/api\/modules\/discovery\/profiles/i.test(entry.url),
    writeMethod: /POST|PUT|PATCH|DELETE/i.test(entry.method),
    mutations: /\/api\/mutations/i.test(entry.url),
    execute: /\/execute/i.test(entry.url),
    executionLike: looksLikeExecution(entry),
    providerLike: looksLikeProvider(entry),
    profileWrite:
      /POST|PUT|PATCH|DELETE/i.test(entry.method) && /\/api\/modules\/discovery\/profiles/i.test(entry.url),
  };
}

async function recordResponse(response) {
  const request = response.request();
  const url = response.url();
  const method = request.method();
  const interesting =
    /\/api\/|\/modules\/discovery|_rsc|mutation|execute|ui-snapshot|user-context|profile|discover|openai|anthropic|\/ai\//i.test(
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
    requestPayload: redactSecrets(request.postData() || null),
    responseBody: redactSecrets(responseBody),
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
      const pick = c => JSON.stringify({
        value: c.value,
        checked: c.checked,
        disabled: c.disabled,
        required: c.required,
        selectedOptions: c.selectedOptions,
      });
      if (pick(beforeCtrl) !== pick(afterCtrl)) {
        changed.push({ before: beforeCtrl, after: afterCtrl });
      }
    }
  }
  const beforeLabels = new Set((beforeForm.fieldLabels || []).map(s => s.trim()).filter(Boolean));
  const afterLabels = new Set((afterForm.fieldLabels || []).map(s => s.trim()).filter(Boolean));
  return {
    added,
    removed,
    changed,
    labelsAdded: [...afterLabels].filter(l => !beforeLabels.has(l)),
    labelsRemoved: [...beforeLabels].filter(l => !afterLabels.has(l)),
  };
}

function fieldByLabel(controls, re) {
  return (controls || []).find(c => re.test(c.label || '')) || null;
}

async function dumpCreateForm() {
  const region = page.getByRole('region', { name: /Создать профиль поиска|Create search profile/i });
  const visible = await region.first().isVisible().catch(() => false);
  if (!visible) {
    return { visible: false };
  }
  const first = region.first();
  const combo = first.getByRole('combobox').first();
  const profileType = (await combo.isVisible().catch(() => false))
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
          return { tag: el.tagName, value: el.value || null, label: (el.textContent || '').trim(), options: [] };
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
        return el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.id || '';
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
        required: Boolean(el.required),
        selectedOptions:
          el.tagName === 'SELECT'
            ? [...el.options]
                .filter(o => o.selected)
                .map(o => ({ value: o.value, text: (o.textContent || '').replace(/\s+/g, ' ').trim() }))
            : undefined,
        text: el.tagName === 'BUTTON' ? textOf(el).slice(0, 160) : undefined,
      }));
    })
    .catch(() => []);
  const headings = await first.locator('h1, h2, h3, h4, h5, h6').evaluateAll(els =>
    els.map(e => ({ tag: e.tagName, text: e.textContent.trim() }))
  );
  const fieldLabels = await first.locator('label').evaluateAll(els =>
    els.map(e => (e.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean)
  );
  const text = ((await first.innerText().catch(() => '')) || '').replace(/\s+/g, ' ').trim();
  const snapshot = await first.ariaSnapshot().catch(() => '');
  const blob = `${text}\n${snapshot}`;
  return {
    visible: true,
    headings,
    fieldLabels,
    profileType,
    controls,
    nameField: fieldByLabel(controls, /Название профиля|Profile name/i),
    countryField: fieldByLabel(controls, /Код страны|Country/i),
    roleField: fieldByLabel(controls, /Желаемая роль|Desired role/i),
    locationLike: /локац|город|місто|city|location|region|категор|topic|тема|prize|приз|keyword|ключ/i.test(blob),
    locationMatches: blob.match(/локац[^\n]{0,40}|категор[^\n]{0,40}|topic[^\n]{0,40}|приз[^\n]{0,40}/gi) || [],
    text,
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
  const createForm = await dumpCreateForm();
  const saveCreateBtns = buttons.filter(b =>
    /сохран|зберег|create|создат|створ|save/i.test(`${b.text} ${b.ariaLabel || ''}`)
  );
  const cancelBtns = buttons.filter(b => /отмена|скасувати|cancel/i.test(`${b.text} ${b.ariaLabel || ''}`));
  const executeSearchBtns = buttons.filter(b =>
    /запустить сейчас|execute|generate|find|рекоменд/i.test(`${b.text} ${b.ariaLabel || ''}`)
  );
  return {
    url: page.url(),
    title: await page.title(),
    lang: await page.locator('html').getAttribute('lang'),
    headings,
    buttons,
    snapshot,
    visibleText,
    statusBanners: await page.locator('[role="status"]').allTextContents().catch(() => []),
    alerts: await page.locator('[role="alert"]').allTextContents().catch(() => []),
    arrivingFrom: await page.getByText(/Arriving from/i).allTextContents().catch(() => []),
    createForm,
    saveCreateBtns,
    cancelBtns,
    executeSearchBtns,
    aiHits: findAiWording(`${visibleText}\n${snapshot}`),
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
  console.log('BUTTONS:', dump.buttons);
  console.log('CREATE FORM VISIBLE:', dump.createForm.visible ? 'YES' : 'NO');
  console.log('PROFILE TYPE:', dump.createForm.profileType || 'not found');
  console.log('NAME FIELD:', dump.createForm.nameField || 'not found');
  console.log('COUNTRY FIELD:', dump.createForm.countryField || 'not found');
  console.log('ROLE FIELD:', dump.createForm.roleField || 'not found');
  console.log('CREATE FORM LABELS:', dump.createForm.fieldLabels || []);
  console.log('CREATE FORM CONTROLS:', dump.createForm.controls || []);
  console.log('CREATE FORM TEXT:', (dump.createForm.text || '').slice(0, 4000));
  console.log('CREATE FORM SNAPSHOT:');
  console.log(dump.createForm.snapshot || 'n/a');
  console.log('LOCATION/CATEGORY-LIKE TEXT:', dump.createForm.locationLike ? dump.createForm.locationMatches : 'None');
  console.log('SAVE/CREATE:', dump.saveCreateBtns.length ? dump.saveCreateBtns : 'None');
  console.log('CANCEL:', dump.cancelBtns.length ? dump.cancelBtns : 'None');
  console.log('EXECUTION:', dump.executeSearchBtns.length ? dump.executeSearchBtns : 'None');
  console.log('ARRIVING FROM:', dump.arrivingFrom.length ? dump.arrivingFrom : 'Not found');
  console.log('AI / COST / PROVIDER WORD HITS:', dump.aiHits.length ? dump.aiHits : 'None');
  console.log('LOADING:', dump.loading > 0 ? `YES (${dump.loading})` : 'None');
  console.log('ALERTS:', dump.alerts.length ? dump.alerts : 'None');
  console.log('MAIN VISIBLE TEXT (first 8000 chars):');
  console.log((dump.visibleText || '').slice(0, 8000));
  console.log('ACCESSIBILITY SNAPSHOT:');
  console.log(dump.snapshot);
}

function schemaFromForm(form) {
  return (form.controls || [])
    .filter(c => ['input', 'textarea', 'select'].includes(c.tag))
    .map(c => ({
      label: c.label,
      tag: c.tag,
      type: c.type,
      value: c.value,
      placeholder: c.placeholder,
      required: c.required,
      disabled: c.disabled,
      checked: c.checked,
      selectedOptions: c.selectedOptions,
    }));
}

try {
  console.log('NETWORK CAPTURE: started before opening Discovery');
  console.log('READ-ONLY after New Profile: type switch only; no save/execute');

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
  await page.getByRole('dialog').waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);

  console.log('SETUP: click Новый профиль');
  await page.getByRole('button', { name: NEW_PROFILE_RE }).first().click({ timeout: 8000 });
  await page.getByRole('region', { name: /Создать профиль поиска/i }).waitFor({ state: 'visible', timeout: 15000 });
  await page.waitForTimeout(1500);

  const typeCombo = page.getByRole('combobox', { name: TYPE_COMBO_RE });
  await typeCombo.waitFor({ state: 'visible', timeout: 15000 });
  const setupType = await typeCombo.evaluate(el => {
    if (el.tagName === 'SELECT') {
      const opt = el.options[el.selectedIndex];
      return { value: el.value, label: (opt?.textContent || '').replace(/\s+/g, ' ').trim() };
    }
    return { value: el.value || null, label: (el.textContent || '').trim() };
  });
  const jobsSelected = JOBS_OPTION_RE.test(`${setupType.label} ${setupType.value}`);
  console.log('SETUP: default type:', setupType, 'Jobs selected:', jobsSelected ? 'YES' : 'NO');
  console.log('SETUP: type combobox not changed yet');

  const before = await dumpUi();
  logDump('BASELINE JOBS FORM (before type switch)', before);
  await page.screenshot({ path: `${OUT}/step-38-before-giveaways.png`, fullPage: true });
  console.log('SCREENSHOT BEFORE:', `${OUT}/step-38-before-giveaways.png`);

  let actionMode = 'skipped';
  let actionError = null;
  if (!jobsSelected) {
    console.log('ACTION SKIPPED: default type is not Работа');
  } else {
    console.log('ACTION: select Розыгрыши only. No other field change. No save.');
    phase = 'after-type-change';
    try {
      await typeCombo.selectOption({ label: 'Розыгрыши' });
      actionMode = 'selectOption-label-exact';
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(1500);
    } catch (error) {
      actionMode = 'failed';
      actionError = String(error.message || error).slice(0, 800);
    }
  }

  const after = await dumpUi();
  logDump('AFTER GIVEAWAYS TYPE SWITCH', after);
  await page.screenshot({ path: `${OUT}/step-38-after-giveaways.png`, fullPage: true });
  await fs.writeFile(
    `${OUT}/step-38-giveaways-network.json`,
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

  const afterChange = captured.filter(e => e.phase === 'after-type-change');
  const setupNet = captured.filter(e => e.phase === 'setup');
  const diff = compareForms(before.createForm || {}, after.createForm || {});
  const urlChanged = before.url !== after.url;
  const typeBefore = before.createForm.profileType
    ? `${before.createForm.profileType.label} (${before.createForm.profileType.value})`
    : 'unknown';
  const typeAfter = after.createForm.profileType
    ? `${after.createForm.profileType.label} (${after.createForm.profileType.value})`
    : 'unknown';
  const jobsSchema = schemaFromForm(before.createForm);
  const giveawaysSchema = schemaFromForm(after.createForm);
  const jobsLabels = new Set((before.createForm.fieldLabels || []).map(s => s.replace(/\s+/g, ' ').trim()));
  const giveLabels = new Set((after.createForm.fieldLabels || []).map(s => s.replace(/\s+/g, ' ').trim()));
  const sharedLabels = [...jobsLabels].filter(l => giveLabels.has(l));
  const jobsOnly = [...jobsLabels].filter(l => !giveLabels.has(l));
  const giveawaysOnly = [...giveLabels].filter(l => !jobsLabels.has(l));
  const networkStatement =
    afterChange.length === 0
      ? 'Switching the profile type to Giveaways caused no observed network request.'
      : `Switching the profile type to Giveaways caused ${afterChange.length} observed interesting request(s).`;

  console.log('');
  console.log('--- STEP 38 COMPARISON ---');
  console.log('ACTION MODE:', actionMode);
  if (actionError) console.log('ACTION ERROR:', actionError);
  console.log('URL BEFORE:', before.url);
  console.log('URL AFTER:', after.url);
  console.log('NAVIGATION:', urlChanged ? 'YES' : 'NO');
  console.log('TYPE BEFORE:', typeBefore);
  console.log('TYPE AFTER:', typeAfter);
  console.log('JOBS SCHEMA:', jobsSchema);
  console.log('GIVEAWAYS SCHEMA:', giveawaysSchema);
  console.log('SHARED LABELS:', sharedLabels);
  console.log('JOBS-ONLY LABELS:', jobsOnly.length ? jobsOnly : 'None');
  console.log('GIVEAWAYS-ONLY LABELS:', giveawaysOnly.length ? giveawaysOnly : 'None');
  console.log('CONTROLS ADDED:', diff.added.length ? diff.added : 'None');
  console.log('CONTROLS REMOVED:', diff.removed.length ? diff.removed : 'None');
  console.log('CONTROLS CHANGED:', diff.changed.length ? diff.changed : 'None');
  console.log('COUNTRY AFTER:', after.createForm.countryField);
  console.log('SCHEDULE AFTER:', (after.createForm.controls || []).filter(c => /schedule|cadence|Вручну|Щодня/i.test(`${c.label} ${c.name}`)));
  console.log('SETUP NETWORK:', setupNet.length);
  console.log('AFTER TYPE SWITCH NETWORK:', afterChange.length ? summarizeNetwork(afterChange) : 'None');
  console.log(networkStatement);

  console.log('');
  console.log('========================================');
  console.log('STEP 38 SUMMARY');
  console.log('========================================');
  console.log('STEP: 38');
  console.log('URL before:', before.url);
  console.log('URL after:', after.url);
  console.log('navigation:', urlChanged ? 'yes' : 'no');
  console.log('lang:', after.lang);
  console.log('initial type:', typeBefore);
  console.log('resulting type:', typeAfter);
  console.log('complete resulting form schema:', giveawaysSchema);
  console.log('Jobs fields removed:', jobsOnly.length || diff.removed.length ? { labels: jobsOnly, controls: diff.removed } : 'None');
  console.log('Giveaway-specific fields:', giveawaysOnly.length || diff.added.length ? { labels: giveawaysOnly, controls: diff.added } : 'None');
  console.log('shared fields:', sharedLabels);
  console.log('create/save/cancel controls:', { saveCreate: after.saveCreateBtns, cancel: after.cancelBtns });
  console.log('execution controls:', after.executeSearchBtns.length ? after.executeSearchBtns : 'None');
  console.log('results/recommendations:', /рекоменд|результат/i.test(after.visibleText) ? 'empty-state or copy present in page text' : 'None observed');
  console.log('loading/errors:', { loading: after.loading, alerts: after.alerts });
  console.log('country still configurable:', Boolean(after.createForm.countryField) && !after.createForm.countryField.disabled);
  console.log('schedule exists:', (after.createForm.controls || []).some(c => /cadence|schedule/i.test(`${c.name} ${c.id}`)));
  console.log('email delivery exists:', (after.createForm.controls || []).some(c => /notification|email/i.test(`${c.id} ${c.label}`)));
  console.log('location/category/topic criteria visible:', after.createForm.locationLike ? after.createForm.locationMatches : 'no');
  console.log('network summary: setup interesting=', setupNet.length, '; after type switch=', afterChange.length);
  console.log(networkStatement);
  console.log('artifact paths:');
  console.log(`  ${OUT}/step-38-before-giveaways.png`);
  console.log(`  ${OUT}/step-38-after-giveaways.png`);
  console.log(`  ${OUT}/step-38-giveaways-network.json`);
} finally {
  await browser.close();
}
