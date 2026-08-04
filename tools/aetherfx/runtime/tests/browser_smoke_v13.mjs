#!/usr/bin/env node
/**
 * Offline browser proof for the v1.3.0 single-file AXM AetherFX Studio.
 *
 * Uses the primary-runtime Playwright package through createRequire. If the
 * advertised Playwright Chromium is not present, the already-local
 * @sparticuz/chromium package is extracted and used as the executable.
 */
import { createRequire } from 'node:module';
import { existsSync, statSync } from 'node:fs';
import { readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist', 'AXM_AETHERFX_VISUAL_EFFECT_FABRIC_STUDIO_v1_3_0.html');
const REPORT = path.join(ROOT, 'reports', 'browser_smoke_v1_3_0.json');
const CANONICAL_DESKTOP_REPORT = path.join(ROOT, 'reports', 'BROWSER_SMOKE.json');
const CANONICAL_MOBILE_REPORT = path.join(ROOT, 'reports', 'MOBILE_SMOKE.json');
const DESKTOP_SCREENSHOT = path.join(ROOT, 'reports', 'studio_desktop_v1_3_0.png');
const MOBILE_SCREENSHOT = path.join(ROOT, 'reports', 'studio_mobile_v1_3_0.png');
const ACTIVE_TEMP_SCREENSHOT = '/tmp/axm_studio_active_v1_3_0.png';
const ADVERTISED_CHROMIUM = '/root/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome';
const EXTRACTED_SPARTICUZ_CHROMIUM = '/tmp/axm-chromium-149';
const SPARTICUZ_ENTRY = '/tmp/axm-browser/node_modules/@sparticuz/chromium/build/index.js';

const STORAGE_STUB = `(() => {
  const state = new Map();
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: key => state.has(String(key)) ? state.get(String(key)) : null,
      setItem: (key, value) => state.set(String(key), String(value)),
      removeItem: key => state.delete(String(key)),
      clear: () => state.clear(),
      key: index => [...state.keys()][index] ?? null,
      get length() { return state.size; }
    }
  });
})();`;

function argumentValue(prefix) {
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
}

async function resolveChromiumExecutable() {
  const explicit = argumentValue('--chromium=');
  if (explicit) {
    if (!existsSync(explicit)) throw new Error(`Explicit Chromium executable does not exist: ${explicit}`);
    return { executablePath: explicit, source: 'explicit --chromium argument', launchArgs: ['--no-sandbox'] };
  }
  if (existsSync(ADVERTISED_CHROMIUM)) {
    return { executablePath: ADVERTISED_CHROMIUM, source: 'Playwright Chromium cache', launchArgs: ['--no-sandbox'] };
  }
  if (existsSync(EXTRACTED_SPARTICUZ_CHROMIUM) && statSync(EXTRACTED_SPARTICUZ_CHROMIUM).size > 1_000_000) {
    return {
      executablePath: EXTRACTED_SPARTICUZ_CHROMIUM,
      source: `extracted local @sparticuz/chromium (${SPARTICUZ_ENTRY})`,
      launchArgs: ['--no-sandbox']
    };
  }
  if (existsSync(SPARTICUZ_ENTRY)) {
    const { default: Chromium } = await import(pathToFileURL(SPARTICUZ_ENTRY).href);
    const executablePath = await Chromium.executablePath();
    return {
      executablePath,
      source: `local @sparticuz/chromium (${SPARTICUZ_ENTRY})`,
      launchArgs: [...Chromium.args, '--no-sandbox']
    };
  }
  return { executablePath: null, source: 'Playwright-managed Chromium', launchArgs: [] };
}

function wireEvidence(page) {
  const evidence = { pageErrors: [], consoleErrors: [], externalRequests: [] };
  page.on('pageerror', (error) => evidence.pageErrors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() === 'error') evidence.consoleErrors.push(message.text());
  });
  page.on('request', (request) => {
    if (/^https?:/i.test(request.url())) evidence.externalRequests.push(request.url());
  });
  return evidence;
}

async function loadStudio(page, html) {
  await page.evaluate(STORAGE_STUB);
  await page.setContent(html, { waitUntil: 'load' });
  await page.waitForSelector('html[data-axm-ready="true"]');
  await page.waitForSelector('#previewStage[data-ready="true"]');
}

