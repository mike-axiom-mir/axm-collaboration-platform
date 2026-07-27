#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const moduleApi = require('module');
const path = require('path');
const Hub = require('../../hub/hub-shell.js');

const root = path.resolve(__dirname, '../..');
const modules = Hub.GOVERNED_FOUNDATION_WAVE1.concat(Hub.GOVERNED_FOUNDATION_WAVE2);
const apiEvidence = {
  'recovery-center':'/api/recovery', 'module-installer':'/api/installer', 'machine-host':'/api/machine-host', 'review-inbox':'/api/reviews',
  'module-contract-workbench':'/api/module-workbench', 'secrets-permissions-console':'/api/secrets', 'diagnostics-operations-center':'/api/diagnostics',
  'workshop-search-provenance':'/api/search', 'asset-filesystem-service':'/api/assets/filesystem', 'device-handoff':'/api/device-handoff',
  'browser-lan-hardware-qa-lab':'/api/qa-lab', 'template-runtime-pack-engine':'/api/template-runtime', 'source-connector-hub':'/api/source-connectors',
  'media-render-transcode-service':'/api/media-render', 'living-world-state-server':'/api/living-world', 'multiplayer-controller-transport':'/api/multiplayer-transport',
  'living-world-ruleset-physics-adapter-kit':'/api/world-adapters', 'read-only-mirror-world-adapter':'/api/mirror-world', 'novelty-diversity-engine':'/api/novelty-diversity',
  'public-release-deployment-adapter':'/api/public-release'
};

let pass = 0;
function check(value, label) { assert(value, label); pass += 1; console.log('PASS ' + label); }
function json(file) { return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')); }

check(modules.length === 20 && new Set(modules).size === 20, 'roadmap declares exactly twenty unique governed modules');
check(modules.every(id => Object.prototype.hasOwnProperty.call(Hub.GOVERNED_FOUNDATION_ASSIGNMENTS, id)), 'every governed module has one canonical Hub assignment');
const apiSource = fs.readFileSync(path.join(__dirname, 'operations-api.js'), 'utf8');

for (const id of modules) {
  const dir = path.join(root, 'tools', id), manifestFile = path.join(dir, 'manifest.json'), contractFile = path.join(dir, 'module.contract.json'), pageFile = path.join(dir, 'index.html'), appFile = path.join(dir, 'app.js');
  check([manifestFile, contractFile, pageFile, appFile].every(fs.existsSync), id + ': manifest, contract, page and application exist');
  const manifest = json(manifestFile), contract = json(contractFile), html = fs.readFileSync(pageFile, 'utf8'), app = fs.readFileSync(appFile, 'utf8');
  check(manifest.id === id && contract.id === id && manifest.version === contract.version && /^v\d+\.\d+$/.test(manifest.version), id + ': manifest and contract identity/version agree');
  check(['TEST','EXPERIMENTAL'].includes(manifest.status) && manifest.entry === 'index.html' && manifest.contract === 'module.contract.json', id + ': maturity and executable entries are explicit');
  check(Array.isArray(manifest.actions) && manifest.actions.length && Array.isArray(manifest.accepts) && manifest.accepts.length && Array.isArray(manifest.produces) && manifest.produces.length, id + ': human and machine handoffs are declared');
  check(contract.schema === 'axm.module-contract/v1' && contract.handoffs && contract.handoffs.emits.length && contract.handoffs.accepts.length, id + ': governed handoff contract is executable');
  check(contract.boundaries && contract.boundaries.writes.length && contract.boundaries.refuses.length, id + ': write scope and refusal boundaries are explicit');
  check(contract.lifecycle && ['state_owner','reload','disconnect','cleanup'].every(key => typeof contract.lifecycle[key] === 'string' && contract.lifecycle[key]), id + ': lifecycle ownership is complete');
  check(JSON.stringify((manifest.permissions || []).slice().sort()) === JSON.stringify((contract.permissions || []).slice().sort()), id + ': manifest and contract permissions agree exactly');
  check(html.includes('operations-client.js') && html.includes('app.js') && !/<script[^>]+src=["']https?:/i.test(html), id + ': dashboard uses only local scripts');
  new Function(app);
  check(app.includes(apiEvidence[id]) && apiSource.includes(apiEvidence[id]), id + ': dashboard and server share a real API route');
  check(Hub.workflowLayout([{ id }], Hub.DEFAULT_LAYERS).assign[id] === Hub.GOVERNED_FOUNDATION_ASSIGNMENTS[id], id + ': Hub placement matches the canonical five-parent roadmap');
}

const builtins = new Set(moduleApi.builtinModules.concat(moduleApi.builtinModules.map(id => 'node:' + id)));
const operationSources = fs.readdirSync(__dirname).filter(name => name.endsWith('.js'));
const externalRequires = [];
for (const name of operationSources) {
  const source = fs.readFileSync(path.join(__dirname, name), 'utf8');
  for (const match of source.matchAll(/\brequire\s*\(\s*["']([^"']+)["']\s*\)/g)) {
    const request = match[1];
    if (!request.startsWith('.') && !builtins.has(request)) externalRequires.push(name + ' -> ' + request);
  }
}
check(externalRequires.length === 0, 'operations plane imports no third-party Node packages');
const forbiddenArchiveExecutable = 'powershell' + '.exe';
check(!operationSources.some(name => fs.readFileSync(path.join(__dirname, name), 'utf8').toLowerCase().includes(forbiddenArchiveExecutable)), 'operations plane requires no PowerShell executable');

const parentCounts = Object.values(Hub.GOVERNED_FOUNDATION_ASSIGNMENTS).reduce((counts, parent) => { counts[parent] = (counts[parent] || 0) + 1; return counts; }, {});
check(['create','build','publish','play','ai-team'].every(parent => parentCounts[parent] > 0), 'all five Hub parents receive governed roadmap modules');
console.log('\nGoverned roadmap selftest: PASS (' + pass + ' checks across 20 modules)');
