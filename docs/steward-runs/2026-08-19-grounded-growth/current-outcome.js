#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Growth = require('../../../shared/grounded-growth-outcomes/grounded-growth-outcomes');
const CapabilityLoop = require('../../../shared/verified-capability-loop/verified-capability-loop');

const root = path.resolve(__dirname, '..', '..', '..');
const files = {
  cycle: path.join(root, 'docs', 'steward-runs', '2026-08-19-5yff-current-reality', 'output-availability-cycle-receipt.json'),
  sourceAudit: path.join(root, 'docs', 'steward-runs', '2026-08-19-5yff-current-reality', 'README.md'),
  evidenceService: path.join(root, 'shared', 'evidence-retention', 'evidence-retention-service.js'),
  evidenceSelftest: path.join(root, 'shared', 'evidence-retention', 'selftest.js'),
  growthCore: path.join(root, 'shared', 'grounded-growth-outcomes', 'grounded-growth-outcomes.js'),
  aiEvaluation: path.join(__dirname, 'ai-workflow-evaluation-receipt.json')
};

const expected = {
  cycle: 'sha256:4e343a3d79cfbc1541400796dd43434cbe060b06376dbaa44b70a3e51e6502ec',
  sourceAudit: 'sha256:47ca39dd75bab57bd2c376edb81d1540f0f6f311d6d5309846c1fc22fc848e42',
  evidenceService: 'sha256:496a1288ade34522911dc71e04ffb75dbb7d7738554e86c0bbc4127778e39d67',
  evidenceSelftest: 'sha256:1db047e8f13353298957a245ad47afde66f3189448f5d246223eadf31fab180f',
  growthCore: 'sha256:04f2de609cb61213271957a148d0ae8fa94685255fa350da56849a9d8480e70d',
  aiEvaluation: 'sha256:5e2f3f837d835ee674505f3e5d1198b5c83b7fe8e56761cb32ff69758094647b'
};

const generatedAt = '2026-08-19T04:20:00.000Z';

function exactFileReference(file, id, schema, expectedDigest) {
  const ref = Growth.reference(fs.readFileSync(file), { id, schema });
  if (ref.sha256 !== expectedDigest) throw new Error(id + ' changed; rebuild the current grounded-growth observation');
  return ref;
}

