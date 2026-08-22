'use strict';

const http = require('http');
const path = require('path');
const U = require('./operations-utils');
const DeterministicJson = require('../../tools/deterministic-json-core');

const SCHEMA = 'axm.qa-lab-state/v1';
const PHONE_OBSERVATION_SCHEMA = 'axm.qa-phone-observation/v1';
const PHONE_REVIEW_HANDOFF_SCHEMA = 'axm.qa-phone-review-handoff/v1';
const PHONE_REVIEW_ACTION_SCHEMA = 'axm.qa-phone-review-action/v1';
const PHONE_REVIEW_KIND = 'phone-qa-observation-candidate';
const PHONE_OBSERVATION_KEYS = [
  'physicalPhonePresent',
  'controllerJoined',
  'seatIdentityMatched',
  'actionObservedOnSharedScreen',
  'disconnectObserved',
  'recoveredAfterDisconnect'
];
const PHONE_OBSERVATION_LIMITATIONS = [
  'Checkboxes are human declarations, not machine proof of physical hardware.',
  'This candidate does not alter a game manifest or clear a verifier warning.',
  'Mike Tobi or an explicitly authorized steward must review the observed device and game behavior.'
];
const PROFILE_STEPS = {
  'hub-smoke': [
    { route: '/api/health', expectStatus: 200 },
    { route: '/hub/index.html', expectStatus: 200, contains: 'AXM Hub', inspectHtml: true },
    { route: '/api/tools', expectStatus: 200 }
  ],
  'operations-smoke': [
    { route: '/api/operations/status', expectStatus: 200 },
    { route: '/tools/diagnostics-operations-center/index.html', expectStatus: 200, contains: 'Diagnostics & Operations Center', inspectHtml: true },
    { route: '/tools/recovery-center/index.html', expectStatus: 200, contains: 'Recovery & Rollback Center', inspectHtml: true }
  ],
  'game-night-smoke': [
    { route: '/tools/game-hub/index.html', expectStatus: 200, contains: 'Game Hub', inspectHtml: true },
    { route: '/tools/game-hub/lobby-controller.html', expectStatus: 200, inspectHtml: true }
  ]
};

function exactObjectKeys(value, allowed, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(label + ' must be an object');
  const extras = Object.keys(value).filter(key => !allowed.includes(key));
  if (extras.length) throw new Error(label + ' has unknown fields: ' + extras.sort().join(', '));
}

function normalizePhoneObservation(input) {
  if (input == null) return null;
  exactObjectKeys(input, ['gameId', 'slot', 'voluntaryHumanObservation', 'observations'], 'phone observation');
  if (input.voluntaryHumanObservation !== true) throw new Error('phone observation requires explicit voluntary human confirmation');
  const gameId = String(input.gameId || '').trim().toLowerCase();
  const slot = String(input.slot || '').trim();
  if (!/^\d{3}-[a-z0-9][a-z0-9-]{0,95}$/.test(gameId)) throw new Error('phone observation game id must be a bounded slot/game id');
  if (!/^\d{3}$/.test(slot) || gameId.slice(0, 3) !== slot) throw new Error('phone observation slot must match the game id');
  exactObjectKeys(input.observations, PHONE_OBSERVATION_KEYS, 'phone observation values');
  const observations = {};
  PHONE_OBSERVATION_KEYS.forEach(key => {
    if (typeof input.observations[key] !== 'boolean') throw new Error('phone observation ' + key + ' must be boolean');
    observations[key] = input.observations[key];
  });
  const complete = PHONE_OBSERVATION_KEYS.every(key => observations[key] === true);
  return {
    schema: PHONE_OBSERVATION_SCHEMA,
    gameId,
    slot,
    observations,
    voluntaryHumanObservation: true,
    complete,
    reviewState: complete ? 'CANDIDATE_REQUIRES_HUMAN_REVIEW' : 'INCOMPLETE_CANDIDATE_REQUIRES_HUMAN_REVIEW',
    limitations: PHONE_OBSERVATION_LIMITATIONS.slice()
  };
}

