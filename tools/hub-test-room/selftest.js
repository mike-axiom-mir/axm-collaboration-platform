#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ContractVerifier = require('../../hub/module-contract-verifier');
const Accessibility = require('../../scripts/accessibility-static-audit');

const ROOT = __dirname;
const htmlPath = path.join(ROOT, 'index.html');
const contractPath = path.join(ROOT, 'module.contract.json');
const html = fs.readFileSync(htmlPath, 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
const contract = fs.existsSync(contractPath) ? JSON.parse(fs.readFileSync(contractPath, 'utf8')) : null;
const inline = Array.from(html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi), match => match[1]).join('\n');
let checks = 0;

function ok(value, label) {
  assert.ok(value, label);
  checks += 1;
}

function memoryStorage(seed) {
  const values = new Map(Object.entries(seed || {}));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    has(key) { return values.has(key); }
  };
}

function loadPage(storage, now) {
  const elements = new Map();
  const queue = [];
  let passport = null;
  let verifyPasses = 0;
  let clock = now;

  function element(id) {
    if (!elements.has(id)) elements.set(id, {
      id,
      className: id && /^c[1-6]$/.test(id) ? 'chip PENDING' : '',
      textContent: id && /^c[1-6]$/.test(id) ? 'PENDING' : '',
      onclick: null
    });
    return elements.get(id);
  }

  const body = {
    childNodes: [{}],
    appendChild(node) {
      this.childNodes.push(node);
      if (typeof node.onload === 'function') queue.push(node.onload);
      return node;
    }
  };
  const document = {
    body,
    getElementById: element,
    createElement(tag) {
      assert.equal(tag, 'iframe', 'only the fixed paint-probe iframe may be created');
      return {
        style: {},
        src: '',
        contentDocument: { body: { childNodes: [{}] } },
        onload: null,
        remove() {}
      };
    }
  };
  const hub = {
    ready(value) { passport = value; },
    log(message) {
      const rows = JSON.parse(storage.getItem('axm.hub.log') || '[]');
      rows.push({ msg: String(message) });
      storage.setItem('axm.hub.log', JSON.stringify(rows));
    },
    verifyPass() { verifyPasses += 1; },
    onInit(callback) { callback({ moduleId: 'hub-test-room' }); }
  };
  const context = {
    console,
    document,
    localStorage: storage,
    AXMHub: hub,
    performance: { now() { return clock; } },
    Date: { now() { return clock; } },
    setTimeout(callback, delay) { queue.push(() => { clock += Number(delay || 0); callback(); }); },
    clearTimeout() {}
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(inline, context, { filename: 'hub-test-room/index.inline.js' });

  return {
    element,
    flush() { while (queue.length) queue.shift()(); },
    passport() { return passport; },
    verifyPasses() { return verifyPasses; }
  };
}

ok(manifest.schema === 'axm.tool-manifest/v1' && manifest.kind === 'product', 'modern product manifest is explicit');
ok(manifest.contract === 'module.contract.json' && !!contract, 'manifest declares a present module contract');
ok(ContractVerifier.validateContract(contract, manifest).pass, 'module contract validates against the manifest');
ok(JSON.stringify(manifest.permissions) === '[]' && JSON.stringify(contract.permissions) === '[]', 'module requests no Hub permission token');
ok(contract.lifecycle.state_owner === 'browser' && contract.lifecycle.reload === 'resume', 'browser-owned reload probe is explicit');
['manifest-status-change', 'automatic-workshop-status-promotion', 'canon-authority', 'external-network-access', 'reopen-proof-without-reload'].forEach(boundary => {
  ok(contract.boundaries.refuses.includes(boundary), 'contract refuses ' + boundary);
});
ok(html.includes('Hub-local lifecycle evidence only') && html.includes('does not change manifest status'), 'human-visible promotion boundary is explicit');
ok(/<script\s+src=["']\/hub\/axm-hub-module\.js["']><\/script>/.test(html), 'page uses the fixed local Hub bridge');
ok(html.includes("probe.src = '/tools/_module-template/index.html'"), 'paint probe is fixed to the same-origin module template');
ok(!/\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|window\.open)\b/.test(inline), 'page has no external transport or popup path');
assert.doesNotThrow(() => new Function(inline), 'inline runtime parses'); checks += 1;
ok(Accessibility.auditHtml(htmlPath).length === 0, 'static accessibility audit has zero definite findings');

const storage = memoryStorage({ 'axm.hub.registry': JSON.stringify([{ id: 'hub-test-room' }]) });
const first = loadPage(storage, 1000);
ok(first.passport() && first.passport().id === manifest.id && first.passport().version === manifest.version, 'runtime passport matches the manifest');
ok(Array.isArray(first.passport().permissions) && first.passport().permissions.length === 0, 'runtime passport carries zero authority');
first.element('runBtn').onclick();
first.flush();
ok(['c1', 'c3', 'c4', 'c5', 'c6'].every(id => first.element(id).textContent === 'PASS'), 'all five live probes settle PASS regardless of callback order');
ok(first.element('c2').textContent === 'PENDING' && first.verifyPasses() === 0, 'no verification-pass intent is emitted before reload evidence');
ok(first.element('summary').textContent.includes('5/5 live checks PASS'), 'summary updates after the final asynchronous probe');

first.element('armBtn').onclick();
const reopened = loadPage(storage, 1500);
ok(reopened.element('c2').textContent === 'PASS', 'armed reopen marker survives a later page load');
reopened.element('runBtn').onclick();
reopened.flush();
ok(reopened.verifyPasses() === 1, 'six settled probes emit one Hub-local verification-pass intent');
ok(storage.has('axm.hub.selftest.probe') && storage.has('axm.hub.settings.hub-test-room'), 'bounded local probe and setting writes are observable');
reopened.element('clearBtn').onclick();
ok(!storage.has('axm.hub.selftest.probe') && !storage.has('axm.hub.selftest.reopen'), 'explicit cleanup removes the two temporary probe keys');

console.log('PASS Hub Test Room selftest: ' + checks + ' assertions · headless probe logic and contract; full Hub/browser reload remains a separate live check');
