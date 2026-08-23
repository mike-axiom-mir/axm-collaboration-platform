'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Base = require('./deterministic-game-trailer-planner-v1');
const Adventure = require('./deterministic-adventure-content-generator-v1');
const Replay = require('../../tools/game-hub/game-library/020-four-roots-adventure/runtime/deterministic-journey');

const VERSION = '1.0.0';
const REQUEST_SCHEMA = 'axm.gameplay-trailer-generation-request/v1';
const PLAN_SCHEMA = 'axm.gameplay-trailer-plan/v1';
const PLAN_ID = 'four-roots-adventure-gameplay-trailer-v0.2';
const ROOTS = Adventure.ROOTS.slice();
const GAME_ROOT = Base.GAME_ROOT;
const CONTENT_REF = Object.freeze({ ...Replay.EXPECTED_CONTENT });
const ENGINE_REF = Object.freeze({ ...Replay.EXPECTED_ENGINE });
const MANIFEST_REF = Object.freeze({
  id: '020-four-roots-adventure',
  schema: 'game.manifest.json',
  path: Base.MANIFEST_PATH,
  sha256: 'sha256:810a9b6e1fa617a7bf02f746ba12f2a3792fc6ce3a81de82c1da5ff2d5d3f65e',
  byteLength: 5867
});
const OUTPUT_PATHS = Object.freeze([
  'media/rendered/four-roots-adventure-trailer.mp4',
  'media/rendered/four-roots-adventure-trailer.webm',
  'media/rendered/four-roots-adventure-trailer.vtt',
  'media/rendered/trailer-plan.json',
  'media/rendered/gameplay-replay.json',
  'media/rendered/sparse-sequence.json',
  'media/rendered/verification-receipt.json',
  'media/rendered/proof-first.png',
  'media/rendered/proof-middle.png',
  'media/rendered/proof-last.png'
]);
const DIGEST = /^sha256:[0-9a-f]{64}$/;
const ID = /^[a-z0-9][a-z0-9._-]{1,127}$/;

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function canonical(value) { return Adventure.canonical(value); }
function same(left, right) { return canonical(left) === canonical(right); }
function hashBytes(value) { return 'sha256:' + crypto.createHash('sha256').update(value).digest('hex'); }
function hashValue(value) { return hashBytes(Buffer.from(canonical(value), 'utf8')); }
function object(value, label) { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(label + ' must be an object'); return value; }
function exact(value, keys, label) { object(value, label); if (!same(Object.keys(value).sort(), keys.slice().sort())) throw new Error(label + ' fields are not closed'); }
function text(value, label, max) { if (typeof value !== 'string' || value.trim() !== value || value.length < 1 || value.length > max || /[\u0000-\u001f\u007f]/.test(value)) throw new Error(label + ' must be bounded text'); return value; }
function id(value, label) { value = text(value, label, 128); if (!ID.test(value)) throw new Error(label + ' must be a portable id'); return value; }
function digest(value, label) { if (typeof value !== 'string' || !DIGEST.test(value)) throw new Error(label + ' must be a SHA-256 digest'); return value; }
function portablePath(value, label) { return Base.portablePath(value, label); }
function normalizedFile(file) { return Buffer.from(fs.readFileSync(file, 'utf8').replace(/\r\n?/g, '\n'), 'utf8'); }
function ref(value, label) {
  exact(value, ['id', 'schema', 'path', 'sha256', 'byteLength'], label);
  if (!Number.isSafeInteger(value.byteLength) || value.byteLength < 1 || value.byteLength > 262144) throw new Error(label + '.byteLength is invalid');
  return { id: id(value.id, label + '.id'), schema: text(value.schema, label + '.schema', 180), path: portablePath(value.path, label + '.path'), sha256: digest(value.sha256, label + '.sha256'), byteLength: value.byteLength };
}
function normalizeRoots(values) {
  if (!Array.isArray(values) || values.length !== 4) throw new Error('rootsGate requires exactly four roots');
  return values.map((entry, index) => {
    exact(entry, ['root', 'verdict', 'evidenceRefs'], 'rootsGate[' + index + ']');
    if (entry.root !== ROOTS[index] || entry.verdict !== 'PASS') throw new Error('ROOTS_GATE_HOLD:' + ROOTS[index]);
    if (!Array.isArray(entry.evidenceRefs) || entry.evidenceRefs.length < 1 || entry.evidenceRefs.length > 8) throw new Error('root evidence is required');
    return { root: entry.root, verdict: 'PASS', evidenceRefs: entry.evidenceRefs.map((item) => {
      exact(item, ['id', 'schema', 'sha256'], 'root evidence');
      return { id: id(item.id, 'root evidence id'), schema: text(item.schema, 'root evidence schema', 180), sha256: digest(item.sha256, 'root evidence digest') };
    }) };
  });
}

