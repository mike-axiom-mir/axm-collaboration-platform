'use strict';

const assert = require('assert');
const path = require('path');
const Observatory = require('./axm-workshop-observatory');

const root = path.resolve(__dirname, '../..');
const current = Observatory.scan(root, { now:'2026-08-22T00:00:00.000Z' });

assert.equal(current.schema, Observatory.SCHEMA);
assert.equal(current.truth.qualityScoreProduced, false);
assert.equal(current.truth.growthEqualsSuccess, false);
assert.equal(current.truth.humanMilestonesExplicitOnly, true);
assert.ok(current.structure.tools > 10);
assert.equal(Object.values(current.lifecycle.statuses).reduce((sum,value) => sum + value, 0), current.structure.tools);
assert.ok(current.structure.contracts.present >= current.structure.contracts.valid);
assert.ok(current.connections.exactContractCapabilities >= current.connections.connected);
assert.ok(Array.isArray(current.opportunities));
assert.ok(current.opportunities.every(row => ['BLOCKING','ATTENTION','OPPORTUNITY','CONTEXT'].includes(row.severity)));
assert.equal(JSON.stringify(current).includes(root), false);

const compact = Observatory.compact(current);
assert.equal(compact.schema, 'axm.workshop-observatory-snapshot/v1');
assert.equal(compact.structure.tools, current.structure.tools);
assert.equal('opportunities' in compact, false);
assert.equal('blockerReasons' in compact.lifecycle, false);

const recorded = Observatory.recordMilestone(null, current, { label:'Observatory foundation', note:'Human-recorded test milestone', actor:'selftest', recordedAt:'2026-08-22T00:01:00.000Z' });
assert.equal(recorded.duplicate, false);
assert.equal(recorded.milestone.truth.automaticallyProven, false);
assert.equal(recorded.milestone.evidence.tools, current.structure.tools);
const duplicate = Observatory.recordMilestone(recorded.state, current, { label:'Observatory foundation', actor:'selftest', recordedAt:'2026-08-22T00:02:00.000Z' });
assert.equal(duplicate.duplicate, true);

console.log('Workshop Observatory selftest: PASS · ' + current.structure.tools + ' tools · ' + current.opportunities.length + ' typed improvement signals');
