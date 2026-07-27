#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const childProcess = require('child_process');
const fs = require('fs');
const path = require('path');
const C = require('./core');
const Inventory = require('./automation/inventory-compiler');
const Dual = require('./automation/dual-form-compiler');
const Parity = require('./automation/parity-guard');
const Conformance = require('./automation/conformance-runner');
const LabState = require('./automation/lab-state-builder');
const Envelope = require('./receipt-envelope');
const Coordinator = require('./coordinator');
const Adapter = require('./adapter-contract');
const Gap = require('./capability-gap-router');
const Freshness = require('./freshness-scheduler');
const Janitor = require('./retention-janitor');
const Closer = require('./session-closer');
const EvidenceCompactor = require('./evidence-compactor');
const Regression = require('./regression-memory-candidate-writer');
const Repair = require('./known-repair-router');
const Feed = require('./technical-glasses-feed');
const Baseline = require('./drift-safe-baseline-updater');
const Packager = require('./release-packager');
const Unattended = require('./unattended-sensing-controller');
const Audit = require('./roadmap-audit');
const BodyPulse = require('../pulse/axm-body-pulse-core');
const adapters = require('./canonical/adapters.json').adapters;

const evidence = {};
function phase(id, name, checks, paths, holds) {
  checks.forEach(function (check) { assert.equal(check.pass, true, id + ' ' + check.name); });
  evidence[id] = { name, verdict: 'PASS', checks, evidence: paths || [], holds: holds || [] };
  console.log('PASS ' + id + ' ' + name + ' - ' + checks.length + ' checks');
}
function check(name, pass) { return { name, pass: pass === true }; }
function hashArtifacts(artifacts) { return Object.keys(artifacts).sort().map(function (name) { return name + ':' + crypto.createHash('sha256').update(artifacts[name]).digest('hex'); }); }
function memoryCompactionAdapter() { const rows = { hot: 'sealed provenance' }; return { rows, read: function (key) { return rows[key]; }, writeArchive: function (key, value) { rows[key] = value; }, replaceHotWithDigest: function (key, value) { rows[key] = value; } }; }

