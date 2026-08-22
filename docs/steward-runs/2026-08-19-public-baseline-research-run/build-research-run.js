#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Lab = require('../../../shared/baseline-simulation-lab/baseline-simulation-lab');
const Capsule = require('../../../shared/portable-baseline-capsule/portable-baseline-capsule');

const root = path.resolve(__dirname, '../../..');
const at = '2026-08-19T08:43:00.000Z';

function readJson(relative) {
  return JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
}

function fileRef(relative, id, schema) {
  return { id, schema, sha256: Lab.sha256(fs.readFileSync(path.join(root, relative))) };
}

function key(ref) { return ref.id + '|' + ref.schema + '|' + ref.sha256; }

function uniqueRefs(values) {
  return Array.from(new Map(values.filter(Boolean).map(ref => [key(ref), ref])).values());
}

function outputClosures(refs) {
  return uniqueRefs(refs).map(dependencyRef => ({
    dependencyRef,
    state: 'CURRENT',
    receiptRef: Lab.reference({ checkedAt: at, dependencyRef, state: 'CURRENT' }, {
      id: 'closure:' + dependencyRef.id,
      schema: 'axm.output-closure-receipt/v1'
    }),
    observedRef: dependencyRef,
    summarySubstituted: false,
    authority: 'LOCAL_IDENTITY_ONLY'
  }));
}