function pushAssertion(assertions, name, passed, detail) {
  assertions.push({ name, passed: Boolean(passed), detail });
}

async function runDesktop(browser, html, assertions) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, acceptDownloads: true });
  const evidence = wireEvidence(page);
  await loadStudio(page, html);

  const shell = await page.evaluate(() => {
    const visible = (selector) => {
      const node = document.querySelector(selector);
      if (!node) return false;
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
    };
    return {
      title: document.title,
      footer: document.querySelector('.footer-root')?.textContent?.trim() || '',
      ready: document.documentElement.dataset.axmReady,
      previewReady: document.querySelector('#previewStage')?.dataset.ready,
      visiblePanels: {
        library: visible('.left-panel'),
        preview: visible('.center-panel'),
        controls: visible('.right-panel')
      },
      libraryCards: document.querySelectorAll('#moduleLibrary [data-module-id]').length,
      activeLayers: document.querySelectorAll('#activeStack [data-instance-id]').length
    };
  });

  pushAssertion(assertions, 'v1.3 distribution identity', shell.footer.includes('v1.3.0'), shell.footer);
  pushAssertion(assertions, 'desktop shell ready', shell.ready === 'true' && shell.previewReady === 'true', shell);
  pushAssertion(assertions, 'three desktop work areas visible', Object.values(shell.visiblePanels).every(Boolean), shell.visiblePanels);

  const initialLayers = shell.activeLayers;
  await page.locator('[data-module-id="light.sweep"] [data-action="add-module"]').click();
  await page.waitForSelector('.fx-overlay-sweep');
  await page.locator('[data-tab="library"]').click();
  await page.locator('[data-module-id="motion.loading-shimmer"] [data-action="add-module"]').click();
  await page.waitForSelector('.fx-loading-shimmer');
  const layersAfterAdd = await page.locator('#activeStack [data-instance-id]').count();
  pushAssertion(assertions, 'module add interaction', layersAfterAdd === initialLayers + 2, { initialLayers, layersAfterAdd });

  const activeAnimation = await page.evaluate(() => ({
    sweep: getComputedStyle(document.querySelector('.fx-overlay-sweep')).animationName,
    shimmer: getComputedStyle(document.querySelector('.fx-loading-shimmer'), '::after').animationName,
    safeClass: document.querySelector('#previewStage').classList.contains('is-photosensitive-safe')
  }));
  await page.screenshot({ path: ACTIVE_TEMP_SCREENSHOT, fullPage: false });

  await page.locator('#togglePhotosensitiveSafe').check();
  await page.waitForFunction(() => document.querySelector('#previewStage')?.classList.contains('is-photosensitive-safe'));
  const safeAnimation = await page.evaluate(() => ({
    sweep: getComputedStyle(document.querySelector('.fx-overlay-sweep')).animationName,
    shimmer: getComputedStyle(document.querySelector('.fx-loading-shimmer'), '::after').animationName,
    safeClass: document.querySelector('#previewStage').classList.contains('is-photosensitive-safe')
  }));
  pushAssertion(
    assertions,
    'photosensitive mode suppresses sweep and shimmer animation',
    activeAnimation.sweep !== 'none'
      && activeAnimation.shimmer !== 'none'
      && safeAnimation.safeClass
      && safeAnimation.sweep === 'none'
      && safeAnimation.shimmer === 'none',
    { before: activeAnimation, after: safeAnimation }
  );

  const stackControl = await page.locator('#activeStack .stack-select').first().evaluate((node) => ({
    tagName: node.tagName,
    ariaLabel: node.getAttribute('aria-label'),
    tabIndex: node.tabIndex
  }));
  pushAssertion(
    assertions,
    'stack selection is keyboard-focusable',
    stackControl.tagName === 'BUTTON' && stackControl.tabIndex >= 0 && Boolean(stackControl.ariaLabel),
    stackControl
  );

  await page.locator('#btnValidate').click();
  await page.waitForSelector('#validationDialog[open]');
  const validationText = await page.locator('#validationDialogBody').innerText();
  pushAssertion(
    assertions,
    'validation dialog reports resolved plan',
    validationText.includes('Blocking errors') && validationText.includes('Resolved render modules'),
    validationText.slice(0, 320)
  );
  await page.locator('#validationDialog [data-close-dialog]').last().click();

  await page.locator('#btnExport').click();
  await page.locator('#exportTargetProfile').selectOption('generic-game-contract');
  const downloadEvent = page.waitForEvent('download');
  await page.locator('#exportTargetReport').click();
  const download = await downloadEvent;
  const downloadPath = await download.path();
  const downloadBytes = Buffer.byteLength(await readFile(downloadPath));
  const downloadJson = JSON.parse(await readFile(downloadPath, 'utf8'));
  const downloadEvidence = {
    suggestedFilename: download.suggestedFilename(),
    bytes: downloadBytes,
    schema: downloadJson.schema,
    target: downloadJson.target?.id,
    operations: downloadJson.operations?.length,
    summary: downloadJson.summary
  };
  pushAssertion(
    assertions,
    'target support report download',
    downloadBytes > 500
      && downloadJson.schema === 'axm.adapter-support-report/1'
      && downloadJson.target?.id === 'generic-game-contract'
      && downloadJson.operations?.length > 0,
    downloadEvidence
  );

  await page.screenshot({ path: DESKTOP_SCREENSHOT, fullPage: true });
  pushAssertion(
    assertions,
    'desktop session stayed local and error-free',
    evidence.pageErrors.length === 0 && evidence.consoleErrors.length === 0 && evidence.externalRequests.length === 0,
    evidence
  );

  await page.close();
  return {
    viewport: { width: 1600, height: 1000 },
    shell,
    interactions: { initialLayers, layersAfterAdd, stackControl },
    animationSafety: { before: activeAnimation, after: safeAnimation },
    validationSummaryVisible: validationText.includes('Blocking errors'),
    download: downloadEvidence,
    ...evidence,
    screenshot: 'reports/studio_desktop_v1_3_0.png',
    temporaryActiveFrame: ACTIVE_TEMP_SCREENSHOT
  };
}

