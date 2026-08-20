#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Research = require('../../../shared/research-contribution-intake/research-contribution-intake');

const root = __dirname;
const generatedAt = '2026-08-20T14:00:00.000Z';

function bytesFor(value) {
  return Buffer.from(JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function sha256(bytes) {
  return 'sha256:' + crypto.createHash('sha256').update(bytes).digest('hex');
}

function writeJson(name, value) {
  const bytes = bytesFor(value);
  fs.writeFileSync(path.join(root, name), bytes);
  return {
    id: name.replace(/\.json$/i, '').toLowerCase().replace(/_/g, '-'),
    schema: value.schema,
    sha256: sha256(bytes)
  };
}

const sourceDeclaration = {
  schema: 'axm.shadow-specialist-source-declaration/v1',
  generatedAt,
  declaration: 'Mike reported that the experimental package was built by an OpenAI platform max-reasoning model.',
  exactModelIdEstablished: false,
  exactModelVersionEstablished: false,
  packageRevisionContextShared: true,
  contributorIndependenceEstablished: false,
  authority: 'NONE'
};
const sourceDeclarationRef = writeJson('SOURCE_DECLARATION.json', sourceDeclaration);

const baselineDeclaration = {
  schema: 'axm.shadow-specialist-intake-baseline/v1',
  generatedAt,
  repositoryLane: 'isolated-grounded-growth-stewardship-worktree',
  branch: 'codex/grounded-growth-shadow-specialist-intake-v1.1',
  sourceCommit: 'a18951ea272c76d85e46f3b1c96525296cb6a6e9',
  sourceStatus: 'TEST',
  canon: false,
  authority: 'NONE'
};
const baselineDeclarationRef = writeJson('BASELINE_DECLARATION.json', baselineDeclaration);

const archiveReceipt = {
  schema: 'axm.shadow-specialist-static-archive-receipt/v1',
  generatedAt,
  sourceExecution: false,
  packages: [
    {
      id: 'axm-mirror-shadow-specialist-v0.1.0-experimental',
      version: '0.1.0-experimental',
      bytes: 124129,
      sha256: 'sha256:651365155355b913b562dd95e9c95241498a01e0b60a4dddca8b888b1918dd9f',
      archiveEntries: 81,
      regularFiles: 55,
      uncompressedBytes: 388382,
      compressionRatio: 3.74,
      unsafePaths: 0,
      duplicateNames: 0,
      symbolicOrSpecialEntries: 0,
      oversizedEntries: 0,
      suspiciousCompressionEntries: 0
    },
    {
      id: 'axm-mirror-shadow-specialist-v0.2.0-experimental',
      version: '0.2.0-experimental',
      bytes: 208558,
      sha256: 'sha256:a34fe2c976da735dd554a4b3b0f5e32700c740762e6ca6adadcb5c3238978a19',
      archiveEntries: 149,
      regularFiles: 104,
      uncompressedBytes: 589888,
      compressionRatio: 3.35,
      unsafePaths: 0,
      duplicateNames: 0,
      symbolicOrSpecialEntries: 0,
      oversizedEntries: 0,
      suspiciousCompressionEntries: 0
    },
    {
      id: 'shadow-specialist-local-intake-note',
      version: '0.2.0-associated-note',
      bytes: 6603,
      sha256: 'sha256:ecf2081f22ce24f64c2c2b95a288b12309fd67b203c85db40ae030becae69345'
    }
  ],
  truth: {
    archiveStructureInspected: true,
    archiveContentTrusted: false,
    packageCodeExecuted: false,
    packageInstalled: false,
    packagePromoted: false,
    canonChanged: false
  }
};
const archiveReceiptRef = writeJson('STATIC_ARCHIVE_RECEIPT.json', archiveReceipt);

const manifestReceipt = {
  schema: 'axm.shadow-specialist-manifest-verification-receipt/v1',
  generatedAt,
  method: 'independent-byte-hash-and-declared-manifest-digest-rebuild',
  packages: [
    {
      version: '0.1.0-experimental',
      declaredFiles: 54,
      actualFilesInManifestScope: 54,
      missingFiles: 0,
      byteOrDigestMismatches: 0,
      manifestDigest: 'sha256:74eb576546be06bf400b4daf07b451c2397e78288cebbf2d01f85090e3f3b9d9',
      manifestDigestRebuilt: true
    },
    {
      version: '0.2.0-experimental',
      declaredFiles: 103,
      actualFilesInManifestScope: 103,
      missingFiles: 0,
      byteOrDigestMismatches: 0,
      manifestDigest: 'sha256:7e28d724e963c1a1d401ac53c06d953175c60f0e89dd443ebcdf11b1dc06fd6d',
      manifestDigestRebuilt: true,
      predecessorManifestDigestMatches: true,
      predecessorArchiveDigestMatches: true
    }
  ],
  revisionComparison: {
    addedFiles: 49,
    removedFiles: 0,
    modifiedFiles: 24,
    identicalFiles: 31
  },
  syntaxInspection: {
    commandClass: 'node-check-parser-only',
    javascriptAndCommonJsFilesChecked: 25,
    failures: 0,
    modulesLoaded: false,
    packageTestsExecuted: false
  },
  limits: [
    'Manifest verification proves listed-byte integrity only.',
    'It does not authenticate the package author, archived donor source, test executor, environment witness, or provider run.',
    'The package test reports were preserved as self-reported artifacts and were not re-executed.'
  ],
  authority: 'NONE'
};
const manifestReceiptRef = writeJson('MANIFEST_VERIFICATION_RECEIPT.json', manifestReceipt);

const findings = {
  schema: 'axm.shadow-specialist-static-review-findings/v1',
  generatedAt,
  disposition: 'USEFUL_KNOWLEDGE_RUNTIME_HELD',
  workingStatic: [
    'Both archives have safe inspectable structure and exact stable input digests.',
    'Every file in each declared package-manifest scope matches its declared byte count and SHA-256.',
    'The v0.2 predecessor manifest and v0.1 ZIP bindings match the supplied v0.1 package.',
    'The v0.2 change is additive at the file level: 49 added, zero removed, 24 modified, and 31 identical files.',
    'All 25 JavaScript/CommonJS files parse with node --check without loading package modules.',
    'Fresh-epoch identity, evidence-kind separation, observation-loss holds, explicit uncertainty, and no-promotion boundaries are useful reusable patterns.'
  ],
  partialOrUnproven: [
    {
      code: 'INTAKE_FILESET_NOT_EXACT',
      evidence: 'shadow_source_intake_gateway/index.js:69-83',
      detail: 'The gateway verifies listed manifest and HASHES entries but does not require either list to equal the complete directory tree; extra unmanifested files can survive staging.'
    },
    {
      code: 'SDK_SENSITIVE_TRACE_SETTING_NOT_ENFORCED',
      evidence: 'adapters/openai_agents_sdk/index.js:259-264; backend_install/openai_agents_sdk/README.md:14',
      detail: 'Install checks addTraceProcessor and a feature flag, but it cannot verify that the application Runner actually set traceIncludeSensitiveData=false.'
    },
    {
      code: 'SANITIZER_IS_HEURISTIC_NOT_DLP',
      evidence: 'observation_plane/trace_sanitizer.js:7-15,47-122; adapters/openai_agents_sdk/index.js:140-213',
      detail: 'Known keys and three value patterns are redacted, while arbitrary metadata, structural span data, and error objects may retain private or identifying content.'
    },
    {
      code: 'MEMORY_SINK_UNBOUNDED',
      evidence: 'observation_plane/index.js:93-98; backend_install/openai_agents_sdk/observer.js:10-17',
      detail: 'The bus queue is bounded, but its default durable-in-process memory sink grows without a retention or epoch-size bound.'
    },
    {
      code: 'NO_SINK_CAN_COUNT_AS_DELIVERED',
      evidence: 'observation_plane/index.js:192',
      detail: 'A CanonicalObservationBus with zero sinks increments delivered state, allowing a complete-witness signal without durable delivery.'
    },
    {
      code: 'TEST_RECEIPTS_NOT_AUTHENTICATED',
      evidence: 'shadow_learning_steward/index.js:192-203; shadow_epoch_factory/index.js:34',
      detail: 'Executed/passed flags and an external-gate actor id are structurally sealed but not authenticated, so VERIFIED_CANDIDATE is not independent proof of execution or human approval.'
    },
    {
      code: 'COMMON_RUNTIME_NOT_COLLAPSED_FOR_INDEPENDENCE',
      evidence: 'shadow_source_intake_gateway/index.js:248-253; shadow_learning_steward/index.js:121-190',
      detail: 'Known backend and environment identities are preserved but sameness alone does not join evidence families, so shared runtime/cache effects can be overcounted as independent.'
    },
    {
      code: 'PORTABLE_EXPORT_TARGET_BOUNDARY_PARTIAL',
      evidence: 'shadow_package_exporter/index.js:12-18',
      detail: 'Exporter create-new semantics are good, but an existing symlinked directory is followed and no approved-root policy is enforced inside the exporter.'
    }
  ],
  declaredButNotIndependentlyVerified: [
    'The bundled 36/36 test report.',
    'The 115-object donor-source provenance and source commit correspondence.',
    'The local environment witness as an attestation of the actual build environment.',
    'Compatibility with a current live OpenAI Agents SDK runtime.',
    'Any working ChatGPT/Codex backend installation or provider activity.',
    'Native Mirror/WALDO compatibility, host isolation, cross-process epoch isolation, or self-improvement.'
  ],
  prerequisitesBeforeAnyBackendExperiment: [
    'Reject every unmanifested, duplicate, symlinked, non-regular, or out-of-scope package file.',
    'Use full schema validation and exact schema-version allowlists.',
    'Bind an authenticated test executor and authenticated human authorization receipt.',
    'Enforce sensitive-trace configuration at the Runner/run boundary and add a reviewed DLP/redaction policy.',
    'Bound memory, package bytes, event count, epoch duration, retention, and deletion behavior.',
    'Treat same backend, environment, cache, trace, artifact, output, dependency, and prior-output exposure as common-mode evidence unless independently excluded.',
    'Run only in an owner-controlled disposable application with rollback and no Main Mirror/CANON path.',
    'Complete provider policy and package-license review; the supplied package declares UNLICENSED.'
  ],
  truth: {
    packageCodeExecuted: false,
    packageTestsExecuted: false,
    liveProviderObserved: false,
    workingBackendModified: false,
    runtimeSafeProven: false,
    learningProven: false,
    humanBenefitProven: false,
    installed: false,
    promoted: false,
    canonChanged: false
  }
};
const findingsRef = writeJson('STATIC_REVIEW_FINDINGS.json', findings);

const bundle = {
  schema: 'axm.research-contribution-bundle/v1',
  version: '0.1.0',
  bundleId: 'shadow-specialist-package-research-2026-08-20',
  baselineRef: baselineDeclarationRef,
  sourceHandling: 'DATA_ONLY_NO_PACKAGE_CODE_EXECUTION',
  artifacts: archiveReceipt.packages.map(item => ({
    id: item.id,
    label: item.version,
    mediaType: item.id === 'shadow-specialist-local-intake-note' ? 'text/plain' : 'application/zip',
    bytes: item.bytes,
    sha256: item.sha256,
    reportedSeatIds: ['platform-max-reasoning-seat']
  })),
  seats: [
    {
      id: 'platform-max-reasoning-seat',
      kind: 'MODEL',
      role: 'experimental shadow specialist architecture and reference implementation builder',
      providerFamily: 'openai-platform',
      modelId: null,
      identityDisclosure: 'PARTIAL',
      priorOutputExposure: 'FULL',
      provenanceRef: sourceDeclarationRef,
      proofAuthority: 'NONE'
    }
  ],
  evidenceSources: [
    {
      id: 'archive-structure-inspection',
      ref: archiveReceiptRef,
      surface: 'file-inspection',
      claimKinds: ['archive structure', 'input digest', 'source execution boundary']
    },
    {
      id: 'manifest-byte-verification',
      ref: manifestReceiptRef,
      surface: 'schema-validation',
      claimKinds: ['manifest integrity', 'predecessor lineage', 'syntax parsing']
    },
    {
      id: 'static-code-and-contract-review',
      ref: findingsRef,
      surface: 'file-inspection',
      claimKinds: ['useful patterns', 'integration gaps', 'backend install hold']
    }
  ],
  signals: [
    {
      id: 'declared-package-integrity-reproduces',
      statement: 'The supplied v0.1 and v0.2 archives reproduce every declared manifest-scope byte and the v0.2 predecessor link.',
      evidenceStage: 'OBSERVED',
      artifactIds: ['axm-mirror-shadow-specialist-v0.1.0-experimental', 'axm-mirror-shadow-specialist-v0.2.0-experimental'],
      evidenceSourceIds: ['archive-structure-inspection', 'manifest-byte-verification'],
      seatIds: ['platform-max-reasoning-seat'],
      cheapestTest: 'Repeat archive and manifest hashing from the original ZIP bytes and compare the exact receipt digests.',
      uncertainty: 'This proves supplied-byte integrity, not author identity, source-repository fidelity, test execution, runtime safety, or provider compatibility.',
      solutionAlternatives: ['Preserve the digests as detached provenance.', 'Request an independently signed source/build attestation later.'],
      contradictions: [],
      wildcard: false
    },
    {
      id: 'shadow-architecture-has-reusable-patterns',
      statement: 'Fresh epochs, evidence-kind separation, explicit observation-loss holds, source intake before stewardship, common-mode lineage fields, and an external promotion gate are useful design patterns.',
      evidenceStage: 'INFERENCE',
      artifactIds: ['axm-mirror-shadow-specialist-v0.2.0-experimental'],
      evidenceSourceIds: ['static-code-and-contract-review'],
      seatIds: ['platform-max-reasoning-seat'],
      cheapestTest: 'Map each pattern to an existing native AXM contract and add only a held-out regression where a real capability gap remains.',
      uncertainty: 'A useful pattern does not establish that this implementation is safe to install or that learning will improve.',
      solutionAlternatives: ['Reuse existing native Research Contribution Intake and Model Shadow contracts.', 'Reimplement only a missing bounded rule after a capability-gap check.'],
      contradictions: [],
      wildcard: false
    },
    {
      id: 'backend-install-readiness-is-not-established',
      statement: 'The supplied runtime is not ready for authorized backend installation because exact file-set intake, sensitive-trace enforcement, evidence authentication, resource bounds, and live compatibility remain open.',
      evidenceStage: 'OBSERVED',
      artifactIds: ['axm-mirror-shadow-specialist-v0.2.0-experimental', 'shadow-specialist-local-intake-note'],
      evidenceSourceIds: ['static-code-and-contract-review'],
      seatIds: ['platform-max-reasoning-seat'],
      cheapestTest: 'Close the static holds first, then use one owner-controlled disposable application and stop before any promotion or persistent backend deployment.',
      uncertainty: 'A later repaired version may become experiment-ready; this assessment is limited to the supplied exact bytes.',
      solutionAlternatives: ['Keep the package quarantined and accept only digest-bound research signals.', 'Prepare a separate repaired candidate through the existing governed Branch Module Return Gate.'],
      contradictions: ['The package self-label says READY_FOR_AUTHORIZED_BACKEND_INSTALL, while its own declared holds and static gaps do not support that state.'],
      wildcard: false
    },
    {
      id: 'native-intake-and-lab-already-cover-the-safe-route',
      statement: 'AXM already has a stricter inert Branch Module Return Gate, Research Contribution Intake, Model Shadow Continuity, and Grounded Growth Challenger Lab, so a second baseline lab or direct runtime transplant would be redundant.',
      evidenceStage: 'INFERENCE',
      artifactIds: ['axm-mirror-shadow-specialist-v0.2.0-experimental'],
      evidenceSourceIds: ['static-code-and-contract-review'],
      seatIds: ['platform-max-reasoning-seat'],
      cheapestTest: 'Build this exact research bundle with the native intake and verify the resulting planning projection by exact rebuild.',
      uncertainty: 'A future observer-specific capability gap may justify one new bounded adapter after stronger evidence.',
      solutionAlternatives: ['Reuse the native research-to-lab projection now.', 'Defer any persistent observer until the prerequisite list is closed.'],
      contradictions: [],
      wildcard: false
    }
  ],
  proposals: [
    {
      id: 'install-supplied-runtime',
      statement: 'Install the supplied v0.2 observer and learning runtime into a working backend.',
      disposition: 'REJECTED',
      reason: 'Exact-file-set, privacy enforcement, evidence authentication, resource, compatibility, and license gates remain open.',
      artifactIds: ['axm-mirror-shadow-specialist-v0.2.0-experimental'],
      evidenceSourceIds: ['static-code-and-contract-review'],
      seatIds: ['platform-max-reasoning-seat']
    },
    {
      id: 'copy-shadow-runtime-into-workshop',
      statement: 'Copy the package runtime modules directly into the Workshop.',
      disposition: 'REJECTED_AS_REDUNDANT',
      reason: 'Native AXM intake, model-shadow, challenger, and governance contracts already cover the safe route; direct copying would duplicate weaker implementations.',
      artifactIds: ['axm-mirror-shadow-specialist-v0.2.0-experimental'],
      evidenceSourceIds: ['static-code-and-contract-review'],
      seatIds: ['platform-max-reasoning-seat']
    },
    {
      id: 'reuse-package-as-research-contribution',
      statement: 'Preserve the useful patterns and explicit holds as an inert native research contribution.',
      disposition: 'REUSE_EXISTING',
      reason: 'Research Contribution Intake already provides the exact data-only path and Baseline Simulation planning projection.',
      artifactIds: ['axm-mirror-shadow-specialist-v0.1.0-experimental', 'axm-mirror-shadow-specialist-v0.2.0-experimental', 'shadow-specialist-local-intake-note'],
      evidenceSourceIds: ['archive-structure-inspection', 'manifest-byte-verification', 'static-code-and-contract-review'],
      seatIds: ['platform-max-reasoning-seat']
    },
    {
      id: 'future-disposable-observer-challenge',
      statement: 'After repairing the static holds, evaluate one bounded observer candidate in an owner-controlled disposable application.',
      disposition: 'DEFERRED',
      reason: 'A future experiment may be useful, but no live provider/backend execution is authorized or technically ready now.',
      artifactIds: ['axm-mirror-shadow-specialist-v0.2.0-experimental'],
      evidenceSourceIds: ['static-code-and-contract-review'],
      seatIds: ['platform-max-reasoning-seat']
    }
  ],
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

const bundleRef = writeJson('RESEARCH_CONTRIBUTION_BUNDLE.json', bundle);
const assessment = Research.buildAssessment({
  assessmentId: 'shadow-specialist-package-intake-assessment-2026-08-20',
  generatedAt,
  bundle
});
writeJson('RESEARCH_CONTRIBUTION_ASSESSMENT.json', assessment);

const decision = {
  schema: 'axm.shadow-specialist-intake-decision/v1',
  generatedAt,
  exactArtifactRefs: archiveReceipt.packages.map(item => ({
    id: item.id,
    schema: item.id === 'shadow-specialist-local-intake-note' ? 'text/plain' : 'application/zip',
    sha256: item.sha256
  })),
  researchBundleRef: bundleRef,
  researchAssessmentRef: {
    id: assessment.assessmentId,
    schema: assessment.schema,
    sha256: assessment.receiptDigest
  },
  disposition: {
    knowledge: 'READY_FOR_BASELINE_SIMULATION_PLANNING',
    suppliedRuntime: 'QUARANTINED_NOT_INSTALLABLE',
    directCodeReuse: 'REJECTED',
    futureObserverExperiment: 'DEFERRED_UNTIL_PREREQUISITES_CLOSE'
  },
  reasons: [
    'The exact supplied bytes have internally consistent manifests and contain useful bounded architecture patterns.',
    'The runtime and intake paths still have concrete privacy, integrity, evidence-authentication, independence, resource, compatibility, and license gaps.',
    'Existing native AXM contracts provide a stricter data-only path from research contribution to bounded lab planning.'
  ],
  mikeDecisionsNeeded: [
    'Whether to keep the research contribution as a planning input after reviewing this disposition.',
    'Whether a later repaired disposable observer experiment is worth scheduling after all prerequisites close.',
    'Whether any future candidate should target OpenAI Agents SDK applications, local runtimes, or remain provider-neutral first.'
  ],
  notNeededFromMikeNow: [
    'No package installation approval is requested.',
    'No CANON or merge decision for the supplied package is requested.',
    'No second Baseline Simulation Lab needs to be built.'
  ],
  truth: {
    sourceBytesCommitted: false,
    sourceCodeExecuted: false,
    packageTestsExecuted: false,
    liveBackendTested: false,
    currentSdkCompatibilityProven: false,
    nativeResearchAssessmentBuilt: true,
    baselineSimulationPlanningProjectionBuilt: true,
    baselineSimulationExecuted: false,
    installed: false,
    promoted: false,
    canonChanged: false
  },
  authority: 'NONE',
  decisionDigest: null
};
decision.decisionDigest = Research.sha256(Object.assign({}, decision, { decisionDigest: null }));
writeJson('SHADOW_SPECIALIST_INTAKE_DECISION.json', decision);

const requirements = {
  schema: 'axm.shadow-specialist-intake-capability-requirements/v1',
  generatedAt,
  requirements: [
    { id: 'inert-source-handling', required: true },
    { id: 'safe-archive-structure', required: true },
    { id: 'exact-manifest-byte-verification', required: true },
    { id: 'predecessor-lineage-verification', required: true },
    { id: 'native-research-intake', required: true },
    { id: 'baseline-simulation-planning-projection', required: true },
    { id: 'exact-package-fileset-rejection', required: false },
    { id: 'authenticated-execution-and-human-evidence', required: false },
    { id: 'enforced-sensitive-trace-and-resource-policy', required: false },
    { id: 'live-provider-and-native-mirror-compatibility', required: false }
  ]
};
writeJson('CAPABILITY_REQUIREMENTS.json', requirements);
writeJson('CAPABILITY_GAP_BEFORE.json', {
  schema: 'axm.shadow-specialist-intake-capability-gap/v1',
  generatedAt,
  overall: 'BLOCKED',
  requirements: requirements.requirements.map(item => ({ id: item.id, required: item.required, status: item.required ? 'BLOCKED' : 'UNKNOWN' }))
});
writeJson('CAPABILITY_GAP_AFTER.json', {
  schema: 'axm.shadow-specialist-intake-capability-gap/v1',
  generatedAt,
  overall: 'DEGRADED',
  requirements: requirements.requirements.map(item => ({
    id: item.id,
    required: item.required,
    status: item.required ? 'READY' : 'OPTIONAL_HELD',
    note: item.required
      ? 'Closed by static verification and the existing native Research Contribution Intake.'
      : 'Required before any future runtime/backend experiment; not required for inert planning intake.'
  }))
});

process.stdout.write(JSON.stringify({
  status: decision.disposition.knowledge,
  assessmentState: assessment.state,
  assessmentDigest: assessment.receiptDigest,
  decisionDigest: decision.decisionDigest,
  packageCodeExecuted: false,
  packageInstalled: false
}) + '\n');
