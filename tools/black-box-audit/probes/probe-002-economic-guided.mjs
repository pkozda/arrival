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

async function captureState(name) {
  const buttons = await page.getByRole('button').evaluateAll(els =>
    els.map(el => ({
      text: el.textContent.trim(),
      disabled: el.disabled,
      ariaLabel: el.getAttribute('aria-label'),
    }))
  );

  const state = {
    timestamp: new Date().toISOString(),
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

  await page.screenshot({
    path: `${OUT}/${name}.png`,
    fullPage: true,
  });

  await fs.writeFile(
    `${OUT}/${name}.json`,
    JSON.stringify(state, null, 2)
  );

  return state;
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

  console.log('');
  console.log('========================================');
  console.log('PROBE-002 / STEP 3 — START GUIDED JOURNEY');
  console.log('========================================');

  const welcomeDialog = page.getByRole('dialog', {
    name: /Ласкаво просимо до Arrival Atlas/i,
  });
  const welcomeVisible3 = await welcomeDialog.isVisible().catch(() => false);
  console.log('WELCOME DIALOG BEFORE:', welcomeVisible3 ? 'VISIBLE' : 'NOT VISIBLE');

  const guidedBtn = page.getByRole('button', {
    name: /Почати супроводжуваний шлях/i,
  });
  const guidedVisible = await guidedBtn.isVisible().catch(() => false);
  console.log(
    'GUIDED BUTTON:',
    guidedVisible ? 'VISIBLE' : 'NOT FOUND'
  );

  const beforeUrl3 = page.url();
  const beforeSnap3 = await page.locator('body').ariaSnapshot().catch(() => '');
  console.log('URL BEFORE:', beforeUrl3);

  if (guidedVisible) {
    console.log('');
    console.log('ACTION: Click Почати супроводжуваний шлях');
    await guidedBtn.click();
    await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2500);
  } else {
    console.log('ACTION: SKIPPED — button not visible');
  }

  const afterUrl3 = page.url();
  const afterSnap3 = await page.locator('body').ariaSnapshot().catch(() => '');
  console.log(
    'URL CHANGED:',
    afterUrl3 !== beforeUrl3 ? `YES (${beforeUrl3} → ${afterUrl3})` : 'NO'
  );
  console.log('UI CHANGED:', afterSnap3 !== beforeSnap3 ? 'YES' : 'NO');

  const s3 = await captureState('step-3-after-guided-journey');

  const dialogAfter = await page.locator('[role="dialog"]').isVisible().catch(() => false);
  const status3 = await page.locator('[role="status"]').allTextContents().catch(() => []);
  const selected3 = await page
    .locator('[aria-selected="true"], [aria-current="true"]')
    .allTextContents()
    .catch(() => []);
  const arrivingFrom3 = await page.getByText(/Arriving from/i).allTextContents().catch(() => []);
  const alerts3 = await page.locator('[role="alert"]').allTextContents().catch(() => []);
  const loading3 = await page
    .locator('[class*="loading"], [class*="spinner"], [aria-busy="true"], [class*="skeleton"]')
    .count();
  const error3 = await page
    .locator('[class*="error"], [role="alert"][class*="error"], [class*="Error"]')
    .count();
  const showRoute3 = await page.getByRole('button', { name: /Показати маршрут/i }).isVisible().catch(() => false);

  console.log('');
  console.log('--- AFTER GUIDED JOURNEY ---');
  console.log('');
  console.log('URL AFTER:', s3.url);
  console.log('TITLE:', s3.title);
  console.log('LANG:', s3.lang);
  console.log('PATH:', new URL(s3.url).pathname);

  console.log('');
  console.log('WELCOME DIALOG AFTER:', dialogAfter ? 'VISIBLE' : 'NOT VISIBLE');
  console.log('STATUS BANNERS:', status3.length ? status3 : 'None');
  console.log('SELECTED / CURRENT:', selected3.length ? selected3 : 'None detected');
  console.log('SHOW ROUTE BUTTON:', showRoute3 ? 'VISIBLE' : 'NOT VISIBLE');

  console.log('');
  console.log('HEADINGS:');
  console.log(s3.headings);

  console.log('');
  console.log('BUTTONS:');
  console.log(s3.buttons);

  console.log('');
  console.log('LINKS:');
  console.log(s3.links);

  console.log('');
  console.log('FIELDS:');
  console.log(s3.fields);

  console.log('');
  console.log('MAIN VISIBLE TEXT (first 8000 chars):');
  console.log((s3.visibleText || '').slice(0, 8000));

  console.log('');
  console.log('ACCESSIBILITY SNAPSHOT:');
  console.log(s3.snapshot);

  console.log('');
  console.log('ARRIVING FROM:', arrivingFrom3.length ? arrivingFrom3 : 'Not found');
  console.log('ALERTS:', alerts3.length ? alerts3 : 'None');
  console.log('LOADING STATE:', loading3 > 0 ? `YES (${loading3})` : 'None');
  console.log('ERROR STATE:', error3 > 0 ? `YES (${error3})` : 'None');

  console.log('');
  console.log('CONSOLE ERRORS:');
  console.log(consoleErrors.length ? consoleErrors : 'None');
  console.log('PAGE ERRORS:');
  console.log(pageErrors.length ? pageErrors : 'None');
  console.log('REQUEST FAILURES:');
  console.log(requestFailures.length ? requestFailures : 'None');

  console.log('');
  console.log('========================================');
  console.log('PROBE-002 / STEP 4 — SHOW ROUTE');
  console.log('========================================');

  const showRouteBtn = page.getByRole('button', { name: /Показати маршрут/i });
  const showRouteVisible4 = await showRouteBtn.isVisible().catch(() => false);
  console.log('SHOW ROUTE BUTTON:', showRouteVisible4 ? 'VISIBLE' : 'NOT FOUND');

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

  async function extraInventory() {
    return page.evaluate(() => {
      const textOf = el => (el.textContent || '').replace(/\s+/g, ' ').trim();
      const selected = [...document.querySelectorAll('[aria-selected="true"], [aria-current="true"]')]
        .map(textOf)
        .filter(Boolean);
      const highlighted = [...document.querySelectorAll(
        '[class*="highlight"], [class*="Highlight"], [class*="selected"], [class*="active"], [class*="current"], [class*="route"], [class*="Route"]'
      )]
        .slice(0, 80)
        .map(el => ({
          tag: el.tagName,
          className: String(el.className).slice(0, 240),
          text: textOf(el).slice(0, 160),
        }));
      const svgs = [...document.querySelectorAll('svg')].map(svg => ({
        paths: svg.querySelectorAll('path').length,
        lines: svg.querySelectorAll('line').length,
        polylines: svg.querySelectorAll('polyline').length,
        polygons: svg.querySelectorAll('polygon').length,
        markerEnds: svg.querySelectorAll('[marker-end]').length,
        arrows: svg.querySelectorAll('[class*="arrow"], [class*="Arrow"]').length,
      }));
      const graphNodes = [...document.querySelectorAll('[role="listbox"] button, [role="listbox"] [role="option"]')]
        .map(el => ({
          text: textOf(el),
          disabled: Boolean(el.disabled),
          ariaSelected: el.getAttribute('aria-selected'),
          ariaCurrent: el.getAttribute('aria-current'),
          ariaPressed: el.getAttribute('aria-pressed'),
        }));
      return {
        scrollX: window.scrollX,
        scrollY: window.scrollY,
        documentScrollTop: document.documentElement.scrollTop,
        selected,
        highlighted,
        svgs,
        svgPathCount: document.querySelectorAll('svg path').length,
        svgLineCount: document.querySelectorAll('svg line').length,
        svgPolylineCount: document.querySelectorAll('svg polyline').length,
        edgeLikeCount: document.querySelectorAll(
          '[class*="edge"], [class*="Edge"], [class*="connector"], [class*="Connector"]'
        ).length,
        overlayLikeCount: document.querySelectorAll(
          '[class*="overlay"], [class*="Overlay"], [class*="drawer"], [class*="Drawer"], [class*="panel"], [class*="Panel"]'
        ).length,
        dialogs: [...document.querySelectorAll('[role="dialog"]')].map(el => textOf(el).slice(0, 240)),
        graphNodes,
      };
    });
  }

  function classifyFailures(failures) {
    const isRscPrefetchAbort = failure => {
      const blob = `${failure.url} ${failure.method} ${failure.failure}`;
      return /_rsc|rsc=|prefetch|ERR_ABORTED|NS_BINDING_ABORTED|net::ERR_ABORTED/i.test(blob);
    };
    return {
      rscPrefetchAborts: failures.filter(isRscPrefetchAbort),
      other: failures.filter(failure => !isRscPrefetchAbort(failure)),
    };
  }

  const beforeUrl4 = page.url();
  const beforeTitle4 = await page.title();
  const beforeLang4 = await page.locator('html').getAttribute('lang');
  const beforeSnap4 = await page.locator('body').ariaSnapshot().catch(() => '');
  const beforeText4 = await page.locator('body').innerText();
  const beforeButtons4 = (s3.buttons || []).map(buttonKey);
  const beforeLinks4 = (s3.links || []).map(linkKey);
  const beforeStatus4 = await page.locator('[role="status"]').allTextContents().catch(() => []);
  const beforeSelected4 = await page
    .locator('[aria-selected="true"], [aria-current="true"]')
    .allTextContents()
    .catch(() => []);
  const beforeInv4 = await extraInventory();
  const errorCountsBefore4 = {
    console: consoleErrors.length,
    page: pageErrors.length,
    request: requestFailures.length,
  };

  console.log('URL BEFORE:', beforeUrl4);
  console.log('TITLE BEFORE:', beforeTitle4);
  console.log('LANG BEFORE:', beforeLang4);
  console.log('SCROLL BEFORE:', {
    x: beforeInv4.scrollX,
    y: beforeInv4.scrollY,
    documentScrollTop: beforeInv4.documentScrollTop,
  });
  console.log('SELECTED NODE BEFORE:', beforeSelected4.length ? beforeSelected4 : 'None detected');
  console.log('GUIDED BANNER BEFORE:', beforeStatus4.length ? beforeStatus4 : 'None');
  console.log('GRAPH NODES BEFORE:', beforeInv4.graphNodes);
  console.log('SVG / EDGES BEFORE:', {
    svgs: beforeInv4.svgs,
    svgPathCount: beforeInv4.svgPathCount,
    svgLineCount: beforeInv4.svgLineCount,
    svgPolylineCount: beforeInv4.svgPolylineCount,
    edgeLikeCount: beforeInv4.edgeLikeCount,
  });

  if (showRouteVisible4) {
    console.log('');
    console.log('ACTION: Click Показати маршрут');
    await showRouteBtn.click();
    await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2500);
  } else {
    console.log('ACTION: SKIPPED — button not visible');
  }

  const afterUrl4 = page.url();
  const afterTitle4 = await page.title();
  const afterLang4 = await page.locator('html').getAttribute('lang');
  const afterSnap4 = await page.locator('body').ariaSnapshot().catch(() => '');
  const afterText4 = await page.locator('body').innerText();
  const urlChanged4 = afterUrl4 !== beforeUrl4;
  const uiChanged4 =
    afterSnap4 !== beforeSnap4 || urlChanged4 || afterText4 !== beforeText4;

  console.log(
    'URL CHANGED:',
    urlChanged4 ? `YES (${beforeUrl4} → ${afterUrl4})` : 'NO'
  );
  console.log('UI CHANGED:', uiChanged4 ? 'YES' : 'NO');

  const s4 = await captureState('step-4-after-show-route');
  const afterInv4 = await extraInventory();
  const afterStatus4 = await page.locator('[role="status"]').allTextContents().catch(() => []);
  const afterSelected4 = await page
    .locator('[aria-selected="true"], [aria-current="true"]')
    .allTextContents()
    .catch(() => []);
  const afterButtons4 = (s4.buttons || []).map(buttonKey);
  const afterLinks4 = (s4.links || []).map(linkKey);
  const dialogAfter4 = await page.locator('[role="dialog"]').isVisible().catch(() => false);
  const alerts4 = await page.locator('[role="alert"]').allTextContents().catch(() => []);
  const loading4 = await page
    .locator('[class*="loading"], [class*="spinner"], [aria-busy="true"], [class*="skeleton"]')
    .count();
  const error4 = await page
    .locator('[class*="error"], [role="alert"][class*="error"], [class*="Error"]')
    .count();
  const arrivingFrom4 = await page.getByText(/Arriving from/i).allTextContents().catch(() => []);
  const showRouteAfter4 = await page.getByRole('button', { name: /Показати маршрут/i }).isVisible().catch(() => false);
  const startIntentAfter4 = await page.getByRole('button', { name: /Start intent/i }).isVisible().catch(() => false);

  const textDiff4 = tokenDiff(
    beforeText4.split('\n').map(line => line.trim()).filter(Boolean),
    afterText4.split('\n').map(line => line.trim()).filter(Boolean)
  );
  const buttonDiff4 = tokenDiff(beforeButtons4, afterButtons4);
  const linkDiff4 = tokenDiff(beforeLinks4, afterLinks4);
  const selectedDiff4 = tokenDiff(beforeSelected4, afterSelected4);
  const bannerDiff4 = tokenDiff(beforeStatus4, afterStatus4);
  const nodeBeforeKeys = (beforeInv4.graphNodes || []).map(node => JSON.stringify(node));
  const nodeAfterKeys = (afterInv4.graphNodes || []).map(node => JSON.stringify(node));
  const nodeDiff4 = tokenDiff(nodeBeforeKeys, nodeAfterKeys);
  const newFailures4 = requestFailures.slice(errorCountsBefore4.request);
  const newConsole4 = consoleErrors.slice(errorCountsBefore4.console);
  const newPage4 = pageErrors.slice(errorCountsBefore4.page);
  const classifiedAll = classifyFailures(requestFailures);
  const classifiedNew = classifyFailures(newFailures4);

  console.log('');
  console.log('--- AFTER SHOW ROUTE ---');
  console.log('');
  console.log('URL AFTER:', s4.url);
  console.log('TITLE AFTER:', s4.title);
  console.log('LANG AFTER:', s4.lang);
  console.log('PATH:', new URL(s4.url).pathname);
  console.log('TITLE CHANGED:', afterTitle4 !== beforeTitle4 ? `YES (${beforeTitle4} → ${afterTitle4})` : 'NO');
  console.log('LANG CHANGED:', afterLang4 !== beforeLang4 ? `YES (${beforeLang4} → ${afterLang4})` : 'NO');

  console.log('');
  console.log('SELECTED NODE AFTER:', afterSelected4.length ? afterSelected4 : 'None detected');
  console.log('SELECTED NODE DIFF:', selectedDiff4);
  console.log('GUIDED BANNER AFTER:', afterStatus4.length ? afterStatus4 : 'None');
  console.log('GUIDED BANNER DIFF:', bannerDiff4);
  console.log('RECOMMENDED IN BANNER:', /Initiate benefit application/i.test(afterStatus4.join(' ')) ? 'Initiate benefit application' : afterStatus4);

  console.log('');
  console.log('VISIBLE TEXT ADDED:', textDiff4.added.length ? textDiff4.added : 'None');
  console.log('VISIBLE TEXT REMOVED:', textDiff4.removed.length ? textDiff4.removed : 'None');
  console.log('BUTTONS ADDED:', buttonDiff4.added.length ? buttonDiff4.added : 'None');
  console.log('BUTTONS REMOVED:', buttonDiff4.removed.length ? buttonDiff4.removed : 'None');
  console.log('LINKS ADDED:', linkDiff4.added.length ? linkDiff4.added : 'None');
  console.log('LINKS REMOVED:', linkDiff4.removed.length ? linkDiff4.removed : 'None');

  console.log('');
  console.log('PANELS / OVERLAYS BEFORE:', beforeInv4.overlayLikeCount);
  console.log('PANELS / OVERLAYS AFTER:', afterInv4.overlayLikeCount);
  console.log('DIALOG AFTER:', dialogAfter4 ? 'VISIBLE' : 'NOT VISIBLE');
  console.log('DIALOGS AFTER:', afterInv4.dialogs.length ? afterInv4.dialogs : 'None');
  console.log('GRAPH NODES AFTER:', afterInv4.graphNodes);
  console.log('GRAPH NODES DIFF:', nodeDiff4);
  console.log('SVG / EDGES AFTER:', {
    svgs: afterInv4.svgs,
    svgPathCount: afterInv4.svgPathCount,
    svgLineCount: afterInv4.svgLineCount,
    svgPolylineCount: afterInv4.svgPolylineCount,
    edgeLikeCount: afterInv4.edgeLikeCount,
  });
  console.log('HIGHLIGHTS BEFORE COUNT:', beforeInv4.highlighted.length);
  console.log('HIGHLIGHTS AFTER COUNT:', afterInv4.highlighted.length);
  console.log('SCROLL AFTER:', {
    x: afterInv4.scrollX,
    y: afterInv4.scrollY,
    documentScrollTop: afterInv4.documentScrollTop,
  });
  console.log(
    'SCROLL CHANGED:',
    afterInv4.scrollX !== beforeInv4.scrollX ||
      afterInv4.scrollY !== beforeInv4.scrollY ||
      afterInv4.documentScrollTop !== beforeInv4.documentScrollTop
      ? 'YES'
      : 'NO'
  );
  console.log('SHOW ROUTE BUTTON AFTER:', showRouteAfter4 ? 'VISIBLE' : 'NOT VISIBLE');
  console.log('START INTENT AFTER:', startIntentAfter4 ? 'VISIBLE' : 'NOT VISIBLE');

  console.log('');
  console.log('HEADINGS:');
  console.log(s4.headings);

  console.log('');
  console.log('BUTTONS:');
  console.log(s4.buttons);

  console.log('');
  console.log('LINKS:');
  console.log(s4.links);

  console.log('');
  console.log('FIELDS:');
  console.log(s4.fields);

  console.log('');
  console.log('MAIN VISIBLE TEXT (first 8000 chars):');
  console.log((s4.visibleText || '').slice(0, 8000));

  console.log('');
  console.log('ACCESSIBILITY SNAPSHOT:');
  console.log(s4.snapshot);

  console.log('');
  console.log('A11Y SNAPSHOT CHANGED VS STEP 3:', afterSnap4 !== beforeSnap4 ? 'YES' : 'NO');

  console.log('');
  console.log('ARRIVING FROM:', arrivingFrom4.length ? arrivingFrom4 : 'Not found');
  console.log('ALERTS:', alerts4.length ? alerts4 : 'None');
  console.log('LOADING STATE:', loading4 > 0 ? `YES (${loading4})` : 'None');
  console.log('ERROR STATE:', error4 > 0 ? `YES (${error4})` : 'None');
  console.log('STATUS BANNERS:', afterStatus4.length ? afterStatus4 : 'None');

  console.log('');
  console.log('CONSOLE ERRORS (new after click):');
  console.log(newConsole4.length ? newConsole4 : 'None');
  console.log('PAGE ERRORS (new after click):');
  console.log(newPage4.length ? newPage4 : 'None');
  console.log('REQUEST FAILURES (new after click):');
  console.log(newFailures4.length ? newFailures4 : 'None');
  console.log('RSC/PREFETCH ABORTS (new, technical observation):');
  console.log(classifiedNew.rscPrefetchAborts.length ? classifiedNew.rscPrefetchAborts : 'None');
  console.log('OTHER REQUEST FAILURES (new):');
  console.log(classifiedNew.other.length ? classifiedNew.other : 'None');

  console.log('');
  console.log('CONSOLE ERRORS (all):');
  console.log(consoleErrors.length ? consoleErrors : 'None');
  console.log('PAGE ERRORS (all):');
  console.log(pageErrors.length ? pageErrors : 'None');
  console.log('REQUEST FAILURES (all):');
  console.log(requestFailures.length ? requestFailures : 'None');
  console.log('RSC/PREFETCH ABORTS (all, technical observation):');
  console.log(classifiedAll.rscPrefetchAborts.length ? classifiedAll.rscPrefetchAborts : 'None');

  await fs.writeFile(
    `${OUT}/result.json`,
    JSON.stringify(
      {
        probe: 'PROBE-002',
        step: 4,
        consoleErrors,
        pageErrors,
        requestFailures,
      },
      null,
      2
    )
  );

  console.log('');
  console.log('========================================');
  console.log('ARTIFACTS');
  console.log('========================================');
  console.log(OUT);
} finally {
  await browser.close();
}
