#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ContractVerifier = require('../../hub/module-contract-verifier');
const AccessibilityAudit = require('../../scripts/accessibility-static-audit');

const root = __dirname;
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const contract = JSON.parse(fs.readFileSync(path.join(root, 'module.contract.json'), 'utf8'));
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const spec = fs.readFileSync(path.join(root, 'FORGE_LINE_SPEC.txt'), 'utf8');
const inline = Array.from(html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi), match => match[1]).join('\n');

let evidenceGroups = 0;
function check(message, test) {
  test();
  evidenceGroups += 1;
}
const settle = () => new Promise(resolve => setImmediate(resolve));
const clone = value => JSON.parse(JSON.stringify(value));

function createElement(tagName, id) {
  const element = {
    tagName: String(tagName || 'div').toLowerCase(),
    id: id || '',
    className: '',
    value: '',
    textContent: '',
    children: [],
    onclick: null,
    href: '',
    download: '',
    clicks: 0,
    appendChild(child) { this.children.push(child); return child; },
    prepend(child) { this.children.unshift(child); return child; },
    click() { this.clicks += 1; }
  };
  let inner = '';
  Object.defineProperty(element, 'innerHTML', {
    get() { return inner; },
    set(value) {
      inner = String(value);
      if (inner === '') this.children.length = 0;
    }
  });
  return element;
}

function descendants(node) {
  const found = [];
  for (const child of node.children || []) {
    found.push(child, ...descendants(child));
  }
  return found;
}

function createHarness(memory, options = {}) {
  const elements = {};
  for (const match of html.matchAll(/\bid="([^"]+)"/g)) {
    elements[match[1]] = createElement('div', match[1]);
  }
  elements.qname.value = '';
  elements.qdesc.value = '';

  const initCalls = [];
  const wisdomCalls = [];
  const loadCalls = [];
  const saveCalls = [];
  const gateCalls = [];
  const alerts = [];
  const anchors = [];
  const blobs = [];
  const revoked = [];
  const prompts = [];
  let now = options.now || 1000;
  let gateAllow = options.gateAllow !== false;

  class BlobStub {
    constructor(parts, blobOptions) {
      this.parts = parts;
      this.options = blobOptions;
      blobs.push(this);
    }
  }

  const document = {
    getElementById(id) { return elements[id]; },
    createElement(tag) {
      const element = createElement(tag);
      if (tag === 'a') anchors.push(element);
      return element;
    },
    createTextNode(text) { return { tagName: '#text', textContent: String(text), children: [] }; }
  };
  const AXM = {
    init(input) {
      initCalls.push(clone(input));
      return Promise.resolve({ storageBackend: 'memory-selftest' });
    },
    wisdom: { on(value) { wisdomCalls.push(value); } },
    store: {
      load(slot) {
        loadCalls.push(slot);
        return Promise.resolve(memory.has(slot) ? { data: clone(memory.get(slot)) } : null);
      },
      save(slot, value) {
        const copy = clone(value);
        memory.set(slot, copy);
        saveCalls.push({ slot, value: copy });
        return Promise.resolve({ ok: true });
      }
    }
  };
  const AXMGate = {
    submit(request) {
      gateCalls.push(clone(request));
      return gateAllow ? { allow: true } : { allow: false, reason: 'selftest gate denied' };
    }
  };
  const context = vm.createContext({
    document,
    AXM,
    AXMGate,
    localStorage: { getItem() { return options.growthEnabled === false ? 'false' : null; } },
    alert(message) { alerts.push(String(message)); },
    prompt() { return prompts.length ? prompts.shift() : null; },
    Blob: BlobStub,
    URL: {
      createObjectURL(blob) {
        assert(blob instanceof BlobStub);
        return 'blob:forge-line-selftest';
      },
      revokeObjectURL(value) { revoked.push(value); }
    },
    setTimeout(callback) { callback(); return 1; },
    Date: { now() { now += 1; return now; } },
    Promise,
    JSON,
    console
  });
  new vm.Script(inline, { filename: 'forge-line/index.html' }).runInContext(context);

  return {
    elements,
    initCalls,
    wisdomCalls,
    loadCalls,
    saveCalls,
    gateCalls,
    alerts,
    anchors,
    blobs,
    revoked,
    prompts,
    setGate(value) { gateAllow = value; },
    async boot() { await settle(); await settle(); },
    async click(id) { elements[id].onclick(); await settle(); await settle(); },
    async clickListButton(text) {
      const button = descendants(elements.list).find(node => node.tagName === 'button' && node.textContent.includes(text));
      assert(button, `list button not found: ${text}`);
      button.onclick();
      await settle();
      await settle();
    }
  };
}