function build() {
  const cycle = JSON.parse(fs.readFileSync(files.cycle, 'utf8'));
  const checkedCycle = CapabilityLoop.verify(cycle);
  if (!checkedCycle.pass) throw new Error('current capability cycle is invalid: ' + checkedCycle.errors.join('; '));

  const cycleRef = exactFileReference(files.cycle, 'output-availability-cycle-receipt', CapabilityLoop.RECEIPT_SCHEMA, expected.cycle);
  const auditRef = exactFileReference(files.sourceAudit, '5yff-current-reality-audit', 'text/markdown', expected.sourceAudit);
  const serviceRef = exactFileReference(files.evidenceService, 'evidence-retention-service', 'text/javascript', expected.evidenceService);
  const selftestRef = exactFileReference(files.evidenceSelftest, 'evidence-retention-selftest', 'text/javascript', expected.evidenceSelftest);
  const growthCoreRef = exactFileReference(files.growthCore, 'grounded-growth-outcomes-core', 'text/javascript', expected.growthCore);
  const aiEvaluationRef = exactFileReference(files.aiEvaluation, 'evidence-closure-ai-workflow-evaluation', 'axm.ai-workflow-evaluation/v1', expected.aiEvaluation);
  const aiEvaluation = JSON.parse(fs.readFileSync(files.aiEvaluation, 'utf8'));
  const evaluationPayload = JSON.parse(JSON.stringify(aiEvaluation));
  delete evaluationPayload.receiptDigest;
  if (aiEvaluation.schema !== 'axm.ai-workflow-evaluation/v1' || aiEvaluation.verdict !== 'PASS' || aiEvaluation.beneficiary !== 'AI_WORKFLOW') {
    throw new Error('AI-workflow evaluation is not an admitted PASS receipt');
  }
  if (Growth.sha256(evaluationPayload) !== aiEvaluation.receiptDigest) throw new Error('AI-workflow evaluation receipt digest mismatch');
  const aiBaselineRef = Growth.reference(aiEvaluation.baseline, { id: 'ai-workflow-baseline', schema: 'axm.ai-workflow-evaluation-baseline/v1' });
  const aiOutcomeRef = Growth.reference(aiEvaluation.outcome, { id: 'ai-workflow-outcome', schema: 'axm.ai-workflow-evaluation-outcome/v1' });

  const closureObservation = {
    schema: 'axm.evidence-closure-receipt/v1',
    checkedAt: generatedAt,
    state: 'CURRENT',
    sources: [cycleRef, auditRef, serviceRef, selftestRef, aiEvaluationRef, aiBaselineRef, aiOutcomeRef]
  };
  const closure = {
    state: 'CURRENT',
    checkedAt: generatedAt,
    receiptRef: Growth.reference(closureObservation, { id: 'current-grounded-growth-evidence-closure', schema: closureObservation.schema }),
    coveredDigests: closureObservation.sources.map((source) => source.sha256)
  };

  const outcome = Growth.buildOutcome({
    outcomeId: 'grounded-growth-output-availability-20260819',
    generatedAt,
    cycleReceipt: cycle,
    informationRefs: [cycleRef, auditRef, growthCoreRef, aiEvaluationRef],
    claims: [
      {
        id: 'registered-source-closure-system-effect',
        beneficiary: 'SHARED_SYSTEM',
        statement: 'The focused local contract detects a registered source that is missing or byte-changed instead of silently treating it as current.',
        kind: 'DETERMINISTIC_BEHAVIOR',
        verdict: 'PASS',
        proofSurface: 'FOCUSED_RUNTIME',
        baselineRef: auditRef,
        outcomeRef: selftestRef,
        evidenceRefs: [selftestRef, cycleRef],
        evidenceClosure: closure,
        limitations: [
          'The focused proof covers local registered files and the declared negative fixtures, not remote storage or every filesystem race.',
          'The external before/after probe programs remain referenced by digest; this generator rechecks current Workshop receipt and implementation evidence, not external quarantine paths.'
        ]
      },
      {
        id: 'registered-source-closure-human-benefit',
        beneficiary: 'HUMAN',
        statement: 'A human reviewer notices stale evidence sooner and makes fewer mistaken acceptance decisions.',
        kind: 'WORKFLOW_OUTCOME',
        verdict: 'NOT_RUN',
        proofSurface: 'NOT_RUN',
        evidenceRefs: [],
        limitations: [
          'No representative human review journey or comprehension comparison has been run.'
        ]
      },
      {
        id: 'registered-source-closure-ai-workflow-benefit',
        beneficiary: 'AI_WORKFLOW',
        statement: 'An AI-assisted workflow makes fewer unsupported decisions when evidence output has disappeared or changed.',
        kind: 'WORKFLOW_OUTCOME',
        verdict: 'PASS',
        proofSurface: 'AI_WORKFLOW_EVALUATION',
        baselineRef: aiBaselineRef,
        outcomeRef: aiOutcomeRef,
        evidenceRefs: [aiEvaluationRef],
        evidenceClosure: closure,
        limitations: [
          'The deterministic held-out steward workflow improved from 2/6 to 6/6 correct decisions and reduced unsupported CONTINUE decisions from 4 to 0.',
          'No language model was invoked; this proves the bounded workflow guard, not model intelligence, generalization, or weight improvement.'
        ]
      }
    ],
    refresh: {
      checkedAt: generatedAt,
      due: false,
      reason: 'Rebuild when the capability cycle, candidate bytes, evidence selftest, or beneficiary evidence changes.'
    }
  });

  const portfolio = Growth.buildPortfolio({
    portfolioId: 'axm-grounded-growth-current',
    generatedAt,
    outcomes: [outcome]
  });
  return { outcome, portfolio };
}

function verifyRecorded() {
  const current = build();
  const recordedOutcome = JSON.parse(fs.readFileSync(path.join(__dirname, 'current-outcome-receipt.json'), 'utf8'));
  const recordedPortfolio = JSON.parse(fs.readFileSync(path.join(__dirname, 'current-portfolio.json'), 'utf8'));
  assert.deepStrictEqual(recordedOutcome, current.outcome, 'recorded outcome differs from exact current sources');
  assert.deepStrictEqual(recordedPortfolio, current.portfolio, 'recorded portfolio differs from exact current sources');
  const outcomeCheck = Growth.verifyOutcome(recordedOutcome);
  const portfolioCheck = Growth.verifyPortfolio(recordedPortfolio);
  if (!outcomeCheck.pass) throw new Error(outcomeCheck.errors.join('; '));
  if (!portfolioCheck.pass) throw new Error(portfolioCheck.errors.join('; '));
  return {
    outcomeState: recordedOutcome.state,
    portfolioState: recordedPortfolio.summary.overall,
    outcomeDigest: recordedOutcome.receiptDigest,
    portfolioDigest: recordedPortfolio.portfolioDigest
  };
}

if (require.main === module) {
  if (process.argv.includes('--check-recorded')) {
    const result = verifyRecorded();
    process.stdout.write('PASS current grounded-growth records match exact sources (' + result.outcomeState + ', ' + result.portfolioState + ')\n');
  } else {
    process.stdout.write(JSON.stringify(build(), null, 2) + '\n');
  }
}

module.exports = { build, verifyRecorded };
