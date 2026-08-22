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
  'COLLABORATION.md',
  'LICENSE_STATUS.md',
  'CHANGELOG.md',
  'AI_START_HERE.md',
  'docs/README.md',
  'docs/releases/v0.3.0-experimental.md',
  'docs/releases/v0.4.1-experimental.md',
  'docs/releases/v0.5.0-experimental.md',
  'docs/releases/v0.6.0-experimental.md',
  'docs/releases/v0.7.0-experimental.md'
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
assert(readme.includes('v0.7.0-experimental'), 'README must route visitors to the latest reviewed source');
assert(readme.includes('AXM-Workshop-v0.7.0-experimental-Windows-source.zip') && /current packaged Windows build/i.test(readme),
  'README must route visitors to the current verified Windows package');
assert(readme.includes('OPEN_AXM_WORKSHOP.cmd'), 'README must keep the Windows beginner door visible');
assert(!readme.includes('177 tool modules') && !readme.includes('1,183 declared capabilities'),
  'README must not freeze obsolete discovery totals');
assert(readme.includes('registry/modules.json') &&
  readme.includes('registry/capabilities.jsonl') &&
  readme.includes('registry/public-status.json'),
  'README must route capability truth to generated registries');
assert(readme.includes('not automatic redistribution'), 'README must disclose the license boundary');

const status = read('STATUS.md');
assert(status.includes('v0.7.0-experimental'), 'STATUS must name the latest reviewed source');
assert(/Current separately packaged Windows build/i.test(status) && /restore receipt/i.test(status),
  'STATUS must preserve current package evidence');
assert(status.includes('44 warnings remain open'), 'STATUS must keep the warning baseline visible');

const docs = read('docs/README.md');
assert(docs.includes('releases/v0.7.0-experimental.md'), 'documentation index must point to the current release');
assert(docs.includes('releases/v0.5.0-experimental.md') &&
  docs.includes('releases/v0.4.1-experimental.md') &&
  docs.includes('releases/v0.3.0-experimental.md') &&
  docs.includes('releases/v0.6.0-experimental.md'),
  'documentation index must preserve release history');

const collaboration = read('COLLABORATION.md');
assert(collaboration.includes('/discussions') &&
  collaboration.includes('/security/advisories/new') &&
  collaboration.includes('not the current technical source of truth'),
  'collaboration page must route people to current public and private doors');

const bugTemplate = read('.github/ISSUE_TEMPLATE/bug_report.yml');
assert(bugTemplate.includes('v0.7.0-experimental Windows source package'),
  'bug template must use the current source example');
assert(bugTemplate.includes('source/package route'),
  'bug template must identify which public route was tested');

const site = read('site/index.html');
assert(!/\bFree software\b|\bUse it freely\b/.test(site), 'public doorway must not imply a license that is not granted');
assert(site.includes('public experimental Workshop') && site.includes('current license boundary remains explicit'));
assert(site.includes('CURRENT RELEASE TRUTH') && site.includes('v0.7.0-experimental'));

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
