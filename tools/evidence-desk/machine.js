'use strict';
const Core = require('./evidence-core.js');

function failure(code, message) {
  return { ok: false, error: { code, message } };
}

module.exports = {
  apiVersion: '2.0',
  async call(context, action, input) {
    if (!context || typeof context.authorize !== 'function') {
      return failure('HOST_GATE_REQUIRED', 'Machine adapter requires an authenticated host gate decision.');
    }
    const declared = ['validate', 'build', 'verify', 'handoff-preview'];
    if (!declared.includes(action)) return failure('UNKNOWN_ACTION', 'Action is not declared by this adapter.');
    const decision = await context.authorize({ tool: 'evidence-desk', action, effect: 'read-only' });
    if (!decision || !decision.allow) return failure('GATE_DENIED', decision && decision.reason || 'Action denied.');

    if (action === 'validate') {
      return {
        ok: true, tool: 'evidence-desk', action, effect: 'read-only',
        result: Core.validate(input), writes: [],
        evidence: [{ kind: 'shared-core', source: 'tools/evidence-desk/evidence-core.js', version: Core.VERSION }]
      };
    }
    if (action === 'build') {
      const receipt = await Core.seal(input);
      return {
        ok: true, tool: 'evidence-desk', action, effect: 'read-only',
        result: { receipt, report: Core.report(receipt) }, writes: [],
        evidence: [{ kind: 'sha256-sealed-receipt', digest: receipt.integrity.digest }]
      };
    }
    if (action === 'verify') {
      const receipt = input && input.receipt || input;
      return {
        ok: true, tool: 'evidence-desk', action, effect: 'read-only',
        result: await Core.verify(receipt), writes: [],
        evidence: [{ kind: 'canonical-content-recomputation', source: 'tools/evidence-desk/evidence-core.js' }]
      };
    }
    const receipt = input && input.receipt;
    const check = await Core.verify(receipt);
    if (!check.ok) return failure('SEALED_RECEIPT_REQUIRED', 'Handoff preview requires an intact Evidence Desk v2 receipt.');
    const packet = await Core.knowledgePacket(receipt);
    return {
      ok: true, tool: 'evidence-desk', action, effect: 'read-only',
      result: { packet, receipt: Core.handoffReceipt(packet, 'PREVIEWED') }, writes: [],
      evidence: [{ kind: 'handoff-packet-digest', digest: packet.digest }]
    };
  }
};
