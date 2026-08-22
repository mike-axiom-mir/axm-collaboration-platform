'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const hub = fs.readFileSync(path.join(root, 'hub', 'index.html'), 'utf8');
const client = fs.readFileSync(path.join(root, 'hub', 'growth.js'), 'utf8');

assert.ok(server.includes('WorkshopObservatoryRunner.create'));
assert.ok(server.includes('/api/workshop-observatory'));
assert.ok(server.includes('explicit-local-refresh'));
assert.ok(server.includes('explicit-local-milestone'));
assert.ok(server.includes('milestonesAreHumanRecorded: true'));
assert.ok(server.includes('OperationsUtils.atomicJson'));
assert.ok(hub.includes('growthObservatoryLifecycle'));
assert.ok(hub.includes('growthOpportunities'));
assert.ok(hub.includes('growthMilestones'));
assert.ok(client.includes('/api/workshop-observatory'));
assert.ok(client.includes('automaticallyProven'));

console.log('Workshop Observatory route selftest: PASS');
