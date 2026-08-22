#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Growth = require('../../../shared/grounded-growth-outcomes/grounded-growth-outcomes');
const CapabilityLoop = require('../../../shared/verified-capability-loop/verified-capability-loop');
const ResearchRun = require('../2026-08-19-public-baseline-research-run/build-research-run');

const workshopRoot = path.resolve(__dirname, '..', '..', '..');
const generatedAt = '2026-08-19T09:32:00.000Z';

const files = {
  existingOutcome: path.join(workshopRoot, 'docs', 'steward-runs', '2026-08-19-grounded-growth', 'current-outcome-receipt.json'),
  baselineCycle: path.join(workshopRoot, 'docs', 'steward-runs', '2026-08-19-baseline-simulation-lab', 'EXISTING_CAPABILITY_CYCLE.json'),
  baselineObservation: path.join(workshopRoot, 'docs', 'steward-runs', '2026-08-19-baseline-simulation-lab', 'LIVE_COMPARISON_OBSERVATION.json'),
  baselineVerification: path.join(workshopRoot, 'docs', 'steward-runs', '2026-08-19-baseline-simulation-lab', 'VERIFICATION_RECEIPT.json'),
  baselineSelftest: path.join(workshopRoot, 'docs', 'steward-runs', '2026-08-19-baseline-simulation-lab', 'selftest.js'),
  researchBuilder: path.join(workshopRoot, 'docs', 'steward-runs', '2026-08-19-public-baseline-research-run', 'build-research-run.js'),
  researchSummary: path.join(workshopRoot, 'docs', 'steward-runs', '2026-08-19-public-baseline-research-run', 'RUN_SUMMARY.json'),
  researchDisposition: path.join(workshopRoot, 'docs', 'steward-runs', '2026-08-19-public-baseline-research-run', 'RESEARCH_DISPOSITION.json'),
  researchVerification: path.join(workshopRoot, 'docs', 'steward-runs', '2026-08-19-public-baseline-research-run', 'VERIFICATION_RECEIPT.json'),
  researchSelftest: path.join(workshopRoot, 'docs', 'steward-runs', '2026-08-19-public-baseline-research-run', 'selftest.js'),
  packageBefore: path.join(__dirname, 'PACKAGE_ROUTE_BEFORE_OBSERVATION.json'),
  packageTest: path.join(workshopRoot, 'tests', 'tool-forge-package-test.js'),
  packageAuditReadme: path.join(workshopRoot, 'docs', 'steward-runs', '2026-08-19-workspace-local-package-proof', 'README.md'),
  packageRouteEvidence: path.join(workshopRoot, 'docs', 'steward-runs', '2026-08-19-workspace-local-package-proof', 'EVIDENCE_ROUTE.json'),
  packageVerification: path.join(workshopRoot, 'docs', 'steward-runs', '2026-08-19-workspace-local-package-proof', 'VERIFICATION_RECEIPT.json'),
  packageSelftest: path.join(workshopRoot, 'docs', 'steward-runs', '2026-08-19-workspace-local-package-proof', 'selftest.js')
};

