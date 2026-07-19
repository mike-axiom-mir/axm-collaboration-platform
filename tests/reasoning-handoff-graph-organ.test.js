'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Cell = require('../kernel/contract-handoff-cell');
const BindingCell = require('../kernel/contract-manifest-binding-cell');
const Organ = require('../organs/reasoning-handoff-graph-organ');
const LegacyOrgan = require('../organs/reasoning-handoff-graph-organ-v1-known-fail');

function contract(id, emits, accepts) {
  return {
    schema: 'axm.module-contract/v1',
    id,
    version: '1.0.0',
    provides: [],
    consumes: [],
    permissions: [],
    handoffs: { emits, accepts },
    boundaries: { writes: [], refuses: ['automatic-world-action'] }
  };
}

function fixture(t) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'mirror-handoff-graph-'));
  const root = path.join(base, 'mirror');
  const workshopRoot = path.join(base, 'workshop');
  fs.mkdirSync(root, { recursive: true });
  function write(id, value, options = {}) {
    const directory = path.join(workshopRoot, 'tools', id);
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, 'module.contract.json'), JSON.stringify(value, null, 2) + '\n');
    const manifest = {
      schema: 'axm.tool-manifest/v1',
      id: options.manifestId || id,
      version: '1.0.0',
      status: 'TEST',
      entry: 'index.html',
      uses: options.uses || value.permissions || [],
      permissions: []
    };
    if (options.declare !== false) manifest.contract = 'module.contract.json';
    fs.writeFileSync(path.join(directory, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  }
  write('alpha', contract('alpha', ['axm.test/x-v1'], []));
  write('beta', contract('beta', ['axm.test/y-v1'], ['axm.test/x-v1']));
  write('gamma', contract('gamma', [], ['axm.test/y-v1']));
  write('delta', contract('delta', [], ['axm.test/z-v1']));
  write('_template', contract('CHANGE-ME', [], []));
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  return { base, root, workshopRoot, write };
}

test('compatibility cell uses exact typed membership and has no candidate or authority grant', () => {
  const producer = { moduleId: 'alpha', contractSha256: 'a'.repeat(64), emits: ['axm.test/x-v1'], accepts: [] };
  const exact = Cell.evaluate({ producer, consumer: { moduleId: 'beta', contractSha256: 'b'.repeat(64), emits: [], accepts: ['axm.test/x-v1'] }, handoffType: 'axm.test/x-v1' });
  assert.equal(exact.compatible, true);
  assert.equal(exact.verdict, 'PASS');
  assert.ok(Object.values(exact.authority).every(value => value === false));
  const mismatch = Cell.evaluate({ producer, consumer: { moduleId: 'gamma', contractSha256: 'c'.repeat(64), emits: [], accepts: ['axm.test/x-v2'] }, handoffType: 'axm.test/x-v1' });
  assert.equal(mismatch.compatible, false);
  assert.equal(mismatch.checks.producerEmits, true);
  assert.equal(mismatch.checks.consumerAccepts, false);
  const tampered = JSON.parse(JSON.stringify(exact));
  tampered.compatible = false;
  assert.throws(() => Cell.verify(tampered), /digest mismatch|verdict/);
});

test('manifest binding cell requires the exact declaration and permission coverage without granting either', () => {
  const contractEvidence = {
    moduleId: 'alpha',
    contractRelativePath: 'tools/alpha/module.contract.json',
    contractSha256: 'a'.repeat(64),
    permissions: ['files', 'gate']
  };
  const manifestEvidence = {
    moduleId: 'alpha',
    manifestRelativePath: 'tools/alpha/manifest.json',
    manifestSha256: 'b'.repeat(64),
    declaredContractRelativePath: 'tools/alpha/module.contract.json',
    uses: ['files', 'gate', 'storage']
  };
  const exact = BindingCell.evaluate({ contract: contractEvidence, manifest: manifestEvidence });
  assert.equal(exact.bound, true);
  assert.equal(exact.verdict, 'PASS');
  assert.ok(Object.values(exact.authority).every(value => value === false));
  assert.equal(BindingCell.verify(exact), true);
  const orphan = BindingCell.evaluate({ contract: contractEvidence, manifest: Object.assign({}, manifestEvidence, { declaredContractRelativePath: '' }) });
  assert.equal(orphan.bound, false);
  assert.equal(orphan.checks.manifestDeclaresExactContractPath, false);
  const undeclaredPermission = BindingCell.evaluate({ contract: contractEvidence, manifest: Object.assign({}, manifestEvidence, { uses: ['files'] }) });
  assert.equal(undeclaredPermission.bound, false);
  assert.deepEqual(undeclaredPermission.missingPermissionDeclarations, ['gate']);
  const tampered = JSON.parse(JSON.stringify(exact));
  tampered.bound = false;
  assert.throws(() => BindingCell.verify(tampered), /digest mismatch|content mismatch/);
});

