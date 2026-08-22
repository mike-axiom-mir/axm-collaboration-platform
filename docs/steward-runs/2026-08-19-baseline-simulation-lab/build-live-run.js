#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Lab = require('../../../shared/baseline-simulation-lab/baseline-simulation-lab');
const Capsule = require('../../../shared/portable-baseline-capsule/portable-baseline-capsule');
const Loop = require('../../../shared/verified-capability-loop/verified-capability-loop');

const root = path.resolve(__dirname, '../../..');
const at = '2026-08-19T08:03:00.000Z';

function readJson(relative) {
  return JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
}

function fileRef(relative, id, schema) {
  return {
    id,
    schema,
    sha256: Lab.sha256(fs.readFileSync(path.join(root, relative)))
  };
}

function key(ref) { return ref.id + '|' + ref.schema + '|' + ref.sha256; }

function closures(refs) {
  return Array.from(new Map(refs.filter(Boolean).map(ref => [key(ref), ref])).values()).map(dependencyRef => ({
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

async function buildLiveRun() {
  const baseline = readJson('docs/steward-runs/2026-08-19-portable-baseline-capsule/CURRENT_SOFTWARE_BASELINE_CAPSULE.json');
  const evidenceReceipt = readJson('docs/steward-runs/2026-08-19-baseline-simulation-lab/NO_NEW_EVIDENCE_RECEIPT.json');
  const existingCycle = readJson('docs/steward-runs/2026-08-19-baseline-simulation-lab/EXISTING_CAPABILITY_CYCLE.json');
  const sourceRef = fileRef(
    'docs/steward-runs/2026-08-19-5yff-current-reality/BASELINE_SIMULATION_LAB_ACCEPTANCE.md',
    'research:baseline-simulation-lab-acceptance', 'text/markdown'
  );
  const humanProvenanceRef = fileRef('AGENTS.md', 'governance:workshop-agents', 'text/markdown');
  const toolProvenanceRef = fileRef(
    'shared/baseline-simulation-lab/module.contract.json',
    'module:baseline-simulation-lab-contract', 'axm.module-contract/v1'
  );
  const inputSchemaRef = fileRef(
    'shared/portable-baseline-capsule/portable-baseline-capsule.schema.json',
    'schema:portable-baseline-capsule', 'application/schema+json'
  );
  const outputSchemaRef = fileRef(
    'shared/baseline-simulation-lab/baseline-simulation-lab-run.schema.json',
    'schema:baseline-simulation-lab-run', 'application/schema+json'
  );
  const translationRef = fileRef(
    'shared/baseline-simulation-lab/module.contract.json',
    'translation:software-baseline-envelope-contract', 'axm.module-contract/v1'
  );
  const usageRef = fileRef(
    'docs/steward-runs/2026-08-19-baseline-simulation-lab/ZERO_USAGE_DECLARATION.json',
    'audit:no-new-zero-usage', 'axm.budget-usage-receipt/v1'
  );
  const proofRef = fileRef(
    'docs/steward-runs/2026-08-19-baseline-simulation-lab/LIVE_COMPARISON_OBSERVATION.json',
    'audit:baseline-comparison-observation', 'axm.baseline-comparison-observation/v1'
  );
  if (!Loop.verify(existingCycle).pass) throw new Error('existing capability cycle does not verify');
  const previousCycleRef = {
    id: existingCycle.cycleId,
    schema: Loop.RECEIPT_SCHEMA,
    sha256: existingCycle.receiptDigest
  };
  const currentRef = Capsule.capsuleReference(baseline);
  const dependencyRefs = [
    sourceRef, humanProvenanceRef, toolProvenanceRef,
    inputSchemaRef, outputSchemaRef, translationRef, usageRef,
    currentRef, proofRef, previousCycleRef
  ];
  const input = {
    runId: 'run:live-portable-baseline-no-new-information',
    generatedAt: at,
    baselineCapsule: baseline,
    priorBaselineCapsule: baseline,
    previousCycleRef,
    need: {
      id: 'need:bounded-baseline-simulation',
      statement: 'A baseline simulation run needs exact identity, native evidence routes, bounded work, and an explicit no-new-information stop.',
      sourceRef,
      directionRef: null
    },
    newInformationRefs: [],
    seats: [
      {
        id: 'mike-tobi', kind: 'HUMAN', role: 'human direction and merge gate',
        providerFamily: null, modelId: null, identityDisclosure: 'EXACT', priorOutputExposure: 'NONE',
        provenanceRef: humanProvenanceRef, proofAuthority: 'NONE'
      },
      {
        id: 'keel-codex-technical-steward', kind: 'TOOL', role: 'bounded local validator',
        providerFamily: 'OpenAI Codex', modelId: null, identityDisclosure: 'PARTIAL', priorOutputExposure: 'FULL',
        provenanceRef: toolProvenanceRef, proofAuthority: 'NONE'
      }
    ],
    adapters: [{
      id: 'adapter:software-baseline-envelope', subjectKind: 'SOFTWARE_REPOSITORY',
      inputSchemaRef, outputSchemaRef, translationReceiptRef: translationRef,
      unsupportedFieldRefs: [], nativeSchemaIdentityClaimed: false
    }],
    budget: {
      limits: { timeMs: 1000, storageBytes: 100000, maxConcurrency: 1, maxRetries: 0 },
      usage: { timeMs: 0, storageBytes: 0, peakConcurrency: 0, retries: 0, executionPerformed: false, usageRef }
    },
    outputClosures: closures(dependencyRefs),
    artifactAncestry: {
      maxDepth: 0,
      nodes: [{ artifactRef: currentRef, parentRef: null, depth: 0, assumptionRefs: [] }]
    },
    ideaEvidenceAncestry: { items: [sourceRef], links: [] },
    evidenceReceipt,
    proofRefs: [{ claimId: 'claim-live-no-new-information', evidenceRef: proofRef, method: 'FOCUSED_EXECUTION', observedAt: at }],
    signals: [], transportChecks: [], permissionChecks: [], handoffs: [],
    humanReview: { required: false, verdict: 'NOT_RUN', comprehension: 'UNKNOWN', receiptRef: null, actorKind: 'HUMAN' },
    authorityAttempts: [],
    cycle: null
  };
  const receipt = await Lab.build(input);
  const verification = await Lab.verify(receipt);
  if (!verification.pass) throw new Error('live run did not rebuild: ' + verification.errors.join('; '));
  if (receipt.state !== 'NO_NEW_INFORMATION' || receipt.holds.length) throw new Error('live run did not stop cleanly');
  return receipt;
}

module.exports = { buildLiveRun };

if (require.main === module) {
  buildLiveRun().then(receipt => {
    process.stdout.write(JSON.stringify(receipt, null, 2));
  }).catch(error => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}
