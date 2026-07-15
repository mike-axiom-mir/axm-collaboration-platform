#!/usr/bin/env node
'use strict';

const path = require('path');
const { MirrorCore, MIKE_ID } = require('../core/mirror-core');
const Compatibility = require('./pr13-compatibility');

function runCompatibilityHarness(options) {
  options = options || {};
  const rootDir = path.resolve(options.rootDir || path.join(__dirname, '..'));
  const core = options.core || new MirrorCore({ rootDir, runtimeDir: options.runtimeDir });
  const descriptor = Compatibility.discoveryDescriptor(core);
  const boundary = Compatibility.sharedControlBoundary();
  const world = core.adapters.world.descriptor;
  const connectionIntent = Compatibility.adapterConnectionIntent(
    world,
    'consent:local:mock-world',
    'approved_apply'
  );
  const checks = {
    source_sha_frozen: descriptor.source_reference.head_sha === Compatibility.SOURCE_REFERENCE.head_sha,
    status_is_honest: descriptor.status === 'standalone_foundation_compatibility_harness' && descriptor.runtime.foundation_installed === false,
    discovery_is_local: descriptor.discovery.local_only === true,
    proposal_first: descriptor.boundaries.proposal_first === true,
    gate_remains_authoritative: connectionIntent.connected === false && connectionIntent.next_required_action === 'mirror_gate_authorization',
    controls_are_separate: boundary.mirror_core_runs_game_loop === false && boundary.live_action_shape !== boundary.durable_change_shape,
    no_default_ai_fill: boundary.default_ai_fill === false,
    actor_is_known: core.actor(MIKE_ID).actor_type === 'human'
  };
  return {
    schema_version: 'axm.mirror.foundation-harness-result/v1',
    status: Object.values(checks).every(Boolean) ? 'PASS' : 'FAIL',
    label: 'STANDALONE FOUNDATION-COMPATIBILITY HARNESS',
    installed_into_foundation: false,
    descriptor,
    shared_controls_boundary: boundary,
    checks
  };
}

if (require.main === module) {
  try {
    const result = runCompatibilityHarness();
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    if (result.status !== 'PASS') process.exitCode = 1;
  } catch (error) {
    process.stderr.write('FOUNDATION HARNESS FAIL: ' + error.stack + '\n');
    process.exitCode = 1;
  }
}

module.exports = { runCompatibilityHarness };