function sealRequest(value) {
  exact(value, ['schema', 'id', 'goal', 'gameContentRef', 'gameManifestRef', 'gameEngineRef', 'outputProfile', 'replayPolicy', 'rootsGate', 'marketingPolicy', 'resources', 'rights', 'hostDecision', 'authority'], 'gameplay trailer request');
  if (value.schema !== REQUEST_SCHEMA || value.authority !== 'NONE') throw new Error('gameplay trailer request identity or authority drift');
  const gameContentRef = ref(value.gameContentRef, 'gameContentRef');
  const gameManifestRef = ref(value.gameManifestRef, 'gameManifestRef');
  const gameEngineRef = ref(value.gameEngineRef, 'gameEngineRef');
  if (!same(gameContentRef, CONTENT_REF) || !same(gameManifestRef, MANIFEST_REF) || !same(gameEngineRef, ENGINE_REF)) throw new Error('gameplay trailer source reference drift');
  exact(value.outputProfile, ['width', 'height', 'frameRate', 'durationSeconds', 'samples', 'uniqueFrames', 'formats', 'audio', 'captions'], 'outputProfile');
  const profile = { width: 640, height: 360, frameRate: 12, durationSeconds: 30, samples: 360, uniqueFrames: 48, formats: ['video/mp4', 'video/webm'], audio: false, captions: true };
  if (!same(value.outputProfile, profile)) throw new Error('gameplay trailer output profile drift');
  exact(value.replayPolicy, ['mode', 'browserCapture', 'livePlayerInput', 'maxActions', 'maxCheckpoints'], 'replayPolicy');
  if (!same(value.replayPolicy, { mode: 'DETERMINISTIC_NATIVE_ENGINE_RECONSTRUCTION', browserCapture: false, livePlayerInput: false, maxActions: 256, maxCheckpoints: 40 })) throw new Error('gameplay replay policy drift');
  exact(value.marketingPolicy, ['claimsOnlyFromEvidence', 'fakeReviewQuotes', 'universalBest', 'publicAvailability', 'canon'], 'marketingPolicy');
  if (!same(value.marketingPolicy, { claimsOnlyFromEvidence: true, fakeReviewQuotes: false, universalBest: false, publicAvailability: false, canon: false })) throw new Error('gameplay marketing policy inflation');
  exact(value.resources, ['maxInputBytes', 'maxPlanBytes', 'maxReplayBytes', 'maxUniqueFrameBytes', 'maxEncodedOutputBytes', 'maxFiles', 'maxChildProcesses', 'maxNetworkRequests'], 'resources');
  const resources = value.resources;
  if (!Number.isSafeInteger(resources.maxInputBytes) || resources.maxInputBytes < CONTENT_REF.byteLength + MANIFEST_REF.byteLength + ENGINE_REF.byteLength || resources.maxInputBytes > 131072 ||
      !Number.isSafeInteger(resources.maxPlanBytes) || resources.maxPlanBytes < 1 || resources.maxPlanBytes > 131072 || resources.maxReplayBytes !== 262144 ||
      resources.maxUniqueFrameBytes !== 44236800 || !Number.isSafeInteger(resources.maxEncodedOutputBytes) || resources.maxEncodedOutputBytes < 1 || resources.maxEncodedOutputBytes > 52428800 ||
      resources.maxFiles !== 10 || resources.maxChildProcesses !== 0 || resources.maxNetworkRequests !== 0) throw new Error('gameplay trailer resource envelope drift');
  exact(value.rights, ['internalWorkshopReview', 'publicDistribution'], 'rights');
  if (!same(value.rights, { internalWorkshopReview: 'MIKE_AUTHORIZED_TEST', publicDistribution: 'HOLD' })) throw new Error('gameplay trailer rights drift');
  exact(value.hostDecision, ['source', 'authenticatedIdentityProven', 'planAuthorized', 'replayAuthorized', 'renderAuthorized', 'publishAuthorized'], 'hostDecision');
  if (!same(value.hostDecision, { source: 'EXPLICIT_IN_THREAD_DIRECTION', authenticatedIdentityProven: false, planAuthorized: true, replayAuthorized: true, renderAuthorized: true, publishAuthorized: false })) throw new Error('gameplay trailer host decision drift');
  const core = {
    schema: REQUEST_SCHEMA, id: id(value.id, 'request.id'), goal: text(value.goal, 'request.goal', 600), gameContentRef, gameManifestRef, gameEngineRef,
    outputProfile: clone(value.outputProfile), replayPolicy: clone(value.replayPolicy), rootsGate: normalizeRoots(value.rootsGate), marketingPolicy: clone(value.marketingPolicy),
    resources: clone(value.resources), rights: clone(value.rights), hostDecision: clone(value.hostDecision), authority: 'NONE'
  };
  return { ...core, requestDigest: hashValue(core) };
}
function normalizeRequest(value) {
  exact(value, ['schema', 'id', 'goal', 'gameContentRef', 'gameManifestRef', 'gameEngineRef', 'outputProfile', 'replayPolicy', 'rootsGate', 'marketingPolicy', 'resources', 'rights', 'hostDecision', 'authority', 'requestDigest'], 'gameplay trailer request');
  const { requestDigest, ...core } = value, sealed = sealRequest(core);
  if (requestDigest !== sealed.requestDigest || !same(value, sealed)) throw new Error('gameplay trailer request digest or canonical form mismatch');
  return sealed;
}

