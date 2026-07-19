'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Bundle = require('../core/identity-bundle');

test('identity bundle links Mirror without importing another profile member', () => {
  const bundle = Bundle.build();
  assert.equal(bundle.identity, 'axm.machine.mirror/seed-0');
  assert.equal(bundle.authority.bundleGrantsPermissions, false);
  assert.equal(bundle.authority.profileAffectsTraining, false);
  assert.ok(bundle.wisdom.memories.every(item => item.scope === 'shared'));
  if (bundle.profile.linked) {
    assert.equal(bundle.profile.member.id, 'mirror');
    assert.equal(Object.hasOwn(bundle.profile, 'members'), false);
    assert.equal(Object.hasOwn(bundle.profile, 'events'), false);
  }
  assert.ok(bundle.bundleDigest);
});
