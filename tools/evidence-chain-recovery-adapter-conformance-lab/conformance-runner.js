#!/usr/bin/env node
'use strict';

const Core = require('./evidence-chain-recovery-adapter-conformance-core');
const Inspector = require('../evidence-chain-inspector/evidence-chain-core');

const PREVIEW_SCHEMA = 'axm.evidence-chain-reviewed-recovery-preview/v1';
const APPLICATION_SCHEMA = 'axm.evidence-chain-reviewed-recovery-application-receipt/v1';
const INSPECTION_SCHEMA = 'axm.evidence-chain-recovery-adapter-fixture-inspection/v1';
const ROLLBACK_PREVIEW_SCHEMA = 'axm.evidence-chain-reviewed-recovery-rollback-preview/v1';
const ROLLBACK_SCHEMA = 'axm.evidence-chain-reviewed-recovery-rollback-receipt/v1';
const AUDIT_SCHEMA = 'axm.evidence-chain-recovery-adapter-fixture-audit/v1';
const FORBIDDEN_KEYS = new Set(['targetpath', 'filepath', 'filename', 'payload', 'raw', 'rawline', 'rawbytes', 'sourcebytes', 'candidatebytes', 'actor', 'identity', 'token', 'secret', 'authorizationheader']);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function validHash(value) { return Core.HASH_PATTERN.test(String(value || '')); }

function assertPrivate(value, source, candidate, label) {
  function walk(item) {
    if (!item || typeof item !== 'object') return;
    Object.keys(item).forEach(key => {
      if (FORBIDDEN_KEYS.has(key.toLowerCase())) throw new Error(label + ' exposes forbidden field ' + key);
      walk(item[key]);
    });
  }
  walk(value);
  const serialized = JSON.stringify(value);
  if (String(source).length >= 24 && serialized.includes(String(source))) throw new Error(label + ' exposes source bytes');
  if (String(candidate).length >= 24 && serialized.includes(String(candidate))) throw new Error(label + ' exposes candidate bytes');
}

async function expectCode(action, code) {
  let observed = null;
  try { await action(); }
  catch (error) { observed = error; }
  if (!observed) throw new Error('adapter accepted a probe that must refuse with ' + code);
  if (observed.code !== code) throw new Error('adapter returned ' + String(observed.code || 'UNTYPED_ERROR') + ' instead of ' + code);
}

function validateInspection(item, expectedSha256, source, candidate) {
  assertPrivate(item, source, candidate, 'fixture inspection');
  assert(item && item.schema === INSPECTION_SCHEMA && item.fixtureOnly === true, 'fixture inspection identity mismatch');
  assert(item.sha256 === expectedSha256 && validHash(item.sha256), 'fixture inspection digest mismatch');
}

function validatePreview(item, probe, nowMs, profile, source, candidate) {
  assertPrivate(item, source, candidate, 'fixture preview');
  assert(item && item.schema === PREVIEW_SCHEMA && item.state === 'PREVIEWED' && item.eligible === true && item.fixtureOnly === true, 'fixture preview identity mismatch');
  assert(item.permission === 'GRANTED' && item.planId === probe.planId, 'fixture preview permission or plan binding mismatch');
  assert(item.sourceSha256 === probe.sourceSha256 && item.candidateSha256 === probe.candidateSha256, 'fixture preview digest binding mismatch');
  const created = Date.parse(item.createdAt), expires = Date.parse(item.expiresAt);
  assert(Number.isFinite(created) && Number.isFinite(expires) && created === nowMs, 'fixture preview creation time mismatch');
  assert(expires - created === profile.previewTtlSeconds * 1000, 'fixture preview TTL mismatch');
  assert(typeof item.id === 'string' && item.id.length >= 12, 'fixture preview id is missing');
}