const expected = {
  existingOutcome: 'sha256:a2eda8906048d6945e3102b3e007d3daa50dbfb66e2138cbca87c4c7fb71da55',
  baselineCycle: 'sha256:6f6c00b3dbe20dfc0919464691b514df35901643ee985baaa5e6b14cd012fd52',
  baselineObservation: 'sha256:30cf4c7ffb4cde6745babca57884f75a2f915bf64b3ba40b8981dc6e04a3b8ac',
  baselineVerification: 'sha256:b1c2d1bc5903173afa56b64acc67aee85901e37c132a16bc48e77b6d664df6a1',
  baselineSelftest: 'sha256:5aa7cc83739914b31cba5b6c30af8ae6b9c12397bf2cb767ec1d07d3fe88fe93',
  researchBuilder: 'sha256:591cad07974311797017fbee94efe2ddef3c17297d07a8b0c006056e0e4f4665',
  researchSummary: 'sha256:115e2a4e0d03dfc73da48c67d734215b69d9301a00a4bf420ea21b654f969f55',
  researchDisposition: 'sha256:1cc351246cfe6f2500de91b7e21d801520f26ee1e9455aecc081de49b9c01f5b',
  researchVerification: 'sha256:7a202932e3689b0b7cf9ddd632cb59d18552cb94ef3a0cc0e9371143b0f8d934',
  researchSelftest: 'sha256:2e3299deae8791baf400a8b2b2f024d06d3a962f1a1f84b9e4b7a60f07d24f5c',
  packageBefore: 'sha256:ed79e5c2e4427ed6ba546346c0797fa1648257899faf602e9110adbc001f1f97',
  packageTest: 'sha256:250046ca9c8fdf0b094a13929b40b29019581020e747383bce5fb75b0df6b6bb',
  packageAuditReadme: 'sha256:e552f93146de0a14d84497a106466b78a01db31dbe2e632e7c30f566953bff40',
  packageRouteEvidence: 'sha256:b241a2b01f9684003523d050a6217f5ebf64bd6aaa224c483f0160da45d88a13',
  packageVerification: 'sha256:cab8bc4ace75df5f70463534f037b6381f01dd707aba50ad86108d4f19d963db',
  packageSelftest: 'sha256:96f023011f12ab1c3419d3971714fe5e65788efc22ac44de87c1d05256f38e35'
};

function exactFileReference(key, id, schema) {
  const bytes = fs.readFileSync(files[key]);
  const ref = Growth.reference(bytes, { id, schema });
  if (ref.sha256 !== expected[key]) throw new Error(key + ' changed; refresh the portfolio from current evidence');
  return ref;
}

function closure(id, sources) {
  const observation = {
    schema: 'axm.evidence-closure-receipt/v1',
    checkedAt: generatedAt,
    state: 'CURRENT',
    sources
  };
  return {
    state: 'CURRENT',
    checkedAt: generatedAt,
    receiptRef: Growth.reference(observation, { id, schema: observation.schema }),
    coveredDigests: sources.map(source => source.sha256)
  };
}

function notRunClaims(prefix, humanStatement, aiStatement) {
  return [
    {
      id: prefix + '-human-benefit',
      beneficiary: 'HUMAN',
      statement: humanStatement,
      kind: 'WORKFLOW_OUTCOME',
      verdict: 'NOT_RUN',
      proofSurface: 'NOT_RUN',
      evidenceRefs: [],
      limitations: ['No representative voluntary human outcome evidence was supplied after this technical result.']
    },
    {
      id: prefix + '-ai-workflow-benefit',
      beneficiary: 'AI_WORKFLOW',
      statement: aiStatement,
      kind: 'WORKFLOW_OUTCOME',
      verdict: 'NOT_RUN',
      proofSurface: 'NOT_RUN',
      evidenceRefs: [],
      limitations: ['Deterministic component checks do not by themselves prove an AI-assisted workflow outcome or model improvement.']
    }
  ];
}

