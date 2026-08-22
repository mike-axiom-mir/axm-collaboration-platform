#!/usr/bin/env node
'use strict';

const assert = require('assert');
const childProcess = require('child_process');
const fs = require('fs');
const path = require('path');
const Launch = require('./start-steam-gamehub');
const Readiness = require('./steam-readiness');

const root = path.resolve(__dirname, '..', '..', '..');
const plan = Readiness.readPlan();
const report = Readiness.audit(root, plan);

assert.deepStrictEqual(Readiness.validatePlan(plan), []);
assert.strictEqual(Readiness.addDays('2026-08-18', 30), '2026-09-17');
assert.strictEqual(plan.product.working_name, 'AXM Local GameHub');
assert.match(plan.product.scope, /One Steam application/);
assert.strictEqual(plan.product.steam_app_id, null);
assert.strictEqual(plan.windows_launch.executable, 'runtime\\node\\node.exe');
assert.strictEqual(plan.windows_launch.arguments, 'tools\\game-hub\\steam\\start-steam-gamehub.js');
assert.strictEqual(plan.asset_contract.required_images.length, 10);
assert.strictEqual(plan.asset_contract.screenshots.minimum_count, 5);
assert.strictEqual(report.status, 'TEST');
assert.strictEqual(report.game_library.pass, true);
assert.strictEqual(report.game_library.games.length, 19);
assert.ok(report.game_library.warning_count > 0, 'declared GameHub QA warnings must remain visible');
assert.strictEqual(report.verdict, 'HOLD');
assert.ok(report.gates.some(gate => gate.verdict === 'HOLD'));
assert.strictEqual(report.rights.documented_games, report.rights.total_games);
assert.strictEqual(report.rights.verdict, 'REVIEW', 'complete ledgers still require human rights review');
assert.strictEqual(report.checks.find(check => check.id === 'windows.depot_staging_contract').verdict, 'PASS');
assert.strictEqual(Launch.expectedSteamShellHealth({ statusCode: 200, body: { ok: true, name: 'AXM Steam GameHub Shell', distribution: 'steam' } }), true);
assert.strictEqual(Launch.expectedSteamShellHealth({ statusCode: 200, body: { ok: true, name: 'AXM Workshop', distribution: 'workshop' } }), false);
assert.strictEqual(Launch.expectedGameHubHealth({ statusCode: 200, body: { ok: true, name: 'AXM Game Hub' } }), true);
assert.strictEqual(Launch.expectedGameHubHealth({ statusCode: 200, body: { ok: true, name: 'other-service' } }), false);
assert.strictEqual(Launch.gameHubUrl(8790), 'http://127.0.0.1:8790/tools/game-hub/index.html?distribution=steam');
assert.deepStrictEqual(Launch.assertLaunchInputs(), [
  'tools/game-hub/game-hub-server.js',
  'tools/game-hub/index.html',
  'tools/game-hub/steam/steam-shell-server.js'
]);
assert.ok(fs.existsSync(path.join(root, 'runtime', 'node', 'node.exe')));
require('./steam-shell-selftest');
childProcess.execFileSync(process.execPath, [path.join(__dirname, 'steam-shell-server-selftest.js')], { stdio: 'inherit' });
childProcess.execFileSync(process.execPath, [path.join(__dirname, 'steam-art-draft-selftest.js')], { stdio: 'inherit' });
childProcess.execFileSync(process.execPath, [path.join(__dirname, 'steam-screenshot-draft-selftest.js')], { stdio: 'inherit' });
childProcess.execFileSync(process.execPath, [path.join(__dirname, 'steam-depot-selftest.js')], { stdio: 'inherit' });

console.log(`steam readiness selftest: PASS · ${report.game_library.games.length} games · ${report.game_library.warning_count} warnings preserved · verdict ${report.verdict}`);