function validateApplication(item, preview, probe, source, candidate) {
  assertPrivate(item, source, candidate, 'fixture application receipt');
  assert(item && item.schema === APPLICATION_SCHEMA && item.state === 'APPLIED' && item.fixtureOnly === true, 'fixture application receipt identity mismatch');
  assert(item.previewId === preview.id && item.planId === probe.planId, 'fixture application receipt lineage mismatch');
  assert(item.sourceSha256 === probe.sourceSha256 && item.candidateSha256 === probe.candidateSha256 && item.safetyCopySha256 === probe.sourceSha256, 'fixture application receipt digest mismatch');
  assert(typeof item.applicationId === 'string' && item.applicationId.length >= 12, 'fixture application id is missing');
}

function validateRollbackPreview(item, application, probe, source, candidate) {
  assertPrivate(item, source, candidate, 'fixture rollback preview');
  assert(item && item.schema === ROLLBACK_PREVIEW_SCHEMA && item.state === 'PREVIEWED' && item.eligible === true && item.fixtureOnly === true, 'fixture rollback preview identity mismatch');
  assert(item.applicationId === application.applicationId && item.currentSha256 === probe.candidateSha256 && item.restoreSha256 === probe.sourceSha256, 'fixture rollback preview lineage mismatch');
  assert(typeof item.id === 'string' && item.id.length >= 12, 'fixture rollback preview id is missing');
}

function validateRollback(item, rollbackPreview, application, probe, source, candidate) {
  assertPrivate(item, source, candidate, 'fixture rollback receipt');
  assert(item && item.schema === ROLLBACK_SCHEMA && item.state === 'ROLLED_BACK' && item.fixtureOnly === true, 'fixture rollback receipt identity mismatch');
  assert(item.rollbackPreviewId === rollbackPreview.id && item.applicationId === application.applicationId, 'fixture rollback receipt lineage mismatch');
  assert(item.restoredSha256 === probe.sourceSha256 && item.safetyCopySha256 === probe.candidateSha256, 'fixture rollback receipt digest mismatch');
}

function validateAudit(item, expected, source, candidate) {
  assertPrivate(item, source, candidate, 'fixture audit');
  assert(item && item.schema === AUDIT_SCHEMA && item.fixtureOnly === true, 'fixture audit identity mismatch');
  assert(item.liveTargetTouched === false && item.networkCalls === 0 && item.persistentWrites === 0, 'fixture adapter crossed its zero-authority boundary');
  Object.keys(expected).forEach(key => assert(item[key] === expected[key], 'fixture audit ' + key + ' mismatch'));
}

