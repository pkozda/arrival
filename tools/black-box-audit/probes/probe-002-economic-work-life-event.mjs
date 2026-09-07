import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const BASE_URL = 'https://arrival-atlas.pro';
const OUT = 'tools/black-box-audit/artifacts/probe-002';

const WORK_PRIORITIES = [
  {
    priority: 1,
    name: 'Employment / Work / Job',
    re: /\b(work|jobs?|employment|employed|employer)\b|робот|зайнят|працевлашт|вакансі|роботодав/i,
  },
  {
    priority: 2,
    name: 'Income / Salary / Earnings',
    re: /\b(income|salary|salaries|wage|wages|earnings)\b|дохід|доход|зарплат|заробіт|оклад/i,
  },
  {
    priority: 3,
    name: 'Career / professional development',
    re: /\b(career|profession|professional development)\b|кар['ʼ’]?єр|професійн/i,
  },
  {
    priority: 4,
    name: 'Work-related benefits / employment administration',
    re: /\b(jobcenter|job.?center|arbeitsagentur|arbeitsamt|unemployment|unemployed)\b|центр зайнятост|безробітт/i,
  },
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

function classifyWorkLabel(text) {
  const label = (text || '').replace(/\s+/g, ' ').trim();
  for (const item of WORK_PRIORITIES) {
    if (item.re.test(label)) {
      return { priority: item.priority, name: item.name, matchedLabel: label };
    }
  }
  return null;
}

function classifyGraphNodes(graphNodes) {
  return (graphNodes || []).map((node, index) => {
    const classification = classifyWorkLabel(node.text);
    return {
      index,
      text: node.text,
      visible: node.visible !== false,
      disabled: Boolean(node.disabled),
      nativeDisabled: node.nativeDisabled,
      ariaDisabled: node.ariaDisabled,
      ariaSelected: node.ariaSelected,
      href: node.href,
      workRelated: Boolean(classification),
      priority: classification?.priority || null,
      priorityName: classification?.name || null,
    };
  });
}

function chooseWorkTarget(classified) {
  const enabled = classified.filter(
    node => node.workRelated && node.visible && !node.disabled && node.ariaDisabled !== 'true'
  );
  for (const item of WORK_PRIORITIES) {
    const atLevel = enabled.filter(node => node.priority === item.priority);
    if (atLevel.length) {
      return {
        target: atLevel[0],
        priorityUsed: item.priority,
        priorityName: item.name,
        candidatesAtLevel: atLevel,
        allEnabledWork: enabled,
      };
    }
  }
  return {
    target: null,
    priorityUsed: null,
    priorityName: null,
    candidatesAtLevel: [],
    allEnabledWork: enabled,
  };
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
        visible: !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length),
      }));
    const complementary = [...document.querySelectorAll('[role="complementary"], aside')]
      .map(el => textOf(el).slice(0, 4000));
    return {
      selected,
      graphNodes,
      complementary,
      formCount: document.querySelectorAll('form').length,
      dialogs: [...document.querySelectorAll('[role="dialog"]')].map(el => textOf(el).slice(0, 400)),
    };
  });
}

