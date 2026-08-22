#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const GamePackages = require('../game-package-verifier');

const DEFAULT_ROOT = path.resolve(__dirname, '..', '..', '..');
const PLAN_PATH = path.join(__dirname, 'steam-product-plan.json');
const RIGHTS_FILES = new Set([
  'ASSET_LICENSES.md',
  'ASSET_PROVENANCE.md',
  'LICENSE_STATUS.md',
  'THIRD_PARTY_SOFTWARE.md'
]);

function addDays(dateText, days) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateText || ''));
  if (!match) throw new Error('date must use YYYY-MM-DD');
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  date.setUTCDate(date.getUTCDate() + Number(days));
  return date.toISOString().slice(0, 10);
}

function readPlan(planPath = PLAN_PATH) {
  return JSON.parse(fs.readFileSync(planPath, 'utf8'));
}

function validatePlan(plan) {
  const errors = [];
  if (!plan || plan.schema !== 'axm.steam-product-plan/v1') errors.push('unexpected or missing plan schema');
  if (!plan || plan.status !== 'TEST') errors.push('Steam preparation must remain TEST before human release approval');
  const product = plan && plan.product || {};
  if (product.scope !== 'One Steam application containing the AXM Local GameHub shell and its installed local game library.') {
    errors.push('product scope must preserve one GameHub app rather than separate Steam apps per game');
  }
  const timeline = plan && plan.timeline || {};
  try {
    const calculated = addDays(timeline.fee_payment_target, timeline.waiting_period_days);
    if (calculated !== timeline.earliest_release_if_fee_paid_on_target) errors.push('conditional earliest release date does not match the fee date plus waiting period');
  } catch (error) {
    errors.push(error.message);
  }
  if (!plan || !plan.required_gates || !Object.keys(plan.required_gates).length) errors.push('required_gates must not be empty');
  if (!plan || !plan.asset_contract || !Array.isArray(plan.asset_contract.required_images)) errors.push('asset contract is missing');
  return errors;
}

function pngDimensions(buffer) {
  const signature = '89504e470d0a1a0a';
  if (buffer.length < 24 || buffer.subarray(0, 8).toString('hex') !== signature) return null;
  const colorType = buffer.length > 25 ? buffer[25] : null;
  const hasTransparencyChunk = buffer.includes(Buffer.from('tRNS'));
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    format: 'png',
    hasAlpha: colorType === 4 || colorType === 6 || hasTransparencyChunk
  };
}

function jpegDimensions(buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  const sof = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
  let offset = 2;
  while (offset + 8 < buffer.length) {
    if (buffer[offset] !== 0xff) { offset += 1; continue; }
    while (buffer[offset] === 0xff) offset += 1;
    const marker = buffer[offset++];
    if (marker === 0xd8 || marker === 0xd9) continue;
    if (offset + 2 > buffer.length) return null;
    const length = buffer.readUInt16BE(offset);
    if (length < 2 || offset + length > buffer.length) return null;
    if (sof.has(marker) && length >= 7) {
      return { width: buffer.readUInt16BE(offset + 5), height: buffer.readUInt16BE(offset + 3), format: 'jpeg' };
    }
    offset += length;
  }
  return null;
}

function readImageDimensions(file) {
  const buffer = fs.readFileSync(file);
  return pngDimensions(buffer) || jpegDimensions(buffer);
}

