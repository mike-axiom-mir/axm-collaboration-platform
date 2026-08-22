#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Intake = require('../../../shared/research-contribution-intake/research-contribution-intake');
const Capsule = require('../../../shared/portable-baseline-capsule/portable-baseline-capsule');

const ROOT = path.resolve(__dirname, '../../..');
const SOURCE = path.join(ROOT, 'docs', 'steward-runs', '2026-08-19-public-baseline-research-run');
const GENERATED_AT = '2026-08-19T17:10:00.000Z';

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function fileRef(file, id, schema) {
  return { id, schema, sha256: Intake.sha256(fs.readFileSync(file)) };
}

function build() {
  const manifestFile = path.join(SOURCE, 'RESEARCH_INPUT_MANIFEST.json');
  const provenanceFile = path.join(SOURCE, 'USER_REPORTED_SEAT_PROVENANCE.json');
  const dispositionFile = path.join(SOURCE, 'RESEARCH_DISPOSITION.json');
  const capsuleFile = path.join(SOURCE, 'PUBLIC_BASELINE_CAPSULE.json');
  const realityFile = path.join(ROOT, 'docs', 'steward-runs', '2026-08-19-5yff-current-reality', 'README.md');
  const intakeFile = path.join(ROOT, 'shared', 'research-contribution-intake', 'research-contribution-intake.js');

  const manifest = readJson(manifestFile);
  const provenance = readJson(provenanceFile);
  const disposition = readJson(dispositionFile);
  const capsule = readJson(capsuleFile);
  const artifactIds = new Set(manifest.artifacts.map(artifact => artifact.id));
  const provenanceRef = fileRef(provenanceFile, 'research:user-reported-seat-provenance', provenance.schema);
  const realitySourceId = 'evidence:5yff-current-reality-review';
  const curatorSeatId = 'keel-codex-technical-steward';

  function sources(signal) {
    const ids = signal.sourceIds || [];
    return {
      artifactIds: ids.filter(id => artifactIds.has(id)),
      evidenceSourceIds: ids.includes('audit:5yff-current-reality') ? [realitySourceId] : []
    };
  }

  const bundle = {
    schema: Intake.BUNDLE_SCHEMA,
    version: Intake.VERSION,
    bundleId: 'bundle:public-baseline-5yff-research-contribution',
    baselineRef: Capsule.capsuleReference(capsule),
    sourceHandling: 'DATA_ONLY_NO_PACKAGE_CODE_EXECUTION',
    artifacts: manifest.artifacts.map(artifact => ({
      id: artifact.id,
      label: artifact.label,
      mediaType: artifact.mediaType,
      bytes: artifact.bytes,
      sha256: artifact.sha256,
      reportedSeatIds: []
    })),
    seats: provenance.seats.map(seat => ({
      id: seat.id,
      kind: 'MODEL',
      role: 'user-reported historical research participant',
      providerFamily: seat.providerFamily,
      modelId: seat.modelId,
      identityDisclosure: seat.identityDisclosure,
      priorOutputExposure: seat.priorOutputExposure,
      provenanceRef,
      proofAuthority: 'NONE'
    })).concat([{
      id: curatorSeatId,
      kind: 'TOOL',
      role: 'current bounded research-signal curator and contract validator',
      providerFamily: 'OpenAI Codex',
      modelId: null,
      identityDisclosure: 'PARTIAL',
      priorOutputExposure: 'FULL',
      provenanceRef: fileRef(intakeFile, 'capability:research-contribution-intake', 'text/javascript'),
      proofAuthority: 'NONE'
    }]),
    evidenceSources: [{
      id: realitySourceId,
      ref: fileRef(realityFile, 'audit:5yff-current-reality', 'text/markdown'),
      surface: 'acceptance-review',
      claimKinds: ['existence', 'quality', 'static structure']
    }],
    signals: disposition.acceptedSignals.map(signal => {
      const source = sources(signal);
      return {
        id: signal.id,
        statement: signal.statement,
        evidenceStage: signal.stage,
        artifactIds: source.artifactIds,
        evidenceSourceIds: source.evidenceSourceIds,
        seatIds: [curatorSeatId],
        cheapestTest: signal.cheapestTest,
        uncertainty: signal.uncertainty,
        solutionAlternatives: signal.solutionAlternatives,
        contradictions: signal.stage === 'UNKNOWN' ? ['No voluntary human-native comparison receipt exists.'] : [],
        wildcard: false
      };
    }),
    proposals: disposition.rejectedOrDeferred.map(proposal => ({
      id: proposal.id,
      statement: null,
      disposition: proposal.disposition,
      reason: proposal.reason,
      artifactIds: [],
      evidenceSourceIds: [realitySourceId],
      seatIds: [curatorSeatId]
    })),
    truth: {
      artifactBytesEmbedded: false,
      packageCodeExecuted: false,
      modelInvoked: false,
      crossModelAgreementIsProof: false,
      automaticAcceptance: false,
      automaticBuild: false,
      automaticPromotion: false,
      automaticCanon: false
    }
  };

  return Intake.buildAssessment({
    assessmentId: 'assessment:public-baseline-5yff-research-contribution',
    generatedAt: GENERATED_AT,
    bundle
  });
}

function summary(assessment) {
  const result = {
    schema: 'axm.research-contribution-current-summary/v1',
    generatedAt: assessment.generatedAt,
    state: assessment.state,
    assessmentRef: {
      id: assessment.assessmentId,
      schema: assessment.schema,
      sha256: assessment.receiptDigest
    },
    counts: assessment.counts,
    openEvidence: assessment.warnings.map(item => item.code),
    nextRoutes: [
      'Route a future inert research feed through this intake before Baseline Simulation Lab planning.',
      'Route executable branch code separately through Simulation Lab Extension Intake.',
      'Require held-out evaluation for learning improvement and voluntary human evidence for human benefit.'
    ],
    truth: {
      historicalResearchValuePreviouslyEstablishedForBoundedAiWorkflow: true,
      newLearningClaim: false,
      humanBenefitClaim: false,
      sourceExecuted: false,
      automaticAction: false,
      automaticCanon: false
    }
  };
  result.summaryDigest = Intake.sha256(result);
  return result;
}

function current() {
  return {
    assessment: readJson(path.join(__dirname, 'CURRENT_RESEARCH_CONTRIBUTION_ASSESSMENT.json')),
    summary: readJson(path.join(__dirname, 'CURRENT_SUMMARY.json'))
  };
}

function write() {
  const assessment = build();
  const currentSummary = summary(assessment);
  fs.writeFileSync(path.join(__dirname, 'CURRENT_RESEARCH_CONTRIBUTION_ASSESSMENT.json'), JSON.stringify(assessment, null, 2) + '\n');
  fs.writeFileSync(path.join(__dirname, 'CURRENT_SUMMARY.json'), JSON.stringify(currentSummary, null, 2) + '\n');
  return { assessment, summary: currentSummary };
}

module.exports = { build, summary, current, write };

if (require.main === module) {
  const result = process.argv.includes('--write') ? write() : (() => {
    const assessment = build();
    return { assessment, summary: summary(assessment) };
  })();
  process.stdout.write(JSON.stringify(result.summary, null, 2) + '\n');
}
