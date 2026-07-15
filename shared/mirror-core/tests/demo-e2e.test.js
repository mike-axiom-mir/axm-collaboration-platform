'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { runDemo } = require('../demo/demo-flow');
const { ROOT } = require('./helpers');

test('complete deterministic demo imports, reviews, applies, verifies, conflicts, and rolls back', function (t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-mirror-demo-'));
  t.after(function () { fs.rmSync(dir, { recursive: true, force: true }); });
  const result = runDemo({ rootDir: ROOT, runtimeDir: path.join(dir, 'runtime') });
  assert.equal(result.status, 'PASS');
  assert.equal(result.world_import.imported_entities > 0, true);
  assert.equal(result.platform_import.imported_entities > 0, true);
  assert.equal(result.capability_gain.verified, true);
  assert.equal(result.capability_gain.world_has_capability, true);
  assert.equal(result.primary_flow.preview_conflicts, 0);
  assert.equal(result.primary_flow.verified, true);
  assert.equal(result.primary_flow.final_status, 'ROLLED_BACK');
  assert.equal(result.reverse_flow.final_status, 'REJECTED');
  assert.equal(result.reverse_flow.world_description_unchanged, true);
  assert.equal(result.conflict_flow.blocked, true);
  assert.equal(result.conflict_flow.conflicts.includes('stale_target_snapshot'), true);
  assert.equal(result.rollback.platform_restored_to_seed, true);
  assert.equal(result.rollback.core_effects_reversed, true);
  assert.equal(result.journal.ok, true);
  assert.deepEqual(result.truth_boundaries, {
    world_built: false,
    physics_built: false,
    vr_built: false,
    real_company_connected: false,
    foundation_installed: false,
    github_modified: false
  });
});