async function build() {
  const existingOutcomeRef = exactFileReference('existingOutcome', 'grounded-growth-output-availability-20260819', Growth.OUTCOME_SCHEMA);
  const existingOutcome = JSON.parse(fs.readFileSync(files.existingOutcome, 'utf8'));
  const existingCheck = Growth.verifyOutcome(existingOutcome);
  if (!existingCheck.pass) throw new Error('existing grounded outcome is invalid: ' + existingCheck.errors.join('; '));

  const baselineCycleRef = exactFileReference('baselineCycle', 'portable-baseline-existing-capability-cycle', CapabilityLoop.RECEIPT_SCHEMA);
  const baselineObservationRef = exactFileReference('baselineObservation', 'live-portable-baseline-no-new-observation', 'axm.baseline-comparison-observation/v1');
  const baselineVerificationRef = exactFileReference('baselineVerification', 'baseline-simulation-lab-verification', 'axm.steward-verification-receipt/v1');
  const baselineSelftestRef = exactFileReference('baselineSelftest', 'baseline-simulation-lab-focused-selftest', 'text/javascript');
  const baselineCycle = JSON.parse(fs.readFileSync(files.baselineCycle, 'utf8'));
  const baselineCycleCheck = CapabilityLoop.verify(baselineCycle);
  if (!baselineCycleCheck.pass) throw new Error('baseline capability cycle is invalid: ' + baselineCycleCheck.errors.join('; '));
  const baselineClosure = closure('grounded-growth-baseline-lab-closure', [
    baselineCycle.baseline.receiptRef,
    baselineObservationRef,
    baselineSelftestRef,
    baselineVerificationRef,
    baselineCycleRef
  ]);
  const baselineOutcome = Growth.buildOutcome({
    outcomeId: 'grounded-growth-baseline-no-new-stop-20260819',
    generatedAt: '2026-08-19T09:32:00.000Z',
    cycleReceipt: baselineCycle,
    informationRefs: [baselineCycleRef, baselineObservationRef, baselineVerificationRef],
    claims: [
      {
        id: 'baseline-no-new-stop-system-effect',
        beneficiary: 'SHARED_SYSTEM',
        statement: 'An unchanged exact portable baseline returns NO_NEW_INFORMATION, performs zero generation work, and grants no automatic action.',
        kind: 'DETERMINISTIC_BEHAVIOR',
        verdict: 'PASS',
        proofSurface: 'FOCUSED_RUNTIME',
        baselineRef: baselineCycle.baseline.receiptRef,
        outcomeRef: baselineObservationRef,
        evidenceRefs: [baselineSelftestRef, baselineVerificationRef, baselineCycleRef],
        evidenceClosure: baselineClosure,
        limitations: [
          'This proves the bounded TEST lab path for the recorded baseline, not every software, Mirror, or specialist-mask adapter.',
          'REUSE_EXISTING is not governed availability and does not establish beneficiary growth.'
        ]
      },
      ...notRunClaims(
        'baseline-no-new-stop',
        'A human steward spends less effort reviewing recursive no-change output.',
        'An AI-assisted workflow avoids waste and unsupported recursive continuation on unchanged evidence.'
      )
    ],
    refresh: {
      checkedAt: generatedAt,
      due: false,
      reason: 'Rebuild when the portable baseline, comparison evidence, or lab verifier changes.'
    }
  });

  const researchBuilderRef = exactFileReference('researchBuilder', 'public-baseline-research-run-builder', 'text/javascript');
  const researchSummaryRef = exactFileReference('researchSummary', 'public-baseline-research-run-summary', 'axm.baseline-simulation-lab-run-summary/v1');
  const researchDispositionRef = exactFileReference('researchDisposition', 'public-baseline-research-disposition', 'axm.research-disposition/v1');
  const researchVerificationRef = exactFileReference('researchVerification', 'public-baseline-research-verification', 'axm.steward-verification-receipt/v1');
  const researchSelftestRef = exactFileReference('researchSelftest', 'public-baseline-research-focused-selftest', 'text/javascript');
  const researchRun = await ResearchRun.buildResearchRun();
  const researchCycle = researchRun.cycleReceipt;
  const researchCycleCheck = CapabilityLoop.verify(researchCycle);
  if (!researchCycleCheck.pass) throw new Error('research capability cycle is invalid: ' + researchCycleCheck.errors.join('; '));
  const researchRunRef = Growth.reference(researchRun, { id: researchRun.runId, schema: researchRun.schema });
  const researchClosure = closure('grounded-growth-research-replay-closure', [
    researchCycle.baseline.receiptRef,
    researchSummaryRef,
    researchDispositionRef,
    researchVerificationRef,
    researchSelftestRef,
    researchRunRef,
    researchBuilderRef
  ]);
  const researchOutcome = Growth.buildOutcome({
    outcomeId: 'grounded-growth-public-research-replay-20260819',
    generatedAt: '2026-08-19T09:32:01.000Z',
    cycleReceipt: researchCycle,
    informationRefs: [researchBuilderRef, researchRunRef, researchSummaryRef, researchDispositionRef, researchVerificationRef],
    claims: [
      {
        id: 'public-research-replay-system-effect',
        beneficiary: 'SHARED_SYSTEM',
        statement: 'Seven exact research artifacts and four user-reported model-family seats are converted into typed signals, explicit refusals, exact closures, and a reusable receipt without treating agreement as proof.',
        kind: 'DETERMINISTIC_BEHAVIOR',
        verdict: 'PASS',
        proofSurface: 'FOCUSED_RUNTIME',
        baselineRef: researchCycle.baseline.receiptRef,
        outcomeRef: researchSummaryRef,
        evidenceRefs: [researchDispositionRef, researchSelftestRef, researchVerificationRef, researchRunRef],
        evidenceClosure: researchClosure,
        limitations: [
          'Exact model IDs, artifact-to-model mapping, prior-output exposure, and cross-model independence remain unknown.',
          'The lab invoked no model and proves no learning improvement, intelligence gain, or human benefit.'
        ]
      },
      ...notRunClaims(
        'public-research-replay',
        'A human steward gains clearer understanding or better decisions from the grounded research disposition.',
        'An AI-assisted workflow makes better held-out decisions after consuming the grounded research disposition.'
      )
    ],
    refresh: {
      checkedAt: generatedAt,
      due: false,
      reason: 'Rebuild when the public baseline, research bytes, disposition, or bounded run verifier changes.'
    }
  });

  const packageBeforeRef = exactFileReference('packageBefore', 'tool-forge-package-proof-before-route', 'axm.test-artifact-route-observation/v1');
  const packageTestRef = exactFileReference('packageTest', 'tool-forge-package-proof-candidate', 'text/javascript');
  const packageAuditReadmeRef = exactFileReference('packageAuditReadme', 'workspace-local-package-proof-audit', 'text/markdown');
  const packageRouteEvidenceRef = exactFileReference('packageRouteEvidence', 'workspace-local-package-proof-evidence-route', 'axm.evidence-route/v1');
  const packageVerificationRef = exactFileReference('packageVerification', 'workspace-local-package-proof-verification', 'axm.steward-verification-receipt/v1');
  const packageSelftestRef = exactFileReference('packageSelftest', 'workspace-local-package-proof-focused-selftest', 'text/javascript');
  const packageCycle = CapabilityLoop.build({
    cycleId: 'cycle:tool-forge-package-proof-workspace-local-route',
    capabilityId: 'test.tool-forge.package-proof.workspace-local-route',
    generatedAt: '2026-08-19T09:32:02.000Z',
    baseline: {
      kind: 'TEST_SCRIPT',
      identity: 'tests/tool-forge-package-test.js@' + packageBeforeRef.sha256,
      receiptRef: packageBeforeRef
    },
    need: {
      id: 'need:keep-required-package-proof-on-current-workspace-drive',
      statement: 'The repository-required Tool Forge package proof must not persist hidden artifacts on a different host drive than the active Workshop.',
      sourceRef: packageBeforeRef,
      directionRef: null
    },
    gap: {
      state: 'OPEN',
      reason: 'The previous test used host OS temp on C and left its proof ZIP after returning from the D-rooted Workshop.',
      reportRef: packageRouteEvidenceRef,
      existingCapabilityRef: null
    },
    provenance: [packageBeforeRef, packageAuditReadmeRef],
    candidate: {
      strategy: 'ADAPT',
      status: 'EXPERIMENTAL',
      artifactRef: packageTestRef,
      sourceMutationPerformed: true,
      installed: false,
      promoted: false,
      canon: false
    },
    verification: {
      verdict: 'PASS',
      subjectDigest: packageTestRef.sha256,
      receiptRef: packageVerificationRef,
      evidenceAuthority: 'MIXED',
      limitations: [
        'The focused verifier covers the required Node package proof, including hostile C-temp environment routing.',
        'Browser, Codex clipboard, and application download destinations remain host or user settings outside this candidate.'
      ]
    },
    decision: null,
    availability: null,
    refresh: {
      trigger: 'NEW_INFORMATION',
      checkedAt: generatedAt,
      due: false,
      reason: 'Recheck when the test candidate, package builder, workspace root, or filesystem-routing evidence changes.'
    }
  });
  const packageCycleRef = Growth.reference(packageCycle, { id: packageCycle.cycleId, schema: packageCycle.schema });
  const packageClosure = closure('grounded-growth-package-route-closure', [
    packageBeforeRef,
    packageVerificationRef,
    packageSelftestRef,
    packageTestRef,
    packageCycleRef
  ]);
  const packageOutcome = Growth.buildOutcome({
    outcomeId: 'grounded-growth-workspace-local-package-proof-20260819',
    generatedAt: '2026-08-19T09:32:03.000Z',
    cycleReceipt: packageCycle,
    informationRefs: [packageCycleRef, packageBeforeRef, packageTestRef, packageVerificationRef, packageRouteEvidenceRef],
    claims: [
      {
        id: 'workspace-local-package-proof-system-effect',
        beneficiary: 'SHARED_SYSTEM',
        statement: 'The required package proof writes and verifies transiently under the active D Workshop, cleans before return, and creates no new matching C-temp proof ZIP.',
        kind: 'DETERMINISTIC_BEHAVIOR',
        verdict: 'PASS',
        proofSurface: 'FOCUSED_RUNTIME',
        baselineRef: packageBeforeRef,
        outcomeRef: packageVerificationRef,
        evidenceRefs: [packageSelftestRef, packageTestRef, packageCycleRef],
        evidenceClosure: packageClosure,
        limitations: [
          'This covers the repository-required Node proof only, not host-controlled downloads.',
          'Historical C-temp files and one retained diagnostic reproduction remain outside the technical route result.'
        ]
      },
      ...notRunClaims(
        'workspace-local-package-proof',
        'The repaired route reduces a human steward\'s confusion, cleanup burden, or cross-drive surprise.',
        'An AI-assisted steward workflow becomes measurably more reliable or efficient because the package proof is workspace-local.'
      )
    ],
    refresh: {
      checkedAt: generatedAt,
      due: false,
      reason: 'Rebuild after human review, governed availability, or any package-route source or verifier change.'
    }
  });

  const outcomes = [existingOutcome, baselineOutcome, researchOutcome, packageOutcome];
  const portfolio = Growth.buildPortfolio({
    portfolioId: 'axm-grounded-growth-current-refresh-20260819',
    generatedAt: '2026-08-19T09:32:04.000Z',
    outcomes
  });
  const beneficiaryVerdicts = {};
  for (const outcome of outcomes) {
    for (const claim of outcome.claims) {
      const key = claim.beneficiary + ':' + claim.admittedVerdict;
      beneficiaryVerdicts[key] = (beneficiaryVerdicts[key] || 0) + 1;
    }
  }
  const summary = {
    schema: 'axm.grounded-growth-current-refresh-summary/v1',
    generatedAt: '2026-08-19T09:32:04.000Z',
    portfolioRef: {
      id: portfolio.portfolioId,
      schema: portfolio.schema,
      sha256: portfolio.portfolioDigest
    },
    sourceOutcomeRef: existingOutcomeRef,
    capabilityCount: portfolio.summary.capabilityCount,
    outcomeCount: portfolio.summary.outcomeCount,
    overall: portfolio.summary.overall,
    stateCounts: portfolio.summary.stateCounts,
    beneficiaryVerdicts,
    systemEffectsAdmitted: outcomes.reduce((count, outcome) => count + outcome.claims.filter(claim => claim.beneficiary === 'SHARED_SYSTEM' && claim.admittedVerdict === 'PASS').length, 0),
    aiWorkflowBenefitsAdmitted: outcomes.reduce((count, outcome) => count + outcome.claims.filter(claim => claim.beneficiary === 'AI_WORKFLOW' && claim.admittedVerdict === 'PASS').length, 0),
    humanBenefitsAdmitted: outcomes.reduce((count, outcome) => count + outcome.claims.filter(claim => claim.beneficiary === 'HUMAN' && claim.admittedVerdict === 'PASS').length, 0),
    nextEvidenceNeeds: Array.from(new Set(portfolio.latest.flatMap(item => item.nextEvidenceNeeds))).sort(),
    truth: {
      portfolioIsDerivedView: true,
      laterTechnicalWorkNowAccountedFor: true,
      systemEffectIsBeneficiaryGrowth: false,
      humanBenefitEstablished: false,
      newAiWorkflowBenefitEstablished: false,
      priorAiWorkflowBenefitPreserved: true,
      modelWeightTrainingClaimed: false,
      crossModelAgreementTreatedAsProof: false,
      automaticExecution: false,
      automaticPromotion: false,
      automaticCanon: false
    },
    summaryDigest: null
  };
  const summaryPayload = JSON.parse(JSON.stringify(summary));
  delete summaryPayload.summaryDigest;
  summary.summaryDigest = Growth.sha256(summaryPayload);

  return {
    packageRouteCycle: packageCycle,
    outcomes: {
      priorSourceClosure: existingOutcome,
      baselineLab: baselineOutcome,
      publicResearchReplay: researchOutcome,
      workspaceLocalPackageProof: packageOutcome
    },
    portfolio,
    summary
  };
}

