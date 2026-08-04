'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Route = require('../../hub/route-core');
const ContractVerifier = require('../../hub/module-contract-verifier');
const AccessibilityAudit = require('../../scripts/accessibility-static-audit');

const dir = __dirname;
const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
const contract = JSON.parse(fs.readFileSync(path.join(dir, 'module.contract.json'), 'utf8'));
const htmlPath = path.join(dir, 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');
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

test('manifest declares a matching valid module contract', () => {
  assert.equal(manifest.contract, 'module.contract.json');
  assert.equal(contract.id, manifest.id);
  assert.equal(contract.version, manifest.version);
  assert.deepEqual(ContractVerifier.validateContract(contract, manifest).errors, []);
});

test('every static Route form control has an accessible name', () => {
  assert.deepEqual(
    AccessibilityAudit.auditHtml(htmlPath).filter(item => item.code === 'FORM_NAME_MISSING'),
    []
  );
});

test('step progress requires a declared check unless a reason is recorded', () => {
  const route = Route.newRoute('Accessible route', 'Preserve truthful progress', 'test');
  const step = Route.addStep(route, { title: 'Inspect evidence', who: 'test' });
  assert.equal(Route.setStepState(route, step.id, 'WORKING', 'test').ok, false);
  assert.equal(Route.setStepState(route, step.id, 'WORKING', 'test', 'Human override').ok, true);
  assert.equal(step.forced_reason, 'Human override');
});

test('claims need a source and competing equal evidence remains a human-visible fork', () => {
  const route = Route.newRoute('Evidence route', 'Keep disagreements intact', 'test');
  const need = Route.addNeed(route, { question: 'Which path?', who: 'test' });
  assert.equal(Route.addClaim(route, { need_id: need.id, text: 'A', who: 'test' }).ok, false);
  ['A', 'B'].forEach(text => {
    const source = Route.addSource(route, { kind: 'human', who: text });
    assert.equal(Route.addClaim(route, { need_id: need.id, text, source_id: source.id, who: 'test' }).ok, true);
  });
  const diagnosis = Route.diagnoseConflict(route, need.id, 'test');
  assert.equal(diagnosis.ok, true);
  assert.equal(diagnosis.conflict.escalate, true);
  assert.equal(diagnosis.conflict.resolution, null);
});

test('goal and progress never compute route closure', () => {
  const route = Route.newRoute('Living route', 'Reach a goal without erasing the route', 'test');
  Route.setGoalReached(route, true, 'test');
  assert.equal(route.route.state, 'living');
  assert.equal(Route.setRouteState(route, 'closed', 'test').ok, false);
  assert.equal(Route.setRouteState(route, 'closed', 'test', 'Human decision').ok, true);
});

test('browser route persists through the Hub and exports only by explicit download', () => {
  assert(html.includes('AXMHub.save({ route: route })'));
  assert(html.includes("a.download = 'route.json'"));
  assert(html.includes('URL.revokeObjectURL(url)'));
  assert(html.includes('no provider module is registered'));
  assert(!/fetch\s*\(/.test(html));
});

test('contract preserves human authority and append-only evidence boundaries', () => {
  [
    'automatic-route-closure',
    'unsourced-claim-as-answer',
    'automatic-conflict-vote',
    'destructive-history-deletion',
    'automatic-external-research',
    'automatic-permission-grant',
    'canon-authority'
  ].forEach(boundary => assert(contract.boundaries.refuses.includes(boundary), boundary));
  assert.deepEqual(contract.permissions, []);
});

if (!process.exitCode) console.log('\n' + pass + ' PASS · 0 FAIL · Route ' + manifest.version);
