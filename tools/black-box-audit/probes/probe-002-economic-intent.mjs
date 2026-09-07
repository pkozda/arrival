import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const BASE_URL = 'https://arrival-atlas.pro';
const OUT = 'tools/black-box-audit/artifacts/probe-002';

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

async function fieldDump() {
  return page.locator('input, select, textarea').evaluateAll(elements =>
    elements.map(element => {
      const tag = element.tagName.toLowerCase();
      const options =
        tag === 'select'
          ? [...element.options].map(option => ({
              value: option.value,
              label: option.textContent.trim(),
              selected: option.selected,
            }))
          : undefined;
      return {
        tag,
        type: element.getAttribute('type'),
        name: element.getAttribute('name'),
        id: element.id || null,
        placeholder: element.getAttribute('placeholder'),
        ariaLabel: element.getAttribute('aria-label'),
        value: element.value,
        checked:
          element.type === 'checkbox' || element.type === 'radio'
            ? element.checked
            : undefined,
        disabled: element.disabled,
        options,
      };
    })
  );
}

async function uiDump() {
  const buttons = await page.getByRole('button').evaluateAll(els =>
    els.map(el => ({
      text: el.textContent.trim(),
      disabled: el.disabled,
      ariaLabel: el.getAttribute('aria-label'),
    }))
  );

  return {
    url: page.url(),
    title: await page.title(),
    lang: await page.locator('html').getAttribute('lang'),
    buttons,
    links: await page.getByRole('link').evaluateAll(els =>
      els.map(el => ({
        text: el.textContent.trim(),
        href: el.getAttribute('href'),
      }))
    ),
    fields: await fieldDump(),
    headings: await page.locator('h1, h2, h3, h4, h5, h6').evaluateAll(
      els => els.map(e => ({ tag: e.tagName, text: e.textContent.trim() }))
    ),
    snapshot: await page.locator('body').ariaSnapshot(),
    visibleText: await page.locator('body').innerText(),
  };
}

function tokenDiff(beforeList, afterList) {
  const beforeSet = new Set(beforeList);
  const afterSet = new Set(afterList);
  return {
    added: afterList.filter(item => !beforeSet.has(item)),
    removed: beforeList.filter(item => !afterSet.has(item)),
  };
}

function buttonKey(button) {
  return `${button.text}|disabled=${button.disabled}|aria=${button.ariaLabel || ''}`;
}

function linkKey(link) {
  return `${link.text}|href=${link.href || ''}`;
}

function headingKey(heading) {
  return `${heading.tag}|${heading.text}`;
}

function fieldKey(field) {
  return `${field.tag}|type=${field.type}|name=${field.name}|id=${field.id}|value=${field.value}|checked=${field.checked}`;
}

async function extraInventory() {
  return page.evaluate(() => {
    const textOf = el => (el.textContent || '').replace(/\s+/g, ' ').trim();
    const selected = [...document.querySelectorAll('[aria-selected="true"], [aria-current="true"]')]
      .map(textOf)
      .filter(Boolean);
    const graphNodes = [...document.querySelectorAll('[role="listbox"] button, [role="listbox"] [role="option"]')]
      .map(el => ({
        text: textOf(el),
        disabled: Boolean(el.disabled),
        ariaSelected: el.getAttribute('aria-selected'),
        ariaCurrent: el.getAttribute('aria-current'),
        ariaPressed: el.getAttribute('aria-pressed'),
      }));
    return {
      formCount: document.querySelectorAll('form').length,
      dialogs: [...document.querySelectorAll('[role="dialog"]')].map(el => textOf(el).slice(0, 240)),
      overlayLikeCount: document.querySelectorAll(
        '[class*="overlay"], [class*="Overlay"], [class*="drawer"], [class*="Drawer"], [class*="panel"], [class*="Panel"]'
      ).length,
      confirmationLike: [...document.querySelectorAll('[role="alertdialog"], [class*="confirm"], [class*="Confirm"], [class*="success"], [class*="Success"]')]
        .map(el => textOf(el).slice(0, 200)),
      svgPathCount: document.querySelectorAll('svg path').length,
      svgLineCount: document.querySelectorAll('svg line').length,
      edgeLikeCount: document.querySelectorAll(
        '[class*="edge"], [class*="Edge"], [class*="connector"], [class*="Connector"]'
      ).length,
      graphNodes,
      selected,
    };
  });
}

function isRscPrefetchAbort(failure) {
  const blob = `${failure.url} ${failure.method} ${failure.failure}`;
  return /_rsc|rsc=|prefetch|ERR_ABORTED|NS_BINDING_ABORTED|net::ERR_ABORTED/i.test(blob);
}

