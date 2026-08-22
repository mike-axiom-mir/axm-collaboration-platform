#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8').replace(/\r\n/g, '\n');
const json = relative => JSON.parse(read(relative));

const expected = '0.7.0-experimental';
const pkg = json('package.json');
const lock = json('package-lock.json');
const notes = read('.github/release-requests/v0.7.0-experimental.md');
const changelog = read('CHANGELOG.md');
const workflow = read('.github/workflows/release-v0.7.0-experimental.yml');
const sourceJob = workflow.slice(workflow.indexOf('  source-gates:'), workflow.indexOf('  windows-package:'));
const windowsJob = workflow.slice(workflow.indexOf('  windows-package:'), workflow.indexOf('  publish-release:'));

assert.equal(pkg.version, expected, 'package version must bind to v0.7.0');
assert.equal(lock.version, expected, 'lock root version must bind to v0.7.0');
assert.equal(lock.packages[''].version, expected, 'lock package version must bind to v0.7.0');
assert.ok(notes.startsWith('# AXM Workshop v0.7.0 Experimental\n'), 'release title must be exact');
assert.ok(changelog.includes('## v0.7.0-experimental — 2026-08-22'), 'changelog must preserve the release entry');
assert.ok(!/\b(?:TBD|TODO)\b/.test(notes), 'release notes must contain no placeholder');
assert.ok(workflow.includes('TAG: v0.7.0-experimental'), 'workflow tag must be exact');
assert.ok(!sourceJob.includes('core.longpaths'),
  'the Ubuntu source job must not receive Windows-only setup');
assert.ok(windowsJob.includes('git config --system core.longpaths true') &&
  windowsJob.indexOf('core.longpaths') < windowsJob.indexOf('actions/checkout@v4'),
  'the Windows package job must enable long-path support before checkout');
assert.ok(workflow.includes('- .github/workflows/release-v0.7.0-experimental.yml'),
  'a reviewed workflow repair must be able to retrigger the exact release');
assert.ok(workflow.includes('source-artifact') && workflow.includes('windows-artifact'),
  'source and Windows artifacts must download into distinct directories');
assert.ok(workflow.includes("cp -R source-artifact/. release-assets/") &&
  workflow.includes("cp -R windows-artifact/. release-assets/"),
  'publish job must explicitly converge both artifact roots');
assert.ok(!workflow.includes('AXM_REPO_ADMIN_TOKEN'), 'release publication must not inherit repository-administration authority');
assert.ok(notes.includes('126 raw session-event traces intentionally omitted'), 'curation count must stay visible');
assert.ok(notes.includes('219 indexed tools') && notes.includes('2,022 declared capabilities'),
  'measured discovery surface must stay visible');

console.log('v0.7.0 release selftest: PASS (16 checks)');