async function runMobile(browser, html, assertions) {
  const page = await browser.newPage({ viewport: { width: 412, height: 915 } });
  const evidence = wireEvidence(page);
  await loadStudio(page, html);

  const metrics = await page.evaluate(() => {
    const rect = (selector) => {
      const value = document.querySelector(selector)?.getBoundingClientRect();
      return value ? { left: Math.round(value.left), right: Math.round(value.right), width: Math.round(value.width) } : null;
    };
    return {
      viewportWidth: innerWidth,
      htmlScrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      documentHeight: document.documentElement.scrollHeight,
      preview: rect('#previewWrap'),
      libraryPanel: rect('.left-panel'),
      controlPanel: rect('.right-panel'),
      mobileToolsVisible: (() => {
        const node = document.querySelector('#mobileTools');
        if (!node) return false;
        const style = getComputedStyle(node);
        const bounds = node.getBoundingClientRect();
        return style.display !== 'none' && bounds.width > 0 && bounds.height > 0;
      })()
    };
  });
  const overflowPixels = Math.max(0, metrics.htmlScrollWidth - metrics.viewportWidth, metrics.bodyScrollWidth - metrics.viewportWidth);
  pushAssertion(assertions, 'mobile layout has no horizontal overflow', overflowPixels === 0, { ...metrics, overflowPixels });
  pushAssertion(
    assertions,
    'mobile work areas fit viewport',
    [metrics.preview, metrics.libraryPanel, metrics.controlPanel].every((item) => item && item.left >= 0 && item.right <= metrics.viewportWidth + 1),
    metrics
  );

  await page.locator('#mobileTools summary').click();
  await page.locator('[data-mobile-action="validate"]').click();
  await page.waitForSelector('#validationDialog[open]');
  const validationText = await page.locator('#validationDialogBody').innerText();
  pushAssertion(
    assertions,
    'mobile compact tools reach validation',
    validationText.includes('Blocking errors') && validationText.includes('Resolved render modules'),
    validationText.slice(0, 320)
  );
  await page.locator('#validationDialog [data-close-dialog]').last().click();
  await page.screenshot({ path: MOBILE_SCREENSHOT, fullPage: true });

  pushAssertion(
    assertions,
    'mobile session stayed local and error-free',
    evidence.pageErrors.length === 0 && evidence.consoleErrors.length === 0 && evidence.externalRequests.length === 0,
    evidence
  );

  await page.close();
  return {
    viewport: { width: 412, height: 915 },
    metrics,
    horizontalOverflowPixels: overflowPixels,
    validationSummaryVisible: validationText.includes('Blocking errors'),
    ...evidence,
    screenshot: 'reports/studio_mobile_v1_3_0.png'
  };
}

