import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (rel, fallback = null) => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8')); } catch { return fallback; } };
const pkg = readJson('package.json', {});
const catalog = readJson('catalog/default-catalog.json', { modules: [], moods: [] });
const validation = readJson('reports/VALIDATION.json', { errors: [], warnings: [] });
const browser = readJson('reports/BROWSER_SMOKE.json', {});
const mobile = readJson('reports/MOBILE_SMOKE.json', {});
const browserProof = readJson('reports/browser_smoke_v1_3_0.json', {});
const inheritedRegression = readJson('reports/VISUAL_REGRESSION.json', {});
const regression = inheritedRegression.version === pkg.version ? inheritedRegression : {};
const inventory = readJson('reports/INVENTORY.json', {});
const manifest = readJson('AXM_INTAKE_MANIFEST.json', {});
const byKind = Object.fromEntries([...new Set(catalog.modules.map(m => m.kind))].sort().map(k => [k, catalog.modules.filter(m => m.kind === k).length]));
let tests = manifest?.verification?.automatedTests || { passed: null, failed: null, skipped: null };
try {
  const log = fs.readFileSync(path.join(ROOT, 'reports/NPM_VERIFY_v1_3_0.log'), 'utf8');
  const last = pattern => log.match(pattern)?.at(-1)?.match(/\d+/)?.[0];
  tests = { passed: Number(last(/# pass \d+/g) ?? tests.passed), failed: Number(last(/# fail \d+/g) ?? tests.failed), skipped: Number(last(/# skipped \d+/g) ?? tests.skipped) };
} catch {}
const countJson = rel => fs.existsSync(path.join(ROOT, rel)) ? fs.readdirSync(path.join(ROOT, rel)).filter(f => f.endsWith('.json')).length : 0;
const adapterDir = path.join(ROOT, 'dist/adapters');
const summary = {
  schema: 'axm.build-summary/1',
  generated: new Date().toISOString(),
  project: 'AXM AetherFX Visual Effect Fabric',
  version: pkg.version,
  date: '2026-07-28',
  status: 'WORKING — final verified local intake candidate',
  architecture: 'Primitives → Effects → Organs → Molds → Scenes → Products',
  catalog: { modules: catalog.modules.length, moods: catalog.moods.length, byKind },
  packages: { starter: countJson('packages/starter'), expansionV11: countJson('packages/expansion-v1.1'), sealedTotal: countJson('packages/starter') + countJson('packages/expansion-v1.1') },
  examples: { recipes: countJson('examples/recipes'), staticSvg: 6, adapterOutputs: fs.existsSync(adapterDir) ? fs.readdirSync(adapterDir).sort() : [] },
  finalHardening: [
    'Raw recipe validation before explicit normalization review',
    'Required SHA-256 integrity and atomic package import',
    'Cycle, depth, size, renderer, CSS-binding, and generated-layer bounds',
    'Recipe-plus-custom-module snapshots with staged restore',
    'Correct sweep and shimmer suppression in photosensitive-safe mode',
    'Canonical resolved visual intent and per-target support reports',
    'Portable renderer-neutral runtime and local validate/compile/inspect CLI',
    'Composite-aware static SVG approximation with unsupported interaction counts',
    'Contained local server with malformed-path and traversal rejection'
  ],
  verification: {
    tests,
    stressLayers: 320,
    catalogErrors: validation.errors?.length ?? null,
    catalogWarnings: validation.warnings?.length ?? null,
    warningPolicy: 'Public licences intentionally remain UNSET until reviewed.',
    browserAssertions: {
      verdict: browserProof.verdict ?? null,
      passed: browserProof.assertions?.filter((item) => item.passed).length ?? null,
      total: browserProof.assertions?.length ?? null,
      visualBackend: browserProof.visualBackend ?? null,
      boundary: browserProof.claims?.boundary ?? null
    },
    desktop: {
      verdict: browser.verdict ?? null,
      ready: browser.ready ?? null,
      previewReady: browser.previewReady ?? null,
      initialLayers: browser.initialLayers ?? null,
      layersAfterAdd: browser.layersAfterAdd ?? null,
      photosensitiveSuppressionVerified: browser.photosensitiveSuppressionVerified ?? null,
      targetSupportReportDownloaded: browser.targetSupportReportDownloaded ?? null,
      targetSupportReportBytes: browser.targetSupportReportBytes ?? null,
      pageErrors: browser.pageErrors?.length ?? null,
      consoleErrors: browser.consoleErrors?.length ?? null,
      externalNetworkRequests: browser.networkRequests?.length ?? null,
      browser: browser.browser ?? null,
      screenshot: browser.screenshot ?? null
    },
    mobile: {
      verdict: mobile.verdict ?? null,
      horizontalOverflowPixels: mobile.horizontalOverflowPixels ?? null,
      toolsValidated: mobile.mobileToolsValidated ?? null,
      pageErrors: mobile.pageErrors?.length ?? null,
      consoleErrors: mobile.consoleErrors?.length ?? null,
      externalNetworkRequests: mobile.networkRequests?.length ?? null,
      screenshot: mobile.screenshot ?? null
    },
    visualRegression: {
      currentVersionEvidence: Boolean(regression.version === pkg.version),
      passed: regression.passed ?? null,
      meanAbsoluteDifference: regression.meanAbsoluteDifference ?? null,
      changedPixelRatioOver18: regression.changedPixelRatioOver18 ?? null,
      scope: regression.scope ?? null,
      inheritedBaseline: regression.version === pkg.version ? null : (inheritedRegression.baseline ?? null)
    }
  },
  artifact: {
    fileCount: inventory.fileCount ?? null,
    totalBytes: inventory.totalBytes ?? null,
    studio: 'OPEN_STUDIO.html',
    versionedStudio: 'dist/AXM_AETHERFX_VISUAL_EFFECT_FABRIC_STUDIO_v1_3_0.html'
  },
  nextAction: 'Integrate into one real AXM product surface and implement only adapter gaps proven by use.',
  boundaries: [
    'Godot and Unity routes are theme/token starter bridges, not full native runtime plugins.',
    'Static SVG output approximates dynamic visual behavior.',
    'Photosensitive-safe mode is protective design behavior, not medical certification.',
    'Visual regression is a same-environment drift guard, not cross-platform pixel parity.',
    'Integrity proves consistency, not ownership, consent, or public redistribution rights.',
    'Imported packages remain declarative and cannot supply arbitrary executable code.'
  ]
};
fs.writeFileSync(path.join(ROOT, 'reports/BUILD_SUMMARY.json'), JSON.stringify(summary, null, 2) + '\n');
console.log(`Built reports/BUILD_SUMMARY.json for v${pkg.version}.`);