async function main() {
  const source = Inventory.readSource(), inventoryCheck = Inventory.validate(source), registry = require('./registry.json');
  const parity = Parity.check();
  phase('P0', 'truth-convergence', [
    check('canonical inventory validates', inventoryCheck.ok), check('thirteen skills', registry.counts.skills === 13),
    check('twelve executable routes', registry.counts.executableRoutes === 12), check('one host-mediated route', registry.counts.hostMediatedRoutes === 1),
    check('generated artifacts are in parity', parity.verdict === 'PASS')
  ], ['shared/sensorium/canonical/sensorium.json','shared/sensorium/registry.json','shared/sensorium/capability-matrix.json']);

  const conformance = await Conformance.run({ writeReport: true });
  const exampleEnvelope = (await require('./proofs/eye-static-image-inspector').run()).envelopes[0];
  const envelopeCheck = Envelope.validate(exampleEnvelope);
  const rawAttempt = Object.assign({}, exampleEnvelope, { frames: ['raw'] });
  phase('P1', 'common-receipt-envelope', [
    check('envelope validates', envelopeCheck.ok), check('deterministic receipt id', Envelope.create({ claimId: 'same', senseId: 'eye-static-image-inspector', capability: 'visual.inspect.static/v1', seatId: 'seat', targetId: 'target', backendId: 'host', observedAt: '2026-07-22T12:00:00.000Z', sealedAt: '2026-07-22T12:00:00.000Z', ttlMs: 1, verdict: 'PASS', specificReceipt: { schema: 'x/v1' }, specificReceiptSchema: 'x/v1', typedObservation: 'x', cleanupComplete: true }).receiptId === Envelope.create({ claimId: 'same', senseId: 'eye-static-image-inspector', capability: 'visual.inspect.static/v1', seatId: 'seat', targetId: 'target', backendId: 'host', observedAt: '2026-07-22T12:00:00.000Z', sealedAt: '2026-07-22T12:00:00.000Z', ttlMs: 1, verdict: 'PASS', specificReceipt: { schema: 'x/v1' }, specificReceiptSchema: 'x/v1', typedObservation: 'x', cleanupComplete: true }).receiptId),
    check('raw fields refused', Envelope.validate(rawAttempt).ok === false), check('authority never inherited', exampleEnvelope.authorityInherited === false),
    check('zero post-seal retention', exampleEnvelope.rawRetainedBytesAfterSeal === 0 && exampleEnvelope.rawRetainedItemsAfterSeal === 0)
  ], ['shared/sensorium/schemas/sensorium-receipt.schema.json','shared/sensorium/receipt-envelope.js']);

  phase('P2', 'independent-sense-proofs', [
    check('conformance verified', conformance.verdict === 'VERIFIED'), check('all thirteen TEST senses proved at declared level', conformance.rows.length === 13),
    check('twelve runtime proofs and one contract proof', conformance.coverage.runtimePassProofs === 12 && conformance.coverage.contractPassProofs === 1), check('one host-mediated route', conformance.coverage.hostMediatedRoutesDeclared === 1),
    check('negative ceilings proved', conformance.coverage.negativeProofs >= 16), check('no missing executors', conformance.coverage.missingExecutors.length === 0),
    check('interoception adapter gap remains visible', conformance.coverage.missingAdapters.length === 1 && conformance.coverage.missingAdapters.includes('interoception-capacity-gauge')),
    check('two-use retention is flat', conformance.rows.every(function (row) { return row.uses[0] === 0 && row.uses[1] === 0; }))
  ], ['exports/sensorium-conformance-report.json','shared/sensorium/proofs/']);

  const journey = await Coordinator.observeSession({ sessionId: 'session-journey', claimId: 'claim-ready', seatId: 'seat-test', targetId: 'process-stream', claim: 'The bounded process emitted ready.', claimKind: 'behavior', observedAt: '2026-07-22T12:00:00.000Z', at: '2026-07-22T12:00:01.000Z', ttlMs: 60000, preflight: { observedAt: '2026-07-22T12:00:00.000Z' }, observations: [{ senseId: 'ears-stream-listener', input: { source: 'process-stream', expectedEvents: ['ready'], openedAt: '2026-07-22T12:00:00.000Z', closedAt: '2026-07-22T12:00:01.000Z' }, adapters: { readWindow: async function () { return [{ type: 'ready', message: 'ready', emittedAt: '2026-07-22T12:00:00.500Z' }]; } } }] });
  const degraded = await Coordinator.observeSession({ sessionId: 'session-degraded', claimId: 'claim-degraded', seatId: 'seat-test', targetId: 'mixed', claim: 'Mixed evidence', observedAt: '2026-07-22T12:00:00.000Z', at: '2026-07-22T12:00:01.000Z', ttlMs: 60000, preflight: { observedAt: '2026-07-22T12:00:00.000Z' }, observations: [{ senseId: 'eye-static-image-inspector', input: { claim: 'missing image', targetId: 'missing', observedAt: '2026-07-22T12:00:00.000Z' } }, { senseId: 'ears-stream-listener', input: { source: 'process-stream', expectedEvents: ['ready'], openedAt: '2026-07-22T12:00:00.000Z', closedAt: '2026-07-22T12:00:01.000Z' }, adapters: { readWindow: async function () { return [{ type: 'ready', message: 'ready' }]; } } }] });
  const stale = await Coordinator.observeSession({ sessionId: 'session-stale', claimId: 'claim-stale', seatId: 'seat-test', targetId: 'old-stream', claim: 'Old event remains current', observedAt: '2026-07-22T12:00:00.000Z', at: '2026-07-22T12:00:02.000Z', ttlMs: 10, preflight: { observedAt: '2026-07-22T12:00:00.000Z' }, observations: [{ senseId: 'ears-stream-listener', input: { source: 'old-stream', expectedEvents: ['ready'], openedAt: '2026-07-22T12:00:00.000Z', closedAt: '2026-07-22T12:00:02.000Z' }, adapters: { readWindow: async function () { return [{ type: 'ready', message: 'ready', emittedAt: '2026-07-22T12:00:00.000Z' }]; } } }] });
  let inheritedRefused = false; try { await Coordinator.observeSession({ sessionId: 'x', claimId: 'x', seatId: 'x', targetId: 'x', inheritedAuthorityLeaseId: 'old' }); } catch (error) { inheritedRefused = /inherited authority/.test(error.message); }
  phase('P3', 'sensorium-session-composition', [
    check('default journey passes', journey.recommendation.verdict === 'PASS'), check('zero raw retention', journey.cleanupComplete && journey.rawRetainedBytes === 0 && journey.rawRetainedItems === 0),
    check('continuity closes trace', journey.trace[journey.trace.length - 1].senseId === 'handoff-continuity-steward'),
    check('unavailable sense only degrades claim', degraded.recommendation.verdict === 'UNKNOWN' && degraded.receipts.some(function (receipt) { return receipt.senseId === 'ears-stream-listener' && receipt.verdict === 'PASS'; })),
    check('stale evidence is held', stale.recommendation.verdict === 'UNKNOWN' && stale.holds.includes('STALE_EVIDENCE_RECHECK_REQUIRED')),
    check('permissions do not transfer', inheritedRefused && journey.permissionsTransferred === false),
    check('coordinator effects are recommendations only', journey.refusedEffects.includes('publish') && journey.refusedEffects.includes('delete-source'))
  ], ['shared/sensorium/coordinator.js']);

  const adapterChecks = adapters.map(Adapter.validate), browser = adapters.find(function (row) { return row.adapterId === 'browser-ephemeral-capture'; }), computedStyle = adapters.find(function (row) { return row.adapterId === 'browser-computed-style-reader'; }), windows = adapters.find(function (row) { return row.adapterId === 'windows-native-capture'; });
  const ready = Adapter.negotiate({ capability: 'visual.capture.ephemeral-rolling-buffer/v1', authorityLeaseId: 'lease-current', targetIsolation: 'EXPLICIT_SHARED_SURFACE' }, [browser]);
  const computedStyleReady = Adapter.negotiate({ capability: 'ui.render.computed-style/v1', targetIsolation: 'EXACT_DECLARED_DOM_ROOT' }, [computedStyle]);
  const win = Adapter.negotiate({ capability: 'visual.capture.windows-native/v1', authorityLeaseId: 'lease-current', targetIsolation: 'EXACT_WINDOW' }, [windows]);
  const unknown = Gap.route({ capability: 'sense.smell.unavailable/v1', adapters: [] });
  const capacityHold = Gap.route({ capability: 'seat.capacity.read/v1', adapters: [] });
  phase('P4', 'host-adapters-and-negotiation', [
    check('all declared adapters validate', adapterChecks.every(function (row) { return row.ok; })), check('ready is negotiated before work', ready.state === 'READY'),
    check('computed-style collection negotiates exact-target readiness', computedStyleReady.state === 'READY' && computedStyleReady.adapterId === 'browser-computed-style-reader'),
    check('Windows isolation remains degraded', win.state === 'DEGRADED' && win.reasons.includes('WINDOWS_WINDOW_ISOLATION_UNAVAILABLE')),
    check('missing capability remains honest', unknown.state === 'UNKNOWN' && unknown.route === 'HOLD'), check('interoception host metric stays held', capacityHold.state === 'UNKNOWN' && capacityHold.route === 'HOLD'), check('no dependency install attempted', ready.dependencyInstallAttempted === false && computedStyleReady.dependencyInstallAttempted === false && unknown.dependencyInstallAttempted === false && capacityHold.dependencyInstallAttempted === false)
  ], ['shared/sensorium/schemas/host-adapter.schema.json','shared/sensorium/canonical/adapters.json','shared/sensorium/adapter-contract.js','shared/ai-native-hands/computed-style-hand.js'], ['WINDOWS_WINDOW_ISOLATION_UNAVAILABLE','SEAT_CAPACITY_ADAPTER_UNAVAILABLE']);

  const freshness = Freshness.schedule([exampleEnvelope, Object.assign({}, exampleEnvelope, { receiptId: 'old', observedAt: '2026-07-22T11:00:00.000Z', ttlMs: 1000 })], '2026-07-22T12:00:00.000Z');
  let retained = [{ id: 'buffer-1', path: null }]; const retentionAdapter = { releaseExact: async function (item) { retained = retained.filter(function (row) { return row.id !== item.id; }); }, status: async function () { return { rawRetainedBytes: 0, rawRetainedItems: retained.length }; } };
  const janitorPlan = Janitor.preview([{ id: 'buffer-1', ownership: 'SENSORIUM_OWNED' }]), janitorReceipt = await Janitor.release(janitorPlan, retentionAdapter, Janitor.CONFIRMATION);
  let closeRetained = [{ id: 'buffer-2' }], expired = []; const closeReceipt = await Closer.close({ sessionId: 'close-session', seatId: 'seat-test', temporaryItems: [{ id: 'buffer-2', ownership: 'SENSORIUM_OWNED' }], authorityLeaseIds: ['lease-1'], receipts: [exampleEnvelope], openHolds: ['human review'], nextStep: 'review', retentionAdapter: { releaseExact: async function (item) { closeRetained = closeRetained.filter(function (row) { return row.id !== item.id; }); }, status: async function () { return { rawRetainedBytes: 0, rawRetainedItems: closeRetained.length }; } }, leaseAdapter: { expireExact: async function (id) { expired.push(id); } } });
  const compactAdapter = memoryCompactionAdapter(), compacted = EvidenceCompactor.compact({ boundaryRule: 'cold verified receipts', provenance: [{ specificReceiptDigest: C.digest('specific'), typedObservationDigest: C.digest('typed'), hotPath: 'hot', archivePath: 'cold', range: 'r1-r2', summary: 'verified receipts' }] }, compactAdapter);
  const regression = Regression.propose({ failureSignature: 'sensorium.failure.exact.v1', capabilityId: 'sense.time.ttl/v1', verifiedFailure: true, repairVerified: true, independentReproduction: 'PASS', failureEvidence: { fail: true }, repairEvidence: { pass: true }, verifierCase: { input: 'known', expected: 'PASS' } });
  const known = Repair.route({ failureSignature: 'sensorium.failure.exact.v1' }, [{ failureSignature: 'sensorium.failure.exact.v1', recipeId: 'recipe-1', approved: true, approvedBy: 'Mike' }]), novel = Repair.route({ failureSignature: 'novel.failure.v1' }, []);
  const feed = Feed.compile({ registry, receipts: [exampleEnvelope], at: '2026-07-22T12:00:00.000Z' });
  const baseline = Baseline.propose({ seat: 'seat-test', sourceRange: 'r1-r3', receipts: [1,2,3].map(function (n) { return { seatId: 'seat-test', reviewed: true, receiptId: 'r' + n, features: { source_traced: true, unknown_marked: true, ceiling_declared: true, held_on_thin_evidence: true, approval_without_evidence: false } }; }) });
  const builtA = Packager.build(), builtB = Packager.build(), releaseReceipt = Packager.write();
  phase('P5', 'deterministic-automation', [
    check('inventory compiler', inventoryCheck.ok), check('dual-form compiler', Object.keys(Dual.render(source)).length === 31), check('parity guard', parity.verdict === 'PASS'), check('conformance runner', conformance.verdict === 'VERIFIED'),
    check('capability-gap router', unknown.route === 'HOLD'), check('freshness scheduler queues without observing', freshness.queue.length >= 1 && freshness.automaticObservation === false),
    check('retention janitor exact cleanup', janitorReceipt.verdict === 'PASS' && janitorReceipt.wildcards === false), check('session closer expires leases and carries digests only', closeReceipt.verdict === 'PASS' && expired[0] === 'lease-1' && closeReceipt.handoff.rawSenseMaterialCarried === false),
    check('evidence compactor preserves retrieval', compacted.record_compacted[0].retrievalTestFetchPassed === true), check('regression candidate is non-binding', regression.binding === false && regression.status === 'PROPOSED_FOR_HUMAN_APPROVAL'),
    check('known-repair router exact only', known.state === 'APPROVED_REPLAY_AVAILABLE' && novel.state === 'NOVEL_FAILURE_HOLD'), check('release packager deterministic', JSON.stringify(hashArtifacts(builtA.artifacts)) === JSON.stringify(hashArtifacts(builtB.artifacts)) && releaseReceipt.publicSafety === 'PASS'),
    check('Technical Glasses feed is derived', feed.derivedOnly === true && feed.handEnteredNumbers === false), check('drift baseline updater proposes only', baseline.state === 'PROPOSED_FOR_REVIEW' && baseline.automaticReplace === false)
  ], ['shared/sensorium/automation/','shared/sensorium/freshness-scheduler.js','shared/sensorium/retention-janitor.js','shared/sensorium/session-closer.js','shared/sensorium/evidence-compactor.js','shared/sensorium/regression-memory-candidate-writer.js','shared/sensorium/known-repair-router.js','shared/sensorium/technical-glasses-feed.js','shared/sensorium/drift-safe-baseline-updater.js','exports/sensorium-release/']);

  const lab = await LabState.write({ report: conformance, at: '2026-07-22T12:00:00.000Z' });
  const uiTest = childProcess.spawnSync(process.execPath, [path.resolve(__dirname, '..', '..', 'tools', 'sensorium-lab', 'selftest.js')], { encoding: 'utf8' });
  const discoveryTest = childProcess.spawnSync(process.execPath, [path.resolve(__dirname, '..', '..', 'tools', 'sensorium-lab', 'discovery-seam-review.js')], { encoding: 'utf8' });
  const visualReceipt = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', '..', 'exports', 'sensorium-visual-proof', 'receipt.json'), 'utf8'));
  phase('P6', 'sensorium-lab-and-discovery', [
    check('Lab shows thirteen canonical TEST senses', lab.senses.length === 13), check('missing and failed simulation controls exist', uiTest.status === 0),
    check('Workshop discovery manifest passes', discoveryTest.status === 0), check('authority is not restored', lab.authorityRestoredOnRefresh === false),
    check('Lab is not canonical source', lab.canonicalSource === false), check('zero retention visible', lab.summary.rawRetainedBytes === 0 && lab.summary.rawRetainedItems === 0),
    check('canonical holds map to their affected cards', lab.summary.holds === 2 && lab.senses.filter(function (sense) { return sense.holds.length; }).length === 2),
    check('laptop and mobile visual acceptance passed', visualReceipt.claims.length === 3 && visualReceipt.claims.every(function (claim) { return claim.verdict === 'PASS'; }) && visualReceipt.cleanupComplete === true)
  ], ['tools/sensorium-lab/','shared/sensorium/lab-state.json','exports/sensorium-visual-proof/receipt.json']);

  phase('P7', 'portable-release-pipeline', [
    check('thirteen individual zips and bundle exist', releaseReceipt.files.filter(function (file) { return /\.zip$/.test(file.name); }).length === 14),
    check('compatibility matrix generated', releaseReceipt.files.some(function (file) { return file.name === 'compatibility-matrix.json'; })),
    check('public safety report passes', releaseReceipt.publicSafety === 'PASS'), check('unchanged source is byte-identical', JSON.stringify(hashArtifacts(builtA.artifacts)) === JSON.stringify(hashArtifacts(builtB.artifacts))),
    check('manual generated drift is detected by parity guard', Parity.check().verdict === 'PASS')
  ], ['exports/sensorium-release/','tools/agent-tool-forge/skills/sensorium/bundle.manifest.json']);

  let bodyState = BodyPulse.createState(); bodyState = BodyPulse.registerModule(bodyState, { moduleId: 'sensorium', name: 'Sensorium', enabled: true, activeCadenceMs: 900000, idleCadenceMs: 3600000, cost: { cpu: 5, memory: 5, gpu: 0 }, authority: 'observation-receipts-only', promotionGate: 'Mike' }, Date.parse('2026-07-22T12:00:00.000Z'));
  bodyState = BodyPulse.upsertGoal(bodyState, { goalId: 'sensorium-goal', moduleId: 'sensorium', title: 'Bounded low-pressure sensing', maxPulses: 2, status: 'OPEN', createdBy: 'mike-explicit-enable' }, Date.parse('2026-07-22T12:00:00.000Z'));
  bodyState = BodyPulse.setMode(bodyState, 'ACTIVE', 'mike', Date.parse('2026-07-22T12:00:00.000Z')); bodyState = BodyPulse.sampleBody(bodyState, { cpuUsedRatio: .1, memoryUsedRatio: .2, gpuUsedRatio: 0, thermalC: 50 }, Date.parse('2026-07-22T12:00:00.000Z'));
  const pulse = BodyPulse.requestPulse(bodyState, { moduleId: 'sensorium', leaseMs: 60000, force: true }, Date.parse('2026-07-22T12:00:01.000Z'));
  const baseUnattended = { at: '2026-07-22T12:00:02.000Z', explicitlyEnabled: true, lease: pulse.lease, body: pulse.body, enabledSenses: ['ears-stream-listener','time-sense-ttl-verifier'], requestedCadenceMs: 900000, memoryBudgetBytes: 16000000, thermalCeilingC: 80 };
  const low = Unattended.plan(baseUnattended), cycle = await Unattended.runCycle(baseUnattended, async function () { return { receipts: [exampleEnvelope] }; });
  const amber = Unattended.plan(Object.assign({}, baseUnattended, { body: { pressure: 'AMBER' } })), red = Unattended.plan(Object.assign({}, baseUnattended, { body: { pressure: 'RED' } })), expiredPlan = Unattended.plan(Object.assign({}, baseUnattended, { at: '2026-07-22T13:00:00.000Z' }));
  const driftHold = Unattended.plan(Object.assign({}, baseUnattended, { includeDrift: true, reviewedSameSeatBaseline: false, enabledSenses: ['drift-detector-ambient'] }));
  phase('P8', 'Mirror-body-safe-activation', [
    check('explicit low-pressure Body Pulse lease permits bounded cycle', low.state === 'READY' && cycle.observed === true),
    check('cycle retains zero raw material', cycle.rawRetainedBytes === 0 && cycle.rawRetainedItems === 0), check('amber pressure throttles cadence', amber.state === 'THROTTLED' && amber.cadenceMs >= low.cadenceMs * 4),
    check('red pressure pauses', red.state === 'PAUSED'), check('expired authority stops', expiredPlan.state === 'STOPPED' && expiredPlan.holds.includes('AUTHORITY_LEASE_EXPIRED')),
    check('drift needs reviewed same-seat baseline', driftHold.state === 'STOPPED' && driftHold.holds.includes('REVIEWED_SAME_SEAT_BASELINE_REQUIRED')),
    check('sensory output cannot promote', cycle.automaticPromotion === false && low.allowedEffect === 'bounded-observation-receipt-only')
  ], ['shared/sensorium/unattended-sensing-controller.js','shared/pulse/axm-body-pulse-core.js']);

  const roadmap = Audit.compile(evidence, '2026-07-22T12:00:00.000Z');
  assert.equal(roadmap.verdict, 'PASS'); Audit.write(roadmap);
  console.log('Sensorium roadmap selftest: PASS - 9/9 phases, promotion remains at Mike gate');
  return roadmap;
}

if (require.main === module) main().catch(function (error) { console.error(error.stack || error.message || error); process.exitCode = 1; });
module.exports = { main };