async function main() {
  if (!existsSync(DIST)) throw new Error(`Build the v1.3.0 single-file studio first: ${DIST}`);
  const runtimeModules = process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
  const runtimeRequire = runtimeModules
    ? createRequire(path.join(runtimeModules, 'package.json'))
    : createRequire(import.meta.url);
  const { chromium } = runtimeRequire('playwright');
  const playwrightVersion = runtimeRequire('playwright/package.json').version;
  const browserResolution = await resolveChromiumExecutable();
  const html = await readFile(DIST, 'utf8');
  const assertions = [];
  const launch = { args: browserResolution.launchArgs, headless: true };
  if (browserResolution.executablePath) launch.executablePath = browserResolution.executablePath;
  const browser = await chromium.launch(launch);

  let desktop;
  let mobile;
  try {
    desktop = await runDesktop(browser, html, assertions);
    mobile = await runMobile(browser, html, assertions);
  } finally {
    await browser.close();
  }
  const activeFrameDeleted = await unlink(ACTIVE_TEMP_SCREENSHOT).then(() => true, () => false);

  const failedAssertions = assertions.filter((assertion) => !assertion.passed);
  const report = {
    schema: 'axm.browser-proof/1',
    observedAt: new Date().toISOString(),
    verdict: failedAssertions.length ? 'FAIL' : 'PASS',
    visualBackend: 'LOCAL_CHROMIUM_PLAYWRIGHT',
    distribution: path.relative(ROOT, DIST),
    browser: {
      playwrightVersion,
      executablePath: browserResolution.executablePath,
      source: browserResolution.source,
      fullyLocal: true
    },
    claims: {
      desktopAndMobileShell: 'Rendered and interacted with at fixed desktop and phone viewports.',
      accessibility: 'Computed animation names were captured before and after photosensitive-safe mode.',
      locality: 'Any HTTP(S) request is recorded and fails the proof.',
      boundary: 'This is a same-environment Chromium smoke proof, not cross-browser or native-engine parity.'
    },
    cleanup: {
      temporaryPath: ACTIVE_TEMP_SCREENSHOT,
      deleted: activeFrameDeleted
    },
    assertions,
    desktop,
    mobile
  };
  await writeFile(REPORT, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await writeFile(CANONICAL_DESKTOP_REPORT, `${JSON.stringify({
    schema: 'axm.browser-smoke/1',
    version: '1.3.0',
    verdict: report.verdict,
    observedAt: report.observedAt,
    title: desktop.shell.title,
    ready: desktop.shell.ready,
    previewReady: desktop.shell.previewReady,
    initialLibraryCards: desktop.shell.libraryCards,
    initialLayers: desktop.interactions.initialLayers,
    layersAfterAdd: desktop.interactions.layersAfterAdd,
    validationContainsSummary: desktop.validationSummaryVisible,
    photosensitiveSuppressionVerified: assertions.find((item) => item.name.startsWith('photosensitive mode'))?.passed ?? false,
    targetSupportReportDownloaded: assertions.find((item) => item.name === 'target support report download')?.passed ?? false,
    targetSupportReportBytes: desktop.download.bytes,
    targetSupportReportFilename: desktop.download.suggestedFilename,
    pageErrors: desktop.pageErrors,
    consoleErrors: desktop.consoleErrors,
    networkRequests: desktop.externalRequests,
    browser: report.browser,
    screenshot: desktop.screenshot
  }, null, 2)}\n`, 'utf8');
  await writeFile(CANONICAL_MOBILE_REPORT, `${JSON.stringify({
    schema: 'axm.browser-smoke/1',
    version: '1.3.0',
    verdict: report.verdict,
    observedAt: report.observedAt,
    metrics: mobile.metrics,
    horizontalOverflowPixels: mobile.horizontalOverflowPixels,
    mobileToolsValidated: mobile.validationSummaryVisible,
    pageErrors: mobile.pageErrors,
    consoleErrors: mobile.consoleErrors,
    networkRequests: mobile.externalRequests,
    browser: report.browser,
    screenshot: mobile.screenshot
  }, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (failedAssertions.length) {
    throw new Error(`Browser proof failed: ${failedAssertions.map((item) => item.name).join('; ')}`);
  }
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