async function run(adapter, source, candidate, plan, options, overrides) {
  const settings = options || {};
  const dependencies = overrides || {};
  assert(adapter && typeof adapter === 'object' && typeof adapter.openFixture === 'function', 'a trusted preloaded fixture adapter with openFixture is required');
  const profile = Core.parseProfile(adapter.descriptor);
  const probe = await Core.prepare(source, candidate, plan, profile, settings, dependencies);
  const sourceInput = String(source == null ? '' : source);
  const candidateInput = String(candidate == null ? '' : candidate);
  const baseMs = Date.parse(settings.now || probe.preparedAt);
  assert(Number.isFinite(baseMs), 'conformance now must be a valid date');
  const scenarios = [];

  async function withSession(permissionGranted, action) {
    const session = await adapter.openFixture({
      probe: JSON.parse(JSON.stringify(probe)),
      source: sourceInput,
      candidate: candidateInput,
      permissionGranted: permissionGranted === true,
      nowMs: baseMs
    });
    assert(session && typeof session === 'object', 'adapter openFixture must return a session');
    Core.REQUIRED_METHODS.slice(1).forEach(name => assert(typeof session[name] === 'function', 'fixture session is missing ' + name));
    try { return await action(session); }
    finally { await session.close(); }
  }

  await withSession(false, async session => {
    await expectCode(() => session.preview({ planId: probe.planId, sourceSha256: probe.sourceSha256, candidateSha256: probe.candidateSha256, nowMs: baseMs }), 'PERMISSION_DENIED');
    validateInspection(await session.inspect(), probe.sourceSha256, sourceInput, candidateInput);
    validateAudit(await session.audit(), { permissionChecks: 1, safetyCopies: 0, applications: 0, rollbacks: 0 }, sourceInput, candidateInput);
  });
  scenarios.push({ code: 'FIXTURE_PERMISSION_DENIAL', verdict: 'PASS', observation: 'TYPED_DENIAL_AND_ZERO_APPLICATIONS' });

  await withSession(true, async session => {
    const preview = await session.preview({ planId: probe.planId, sourceSha256: probe.sourceSha256, candidateSha256: probe.candidateSha256, nowMs: baseMs });
    validatePreview(preview, probe, baseMs, profile, sourceInput, candidateInput);
    await expectCode(() => session.apply({ previewId: preview.id, confirmation: 'WRONG CONFIRMATION', candidateSha256: probe.candidateSha256, nowMs: baseMs + 1 }), 'EXACT_CONFIRMATION_REQUIRED');
    validateInspection(await session.inspect(), probe.sourceSha256, sourceInput, candidateInput);
    validateAudit(await session.audit(), { permissionChecks: 1, safetyCopies: 0, applications: 0, rollbacks: 0 }, sourceInput, candidateInput);
  });
  scenarios.push({ code: 'EXACT_APPLY_CONFIRMATION', verdict: 'PASS', observation: 'WRONG_CONFIRMATION_REFUSED_BEFORE_WRITE' });

  await withSession(true, async session => {
    const preview = await session.preview({ planId: probe.planId, sourceSha256: probe.sourceSha256, candidateSha256: probe.candidateSha256, nowMs: baseMs });
    validatePreview(preview, probe, baseMs, profile, sourceInput, candidateInput);
    await expectCode(() => session.apply({ previewId: preview.id, confirmation: profile.exactApplyConfirmation, candidateSha256: probe.candidateSha256, nowMs: Date.parse(preview.expiresAt) + 1 }), 'PREVIEW_EXPIRED');
    validateInspection(await session.inspect(), probe.sourceSha256, sourceInput, candidateInput);
  });
  scenarios.push({ code: 'STALE_PREVIEW_REFUSAL', verdict: 'PASS', observation: 'EXPIRED_PREVIEW_REFUSED_BEFORE_WRITE' });

  await withSession(true, async session => {
    const preview = await session.preview({ planId: probe.planId, sourceSha256: probe.sourceSha256, candidateSha256: probe.candidateSha256, nowMs: baseMs });
    await expectCode(() => session.apply({ previewId: preview.id, confirmation: profile.exactApplyConfirmation, candidateSha256: '0'.repeat(64), nowMs: baseMs + 1 }), 'CANDIDATE_DIGEST_MISMATCH');
    validateInspection(await session.inspect(), probe.sourceSha256, sourceInput, candidateInput);
  });
  scenarios.push({ code: 'CANDIDATE_DIGEST_MISMATCH_REFUSAL', verdict: 'PASS', observation: 'SUBSTITUTED_DIGEST_REFUSED_BEFORE_WRITE' });

  await withSession(true, async session => {
    const preview = await session.preview({ planId: probe.planId, sourceSha256: probe.sourceSha256, candidateSha256: probe.candidateSha256, nowMs: baseMs });
    await session.injectTestFault('CURRENT_STATE_DRIFT');
    await expectCode(() => session.apply({ previewId: preview.id, confirmation: profile.exactApplyConfirmation, candidateSha256: probe.candidateSha256, nowMs: baseMs + 1 }), 'CURRENT_STATE_DRIFT');
    validateAudit(await session.audit(), { permissionChecks: 1, safetyCopies: 0, applications: 0, rollbacks: 0 }, sourceInput, candidateInput);
  });
  scenarios.push({ code: 'CURRENT_STATE_DRIFT_REFUSAL', verdict: 'PASS', observation: 'DRIFT_REFUSED_BEFORE_SAFETY_COPY_OR_APPLY' });

  await withSession(true, async session => {
    const preview = await session.preview({ planId: probe.planId, sourceSha256: probe.sourceSha256, candidateSha256: probe.candidateSha256, nowMs: baseMs });
    validatePreview(preview, probe, baseMs, profile, sourceInput, candidateInput);
    const application = await session.apply({ previewId: preview.id, confirmation: profile.exactApplyConfirmation, candidateSha256: probe.candidateSha256, nowMs: baseMs + 1 });
    validateApplication(application, preview, probe, sourceInput, candidateInput);
    validateInspection(await session.inspect(), probe.candidateSha256, sourceInput, candidateInput);
    const rollbackPreview = await session.previewRollback({ applicationId: application.applicationId, nowMs: baseMs + 2 });
    validateRollbackPreview(rollbackPreview, application, probe, sourceInput, candidateInput);
    await expectCode(() => session.rollback({ previewId: rollbackPreview.id, confirmation: 'WRONG ROLLBACK CONFIRMATION', nowMs: baseMs + 3 }), 'EXACT_ROLLBACK_CONFIRMATION_REQUIRED');
    validateInspection(await session.inspect(), probe.candidateSha256, sourceInput, candidateInput);
    const rollback = await session.rollback({ previewId: rollbackPreview.id, confirmation: profile.exactRollbackConfirmation, nowMs: baseMs + 4 });
    validateRollback(rollback, rollbackPreview, application, probe, sourceInput, candidateInput);
    validateInspection(await session.inspect(), probe.sourceSha256, sourceInput, candidateInput);
    validateAudit(await session.audit(), { permissionChecks: 1, safetyCopies: 2, applications: 1, rollbacks: 1 }, sourceInput, candidateInput);
  });
  scenarios.push({ code: 'APPLY_INSPECT_ROLLBACK', verdict: 'PASS', observation: 'CANDIDATE_AND_SOURCE_DIGESTS_INDEPENDENTLY_OBSERVED' });
  scenarios.push({ code: 'DIGEST_ONLY_RECEIPT_PRIVACY', verdict: 'PASS', observation: 'NO_PATH_PAYLOAD_IDENTITY_TOKEN_OR_RAW_BYTES' });

  assert(JSON.stringify(scenarios.map(item => item.code)) === JSON.stringify(Core.REQUIRED_SCENARIOS), 'conformance scenario coverage mismatch');
  const runId = await Inspector.sha256(Inspector.canonical({ probeId: probe.probeId, profileSha256: probe.profileSha256, scenarioCodes: scenarios.map(item => item.code) }));
  const receipt = {
    schema: Core.RECEIPT_SCHEMA,
    capability: Core.CAPABILITY,
    status: 'PASS_WITH_LIMITS',
    runId,
    verifiedAt: new Date(baseMs).toISOString(),
    probeId: probe.probeId,
    planId: probe.planId,
    planSha256: probe.planSha256,
    sourceSha256: probe.sourceSha256,
    candidateSha256: probe.candidateSha256,
    profileId: probe.profileId,
    profileVersion: probe.profileVersion,
    profileSha256: probe.profileSha256,
    scenarios,
    truth: {
      fixtureAdapterExecuted: true,
      fixturePermissionDenialObserved: true,
      fixtureApplyDigestObserved: true,
      fixtureRollbackDigestObserved: true,
      responsePrivacyChecked: true,
      productionAdapterExecuted: false,
      RecoveryCenterCalled: false,
      filesystemIoPerformed: false,
      networkCalled: false,
      permissionRequestedLive: false,
      allowedIdentityVerifiedLive: false,
      deniedIdentityVerifiedLive: false,
      liveTargetRead: false,
      liveTargetWritten: false,
      liveApplyCapabilityClosed: false,
      authorityGranted: false,
      promoted: false,
      canon: false
    },
    limits: {
      missingCapability: Core.LIVE_CAPABILITY,
      productionAdapterEvidenceRequired: true,
      independentLiveAuthorizationEvidenceRequired: true,
      humanApplicationDecisionRequired: true
    }
  };
  assertPrivate(receipt, sourceInput, candidateInput, 'conformance receipt');
  return receipt;
}

module.exports = {
  run,
  assertPrivate,
  schemas: { PREVIEW_SCHEMA, APPLICATION_SCHEMA, INSPECTION_SCHEMA, ROLLBACK_PREVIEW_SCHEMA, ROLLBACK_SCHEMA, AUDIT_SCHEMA }
};
