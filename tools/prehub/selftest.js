#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ContractVerifier = require('../../hub/module-contract-verifier');

const root = __dirname;
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const contract = JSON.parse(fs.readFileSync(path.join(root, 'module.contract.json'), 'utf8'));
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
let pass = 0;

function ok(value, label) {
  assert.ok(value, label);
  pass += 1;
}

function memoryStorage() {
  const values = new Map();
  return {
    get length() { return values.size; },
    key(index) { return Array.from(values.keys())[index] || null; },
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
}

async function main() {
  ok(manifest.id === 'prehub' && contract.id === manifest.id, 'manifest and contract share the prehub identity');
  ok(manifest.version === 'v1' && contract.version === manifest.version, 'manifest and contract share the version');
  ok(manifest.status === 'WORKING', 'manifest retains its explicit WORKING claim for live verification');
  ok(ContractVerifier.validateContract(contract, manifest).pass, 'module contract validates against the manifest');
  ok(JSON.stringify(manifest.permissions) === JSON.stringify(contract.permissions), 'manifest and contract declare the same storage authority');
  ok(fs.existsSync(path.join(root, manifest.entry)) && fs.existsSync(path.join(root, manifest.contract)), 'declared entry and contract files exist');
  ok(Array.isArray(contract.provides) && contract.provides.includes('local-note-authoring'), 'contract provides local note authoring');
  ok(contract.provides.includes('named-local-save') && contract.provides.includes('local-save-resume'), 'contract provides named save and resume');
  ok(contract.handoffs.emits.includes('axm.local-note/v1') && contract.handoffs.accepts.includes('text/plain'), 'note handoffs are explicit');
  ok(contract.lifecycle && contract.lifecycle.state_owner === 'browser' && contract.lifecycle.reload === 'resume', 'browser-owned state declares reload resume');
  ok(contract.boundaries && contract.boundaries.refuses.includes('network-required'), 'contract refuses a network requirement');
  ok(contract.boundaries.refuses.includes('automatic-ai-use') && contract.boundaries.refuses.includes('silent-canon-promotion'), 'contract refuses automatic AI and promotion authority');
  ok(html.includes("AXM.init({ id:'prehub', name:'Prehub — write, save, load', version:'v1' })"), 'page initializes the declared Prehub identity');
  ok(!html.includes("id:'template'") && !html.includes('Untitled tool') && !html.includes('your tool goes here'), 'template identity does not leak into the product');
  ok(/<script\s+src=["']axm-foundation\.js["']><\/script>/.test(html) && !/<script\s+src=["']https?:/i.test(html), 'page loads only the local foundation script');
  ok(html.includes('function getProject()') && html.includes('function applyProject(d)'), 'page defines project serialization and restoration');
  ok(html.includes('AXM.store.resume()') && html.includes('AXM.store.startAutosave(getProject, 8000)'), 'page resumes and autosaves local work');
  ok(html.includes("AXM.store.save($('slot').value||'slotA'") && html.includes("AXM.store.load($('slot').value||'slotA')"), 'page exposes named save and load');
  ok(html.includes('AI is opt-in.') && html.includes('r.noAI') && html.includes('the tool works without it'), 'optional AI boundary is visible and handled');

  const inlineScripts = Array.from(html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g), match => match[1]).filter(Boolean).join('\n');
  assert.doesNotThrow(() => new Function(inlineScripts), 'inline runtime parses');
  pass += 1;

  const foundation = fs.readFileSync(path.join(root, 'axm-foundation.js'), 'utf8');
  const browser = { console, Promise, setTimeout, clearTimeout, setInterval, clearInterval, localStorage: memoryStorage() };
  browser.window = browser;
  vm.createContext(browser);
  vm.runInContext(foundation, browser, { filename: 'axm-foundation.js' });

  const info = await browser.AXM.init({ id: manifest.id, name: manifest.name, version: manifest.version });
  ok(info.storageBackend === 'localstorage', 'foundation selects the deterministic local storage backend');
  ok(browser.AXM.card().id === manifest.id && browser.AXM.card().version === manifest.version, 'foundation retains the declared identity');

  await browser.AXM.store.save('slotA', { note: 'named round trip' }, { title: manifest.name });
  const named = await browser.AXM.store.load('slotA');
  ok(named && named.data.note === 'named round trip' && named.tool === manifest.id, 'named local save/load round trip succeeds');

  await browser.AXM.store.autosave({ note: 'resume round trip' });
  const resumed = await browser.AXM.store.resume();
  ok(resumed && resumed.data.note === 'resume round trip' && resumed.slot === 'auto', 'autosave/resume round trip succeeds');
  ok(browser.AXM.store.config().namespace === 'axm_prehub_v1_', 'storage is namespaced to Prehub v1');

  console.log(`PASS Prehub selftest: ${pass} assertions · contract, identity, real local save/load/resume, optional AI, syntax`);
}

main().catch(error => {
  console.error('FAIL Prehub selftest\n' + (error && error.stack || error));
  process.exitCode = 1;
});