function loadSources() {
  const contentFile = path.resolve(__dirname, '..', '..', CONTENT_REF.path);
  const manifestFile = path.resolve(__dirname, '..', '..', MANIFEST_REF.path);
  const engineFile = path.resolve(__dirname, '..', '..', ENGINE_REF.path);
  const contentBytes = normalizedFile(contentFile), manifestBytes = normalizedFile(manifestFile), engineBytes = normalizedFile(engineFile);
  for (const [bytes, expected, label] of [[contentBytes, CONTENT_REF, 'content'], [manifestBytes, MANIFEST_REF, 'manifest'], [engineBytes, ENGINE_REF, 'engine']]) {
    if (hashBytes(bytes) !== expected.sha256 || bytes.length !== expected.byteLength) throw new Error('gameplay trailer ' + label + ' bytes drift');
  }
  const content = Adventure.validateContent(JSON.parse(contentBytes.toString('utf8')));
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  const media = manifest.media?.trailer;
  if (manifest.game_id !== '020-four-roots-adventure' || manifest.version !== '0.2.2' || !String(manifest.status).startsWith('TEST') || manifest.rules.runtime_internet_required !== false || manifest.rules.outbound_network_allowed !== false || manifest.rules.simulation_authority !== 'server') throw new Error('gameplay trailer manifest truth drift');
  if (!media || media.status !== 'TEST' || media.version !== '0.2.0' || media.footage_mode !== 'deterministic-native-engine-reconstruction' || media.gameplay_replay !== true || media.browser_capture !== false || media.live_player_input !== false || media.ai_used !== false || media.outbound_network_used !== false || media.public_distribution !== 'HOLD' || media.publish_authority !== false) throw new Error('gameplay trailer media declaration drift');
  return { content, manifest, contentBytes, manifestBytes, engineBytes };
}

function claim(idValue, textValue, evidenceRefs) { return { id: idValue, text: text(textValue, 'claim.text', 180), status: 'PROVEN_FROM_EXACT_SOURCE', evidenceRefs: evidenceRefs.map(clone) }; }
function cue(index, textValue) { const start = index * 5, end = (index + 1) * 5, stamp = (seconds) => '00:00:' + String(seconds).padStart(2, '0') + '.000'; return { index, startFrame: index * 60, endFrame: (index + 1) * 60, start: stamp(start), end: stamp(end), text: textValue }; }
function scene(idValue, index, kind, headline, subline, accent, claimIds, mode, checkpoints, zoneIds) {
  return { id: idValue, index, startFrame: index * 60, endFrame: (index + 1) * 60, kind, headline, subline, accent, claimIds, visual: { mode, checkpointIds: checkpoints.map((entry) => entry.id), zoneIds: zoneIds.slice(), footageLabel: mode === 'title-card' ? 'TITLE CARD' : 'DETERMINISTIC REPLAY - NOT SCREEN CAPTURE' } };
}