function auditAssets(root, plan, baseDirectory) {
  const contract = plan.asset_contract;
  const base = path.resolve(root, baseDirectory || contract.base_directory);
  const images = contract.required_images.map(spec => {
    const file = path.join(base, spec.file);
    if (!fs.existsSync(file)) return { id: spec.id, file: path.relative(root, file), verdict: 'HOLD', reason: 'missing' };
    let dimensions;
    try { dimensions = readImageDimensions(file); }
    catch (error) { return { id: spec.id, file: path.relative(root, file), verdict: 'FAIL', reason: error.message }; }
    if (!dimensions) return { id: spec.id, file: path.relative(root, file), verdict: 'FAIL', reason: 'unsupported or corrupt image' };
    let matches = true;
    if (Number.isInteger(spec.width)) matches = matches && dimensions.width === spec.width;
    if (Number.isInteger(spec.height)) matches = matches && dimensions.height === spec.height;
    if (Array.isArray(spec.width_or_height)) {
      matches = matches && (dimensions.width === spec.width_or_height[0] || dimensions.height === spec.width_or_height[1]);
    }
    const alphaMatches = spec.transparent_background_required !== true || dimensions.hasAlpha === true;
    matches = matches && alphaMatches;
    const reason = matches ? null : !alphaMatches
      ? 'transparent PNG alpha channel is required'
      : 'dimensions do not match the current Steam contract';
    return { id: spec.id, file: path.relative(root, file), verdict: matches ? 'PASS' : 'FAIL', dimensions, reason };
  });

  const shotContract = contract.screenshots;
  const shotDir = path.join(base, shotContract.directory);
  const shots = fs.existsSync(shotDir)
    ? fs.readdirSync(shotDir).filter(file => /\.(?:png|jpe?g)$/i.test(file)).sort().map(name => {
      const file = path.join(shotDir, name);
      let dimensions;
      try { dimensions = readImageDimensions(file); }
      catch (error) { return { file: path.relative(root, file), verdict: 'FAIL', reason: error.message }; }
      const matches = dimensions
        && dimensions.width >= shotContract.minimum_width
        && dimensions.height >= shotContract.minimum_height
        && dimensions.width * 9 === dimensions.height * 16;
      return { file: path.relative(root, file), verdict: matches ? 'PASS' : 'FAIL', dimensions: dimensions || null, reason: matches ? null : 'screenshot must be at least 1920x1080 and exactly 16:9' };
    })
    : [];
  const enoughShots = shots.length >= shotContract.minimum_count;
  const pass = images.every(item => item.verdict === 'PASS') && enoughShots && shots.every(item => item.verdict === 'PASS');
  return {
    verdict: pass ? 'PASS' : (images.some(item => item.verdict === 'FAIL') || shots.some(item => item.verdict === 'FAIL') ? 'FAIL' : 'HOLD'),
    images,
    screenshots: shots,
    screenshot_count: shots.length,
    screenshot_minimum: shotContract.minimum_count
  };
}

function auditRightsCoverage(libraryDir) {
  const games = fs.readdirSync(libraryDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && fs.existsSync(path.join(libraryDir, entry.name, 'game.manifest.json')))
    .map(entry => {
      const names = fs.readdirSync(path.join(libraryDir, entry.name));
      const evidence = names.filter(name => RIGHTS_FILES.has(name));
      return { game: entry.name, evidence, verdict: evidence.length ? 'REVIEW' : 'HOLD' };
    });
  return {
    verdict: games.every(game => game.evidence.length) ? 'REVIEW' : 'HOLD',
    documented_games: games.filter(game => game.evidence.length).length,
    total_games: games.length,
    games
  };
}

