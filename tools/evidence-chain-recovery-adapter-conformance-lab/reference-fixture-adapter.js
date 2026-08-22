#!/usr/bin/env node
'use strict';

const Core = require('./evidence-chain-recovery-adapter-conformance-core');
const Inspector = require('../evidence-chain-inspector/evidence-chain-core');

function typed(code, message) {
  const error = new Error(message || code);
  error.code = code;
  return error;
}

function clone(value) { return JSON.parse(JSON.stringify(value)); }

function createAdapter(options) {
  const defects = new Set((options && options.defects) || []);
  const descriptor = Core.referenceProfile();

  return {
    descriptor: clone(descriptor),
    async openFixture(input) {
      if (!input || !input.probe || input.probe.schema !== Core.PROBE_SCHEMA) throw typed('PROBE_REQUIRED');
      const sourceSha256 = await Inspector.sha256(String(input.source));
      const candidateSha256 = await Inspector.sha256(String(input.candidate));
      if (sourceSha256 !== input.probe.sourceSha256 || candidateSha256 !== input.probe.candidateSha256) throw typed('FIXTURE_DIGEST_MISMATCH');
      const driftSha256 = await Inspector.sha256('synthetic-current-state-drift:' + sourceSha256);
      let currentSha256 = sourceSha256;
      let preview = null;
      let application = null;
      let rollbackPreview = null;
      let closed = false;
      const counts = { permissionChecks: 0, safetyCopies: 0, applications: 0, rollbacks: 0 };

      function open() { if (closed) throw typed('SESSION_CLOSED'); }
      function leak(record) {
        if (defects.has('LEAK_TARGET_PATH')) record.targetPath = 'C:\\private\\retained-evidence.jsonl';
        return record;
      }

      return {
        async preview(request) {
          open(); counts.permissionChecks += 1;
          if (!input.permissionGranted && !defects.has('ALLOW_PERMISSION_DENIED')) throw typed('PERMISSION_DENIED');
          if (!request || request.planId !== input.probe.planId || request.sourceSha256 !== sourceSha256 || request.candidateSha256 !== candidateSha256) throw typed('BINDING_MISMATCH');
          const nowMs = Number(request.nowMs);
          preview = {
            schema: 'axm.evidence-chain-reviewed-recovery-preview/v1',
            id: 'fixture-preview-' + input.probe.probeId.slice(0, 16),
            state: 'PREVIEWED',
            eligible: true,
            fixtureOnly: true,
            permission: 'GRANTED',
            planId: input.probe.planId,
            sourceSha256,
            candidateSha256,
            createdAt: new Date(nowMs).toISOString(),
            expiresAt: new Date(nowMs + descriptor.previewTtlSeconds * 1000).toISOString()
          };
          return clone(leak(preview));
        },

        async apply(request) {
          open();
          if (!preview || request.previewId !== preview.id) throw typed('PREVIEW_REQUIRED');
          if (Number(request.nowMs) > Date.parse(preview.expiresAt) && !defects.has('ACCEPT_STALE_PREVIEW')) throw typed('PREVIEW_EXPIRED');
          if (request.confirmation !== descriptor.exactApplyConfirmation && !defects.has('ACCEPT_WRONG_APPLY_CONFIRMATION')) throw typed('EXACT_CONFIRMATION_REQUIRED');
          if (request.candidateSha256 !== candidateSha256 && !defects.has('ACCEPT_TAMPERED_CANDIDATE')) throw typed('CANDIDATE_DIGEST_MISMATCH');
          if (currentSha256 !== sourceSha256 && !defects.has('ACCEPT_CURRENT_STATE_DRIFT')) throw typed('CURRENT_STATE_DRIFT');
          counts.safetyCopies += 1; counts.applications += 1; currentSha256 = candidateSha256;
          application = {
            schema: 'axm.evidence-chain-reviewed-recovery-application-receipt/v1',
            applicationId: 'fixture-application-' + input.probe.probeId.slice(0, 16),
            previewId: preview.id,
            planId: input.probe.planId,
            state: 'APPLIED',
            fixtureOnly: true,
            sourceSha256,
            candidateSha256,
            safetyCopySha256: sourceSha256,
            appliedAt: new Date(Number(request.nowMs)).toISOString()
          };
          return clone(leak(application));
        },

        async inspect() {
          open();
          return {
            schema: 'axm.evidence-chain-recovery-adapter-fixture-inspection/v1',
            fixtureOnly: true,
            sha256: currentSha256,
            chainVerdict: currentSha256 === candidateSha256 ? 'PASS' : currentSha256 === sourceSha256 ? 'FAIL' : 'UNKNOWN'
          };
        },

        async injectTestFault(code) {
          open();
          if (code !== 'CURRENT_STATE_DRIFT') throw typed('UNSUPPORTED_TEST_FAULT');
          currentSha256 = driftSha256;
        },

        async previewRollback(request) {
          open();
          if (!application || request.applicationId !== application.applicationId || currentSha256 !== candidateSha256) throw typed('APPLICATION_NOT_ROLLBACK_ELIGIBLE');
          const nowMs = Number(request.nowMs);
          rollbackPreview = {
            schema: 'axm.evidence-chain-reviewed-recovery-rollback-preview/v1',
            id: 'fixture-rollback-preview-' + input.probe.probeId.slice(0, 16),
            applicationId: application.applicationId,
            state: 'PREVIEWED',
            eligible: true,
            fixtureOnly: true,
            currentSha256: candidateSha256,
            restoreSha256: sourceSha256,
            createdAt: new Date(nowMs).toISOString(),
            expiresAt: new Date(nowMs + descriptor.previewTtlSeconds * 1000).toISOString()
          };
          return clone(leak(rollbackPreview));
        },

        async rollback(request) {
          open();
          if (!rollbackPreview || request.previewId !== rollbackPreview.id) throw typed('ROLLBACK_PREVIEW_REQUIRED');
          if (Number(request.nowMs) > Date.parse(rollbackPreview.expiresAt)) throw typed('ROLLBACK_PREVIEW_EXPIRED');
          if (request.confirmation !== descriptor.exactRollbackConfirmation && !defects.has('ACCEPT_WRONG_ROLLBACK_CONFIRMATION')) throw typed('EXACT_ROLLBACK_CONFIRMATION_REQUIRED');
          counts.safetyCopies += 1; counts.rollbacks += 1;
          currentSha256 = defects.has('BROKEN_ROLLBACK') ? candidateSha256 : sourceSha256;
          const receipt = {
            schema: 'axm.evidence-chain-reviewed-recovery-rollback-receipt/v1',
            rollbackId: 'fixture-rollback-' + input.probe.probeId.slice(0, 16),
            rollbackPreviewId: rollbackPreview.id,
            applicationId: application.applicationId,
            state: 'ROLLED_BACK',
            fixtureOnly: true,
            restoredSha256: currentSha256,
            safetyCopySha256: candidateSha256,
            rolledBackAt: new Date(Number(request.nowMs)).toISOString()
          };
          return clone(leak(receipt));
        },

        async audit() {
          open();
          return {
            schema: 'axm.evidence-chain-recovery-adapter-fixture-audit/v1',
            fixtureOnly: true,
            permissionChecks: counts.permissionChecks,
            safetyCopies: counts.safetyCopies,
            applications: counts.applications,
            rollbacks: counts.rollbacks,
            liveTargetTouched: false,
            networkCalls: 0,
            persistentWrites: 0
          };
        },

        async close() { closed = true; }
      };
    }
  };
}

module.exports = { createAdapter };