function create(options) {
  const stateFile = path.join(options.stateRoot, 'browser-lan-hardware-qa', 'results.json');
  const auditFile = path.join(options.stateRoot, 'browser-lan-hardware-qa', 'audit.jsonl');
  const reviewService = options.reviewService || null;
  function read() { return U.loadJson(stateFile, { schema: SCHEMA, version: 1, journeys: [], deviceEvidence: [] }); }
  function write(state) { state.updatedAt = U.now(); U.atomicJson(stateFile, state); }
  function audit(event) { U.appendJsonl(auditFile, Object.assign({ at: U.now() }, event)); }
  function cleanRoute(value) {
    const route = String(value || '');
    if (!route.startsWith('/') || route.startsWith('//') || route.includes('..') || route.includes('\0') || route.length > 500) throw new Error('QA journey route must be a bounded Workshop-relative path');
    return route;
  }
  function normalizeSteps(input) {
    const source = typeof input === 'string' ? PROFILE_STEPS[input] : input;
    if (!Array.isArray(source) || !source.length || source.length > 24) throw new Error('QA journey needs 1 to 24 steps');
    return source.map(raw => ({ route: cleanRoute(raw.route), expectStatus: Math.max(100, Math.min(599, Number(raw.expectStatus) || 200)), contains: String(raw.contains || '').slice(0, 200), inspectHtml: raw.inspectHtml === true }));
  }
  function inspectHtml(text) {
    const findings = [];
    if (!/<html[^>]*\blang=["'][^"']+/i.test(text)) findings.push('html language is missing');
    if (!/<meta[^>]*name=["']viewport["']/i.test(text)) findings.push('viewport metadata is missing');
    if (!/<title>[^<]+<\/title>/i.test(text)) findings.push('document title is missing');
    if (!/<h1\b/i.test(text)) findings.push('primary heading is missing');
    const unnamedButtons = (text.match(/<button\b[^>]*>\s*<\/button>/gi) || []).length;
    if (unnamedButtons) findings.push(unnamedButtons + ' empty button(s) need an accessible name');
    return { pass: findings.length === 0, findings };
  }
  function request(originPort, step, timeoutMs) {
    return new Promise(resolve => {
      const started = Date.now();
      const req = http.get({ hostname: '127.0.0.1', port: originPort, path: step.route, timeout: timeoutMs, headers: { 'user-agent': 'AXM-QA-Lab/1.0', accept: 'text/html,application/json' } }, res => {
        const chunks = []; let bytes = 0, truncated = false;
        res.on('data', chunk => { if (bytes < 1024 * 1024) { chunks.push(chunk); bytes += chunk.length; } else truncated = true; });
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8'), checks = [];
          checks.push({ id: 'status', pass: res.statusCode === step.expectStatus, expected: step.expectStatus, actual: res.statusCode });
          if (step.contains) checks.push({ id: 'contains', pass: text.includes(step.contains), expected: step.contains });
          if (step.inspectHtml) checks.push(Object.assign({ id: 'html-accessibility-basics' }, inspectHtml(text)));
          resolve({ route: step.route, status: res.statusCode, durationMs: Date.now() - started, bytes, truncated, checks, pass: checks.every(x => x.pass) });
        });
      });
      req.on('timeout', () => req.destroy(new Error('timeout')));
      req.on('error', error => resolve({ route: step.route, durationMs: Date.now() - started, pass: false, error: error.message, checks: [{ id: 'request', pass: false, error: error.message }] }));
    });
  }
  async function run(input) {
    const body = input || {}, profile = String(body.profile || 'custom'), steps = normalizeSteps(PROFILE_STEPS[profile] ? profile : body.steps), port = Number(body.originPort || body.port);
    if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('QA journey needs the active Workshop port');
    const timeoutMs = Math.max(250, Math.min(10000, Number(body.timeoutMs) || 2500)), results = [];
    for (const step of steps) results.push(await request(port, step, timeoutMs));
    const receipt = { schema: 'axm.qa-journey-receipt/v1', id: U.uid('qa'), profile, actor: String(body.actor || 'local-user').slice(0, 120), startedAt: U.now(), origin: 'http://127.0.0.1:' + port, steps: results, pass: results.every(x => x.pass), totals: { steps: results.length, failures: results.filter(x => !x.pass).length, durationMs: results.reduce((n, x) => n + x.durationMs, 0) } };
    receipt.digest = U.sha256(JSON.stringify(receipt)); const state = read(); state.journeys.unshift(receipt); state.journeys = state.journeys.slice(0, 100); write(state); audit({ type: 'journey', id: receipt.id, profile, pass: receipt.pass, digest: receipt.digest }); return receipt;
  }
  function recordDeviceEvidence(input) {
    const body = input || {}, viewport = body.viewport || {}, samples = Array.isArray(body.latencyMs) ? body.latencyMs.map(Number).filter(Number.isFinite).slice(0, 100) : [];
    if (!Number.isFinite(Number(viewport.width)) || !Number.isFinite(Number(viewport.height))) throw new Error('device evidence needs viewport width and height');
    const gamepads = (Array.isArray(body.gamepads) ? body.gamepads : []).slice(0, 8).map(item => ({ index: Number(item.index), id: String(item.id || 'unnamed').slice(0, 160), mapping: String(item.mapping || '').slice(0, 40), axes: Math.max(0, Math.min(32, Number(item.axes) || 0)), buttons: Math.max(0, Math.min(64, Number(item.buttons) || 0)) }));
    const sorted = samples.slice().sort((a,b) => a-b), p95 = sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * .95))] : null;
    const phoneObservation = normalizePhoneObservation(body.phoneObservation);
    const receipt = { schema: 'axm.device-qa-evidence/v1', id: U.uid('device-qa'), capturedAt: U.now(), actor: String(body.actor || 'local-user').slice(0, 120), userAgent: String(body.userAgent || '').slice(0, 400), viewport: { width: Number(viewport.width), height: Number(viewport.height), devicePixelRatio: Number(viewport.devicePixelRatio) || 1 }, accessibility: { reducedMotion: !!body.reducedMotion, highContrast: !!body.highContrast }, gamepads, network: { samples, medianMs: sorted.length ? sorted[Math.floor(sorted.length / 2)] : null, p95Ms: p95, disconnectObserved: body.disconnectObserved === true, recoveredAfterDisconnect: body.recoveredAfterDisconnect === true }, longSession: { durationMs: Math.max(0, Math.min(24 * 60 * 60 * 1000, Number(body.sessionDurationMs) || 0)), errors: (Array.isArray(body.errors) ? body.errors : []).slice(0, 50).map(x => String(x).slice(0, 300)) }, truth: { hardwareEnumeratedByBrowser: true, rawInputStored: false, automaticPermissionChange: false, physicalHardwareProven: false, manifestMutated: false, externalReviewRequired: phoneObservation !== null } };
    if (phoneObservation) receipt.phoneObservation = phoneObservation;
    DeterministicJson.canonicalJson(receipt);
    receipt.digest = U.sha256(JSON.stringify(receipt));
    const state = read();
    state.deviceEvidence.unshift(receipt);
    state.deviceEvidence = state.deviceEvidence.slice(0, 100);
    DeterministicJson.canonicalJson(state);
    write(state);
    audit({ type: phoneObservation ? 'phone-observation-candidate' : 'device-evidence', id: receipt.id, gameId: phoneObservation ? phoneObservation.gameId : null, complete: phoneObservation ? phoneObservation.complete : null, gamepads: gamepads.length, digest: receipt.digest });
    return receipt;
  }

  function requireReviewService() {
    if (!reviewService || typeof reviewService.submit !== 'function' || typeof reviewService.list !== 'function') {
      throw new Error('phone candidate review requires the shared Review Inbox service');
    }
  }

  function boundedId(value, label) {
    const id = String(value || '').trim();
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,179}$/.test(id)) throw new Error(label + ' must be a bounded identifier');
    return id;
  }

  function phoneReceipt(evidenceId) {
    const id = boundedId(evidenceId, 'device evidence id');
    const receipt = read().deviceEvidence.find(item => item.id === id);
    if (!receipt) throw new Error('device evidence receipt not found');
    if (!receipt.phoneObservation || receipt.phoneObservation.schema !== PHONE_OBSERVATION_SCHEMA) {
      throw new Error('device evidence is not a phone observation candidate');
    }
    const digest = String(receipt.digest || '').toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(digest)) throw new Error('phone candidate digest is invalid');
    const payload = {};
    Object.keys(receipt).forEach(key => { if (key !== 'digest') payload[key] = receipt[key]; });
    if (U.sha256(JSON.stringify(payload)) !== digest) throw new Error('phone candidate native digest does not match its receipt');
    return receipt;
  }

  function phoneReviewSource(receipt) {
    return 'qa-device-evidence:' + receipt.id;
  }

  function phoneReviewAction(receipt) {
    const observation = receipt.phoneObservation;
    return {
      schema: PHONE_REVIEW_ACTION_SCHEMA,
      deviceEvidenceId: receipt.id,
      gameId: observation.gameId,
      slot: observation.slot,
      candidateDigest: 'sha256:' + receipt.digest,
      candidateComplete: observation.complete === true,
      physicalHardwareProven: false,
      warningClosureAuthorized: false,
      manifestMutationAuthorized: false
    };
  }

  function reviewReference(item) {
    return item ? {
      schema: 'axm.review-item/v1',
      id: item.id,
      kind: item.kind,
      state: item.state,
      artifactDigest: 'sha256:' + item.artifactDigest,
      sourceRef: item.sourceRef,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt
    } : null;
  }

  function assertReviewBinding(item, receipt) {
    if (!item || item.kind !== PHONE_REVIEW_KIND) throw new Error('review item kind does not match a phone QA candidate');
    if (item.sourceRef !== phoneReviewSource(receipt) || item.artifactDigest !== receipt.digest) {
      throw new Error('review item does not bind the exact phone candidate receipt');
    }
    if (item.requiredSeats !== 1) throw new Error('phone candidate review must require exactly one attributed seat');
    const expected = phoneReviewAction(receipt);
    exactObjectKeys(item.action, Object.keys(expected), 'phone review action');
    if (DeterministicJson.canonicalJson(item.action) !== DeterministicJson.canonicalJson(expected)) {
      throw new Error('phone review action does not match the exact candidate boundary');
    }
  }

  function baseHandoff(receipt, item, state, candidateReview) {
    return {
      schema: PHONE_REVIEW_HANDOFF_SCHEMA,
      state,
      deviceEvidence: {
        id: receipt.id,
        digest: 'sha256:' + receipt.digest,
        gameId: receipt.phoneObservation.gameId,
        slot: receipt.phoneObservation.slot,
        complete: receipt.phoneObservation.complete === true
      },
      reviewItem: reviewReference(item),
      candidateReview: candidateReview || null,
      truth: {
        voluntaryHumanDecisionRequired: true,
        humanIdentityAuthenticated: false,
        physicalHardwareProven: false,
        humanUsefulnessEstablished: false,
        warningCleared: false,
        manifestMutationAuthorized: false,
        rawReviewNotesIncluded: false,
        campaignWritePerformed: false
      }
    };
  }

  function openPhoneReview(input) {
    requireReviewService();
    exactObjectKeys(input, ['evidenceId'], 'phone review open input');
    const receipt = phoneReceipt(input.evidenceId);
    const observation = receipt.phoneObservation;
    const item = reviewService.submit({
      kind: PHONE_REVIEW_KIND,
      sourceRef: phoneReviewSource(receipt),
      artifactDigest: receipt.digest,
      title: 'Phone QA candidate · ' + observation.gameId,
      summary: (observation.complete ? 'Complete' : 'Incomplete') + ' structured observation candidate. Review the exact digest; this decision cannot prove hardware or clear a warning.',
      requiredSeats: 1,
      action: phoneReviewAction(receipt)
    });
    assertReviewBinding(item, receipt);
    audit({ type: 'phone-review-opened', evidenceId: receipt.id, reviewId: item.id, gameId: observation.gameId, digest: receipt.digest });
    return baseHandoff(receipt, item, 'PENDING_HUMAN_REVIEW', null);
  }

  function findPhoneReview(receipt, reviewId) {
    requireReviewService();
    const id = reviewId == null || reviewId === '' ? null : boundedId(reviewId, 'review id');
    const candidates = reviewService.list().filter(item => item.kind === PHONE_REVIEW_KIND && item.sourceRef === phoneReviewSource(receipt) && item.artifactDigest === receipt.digest);
    const item = id ? candidates.find(entry => entry.id === id) : candidates[0];
    if (id && !item) throw new Error('review item was not found for the exact phone candidate');
    return item || null;
  }

  function phoneReviewHandoff(input) {
    exactObjectKeys(input, ['evidenceId', 'reviewId'], 'phone review handoff input');
    const receipt = phoneReceipt(input.evidenceId);
    const item = findPhoneReview(receipt, input.reviewId);
    if (!item) return baseHandoff(receipt, null, 'REVIEW_NOT_OPENED', null);
    assertReviewBinding(item, receipt);
    if (['SUPERSEDED', 'REPAIR', 'CANCELLED', 'EXPIRED'].includes(item.state)) {
      return baseHandoff(receipt, item, 'REVIEW_NOT_EXPORTABLE', null);
    }
    const votes = Array.isArray(item.votes) ? item.votes : [];
    const latest = votes.length ? votes[votes.length - 1] : null;
    if (!latest) return baseHandoff(receipt, item, 'PENDING_HUMAN_REVIEW', null);
    if (latest.actorKind !== 'human' || latest.artifactDigest !== receipt.digest) {
      return baseHandoff(receipt, item, 'LATEST_DECISION_IS_NOT_A_HUMAN_EXACT_DIGEST_REVIEW', null);
    }
    let decision;
    if (latest.verdict === 'REJECT') decision = 'REJECT';
    else if (latest.verdict === 'HOLD' || receipt.phoneObservation.complete !== true) decision = 'INCOMPLETE';
    else if (latest.verdict === 'APPROVE') decision = 'ACCEPT_FOR_SEPARATE_GAME_REVIEW';
    else throw new Error('phone review verdict is unsupported');
    const candidateReview = {
      gameId: receipt.phoneObservation.gameId,
      candidateDigest: 'sha256:' + receipt.digest,
      decision,
      reviewedAt: latest.at,
      voluntaryHumanReview: true
    };
    return baseHandoff(receipt, item, 'READY_FOR_VOLUNTARY_PHONE_QA_CAMPAIGN_INPUT', candidateReview);
  }

  function status() {
    const state = read();
    const latestPhone = state.deviceEvidence.find(item => item.phoneObservation) || null;
    let latestPhoneReviewHandoff = null;
    if (latestPhone && reviewService) {
      try { latestPhoneReviewHandoff = phoneReviewHandoff({ evidenceId: latestPhone.id, reviewId: null }); }
      catch (error) { latestPhoneReviewHandoff = { schema: PHONE_REVIEW_HANDOFF_SCHEMA, state: 'REVIEW_HANDOFF_INVALID', error: error.message }; }
    }
    return { schema: SCHEMA, profiles: Object.keys(PROFILE_STEPS), journeys: state.journeys, deviceEvidence: state.deviceEvidence, latestJourney: state.journeys[0] || null, latestDeviceEvidence: state.deviceEvidence[0] || null, latestPhoneReviewHandoff, arbitraryUrlTesting: false, hardwarePermissionAuthority: false };
  }
  return { status, run, recordDeviceEvidence, openPhoneReview, phoneReviewHandoff, normalizeSteps, inspectHtml, stateFile, auditFile };
}

module.exports = { SCHEMA, PROFILE_STEPS, PHONE_OBSERVATION_SCHEMA, PHONE_OBSERVATION_KEYS, PHONE_REVIEW_HANDOFF_SCHEMA, PHONE_REVIEW_ACTION_SCHEMA, PHONE_REVIEW_KIND, normalizePhoneObservation, create };
