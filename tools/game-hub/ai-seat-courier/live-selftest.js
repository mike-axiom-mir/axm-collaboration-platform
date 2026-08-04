#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { CourierCore, REQUEST_SCHEMA } = require('./lib/courier-core');

async function main() {
  const moduleRoot = __dirname;
  const workshopRoot = path.resolve(moduleRoot, '..', '..', '..');
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-ai-seat-courier-'));
  const core = new CourierCore({ moduleRoot, workshopRoot, stateRoot: tempRoot });
  let beforeProof;
  let afterProof;
  try {
    const launched = await core.handle({ schema: REQUEST_SCHEMA, id: 'live-launch', action: 'launch', gameId: '019-brace-room', viewport: { width: 1280, height: 720 }, waitMs: 600 });
    assert.strictEqual(launched.session.gameId, '019-brace-room');
    assert.ok(fs.statSync(launched.capture).size > 1000, 'initial screenshot should contain pixels');
    beforeProof = launched.capture;

    await core.handle({ action: 'click', selector: "button[data-players='1']" });
    await core.handle({ action: 'click', selector: "button[data-minutes='6']" });
    await core.handle({ action: 'click', selector: '#start-button' });
    await core.handle({ action: 'wait', ms: 700 });

    const before = await core.handle({ action: 'http', method: 'GET', path: '/api/adapter-observation?seat=p1' });
    assert.strictEqual(before.status, 200);
    assert.strictEqual(before.body.sessionActive, true, 'browser should push live observation state');
    const beforeX = before.body.players.p1.x;

    await core.handle({ action: 'key', code: 'KeyD', durationMs: 500 });
    await core.handle({ action: 'wait', ms: 250 });
    const after = await core.handle({ action: 'http', method: 'GET', path: '/api/adapter-observation?seat=p1' });
    assert.ok(after.body.players.p1.x > beforeX + 5, `Player 1 should move right (${beforeX} -> ${after.body.players.p1.x})`);

    const proof = await core.handle({ id: 'live-after', action: 'snapshot', capture: true });
    assert.ok(proof.accessibility.some(node => node.name === 'Brace Room play field'), 'accessibility tree should identify the game canvas');
    assert.ok(fs.statSync(proof.capture).size > 1000, 'settled screenshot should contain pixels');
    afterProof = proof.capture;

    if (process.env.AXM_KEEP_VISUAL_PROOF === '1') {
      const proofRoot = path.join(workshopRoot, 'state', 'ai-seat-courier', 'captures');
      fs.mkdirSync(proofRoot, { recursive: true });
      const keptBefore = path.join(proofRoot, 'live-selftest-before.png');
      const keptAfter = path.join(proofRoot, 'live-selftest-after.png');
      fs.copyFileSync(beforeProof, keptBefore);
      fs.copyFileSync(afterProof, keptAfter);
      console.log(`PROOF_BEFORE=${keptBefore}`);
      console.log(`PROOF_AFTER=${keptAfter}`);
    }

    console.log(`PASS live courier: launched, rendered, observed, moved, and captured ${beforeX} -> ${after.body.players.p1.x}`);
  } finally {
    await core.stopSession();
    fs.rmSync(tempRoot, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
  }
}

main().catch(error => {
  console.error('FAIL live courier');
  console.error(error);
  process.exit(1);
});
