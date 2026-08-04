#!/usr/bin/env node
'use strict';

const assert = require('assert');
const childProcess = require('child_process');
const fs = require('fs');
const path = require('path');

const dir = __dirname;
const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
const contract = JSON.parse(fs.readFileSync(path.join(dir, 'module.contract.json'), 'utf8'));
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const packager = fs.readFileSync(path.join(dir, 'package-workshop.ps1'), 'utf8');
const runtimeTool = fs.readFileSync(path.join(dir, '..', '..', 'scripts', 'windows-runtime-bundle.js'), 'utf8');
const launcher = fs.readFileSync(path.join(dir, '..', '..', 'OPEN_AXM_WORKSHOP.cmd'), 'utf8');
const catalog = JSON.parse(fs.readFileSync(path.join(dir, '..', '..', 'shared', 'operations', 'deployment-capability-catalog.json'), 'utf8'));

assert.equal(manifest.schema, 'axm.tool-manifest/v1');
assert.equal(manifest.kind, 'product');
assert.equal(manifest.version, 'v0.4');
assert.equal(manifest.contract, 'module.contract.json');
assert.deepEqual(manifest.permissions.slice().sort(), contract.permissions.slice().sort());
assert(manifest.produces.includes('axm.build-on-handoff/v1'));
assert(contract.provides.includes('current-build-on-zip'));
assert(contract.provides.includes('build-on-return-guide'));
assert(contract.provides.includes('exact-build-on-base-ledger'));
assert(contract.provides.includes('offline-windows-candidate'));
assert(contract.provides.includes('license-provenance-companion'));
assert(contract.boundaries.refuses.includes('dependency-guessing'));
assert(contract.boundaries.refuses.includes('install-authority-in-export'));
assert(packager.includes("schema='axm.build-on-handoff/v1'"));
assert(packager.includes("base_binding='PACKAGE_MANIFEST.json file ledger must match the live target before staging and again before apply'"));
assert(packager.includes("rollback_policy='Retain exactly one previous module generation before replacement'"));
assert(packager.includes('BUILD_ON_GUIDE.md'));
assert(html.includes('Current build-on ZIP'));
assert(html.includes('No outdated GitHub reconstruction'));
assert(html.includes('Offline Windows candidate'));
assert(html.includes("version:'v0.4'"));
assert(packager.includes("'offline-windows'"));
assert(packager.includes('bundled_runtime_before_first_launch'));
assert(runtimeTool.includes('RUNTIME_LICENSE_COMPANION_MISSING'));
assert(runtimeTool.includes('clean-device-test-matrix.v1'));
assert(launcher.includes('AXM_OFFLINE_FIRST.json'));
assert(launcher.includes('verify-offline-runtime.ps1'));
assert(catalog.summary.total === 100);
assert(catalog.summary.intake_stage.IMPLEMENT_NOW === 17);
assert(catalog.summary.intake_stage.BUILD_OR_EVIDENCE_SUPPORT === 9);

const escaped = path.join(dir, 'package-workshop.ps1').replace(/'/g, "''");
const command = "$errors=$null;[void][System.Management.Automation.Language.Parser]::ParseFile('" + escaped + "',[ref]$null,[ref]$errors);if($errors.Count){$errors|ForEach-Object{$_.Message};exit 1}";
const syntax = childProcess.spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], { encoding:'utf8', windowsHide:true });
assert.equal(syntax.status, 0, String(syntax.stderr || syntax.stdout || 'PowerShell parser failed'));

console.log('PASS Workshop Packager - build-on plus verified offline Windows candidate, exact ledgers, no install authority');
