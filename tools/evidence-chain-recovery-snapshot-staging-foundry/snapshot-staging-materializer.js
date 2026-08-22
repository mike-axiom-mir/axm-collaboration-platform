#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Core = require('./evidence-chain-recovery-snapshot-staging-core');
const Inspector = require('../evidence-chain-inspector/evidence-chain-core');

const FAULTS = new Set(['AFTER_ROOT', 'AFTER_CANDIDATE', 'AFTER_MANIFEST']);

function validateOutputRoot(value) {
  const supplied = String(value || '');
  if (!supplied || !path.isAbsolute(supplied)) throw new Error('staging root must be an absolute path');
  const resolved = path.resolve(supplied);
  if (path.basename(resolved).indexOf(Core.SAFE_ROOT_PREFIX) !== 0) throw new Error('staging root name must start with ' + Core.SAFE_ROOT_PREFIX);
  if (fs.existsSync(resolved)) throw new Error('staging root must not already exist');
  const parent = path.dirname(resolved);
  if (!fs.existsSync(parent)) throw new Error('staging parent must already exist');
  const stat = fs.lstatSync(parent);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('staging parent must be a real directory, not a symlink');
  const canonicalParent = fs.realpathSync(parent);
  if (path.resolve(canonicalParent) !== path.resolve(parent)) throw new Error('staging parent must be canonical');
  return resolved;
}

function maybeFault(code, point) { if (code === point) throw new Error('injected staging fault at ' + point); }

function byteLength(value) { return Buffer.byteLength(String(value == null ? '' : value), 'utf8'); }

async function execute(input) {
  const settings = input && input.options || {};
  const faultAt = input && input.faultAt || null;
  if (faultAt && !FAULTS.has(faultAt)) throw new Error('unsupported staging fault');
  const outputRoot = validateOutputRoot(input && input.outputRoot);
  const request = await Core.prepare(input.source, input.candidate, input.plan, input.conformanceReceipt, input.integrationPacket, input.targetRelativePath, settings);
  const candidate = String(input.candidate == null ? '' : input.candidate);
  const packageRoot = path.join(outputRoot, request.snapshotId);
  const target = path.resolve(packageRoot, request.target.relativePath.split('/').join(path.sep));
  const packagePrefix = path.resolve(packageRoot) + path.sep;
  if (!target.startsWith(packagePrefix)) throw new Error('staging target escaped the package root');
  let rootCreated = false;
  try {
    fs.mkdirSync(outputRoot);
    rootCreated = true;
    maybeFault(faultAt, 'AFTER_ROOT');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, candidate, 'utf8');
    const staged = fs.readFileSync(target, 'utf8');
    const stagedSha256 = await Inspector.sha256(staged);
    if (staged !== candidate || stagedSha256 !== request.candidateSha256) throw new Error('staged candidate readback digest mismatch');
    maybeFault(faultAt, 'AFTER_CANDIDATE');
    const manifest = {
      schema: 'axm.workshop-package/v1',
      mode: 'full',
      package_kind: 'evidence-chain-recovery-staging-candidate',
      snapshot_id: request.snapshotId,
      created_at: request.preparedAt,
      file_count: 1,
      total_bytes: byteLength(candidate),
      selection: {
        scopes: ['state/evidence-retention'],
        paths_preserved: true,
        dependency_closure: 'exact-reviewed-candidate-only'
      },
      files: [{ path: request.target.relativePath, bytes: byteLength(candidate), sha256: request.candidateSha256 }],
      evidence_chain_recovery: {
        request_id: request.requestId,
        integration_packet_id: request.packetId,
        application_plan_id: request.planId,
        conformance_run_id: request.conformanceRunId,
        expected_current_source_sha256: request.sourceSha256,
        reviewed_candidate_sha256: request.candidateSha256,
        live_placement: false,
        application_authority: false
      },
      truth: {
        staging_only: true,
        restore_test_run: false,
        packager_output_written: false,
        recovery_center_called: false,
        permission_granted: false,
        candidate_applied: false,
        promoted: false,
        canon: false
      }
    };
    const manifestText = JSON.stringify(manifest, null, 2) + '\n';
    const manifestFile = path.join(packageRoot, 'PACKAGE_MANIFEST.json');
    fs.writeFileSync(manifestFile, manifestText, 'utf8');
    const observedManifestText = fs.readFileSync(manifestFile, 'utf8');
    const observedManifest = JSON.parse(observedManifestText);
    if (observedManifest.schema !== 'axm.workshop-package/v1' || observedManifest.file_count !== 1 || observedManifest.files[0].path !== request.target.relativePath || observedManifest.files[0].sha256 !== request.candidateSha256) throw new Error('staging manifest readback mismatch');
    const manifestSha256 = await Inspector.sha256(observedManifestText);
    maybeFault(faultAt, 'AFTER_MANIFEST');
    const receipt = {
      schema: Core.RECEIPT_SCHEMA,
      capability: Core.CAPABILITY,
      status: 'STAGED_FOR_HUMAN_PLACEMENT_WITH_LIMITS',
      requestId: request.requestId,
      packetId: request.packetId,
      planId: request.planId,
      conformanceRunId: request.conformanceRunId,
      snapshotId: request.snapshotId,
      sourceSha256: request.sourceSha256,
      candidateSha256: request.candidateSha256,
      targetPathSha256: request.target.sha256,
      manifestSha256: manifestSha256,
      candidateBytes: byteLength(candidate),
      candidateEvents: request.candidateEvents,
      observations: {
        ownedRootCreated: true,
        packageFolderCreated: true,
        candidateExactBytesObserved: true,
        candidateDigestObserved: true,
        manifestReadbackObserved: true,
        manifestCandidateLedgerMatches: true,
        retainedForHumanReview: true
      },
      privacy: {
        outputRootPathIncluded: false,
        targetRelativePathIncluded: false,
        sourcePayloadIncluded: false,
        candidatePayloadIncluded: false,
        identityIncluded: false,
        secretIncluded: false
      },
      truth: {
        actualFilesystemWrite: true,
        stagedRootRetained: true,
        WorkshopPackagerOutputWritten: false,
        snapshotPlacedLive: false,
        RecoveryCenterCalled: false,
        permissionChecked: false,
        permissionGranted: false,
        liveTargetRead: false,
        liveTargetWritten: false,
        candidateApplied: false,
        rollbackPerformed: false,
        liveApplyCapabilityClosed: false,
        installed: false,
        promoted: false,
        canon: false
      },
      limits: {
        missingPlacementCapability: Core.PLACE_CAPABILITY,
        missingLiveApplyCapability: Core.LIVE_CAPABILITY,
        restoreTestStatus: 'NOT_RUN'
      }
    };
    const receiptText = JSON.stringify(receipt, null, 2) + '\n';
    fs.writeFileSync(path.join(outputRoot, 'STAGING_RECEIPT.json'), receiptText, 'utf8');
    if (fs.readFileSync(path.join(outputRoot, 'STAGING_RECEIPT.json'), 'utf8') !== receiptText) throw new Error('staging receipt readback mismatch');
    return receipt;
  } catch (error) {
    if (rootCreated) {
      try { fs.rmSync(outputRoot, { recursive: true, force: true }); }
      catch (cleanupError) { throw new Error(error.message + '; exact owned staging root cleanup failed: ' + cleanupError.message); }
    }
    throw error;
  }
}

module.exports = { execute, validateOutputRoot, FAULTS };
