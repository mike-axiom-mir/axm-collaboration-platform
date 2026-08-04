#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Graft = require('../../hub/graft-core.js');
const ContractVerifier = require('../../hub/module-contract-verifier.js');
const AccessibilityAudit = require('../../scripts/accessibility-static-audit.js');

const root = __dirname;
const htmlPath = path.join(root, 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const contract = JSON.parse(fs.readFileSync(path.join(root, 'module.contract.json'), 'utf8'));
let pass = 0;

function test(name, fn) {
  try {
    fn();
    pass += 1;
    console.log('PASS ' + name);
  } catch (error) {
    console.error('FAIL ' + name + '\n  ' + error.stack);
    process.exitCode = 1;
  }
}

function state() {
  return {
    spine: 'fixture-spine',
    verifyPass: 80,
    layers: ['open', 'private'],
    files: ['tools/existing/index.html'],
    modules: [{ id: 'existing', provides: ['export'], pins: {} }]
  };
}

test('manifest declares a matching valid module contract', () => {
  assert.equal(manifest.contract, 'module.contract.json');
  assert.equal(contract.id, manifest.id);
  assert.equal(contract.version, manifest.version);
  assert.deepEqual(ContractVerifier.validateContract(contract, manifest).errors, []);
});

test('every Graft form control has an accessible name', () => {
  assert.deepEqual(
    AccessibilityAudit.auditHtml(htmlPath).filter(item => item.code === 'FORM_NAME_MISSING'),
    []
  );
});

test('clean ideas produce state-bound data plans rather than code', () => {
  const patch = Graft.generatePatch({ id: 'notes', name: 'Notes' }, state());
  assert.equal(patch.schema, 'axm.graft/v1');
  assert.equal(patch.blocked, false);
  assert(patch.computed_against.fingerprint);
  assert(!('diff' in patch));
});

test('protected spine touches are blocking conflicts', () => {
  const patch = Graft.generatePatch({ id: 'unsafe', touches: ['hub/axm-foundation.js'] }, state());
  assert.equal(patch.blocked, true);
  assert(patch.conflicts.some(item => item.kind === 'touches_spine' && item.severity === 'block'));
});

test('plans become stale when workshop state changes', () => {
  const patch = Graft.generatePatch({ id: 'notes' }, state());
  const changed = state();
  changed.modules.push({ id: 'new-module', provides: [], pins: {} });
  assert.equal(Graft.isStale(patch, changed).stale, true);
});

test('browser route only computes and explicitly downloads plans', () => {
  assert(html.includes('G.generatePatch(idea, STATE)'));
  assert(html.includes("a.download='graft-patch.json'"));
  assert(html.includes('URL.revokeObjectURL(url)'));
  assert(!/applyPatch|apply_patch|fetch\s*\(/.test(html));
});

test('contract refuses mutation, executable diffs and authority escalation', () => {
  ['automatic-workshop-mutation', 'executable-diff-generation', 'automatic-permission-grant', 'automatic-status-promotion', 'canon-authority'].forEach(boundary => {
    assert(contract.boundaries.refuses.includes(boundary), boundary);
  });
  assert.deepEqual(contract.permissions, []);
});

if (!process.exitCode) console.log('\n' + pass + ' PASS · 0 FAIL · Graft ' + manifest.version);
