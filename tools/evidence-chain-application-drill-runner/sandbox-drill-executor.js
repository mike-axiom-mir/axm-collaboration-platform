#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Inspector = require('../evidence-chain-inspector/evidence-chain-core');
const Core = require('./evidence-chain-application-drill-core');

const FAULTS = new Set(['AFTER_BACKUP', 'AFTER_STAGE', 'AFTER_APPLY']);

function samePath(left, right) {
  const a = path.resolve(left);
  const b = path.resolve(right);
  return process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
}

function validateSandboxRoot(value) {
  const supplied = String(value || '');
  if (!supplied || !path.isAbsolute(supplied)) throw new Error('sandbox root must be an absolute path');
  const absolute = path.resolve(supplied);
  const basename = path.basename(absolute);
  if (!new RegExp('^' + Core.SAFE_ROOT_PREFIX + '[a-z0-9][a-z0-9-]{0,63}$').test(basename)) throw new Error('sandbox root basename must use the safe drill prefix');
  const parent = path.dirname(absolute);
  let parentStat;
  try { parentStat = fs.lstatSync(parent); }
  catch (error) { throw new Error('sandbox parent must already exist'); }
  if (!parentStat.isDirectory() || parentStat.isSymbolicLink()) throw new Error('sandbox parent must be a real directory, not a link');
  let realParent;
  try { realParent = fs.realpathSync(parent); }
  catch (error) { throw new Error('sandbox parent could not be canonicalized'); }
  if (!samePath(realParent, parent)) throw new Error('sandbox parent must be supplied through its canonical path');
  const canonicalRoot = path.join(realParent, basename);
  if (!samePath(canonicalRoot, absolute)) throw new Error('sandbox root failed canonical containment');
  if (fs.existsSync(canonicalRoot)) throw new Error('sandbox root must not already exist');
  return canonicalRoot;
}

function injectedFault(code) {
  const error = new Error('bounded injected drill fault');
  error.drillFault = 'INJECTED_' + code;
  return error;
}

function maybeFault(selected, code) {
  if (selected === code) throw injectedFault(code);
}

function phase(planPhase, code, status, evidence) {
  const row = { planPhase, code, status };
  if (evidence) row.evidence = evidence;
  return row;
}