function isMutationOrExecute(entry) {
  const blob = `${entry.method} ${entry.url}`;
  return /\/api\/|mutation|execute|intent/i.test(blob) &&
    /POST|PUT|PATCH|DELETE/i.test(entry.method);
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

  console.log('');
  console.log('========================================');
  console.log('PROBE-002 / STEP 5 — START INTENT');
  console.log('========================================');
  console.log('INTENT/ACTION: click Start intent');

  const startIntent = page.getByRole('button', { name: /Start intent/i });
  const startIntentVisible = await startIntent.isVisible().catch(() => false);
  console.log('START INTENT BUTTON:', startIntentVisible ? 'VISIBLE' : 'NOT FOUND');

  const before = await uiDump();
  const beforeInv = await extraInventory();
  const beforeStatus = await page.locator('[role="status"]').allTextContents().catch(() => []);
  const beforeSelected = await page
    .locator('[aria-selected="true"], [aria-current="true"]')
    .allTextContents()
    .catch(() => []);
  const beforeAlerts = await page.locator('[role="alert"]').allTextContents().catch(() => []);
  const beforeLoading = await page
    .locator('[class*="loading"], [class*="spinner"], [aria-busy="true"], [class*="skeleton"]')
    .count();
  const beforeError = await page
    .locator('[class*="error"], [role="alert"][class*="error"], [class*="Error"]')
    .count();
  const beforeArriving = await page.getByText(/Arriving from/i).allTextContents().catch(() => []);
  const errorCountsBefore = {
    console: consoleErrors.length,
    page: pageErrors.length,
    request: requestFailures.length,
  };

  await page.screenshot({
    path: `${OUT}/step-5-before-start-intent.png`,
    fullPage: true,
  });

  console.log('');
  console.log('--- BEFORE START INTENT ---');
  console.log('URL:', before.url);
  console.log('TITLE:', before.title);
  console.log('LANG:', before.lang);
  console.log('PATH:', new URL(before.url).pathname);
  console.log('BUTTONS:', before.buttons);
  console.log('LINKS:', before.links);
  console.log('INPUTS / SELECTS / TEXTAREAS:', before.fields);
  console.log('HEADINGS:', before.headings);
  console.log('SELECTED NODE:', beforeSelected.length ? beforeSelected : 'None detected');
  console.log('GUIDED BANNER:', beforeStatus.length ? beforeStatus : 'None');
  console.log('RECOMMENDED IN BANNER:', /Initiate benefit application/i.test(beforeStatus.join(' ')) ? 'Initiate benefit application' : beforeStatus);
  console.log('GRAPH NODES:', beforeInv.graphNodes);
  console.log('ARRIVING FROM:', beforeArriving.length ? beforeArriving : 'Not found');
  console.log('LOADING STATE:', beforeLoading > 0 ? `YES (${beforeLoading})` : 'None');
  console.log('ERROR STATE:', beforeError > 0 ? `YES (${beforeError})` : 'None');
  console.log('ALERTS:', beforeAlerts.length ? beforeAlerts : 'None');
  console.log('MAIN VISIBLE TEXT (first 8000 chars):');
  console.log((before.visibleText || '').slice(0, 8000));
  console.log('ACCESSIBILITY SNAPSHOT:');
  console.log(before.snapshot);
  console.log('CONSOLE ERRORS:');
  console.log(consoleErrors.length ? consoleErrors : 'None');
  console.log('PAGE ERRORS:');
  console.log(pageErrors.length ? pageErrors : 'None');
  console.log('REQUEST FAILURES:');
  console.log(requestFailures.length ? requestFailures : 'None');

  const rawResponses = [];
  const onResponse = response => {
    rawResponses.push(response);
  };

  page.on('response', onResponse);

  if (startIntentVisible) {
    console.log('');
    console.log('ACTION: Click Start intent');
    await startIntent.click();
    await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2500);
  } else {
    console.log('ACTION: SKIPPED — button not visible');
  }

  page.off('response', onResponse);

  const interestingNetwork = [];
  for (const response of rawResponses) {
    const request = response.request();
    const method = request.method();
    const url = response.url();
    const interesting =
      /\/api\/|mutation|execute|intent/i.test(`${method} ${url}`) ||
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

  const after = await uiDump();
  const afterInv = await extraInventory();
  const afterStatus = await page.locator('[role="status"]').allTextContents().catch(() => []);
  const afterSelected = await page
    .locator('[aria-selected="true"], [aria-current="true"]')
    .allTextContents()
    .catch(() => []);
  const afterAlerts = await page.locator('[role="alert"]').allTextContents().catch(() => []);
  const afterLoading = await page
    .locator('[class*="loading"], [class*="spinner"], [aria-busy="true"], [class*="skeleton"]')
    .count();
  const afterError = await page
    .locator('[class*="error"], [role="alert"][class*="error"], [class*="Error"]')
    .count();
  const afterArriving = await page.getByText(/Arriving from/i).allTextContents().catch(() => []);
  const dialogAfter = await page.locator('[role="dialog"]').isVisible().catch(() => false);
  const successVisible = await page
    .getByText(/success|успіш|сохран|збереж|оновлен/i)
    .first()
    .isVisible()
    .catch(() => false);

  await page.screenshot({
    path: `${OUT}/step-5-after-start-intent.png`,
    fullPage: true,
  });

  const urlChanged = after.url !== before.url;
  const uiChanged =
    after.snapshot !== before.snapshot ||
    urlChanged ||
    after.visibleText !== before.visibleText ||
    after.title !== before.title;

  const buttonDiff = tokenDiff(before.buttons.map(buttonKey), after.buttons.map(buttonKey));
  const linkDiff = tokenDiff(before.links.map(linkKey), after.links.map(linkKey));
  const fieldDiff = tokenDiff(before.fields.map(fieldKey), after.fields.map(fieldKey));
  const headingDiff = tokenDiff(before.headings.map(headingKey), after.headings.map(headingKey));
  const textDiff = tokenDiff(
    (before.visibleText || '').split('\n').map(line => line.trim()).filter(Boolean),
    (after.visibleText || '').split('\n').map(line => line.trim()).filter(Boolean)
  );
  const selectedDiff = tokenDiff(beforeSelected, afterSelected);
  const bannerDiff = tokenDiff(beforeStatus, afterStatus);
  const nodeDiff = tokenDiff(
    (beforeInv.graphNodes || []).map(node => JSON.stringify(node)),
    (afterInv.graphNodes || []).map(node => JSON.stringify(node))
  );

  const newConsole = consoleErrors.slice(errorCountsBefore.console);
  const newPage = pageErrors.slice(errorCountsBefore.page);
  const newFailures = requestFailures.slice(errorCountsBefore.request);
  const rscPrefetchAborts = newFailures.filter(isRscPrefetchAbort);
  const otherFailures = newFailures.filter(failure => !isRscPrefetchAbort(failure));

  const mutationOrExecute = interestingNetwork.filter(isMutationOrExecute);

  if (mutationOrExecute.length) {
    await fs.writeFile(
      `${OUT}/step-5-start-intent-network.json`,
      JSON.stringify(mutationOrExecute, null, 2)
    );
  }

  console.log('');
  console.log('--- AFTER START INTENT ---');
  console.log('URL BEFORE:', before.url);
  console.log('URL AFTER:', after.url);
  console.log('URL CHANGED:', urlChanged ? `YES (${before.url} → ${after.url})` : 'NO');
  console.log('TITLE BEFORE:', before.title);
  console.log('TITLE AFTER:', after.title);
  console.log('TITLE CHANGED:', after.title !== before.title ? 'YES' : 'NO');
  console.log('LANG:', after.lang);
  console.log('PATH:', new URL(after.url).pathname);
  console.log('UI SURFACE:', new URL(after.url).pathname);
  console.log('UI CHANGED:', uiChanged ? 'YES' : 'NO');

  console.log('');
  console.log('BUTTONS:');
  console.log(after.buttons);
  console.log('BUTTONS ADDED:', buttonDiff.added.length ? buttonDiff.added : 'None');
  console.log('BUTTONS REMOVED:', buttonDiff.removed.length ? buttonDiff.removed : 'None');

  console.log('');
  console.log('LINKS:');
  console.log(after.links);
  console.log('LINKS ADDED:', linkDiff.added.length ? linkDiff.added : 'None');
  console.log('LINKS REMOVED:', linkDiff.removed.length ? linkDiff.removed : 'None');

  console.log('');
  console.log('INPUTS / SELECTS / TEXTAREAS:');
  console.log(after.fields);
  console.log('FIELDS ADDED:', fieldDiff.added.length ? fieldDiff.added : 'None');
  console.log('FIELDS REMOVED:', fieldDiff.removed.length ? fieldDiff.removed : 'None');
  console.log('FORM COUNT BEFORE:', beforeInv.formCount);
  console.log('FORM COUNT AFTER:', afterInv.formCount);
  console.log('DIALOG AFTER:', dialogAfter ? 'VISIBLE' : 'NOT VISIBLE');
  console.log('DIALOGS AFTER:', afterInv.dialogs.length ? afterInv.dialogs : 'None');
  console.log('PANELS / OVERLAYS BEFORE:', beforeInv.overlayLikeCount);
  console.log('PANELS / OVERLAYS AFTER:', afterInv.overlayLikeCount);
  console.log('CONFIRMATION / SUCCESS-LIKE:', afterInv.confirmationLike.length ? afterInv.confirmationLike : 'None');
  console.log('SUCCESS TEXT VISIBLE:', successVisible ? 'YES' : 'NO');

  console.log('');
  console.log('HEADINGS:');
  console.log(after.headings);
  console.log('HEADINGS ADDED:', headingDiff.added.length ? headingDiff.added : 'None');
  console.log('HEADINGS REMOVED:', headingDiff.removed.length ? headingDiff.removed : 'None');
  console.log('VISIBLE TEXT ADDED:', textDiff.added.length ? textDiff.added : 'None');
  console.log('VISIBLE TEXT REMOVED:', textDiff.removed.length ? textDiff.removed : 'None');

  console.log('');
  console.log('MAIN VISIBLE TEXT (first 8000 chars):');
  console.log((after.visibleText || '').slice(0, 8000));

  console.log('');
  console.log('ACCESSIBILITY SNAPSHOT:');
  console.log(after.snapshot);
  console.log('A11Y SNAPSHOT CHANGED:', after.snapshot !== before.snapshot ? 'YES' : 'NO');

  console.log('');
  console.log('SELECTED NODE BEFORE:', beforeSelected.length ? beforeSelected : 'None detected');
  console.log('SELECTED NODE AFTER:', afterSelected.length ? afterSelected : 'None detected');
  console.log('SELECTED NODE CHANGED:', selectedDiff.added.length || selectedDiff.removed.length ? selectedDiff : 'NO');
  console.log('GUIDED BANNER BEFORE:', beforeStatus.length ? beforeStatus : 'None');
  console.log('GUIDED BANNER AFTER:', afterStatus.length ? afterStatus : 'None');
  console.log('GUIDED BANNER CHANGED:', bannerDiff.added.length || bannerDiff.removed.length ? bannerDiff : 'NO');
  console.log('RECOMMENDED AFTER:', /Initiate benefit application/i.test(afterStatus.join(' ')) ? 'Initiate benefit application' : afterStatus);
  console.log('GRAPH NODES AFTER:', afterInv.graphNodes);
  console.log('GRAPH NODES CHANGED:', nodeDiff.added.length || nodeDiff.removed.length ? nodeDiff : 'NO');
  console.log('SVG PATH/LINE BEFORE:', { paths: beforeInv.svgPathCount, lines: beforeInv.svgLineCount, edges: beforeInv.edgeLikeCount });
  console.log('SVG PATH/LINE AFTER:', { paths: afterInv.svgPathCount, lines: afterInv.svgLineCount, edges: afterInv.edgeLikeCount });

  console.log('');
  console.log('ARRIVING FROM BEFORE:', beforeArriving.length ? beforeArriving : 'Not found');
  console.log('ARRIVING FROM AFTER:', afterArriving.length ? afterArriving : 'Not found');
  console.log('LOADING STATE:', afterLoading > 0 ? `YES (${afterLoading})` : 'None');
  console.log('ERROR STATE:', afterError > 0 ? `YES (${afterError})` : 'None');
  console.log('ALERTS:', afterAlerts.length ? afterAlerts : 'None');

  console.log('');
  console.log('NETWORK / API (interesting):');
  console.log(interestingNetwork.length ? interestingNetwork : 'None');
  console.log('MUTATION / EXECUTE:');
  console.log(mutationOrExecute.length ? mutationOrExecute : 'None');
  console.log(
    'NETWORK ARTIFACT:',
    mutationOrExecute.length ? `${OUT}/step-5-start-intent-network.json` : 'not written'
  );

  console.log('');
  console.log('SCREENSHOT:', `${OUT}/step-5-after-start-intent.png`);

  console.log('');
  console.log('CONSOLE ERRORS (new after click):');
  console.log(newConsole.length ? newConsole : 'None');
  console.log('PAGE ERRORS (new after click):');
  console.log(newPage.length ? newPage : 'None');
  console.log('REQUEST FAILURES (new after click):');
  console.log(newFailures.length ? newFailures : 'None');
  console.log('RSC/PREFETCH ABORTS (new, technical observation):');
  console.log(rscPrefetchAborts.length ? rscPrefetchAborts : 'None');
  console.log('OTHER REQUEST FAILURES (new):');
  console.log(otherFailures.length ? otherFailures : 'None');
  console.log('CONSOLE ERRORS (all):');
  console.log(consoleErrors.length ? consoleErrors : 'None');
  console.log('PAGE ERRORS (all):');
  console.log(pageErrors.length ? pageErrors : 'None');
  console.log('REQUEST FAILURES (all):');
  console.log(requestFailures.length ? requestFailures : 'None');
} finally {
  await browser.close();
}
