'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const childProcess = require('child_process');
const Handoff = require('../handoff-continuity-steward');
const ExactStore = require('../storage/exact-jsonl-store');
const Runtime = require('../runtime-route');

async function run() {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-sensorium-continuity-'));
  const file = path.join(temp, 'handoff.jsonl');
  try {
    const store = ExactStore.create({ ownedRoot: temp, file, writeAuthorized: true });
    const handoff = Handoff.create({ store });
    const record = handoff.write({ workLine: 'proof', turnId: 'turn-1', seat: 'seat-test', accessReread: true, verifiedFacts: [{ summary: 'fact', digest: 'abc', age: 'LIVE' }], assumedFacts: [], openHolds: [{ summary: 'recheck stale fact' }], decisions: [], nextStep: 'continue', chainIntact: true, at: '2026-07-22T12:00:00.000Z' });
    assert.equal(record.raw_sense_material_carried, false); assert.equal(record.access_state_reread_from_gates, true);
    const script = "const S=require(" + JSON.stringify(path.resolve(__dirname, '..', 'storage', 'exact-jsonl-store.js')) + ");const s=S.create({ownedRoot:" + JSON.stringify(temp) + ",file:" + JSON.stringify(file) + ",writeAuthorized:false});process.stdout.write(JSON.stringify(s.latest()));";
    const fresh = JSON.parse(childProcess.execFileSync(process.execPath, ['-e', script], { encoding: 'utf8' }));
    assert.equal(fresh.digest, record.digest); assert.equal(fresh.raw_sense_material_carried, false);
    const broken = Handoff.create().write({ workLine: 'proof', turnId: 'turn-broken', seat: 'seat-test', accessReread: false, chainIntact: false });
    assert.equal(broken.chain_intact, false); assert.equal(broken.access_state_reread_from_gates, false);
    async function use(n) { return Runtime.invoke('handoff-continuity-steward', { workLine: 'route', turnId: 'turn-' + n, seat: 'seat-test', accessReread: true, chainIntact: true, nextStep: 'continue', at: '2026-07-22T12:00:00.000Z' }, { claimId: 'claim-handoff-' + n, seatId: 'seat-test', targetId: 'handoff-line', adapters: { continuityStore: store } }); }
    const first = await use(1), second = await use(2);
    return { senseId: 'handoff-continuity-steward', verdict: 'PASS', positive: record, negative: [broken], envelopes: [first.envelope, second.envelope], uses: [0, 0], rawRetainedBytes: 0, rawRetainedItems: 0, freshProcessDigestMatch: true };
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
}

module.exports = { run };