function audit(root = DEFAULT_ROOT, plan = readPlan()) {
  const planErrors = validatePlan(plan);
  const libraryDir = path.join(root, 'tools', 'game-hub', 'game-library');
  const library = GamePackages.verifyLibrary(libraryDir);
  const assets = auditAssets(root, plan);
  const draftAssets = auditAssets(root, plan, 'tools/game-hub/steam/assets/draft/candidate');
  const rights = auditRightsCoverage(libraryDir);
  const runtimeFiles = [
    'runtime/node/node.exe',
    'runtime/node/LICENSE',
    'runtime/node/RUNTIME_PROVENANCE.json'
  ];
  const runtimeMissing = runtimeFiles.filter(file => !fs.existsSync(path.join(root, file)));
  const launchFiles = [
    'tools/game-hub/game-hub-server.js',
    'tools/game-hub/steam/start-steam-gamehub.js',
    'tools/game-hub/steam/steam-shell-server.js'
  ];
  const launchMissing = launchFiles.filter(file => !fs.existsSync(path.join(root, file)));
  const depotFiles = [
    'tools/game-hub/steam/steam-depot-content.json',
    'tools/game-hub/steam/build-steam-depot-candidate.js',
    'tools/game-hub/steam/steam-depot-selftest.js',
    'tools/game-hub/steam/DEPOT_EVIDENCE_ROUTE.md'
  ];
  const depotMissing = depotFiles.filter(file => !fs.existsSync(path.join(root, file)));
  const gates = Object.entries(plan.required_gates || {}).map(([id, gate]) => ({
    id,
    owner: gate.owner,
    verdict: gate.complete === true ? 'PASS' : 'HOLD'
  }));
  const checks = [
    { id: 'plan.static', verdict: planErrors.length ? 'FAIL' : 'PASS', details: planErrors },
    { id: 'game_library.structure', verdict: library.pass ? 'PASS' : 'FAIL', details: { games: library.games.length, failures: library.failCount } },
    { id: 'game_library.claim_warnings', verdict: library.warningCount ? 'HOLD' : 'PASS', details: { warnings: library.warningCount } },
    { id: 'windows.bundled_runtime', verdict: runtimeMissing.length ? 'HOLD' : 'PASS', details: { missing: runtimeMissing } },
    { id: 'windows.steam_launch_contract', verdict: launchMissing.length ? 'FAIL' : 'PASS', details: { missing: launchMissing, launch: plan.windows_launch } },
    { id: 'windows.depot_staging_contract', verdict: depotMissing.length ? 'FAIL' : 'PASS', details: { missing: depotMissing, safety_scan: 'secret/path scan plus content manifest and hashes', upload_performed: false } },
    { id: 'store.assets', verdict: assets.verdict, details: { required_images: assets.images.length, screenshots: assets.screenshot_count } },
    { id: 'store.draft_graphics', verdict: draftAssets.images.every(item => item.verdict === 'PASS') ? 'PASS' : 'HOLD', details: { passing_images: draftAssets.images.filter(item => item.verdict === 'PASS').length, required_images: draftAssets.images.length, gameplay_screenshots_are_separate: true } },
    { id: 'store.draft_gameplay_screenshots', verdict: draftAssets.screenshots.length >= draftAssets.screenshot_minimum && draftAssets.screenshots.every(item => item.verdict === 'PASS') ? 'PASS' : 'HOLD', details: { passing_screenshots: draftAssets.screenshots.filter(item => item.verdict === 'PASS').length, required_screenshots: draftAssets.screenshot_minimum, source: 'live runtime captures; see screenshot-manifest.json' } },
    { id: 'rights.standardized_per_game_evidence', verdict: rights.verdict, details: { documented_games: rights.documented_games, total_games: rights.total_games } },
    { id: 'steam.human_and_valve_gates', verdict: gates.every(gate => gate.verdict === 'PASS') ? 'PASS' : 'HOLD', details: { complete: gates.filter(gate => gate.verdict === 'PASS').length, total: gates.length } }
  ];
  const verdict = checks.some(check => check.verdict === 'FAIL') ? 'BROKEN'
    : checks.some(check => check.verdict === 'HOLD') ? 'HOLD'
      : 'READY_FOR_STEAM_REVIEW';
  return {
    schema: 'axm.steam-readiness-report/v1',
    status: 'TEST',
    generated_at: new Date().toISOString(),
    product: plan.product.working_name,
    verdict,
    conditional_earliest_release: plan.timeline.earliest_release_if_fee_paid_on_target,
    checks,
    game_library: {
      pass: library.pass,
      games: library.games.map(game => ({ game: game.game, slot: game.slot || null, errors: game.errors, warnings: game.warnings || [] })),
      failure_count: library.failCount,
      warning_count: library.warningCount
    },
    assets,
    draft_assets: draftAssets,
    rights,
    gates
  };
}

function printHuman(report) {
  console.log(`AXM STEAM READINESS · ${report.product} · ${report.status}`);
  report.checks.forEach(check => console.log(`${check.verdict.padEnd(6)} ${check.id} · ${JSON.stringify(check.details)}`));
  console.log(`Games: ${report.game_library.games.length} · failures: ${report.game_library.failure_count} · warnings: ${report.game_library.warning_count}`);
  console.log(`Conditional earliest release if the fee is paid 2026-08-18: ${report.conditional_earliest_release}`);
  console.log(`VERDICT ${report.verdict}`);
}

function main(argv = process.argv.slice(2)) {
  const report = audit();
  if (argv.includes('--json')) console.log(JSON.stringify(report, null, 2));
  else printHuman(report);
  if (report.verdict === 'BROKEN' || (argv.includes('--strict') && report.verdict !== 'READY_FOR_STEAM_REVIEW')) process.exitCode = 1;
  return report;
}

if (require.main === module) main();
module.exports = { addDays, audit, auditAssets, auditRightsCoverage, jpegDimensions, pngDimensions, readImageDimensions, readPlan, validatePlan };
