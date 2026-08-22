'use strict';

const fs = require('fs');
const path = require('path');
const V26 = require('../model-shadow-portable-pin-settlement-history-checkpoint/model-shadow-portable-pin-settlement-history-checkpoint');
const V26Fixture = require('../model-shadow-portable-pin-settlement-history-checkpoint/selftest-fixture');
const V27 = require('../model-shadow-history-checkpoint-retention-ledger/model-shadow-history-checkpoint-retention-ledger');
const V27Fixture = require('../model-shadow-history-checkpoint-retention-ledger/selftest-fixture');

function copy(value) { return JSON.parse(JSON.stringify(value)); }
function makeDir(parent, name) { const result = path.join(parent, name); fs.mkdirSync(result); return result; }

function buildWorld(parent, tag) {
  const prefix = tag || 'primary';
  const fixtureParent = makeDir(parent, prefix + '-fixture');
  const fixture = V27Fixture.build(fixtureParent);
  const source = V26Fixture.buildPending(parent, fixture, prefix + '-source', 'A', 'v28-source-history-' + prefix, 'v28-source-' + prefix);
  const records = [copy(source.record)];
  const checkpointInput = V26Fixture.checkpointInput(
    'v28-checkpoint:' + prefix,
    '2026-08-20T16:32:30.000Z',
    source.serviceOptions,
    records
  );
  const checkpoint = V26.createCheckpoint(copy(checkpointInput));
  const retentionRoot = makeDir(parent, prefix + '-retention');
  const retentionServiceOptions = V27Fixture.serviceOptions(retentionRoot, 'v28-retention-log-' + prefix);
  const retentionService = V27.createService(copy(retentionServiceOptions));
  const proposalInput = V27Fixture.proposalInput(
    'v28-retention-proposal:' + prefix,
    '2026-08-20T16:32:40.000Z',
    checkpointInput,
    checkpoint
  );
  const proposal = retentionService.propose(copy(proposalInput));
  const exactAuditInput = V27Fixture.auditInput(
    'v28-retention-audit:exact-' + prefix,
    '2026-08-20T16:32:45.000Z',
    source.serviceOptions,
    records
  );
  const exactAudit = retentionService.auditLatest(copy(exactAuditInput));
  const absentRoot = makeDir(parent, prefix + '-absent-source');
  const absentOptions = V26Fixture.options(absentRoot, fixture, 'v28-source-history-' + prefix);
  const absentAuditInput = V27Fixture.auditInput(
    'v28-retention-audit:absent-' + prefix,
    '2026-08-20T16:32:50.000Z',
    absentOptions,
    []
  );
  const absentAudit = retentionService.auditLatest(copy(absentAuditInput));
  return {
    fixture,
    source,
    records,
    checkpointInput,
    checkpoint,
    retentionRoot,
    retentionServiceOptions,
    retentionService,
    proposalInput,
    proposal,
    exactAuditInput,
    exactAudit,
    absentRoot,
    absentOptions,
    absentAuditInput,
    absentAudit
  };
}

function serviceOptions(stateRoot, auditLogId) {
  return { stateRoot, auditLogId, createdAt: '2026-08-20T16:32:44.000Z' };
}
function captureInput(observationId, observedAt, world, auditInput, auditReceipt) {
  return {
    observationId,
    observedAt,
    confirmation: 'RECORD_LOCAL_RETENTION_AUDIT_OBSERVATION_UNAUTHENTICATED',
    retentionServiceOptions: copy(world.retentionServiceOptions),
    auditInput: copy(auditInput),
    auditReceipt: copy(auditReceipt)
  };
}

module.exports = { copy, makeDir, buildWorld, serviceOptions, captureInput };
