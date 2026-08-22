#!/usr/bin/env node
'use strict';

const path = require('path');
const Lease = require('./review-operation-lease');

function parse(argv) {
  const command = argv.shift(), values = {};
  if (!['inspect','retire','recovery-status','publication-status','publication-stage-plan','publication-stage-authorization-status','archive-publication-stage','recover','withdraw'].includes(command)) throw new Error('command must be inspect, retire, recovery-status, publication-status, publication-stage-plan, publication-stage-authorization-status, archive-publication-stage, recover, or withdraw');
  while (argv.length) {
    const flag = argv.shift();
    if (!/^--[a-z-]+$/.test(flag) || !argv.length) throw new Error('every option requires a --name and value');
    const key = flag.slice(2);
    if (Object.prototype.hasOwnProperty.call(values, key)) throw new Error('duplicate option: ' + flag);
    values[key] = argv.shift();
  }
  if (!values['state-root']) throw new Error('--state-root is required');
  const stateRoot = path.resolve(values['state-root']);
  if (stateRoot === path.parse(stateRoot).root) throw new Error('--state-root cannot be a filesystem root');
  const allowed = ['inspect','recovery-status','publication-status'].includes(command)
    ? ['state-root']
    : ['publication-stage-plan','publication-stage-authorization-status'].includes(command)
      ? ['stage-file','state-root']
      : command === 'archive-publication-stage'
        ? ['assertion','confirmation','reason','stage-digest','stage-file','state-root']
        : command === 'retire'
          ? ['assertion','confirmation','owner-digest','reason','state-root']
          : command === 'recover'
            ? ['action','assertion','confirmation','owner-digest','reason','retirement-id','state-root']
            : ['assertion','confirmation','owner-digest','reason','retirement-id','state-root'];
  const unknown = Object.keys(values).filter(key => !allowed.includes(key));
  if (unknown.length) throw new Error('unsupported option: --' + unknown[0]);
  return { command, values, stateRoot };
}

function main() {
  const parsed = parse(process.argv.slice(2));
  const lease = Lease.create({ stateRoot:parsed.stateRoot, timeoutMs:0 });
  if (parsed.command === 'inspect') return lease.retirementPlan();
  if (parsed.command === 'recovery-status') return lease.retirementRecoveryStatus();
  if (parsed.command === 'publication-status') return lease.retirementPublicationStatus();
  if (parsed.command === 'publication-stage-plan') return lease.retirementPublicationStagePlan(parsed.values['stage-file']);
  if (parsed.command === 'publication-stage-authorization-status') return lease.retirementPublicationArchivalAuthorizationStatus(parsed.values['stage-file']);
  if (parsed.command === 'archive-publication-stage') return lease.archiveRetirementPublicationStage({
    schema:Lease.RETIREMENT_PUBLICATION_ARCHIVAL_REQUEST_SCHEMA,
    stageFile:parsed.values['stage-file'],
    stageDigest:parsed.values['stage-digest'],
    assertion:parsed.values.assertion,
    confirmation:parsed.values.confirmation,
    reason:parsed.values.reason
  });
  if (parsed.command === 'retire') return lease.retireWithOperatorAssertion({
      schema:Lease.RETIREMENT_REQUEST_SCHEMA,
      assertion:parsed.values.assertion,
      confirmation:parsed.values.confirmation,
      ownerDigest:parsed.values['owner-digest'],
      reason:parsed.values.reason
    });
  if (parsed.command === 'withdraw') return lease.withdrawRetirement({
    schema:Lease.RETIREMENT_WITHDRAWAL_REQUEST_SCHEMA,
    retirementId:parsed.values['retirement-id'],
    assertion:parsed.values.assertion,
    confirmation:parsed.values.confirmation,
    ownerDigest:parsed.values['owner-digest'],
    reason:parsed.values.reason
  });
  return lease.recoverRetirement({
    schema:Lease.RETIREMENT_RECOVERY_REQUEST_SCHEMA,
    retirementId:parsed.values['retirement-id'],
    action:parsed.values.action,
    assertion:parsed.values.assertion,
    confirmation:parsed.values.confirmation,
    ownerDigest:parsed.values['owner-digest'],
    reason:parsed.values.reason
  });
}

try { process.stdout.write(JSON.stringify({ ok:true, result:main() }, null, 2) + '\n'); }
catch (error) {
  process.stderr.write(JSON.stringify({ ok:false, code:error.code || 'INVALID_REVIEW_OPERATION_LEASE_ADMIN_REQUEST', error:error.message, retirementPlan:error.retirementPlan || null, retirementRecoveryStatus:error.retirementRecoveryStatus || null, retirementPublicationStagePlan:error.retirementPublicationStagePlan || null, retirementPublicationArchivalAuthorizationStatus:error.retirementPublicationArchivalAuthorizationStatus || null }, null, 2) + '\n');
  process.exitCode = 1;
}
