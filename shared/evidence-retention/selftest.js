'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const Retention = require('./evidence-retention-service');

let checks = 0;
function check(condition, message) { if (!condition) throw new Error('FAIL ' + message); checks++; console.log('PASS ' + message); }
function writeJson(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', 'utf8'); }

(function run() {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-evidence-retention-'));
  const workshop = path.join(temp, 'workshop'), stateRoot = path.join(workshop, 'state'), source = path.join(stateRoot, 'asset-filesystem-service', 'audit.jsonl');
  try {
    fs.mkdirSync(path.dirname(source), { recursive: true });
    fs.writeFileSync(source, JSON.stringify({ type:'indexed', at:'2026-01-01T00:00:00.000Z', assetCount:1 }) + '\n', 'utf8');
    const legacyBytes = fs.statSync(source).size, manager = Retention.forStateRoot(stateRoot, { limits:{ maxEvents:100, maxBytes:1024 * 1024 } });
    check(manager.status().legacySources === 1, 'existing JSONL evidence is registered as sealed legacy truth without migration');
    for (let index = 0; index < 30; index++) manager.record(source, { type:'indexed', at:new Date(2026, 0, 2, 0, 0, index).toISOString(), assetCount:index + 2 });
    manager.record(source, { type:'vote', at:'2026-01-02T01:00:00.000Z', actor:'Mike', verdict:'APPROVE', digest:'a'.repeat(64) });
    manager.record(source, { type:'render-preview', at:'2026-01-02T01:01:00.000Z', id:'preview-one', pass:true });
    const active = manager.status();
    check(fs.statSync(source).size === legacyBytes, 'the original legacy file stays byte-for-byte unchanged');
    check(active.telemetry.observations === 30 && active.telemetry.buckets === 1, 'repeated indexing observations become one counted telemetry rollup');
    check(active.currentSession.events === 2 && active.currentSession.summary.PERMANENT_EXACT === 1 && active.currentSession.summary.SESSION_EXACT === 1, 'consequential and meaningful work stay exact in the active session');
    const tail = manager.tailForSource(source, 100000);
    check(tail.includes('"type":"vote"') && tail.includes('"count":30'), 'machine-readable tails combine sealed legacy, exact session events, and telemetry summaries');
    const sealed = manager.seal('selftest');
    check(sealed.sealed && /^[a-f0-9]{64}$/.test(sealed.manifest.segmentSha256) && sealed.manifest.lastEventHash, 'session close produces a hash-chained sealed segment and manifest');
    check(manager.status().sealedSessions === 1 && manager.status().currentSession === null, 'sealed sessions remain discoverable without keeping an open writer');

    const packages = path.join(workshop, 'exports', 'workshop-packages');
    for (const item of [{ id:'axm-workshop-full-new', at:'2026-07-19T05:00:00.000Z' }, { id:'axm-workshop-full-old', at:'2026-07-18T05:00:00.000Z' }]) {
      writeJson(path.join(packages, item.id, 'PACKAGE_MANIFEST.json'), { schema:'axm.workshop-package/v1', created_at:item.at, total_bytes:1000, file_count:1, files:[] });
      fs.writeFileSync(path.join(packages, item.id + '.zip'), Buffer.alloc(100));
    }
    const plan = manager.packageRetentionPlan();
    check(plan.policy.mode === 'PREVIEW_ONLY' && plan.policy.automaticDeletion === false, 'package retention is visible but cannot silently delete existing artifacts');
    check(plan.keep.includes('axm-workshop-full-new') && plan.review.some(item => item.id === 'axm-workshop-full-old'), 'package plan keeps the latest unpacked copy and names older copies for review');
    console.log('\nEvidence retention selftest: PASS (' + checks + ' checks)');
  } finally {
    Retention.resetForTests(); fs.rmSync(temp, { recursive:true, force:true });
  }
})()

