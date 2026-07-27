'use strict';

const Core = require('./core');

const SCHEMA = 'axm.research-evidence-ledger/v1';
function create(experiments) {
  const ledger = {
    schema: SCHEMA,
    claims: experiments.map(experiment => ({ claimId: experiment.claim.id, experimentId: experiment.id, gapId: experiment.gapId, verdict: 'UNTESTED', observationIds: [] })),
    observations: [],
    history: []
  };
  ledger.ledgerDigest = Core.digest({ claims: ledger.claims, observations: ledger.observations, history: ledger.history });
  return ledger;
}
function recalculate(ledger, claimId) {
  const claim = ledger.claims.find(item => item.claimId === claimId);
  Core.assert(claim, 'claim not found');
  const observations = ledger.observations.filter(item => item.claimId === claimId);
  const verdicts = new Set(observations.map(item => item.verdict));
  claim.verdict = verdicts.has('PASS') && verdicts.has('FAIL') ? 'CONFLICT' : verdicts.has('FAIL') ? 'FAIL' : verdicts.has('PASS') ? 'PASS' : observations.length ? 'UNKNOWN' : 'UNTESTED';
  claim.observationIds = observations.map(item => item.id).sort();
}
function ingest(rawLedger, rawObservation) {
  const ledger = Core.clone(rawLedger), observation = rawObservation || {};
  Core.assert(ledger.schema === SCHEMA, 'research ledger schema is unsupported');
  const verdict = Core.text(observation.verdict, 20).toUpperCase();
  Core.assert(['PASS', 'FAIL', 'UNKNOWN'].includes(verdict), 'observation verdict must be PASS, FAIL, or UNKNOWN');
  Core.assert(ledger.claims.some(item => item.claimId === observation.claimId), 'observation claim is unknown');
  const evidenceRefs = (Array.isArray(observation.evidenceRefs) ? observation.evidenceRefs : []).map(item => ({
    path: Core.text(item && item.path, 1000),
    digest: Core.text(item && item.digest, 128)
  })).filter(item => item.path && item.digest);
  Core.assert(evidenceRefs.length > 0, 'observation needs digest-bound evidence');
  const normalized = {
    schema: 'axm.research-observation/v1',
    claimId: observation.claimId,
    surface: Core.text(observation.surface, 120),
    verdict,
    observedAt: Core.text(observation.observedAt, 80),
    observer: { id: Core.text(observation.observer && observation.observer.id, 120), kind: Core.text(observation.observer && observation.observer.kind, 40).toUpperCase() },
    evidenceRefs,
    notes: Core.text(observation.notes, 2000)
  };
  Core.assert(normalized.surface && normalized.observedAt && normalized.observer.id && normalized.observer.kind, 'observation surface, time, and observer are required');
  normalized.id = Core.text(observation.id, 120) || Core.id('observation', normalized);
  Core.assert(!ledger.observations.some(item => item.id === normalized.id), 'duplicate observation id');
  ledger.observations.push(normalized);
  const previous = ledger.history.length ? ledger.history[ledger.history.length - 1].hash : null;
  const event = { type: 'EVIDENCE_INGESTED', observationId: normalized.id, claimId: normalized.claimId, previous };
  event.hash = Core.digest(event); ledger.history.push(event);
  recalculate(ledger, normalized.claimId);
  ledger.ledgerDigest = Core.digest({ claims: ledger.claims, observations: ledger.observations, history: ledger.history });
  return ledger;
}
function verify(ledger) {
  let previous = null;
  for (const event of ledger.history || []) {
    const copy = Core.clone(event), hash = copy.hash; delete copy.hash;
    if (copy.previous !== previous || Core.digest(copy) !== hash) return { pass: false, reason: 'history-chain-mismatch' };
    previous = hash;
  }
  const expected = Core.digest({ claims: ledger.claims, observations: ledger.observations, history: ledger.history });
  return { pass: expected === ledger.ledgerDigest, reason: expected === ledger.ledgerDigest ? null : 'ledger-digest-mismatch' };
}

module.exports = { SCHEMA, create, ingest, verify };
