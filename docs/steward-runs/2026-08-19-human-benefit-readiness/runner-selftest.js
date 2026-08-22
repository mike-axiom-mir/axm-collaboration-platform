'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Human = require('../../../shared/human-benefit-evidence/human-benefit-evidence');
const Current = require('./current-protocol');
const Runner = require('./run-current-human-session');

const configuredRoot = process.env.AXM_TEST_TEMP;
if (!configuredRoot) throw new Error('AXM_TEST_TEMP is required for runner selftest');
const exactRoot = path.resolve(configuredRoot);
if (path.parse(exactRoot).root === exactRoot) throw new Error('AXM_TEST_TEMP cannot be a drive root');
fs.mkdirSync(exactRoot, { recursive: true });
const testRoot = fs.mkdtempSync(path.join(exactRoot, 'human-benefit-runner-'));

let checks = 0;
function ok(value, message) {
  assert.ok(value, message);
  checks += 1;
  console.log('PASS ' + message);
}

function writeFixture(name, value) {
  const target = path.join(testRoot, name);
  fs.writeFileSync(target, JSON.stringify(value, null, 2), 'utf8');
  return target;
}

try {
  assert.throws(
    () => Runner.loadResponse(path.join(__dirname, 'participant-response.example.json')),
    /outside the Workshop repository/
  );
  ok(true, 'runner refuses private live response input inside the repository');

  const forbidden = writeFixture('forbidden.json', {
    schema: 'axm.human-benefit-response-input/v1',
    name: 'must-not-be-retained'
  });
  assert.throws(() => Runner.loadResponse(forbidden), /forbidden or unknown fields: name/);
  ok(true, 'runner refuses raw identity or unknown top-level fields');

  const withdrawalInput = {
    schema: 'axm.human-benefit-response-input/v1',
    sessionId: 'live-withdrawal-runner-check',
    generatedAt: '2026-08-19T05:28:00.000Z',
    fixtureMode: 'LIVE',
    startedAt: '2026-08-19T05:25:00.000Z',
    completedAt: '2026-08-19T05:27:00.000Z',
    consent: {
      mode: 'VOLUNTARY_OPT_IN',
      grantedAt: '2026-08-19T05:24:00.000Z',
      completionConfirmedAt: null,
      withdrawnAt: '2026-08-19T05:26:00.000Z',
      useScope: 'LOCAL_BENEFIT_EVALUATION_ONLY',
      retentionAccepted: 'STRUCTURED_NO_FREE_TEXT'
    },
    observations: [],
    participantJudgment: null
  };
  const withdrawalPath = writeFixture('withdrawal.json', withdrawalInput);
  const loaded = Runner.loadResponse(withdrawalPath);
  const receipt = Human.buildSession(Current.buildCurrentProtocol(), loaded);
  ok(receipt.state === 'WITHDRAWN', 'runner accepts an explicit voluntary withdrawal');
  ok(receipt.participantRef === null && receipt.observations.length === 0 && receipt.participantJudgment === null, 'runner withdrawal retains no participant evidence');
  ok(receipt.usableAsLiveEvidence === false, 'runner withdrawal cannot become live human evidence');
} finally {
  const resolvedTestRoot = fs.realpathSync(testRoot);
  const relative = path.relative(exactRoot, resolvedTestRoot);
  if (!relative || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) {
    throw new Error('refusing unsafe temporary cleanup');
  }
  fs.rmSync(resolvedTestRoot, { recursive: true, force: true });
}

console.log('\nHuman Benefit current runner selftest: PASS (' + checks + ' checks)');
