#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const Core = require('../../../tools/deterministic-json-core');

const ROOT = path.resolve(__dirname, '../../..');
const OUTPUT = path.join(__dirname, 'PHONE_QA_GAP.json');
const GENERATED_AT = '2026-08-20T05:54:00.000Z';
const EXPECTED_ERROR = 'QA Lab device evidence handoff missing';

function sha256(value) {
  return 'sha256:' + crypto.createHash('sha256').update(value).digest('hex');
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function build() {
  const manifest = readJson('tools/browser-lan-hardware-qa-lab/manifest.json');
  const contract = readJson('tools/browser-lan-hardware-qa-lab/module.contract.json');
  const result = spawnSync(process.execPath, ['shared/voluntary-phone-qa-campaign/selftest.js'], {
    cwd: ROOT,
    encoding: 'utf8'
  });
  const combined = String(result.stdout || '') + String(result.stderr || '');
  const requirements = {
    producesDeviceEvidence: manifest.produces.includes('axm.device-qa-evidence/v1'),
    recordsPhysicalPhoneCandidates: manifest.actions.includes('record physical-phone observation candidates'),
    contractEmitsDeviceEvidence: contract.handoffs.emits.includes('axm.device-qa-evidence/v1'),
    refusesSelfAttestedPhysicalProof: contract.boundaries.refuses.includes('self-attested-physical-proof'),
    refusesManifestWarningMutation: contract.boundaries.refuses.includes('manifest-warning-mutation')
  };
  const gapObserved = result.status !== 0 && combined.includes(EXPECTED_ERROR)
    && Object.values(requirements).every((value) => value === false);
  if (!gapObserved) throw new Error('expected voluntary phone QA contract gap was not observed exactly');
  const report = {
    schema: 'axm.voluntary-phone-qa-contract-gap/v1',
    version: '0.1.0',
    generatedAt: GENERATED_AT,
    status: 'TEST',
    state: 'DEFERRED_CONTRACT_AND_EVIDENCE_GAP',
    candidateModule: 'voluntary-phone-qa-campaign',
    currentQaLab: {
      id: manifest.id,
      version: manifest.version,
      manifestProduces: manifest.produces,
      contractEmits: contract.handoffs.emits,
      requirements
    },
    nativeBaseline: {
      command: 'node shared/voluntary-phone-qa-campaign/selftest.js',
      exitCode: result.status,
      expectedFailureObserved: true,
      error: EXPECTED_ERROR
    },
    decision: {
      migratedInThisCohort: false,
      reason: 'The current generic QA Lab does not yet provide the game-specific physical-phone observation candidate contract required by the campaign.',
      fakeManifestOrContractDeclarationsAdded: false,
      requiredCapabilities: [
        'phone.qa.current-contract-compatible',
        'phone.qa.physical-observation-capture'
      ]
    },
    authority: {
      labMutated: false,
      campaignMutated: false,
      promoted: false,
      canonized: false
    },
    digest: null
  };
  const payload = JSON.parse(Core.canonicalJson(report));
  delete payload.digest;
  report.digest = sha256(Core.canonicalJson(payload));
  return report;
}

function write() {
  const report = build();
  fs.writeFileSync(OUTPUT, JSON.stringify(report, null, 2) + '\n', 'utf8');
  return report;
}

function checkRecorded() {
  const expected = build();
  const actual = JSON.parse(fs.readFileSync(OUTPUT, 'utf8'));
  if (Core.canonicalJson(actual) !== Core.canonicalJson(expected)) throw new Error('recorded phone QA gap differs from current evidence');
  return actual;
}

if (require.main === module) {
  const report = process.argv.includes('--write') ? write() : checkRecorded();
  process.stdout.write(JSON.stringify({ state: report.state, error: report.nativeBaseline.error, digest: report.digest }) + '\n');
}

module.exports = { ROOT, OUTPUT, GENERATED_AT, EXPECTED_ERROR, build, write, checkRecorded };
