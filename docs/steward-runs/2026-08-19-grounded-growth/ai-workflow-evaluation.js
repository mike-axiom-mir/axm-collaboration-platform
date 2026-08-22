#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Retention = require('../../../shared/evidence-retention/evidence-retention-service');
const Growth = require('../../../shared/grounded-growth-outcomes/grounded-growth-outcomes');

const SCHEMA = 'axm.ai-workflow-evaluation/v1';
const generatedAt = '2026-08-19T04:32:00.000Z';

function safeTempBase() {
  const configured = process.env.AXM_TEST_TEMP;
  if (!configured) throw new Error('AXM_TEST_TEMP is required so this evaluation cannot silently use the system drive');
  const base = path.resolve(configured);
  if (base === path.parse(base).root) throw new Error('AXM_TEST_TEMP must not be a drive root');
  fs.mkdirSync(base, { recursive: true });
  return base;
}

function writeRaw(file, id) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ type: 'raw-evidence', id, payload: 'complete' }) + '\n', 'utf8');
}

function build() {
  const base = safeTempBase();
  const runRoot = fs.mkdtempSync(path.join(base, 'axm-grounded-growth-ai-'));
  const stateRoot = path.join(runRoot, 'state');
  const evidenceDir = path.join(stateRoot, 'held-out-evidence');
  const cases = [
    { id: 'unchanged-a', mutation: 'NONE', expectedDecision: 'CONTINUE' },
    { id: 'append-after-registration', mutation: 'APPEND', expectedDecision: 'HOLD' },
    { id: 'zero-byte-after-registration', mutation: 'ZERO', expectedDecision: 'HOLD' },
    { id: 'directory-replaces-file', mutation: 'DIRECTORY', expectedDecision: 'HOLD' },
    { id: 'moved-after-registration', mutation: 'MOVE', expectedDecision: 'HOLD' },
    { id: 'unchanged-b', mutation: 'NONE', expectedDecision: 'CONTINUE' }
  ];
  const files = new Map();

  try {
    for (const testCase of cases) {
      const file = path.join(evidenceDir, testCase.id + '.jsonl');
      writeRaw(file, testCase.id);
      files.set(testCase.id, file);
    }
    const manager = Retention.create({ stateRoot, limits: { maxSourceClosureItems: 16 } });
    const registered = new Set(files.values());

    fs.appendFileSync(files.get('append-after-registration'), JSON.stringify({ type: 'late-extra-record' }) + '\n', 'utf8');
    fs.writeFileSync(files.get('zero-byte-after-registration'), '', 'utf8');
    fs.unlinkSync(files.get('directory-replaces-file'));
    fs.mkdirSync(files.get('directory-replaces-file'));
    fs.renameSync(files.get('moved-after-registration'), path.join(evidenceDir, 'moved-away.jsonl'));

    const results = cases.map((testCase) => {
      const file = files.get(testCase.id);
      const closure = manager.verifySource(file);
      const baselineDecision = registered.has(file) ? 'CONTINUE' : 'HOLD';
      const candidateDecision = closure.state === 'CURRENT' ? 'CONTINUE' : 'HOLD';
      return {
        id: testCase.id,
        mutation: testCase.mutation,
        expectedDecision: testCase.expectedDecision,
        closureState: closure.state,
        baselineDecision,
        candidateDecision,
        baselineCorrect: baselineDecision === testCase.expectedDecision,
        candidateCorrect: candidateDecision === testCase.expectedDecision
      };
    });

    const baseline = {
      policy: 'REGISTERED_IDENTITY_WITHOUT_LATER_CLOSURE_CHECK',
      correctDecisions: results.filter((item) => item.baselineCorrect).length,
      totalDecisions: results.length,
      unsupportedContinueDecisions: results.filter((item) => item.baselineDecision === 'CONTINUE' && item.expectedDecision === 'HOLD').length
    };
    const outcome = {
      policy: 'REGISTERED_IDENTITY_WITH_EXACT_LATER_CLOSURE_CHECK',
      correctDecisions: results.filter((item) => item.candidateCorrect).length,
      totalDecisions: results.length,
      unsupportedContinueDecisions: results.filter((item) => item.candidateDecision === 'CONTINUE' && item.expectedDecision === 'HOLD').length,
      newlyPreventedUnsupportedContinues: results.filter((item) => !item.baselineCorrect && item.candidateCorrect).length
    };
    const verdict = outcome.correctDecisions === results.length && outcome.unsupportedContinueDecisions === 0 && baseline.unsupportedContinueDecisions > 0 ? 'PASS' : 'FAIL';
    const receipt = {
      schema: SCHEMA,
      version: '0.1.0',
      evaluationId: 'evidence-closure-ai-steward-held-out-20260819',
      generatedAt,
      beneficiary: 'AI_WORKFLOW',
      workflow: 'Evidence-dependent steward decision: CONTINUE only when every relied-on registered source remains byte-current.',
      proofSurface: 'AI_WORKFLOW_EVALUATION',
      heldOutCasePolicy: 'Exact append, zero-byte, wrong-type, move, and unchanged cases were not used by the implementation under evaluation.',
      baseline,
      outcome,
      cases: results,
      verdict,
      limitations: [
        'This is a deterministic steward-workflow evaluation, not an LLM, provider, model-weight, intelligence, or generalization evaluation.',
        'It proves the decision guard for local registered files under these six cases, not remote storage or every filesystem race.',
        'The repaired capability remains a TEST candidate awaiting the separate Workshop steward and availability gates.'
      ],
      truth: {
        modelInvoked: false,
        modelWeightsChanged: false,
        humanBenefitClaimed: false,
        automaticAuthority: false,
        temporaryPathsRetained: false
      },
      receiptDigest: null
    };
    const payload = JSON.parse(JSON.stringify(receipt));
    delete payload.receiptDigest;
    receipt.receiptDigest = Growth.sha256(payload);
    return receipt;
  } finally {
    Retention.resetForTests();
    const resolvedBase = path.resolve(base) + path.sep;
    const resolvedRun = path.resolve(runRoot);
    if (!resolvedRun.toLowerCase().startsWith(resolvedBase.toLowerCase()) || !path.basename(resolvedRun).startsWith('axm-grounded-growth-ai-')) {
      throw new Error('refusing to clean an unexpected evaluation path');
    }
    fs.rmSync(resolvedRun, { recursive: true, force: true });
  }
}

function verifyRecorded() {
  const current = build();
  const recorded = JSON.parse(fs.readFileSync(path.join(__dirname, 'ai-workflow-evaluation-receipt.json'), 'utf8'));
  assert.deepStrictEqual(recorded, current, 'recorded AI-workflow evaluation differs from a fresh held-out run');
  return current;
}

if (require.main === module) {
  if (process.argv.includes('--check-recorded')) {
    const receipt = verifyRecorded();
    process.stdout.write('PASS AI-workflow evaluation matches a fresh held-out run (' + receipt.outcome.correctDecisions + '/' + receipt.outcome.totalDecisions + ', unsupported CONTINUE ' + receipt.baseline.unsupportedContinueDecisions + ' -> ' + receipt.outcome.unsupportedContinueDecisions + ')\n');
  } else {
    process.stdout.write(JSON.stringify(build(), null, 2) + '\n');
  }
}

module.exports = { SCHEMA, build, verifyRecorded };
