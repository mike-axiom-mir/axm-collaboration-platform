'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const core = require('../runtime/game-core.js');

const ROOT = path.join(__dirname, '..');
const authority = core.createInitialState([], { now: 0 });
const authorityBefore = JSON.stringify(authority);
const moments = new Set();
const samples = [0, 85, 260, 520, 1000, 5000];
let poses = 0;

assert.equal(Object.isFrozen(core.RESULT_STAGE_MOMENTS), true);
assert.equal(Object.keys(core.RESULT_STAGE_MOMENTS).length, 4);

core.RACERS.forEach(character => {
  const moment = core.resultStageMomentFor(character.id);
  assert.equal(Object.isFrozen(moment), true);
  assert.equal(moment.changesPerformance, false);
  assert.equal(moment.changesAuthority, false);
  moments.add(moment.id);
  for (let place = 1; place <= 4; place += 1) {
    samples.forEach(elapsedMs => {
      const pose = core.resultStagePose(character.id, place, elapsedMs, false);
      poses += 1;
      assert.equal(pose.schema, 'axm.result-stage-pose/v1');
      assert.equal(pose.characterId, character.id);
      assert.equal(pose.momentId, moment.id);
      assert.equal(pose.place, place);
      assert.equal(pose.changesPerformance, false);
      assert.equal(pose.changesAuthority, false);
      assert(Number.isFinite(pose.lift) && pose.lift >= -2 && pose.lift <= 16.1);
      assert(Number.isFinite(pose.rollDeg) && Math.abs(pose.rollDeg) <= 3);
      assert(Number.isFinite(pose.scale) && pose.scale >= .94 && pose.scale <= 1.05);
      assert(Number.isFinite(pose.opacity) && pose.opacity >= .22 && pose.opacity <= 1);
      assert(Number.isFinite(pose.glow) && pose.glow >= .18 && pose.glow <= .8);
      assert(pose.entranceProgress >= 0 && pose.entranceProgress <= 1);
      if (elapsedMs === 5000) assert.equal(pose.entranceProgress, 1);
    });
    const reduced = core.resultStagePose(character.id, place, 100, true);
    poses += 1;
    assert.equal(reduced.reducedMotion, true);
    assert.equal(reduced.entranceProgress, 1);
    assert.equal(reduced.lift, 0);
    assert.equal(reduced.rollDeg, 0);
    assert.equal(reduced.opacity, 1);
    assert.equal(reduced.scale, place === 1 ? 1.035 : 1);
  }
});

assert.equal(moments.size, 4, 'every original character needs a distinct result moment');
assert.equal(JSON.stringify(authority), authorityBefore, 'result presentation mutated authoritative state');
assert.equal(Object.isFrozen(core.BASE_STATS), true);
assert.equal(core.BASE_STATS.maxSpeed, 260);
assert.equal(core.BASE_STATS.acceleration, 178);
assert.equal(core.BASE_STATS.turnRate, 2.45);
assert.equal(core.METRICS.catchupByRank[3], 1.075);
assert.equal(core.POWERUP_WEIGHTS.filter(item => item.id !== 'repair').reduce((sum, item) => sum + item.weight, 0), 85);
assert.equal(core.METRICS.shieldMax, 3);

const app = fs.readFileSync(path.join(ROOT, 'runtime', 'app.js'), 'utf8');
const screen = fs.readFileSync(path.join(ROOT, 'runtime', 'index.html'), 'utf8');
const styles = fs.readFileSync(path.join(ROOT, 'runtime', 'styles.css'), 'utf8');
assert(/__MIRRORSHIFT_RESULT_STAGE__/.test(app));
assert(/core\.resultStagePose/.test(app));
assert(/dataset\.resultStageChangesAuthority\s*=\s*'false'/.test(app));
assert(/class="result-stage-heading"/.test(screen));
assert(/aria-label="Final standings tableau"/.test(screen));
assert(/\.result-portrait\s*\{/.test(styles));
assert(/@media \(prefers-reduced-motion: reduce\)/.test(styles));

console.log('MIRRORSHIFT MIRROR PODIUM PASS · ' + poses + ' bounded result poses · 4 distinct character moments · reduced motion static · authority unchanged');
