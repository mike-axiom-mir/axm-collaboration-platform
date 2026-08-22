#!/usr/bin/env node
/**
 * Same-environment visual regression guard for the v1.3.0 single-file Studio.
 *
 * Optional dependencies: playwright, pngjs, and pixelmatch. In Codex Work Mode
 * they are resolved from CODEX_PRIMARY_RUNTIME_NODE_MODULES; a local install is
 * also supported. This is a drift guard, not cross-browser pixel parity.
 */
import { createRequire } from 'node:module';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist', 'AXM_AETHERFX_VISUAL_EFFECT_FABRIC_STUDIO_v1_3_0.html');
const BASELINE = path.join(ROOT, 'reports', 'baselines', 'studio_desktop_v1_3_0.png');
const CURRENT = path.join(ROOT, 'reports', 'studio_visual_regression_v1_3_0_current.png');
const DIFF = path.join(ROOT, 'reports', 'studio_visual_regression_v1_3_0_diff.png');
const REPORT = path.join(ROOT, 'reports', 'VISUAL_REGRESSION.json');
const ADVERTISED_CHROMIUM = '/root/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome';
const EXTRACTED_SPARTICUZ_CHROMIUM = '/tmp/axm-chromium-149';
const SPARTICUZ_ENTRY = '/tmp/axm-browser/node_modules/@sparticuz/chromium/build/index.js';
const MEAN_THRESHOLD = 2.4;
const CHANGED_RATIO_THRESHOLD = 0.035;

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

const FREEZE_CSS = `
*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}
#fpsStatus,#autosaveStatus,#toastRegion{visibility:hidden!important}
`;

function argumentValue(prefix) {
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
}

function dependencyRequire() {
  if (process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES) {
    return createRequire(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES, 'package.json'));
  }
  return createRequire(import.meta.url);
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
    return {
      executablePath: await Chromium.executablePath(),
      source: `local @sparticuz/chromium (${SPARTICUZ_ENTRY})`,
      launchArgs: [...Chromium.args, '--no-sandbox']
    };
  }
  return { executablePath: null, source: 'Playwright-managed Chromium', launchArgs: [] };
}

async function capture(chromium, executable) {
  const html = await readFile(DIST, 'utf8');
  const launch = { headless: true, args: executable.launchArgs };
  if (executable.executablePath) launch.executablePath = executable.executablePath;
  const browser = await chromium.launch(launch);
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
    await page.evaluate(STORAGE_STUB);
    await page.setContent(html, { waitUntil: 'load' });
    await page.waitForSelector('html[data-axm-ready="true"]');
    await page.waitForSelector('#previewStage[data-ready="true"]');
    await page.addStyleTag({ content: FREEZE_CSS });
    await page.evaluate(() => {
      const quality = document.querySelector('#qualitySelect');
      quality.value = 'high';
      quality.dispatchEvent(new Event('change', { bubbles: true }));
      const reduced = document.querySelector('#toggleReducedMotion');
      reduced.checked = true;
      reduced.dispatchEvent(new Event('change', { bubbles: true }));
      document.querySelectorAll('#toastRegion > *').forEach((node) => node.remove());
    });
    await page.waitForTimeout(180);
    await page.screenshot({ path: CURRENT, fullPage: false });
  } finally {
    await browser.close();
  }
}

function compare(PNG, pixelmatch, baselineBuffer, currentBuffer) {
  const baseline = PNG.sync.read(baselineBuffer);
  const current = PNG.sync.read(currentBuffer);
  if (baseline.width !== current.width || baseline.height !== current.height) {
    return {
      passed: false,
      reason: 'dimension mismatch',
      baselineSize: [baseline.width, baseline.height],
      currentSize: [current.width, current.height]
    };
  }
  const diff = new PNG({ width: baseline.width, height: baseline.height });
  pixelmatch(baseline.data, current.data, diff.data, baseline.width, baseline.height, { threshold: 0.1 });
  let absolute = 0;
  let changed = 0;
  const pixels = baseline.width * baseline.height;
  for (let index = 0; index < baseline.data.length; index += 4) {
    const red = Math.abs(baseline.data[index] - current.data[index]);
    const green = Math.abs(baseline.data[index + 1] - current.data[index + 1]);
    const blue = Math.abs(baseline.data[index + 2] - current.data[index + 2]);
    absolute += red + green + blue;
    if ((red + green + blue) / 3 > 18) changed += 1;
  }
  const mean = absolute / (pixels * 3);
  const changedRatio = changed / pixels;
  return {
    passed: mean <= MEAN_THRESHOLD && changedRatio <= CHANGED_RATIO_THRESHOLD,
    meanAbsoluteDifference: Number(mean.toFixed(4)),
    changedPixelRatioOver18: Number(changedRatio.toFixed(6)),
    thresholds: {
      meanAbsoluteDifference: MEAN_THRESHOLD,
      changedPixelRatioOver18: CHANGED_RATIO_THRESHOLD
    },
    diff
  };
}

async function main() {
  if (!existsSync(DIST)) throw new Error(`Build the v1.3.0 single-file Studio first: ${DIST}`);
  const requireDependency = dependencyRequire();
  let playwright;
  let PNG;
  let pixelmatch;
  try {
    playwright = requireDependency('playwright');
    ({ PNG } = requireDependency('pngjs'));
    pixelmatch = requireDependency('pixelmatch').default;
  } catch (error) {
    throw new Error(`Optional visual-test dependencies are unavailable: ${error.message}`);
  }
  const executable = await resolveChromiumExecutable();
  await mkdir(path.dirname(BASELINE), { recursive: true });
  await capture(playwright.chromium, executable);

  const updateBaseline = process.argv.includes('--update-baseline') || !existsSync(BASELINE);
  if (updateBaseline) await copyFile(CURRENT, BASELINE);
  const result = compare(PNG, pixelmatch, await readFile(BASELINE), await readFile(CURRENT));
  if (result.diff) {
    await writeFile(DIFF, PNG.sync.write(result.diff));
    delete result.diff;
  }
  const report = {
    schema: 'axm.visual-regression/1',
    version: '1.3.0',
    observedAt: new Date().toISOString(),
    passed: result.passed,
    baselineUpdated: updateBaseline,
    ...result,
    baseline: 'reports/baselines/studio_desktop_v1_3_0.png',
    current: 'reports/studio_visual_regression_v1_3_0_current.png',
    diff: 'reports/studio_visual_regression_v1_3_0_diff.png',
    browser: {
      playwrightVersion: requireDependency('playwright/package.json').version,
      executablePath: executable.executablePath,
      source: executable.source
    },
    scope: 'same-environment Chromium drift guard; not cross-browser or native-engine pixel parity'
  };
  await writeFile(REPORT, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!report.passed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
