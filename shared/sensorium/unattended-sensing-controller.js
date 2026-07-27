'use strict';

const C = require('./core');

function plan(input) {
  input = input || {};
  const at = Date.parse(input.at || new Date().toISOString()), lease = input.lease || {}, body = input.body || {};
  const holds = [];
  if (input.explicitlyEnabled !== true) holds.push('EXPLICIT_ENABLE_REQUIRED');
  if (!lease.leaseId || !Number.isFinite(Date.parse(lease.expiresAt))) holds.push('BODY_PULSE_LEASE_REQUIRED');
  else if (Date.parse(lease.expiresAt) <= at) holds.push('AUTHORITY_LEASE_EXPIRED');
  if (body.pressure === 'RED') holds.push('BODY_PRESSURE_RED');
  if (!body.pressure || body.pressure === 'UNKNOWN') holds.push('BODY_PRESSURE_UNKNOWN');
  if (input.includeDrift === true && input.reviewedSameSeatBaseline !== true) holds.push('REVIEWED_SAME_SEAT_BASELINE_REQUIRED');
  let state = holds.length ? 'STOPPED' : (body.pressure === 'AMBER' ? 'THROTTLED' : 'READY');
  if (body.pressure === 'RED') state = 'PAUSED';
  const baseCadence = Math.max(60000, Math.round(Number(input.requestedCadenceMs) || 900000));
  const cadenceMs = state === 'THROTTLED' ? Math.max(baseCadence * 4, 3600000) : baseCadence;
  const enabledSenses = (input.enabledSenses || []).slice(0, 8).map(function (id) { return C.assertExactIdentifier(id, 'sense id'); }).filter(function (id) { return input.includeDrift === true || id !== 'drift-detector-ambient'; });
  return { schema: 'axm.sensorium-unattended-plan/v1', state, cadenceMs, enabledSenses, holds, leaseId: lease.leaseId || null, leaseExpiresAt: lease.expiresAt || null, bodyPressure: body.pressure || 'UNKNOWN', memoryBudgetBytes: Math.max(0, Number(input.memoryBudgetBytes) || 16000000), thermalCeilingC: Math.max(1, Number(input.thermalCeilingC) || 80), authorityInherited: false, automaticPromotion: false, allowedEffect: 'bounded-observation-receipt-only' };
}
async function runCycle(input, observe) {
  const decision = plan(input);
  if (decision.state !== 'READY' && decision.state !== 'THROTTLED') return { schema: 'axm.sensorium-unattended-cycle/v1', decision, observed: false, receipts: [], rawRetainedBytes: 0, rawRetainedItems: 0 };
  if (typeof observe !== 'function') throw new Error('bounded observation callback is required');
  const result = await observe(C.clone(decision));
  const receipts = Array.isArray(result && result.receipts) ? result.receipts : [];
  const rawRetainedBytes = receipts.reduce(function (sum, receipt) { return sum + Number(receipt.rawRetainedBytesAfterSeal || 0); }, 0);
  const rawRetainedItems = receipts.reduce(function (sum, receipt) { return sum + Number(receipt.rawRetainedItemsAfterSeal || 0); }, 0);
  if (rawRetainedBytes !== 0 || rawRetainedItems !== 0) throw new Error('unattended observation violated zero-retention law');
  return { schema: 'axm.sensorium-unattended-cycle/v1', decision, observed: true, receipts, rawRetainedBytes, rawRetainedItems, automaticAction: false, automaticPromotion: false };
}

module.exports = { plan, runCycle };