test('typed contracts automatically become exact direct and depth-two proposal routes', t => {
  const fx = fixture(t);
  const result = Organ.derive({ root: fx.root, workshopRoot: fx.workshopRoot });
  assert.equal(result.reused, false);
  assert.equal(result.batch.summary.eligibleContracts, 4);
  assert.equal(result.batch.summary.refusedOrExcludedContracts, 1);
  assert.equal(result.batch.summary.exactCrossModuleEdges, 2);
  assert.equal(result.batch.summary.directRoutes, 2);
  assert.equal(result.batch.summary.composedDepthTwoRoutes, 1);
  assert.equal(result.batch.summary.exactRoutesSelected, 3);
  assert.equal(result.batch.summary.unboundDecoysRejected, 3);
  assert.equal(result.batch.summary.routeSelectionMismatches, 0);
  assert.equal(result.batch.summary.trainingReceiptsCreated, 0);
  assert.equal(result.batch.summary.worldActionsExecuted, 0);
  assert.ok(result.batch.results.every(item => item.trainingReceiptCreated === false && item.worldActionExecuted === false));
  assert.ok(result.batch.results.every(item => item.decoyBindingReceipt.verdict === 'FAIL'));
  assert.ok(result.batch.results.every(item => item.manifestBindingReceiptDigests.length === item.moduleIds.length));
  assert.ok(result.batch.results.every(item => item.observedDecision.actionId === item.expectedDecision.actionId));
  const structurallyTampered = JSON.parse(JSON.stringify(result.batch));
  structurallyTampered.edges.pop();
  const digestBasis = JSON.parse(JSON.stringify(structurallyTampered));
  delete digestBasis.batchDigest;
  structurallyTampered.batchDigest = Organ.digest(digestBasis);
  assert.throws(() => Organ.verifyBatch(structurallyTampered), /edges are incomplete|route references missing edge/);

  const planned = Organ.plan(result.batch, {
    schema: Organ.REQUEST_SCHEMA,
    sourceModuleId: 'alpha',
    targetModuleId: 'gamma',
    maximumDepth: 2
  });
  assert.equal(planned.state, 'PROPOSED_MANIFEST_BOUND_EXACT_TYPED_ROUTES');
  assert.equal(planned.proposals.length, 1);
  assert.deepEqual(planned.proposals[0].moduleIds, ['alpha', 'beta', 'gamma']);
  assert.equal(planned.proposals[0].state, 'REVIEWABLE_PROPOSAL_NOT_EXECUTED');
  assert.equal(planned.proposals[0].runtimeReadiness, 'UNKNOWN_NOT_PROBED');
  assert.ok(Object.values(planned.authority).every(value => value === false));

  const tooShallow = Organ.plan(result.batch, {
    schema: Organ.REQUEST_SCHEMA,
    sourceModuleId: 'alpha',
    targetModuleId: 'gamma',
    maximumDepth: 1
  });
  assert.equal(tooShallow.state, 'HOLD_NO_MANIFEST_BOUND_EXACT_TYPED_ROUTE');
  assert.equal(tooShallow.proposals.length, 0);
  const unknown = Organ.plan(result.batch, {
    schema: Organ.REQUEST_SCHEMA,
    sourceModuleId: 'alpha',
    targetModuleId: 'unknown-module'
  });
  assert.equal(unknown.state, 'HOLD_UNKNOWN_MODULE');

  const reused = Organ.derive({ root: fx.root, workshopRoot: fx.workshopRoot });
  assert.equal(reused.reused, true);
  assert.equal(reused.batch.batchDigest, result.batch.batchDigest);
});