async function dumpWelcome() {
  const dialog = page.getByRole('dialog');
  const visible = await dialog.first().isVisible().catch(() => false);
  if (!visible) {
    return { visible: false, count: await dialog.count().catch(() => 0), title: null, buttons: [] };
  }
  const title = await dialog.first().evaluate(el => {
    const heading = el.querySelector('h1, h2, h3, [id]');
    return (el.getAttribute('aria-label') || heading?.textContent || el.textContent || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 400);
  }).catch(() => null);
  const buttons = await dialog.first().locator('button, a').evaluateAll(els =>
    els.map(el => ({
      tag: el.tagName,
      text: (el.textContent || '').replace(/\s+/g, ' ').trim(),
      href: el.getAttribute('href'),
    }))
  ).catch(() => []);
  return {
    visible: true,
    count: await dialog.count().catch(() => 0),
    title,
    buttons,
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
  const welcome = await dumpWelcome();
  const classified = classifyGraphNodes(inventory.graphNodes);
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
    welcome,
    classified,
    statusBanners,
    alerts,
    arrivingFrom,
    fields,
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
  console.log('LINKS:', dump.links);
  console.log('GRAPH NODES:', dump.inventory.graphNodes);
  console.log('CLASSIFIED GRAPH NODES:', dump.classified);
  console.log(
    'WORK-RELATED CANDIDATES:',
    dump.classified.filter(node => node.workRelated).length
      ? dump.classified.filter(node => node.workRelated)
      : 'None'
  );
  console.log('SELECTED NODE:', dump.inventory.selected.length ? dump.inventory.selected : 'None detected');
  console.log('WELCOME / ONBOARDING DIALOG:', dump.welcome);
  console.log('GUIDED / STATUS BANNERS:', dump.statusBanners.length ? dump.statusBanners : 'None');
  console.log('RECOMMENDED / BANNER BLOB:', recommendedFromBanners(dump.statusBanners));
  console.log('INSPECTOR STRUCTURED:', dump.inspector || 'None');
  console.log('COMPLEMENTARY RAW:', dump.inventory.complementary.length ? dump.inventory.complementary : 'None');
  console.log('ARRIVING FROM:', dump.arrivingFrom.length ? dump.arrivingFrom : 'Not found');
  console.log('FORMS:', dump.formCount);
  console.log('FIELDS:', dump.fields.length ? dump.fields : 'None');
  console.log('DIALOGS:', dump.dialogCount, dump.inventory.dialogs.length ? dump.inventory.dialogs : '');
  console.log('LOADING:', dump.loading > 0 ? `YES (${dump.loading})` : 'None');
  console.log('ALERTS:', dump.alerts.length ? dump.alerts : 'None');
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

  console.log('SETUP: click Життєві події');
  await page.getByRole('link', { name: /Життєві події/i }).click();
  await page.waitForURL(/\/modules\/life-event/, { timeout: 15000 }).catch(() => {});
  await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(3000);
  console.log('SETUP: Life Events settled', page.url());
  console.log('SETUP: welcome/guided/self-directed NOT clicked; ER / Profile / Healthcare / forms NOT opened');

  console.log('');
  console.log('========================================');
  console.log('PROBE-002 / STEP 26 — WORK-RELATED LIFE EVENTS NODE');
  console.log('========================================');

  const before = await dumpUi();
  logDump('BEFORE ACTION', before);
  await page.screenshot({
    path: `${OUT}/step-26-before-work-life-event.png`,
    fullPage: true,
  });
  console.log('SCREENSHOT BEFORE:', `${OUT}/step-26-before-work-life-event.png`);

  const choice = chooseWorkTarget(before.classified);
  const allWork = before.classified.filter(node => node.workRelated);
  const disabledWork = allWork.filter(node => node.disabled || node.ariaDisabled === 'true');
  console.log('ALL WORK-RELATED NODES:', allWork.length ? allWork : 'None');
  console.log('ENABLED WORK-RELATED NODES:', choice.allEnabledWork.length ? choice.allEnabledWork : 'None');
  console.log('DISABLED WORK-RELATED NODES:', disabledWork.length ? disabledWork : 'None');
  console.log('PRIORITY USED:', choice.priorityUsed, choice.priorityName);
  console.log('SELECTED TARGET:', choice.target || 'None');
  console.log('CANDIDATES AT SELECTED PRIORITY:', choice.candidatesAtLevel.length ? choice.candidatesAtLevel : 'None');
  if (before.welcome.visible) {
    console.log('WELCOME DIALOG PRESENT — not dismissed, Guided/Self-directed not chosen');
  }

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
  let targetLocator = null;

  if (!choice.target) {
    console.log('No enabled work-related Life Events node was found.');
    console.log('ACTION: SKIPPED — no substitute node clicked');
  } else {
    const listbox = page.getByRole('listbox', { name: /Consequence graph nodes/i });
    targetLocator = listbox.getByRole('button').nth(choice.target.index);
    const targetVisible = await targetLocator.isVisible().catch(() => false);
    const targetEnabled = targetVisible ? await targetLocator.isEnabled().catch(() => false) : false;
    const targetAriaDisabled = await targetLocator.getAttribute('aria-disabled').catch(() => null);
    const uiDisabled = targetAriaDisabled === 'true' || !targetEnabled;
    console.log('TARGET VISIBLE:', targetVisible ? 'YES' : 'NO');
    console.log('TARGET PLAYWRIGHT ENABLED:', targetEnabled ? 'YES' : 'NO');
    console.log('TARGET ARIA-DISABLED:', targetAriaDisabled);
    if (!targetVisible || uiDisabled) {
      console.log('ACTION: SKIPPED — chosen work-related node not visible/enabled; disabled node not clicked');
      clickMode = 'unavailable-disabled';
    } else {
      console.log('ACTION: Click work-related node (normal):', choice.target.text);
      try {
        await targetLocator.click({ timeout: 8000 });
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
  }

  page.off('response', onResponse);
  console.log('CLICK MODE USED:', clickMode);

  const after = await dumpUi();
  logDump('AFTER ACTION', after);
  await page.screenshot({
    path: `${OUT}/step-26-after-work-life-event.png`,
    fullPage: true,
  });

  const interestingNetwork = [];
  for (const response of rawResponses) {
    const request = response.request();
    const method = request.method();
    const url = response.url();
    const interesting =
      /\/api\/|mutation|execute|intent|life-event|ui-snapshot|user-context|profile|economic|work|job|employment/i.test(
        `${method} ${url}`
      ) ||
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
      `${OUT}/step-26-work-life-event-network.json`,
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
  const newCtaOrLink = buttonDiff.appeared.length > 0 || linkDiff.appeared.length > 0;
  const errorsYes =
    consoleErrors.slice(errorCountsBefore.console).length > 0 ||
    pageErrors.slice(errorCountsBefore.page).length > 0 ||
    otherFailures.length > 0;
  const afterTarget = choice.target
    ? after.classified.find(node => node.index === choice.target.index) ||
      after.classified.find(node => node.text === choice.target.text)
    : null;
  const realInspectorControls = (after.inspector?.actions || []).filter(
    action => action.tag === 'A' || action.tag === 'BUTTON'
  );

  console.log('');
  console.log('--- STEP 26 COMPARISON ---');
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
  console.log('SELECTED BEFORE:', before.inventory.selected);
  console.log('SELECTED AFTER:', after.inventory.selected);
  console.log('SELECTED CHANGED:', selectedChanged ? 'YES' : 'NO');
  console.log('TARGET BEFORE:', choice.target || 'None');
  console.log('TARGET AFTER:', afterTarget || 'None');
  console.log('INSPECTOR CHANGED:', inspectorChanged ? 'YES' : 'NO');
  console.log('INSPECTOR AFTER:', after.inspector || 'None');
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
  console.log('WELCOME AFTER:', after.welcome);
  console.log('LOADING AFTER:', after.loading > 0 ? `YES (${after.loading})` : 'None');
  console.log('ALERTS AFTER:', after.alerts.length ? after.alerts : 'None');
  console.log('VISIBLE TEXT CHANGED:', textChanged ? 'YES' : 'NO');
  console.log(
    'NETWORK:',
    interestingNetwork.length ? interestingNetwork : 'No network activity caused by the click.'
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
    'MODULES / EXECUTE:',
    interestingNetwork.filter(e => /\/api\/modules\/|\/execute/.test(e.url)).length
      ? interestingNetwork.filter(e => /\/api\/modules\/|\/execute/.test(e.url))
      : 'None'
  );
  console.log(
    'NETWORK ARTIFACT:',
    interestingNetwork.length
      ? `${OUT}/step-26-work-life-event-network.json`
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
  console.log('ACTION: Inspector Actions / CTA / other nodes / modules / Back NOT CLICKED');
  console.log('SCREENSHOT AFTER:', `${OUT}/step-26-after-work-life-event.png`);

  console.log('');
  console.log('========================================');
  console.log('STEP 26 SUMMARY');
  console.log('========================================');
  console.log('STEP: 26');
  console.log('all work-related candidates found:', allWork.length ? allWork : 'None');
  console.log('priority used for target selection:', choice.priorityUsed ? `${choice.priorityUsed} ${choice.priorityName}` : 'none');
  console.log('selected target:', choice.target ? choice.target.text : 'none');
  console.log(
    'action:',
    clickMode === 'normal'
      ? `click ${choice.target.text}`
      : clickMode === 'skipped'
        ? 'No enabled work-related Life Events node was found.'
        : clickMode
  );
  console.log(
    'target enabled/disabled:',
    choice.target ? (choice.target.disabled ? 'disabled' : 'enabled') : 'n/a'
  );
  console.log('URL before:', before.url);
  console.log('URL after:', after.url);
  console.log('navigation yes/no:', urlChanged ? 'yes' : 'no');
  console.log('selected node before:', JSON.stringify(before.inventory.selected));
  console.log('selected node after:', JSON.stringify(after.inventory.selected));
  console.log('target status before/after:', choice.target?.text || 'n/a', '→', afterTarget?.text || 'n/a');
  console.log('Inspector present yes/no:', after.inspector ? 'yes' : 'no');
  console.log('Inspector Status:', after.inspector?.statusParagraph || 'None');
  console.log('Inspector Context:', after.inspector?.sections?.Context || 'None');
  console.log('Inspector Unlocks:', after.inspector?.sections?.Unlocks || 'None');
  console.log('Inspector Blocked:', after.inspector?.sections?.Blocked || 'None');
  console.log(
    'Inspector Actions:',
    after.inspector?.actions?.length ? after.inspector.actions : after.inspector?.sections?.Actions || 'None'
  );
  console.log('real links/buttons yes/no:', realInspectorControls.length ? 'yes' : 'no');
  console.log('forms yes/no:', after.formCount > 0 ? `yes (${after.formCount})` : 'no');
  console.log('dialogs yes/no:', after.dialogCount > 0 ? `yes (${after.dialogCount})` : 'no');
  console.log('new CTA/link yes/no:', newCtaOrLink ? 'yes' : 'no');
  console.log('network yes/no:', interestingNetwork.length ? 'yes' : 'no');
  console.log('errors yes/no:', errorsYes ? 'yes' : 'no');
  console.log('artifact paths:');
  console.log(`  ${OUT}/step-26-before-work-life-event.png`);
  console.log(`  ${OUT}/step-26-after-work-life-event.png`);
  if (interestingNetwork.length) {
    console.log(`  ${OUT}/step-26-work-life-event-network.json`);
  }
} finally {
  await browser.close();
}
