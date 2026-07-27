'use strict';

const Lifecycle = require('../gate/proposal-lifecycle');
const { clone, now, makeId } = require('../core/utils');

class VerificationService {
  constructor(options) {
    this.store = options.store;
    this.bridge = options.bridge;
    this.registry = options.registry;
    this.journal = options.journal;
  }

  verify(applicationId, actor) {
    const state = this.store.read();
    const application = state.applications[applicationId];
    if (!application) throw new Error('application not found');
    if (!['APPLIED', 'VERIFIED'].includes(application.status)) throw new Error('application is not verifiable in state ' + application.status);
    const adapter = this.bridge.get(application.adapter_id);
    if (!adapter) throw new Error('adapter not registered');
    const report = adapter.verifyApplication(application.adapter_receipt);
    const evidenceId = makeId('evidence:verifier');
    const evidence = {
      evidence_id: evidenceId,
      schema_version: 'axm.mirror.evidence/v1',
      evidence_type: 'verifier_report',
      source: { system: 'mirror-verifier', application_id: applicationId },
      creator: clone(actor),
      timestamp: now(),
      integrity_hash: null,
      storage_reference: 'application:' + applicationId,
      claim_scope: ['application:' + applicationId, 'adapter:' + application.adapter_id],
      limitations: Array.isArray(report.limitations) ? clone(report.limitations) : ['verifies only the state exposed by the selected adapter', 'does not prove physical or real-world truth'],
      verification_status: report.ok ? 'checked' : 'failed',
      extensions: { report: clone(report) }
    };
    this.registry.registerEvidence(evidence);
    this.store.mutate(function (next) {
      const app = next.applications[applicationId];
      app.verification = clone(report);
      app.status = report.ok ? 'VERIFIED' : 'FAILED';
      const packet = next.proposals[app.packet_id];
      if (report.ok && packet.status === 'APPLIED') Lifecycle.transition(packet, 'VERIFIED');
      if (!report.ok && packet.status === 'APPLIED') Lifecycle.transition(packet, 'FAILED');
    });
    this.journal.append('verify_completed', {
      actor,
      system: application.system_id,
      related_packet: application.packet_id,
      evidence_refs: [evidenceId],
      payload: { application_id: applicationId, ok: report.ok, status: report.status }
    });
    return { ok: report.ok, report, evidence_id: evidenceId };
  }
}

module.exports = { VerificationService };
