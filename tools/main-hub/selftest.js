'use strict';

const fs = require('fs');
const path = require('path');
const ContractVerifier = require('../../hub/module-contract-verifier');
const Accessibility = require('../../scripts/accessibility-static-audit');

const ROOT = __dirname;
const WORKSHOP = path.resolve(ROOT, '..', '..');
let checks = 0;
function ok(value, label) { if (!value) throw new Error('FAIL: ' + label); checks += 1; }
function read(name) { return fs.readFileSync(path.join(ROOT, name), 'utf8'); }
function json(name) { return JSON.parse(read(name)); }

const manifest = json('manifest.json');
const contract = json('module.contract.json');
const settings = json('settings/HUB_LAYER_SETTINGS.example.json');
const html = read('index.html');
const readme = read('README.md');
const rules = read('HUB_LAYER_RULES.md');
const capabilities = JSON.parse(fs.readFileSync(path.join(WORKSHOP, 'shared/capabilities/capability-metadata.json'), 'utf8'));

ok(manifest.schema === ContractVerifier.MANIFEST_SCHEMA && manifest.kind === 'scaffold' && manifest.status === 'SHELL', 'modern SHELL scaffold manifest declared');
ok(manifest.contract === 'module.contract.json' && manifest.permissions.length === 0, 'manifest explicitly declares zero-authority contract');
ok(ContractVerifier.validateContract(contract, manifest).pass, 'contract validates against manifest');
ok(contract.lifecycle.state_owner === 'none' && contract.lifecycle.reload === 'reset', 'stateless lifecycle is explicit');
['hub-state-read', 'hub-state-write', 'layer-switching', 'password-validation', 'authentication', 'access-control', 'automatic-navigation'].forEach(boundary => {
  ok(contract.boundaries.refuses.includes(boundary), 'contract refuses ' + boundary);
});

const links = Array.from(html.matchAll(/<a class="chip" href="([^"]+)">([^<]+)<\/a>/g), match => ({ href: match[1], label: match[2] }));
const expected = [
  { href: '../game-hub/', label: 'game-hub' },
  { href: '../agent-command-center/', label: 'agent-command-center' },
  { href: '../agent-tool-forge/', label: 'agent-tool-forge' },
  { href: '../hermes/', label: 'hermes' }
];
ok(JSON.stringify(links) === JSON.stringify(expected), 'page exposes exactly four declared module links');
for (const link of links) {
  const targetRoot = path.resolve(ROOT, link.href);
  const targetManifest = JSON.parse(fs.readFileSync(path.join(targetRoot, 'manifest.json'), 'utf8'));
  ok(fs.existsSync(path.resolve(targetRoot, targetManifest.entry)), link.label + ' target entry exists');
}
ok(/does not implement layer switching/.test(html), 'page visibly states the unimplemented layer boundary');
ok(!/<(?:input|button|select|textarea)\b/i.test(html), 'page contains no access-control or state-changing controls');
ok(!/\b(?:localStorage|sessionStorage|AXM\.store|AXMGate|fetch|XMLHttpRequest|postMessage)\b/.test(html), 'page contains no storage, gate, transport, or fetch behavior');
ok(!/\b(?:location\.assign|location\.replace|window\.location)\b/.test(html), 'page contains no automatic navigation code');
for (const match of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)) { new Function(match[1]); checks += 1; }
ok(Accessibility.auditHtml(path.join(ROOT, 'index.html')).length === 0, 'static accessibility audit has zero definite findings');

ok(settings.schema === 'axm.main-hub-layer-plan/v1' && settings.status === 'PLAN_ONLY' && settings.implemented === false, 'settings example is explicitly plan-only');
ok(Object.values(settings.truth).every(value => value === false), 'settings example refuses every runtime capability flag');
ok(/PLAN_ONLY/.test(rules) && /not implemented/.test(rules), 'layer rules are visibly non-runtime');
ok(/does not currently provide/.test(readme) && /No real password/.test(readme), 'README separates absent features and secret boundary');

const metadata = capabilities.modules && capabilities.modules['main-hub'] || capabilities['main-hub'];
ok(metadata && metadata.accepts.includes('human:explicit-navigation-click'), 'shared capability metadata accepts only explicit navigation');
ok(metadata.produces.length === 1 && metadata.produces[0] === 'browser-navigation:same-origin-explicit-click', 'shared capability metadata emits navigation only');
ok(!JSON.stringify(metadata).includes('axm.hub-state/v1'), 'shared capability metadata no longer invents hub-state compatibility');

console.log('PASS Main Hub compatibility-card selftest: ' + checks + ' assertions; layer runtime and access control UNIMPLEMENTED');