async function verifyRecorded() {
  const current = await build();
  const recorded = {
    packageRouteCycle: JSON.parse(fs.readFileSync(path.join(__dirname, 'PACKAGE_ROUTE_CYCLE.json'), 'utf8')),
    baselineLab: JSON.parse(fs.readFileSync(path.join(__dirname, 'BASELINE_LAB_OUTCOME.json'), 'utf8')),
    publicResearchReplay: JSON.parse(fs.readFileSync(path.join(__dirname, 'PUBLIC_RESEARCH_OUTCOME.json'), 'utf8')),
    workspaceLocalPackageProof: JSON.parse(fs.readFileSync(path.join(__dirname, 'PACKAGE_ROUTE_OUTCOME.json'), 'utf8')),
    portfolio: JSON.parse(fs.readFileSync(path.join(__dirname, 'CURRENT_PORTFOLIO.json'), 'utf8')),
    summary: JSON.parse(fs.readFileSync(path.join(__dirname, 'CURRENT_SUMMARY.json'), 'utf8'))
  };
  assert.deepStrictEqual(recorded.packageRouteCycle, current.packageRouteCycle);
  assert.deepStrictEqual(recorded.baselineLab, current.outcomes.baselineLab);
  assert.deepStrictEqual(recorded.publicResearchReplay, current.outcomes.publicResearchReplay);
  assert.deepStrictEqual(recorded.workspaceLocalPackageProof, current.outcomes.workspaceLocalPackageProof);
  assert.deepStrictEqual(recorded.portfolio, current.portfolio);
  assert.deepStrictEqual(recorded.summary, current.summary);
  return current.summary;
}

if (require.main === module) {
  const action = process.argv.includes('--check-recorded') ? verifyRecorded() : build();
  action.then(result => process.stdout.write(JSON.stringify(result, null, 2) + '\n')).catch(error => {
    process.stderr.write((error.stack || error.message) + '\n');
    process.exitCode = 1;
  });
}

module.exports = { build, verifyRecorded };
