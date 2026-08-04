'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const core = require('../runtime/game-core.js');

const ROOT = path.join(__dirname, '..');
const authority = core.createInitialState([], { now: 0 });
const authorityBefore = JSON.stringify(authority);
const moments = new Set();
const samples = [0, 72, 215, 430, 1000, 5000];
let poses = 0;

assert.equal(Object.isFrozen(core.START_GRID_MOMENTS), true);
assert.equal(Object.keys(core.START_GRID_MOMENTS).length, 4);

core.RACERS.forEach(character => {
  const moment = core.startGridMomentFor(character.id);
  assert.equal(Object.isFrozen(moment), true);
  assert.equal(moment.changesPerformance, false);
  assert.equal(moment.changesAuthority, false);
  moments.add(moment.id);
  for (let seat = 1; seat <= 4; seat += 1) {
    samples.forEach(elapsedMs => {
      const pose = core.startGridPose(character.id, seat, elapsedMs, false);
      poses += 1;
      assert.equal(pose.schema, 'axm.start-grid-pose/v1');
      assert.equal(pose.characterId, character.id);
      assert.equal(pose.momentId, moment.id);
      assert.equal(pose.seat, seat);
      assert.equal(pose.changesPerformance, false);
      assert.equal(pose.changesAuthority, false);
      assert(Number.isFinite(pose.lift) && pose.lift >= -1.4 && pose.lift <= 18.1);
      assert(Number.isFinite(pose.rollDeg) && Math.abs(pose.rollDeg) <= 2.7);
      assert(Number.isFinite(pose.scale) && pose.scale >= .94 && pose.scale <= 1.01);
      assert(Number.isFinite(pose.opacity) && pose.opacity >= .18 && pose.opacity <= 1);
      assert(Number.isFinite(pose.glow) && pose.glow >= .2 && pose.glow <= .45);
      assert(pose.entranceProgress >= 0 && pose.entranceProgress <= 1);
      if (elapsedMs === 5000) assert.equal(pose.entranceProgress, 1);
    });
    const reduced = core.startGridPose(character.id, seat, 100, true);
    poses += 1;
    assert.equal(reduced.reducedMotion, true);
    assert.equal(reduced.entranceProgress, 1);
    assert.equal(reduced.lift, 0);
    assert.equal(reduced.rollDeg, 0);
    assert.equal(reduced.opacity, 1);
    assert.equal(reduced.scale, 1);
  }
});

assert.equal(moments.size, 4, 'every original character needs a distinct start-grid moment');
assert.equal(JSON.stringify(authority), authorityBefore, 'start-grid presentation mutated authoritative state');
assert.equal(Object.isFrozen(core.BASE_STATS), true);
assert.equal(core.BASE_STATS.maxSpeed, 260);
assert.equal(core.BASE_STATS.acceleration, 178);
assert.equal(core.BASE_STATS.turnRate, 2.45);
assert.equal(core.METRICS.catchupByRank[3], 1.075);
assert.equal(core.POWERUP_WEIGHTS.filter(item => item.id !== 'repair').reduce((sum, item) => sum + item.weight, 0), 85);
assert.equal(core.METRICS.shieldMax, 3);

const locked = core.createInitialState([], { now: 0 });
assert.equal(core.startRace(locked, 100).ok, true);
const lockedMode = core.setMode(locked, core.MODES.BATTLE, 200);
assert.equal(lockedMode.ok, false);
assert.equal(lockedMode.reason, 'mode-locked');

const app = fs.readFileSync(path.join(ROOT, 'runtime', 'app.js'), 'utf8');
const screen = fs.readFileSync(path.join(ROOT, 'runtime', 'index.html'), 'utf8');
const styles = fs.readFileSync(path.join(ROOT, 'runtime', 'styles.css'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'game.manifest.json'), 'utf8'));
const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const selectModeSource = app.match(/function selectMode\(mode\) \{[\s\S]*?\n  \}\n\n  function selectTrack/);

assert(selectModeSource, 'selectMode source must be inspectable');
assert(/api\('\/api\/mode'/.test(selectModeSource[0]));
assert(!/stateView\.state\.phase/.test(selectModeSource[0]), 'visible mode control must not silently veto the server request');
assert(/Mode change refused by authority/.test(selectModeSource[0]));
assert(/__MIRRORSHIFT_START_GRID__/.test(app));
assert(/core\.startGridPose/.test(app));
assert(/dataset\.startGridChangesAuthority\s*=\s*'false'/.test(app));
assert(/aria-label="Four-racer start grid"/.test(screen));
assert(/class="start-grid-stage"/.test(screen));
assert(/\.start-grid-portrait\s*\{/.test(styles));
assert(/\.race-hud\[aria-hidden="true"\]\s*\{[^}]*visibility:\s*hidden/.test(styles), 'hidden HUD must not intercept lobby controls');
assert(/\.countdown\s*\{[^}]*z-index:\s*14/.test(styles), 'countdown reveal must render above the race HUD');
assert(/@media \(prefers-reduced-motion: reduce\)/.test(styles));
assert.equal(packageJson.version, '0.23.0');
assert.equal(manifest.version, '0.23.0-living-circuits');
assert(manifest.package.required_paths.includes('tests/start-grid.test.js'));
assert(manifest.package.required_paths.includes('evidence/start-grid-contract.md'));

console.log('MIRRORSHIFT START GRID PASS · ' + poses + ' bounded grid poses · 4 distinct identity moments · mode request reaches server authority · reduced motion static · authority unchanged');
