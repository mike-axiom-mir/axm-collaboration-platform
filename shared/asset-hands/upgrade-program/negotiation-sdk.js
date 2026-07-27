'use strict';

const U = require('./foundation-utils');

const RECEIPT_SCHEMA = 'axm.hand-negotiation-receipt/v1';
const ALLOWED = new Set(['READY', 'MISSING_HAND', 'UNSUPPORTED_CANVAS']);
const STATUS_MAP = Object.freeze({
  READY: 'READY',
  MISSING_HAND: 'MISSING_HAND',
  UNSUPPORTED_CANVAS: 'UNSUPPORTED_CANVAS',
  INVALID_CANVAS: 'UNSUPPORTED_CANVAS',
});

function createClient(hands, host) {
  U.ensure(hands && typeof hands.diagnose === 'function', 'Asset Hands diagnose API required');
  return {
    negotiate(brief) {
      const request = U.clone(brief || {});
      const diagnosis = hands.diagnose(request, host || {});
      const status = diagnosis && STATUS_MAP[diagnosis.status];
      U.ensure(status && ALLOWED.has(status), 'hand registry returned an unsupported negotiation status');
      const route = status === 'READY'
        ? (diagnosis.route || diagnosis.selected_route || (diagnosis.compatible_hands && diagnosis.compatible_hands[0]) || null)
        : null;
      if (status === 'READY') U.ensure(route || diagnosis.hand || diagnosis.hand_id, 'READY diagnosis lacks a selected hand route');
      const receipt = {
        schema: RECEIPT_SCHEMA,
        version: '1.0.0',
        request_digest: U.sha256(request),
        target_canvas_digest: request.target_canvas ? U.sha256(request.target_canvas) : null,
        status,
        registry_status: diagnosis.status,
        selected: route || diagnosis.hand || (diagnosis.hand_id ? { hand_id: diagnosis.hand_id } : null),
        missing_capabilities: U.clone(diagnosis.missing_capabilities || diagnosis.missing || []),
        explanation: U.text(diagnosis.reason || diagnosis.message || diagnosis.explanation || diagnosis.status, 1000, 'negotiation explanation'),
        registry_diagnosis: U.clone(diagnosis),
        fallback_used: false,
      };
      receipt.id = U.receiptId('hand-negotiation', receipt);
      receipt.digest = U.sha256(receipt);
      return receipt;
    },
  };
}

function createHostFixture(capabilities) {
  const list = U.boundedArray(capabilities || [], 0, 200, 'host capabilities').map((item) => U.text(item, 100, 'host capability'));
  return Object.freeze({
    schema: 'axm.asset-hand-host-fixture/v1',
    capabilities: Object.freeze(Array.from(new Set(list)).sort()),
    network: Object.freeze({ allowed: false, domains: Object.freeze([]) }),
  });
}

module.exports = { RECEIPT_SCHEMA, createClient, createHostFixture };
