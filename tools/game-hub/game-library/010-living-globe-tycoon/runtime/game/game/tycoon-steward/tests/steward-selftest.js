'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const H = require('./test-helpers');

module.exports = ({ test }) => {
  test('required headless public API is present', 'R7 AI-native truth', () => {
    const engine = H.Steward.createSteward('api-surface');
    ['observeState', 'listNeeds', 'proposeAllocation', 'applyStewardDecision', 'advanceTurn', 'explainChange', 'exportReceipt', 'exportState', 'importState'].forEach(name => assert.equal(typeof engine[name], 'function', name));
  });

  test('allocation preview is pure and explicitly unapplied', 'R7 AI-native truth', () => {
    const engine = H.Steward.createSteward('pure-preview');
    const before = H.Canonical.stableStringify(engine.observeState());
    const proposal = engine.proposeAllocation({ zone: 'HOUSING', amounts: { population: 3, energy: 10, materials: 12, funds: 20, attention: 3 } }, { id: 'human' });
    assert.equal(proposal.applied, false);
    assert.equal(proposal.affordable, true);
    assert.equal(H.Canonical.stableStringify(engine.observeState()), before);
  });

  test('24-turn run completes through public API without graphics', 'R7 AI-native truth', () => {
    const engine = H.runPublicSequence('headless-24', 24);
    const state = engine.observeState();
    assert.equal(state.turn, 24);
    assert(state.structures.length > 4, 'expected emergent structures');
    assert(state.decisions.accepted.length >= 7);
    assert(state.needs.every(item => Array.isArray(item.evidence) && Array.isArray(item.couldBeDisconfirmedBy)));
    assert.equal(H.Steward.validateState(state).ok, true);
  });

  test('every turn has one readable chained receipt', 'R9 receipts', () => {
    const engine = H.runPublicSequence('receipt-run', 24);
    const packet = engine.exportReceipt();
    const turns = packet.receipts.filter(receipt => receipt.kind === 'TURN');
    assert.equal(turns.length, 24);
    assert.equal(packet.chainValid, true);
    packet.receipts.forEach((receipt, index) => {
      assert.equal(receipt.sequence, index + 1);
      assert(receipt.readableExplanation.length >= 2);
    });
  });

  test('export/import round trip preserves exact canonical state', 'Import/export', () => {
    const source = H.runPublicSequence('round-trip', 8);
    const packet = source.exportState();
    const target = H.Steward.createSteward('other');
    const imported = target.importState(packet);
    assert.equal(imported.ok, true, JSON.stringify(imported.errors));
    assert.equal(H.Canonical.stableStringify(target.exportState()), H.Canonical.stableStringify(packet));
  });

  test('bad checksum, chain, schema, malformed and oversized imports are refused without overwrite', 'Import/export', () => {
    const engine = H.runPublicSequence('import-refusal', 2);
    const before = H.Canonical.stableStringify(engine.observeState());
    const checksum = engine.exportState(); checksum.checksum.value = '0'.repeat(64);
    assert.equal(engine.importState(checksum).ok, false);
    const chain = engine.exportState(); chain.state.receipts[0].currentReceiptHash = 'f'.repeat(64); chain.checksum.value = H.Canonical.sha256(H.Canonical.stableStringify(chain.state));
    assert.equal(engine.importState(chain).ok, false);
    const future = engine.exportState(); future.schema = 'axm.tycoon-steward.export/v99';
    assert.equal(engine.importState(future).ok, false);
    const malformed = engine.exportState(); malformed.state.map.cells = []; malformed.checksum.value = H.Canonical.sha256(H.Canonical.stableStringify(malformed.state));
    assert.equal(engine.importState(malformed).ok, false);
    const oversized = engine.exportState(); oversized.padding = 'x'.repeat(H.Canonical.MAX_IMPORT_BYTES + 1);
    assert.equal(engine.importState(oversized).ok, false);
    assert.equal(H.Canonical.stableStringify(engine.observeState()), before);
  });

  test('starter example is a valid checksum-bearing import packet', 'Examples', () => {
    const packet = JSON.parse(fs.readFileSync(path.join(H.ROOT, 'examples', 'starter-world.json'), 'utf8'));
    const engine = H.Steward.createSteward('example-target');
    assert.equal(engine.importState(packet).ok, true);
    assert.equal(engine.observeState().seed, 'axm-hearth-001');
  });

  test('sample sequence declares exactly 24 explicit turn actions and never autoruns', 'Examples', () => {
    const sample = JSON.parse(fs.readFileSync(path.join(H.ROOT, 'examples', 'sample-decisions.json'), 'utf8'));
    assert.equal(sample.status, 'EXAMPLE_NOT_AUTORUN');
    assert.equal(sample.actions.filter(action => action.kind === 'ADVANCE').length, 24);
    assert.equal(sample.actions.filter(action => action.kind === 'DECISION').length, 7);
  });

  test('browser shell has explicit storage controls and no hidden state timer or unsafe imported rendering', 'Browser static boundary', () => {
    const app = fs.readFileSync(path.join(H.ROOT, 'app.js'), 'utf8');
    const html = fs.readFileSync(path.join(H.ROOT, 'index.html'), 'utf8');
    assert(app.includes("axm.tycoon-steward.v0.1"));
    assert(!/setInterval\s*\(|serviceWorker|\.innerHTML\s*=|document\.write\s*\(/.test(app));
    assert(!/autoplay|http-equiv=["']refresh/i.test(html));
    ['advanceOneButton', 'advanceFiveButton', 'exportStateButton', 'importStateButton', 'saveLocalButton', 'loadLocalButton', 'resetButton'].forEach(id => assert(html.includes('id="' + id + '"'), id));
  });

  test('palace polish is presentation-only and keeps map, feedback and saves explicit', 'Palace polish boundary', () => {
    const app = fs.readFileSync(path.join(H.ROOT, 'app.js'), 'utf8');
    const html = fs.readFileSync(path.join(H.ROOT, 'index.html'), 'utf8');
    const css = fs.readFileSync(path.join(H.ROOT, 'styles.css'), 'utf8');
    assert(app.includes("axm.tycoon-steward.v0.1.palace-polish-v1"));
    assert(app.includes("PRIOR_STORAGE_KEY = 'axm.tycoon-steward.v0.1.emergence-memory-v1'"));
    assert(/node\.dataset\.terrain = cell\.terrain\.kind/.test(app)); assert(/function mapGlyph\(/.test(app));
    assert(/function showToast\(/.test(app)); assert(/priorIds = new Set/.test(app));
    assert(html.includes('id="toastHarbor"')); assert(html.includes('Palace radio'));
    assert(/\.cell-glyph/.test(css)); assert(/\.toast-harbor/.test(css)); assert(/prefers-reduced-motion/.test(css));
    assert(!/engine\.(advanceTurn|applyStewardDecision)[^\n]*setTimeout/.test(app), 'feedback timers must not drive simulation state');
  });

  test('manifest and AXM v1 contract agree on identity and permissions', 'Foundation contract', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(H.ROOT, 'manifest.json'), 'utf8'));
    const contract = JSON.parse(fs.readFileSync(path.join(H.ROOT, 'module.contract.json'), 'utf8'));
    assert.equal(manifest.id, contract.id);
    assert.equal(manifest.version, contract.version);
    assert.equal(manifest.status, 'EXPERIMENTAL');
    assert.equal(contract.schema, 'axm.module-contract/v1');
    contract.permissions.forEach(permission => assert(manifest.uses.includes(permission), permission));
    assert.equal(fs.existsSync(path.join(H.ROOT, manifest.entry)), true);
  });
};
