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

    const closureStateRoot = path.join(workshop, 'closure-state'), closureDirectory = path.join(closureStateRoot, 'simulated-run');
    const closureFiles = ['current', 'removed', 'corrupted', 'summary-replaced'].map(name => path.join(closureDirectory, name + '.jsonl'));
    fs.mkdirSync(closureDirectory, { recursive:true });
    for (const file of closureFiles) fs.writeFileSync(file, JSON.stringify({ type:'raw-output', id:path.basename(file), payload:'full evidence' }) + '\n', 'utf8');
    const closureManager = Retention.create({ stateRoot:closureStateRoot, limits:{ maxSourceClosureItems:10 } });
    const closureBefore = closureManager.verifySources(closureFiles);
    check(closureBefore.state === 'CURRENT' && closureBefore.counts.CURRENT === 4, 'registered raw outputs verify against their original byte identities before mutation');
    fs.unlinkSync(closureFiles[1]);
    fs.writeFileSync(closureFiles[2], '{"type":"raw-output","payload":', 'utf8');
    fs.writeFileSync(closureFiles[3], JSON.stringify({ type:'summary', count:1 }) + '\n', 'utf8');
    const closureAfter = closureManager.verifySources(closureFiles), closureStates = Object.fromEntries(closureAfter.results.map(result => [path.basename(result.source), result.state]));
    check(closureAfter.state === 'HELD' && closureAfter.hold === true, 'registered-source closure holds when any raw output is no longer exact');
    check(closureStates['removed.jsonl'] === 'MISSING' && closureStates['corrupted.jsonl'] === 'CHANGED' && closureStates['summary-replaced.jsonl'] === 'CHANGED', 'removed, corrupted, and summary-replaced raw outputs remain distinct from current evidence');
    check(closureManager.verifySource(path.join(closureDirectory, 'never-registered.jsonl')).state === 'UNKNOWN_SOURCE', 'an undeclared output cannot inherit registered-source identity');
    check(closureManager.verifySource(closureFiles[0]).state === 'CURRENT', 'an unchanged raw output remains current after sibling failures');

    const repeatStateRoot = path.join(workshop, 'repeat-state'), repeatSource = path.join(repeatStateRoot, 'runtime', 'events.jsonl'), repeatManager = Retention.create({ stateRoot:repeatStateRoot, limits:{ maxEvents:100, maxBytes:1024 * 1024 } });
    const firstFailure = repeatManager.record(repeatSource, { type:'workshop-error', at:'2026-01-02T00:00:00.000Z', message:'renderer timeout at stable boundary' });
    let repeatedFailure = null;
    for (let index = 1; index <= 9; index++) repeatedFailure = repeatManager.record(repeatSource, { type:'workshop-error', at:'2026-01-02T00:' + String(index).padStart(2, '0') + ':00.000Z', message:'renderer timeout at stable boundary' });
    const changedFailure = repeatManager.record(repeatSource, { type:'workshop-error', at:'2026-01-02T00:10:00.000Z', message:'renderer timeout at a different boundary' });
    const checkpointFailure = repeatManager.record(repeatSource, { type:'workshop-error', at:'2026-01-03T00:01:00.000Z', message:'renderer timeout at stable boundary' });
    const resolution = repeatManager.record(repeatSource, { type:'workshop-recovered', at:'2026-01-03T00:02:00.000Z', message:'renderer timeout cleared' });
    const repeatStatus = repeatManager.status(), repeatTail = repeatManager.tailForSource(repeatSource, 100000);
    check(firstFailure.evidenceClass === 'PERMANENT_EXACT' && repeatedFailure.evidenceClass === 'REPETITIVE_DURABLE_ROLLUP' && repeatedFailure.summarizedRepeats === 9, 'the first durable failure stays exact while nine unchanged repeats become one counted rollup');
    check(changedFailure.evidenceClass === 'PERMANENT_EXACT' && checkpointFailure.evidenceClass === 'PERMANENT_EXACT' && checkpointFailure.repeatCheckpoint, 'a changed failure and the bounded 24-hour reminder remain exact');
    check(resolution.evidenceClass === 'PERMANENT_EXACT', 'a recovery or resolution event remains exact');
    check(repeatStatus.currentSession.events === 4 && repeatStatus.repetition.occurrences === 12 && repeatStatus.repetition.exactCheckpoints === 3 && repeatStatus.repetition.summarizedRepeats === 9, 'repeat status exposes exact checkpoints and summarized occurrence totals without duplicate session events');
    check(repeatTail.includes('"evidenceClass":"REPETITIVE_DURABLE_ROLLUP"') && repeatTail.includes('"summarizedRepeats":9'), 'diagnostic tails expose compact repeat evidence beside exact records');
    const repeatSeal = repeatManager.seal('repeat-rollup-test');
    const restartedRepeatManager = Retention.create({ stateRoot:repeatStateRoot, limits:{ maxEvents:100, maxBytes:1024 * 1024 } }), afterRestart = restartedRepeatManager.record(repeatSource, { type:'workshop-error', at:'2026-01-03T00:30:00.000Z', message:'renderer timeout at stable boundary' });
    check(repeatSeal.manifest.events === 4 && afterRestart.evidenceClass === 'REPETITIVE_DURABLE_ROLLUP' && afterRestart.summarizedRepeats === 10, 'repeat knowledge survives sealing and a fresh manager restart');
    const keyedFirst = restartedRepeatManager.record(repeatSource, { type:'provider-failure', at:'2026-01-03T01:00:00.000Z', message:'request 101 failed', retention:{ repeatable:true, repeatKey:'provider-request-failure' } }), keyedRepeat = restartedRepeatManager.record(repeatSource, { type:'provider-failure', at:'2026-01-03T01:01:00.000Z', message:'request 102 failed', retention:{ repeatable:true, repeatKey:'provider-request-failure' } });
    check(keyedFirst.evidenceClass === 'PERMANENT_EXACT' && keyedRepeat.evidenceClass === 'REPETITIVE_DURABLE_ROLLUP', 'modules can reuse a stable repeat key when volatile request identifiers differ');
    restartedRepeatManager.seal('repeat-rollup-restart-test');

    const activeSource = path.join(stateRoot, 'active-writer', 'events.jsonl'), activeWriter = Retention.create({ stateRoot, limits:{ maxEvents:100, maxBytes:1024 * 1024 } });
    activeWriter.record(activeSource, { type:'vote', at:'2026-01-03T01:00:00.000Z', verdict:'KEEP_OPEN' });
    const activeSegment = fs.readdirSync(path.join(stateRoot, 'evidence-retention', 'sessions', 'open')).find(name => name.endsWith('.jsonl'));
    const competingManager = Retention.create({ stateRoot, limits:{ maxEvents:100, maxBytes:1024 * 1024 } });
    check(fs.existsSync(path.join(stateRoot, 'evidence-retention', 'sessions', 'open', activeSegment)), 'a competing process cannot recover a session whose writer is still active');
    activeWriter.record(activeSource, { type:'render-preview', at:'2026-01-03T01:01:00.000Z', pass:true });
    const activeSeal = activeWriter.seal('active-writer-test');
    check(activeSeal.sealed && activeSeal.manifest.events === 2, 'the protected active writer can finish and seal its complete chain');

    const splitWriter = Retention.create({ stateRoot, limits:{ maxEvents:100, maxBytes:1024 * 1024 } });
    splitWriter.record(activeSource, { type:'vote', at:'2026-01-04T01:00:00.000Z', verdict:'FIRST_HALF' });
    const splitName = fs.readdirSync(path.join(stateRoot, 'evidence-retention', 'sessions', 'open')).find(name => name.endsWith('.jsonl'));
    const splitFile = path.join(stateRoot, 'evidence-retention', 'sessions', 'open', splitName), splitLease = splitFile + '.writer.json';
    const staleWriter = JSON.parse(fs.readFileSync(splitLease, 'utf8')); staleWriter.pid = 2147483647; writeJson(splitLease, staleWriter);
    Retention.create({ stateRoot, limits:{ maxEvents:100, maxBytes:1024 * 1024 } });
    splitWriter.record(activeSource, { type:'render-preview', at:'2026-01-04T01:01:00.000Z', pass:true });
    Retention.create({ stateRoot, limits:{ maxEvents:100, maxBytes:1024 * 1024 } });
    const splitManifests = fs.readdirSync(path.join(stateRoot, 'evidence-retention', 'sessions', 'sealed', '2026-01')).filter(name => name.startsWith(splitName.replace(/\.jsonl$/, '')) && name.endsWith('.manifest.json')).map(name => JSON.parse(fs.readFileSync(path.join(stateRoot, 'evidence-retention', 'sessions', 'sealed', '2026-01', name), 'utf8')));
    const preservedSplitFiles = fs.readdirSync(path.join(stateRoot, 'evidence-retention', 'sessions', 'superseded', '2026-01')).filter(name => name.startsWith(splitName.replace(/\.jsonl$/, '')) && name.endsWith('.jsonl'));
    check(splitManifests.length === 1 && splitManifests[0].sealReason === 'consolidated-split-session' && splitManifests[0].events === 2, 'a split but cryptographically anchored session is consolidated into one canonical sealed chain');
    check(preservedSplitFiles.length === 2, 'both original split halves remain preserved in the superseded repair archive');
    check(!fs.existsSync(splitFile), 'the recovered continuation no longer remains in the open-session startup path');

    const corruptFile = path.join(stateRoot, 'evidence-retention', 'sessions', 'open', 'session-corrupt.jsonl');
    fs.writeFileSync(corruptFile, '{"incomplete":', 'utf8');
    Retention.create({ stateRoot, limits:{ maxEvents:100, maxBytes:1024 * 1024 } });
    check(!fs.existsSync(corruptFile) && fs.readdirSync(path.join(stateRoot, 'evidence-retention', 'sessions', 'quarantine')).some(name => name === 'session-corrupt.jsonl'), 'an untrusted broken segment is preserved in quarantine instead of blocking startup');

    const packages = path.join(workshop, 'exports', 'workshop-packages');
    for (const item of [{ id:'axm-workshop-full-new', at:'2026-07-19T05:00:00.000Z' }, { id:'axm-workshop-full-old', at:'2026-07-18T05:00:00.000Z' }]) {
      writeJson(path.join(packages, item.id, 'PACKAGE_MANIFEST.json'), { schema:'axm.workshop-package/v1', created_at:item.at, total_bytes:1000, file_count:1, files:[] });
      fs.writeFileSync(path.join(packages, item.id + '.zip'), Buffer.alloc(100));
    }
    const plan = manager.packageRetentionPlan();
    check(plan.policy.mode === 'PREVIEW_ONLY' && plan.policy.automaticDeletion === false, 'package retention is visible but cannot silently delete existing artifacts');
    check(plan.keep.includes('axm-workshop-full-new') && plan.review.some(item => item.id === 'axm-workshop-full-old'), 'package plan keeps the latest unpacked copy and names older copies for review');
    competingManager.seal('selftest-cleanup');
    console.log('\nEvidence retention selftest: PASS (' + checks + ' checks)');
  } finally {
    Retention.resetForTests(); fs.rmSync(temp, { recursive:true, force:true });
  }
})()