test('a new typed interface grows the graph while old evidence remains immutable', t => {
  const fx = fixture(t);
  const first = Organ.derive({ root: fx.root, workshopRoot: fx.workshopRoot });
  fx.write('delta', contract('delta', [], ['axm.test/x-v1', 'axm.test/z-v1']));
  const second = Organ.derive({ root: fx.root, workshopRoot: fx.workshopRoot });
  assert.notEqual(second.batch.batchId, first.batch.batchId);
  assert.equal(second.batch.summary.exactCrossModuleEdges, first.batch.summary.exactCrossModuleEdges + 1);
  assert.ok(fs.existsSync(path.join(first.runDir, 'batch.json')));
  assert.ok(fs.existsSync(path.join(second.runDir, 'batch.json')));
  const route = Organ.plan(second.batch, {
    schema: Organ.REQUEST_SCHEMA,
    sourceModuleId: 'alpha',
    targetModuleId: 'delta',
    maximumDepth: 1
  });
  assert.equal(route.state, 'PROPOSED_MANIFEST_BOUND_EXACT_TYPED_ROUTES');
  assert.deepEqual(route.proposals[0].moduleIds, ['alpha', 'delta']);
});

test('v2 refuses orphan contracts that contaminated the preserved v1 graph', t => {
  const fx = fixture(t);
  fx.write('orphan', contract('orphan', ['axm.test/x-v1'], []), { declare: false });
  const current = Organ.derive({ root: fx.root, workshopRoot: fx.workshopRoot });
  assert.equal(current.batch.summary.eligibleContracts, 4);
  assert.equal(current.batch.summary.undeclaredContractFiles, 1);
  assert.ok(current.batch.refusedContracts.some(item => item.moduleId === 'orphan' && item.state === 'REFUSED_MANIFEST_DOES_NOT_DECLARE_CONTRACT' && item.bindingReceipt.verdict === 'FAIL'));
  assert.ok(current.batch.edges.every(item => item.producerModuleId !== 'orphan' && item.consumerModuleId !== 'orphan'));
  const held = Organ.plan(current.batch, {
    schema: Organ.REQUEST_SCHEMA,
    sourceModuleId: 'orphan',
    targetModuleId: 'beta',
    maximumDepth: 1
  });
  assert.equal(held.state, 'HOLD_UNBOUND_MODULE_CONTRACT');

  const legacy = LegacyOrgan.derive({
    root: fx.root,
    workshopRoot: fx.workshopRoot,
    stateDir: path.join(fx.root, 'state', 'legacy-handoff-runs')
  });
  assert.ok(legacy.batch.edges.some(item => item.producerModuleId === 'orphan' && item.consumerModuleId === 'beta'));
  const contaminated = LegacyOrgan.plan(legacy.batch, {
    schema: LegacyOrgan.REQUEST_SCHEMA,
    sourceModuleId: 'orphan',
    targetModuleId: 'beta',
    maximumDepth: 1
  });
  assert.equal(contaminated.state, 'PROPOSED_EXACT_TYPED_ROUTES');
});

test('unsafe contracts and session tampering remain visible and refuse reuse', t => {
  const fx = fixture(t);
  fx.write('invalid', Object.assign(contract('wrong-id', ['axm.test/x-v1'], []), { handoffs: { emits: ['duplicate', 'duplicate'], accepts: [] } }));
  const result = Organ.derive({ root: fx.root, workshopRoot: fx.workshopRoot });
  assert.ok(result.batch.refusedContracts.some(item => item.directory === 'invalid' && item.state === 'REFUSED_INVALID_OR_MISMATCHED_DECLARED_CONTRACT'));
  const session = path.join(result.runDir, result.batch.results[0].sessionFile);
  fs.appendFileSync(session, ' ');
  assert.throws(() => Organ.derive({ root: fx.root, workshopRoot: fx.workshopRoot }), /session hash mismatch/);
});
