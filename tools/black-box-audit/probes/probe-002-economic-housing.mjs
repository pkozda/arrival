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
  await page.waitForTimeout(1500);
  console.log('SETUP: Start intent settled');

  console.log('');
  console.log('========================================');
  console.log('PROBE-002 / STEP 6 — BEFORE HOUSING CLICK');
  console.log('========================================');
  console.log('NOTE: pre-action capture retained, then click enabled Primary path only.');

  const state = await uiDump();
  const inventory = await extraInventory();
  const statusBanners = await page.locator('[role="status"]').allTextContents().catch(() => []);
  const selected = await page
    .locator('[aria-selected="true"], [aria-current="true"]')
    .allTextContents()
    .catch(() => []);
  const arrivingFrom = await page.getByText(/Arriving from/i).allTextContents().catch(() => []);
  const alerts = await page.locator('[role="alert"]').allTextContents().catch(() => []);
  const loading = await page
    .locator('[class*="loading"], [class*="spinner"], [aria-busy="true"], [class*="skeleton"]')
    .count();
  const errorCount = await page
    .locator('[class*="error"], [role="alert"][class*="error"], [class*="Error"]')
    .count();
  const successVisible = await page
    .getByText(/success|успіш|сохран|збереж|оновлен/i)
    .first()
    .isVisible()
    .catch(() => false);
  const startIntentAfter = await page.getByRole('button', { name: /Start intent/i }).isVisible().catch(() => false);
  const updateProfileVisible = await page.getByRole('button', { name: /Update profile/i }).isVisible().catch(() => false);

  const housingMatches = await page.evaluate(() => {
    const textOf = el => (el.textContent || '').replace(/\s+/g, ' ').trim();
    const parentContext = el => {
      const panel = el.closest('[role="complementary"], [role="status"], [role="listbox"], [role="dialog"], aside, nav, form, section');
      return panel
        ? {
            role: panel.getAttribute('role'),
            tag: panel.tagName,
            name: panel.getAttribute('aria-label') || panel.getAttribute('aria-labelledby') || null,
            text: textOf(panel).slice(0, 240),
          }
        : null;
    };

    return [...document.querySelectorAll('button, a, [role="button"], [role="link"]')]
      .filter(el => /Update housing and registration details/i.test(textOf(el) + ' ' + (el.getAttribute('aria-label') || '')))
      .map(el => ({
        tag: el.tagName,
        role: el.getAttribute('role'),
        type: el.getAttribute('type'),
        href: el.getAttribute('href'),
        text: textOf(el),
        accessibleName: el.getAttribute('aria-label') || textOf(el),
        disabled: Boolean(el.disabled) || el.getAttribute('aria-disabled') === 'true',
        ariaDisabled: el.getAttribute('aria-disabled'),
        ariaSelected: el.getAttribute('aria-selected'),
        ariaCurrent: el.getAttribute('aria-current'),
        visible: !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length),
        parent: parentContext(el),
      }));
  });

  await page.screenshot({
    path: `${OUT}/step-6-before-economic-housing.png`,
    fullPage: true,
  });

  console.log('URL:', state.url);
  console.log('TITLE:', state.title);
  console.log('LANG:', state.lang);
  console.log('PATH:', new URL(state.url).pathname);
  console.log('BUTTONS:', state.buttons);
  console.log('LINKS:', state.links);
  console.log('INPUTS / SELECTS / TEXTAREAS:', state.fields);
  console.log('HEADINGS:', state.headings);
  console.log('SELECTED NODE:', selected.length ? selected : 'None detected');
  console.log('GUIDED BANNER:', statusBanners.length ? statusBanners : 'None');
  console.log(
    'RECOMMENDED IN BANNER:',
    /Refresh housing and registration details/i.test(statusBanners.join(' '))
      ? 'Refresh housing and registration details'
      : statusBanners
  );
  console.log('GRAPH NODES:', inventory.graphNodes);
  console.log('SVG / EDGES:', {
    paths: inventory.svgPathCount,
    lines: inventory.svgLineCount,
    edges: inventory.edgeLikeCount,
  });
  console.log('ARRIVING FROM:', arrivingFrom.length ? arrivingFrom : 'Not found');
  console.log('DIALOGS:', inventory.dialogs.length ? inventory.dialogs : 'None');
  console.log('FORMS:', inventory.formCount);
  console.log('PANELS / OVERLAYS:', inventory.overlayLikeCount);
  console.log('START INTENT AFTER SETUP:', startIntentAfter ? 'VISIBLE' : 'NOT VISIBLE');
  console.log('UPDATE PROFILE VISIBLE:', updateProfileVisible ? 'YES' : 'NO');
  console.log('LOADING STATE:', loading > 0 ? `YES (${loading})` : 'None');
  console.log('ERROR STATE:', errorCount > 0 ? `YES (${errorCount})` : 'None');
  console.log('SUCCESS TEXT VISIBLE:', successVisible ? 'YES' : 'NO');
  console.log('ALERTS:', alerts.length ? alerts : 'None');

  console.log('');
  console.log('--- UPDATE HOUSING AND REGISTRATION DETAILS TARGETS ---');
  console.log('INSTANCE COUNT:', housingMatches.length);
  console.log(housingMatches);
  console.log('ACTION PENDING: click enabled Primary path only');
  console.log('ACTION: Economic state anchor NOT CLICKED');
  console.log('ACTION: Refresh housing and registration details NOT CLICKED');
  console.log('ACTION: Update profile NOT CLICKED');

  console.log('');
  console.log('MAIN VISIBLE TEXT (first 8000 chars):');
  console.log((state.visibleText || '').slice(0, 8000));
  console.log('ACCESSIBILITY SNAPSHOT:');
  console.log(state.snapshot);

  console.log('');
  console.log('CONSOLE ERRORS (before click):');
  console.log(consoleErrors.length ? consoleErrors : 'None');
  console.log('PAGE ERRORS (before click):');
  console.log(pageErrors.length ? pageErrors : 'None');
  console.log('REQUEST FAILURES (before click):');
  console.log(requestFailures.length ? requestFailures : 'None');
  console.log('SCREENSHOT BEFORE:', `${OUT}/step-6-before-economic-housing.png`);

  console.log('');
  console.log('========================================');
  console.log('PROBE-002 / STEP 6 — CLICK HOUSING PRIMARY PATH');
  console.log('========================================');
  console.log('INTENT/ACTION: click Update housing and registration details (Primary path, enabled)');

  const housingPrimary = page.getByRole('button', {
    name: /Update housing and registration details.*Primary path/i,
  });
  const housingPrimaryVisible = await housingPrimary.isVisible().catch(() => false);
  const housingPrimaryEnabled = housingPrimaryVisible
    ? await housingPrimary.isEnabled().catch(() => false)
    : false;
  console.log('PRIMARY PATH BUTTON:', housingPrimaryVisible ? 'VISIBLE' : 'NOT FOUND');
  console.log('PRIMARY PATH ENABLED:', housingPrimaryEnabled ? 'YES' : 'NO');

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

  if (housingPrimaryVisible && housingPrimaryEnabled) {
    console.log('');
    console.log('ACTION: Click Update housing and registration details (Primary path)');
    await housingPrimary.click({ force: true });
    await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2500);
  } else {
    console.log('ACTION: SKIPPED — enabled Primary path button not available');
  }

  page.off('response', onResponse);

  const after = await uiDump();
  const afterInv = await extraInventory();
  const afterStatus = await page.locator('[role="status"]').allTextContents().catch(() => []);
  const afterSelected = await page
    .locator('[aria-selected="true"], [aria-current="true"]')
    .allTextContents()
    .catch(() => []);
  const afterArriving = await page.getByText(/Arriving from/i).allTextContents().catch(() => []);
  const afterAlerts = await page.locator('[role="alert"]').allTextContents().catch(() => []);
  const afterLoading = await page
    .locator('[class*="loading"], [class*="spinner"], [aria-busy="true"], [class*="skeleton"]')
    .count();
  const afterError = await page
    .locator('[class*="error"], [role="alert"][class*="error"], [class*="Error"]')
    .count();
  const dialogAfter = await page.locator('[role="dialog"]').isVisible().catch(() => false);
  const successVisibleAfter = await page
    .getByText(/success|успіш|сохран|збереж|оновлен/i)
    .first()
    .isVisible()
    .catch(() => false);
  const editorLike = await page
    .locator('[contenteditable="true"], [class*="editor"], [class*="Editor"]')
    .count();

  await page.screenshot({
    path: `${OUT}/step-6-after-economic-housing.png`,
    fullPage: true,
  });

  const urlChanged = after.url !== state.url;
  const uiChanged =
    after.snapshot !== state.snapshot ||
    urlChanged ||
    after.visibleText !== state.visibleText ||
    after.title !== state.title;

  const buttonDiff = tokenDiff(state.buttons.map(buttonKey), after.buttons.map(buttonKey));
  const linkDiff = tokenDiff(state.links.map(linkKey), after.links.map(linkKey));
  const fieldDiff = tokenDiff(state.fields.map(fieldKey), after.fields.map(fieldKey));
  const headingDiff = tokenDiff(state.headings.map(headingKey), after.headings.map(headingKey));
  const textDiff = tokenDiff(
    (state.visibleText || '').split('\n').map(line => line.trim()).filter(Boolean),
    (after.visibleText || '').split('\n').map(line => line.trim()).filter(Boolean)
  );
  const selectedDiff = tokenDiff(selected, afterSelected);
  const bannerDiff = tokenDiff(statusBanners, afterStatus);
  const nodeDiff = tokenDiff(
    (inventory.graphNodes || []).map(node => JSON.stringify(node)),
    (afterInv.graphNodes || []).map(node => JSON.stringify(node))
  );

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

  const mutationOrExecute = interestingNetwork.filter(isMutationOrExecute);
  if (mutationOrExecute.length) {
    await fs.writeFile(
      `${OUT}/step-6-economic-housing-network.json`,
      JSON.stringify(mutationOrExecute, null, 2)
    );
  }

  const newConsole = consoleErrors.slice(errorCountsBefore.console);
  const newPage = pageErrors.slice(errorCountsBefore.page);
  const newFailures = requestFailures.slice(errorCountsBefore.request);
  const rscPrefetchAborts = newFailures.filter(isRscPrefetchAbort);
  const otherFailures = newFailures.filter(failure => !isRscPrefetchAbort(failure));

  console.log('');
  console.log('--- AFTER HOUSING PRIMARY PATH ---');
  console.log('URL BEFORE:', state.url);
  console.log('URL AFTER:', after.url);
  console.log('URL CHANGED:', urlChanged ? `YES (${state.url} → ${after.url})` : 'NO');
  console.log('TITLE BEFORE:', state.title);
  console.log('TITLE AFTER:', after.title);
  console.log('TITLE CHANGED:', after.title !== state.title ? 'YES' : 'NO');
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
  console.log('FORM COUNT BEFORE:', inventory.formCount);
  console.log('FORM COUNT AFTER:', afterInv.formCount);
  console.log('DIALOG AFTER:', dialogAfter ? 'VISIBLE' : 'NOT VISIBLE');
  console.log('DIALOGS AFTER:', afterInv.dialogs.length ? afterInv.dialogs : 'None');
  console.log('PANELS / OVERLAYS BEFORE:', inventory.overlayLikeCount);
  console.log('PANELS / OVERLAYS AFTER:', afterInv.overlayLikeCount);
  console.log('EDITOR-LIKE COUNT:', editorLike);
  console.log('SUCCESS TEXT VISIBLE:', successVisibleAfter ? 'YES' : 'NO');

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
  console.log('A11Y SNAPSHOT CHANGED:', after.snapshot !== state.snapshot ? 'YES' : 'NO');

  console.log('');
  console.log('SELECTED NODE BEFORE:', selected.length ? selected : 'None detected');
  console.log('SELECTED NODE AFTER:', afterSelected.length ? afterSelected : 'None detected');
  console.log('SELECTED NODE CHANGED:', selectedDiff.added.length || selectedDiff.removed.length ? selectedDiff : 'NO');
  console.log('GUIDED BANNER BEFORE:', statusBanners.length ? statusBanners : 'None');
  console.log('GUIDED BANNER AFTER:', afterStatus.length ? afterStatus : 'None');
  console.log('GUIDED BANNER CHANGED:', bannerDiff.added.length || bannerDiff.removed.length ? bannerDiff : 'NO');
  console.log(
    'RECOMMENDED AFTER:',
    /Refresh housing and registration details/i.test(afterStatus.join(' '))
      ? 'Refresh housing and registration details'
      : afterStatus
  );
  console.log('GRAPH NODES AFTER:', afterInv.graphNodes);
  console.log('GRAPH NODES CHANGED:', nodeDiff.added.length || nodeDiff.removed.length ? nodeDiff : 'NO');
  console.log('SVG PATH/LINE BEFORE:', {
    paths: inventory.svgPathCount,
    lines: inventory.svgLineCount,
    edges: inventory.edgeLikeCount,
  });
  console.log('SVG PATH/LINE AFTER:', {
    paths: afterInv.svgPathCount,
    lines: afterInv.svgLineCount,
    edges: afterInv.edgeLikeCount,
  });

  console.log('');
  console.log('ARRIVING FROM BEFORE:', arrivingFrom.length ? arrivingFrom : 'Not found');
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
    mutationOrExecute.length ? `${OUT}/step-6-economic-housing-network.json` : 'not written'
  );

  console.log('');
  console.log('SCREENSHOT AFTER:', `${OUT}/step-6-after-economic-housing.png`);
  console.log('ACTION: Save/Cancel/Continue/Next/Submit NOT CLICKED');
  console.log('ACTION: Update profile NOT CLICKED');
  console.log('ACTION: Refresh housing and registration details NOT CLICKED');

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
