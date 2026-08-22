#!/usr/bin/env node
'use strict';

const fs = require('fs');
const assert = require('assert');
const path = require('path');
const Loop = require('../../../shared/verified-capability-loop/verified-capability-loop');

const workshopRoot = path.resolve(__dirname, '..', '..', '..');
const servicePath = path.join(workshopRoot, 'shared', 'evidence-retention', 'evidence-retention-service.js');
const selftestPath = path.join(workshopRoot, 'shared', 'evidence-retention', 'selftest.js');
const expected = {
  service: 'sha256:496a1288ade34522911dc71e04ffb75dbb7d7738554e86c0bbc4127778e39d67',
  selftest: 'sha256:1db047e8f13353298957a245ad47afde66f3189448f5d246223eadf31fab180f',
  beforeProbe: 'sha256:aeb8edd6324d35302d207349840ec9fa7c0efc026c2d194bb0bc64009dae00b1',
  afterProbe: 'sha256:c2dc648482c61b3bebb3a3d8c534a5c9aaf00948ef5cfa3a9f9694f0c1c6340f'
};

function exactFileReference(file, id, schema, expectedDigest) {
  const ref = Loop.reference(fs.readFileSync(file), { id, schema });
  if (ref.sha256 !== expectedDigest) throw new Error(id + ' changed after the recorded verification; rerun the pilot before issuing a current receipt');
  return ref;
}

function build() {
  const candidateRef = exactFileReference(servicePath, 'evidence-retention-service', 'text/javascript', expected.service);
  const selftestRef = exactFileReference(selftestPath, 'evidence-retention-selftest', 'text/javascript', expected.selftest);
  const verificationRef = Loop.reference({
    subjectDigest: candidateRef.sha256,
    checks: [
      { command: 'node --check shared/evidence-retention/evidence-retention-service.js', result: 'PASS' },
      { command: 'node --check shared/evidence-retention/selftest.js', result: 'PASS' },
      { command: 'node shared/evidence-retention/selftest.js', result: 'PASS', assertions: 27 },
      { probe: 'removed-corrupted-summary-replaced', result: 'PASS', states: ['MISSING', 'CHANGED', 'CHANGED'] }
    ],
    selftestDigest: selftestRef.sha256,
    afterProbeDigest: expected.afterProbe
  }, { id: 'output-availability-focused-verification', schema: 'axm.focused-test-receipt/v1' });

  return Loop.build({
    cycleId: 'cycle-output-availability-20260819',
    capabilityId: 'evidence.registered-source-closure/v1',
    generatedAt: '2026-08-19T03:32:11.325Z',
    baseline: {
      kind: 'git-and-worktree',
      identity: 'public baseline 7147b97f; local head c6e79092; merge base b2ae9a58; public/local divergence 46/3 commits',
      receiptRef: Loop.reference({
        publicBaseline: '7147b97f4852401b118a50422d4d58cdb92c9923',
        localHead: 'c6e7909267f51a6fa14395e46d6917678ef87d06',
        mergeBase: 'b2ae9a589f789834c5fb439e552353cc91654599',
        publicOnlyCommits: 46,
        localOnlyCommits: 3,
        worktreeState: 'DIRTY_SHARED_WORKSPACE'
      }, { id: 'current-baseline-observation', schema: 'axm.baseline-observation/v1' })
    },
    need: {
      id: 'need-output-availability',
      statement: 'Registered raw evidence output must still exist with the registered bytes when a later verifier relies on it.',
      sourceRef: {
        id: '5yff-experimental-run-01',
        schema: 'application/zip',
        sha256: 'sha256:0770f0d915d2d9bbe7bfbc29609dc8fd476d90df23b1e1eee1ccc44bad5b8463'
      },
      directionRef: {
        id: 'long-term-stewardship-blueprint',
        schema: 'text/plain',
        sha256: 'sha256:6846e0665ed709273dab90657e1a8135ce927b65336c743ab258873cfeb752c4'
      }
    },
    gap: {
      state: 'OPEN',
      reason: 'Evidence Retention registered source digests but did not re-check later removal, corruption, or summary replacement.',
      reportRef: {
        id: 'output-availability-before-v2',
        schema: 'text/javascript',
        sha256: expected.beforeProbe
      }
    },
    provenance: [
      { id: 'output-availability-before-v2', schema: 'text/javascript', sha256: expected.beforeProbe },
      { id: 'output-availability-after', schema: 'text/javascript', sha256: expected.afterProbe }
    ],
    candidate: {
      strategy: 'ADAPT',
      status: 'EXPERIMENTAL',
      artifactRef: candidateRef,
      sourceMutationPerformed: true,
      installed: false,
      promoted: false,
      canon: false
    },
    verification: {
      verdict: 'PASS',
      subjectDigest: candidateRef.sha256,
      receiptRef: verificationRef,
      evidenceAuthority: 'MIXED',
      limitations: [
        'Focused local tests cover missing and byte-changed registered files, not every filesystem race or remote storage behavior.',
        'The candidate is a working-tree change and has not been accepted, installed, promoted, or made CANON.'
      ]
    },
    decision: null,
    availability: null,
    refresh: {
      trigger: 'NEW_INFORMATION',
      checkedAt: '2026-08-19T03:32:11.325Z',
      due: false,
      reason: 'Recheck when the candidate bytes, baseline identity, source behavior, or relevant storage contract changes.'
    }
  });
}

function verifyRecorded() {
  const receipt = build();
  const checked = Loop.verify(receipt);
  if (!checked.pass) throw new Error('cycle receipt failed self-verification: ' + checked.errors.join('; '));

  const recorded = JSON.parse(fs.readFileSync(path.join(__dirname, 'output-availability-cycle-receipt.json'), 'utf8'));
  assert.deepStrictEqual(recorded, receipt, 'recorded receipt differs from a fresh exact-source build');
  return { pass: true, state: receipt.state, receiptDigest: receipt.receiptDigest };
}

if (require.main === module) {
  if (process.argv.includes('--check-recorded')) {
    const result = verifyRecorded();
    process.stdout.write('PASS recorded output-availability cycle matches fresh build (' + result.state + ', ' + result.receiptDigest + ')\n');
  } else {
    const receipt = build();
    const checked = Loop.verify(receipt);
    if (!checked.pass) throw new Error('cycle receipt failed self-verification: ' + checked.errors.join('; '));
    process.stdout.write(JSON.stringify(receipt, null, 2) + '\n');
  }
}

module.exports = { build, verifyRecorded };
