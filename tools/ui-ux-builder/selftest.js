'use strict';
const assert = require('assert');
const Core = require('./ui-ux-core.js');

const publishedManifest = require('./manifest.json');
const publishedContract = require('./module.contract.json');
assert.equal(publishedManifest.schema, 'axm.tool-manifest/v1');
assert.equal(publishedManifest.kind, 'product');
assert.deepStrictEqual(publishedManifest.permissions, publishedContract.permissions);
assert.deepStrictEqual(publishedContract.lifecycle, {
  state_owner: 'browser',
  reload: 'resume',
  disconnect: 'not-applicable',
  cleanup: 'explicit'
});

const blank = Core.baseWorkspace();
assert.equal(blank.format, Core.FORMAT);
assert.equal(Core.audit(blank).gatePassed, false);
assert.equal(Core.audit(blank).reviewReady, false);

let hub = Core.hubStarter();
let report = Core.audit(hub);
assert.equal(report.gatePassed, true);
assert.equal(report.reviewReady, false);
hub.humanVerdict = 'yes';
report = Core.audit(hub);
assert.equal(report.reviewReady, true);

hub.theme.text = '#111111';
hub.theme.background = '#111111';
assert.equal(Core.audit(hub).gatePassed, false);
assert.equal(Core.proposal(hub).status, 'DRAFT');

hub = Core.applyPreset(Core.hubStarter(), 'clear-day');
assert.equal(hub.theme.background, '#f3f7fa');
assert.equal(Core.proposal(Object.assign(hub, { humanVerdict: 'yes' })).effect, 'proposal-only');
assert.equal(Core.proposal(hub).applied, false);
assert.throws(() => Core.normalize({ format: 'wrong' }), /not an AXM UI\/UX workspace/);

console.log('UI/UX Builder selftest: PASS (human brief, contrast gate, approval boundary, proposal-only handoff)');