function plan(input) {
  const request = normalizeRequest(input), source = loadSources();
  const replayBuild = Replay.build(source.content, CONTENT_REF.sha256), replay = replayBuild.record;
  const contentRef = clone(CONTENT_REF), manifestRef = clone(MANIFEST_REF), engineRef = clone(ENGINE_REF);
  const replayFileBytes = Buffer.from(JSON.stringify(replay, null, 2) + '\n', 'utf8');
  const replayRef = { id: replay.id, schema: replay.schema, path: 'tools/game-hub/game-library/020-four-roots-adventure/media/rendered/gameplay-replay.json', sha256: hashBytes(replayFileBytes), byteLength: replayFileBytes.length };
  const points = (sceneIndex) => replay.checkpoints.filter((entry) => entry.sceneIndex === sceneIndex);
  const claims = [
    claim('local-test-adventure', 'A LOCAL WORKSHOP TEST ADVENTURE', [manifestRef]),
    claim('deterministic-gameplay-replay', 'FOOTAGE RECONSTRUCTED FROM THE EXACT NATIVE TEST ENGINE', [contentRef, engineRef, replayRef]),
    claim('five-connected-zones', 'REPLAY VISITS 5 CONNECTED ZONES', [replayRef]),
    claim('six-quests', 'REPLAY COMPLETES 6 QUESTS', [replayRef]),
    claim('ten-discoveries', 'REPLAY FINDS 10 DISCOVERIES', [replayRef]),
    claim('four-ordered-roots', 'REPLAY CARRIES 4 ROOTS IN ORDER', [replayRef]),
    claim('keyboard-pointer-controls', 'MOVE WITH WASD OR ARROWS. INTERACT WITH E OR SPACE.', [manifestRef]),
    claim('server-resume', 'THE EXACT TEST SAVE CAN RESUME AFTER RESTART.', [manifestRef]),
    claim('offline-native', 'NO AI KEY OR INTERNET REQUIRED.', [manifestRef])
  ];
  const scenes = [
    scene('opening', 0, 'title', 'FOUR ROOTS ADVENTURE', 'NOW WITH DETERMINISTIC REPLAY FOOTAGE', '#58e6ff', ['local-test-adventure', 'offline-native'], 'title-card', [], []),
    scene('crossroads-replay', 1, 'gameplay', 'WORKSHOP CROSSROADS', 'MOVE. MEET. CHOOSE.', '#ffcc66', ['keyboard-pointer-controls', 'deterministic-gameplay-replay'], 'gameplay-replay', points(1), ['crossroads']),
    scene('truth-replay', 2, 'gameplay', 'TRUTH HOLLOW', 'TWO WITNESSES. ONE GROUNDED CLAIM.', '#58e6ff', ['four-ordered-roots', 'deterministic-gameplay-replay'], 'gameplay-replay', points(2), ['truth-hollow']),
    scene('agency-replay', 3, 'gameplay', 'AGENCY GARDEN', 'OPEN EVERY LANTERN WITHOUT CHOOSING FOR IT.', '#ffcc66', ['four-ordered-roots', 'deterministic-gameplay-replay'], 'gameplay-replay', points(3), ['agency-garden']),
    scene('continuity-wisdom-replay', 4, 'gameplay', 'CONTINUITY / WISDOM', 'REPAIR THE BRIDGE. TAKE THE LONG LOOK.', '#8df0a8', ['five-connected-zones', 'six-quests', 'ten-discoveries'], 'gameplay-replay', points(4), ['continuity-archive', 'wisdom-grove']),
    scene('ending-replay', 5, 'gameplay', 'A DOOR INTO REVIEW', 'PLAY. QUESTION. REPAIR. DECIDE.', '#d8a8ff', ['four-ordered-roots', 'server-resume'], 'gameplay-replay', points(5), ['crossroads'])
  ];
  const captions = [
    cue(0, 'Four Roots Adventure. Now with deterministic replay footage from the local TEST engine.'),
    cue(1, 'At the Workshop Crossroads, move with WASD or arrows and interact with E or Space.'),
    cue(2, 'The replay enters Truth Hollow and keeps two witnesses separate before carrying the first root.'),
    cue(3, 'In Agency Garden, every lantern opens without choosing for another.'),
    cue(4, 'The replay repairs Continuity, takes the long look for Wisdom, and visits all five zones.'),
    cue(5, 'After six quests, ten discoveries, and four ordered roots, the replay reaches A Door Into Review.')
  ];
  const core = {
    schema: PLAN_SCHEMA, version: VERSION, status: 'TEST_PLAN', id: PLAN_ID,
    requestRef: { id: request.id, schema: request.schema, sha256: request.requestDigest }, sourceRefs: [contentRef, manifestRef, engineRef], replayRef,
    profile: clone(request.outputProfile), claims, scenes, captions, outputPaths: OUTPUT_PATHS.slice(),
    resources: { inputBytes: source.contentBytes.length + source.manifestBytes.length + source.engineBytes.length, planBytes: 0, replayBytes: replayBuild.recordBytes, uniqueFrameBytes: 44236800, actions: replay.summary.actions, checkpoints: replay.checkpoints.length, samples: 360, files: 10, childProcesses: 0, networkRequests: 0, enforced: true },
    rights: clone(request.rights),
    limitations: [
      'Gameplay images are reconstructed from exact deterministic engine states; they are not browser screen capture or live player input.',
      'Silent video; tutorial and marketing copy are on-screen and in companion captions.',
      'MP4 uses bounded Motion JPEG; WebM uses VP8 all-keyframes.',
      'The trailer does not by itself prove live input feel, persistence, performance, accessibility, or human taste.',
      'Internal Workshop TEST only; public distribution remains HOLD.'
    ],
    truth: { deterministicPlan: true, claimsEvidenceBound: true, nativeGameEngineExecuted: true, replayReconstructed: true, browserCapture: false, livePlayerInput: false, providerCalled: false, aiUsed: false, videoRendered: false, playabilityProvenByTrailer: false, published: false, canonChanged: false },
    authority: 'NONE'
  };
  for (let iteration = 0; iteration < 4; iteration += 1) {
    const measured = Buffer.byteLength(canonical(core), 'utf8');
    if (measured === core.resources.planBytes) break;
    core.resources.planBytes = measured;
  }
  if (core.resources.inputBytes > request.resources.maxInputBytes || core.resources.planBytes > request.resources.maxPlanBytes || core.resources.replayBytes > request.resources.maxReplayBytes) throw new Error('gameplay trailer planning byte budget exceeded');
  return { request, plan: { ...core, planDigest: hashValue(core) }, replay };
}
function verify(result, input) { try { return same(result, plan(input)) ? { pass: true, errors: [] } : { pass: false, errors: ['gameplay trailer result differs from deterministic rebuild'] }; } catch (error) { return { pass: false, errors: [error.message] }; } }
function buildExampleRequest() {
  return sealRequest({
    schema: REQUEST_SCHEMA, id: 'four-roots-adventure-gameplay-trailer-request-v0.2',
    goal: 'Create one silent captioned TEST trailer that shows reconstructed states from the exact deterministic Four Roots game engine while keeping every claim, limit, and authority boundary visible.',
    gameContentRef: clone(CONTENT_REF), gameManifestRef: clone(MANIFEST_REF), gameEngineRef: clone(ENGINE_REF),
    outputProfile: { width: 640, height: 360, frameRate: 12, durationSeconds: 30, samples: 360, uniqueFrames: 48, formats: ['video/mp4', 'video/webm'], audio: false, captions: true },
    replayPolicy: { mode: 'DETERMINISTIC_NATIVE_ENGINE_RECONSTRUCTION', browserCapture: false, livePlayerInput: false, maxActions: 256, maxCheckpoints: 40 },
    rootsGate: ROOTS.map((root) => ({ root, verdict: 'PASS', evidenceRefs: [{ id: 'four-roots-gameplay-trailer-' + root, schema: 'axm.four-root-technical-review/v1', sha256: hashValue('four-roots-gameplay-trailer-v0.2:' + root) }] })),
    marketingPolicy: { claimsOnlyFromEvidence: true, fakeReviewQuotes: false, universalBest: false, publicAvailability: false, canon: false },
    resources: { maxInputBytes: 131072, maxPlanBytes: 131072, maxReplayBytes: 262144, maxUniqueFrameBytes: 44236800, maxEncodedOutputBytes: 52428800, maxFiles: 10, maxChildProcesses: 0, maxNetworkRequests: 0 },
    rights: { internalWorkshopReview: 'MIKE_AUTHORIZED_TEST', publicDistribution: 'HOLD' },
    hostDecision: { source: 'EXPLICIT_IN_THREAD_DIRECTION', authenticatedIdentityProven: false, planAuthorized: true, replayAuthorized: true, renderAuthorized: true, publishAuthorized: false },
    authority: 'NONE'
  });
}

module.exports = {
  VERSION, REQUEST_SCHEMA, PLAN_SCHEMA, PLAN_ID, ROOTS, GAME_ROOT, CONTENT_REF, MANIFEST_REF, ENGINE_REF, OUTPUT_PATHS,
  clone, canonical, hashBytes, hashValue, portablePath, sealRequest, normalizeRequest, loadSources, plan, verify, buildExampleRequest
};