async function execute(input, options) {
  input = input || {};
  options = options || {};
  const faultAt = options.faultAt == null ? null : String(options.faultAt);
  if (faultAt !== null && !FAULTS.has(faultAt)) throw new Error('faultAt is not a supported bounded drill fault');
  const request = await Core.prepare(input.source, input.candidate, input.plan, {
    confirmPlanId: input.confirmPlanId,
    acknowledgeSandboxOnly: input.acknowledgeSandboxOnly,
    acknowledgeEphemeralCleanup: input.acknowledgeEphemeralCleanup,
    now: options.now
  }, Inspector);
  const sandboxRoot = validateSandboxRoot(input.sandboxRoot);
  const requestDigest = await Inspector.sha256(Inspector.canonical(request));
  const phaseResults = [];
  let rootCreated = false;
  let cleanupComplete = false;
  let failureCode = null;
  let appliedDigestObserved = null;
  let rollbackDigestObserved = null;
  let safetyCopyDigestObserved = null;
  let rollbackExactBytesRestored = false;
  const target = path.join(sandboxRoot, 'target.jsonl');
  const backup = path.join(sandboxRoot, 'safety-copy.jsonl');
  const stage = path.join(sandboxRoot, 'candidate.stage.jsonl');
  const rollbackSource = path.join(sandboxRoot, 'rollback-source.jsonl');

  try {
    fs.mkdirSync(sandboxRoot);
    rootCreated = true;
    fs.writeFileSync(target, String(input.source), { encoding: 'utf8', flag: 'wx' });
    const targetDigest = await Inspector.sha256(fs.readFileSync(target, 'utf8'));
    if (targetDigest !== request.sourceSha256) throw new Error('sandbox source digest drift');
    phaseResults.push(phase(1, 'REVERIFY_CURRENT_TARGET_DIGEST', 'PASS', 'SOURCE_DIGEST_MATCH'));

    fs.copyFileSync(target, backup, fs.constants.COPYFILE_EXCL);
    safetyCopyDigestObserved = await Inspector.sha256(fs.readFileSync(backup, 'utf8'));
    if (safetyCopyDigestObserved !== request.sourceSha256) throw new Error('sandbox safety copy digest drift');
    phaseResults.push(phase(2, 'CREATE_IMMUTABLE_SAFETY_COPY', 'PASS', 'SAFETY_COPY_DIGEST_MATCH'));
    maybeFault(faultAt, 'AFTER_BACKUP');

    fs.writeFileSync(stage, String(input.candidate), { encoding: 'utf8', flag: 'wx' });
    const stageDigest = await Inspector.sha256(fs.readFileSync(stage, 'utf8'));
    if (stageDigest !== request.candidateSha256) throw new Error('sandbox staged candidate digest drift');
    phaseResults.push(phase(3, 'STAGE_CANDIDATE_SEPARATELY', 'PASS', 'STAGED_CANDIDATE_DIGEST_MATCH'));
    maybeFault(faultAt, 'AFTER_STAGE');

    const stageInspection = await Inspector.inspect(fs.readFileSync(stage, 'utf8'), { label: 'sandbox-drill-stage' });
    if (stageInspection.verdict !== 'PASS' || stageInspection.chainState !== 'VALID') throw new Error('sandbox staged candidate inspection failed');
    phaseResults.push(phase(4, 'REINSPECT_STAGED_CANDIDATE', 'PASS', 'CHAIN_VALID'));
    phaseResults.push(phase(5, 'REQUEST_FRESH_PERMISSIONED_PREVIEW', 'SKIPPED_BY_CONTRACT', 'NO_PERMISSION_OR_TRUSTED_SERVICE_CALL'));

    fs.renameSync(target, rollbackSource);
    fs.renameSync(stage, target);
    appliedDigestObserved = await Inspector.sha256(fs.readFileSync(target, 'utf8'));
    if (appliedDigestObserved !== request.candidateSha256) throw new Error('sandbox applied digest drift');
    phaseResults.push(phase(6, 'EXECUTE_THROUGH_TRUSTED_RECOVERY_SERVICE', 'SANDBOX_SIMULATION_PASS', 'OWNED_ROOT_ATOMIC_SWAP_ONLY'));
    maybeFault(faultAt, 'AFTER_APPLY');

    const appliedInspection = await Inspector.inspect(fs.readFileSync(target, 'utf8'), { label: 'sandbox-drill-applied' });
    if (appliedInspection.verdict !== 'PASS' || appliedInspection.chainState !== 'VALID') throw new Error('sandbox applied candidate inspection failed');
    phaseResults.push(phase(7, 'REINSPECT_APPLIED_RESULT', 'PASS', 'CHAIN_VALID'));

    fs.unlinkSync(target);
    fs.renameSync(rollbackSource, target);
    const rolledBack = fs.readFileSync(target, 'utf8');
    rollbackDigestObserved = await Inspector.sha256(rolledBack);
    rollbackExactBytesRestored = rolledBack === String(input.source) && rollbackDigestObserved === request.sourceSha256 && safetyCopyDigestObserved === request.sourceSha256;
    if (!rollbackExactBytesRestored) throw new Error('sandbox rollback byte restoration failed');
    phaseResults.push(phase(8, 'RETAIN_ROLLBACK_LINEAGE', 'PASS', 'SOURCE_BYTES_AND_SAFETY_COPY_DIGEST_MATCH'));
  } catch (error) {
    failureCode = error && error.drillFault ? error.drillFault : 'SANDBOX_DRILL_IO_OR_VERIFICATION_FAILURE';
  }

  if (rootCreated) {
    try {
      fs.rmSync(sandboxRoot, { recursive: true, force: true });
      cleanupComplete = !fs.existsSync(sandboxRoot);
    } catch (error) {
      cleanupComplete = false;
    }
  }
  if (!cleanupComplete) throw new Error('owned sandbox cleanup failed; inspect the explicitly supplied sandbox root');

  const passed = failureCode === null;
  const receipt = {
    schema: Core.RECEIPT_SCHEMA,
    capability: Core.CAPABILITY,
    status: passed ? 'PASS_WITH_LIMITS' : 'ABORTED',
    requestSha256: requestDigest,
    planId: request.planId,
    sourceSha256: request.sourceSha256,
    candidateSha256: request.candidateSha256,
    phaseResults,
    failureCode,
    observations: {
      safetyCopyDigestMatchesSource: safetyCopyDigestObserved === request.sourceSha256,
      appliedCandidateDigestObserved: appliedDigestObserved === request.candidateSha256,
      rollbackSourceDigestObserved: rollbackDigestObserved === request.sourceSha256,
      rollbackExactBytesRestored
    },
    cleanup: {
      ownedRootCreated: rootCreated,
      ownedRootDeleted: cleanupComplete,
      filesRetained: false
    },
    limits: {
      excludedPlanPhase: 5,
      trustedServiceApplicationSimulated: false,
      liveApplyCapabilityClosed: false,
      missingCapability: 'capability.apply.evidence-chain-reviewed-recovery/v1'
    },
    truth: {
      ownedSandboxOnly: true,
      actualFilesystemIoObserved: rootCreated,
      inputSourceFileWritten: false,
      inputCandidateFileWritten: false,
      liveStateRead: false,
      liveStateWritten: false,
      pathsEmitted: false,
      fileNamesEmitted: false,
      payloadsEmitted: false,
      rawLinesEmitted: false,
      permissionChecked: false,
      permissionGranted: false,
      trustedRecoveryServiceCalled: false,
      candidateAppliedLive: false,
      liveApplyCapabilityClosed: false,
      filesRetained: false,
      serverStarted: false,
      authorityGranted: false,
      promoted: false,
      canon: false
    }
  };
  receipt.receiptSha256 = await Inspector.sha256(Inspector.canonical(receipt));
  return receipt;
}

module.exports = { execute, validateSandboxRoot, FAULTS };
