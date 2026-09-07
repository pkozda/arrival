import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const BASE_URL = 'https://arrival-atlas.pro';
const OUT = 'tools/black-box-audit/artifacts/probe-002';
const WORK_GROWTH_RE = /Work\s*&\s*Growth|Work and Growth|Робота.*зростан|зростан/i;

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
      `${button.text}|disabled=${button.disabled}|ariaDisabled=${button.ariaDisabled}|selected=${button.ariaSelected}|aria=${button.ariaLabel || ''}`
  );
}

function linkKeys(links) {
  return (links || []).map(link => `${link.text}|href=${link.href || ''}`);
}

function recommendedFromBanners(statusBanners) {
  const blob = (statusBanners || []).join(' ').replace(/\s+/g, ' ').trim();
  return blob || 'None';
}

async function dumpJourneySlides() {
  return page.evaluate(() => {
    const textOf = el => (el.textContent || '').replace(/\s+/g, ' ').trim();
    const nav =
      document.querySelector('[role="navigation"][aria-label*="Journey" i], nav[aria-label*="Journey" i]') ||
      [...document.querySelectorAll('nav, [role="navigation"]')].find(el =>
        /Journey slides|Journey/i.test(el.getAttribute('aria-label') || '')
      );
    const buttons = [...(nav ? nav.querySelectorAll('button, a, [role="button"]') : [])];
    const fallback = buttons.length
      ? buttons
      : [...document.querySelectorAll('button, a')].filter(el =>
          /Slide 0[1-6]|aria-label.*0[1-6]/i.test(
            `${textOf(el)} ${el.getAttribute('aria-label') || ''}`
          ) || /^0[1-6]$/.test(textOf(el))
        );
    return fallback.map((el, index) => ({
      index,
      tag: el.tagName,
      role: el.getAttribute('role'),
      type: el.getAttribute('type'),
      href: el.getAttribute('href'),
      text: textOf(el),
      ariaLabel: el.getAttribute('aria-label'),
      ariaSelected: el.getAttribute('aria-selected'),
      ariaCurrent: el.getAttribute('aria-current'),
      ariaPressed: el.getAttribute('aria-pressed'),
      ariaDisabled: el.getAttribute('aria-disabled'),
      nativeDisabled: Boolean(el.disabled),
      disabled: Boolean(el.disabled) || el.getAttribute('aria-disabled') === 'true',
      visible: !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length),
      inJourneyNav: Boolean(el.closest('[aria-label*="Journey" i]')),
    }));
  });
}

async function dumpWorkGrowthCandidates() {
  return page.evaluate(source => {
    const re = new RegExp(source, 'i');
    const textOf = el => (el.textContent || '').replace(/\s+/g, ' ').trim();
    return [...document.querySelectorAll('button, a, [role="button"], [role="link"], [role="img"], img, [aria-label]')]
      .filter(el =>
        re.test(
          `${textOf(el)} ${el.getAttribute('aria-label') || ''} ${el.getAttribute('alt') || ''}`
        )
      )
      .slice(0, 20)
      .map((el, index) => ({
        index,
        tag: el.tagName,
        role: el.getAttribute('role'),
        type: el.getAttribute('type'),
        href: el.getAttribute('href'),
        text: textOf(el).slice(0, 240),
        ariaLabel: el.getAttribute('aria-label'),
        alt: el.getAttribute('alt'),
        nativeDisabled: Boolean(el.disabled),
        ariaDisabled: el.getAttribute('aria-disabled'),
        ariaSelected: el.getAttribute('aria-selected'),
        ariaCurrent: el.getAttribute('aria-current'),
        visible: !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length),
        inJourneyNav: Boolean(el.closest('[aria-label*="Journey" i]')),
      }));
  }, WORK_GROWTH_RE.source);
}

