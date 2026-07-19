'use strict';
const assert = require('assert');
const Audit = require('./module-seam-audit');

const good = { state_owner: 'service', reload: 'resume', disconnect: 'graceful-degrade', cleanup: 'explicit' };
assert.equal(Audit.validateLifecycle(good).pass, true);
assert.ok(Audit.validateLifecycle(null).gaps.some(gap => gap.includes('missing')));
assert.ok(Audit.validateLifecycle(Object.assign({}, good, { reload: 'pending' })).gaps.some(gap => gap.includes('pending')));
assert.ok(Audit.validateLifecycle(Object.assign({}, good, { cleanup: 'magic' })).gaps.some(gap => gap.includes('unsupported')));
console.log('PASS module seam audit: lifecycle gaps stay visible without rewriting legacy modules');