async function main() {
  check('manifest is a modern explicit TEST product', () => {
    assert.equal(manifest.schema, ContractVerifier.MANIFEST_SCHEMA);
    assert.equal(manifest.kind, 'product');
    assert.equal(manifest.id, 'forge-line');
    assert.equal(manifest.version, 'v0.1');
    assert.equal(manifest.status, 'TEST');
    assert.equal(manifest.entry, 'index.html');
    assert.equal(manifest.contract, 'module.contract.json');
  });
  check('contract validates against the manifest', () => {
    assert.deepEqual(ContractVerifier.validateContract(contract, manifest), { pass: true, errors: [] });
  });
  check('identity, version, export permission, and handoffs align', () => {
    assert.equal(contract.id, manifest.id);
    assert.equal(contract.version, manifest.version);
    assert.deepEqual(contract.permissions, manifest.permissions);
    assert.deepEqual(contract.handoffs.accepts, manifest.accepts);
    assert.deepEqual(contract.handoffs.emits, manifest.produces);
  });
  check('manual lifecycle and browser ownership are explicit', () => {
    assert.equal(contract.lifecycle.state_owner, 'browser');
    assert.equal(contract.lifecycle.reload, 'resume');
    assert.equal(contract.lifecycle.cleanup, 'explicit');
    assert(contract.provides.includes('human-verdict-gated-lifecycle'));
  });
  check('contract retains every critical non-automation boundary', () => {
    for (const refusal of [
      'automatic-candidate-build',
      'automatic-verification-execution',
      'automatic-tool-installation',
      'direct-workshop-source-write',
      'automatic-acceptance',
      'automatic-status-promotion',
      'automatic-standards-promotion',
      'build-ahead-of-five-awaiting-verdicts',
      'rejection-without-reason',
      'verification-pass-claim-from-human-summary',
      'network-access',
      'canon-authority'
    ]) assert(contract.boundaries.refuses.includes(refusal), `missing refusal: ${refusal}`);
  });
  check('the handoff spec remains honest about unbuilt worker authority', () => {
    assert(spec.includes('UNBUILT'));
    assert(spec.includes('NEVER installs into /tools'));
    assert(spec.includes('no auto-accept path may exist'));
    assert(/NO write\s+access outside exports\//.test(spec));
    assert(manifest.notes.includes('SPEC ONLY'));
  });
  check('page contains no worker, process, network, or install primitive', () => {
    assert(!/\bfetch\s*\(/.test(inline));
    assert(!/https?:\/\//i.test(html));
    assert(!/\b(?:child_process|execFile|execSync|spawnSync|powershell|cmd\.exe)\b/i.test(inline));
    assert(!/\b(?:install|register|promote)\s*\(/i.test(inline));
  });
  check('inline browser source parses', () => new vm.Script(inline, { filename: 'forge-line/index.html' }));
  check('form controls have zero definite accessibility findings', () => {
    assert.deepEqual(AccessibilityAudit.auditHtml(path.join(root, 'index.html')), []);
  });

  const memory = new Map();
  const harness = createHarness(memory);
  await harness.boot();
  check('bootstrap binds exact identity and resumes both owned slots', () => {
    assert.deepEqual(harness.initCalls, [{ id: 'forge-line', name: 'AXM Forge Line', version: 'v0.1' }]);
    assert.deepEqual(harness.loadCalls, ['line-queue', 'standards-draft']);
    assert.deepEqual(harness.wisdomCalls, [true]);
    assert(harness.elements.boot.textContent.includes('manual mode'));
    assert(harness.elements.counts.textContent.includes('0/5 awaiting verdict'));
  });

  await harness.click('addBtn');
  check('empty proposal intent is refused before gate or storage', () => {
    assert(harness.alerts.some(message => message.includes('Name + description needed')));
    assert.equal(harness.gateCalls.length, 0);
    assert.equal(harness.saveCalls.length, 0);
  });

  harness.elements.qname.value = 'denied-tool';
  harness.elements.qdesc.value = 'must not enter the queue';
  harness.setGate(false);
  await harness.click('addBtn');
  check('meaningful-action gate denial prevents queue mutation', () => {
    assert.equal(harness.gateCalls.at(-1).action, 'line.queue');
    assert(harness.alerts.includes('selftest gate denied'));
    assert(!memory.has('line-queue'));
  });
  harness.setGate(true);

  harness.elements.qname.value = 'review-me';
  harness.elements.qdesc.value = 'A manual candidate requiring explicit review';
  await harness.click('addBtn');
  check('explicit queue action persists a format-1 queued proposal', () => {
    const queue = memory.get('line-queue');
    assert.equal(queue.format, 1);
    assert.equal(queue.items.length, 1);
    assert.equal(queue.items[0].status, 'queued');
    assert.equal(queue.items[0].name, 'review-me');
    assert.equal(harness.gateCalls.at(-1).action, 'line.queue');
    assert(harness.elements.counts.textContent.includes('1/5 awaiting verdict'));
  });

  await harness.clickListButton('Candidate arrived');
  check('candidate arrival is a manual gated state transition', () => {
    assert.equal(memory.get('line-queue').items[0].status, 'built');
    assert.equal(harness.gateCalls.at(-1).action, 'line.built');
  });

  harness.prompts.push(null);
  await harness.clickListButton('Enter verify.js result');
  check('missing verification summary leaves the proposal built', () => {
    assert.equal(memory.get('line-queue').items[0].status, 'built');
  });
  harness.prompts.push('0 FAIL; 2 WARN');
  await harness.clickListButton('Enter verify.js result');
  check('human-entered verification text is recorded without a PASS claim', () => {
    const item = memory.get('line-queue').items[0];
    assert.equal(item.status, 'verified');
    assert.equal(item.verify, '0 FAIL; 2 WARN');
    assert.equal(harness.gateCalls.at(-1).action, 'line.verified');
  });

  harness.prompts.push('');
  await harness.clickListButton('REJECT + reason');
  check('rejection without a reason is refused', () => {
    assert.equal(memory.get('line-queue').items[0].status, 'verified');
    assert(!memory.has('standards-draft') || memory.get('standards-draft').lines.length === 0);
    assert(harness.alerts.some(message => message.includes('Reason required')));
  });
  harness.prompts.push('Missing rollback proof.');
  await harness.clickListButton('REJECT + reason');
  check('reasoned rejection persists proposal and draft evidence', () => {
    const queue = memory.get('line-queue');
    const draft = memory.get('standards-draft');
    assert.equal(queue.items[0].status, 'rejected');
    assert.equal(queue.items[0].reason, 'Missing rollback proof.');
    assert.equal(draft.format, 1);
    assert.equal(draft.lines.length, 1);
    assert.equal(draft.lines[0].reason, 'Missing rollback proof.');
    assert.equal(draft.lines[0].promoted, false);
    assert.equal(harness.gateCalls.at(-1).action, 'line.reject');
    assert(harness.elements.draft.textContent.includes('[draft] Missing rollback proof.'));
  });

  harness.elements.qname.value = 'accept-me';
  harness.elements.qdesc.value = 'A separately reviewed manual candidate';
  await harness.click('addBtn');
  await harness.clickListButton('Candidate arrived');
  harness.prompts.push('0 FAIL');
  await harness.clickListButton('Enter verify.js result');
  await harness.clickListButton('ACCEPT');
  check('acceptance remains a separate explicit gated verdict', () => {
    const accepted = memory.get('line-queue').items.find(item => item.name === 'accept-me');
    assert.equal(accepted.status, 'accepted');
    assert.equal(harness.gateCalls.at(-1).action, 'line.accept');
    assert(harness.elements.counts.textContent.includes('1 accepted'));
  });

  for (let index = 1; index <= 5; index += 1) {
    harness.elements.qname.value = `queued-${index}`;
    harness.elements.qdesc.value = `bounded proposal ${index}`;
    await harness.click('addBtn');
  }
  check('five awaiting proposals are admitted and visibly counted', () => {
    assert.equal(memory.get('line-queue').items.filter(item => item.status === 'queued').length, 5);
    assert(harness.elements.counts.textContent.includes('5/5 awaiting verdict'));
  });
  const savesAtCap = harness.saveCalls.length;
  const gatesAtCap = harness.gateCalls.length;
  harness.elements.qname.value = 'queue-overflow';
  harness.elements.qdesc.value = 'must be refused';
  await harness.click('addBtn');
  check('sixth awaiting proposal is refused before gate and persistence', () => {
    assert(harness.alerts.some(message => message.includes('Cap reached: 5 awaiting')));
    assert.equal(harness.saveCalls.length, savesAtCap);
    assert.equal(harness.gateCalls.length, gatesAtCap);
    assert.equal(memory.get('line-queue').items.length, 7);
  });

  await harness.click('expDraft');
  check('standards draft export is explicit, bounded, and revokes its URL', () => {
    assert.equal(harness.anchors.length, 1);
    assert.equal(harness.anchors[0].download, 'axm-standards-draft.json');
    assert.equal(harness.anchors[0].clicks, 1);
    const exported = JSON.parse(harness.blobs[0].parts[0]);
    assert.equal(exported.format, 1);
    assert.equal(exported.lines[0].reason, 'Missing rollback proof.');
    assert.deepEqual(harness.revoked, ['blob:forge-line-selftest']);
  });

  const reopened = createHarness(memory, { now: 5000 });
  await reopened.boot();
  check('fresh page instance resumes queue and standards state', () => {
    assert(reopened.elements.counts.textContent.includes('5/5 awaiting verdict'));
    assert(reopened.elements.counts.textContent.includes('1 accepted'));
    assert(reopened.elements.counts.textContent.includes('1 rejected'));
    assert(reopened.elements.draft.textContent.includes('Missing rollback proof.'));
  });
  const reopenedSaves = reopened.saveCalls.length;
  reopened.elements.qname.value = 'still-over-cap';
  reopened.elements.qdesc.value = 'must remain bounded after reload';
  await reopened.click('addBtn');
  check('capacity boundary survives reload', () => {
    assert.equal(reopened.saveCalls.length, reopenedSaves);
    assert(reopened.alerts.some(message => message.includes('Cap reached: 5 awaiting')));
  });

  console.log(`Forge Line selftest: PASS (${evidenceGroups} evidence groups; manual mode only, no worker or installation executed)`);
}

main().catch(error => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