async function dumpInspector() {
  return page.evaluate(() => {
    const textOf = el => (el.textContent || '').replace(/\s+/g, ' ').trim();
    const root = document.querySelector('[role="complementary"]') || document.querySelector('aside');
    if (!root) {
      return null;
    }
    const titleEl = root.querySelector('h3, h2, h1');
    const firstParagraph = root.querySelector('p');
    const sections = {};
    for (const heading of root.querySelectorAll('h4, h3')) {
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
    const selected = [...document.querySelectorAll('[aria-selected="true"], [aria-current="true"], [aria-pressed="true"]')]
      .map(el => ({
        tag: el.tagName,
        role: el.getAttribute('role'),
        text: textOf(el),
        ariaLabel: el.getAttribute('aria-label'),
        ariaSelected: el.getAttribute('aria-selected'),
        ariaCurrent: el.getAttribute('aria-current'),
        ariaPressed: el.getAttribute('aria-pressed'),
      }))
      .filter(item => item.text || item.ariaLabel);
    const map = [...document.querySelectorAll('img[alt], [role="img"]')]
      .map(el => ({
        tag: el.tagName,
        role: el.getAttribute('role'),
        alt: el.getAttribute('alt'),
        ariaLabel: el.getAttribute('aria-label'),
        text: textOf(el).slice(0, 400),
      }))
      .filter(item => /map|YOU ARE HERE|Work|Growth|Journey|domain/i.test(`${item.alt} ${item.ariaLabel} ${item.text}`));
    const timeline = [...document.querySelectorAll('[class*="timeline"], [class*="Timeline"], ol, [role="list"]')]
      .slice(0, 8)
      .map(el => textOf(el).slice(0, 500))
      .filter(Boolean);
    const complementary = [...document.querySelectorAll('[role="complementary"], aside')]
      .map(el => textOf(el).slice(0, 4000));
    return {
      selected,
      map,
      timeline,
      complementary,
      formCount: document.querySelectorAll('form').length,
      dialogs: [...document.querySelectorAll('[role="dialog"]')].map(el => textOf(el).slice(0, 240)),
    };
  });
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
      ariaCurrent: el.getAttribute('aria-current'),
      href: el.getAttribute('href'),
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
  const journeySlides = await dumpJourneySlides();
  const workGrowthCandidates = await dumpWorkGrowthCandidates();
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
  const currentSlide = journeySlides.find(
    slide => slide.ariaSelected === 'true' || slide.ariaCurrent === 'true' || slide.ariaPressed === 'true'
  ) || inventory.selected.find(item => /Slide 0[1-6]/i.test(item.ariaLabel || ''));
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
    journeySlides,
    workGrowthCandidates,
    currentSlide: currentSlide || null,
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
  console.log('JOURNEY STEPS 01–06:', dump.journeySlides);
  console.log('CURRENT JOURNEY STEP:', dump.currentSlide || dump.inventory.selected);
  console.log('WORK & GROWTH CANDIDATES:', dump.workGrowthCandidates.length ? dump.workGrowthCandidates : 'None');
  console.log('MAP STATE:', dump.inventory.map.length ? dump.inventory.map : 'None');
  console.log('TIMELINE / LIST-LIKE:', dump.inventory.timeline.length ? dump.inventory.timeline : 'None');
  console.log('SELECTED / CURRENT MARKERS:', dump.inventory.selected.length ? dump.inventory.selected : 'None detected');
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
  await page
    .getByRole('navigation', { name: /Journey slides/i })
    .waitFor({ state: 'visible', timeout: 15000 })
    .catch(() => {});
  await page.getByRole('button', { name: /Slide 0[1-6]/i }).first().waitFor({
    state: 'visible',
    timeout: 15000,
  }).catch(() => {});
  await page.waitForTimeout(2500);
  console.log('SETUP: Journey settled', page.url());
  console.log('SETUP: Economic Reality / Profile / Life Events / forms NOT opened');

  console.log('');
  console.log('========================================');
  console.log('PROBE-002 / STEP 25 — OPEN WORK & GROWTH FROM JOURNEY');
  console.log('========================================');
  console.log('INTENT/ACTION: click Journey step Work & Growth (localized equivalent if needed)');

  const before = await dumpUi();
  logDump('BEFORE CLICK', before);
  await page.screenshot({
    path: `${OUT}/step-25-before-work-growth.png`,
    fullPage: true,
  });
  console.log('SCREENSHOT BEFORE:', `${OUT}/step-25-before-work-growth.png`);

  const journeyNav = page.getByRole('navigation', { name: /Journey slides/i });
  const labeledSlide = journeyNav.getByRole('button', { name: /Slide 06: Work & Growth|Work & Growth/i });
  const numberedSlide = journeyNav.getByRole('button', { name: /^06$|Slide 06/i });
  const pageLabeled = page.getByRole('button', { name: /Slide 06: Work & Growth|Work & Growth/i });

  let target = null;
  let targetSource = 'none';
  if ((await labeledSlide.count().catch(() => 0)) > 0) {
    target = labeledSlide.first();
    targetSource = 'journey-nav aria-label Work & Growth';
  } else if ((await numberedSlide.count().catch(() => 0)) > 0) {
    target = numberedSlide.first();
    targetSource = 'journey-nav 06';
  } else if ((await pageLabeled.count().catch(() => 0)) > 0) {
    target = pageLabeled.first();
    targetSource = 'page button Work & Growth';
  }

  const dumpSlide = (before.journeySlides || []).find(
    slide =>
      WORK_GROWTH_RE.test(`${slide.ariaLabel || ''} ${slide.text || ''}`) ||
      /Slide 06/i.test(slide.ariaLabel || '') ||
      slide.text === '06'
  );
  const observedLabel = dumpSlide
    ? dumpSlide.ariaLabel || dumpSlide.text
    : (before.workGrowthCandidates[0]?.ariaLabel || before.workGrowthCandidates[0]?.text || 'not found');

  const targetVisible = target ? await target.isVisible().catch(() => false) : false;
  const targetEnabled = targetVisible ? await target.isEnabled().catch(() => false) : false;
  const targetAriaDisabled = target
    ? await target.getAttribute('aria-disabled').catch(() => null)
    : null;
  const targetAriaSelected = target
    ? await target.getAttribute('aria-selected').catch(() => null)
    : null;
  const targetAriaCurrent = target
    ? await target.getAttribute('aria-current').catch(() => null)
    : null;
  const targetHref = target ? await target.getAttribute('href').catch(() => null) : null;
  const targetTag = target ? await target.evaluate(el => el.tagName).catch(() => null) : null;
  const targetText = target ? await target.innerText().catch(() => '') : '';
  const targetAriaLabel = target ? await target.getAttribute('aria-label').catch(() => null) : null;
  const uiDisabled = targetAriaDisabled === 'true' || (target && !(await target.isEnabled().catch(() => false)));

  console.log('OBSERVED WORK & GROWTH LABEL:', observedLabel);
  console.log('TARGET SOURCE:', targetSource);
  console.log('DUMP SLIDE:', dumpSlide || 'None');
  console.log('TARGET FOUND:', target ? 'YES' : 'NO');
  console.log('TARGET TAG:', targetTag);
  console.log('TARGET VISIBLE:', targetVisible ? 'YES' : 'NO');
  console.log('TARGET ENABLED (Playwright):', targetEnabled ? 'YES' : 'NO');
  console.log('TARGET ARIA-DISABLED:', targetAriaDisabled);
  console.log('TARGET ARIA-SELECTED:', targetAriaSelected);
  console.log('TARGET ARIA-CURRENT:', targetAriaCurrent);
  console.log('TARGET HREF:', targetHref);
  console.log('TARGET TEXT:', targetText.replace(/\s+/g, ' ').trim());
  console.log('TARGET ARIA-LABEL:', targetAriaLabel);
  console.log('UI EXPOSES AS DISABLED:', uiDisabled ? 'YES' : 'NO');

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
  if (!target || !targetVisible) {
    console.log('ACTION: SKIPPED — Work & Growth Journey step not found/visible');
    console.log('NO SUBSTITUTE ACTION PERFORMED');
  } else if (uiDisabled) {
    console.log('ACTION: UI exposes Work & Growth as disabled');
    console.log('ACTION: normal user click NOT dispatched — force NOT used');
    console.log('NO SUBSTITUTE ACTION PERFORMED');
    clickMode = 'unavailable-disabled';
    await page.waitForTimeout(1500);
  } else {
    console.log('ACTION: Click Work & Growth Journey step (normal)');
    try {
      await target.click({ timeout: 8000 });
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

  page.off('response', onResponse);
  console.log('CLICK MODE USED:', clickMode);

  const after = await dumpUi();
  logDump('AFTER CLICK', after);
  await page.screenshot({
    path: `${OUT}/step-25-after-work-growth.png`,
    fullPage: true,
  });

  const interestingNetwork = [];
  for (const response of rawResponses) {
    const request = response.request();
    const method = request.method();
    const url = response.url();
    const interesting =
      /\/api\/|mutation|execute|intent|life-event|ui-snapshot|user-context|profile|economic-reality|work|employment|growth/i.test(
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
      `${OUT}/step-25-work-growth-network.json`,
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
    JSON.stringify(before.inventory.selected) !== JSON.stringify(after.inventory.selected) ||
    JSON.stringify(before.currentSlide) !== JSON.stringify(after.currentSlide);
  const textChanged = before.visibleText !== after.visibleText;
  const headingChanged = JSON.stringify(before.headings) !== JSON.stringify(after.headings);
  const afterWorkSlide = (after.journeySlides || []).find(
    slide =>
      WORK_GROWTH_RE.test(`${slide.ariaLabel || ''} ${slide.text || ''}`) ||
      /Slide 06/i.test(slide.ariaLabel || '') ||
      slide.text === '06'
  );
  const workSelectedAfter = Boolean(
    afterWorkSlide &&
      (afterWorkSlide.ariaSelected === 'true' ||
        afterWorkSlide.ariaCurrent === 'true' ||
        afterWorkSlide.ariaPressed === 'true')
  );
  const inspectorPresent = Boolean(after.inspector);
  const realActionControls = (after.inspector?.actions || []).filter(
    action => action.tag === 'A' || action.tag === 'BUTTON'
  );
  const newCtaOrLink = buttonDiff.appeared.length > 0 || linkDiff.appeared.length > 0;
  const errorsYes =
    consoleErrors.slice(errorCountsBefore.console).length > 0 ||
    pageErrors.slice(errorCountsBefore.page).length > 0 ||
    otherFailures.length > 0;
  const opensModule = /\/modules\//.test(after.url) && after.url !== before.url;
  const afterPath = (() => {
    try {
      return new URL(after.url).pathname + new URL(after.url).search;
    } catch {
      return after.url;
    }
  })();

  console.log('');
  console.log('--- STEP 25 COMPARISON ---');
  console.log('URL BEFORE:', before.url);
  console.log('URL AFTER:', after.url);
  console.log('URL CHANGED:', urlChanged ? `YES (${before.url} → ${after.url})` : 'NO');
  console.log('NAVIGATION OCCURRED:', urlChanged ? 'YES' : 'NO');
  console.log('DESTINATION PATH:', afterPath);
  console.log('OPENS MODULE ROUTE:', opensModule ? 'YES' : 'NO');
  console.log('TITLE AFTER:', after.title);
  console.log('LANG BEFORE/AFTER:', before.lang, '→', after.lang);
  console.log('CLICK MODE USED:', clickMode);
  if (clickError) {
    console.log('CLICK ERROR:', clickError);
  }
  console.log('OBSERVED LABEL:', observedLabel);
  console.log('TARGET ENABLED/DISABLED:', uiDisabled ? 'disabled' : 'enabled');
  console.log('CURRENT STEP BEFORE:', before.currentSlide || before.inventory.selected);
  console.log('CURRENT STEP AFTER:', after.currentSlide || after.inventory.selected);
  console.log('WORK & GROWTH SELECTED AFTER:', workSelectedAfter ? 'YES' : 'NO');
  console.log('SELECTED CHANGED:', selectedChanged ? 'YES' : 'NO');
  console.log('HEADINGS CHANGED:', headingChanged ? 'YES' : 'NO');
  console.log('VISIBLE TEXT CHANGED:', textChanged ? 'YES' : 'NO');
  console.log('INSPECTOR PRESENT AFTER:', inspectorPresent ? 'YES' : 'NO');
  console.log('INSPECTOR CHANGED:', inspectorChanged ? 'YES' : 'NO');
  console.log('INSPECTOR AFTER:', after.inspector || 'None');
  console.log('MAP AFTER:', after.inventory.map.length ? after.inventory.map : 'None');
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
  console.log('LOADING AFTER:', after.loading > 0 ? `YES (${after.loading})` : 'None');
  console.log('ALERTS AFTER:', after.alerts.length ? after.alerts : 'None');
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
    'ECONOMIC-REALITY API:',
    interestingNetwork.filter(e => /\/api\/modules\/economic-reality/.test(e.url)).length
      ? interestingNetwork.filter(e => /\/api\/modules\/economic-reality/.test(e.url))
      : 'None'
  );
  console.log(
    'MODULES API:',
    interestingNetwork.filter(e => /\/api\/modules\//.test(e.url)).length
      ? interestingNetwork.filter(e => /\/api\/modules\//.test(e.url))
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
    'EXECUTE / MODULE EXECUTION:',
    interestingNetwork.filter(e => /\/execute|\/action\/execute/.test(e.url)).length
      ? interestingNetwork.filter(e => /\/execute|\/action\/execute/.test(e.url))
      : 'None'
  );
  console.log(
    'NETWORK ARTIFACT:',
    interestingNetwork.length
      ? `${OUT}/step-25-work-growth-network.json`
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
  console.log('ACTION: new CTA / Inspector links / other Journey steps / modules / Back NOT CLICKED');
  console.log('SCREENSHOT AFTER:', `${OUT}/step-25-after-work-growth.png`);

  console.log('');
  console.log('========================================');
  console.log('STEP 25 SUMMARY');
  console.log('========================================');
  console.log('STEP: 25');
  console.log('action:', clickMode === 'unavailable-disabled' || clickMode === 'skipped' ? clickMode : 'click Work & Growth Journey step');
  console.log('exact Work & Growth label observed:', observedLabel);
  console.log('target enabled/disabled:', uiDisabled ? 'disabled' : target ? 'enabled' : 'not found');
  console.log('URL before:', before.url);
  console.log('URL after:', after.url);
  console.log('navigation yes/no:', urlChanged ? 'yes' : 'no');
  console.log('selected/current step before:', JSON.stringify(before.currentSlide || before.inventory.selected));
  console.log('selected/current step after:', JSON.stringify(after.currentSlide || after.inventory.selected));
  console.log(
    'visible result:',
    urlChanged
      ? `navigated to ${afterPath}`
      : textChanged || selectedChanged || inspectorChanged
        ? 'Journey/UI changed without leaving page'
        : 'no observable UI change'
  );
  console.log('Inspector present yes/no:', inspectorPresent ? 'yes' : 'no');
  console.log('Inspector Status:', after.inspector?.statusParagraph || 'None');
  console.log('Inspector Context:', after.inspector?.sections?.Context || after.inspector?.sections?.context || 'None');
  console.log('Inspector Unlocks:', after.inspector?.sections?.Unlocks || after.inspector?.sections?.unlocks || 'None');
  console.log('Inspector Blocked:', after.inspector?.sections?.Blocked || after.inspector?.sections?.blocked || 'None');
  console.log(
    'Inspector Actions:',
    after.inspector?.actions?.length ? after.inspector.actions : after.inspector?.sections?.Actions || 'None'
  );
  console.log('real links/buttons yes/no:', realActionControls.length || after.links.length ? 'yes' : 'no');
  console.log('forms yes/no:', after.formCount > 0 ? `yes (${after.formCount})` : 'no');
  console.log('dialogs yes/no:', after.dialogCount > 0 ? `yes (${after.dialogCount})` : 'no');
  console.log('new CTA/link yes/no:', newCtaOrLink ? 'yes' : 'no');
  console.log('network yes/no:', interestingNetwork.length ? 'yes' : 'no');
  console.log('errors yes/no:', errorsYes ? 'yes' : 'no');
  console.log('artifact paths:');
  console.log(`  ${OUT}/step-25-before-work-growth.png`);
  console.log(`  ${OUT}/step-25-after-work-growth.png`);
  if (interestingNetwork.length) {
    console.log(`  ${OUT}/step-25-work-growth-network.json`);
  }
} finally {
  await browser.close();
}