async function buildResearchRun() {
  const prefix = 'docs/steward-runs/2026-08-19-public-baseline-research-run/';
  const baseline = readJson(prefix + 'PUBLIC_BASELINE_CAPSULE.json');
  const manifest = readJson(prefix + 'RESEARCH_INPUT_MANIFEST.json');
  const provenance = readJson(prefix + 'USER_REPORTED_SEAT_PROVENANCE.json');
  const disposition = readJson(prefix + 'RESEARCH_DISPOSITION.json');
  const evidenceReceipt = readJson(prefix + 'EVIDENCE_RECEIPT.json');
  const usage = readJson(prefix + 'BUDGET_USAGE_OBSERVATION.json');

  const artifactRefs = manifest.artifacts.map(artifact => ({
    id: artifact.id,
    schema: artifact.mediaType,
    sha256: artifact.sha256
  }));
  const artifactById = new Map(artifactRefs.map(ref => [ref.id, ref]));
  const provenanceRef = fileRef(prefix + 'USER_REPORTED_SEAT_PROVENANCE.json', 'research:user-reported-seat-provenance', provenance.schema);
  const baselineObservationRef = fileRef(prefix + 'PUBLIC_BASELINE_OBSERVATION.json', 'public-baseline:git-observation', 'axm.git-public-baseline-observation/v1');
  const manifestRef = fileRef(prefix + 'RESEARCH_INPUT_MANIFEST.json', 'research:5yff-input-manifest', manifest.schema);
  const dispositionRef = fileRef(prefix + 'RESEARCH_DISPOSITION.json', 'research:5yff-grounded-disposition', disposition.schema);
  const currentRealityRef = fileRef('docs/steward-runs/2026-08-19-5yff-current-reality/README.md', 'audit:5yff-current-reality', 'text/markdown');
  const needSourceRef = fileRef('docs/steward-runs/2026-08-19-5yff-current-reality/BASELINE_SIMULATION_LAB_ACCEPTANCE.md', 'research:baseline-simulation-lab-acceptance', 'text/markdown');
  const directionRef = fileRef('AGENTS.md', 'governance:workshop-agents', 'text/markdown');
  const inputSchemaRef = fileRef('shared/portable-baseline-capsule/portable-baseline-capsule.schema.json', 'schema:portable-baseline-capsule', 'application/schema+json');
  const outputSchemaRef = fileRef('shared/baseline-simulation-lab/baseline-simulation-lab-run.schema.json', 'schema:baseline-simulation-lab-run', 'application/schema+json');
  const translationRef = fileRef(prefix + 'PUBLIC_BASELINE_CAPSULE.json', 'translation:public-git-to-portable-baseline', Capsule.CAPSULE_SCHEMA);
  const usageRef = fileRef(prefix + 'BUDGET_USAGE_OBSERVATION.json', 'audit:public-research-run-budget-usage', usage.schema);
  const existingCapabilityRef = fileRef('shared/baseline-simulation-lab/baseline-simulation-lab.js', 'capability:baseline-simulation-lab-run-envelope', 'text/javascript');
  const currentRef = Capsule.capsuleReference(baseline);

  const seats = [{
    id: 'mike-tobi', kind: 'HUMAN', role: 'human direction and merge gate',
    providerFamily: null, modelId: null, identityDisclosure: 'EXACT', priorOutputExposure: 'NONE',
    provenanceRef, proofAuthority: 'NONE'
  }].concat(provenance.seats.map(seat => ({
    id: seat.id,
    kind: 'MODEL',
    role: 'user-reported historical research participant',
    providerFamily: seat.providerFamily,
    modelId: seat.modelId,
    identityDisclosure: seat.identityDisclosure,
    priorOutputExposure: seat.priorOutputExposure,
    provenanceRef,
    proofAuthority: 'NONE'
  }))).concat([{
    id: 'keel-codex-technical-steward', kind: 'TOOL', role: 'current bounded research-run validator',
    providerFamily: 'OpenAI Codex', modelId: null, identityDisclosure: 'PARTIAL', priorOutputExposure: 'FULL',
    provenanceRef: existingCapabilityRef, proofAuthority: 'NONE'
  }]);

  const modelSeatIds = provenance.seats.map(seat => seat.id).sort();
  function signalSources(signal) {
    return uniqueRefs(signal.sourceIds.map(id => {
      if (artifactById.has(id)) return artifactById.get(id);
      if (id === currentRealityRef.id) return currentRealityRef;
      throw new Error('unknown disposition source id: ' + id);
    }));
  }
  const signals = disposition.acceptedSignals.map(signal => ({
    id: signal.id,
    statement: signal.statement,
    evidenceStage: signal.stage,
    sourceRefs: signalSources(signal),
    seatIds: modelSeatIds.concat(['keel-codex-technical-steward']),
    cheapestTest: signal.cheapestTest,
    uncertainty: signal.uncertainty,
    solutionAlternatives: signal.solutionAlternatives,
    contradictions: signal.stage === 'UNKNOWN' ? ['No human-native comparison receipt exists.'] : [],
    wildcard: false
  }));

  const ideaItems = uniqueRefs([needSourceRef, directionRef, currentRealityRef].concat(artifactRefs));
  const ideaLinks = artifactRefs.map(ref => ({ fromRef: ref, toRef: needSourceRef, relation: 'MOTIVATED_BY' }));
  const proofRefs = [
    { claimId: 'claim-public-baseline-identity', evidenceRef: baselineObservationRef, method: 'FOCUSED_EXECUTION', observedAt: at },
    { claimId: 'claim-research-input-identities', evidenceRef: manifestRef, method: 'FOCUSED_EXECUTION', observedAt: at },
    { claimId: 'claim-grounded-disposition-quality', evidenceRef: currentRealityRef, method: 'ACCEPTANCE_REVIEW', observedAt: at }
  ];
  const cycle = {
    cycleId: 'cycle:public-baseline-research-envelope-reuse',
    capabilityId: 'simulation.run-envelope.verify',
    generatedAt: at,
    gap: {
      state: 'NO_GAP',
      reason: 'The bounded Baseline Simulation Lab run-envelope capability now exists and can carry the historical research without recursive generation.',
      reportRef: dispositionRef,
      existingCapabilityRef
    },
    provenance: artifactRefs,
    candidate: null,
    verification: null,
    decision: null,
    availability: null,
    refresh: {
      trigger: 'NEW_INFORMATION',
      checkedAt: at,
      due: false,
      reason: 'Refresh only when the exact public baseline, research artifacts, disposition evidence, or relevant capability changes.'
    }
  };

  const dependencyRefs = [
    needSourceRef, directionRef, provenanceRef, inputSchemaRef, outputSchemaRef, translationRef,
    usageRef, currentRef, baselineObservationRef, manifestRef, currentRealityRef, dispositionRef,
    existingCapabilityRef
  ].concat(artifactRefs);
  const input = {
    runId: 'run:public-baseline-5yff-research-replay',
    generatedAt: at,
    baselineCapsule: baseline,
    priorBaselineCapsule: null,
    previousCycleRef: null,
    need: {
      id: 'need:ground-supplied-research-against-exact-public-baseline',
      statement: 'Steward the supplied multi-model research into exact evidence, retained signals, explicit refusals, and reusable capability links without granting model consensus truth or recursive authority.',
      sourceRef: needSourceRef,
      directionRef
    },
    newInformationRefs: artifactRefs,
    seats,
    adapters: [{
      id: 'adapter:historical-public-software-baseline',
      subjectKind: 'SOFTWARE_REPOSITORY', inputSchemaRef, outputSchemaRef,
      translationReceiptRef: translationRef, unsupportedFieldRefs: [], nativeSchemaIdentityClaimed: false
    }],
    budget: {
      limits: { timeMs: 1000, storageBytes: 100000, maxConcurrency: 1, maxRetries: 0 },
      usage: {
        timeMs: usage.accountedUsage.timeMs,
        storageBytes: usage.accountedUsage.storageBytes,
        peakConcurrency: usage.accountedUsage.peakConcurrency,
        retries: usage.accountedUsage.retries,
        executionPerformed: usage.accountedUsage.executionPerformed,
        usageRef
      }
    },
    outputClosures: outputClosures(dependencyRefs),
    artifactAncestry: {
      maxDepth: 0,
      nodes: [{ artifactRef: currentRef, parentRef: null, depth: 0, assumptionRefs: [baselineObservationRef] }]
    },
    ideaEvidenceAncestry: { items: ideaItems, links: ideaLinks },
    evidenceReceipt,
    proofRefs,
    signals,
    transportChecks: [], permissionChecks: [], handoffs: [],
    humanReview: { required: false, verdict: 'NOT_RUN', comprehension: 'UNKNOWN', receiptRef: null, actorKind: 'HUMAN' },
    authorityAttempts: [],
    cycle
  };
  const receipt = await Lab.build(input);
  const verification = await Lab.verify(receipt);
  if (!verification.pass) throw new Error('research run did not rebuild: ' + verification.errors.join('; '));
  return receipt;
}

module.exports = { buildResearchRun };

if (require.main === module) {
  buildResearchRun().then(receipt => {
    process.stdout.write(JSON.stringify(receipt, null, 2));
  }).catch(error => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}
