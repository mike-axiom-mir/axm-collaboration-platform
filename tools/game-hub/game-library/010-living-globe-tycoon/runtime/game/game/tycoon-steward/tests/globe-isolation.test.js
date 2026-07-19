'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const H = require('./test-helpers');
const Adapter = require('../core/globe-adapter');

function snapshot(world, revision, data) {
  return { schema: Adapter.SNAPSHOT_SCHEMA, sourceWorldId: world, sourceRevision: revision, provenance: ['TEST FIXTURE'], units: { distance: 'cells' }, uncertainty: ['fixture only'], limitations: ['not a living globe'], consentReference: 'consent:test', data };
}

module.exports = ({ test }) => {
  test('default adapter is disconnected and live host mutation is unsupported', 'R8 globe isolation', () => {
    const engine = H.Steward.createSteward('adapter-default');
    const adapter = engine.getGlobeAdapter();
    assert.equal(adapter.mode, 'disconnected');
    assert.equal(adapter.readTerrainSeed().ok, false);
    assert.equal(adapter.readWorldResources().ok, false);
    assert.equal(adapter.readExistingSettlements().ok, false);
    const methods = Object.getOwnPropertyNames(Adapter.GlobeAdapter.prototype);
    assert.equal(methods.includes('apply'), false);
    assert.equal(methods.includes('write'), false);
    assert.equal(methods.includes('mutateWorld'), false);
  });

  test('fixture adapter validates snapshots but remains proposal-only', 'R8 globe isolation', () => {
    const worldId = 'world.fixture';
    const adapter = new Adapter.GlobeAdapter({ mode: 'proposal_only', worldId, revision: 7, fixture: { terrain: snapshot(worldId, 7, { cells: [] }), resources: snapshot(worldId, 7, { energy: 10 }), settlements: snapshot(worldId, 7, { settlements: [] }) } });
    assert.equal(adapter.readTerrainSeed().ok, true);
    const input = {
      targetWorldId: worldId,
      targetRevision: 7,
      preconditions: [{ field: 'revision', equals: 7 }],
      requestedOperations: [{ type: 'PROPOSE_DISTRICT', payload: { id: 'district-proposal' } }],
      causeCostTrace: { receiptIds: ['receipt-fixture'], costs: { funds: 10 } },
      reversibilityStatement: 'Proposal may be discarded; no host change exists.',
      risks: ['fixture assumptions'],
      unknowns: ['host verifier not connected'],
      consentReference: 'consent:test'
    };
    const proposal = adapter.submitCityPatchProposal(input);
    assert.equal(proposal.ok, true);
    assert.equal(proposal.applied, false);
    assert.equal(proposal.proposal.status, 'PROPOSAL_ONLY');
    assert.equal(proposal.proposal.liveHostMutation, false);
    assert.equal(adapter.revision, 7);
  });

  test('stale revisions, unsupported operations and unreviewed novelty are refused', 'R8/R10 adapter boundary', () => {
    const adapter = new Adapter.GlobeAdapter({ mode: 'proposal_only', worldId: 'world.fixture', revision: 9 });
    const base = { targetWorldId: 'world.fixture', targetRevision: 8, preconditions: [], requestedOperations: [{ type: 'PROPOSE_DISTRICT' }], causeCostTrace: {}, reversibilityStatement: 'discardable', risks: [], unknowns: [] };
    assert.equal(adapter.submitCityPatchProposal(base).ok, false);
    assert.equal(adapter.submitCityPatchProposal({ ...base, targetRevision: 9, requestedOperations: [{ type: 'DELETE_WORLD' }] }).ok, false);
    assert.equal(adapter.exportEmergentContent({ id: 'novel', status: 'UNSCORED_REVIEW_REQUIRED' }).ok, false);
  });

  test('world events are explicit, versioned and allowlisted', 'R8 globe isolation', () => {
    const adapter = new Adapter.GlobeAdapter({ mode: 'read_only', worldId: 'world.fixture', revision: 2 });
    assert.equal(adapter.receiveWorldEvent({ schema: Adapter.EVENT_SCHEMA, type: 'TERRAIN_REVISION', sourceWorldId: 'world.fixture', sourceRevision: 3, data: {} }).ok, true);
    assert.equal(adapter.receiveWorldEvent({ schema: Adapter.EVENT_SCHEMA, type: 'RUN_CODE', sourceWorldId: 'world.fixture', sourceRevision: 4, data: {} }).ok, false);
    assert.equal(adapter.revision, 3);
  });

  test('package has no living-globe import, live runtime URL or automatic host route', 'R8 globe isolation', () => {
    const runtimeFiles = [];
    function walk(dir) {
      fs.readdirSync(dir, { withFileTypes: true }).forEach(entry => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory() && entry.name !== 'tests' && entry.name !== 'examples') walk(full);
        else if (/\.(js|html|css)$/.test(entry.name)) runtimeFiles.push(full);
      });
    }
    walk(H.ROOT);
    runtimeFiles.forEach(file => {
      const source = fs.readFileSync(file, 'utf8');
      assert(!/worlds[\\/]living-globe|AXMLivingWorld/.test(source), file + ' living globe import');
      assert(!/https?:\/\//.test(source), file + ' runtime URL');
      assert(!/fetch\s*\(/.test(source), file + ' fetch');
    });
  });

  test('city patch packets remain proposals and never change fixture snapshots', 'Proposal-only boundary', () => {
    const terrain = snapshot('world.fixture', 4, { marker: 'UNCHANGED' });
    const adapter = new Adapter.GlobeAdapter({ mode: 'proposal_only', worldId: 'world.fixture', revision: 4, fixture: { terrain } });
    const before = H.Canonical.stableStringify(adapter.fixture);
    const result = adapter.submitCityPatchProposal({ targetWorldId: 'world.fixture', targetRevision: 4, preconditions: [], requestedOperations: [{ type: 'PROPOSE_ROAD', payload: { path: ['a', 'b'] } }], causeCostTrace: { receipt: 'r1' }, reversibilityStatement: 'Discard proposal.', risks: [], unknowns: [] });
    assert.equal(result.ok, true);
    assert.equal(result.applied, false);
    assert.equal(H.Canonical.stableStringify(adapter.fixture), before);
  });
};
