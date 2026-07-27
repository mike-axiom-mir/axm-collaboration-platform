#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const exists = relative => fs.existsSync(path.join(root, relative));

const documents = [
  'README.md',
  'STATUS.md',
  'SECURITY.md',
  'CONTRIBUTING.md',
  'LICENSE_STATUS.md',
  'CHANGELOG.md',
  'docs/README.md',
  'docs/releases/v0.3.0-experimental.md'
];

for (const relative of documents) {
  assert(exists(relative), relative + ' must exist');
  const source = read(relative);
  const links = Array.from(source.matchAll(/\]\(([^)]+)\)/g), match => match[1].trim().replace(/^<|>$/g, ''));
  for (const target of links) {
    if (/^(?:https?:|mailto:|#)/i.test(target)) continue;
    const clean = target.split('#')[0].replace(/%20/g, ' ');
    if (!clean) continue;
    assert(fs.existsSync(path.resolve(path.dirname(path.join(root, relative)), clean)), relative + ' has missing local link: ' + target);
  }
}

const readme = read('README.md');
assert(readme.includes('site/assets/axm-workshop-social-v4.jpg'), 'README must present the reviewed AXM hero');
assert(readme.includes('v0.3.0-experimental'), 'README must route visitors to the current prerelease');
assert(readme.includes('OPEN_AXM_WORKSHOP.cmd'), 'README must keep the Windows beginner door visible');
assert(readme.includes('177 tool modules') && readme.includes('1,183 declared capabilities'), 'README counts must remain explicit declarations');
assert(readme.includes('not automatic redistribution'), 'README must disclose the license boundary');

const site = read('site/index.html');
assert(!/\bFree software\b|\bUse it freely\b/.test(site), 'public doorway must not imply a license that is not granted');
assert(site.includes('public experimental Workshop') && site.includes('current license boundary remains explicit'));

for (const relative of [
  '.github/ISSUE_TEMPLATE/config.yml',
  '.github/ISSUE_TEMPLATE/bug_report.yml',
  '.github/ISSUE_TEMPLATE/feature_request.yml',
  '.github/PULL_REQUEST_TEMPLATE.md'
]) assert(exists(relative), relative + ' must exist');

const archived = [
  'ACTION_REPORT_PHYSICS_MICRO_VERIFICATION.md',
  'ACTION_REPORT_PHYSICS_POLICY_DEEP_DIVE.md',
  'ACTION_REPORT_POLISH_2026-07-20.md',
  'AXM_EVIDENCE_DESK_FACTORY_TEST_REPORT.txt',
  'AXM_MACHINE_USER_CLOUD_TEST_ACTION_REPORT_2026-07-11.txt',
  'AXM_TOOL_FACTORY_V0_2_EXPERIMENTAL_REPORT.txt',
  'CONSOLIDATED_ENGINE_SESSION1_TEST_REPORT.txt',
  'CONSOLIDATION_NOTE.txt',
  'SERVER_PATCH.txt'
];
for (const name of archived) {
  assert(!exists(name), name + ' must not clutter the first-contact root');
  assert(exists('docs/history/root-reports/' + name), name + ' must remain preserved in history');
}

assert(read('SECURITY.md').includes('/security/advisories/new'), 'Security must provide a private reporting route');
assert(read('LICENSE_STATUS.md').includes('does **not yet include a broad open-source license grant**'));

console.log('public GitHub surface selftest: PASS (' + documents.length + ' visitor documents, ' + archived.length + ' preserved historical reports)');
