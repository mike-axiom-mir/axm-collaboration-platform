'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const core = require('../runtime/game-core.js');

const ROOT = path.join(__dirname, '..');
const environments = [core.TRACK_IDS.FORGE, core.TRACK_IDS.GARDENS, core.TRACK_IDS.FOUNDRY, core.BATTLE_ARENA.id];
const profiles = environments.map(id => core.environmentChoreographyFor(id));

assert.equal(Object.isFrozen(core.ENVIRONMENT_CHOREOGRAPHIES), true);
assert.equal(profiles.length, 4);
assert.equal(new Set(profiles.map(profile => profile.id)).size, 4);
assert.equal(new Set(profiles.map(profile => profile.motion)).size, 4);
profiles.forEach(profile => {
  assert.equal(Object.isFrozen(profile), true);
  assert.equal(profile.changesPerformance, false);
  assert.equal(profile.changesAuthority, false);
  assert(profile.density >= 8 && profile.density <= 18);
});

const authority = core.createInitialState([], { now: 0 });
const authorityBefore = JSON.stringify(authority);
const numericFields = ['phase', 'secondaryPhase', 'rotationRad', 'drift', 'glow'];
let poses = 0;

for (let sample = 0; sample < 18000; sample += 1) {
  environments.forEach((environmentId, environmentIndex) => {
    const pose = core.environmentChoreographyPose(environmentId, sample * (1000 / 60) + environmentIndex * 7, false);
    assert.equal(pose.schema, 'axm.environment-choreography-pose/v1');
    assert.equal(pose.environmentId, environmentId);
    assert.equal(pose.choreographyId, profiles[environmentIndex].id);
    assert.equal(pose.motion, profiles[environmentIndex].motion);
    assert.equal(pose.changesPerformance, false);
    assert.equal(pose.changesAuthority, false);
    numericFields.forEach(field => assert(Number.isFinite(pose[field]), field + ' must stay finite'));
    assert(pose.phase >= 0 && pose.phase <= 1);
    assert(pose.secondaryPhase >= 0 && pose.secondaryPhase <= 1);
    assert(pose.rotationRad >= 0 && pose.rotationRad <= Math.PI * 2 + .0001);
    assert(Math.abs(pose.drift) <= profiles[environmentIndex].drift + .0001);
    assert(pose.glow >= profiles[environmentIndex].baseGlow);
    assert(pose.glow <= profiles[environmentIndex].baseGlow + profiles[environmentIndex].glowRange + .0001);
    poses += 1;
  });
}

environments.forEach(environmentId => {
  const first = core.environmentChoreographyPose(environmentId, 0, true);
  const later = core.environmentChoreographyPose(environmentId, 999999, true);
  assert.deepEqual(later, first, environmentId + ' reduced-motion pose must be time-invariant');
  assert.equal(first.reducedMotion, true);
  assert.equal(first.phase, .5);
  assert.equal(first.secondaryPhase, .5);
  assert.equal(first.drift, 0);
});

assert.equal(core.environmentChoreographyPose('not-an-environment', 12, false).environmentId, core.TRACK_IDS.FORGE);
assert.equal(JSON.stringify(authority), authorityBefore, 'environment presentation mutated authoritative state');
assert.deepEqual(core.BASE_STATS, { maxSpeed: 260, acceleration: 178, brake: 255, turnRate: 2.45, grip: .985 });
assert.equal(core.METRICS.catchupByRank[3], 1.075);
assert.equal(core.POWERUP_WEIGHTS.filter(item => item.id !== 'repair').reduce((sum, item) => sum + item.weight, 0), 85);
assert.equal(core.METRICS.shieldMax, 3);

const app = fs.readFileSync(path.join(ROOT, 'runtime', 'app.js'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'game.manifest.json'), 'utf8'));
const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
assert(/__MIRRORSHIFT_ENVIRONMENT__/.test(app));
assert(/function drawEnvironmentChoreography\(state, pose\)/.test(app));
assert(/core\.environmentChoreographyPose\(track\.id, frameNow, reducedMotion\)/.test(app));
assert(/core\.environmentChoreographyPose\(arena\.id, frameNow, reducedMotion\)/.test(app));
assert(/dataset\.environmentChangesAuthority/.test(app));
assert.equal(packageJson.version, '0.23.0');
assert.equal(manifest.version, '0.23.0-living-circuits');
assert.equal(manifest.rules.environment_choreography_changes_vehicle_stats, false);
assert.equal(manifest.rules.environment_choreography_changes_authority, false);
assert.equal(manifest.rules.environment_choreography_respects_reduced_motion, true);
assert.deepEqual(manifest.rules.environment_choreographies, profiles.map(profile => profile.id));
assert(manifest.package.required_paths.includes('tests/environment-choreography.test.js'));
assert(manifest.package.required_paths.includes('evidence/environment-choreography-contract.md'));

console.log('MIRRORSHIFT LIVING CIRCUITS PASS - ' + poses + ' bounded poses - 4 authored choreographies - reduced motion static - authority unchanged');
