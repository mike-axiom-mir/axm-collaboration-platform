'use strict';

const V28 = require('../model-shadow-retention-audit-observation-ledger/model-shadow-retention-audit-observation-ledger');
const V28Fixture = require('../model-shadow-retention-audit-observation-ledger/selftest-fixture');

function copy(value) { return JSON.parse(JSON.stringify(value)); }

function build(parent, tag) {
  const prefix = tag || 'primary';
  const world = V28Fixture.buildWorld(parent, prefix);
  const observationRoot = V28Fixture.makeDir(parent, prefix + '-observations');
  const observationServiceOptions = V28Fixture.serviceOptions(observationRoot, 'v29-observation-log-' + prefix);
  const observationService = V28.createService(copy(observationServiceOptions));
  const exactInput = V28Fixture.captureInput(
    'v29-observation:exact-' + prefix,
    '2026-08-20T16:32:46.000Z',
    world,
    world.exactAuditInput,
    world.exactAudit
  );
  const exactObservation = observationService.capture(copy(exactInput));
  const heldInput = V28Fixture.captureInput(
    'v29-observation:held-' + prefix,
    '2026-08-20T16:32:51.000Z',
    world,
    world.absentAuditInput,
    world.absentAudit
  );
  const heldObservation = observationService.capture(copy(heldInput));
  return {
    world,
    observationRoot,
    observationServiceOptions,
    observationService,
    exactInput,
    exactObservation,
    heldInput,
    heldObservation
  };
}

function requestInput(fixture, overrides) {
  return Object.assign({
    requestId: 'v29-review-request:held-observation',
    generatedAt: '2026-08-20T16:33:00.000Z',
    requiredSeats: 2,
    observationServiceOptions: copy(fixture.observationServiceOptions),
    observationSequence: fixture.heldObservation.log.sequence,
    observation: copy(fixture.heldObservation)
  }, copy(overrides || {}));
}

module.exports = { copy, build, requestInput };
