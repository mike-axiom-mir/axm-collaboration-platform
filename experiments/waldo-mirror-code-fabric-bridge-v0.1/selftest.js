'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const Composer = require('../../shared/code-capability-fabric/declarative-blueprint-composer-v1');
const Compiler = require('../../shared/code-capability-fabric/blueprint-schema-compiler-v1');

const RECEIPT_SCHEMA = 'axm.waldo-mirror.fabric-bridge-experiment-receipt/v0.1';
const AI_PROPOSAL_SCHEMA = 'axm.waldo-mirror.fabric-ai-proposal/v0.1';
const AI_SOURCE_MODE = 'AI_OPT_IN_EXTERNAL_PROPOSAL';
const DETERMINISTIC_SOURCE_MODE = 'DETERMINISTIC_NATIVE';

const DONOR = Object.freeze({
  repository: 'mike-axiom-mir/axm-collaboration-platform',
  commit: 'fd6ec98a6a98a6666a980c359730ccec57a8cbe9',
  blobs: Object.freeze({
    'shared/code-capability-fabric/code-capability-fabric-v2.js': '7b20769ccf296943cddce192d601bde3ec6f2334',
    'shared/code-capability-fabric/grounded-consent-scope-v1.js': 'a05190bb58c50b8782f2c404b5e7dfde3d7feae3',
    'shared/code-capability-fabric/slow-creation-pilot-v1.js': '4e667b166ab5d018aad88828fae45dcc25529627',
    'shared/code-capability-fabric/declarative-blueprint-composer-v1.js': '388343fade0bfc1507c6a526a7f3471a2d0595e5',
    'shared/code-capability-fabric/blueprint-schema-compiler-v1.js': 'f0460d40d53c266065b4876ab0bd3d6dd971b00d',
    'tools/deterministic-json-core/index.js': '5f6720fb6e887158c7d501fdc41be422a315050f'
  })
});

const CONCEPT = Object.freeze({
  schema: 'axm.waldo-mirror.fabric-concept/v0.1',
  id: 'one-concept-many-bodies',
  statement: 'Preserve evidence lineage, open choice, continuity, and human review while translating one concept into different bounded bodies.',
  roots: Object.freeze(['truth', 'agency-non-domination', 'continuity', 'wisdom-over-speed']),
  authority: 'NONE'
});
const CONCEPT_SHA256 = Composer.sha256(CONCEPT);

const DETERMINISTIC_BODIES = Object.freeze([
  Object.freeze({
    id: 'evidence-trail-mini-game',
    name: 'Evidence Trail Mini Game',
    purpose: 'Describe a tiny deterministic game body where progress follows witnessed evidence instead of hidden state changes.',
    capability: 'game.evidence-trail.compose',
    inputFields: Object.freeze([
      Object.freeze({ id: 'root-state', type: 'object', required: true, description: 'Declared four-root state entering the mini-game body.' }),
      Object.freeze({ id: 'witness-events', type: 'array', required: true, description: 'Ordered public-safe witness events available to the game mechanic.' })
    ]),
    outputFields: Object.freeze([
      Object.freeze({ id: 'playable-state', type: 'object', source: 'playable-state', description: 'Inert game-state contract for a later runtime implementation.' })
    ]),
    steps: Object.freeze([
      Object.freeze({ id: 'validate-roots', operation: 'VALIDATE', reads: ['root-state'], produces: 'validated-roots', description: 'Reject a starting state that does not preserve the declared root boundary.' }),
      Object.freeze({ id: 'bind-witness-route', operation: 'ASSEMBLE', reads: ['validated-roots', 'witness-events'], produces: 'evidence-route', description: 'Bind ordered witnessed events to the declared root state without inventing hidden progress.' }),
      Object.freeze({ id: 'emit-playable-state', operation: 'EMIT', reads: ['evidence-route'], produces: 'playable-state', description: 'Emit only an inert game-state contract for later implementation and review.' })
    ]),
    qualityClaims: Object.freeze([
      'The game body keeps evidence visible instead of silently granting progress.',
      'The game body preserves the four roots as a review boundary.',
      'The game body remains inert until a separate runtime implementation is reviewed.'
    ])
  }),
  Object.freeze({
    id: 'continuity-diagnostic-tool',
    name: 'Continuity Diagnostic Tool',
    purpose: 'Describe a diagnostic body that compares a portable continuity capsule against an observed object inventory without restoring or mutating anything.',
    capability: 'mirror.continuity.diagnose',
    inputFields: Object.freeze([
      Object.freeze({ id: 'continuity-capsule', type: 'object', required: true, description: 'Digest-only continuity capsule to resolve read-only.' }),
      Object.freeze({ id: 'object-inventory', type: 'array', required: true, description: 'Observed object identities available for comparison.' })
    ]),
    outputFields: Object.freeze([
      Object.freeze({ id: 'resolution-report', type: 'object', source: 'resolution-report', description: 'Read-only PRESENT, MISSING, or MISMATCH diagnostic report.' })
    ]),
    steps: Object.freeze([
      Object.freeze({ id: 'validate-capsule', operation: 'VALIDATE', reads: ['continuity-capsule'], produces: 'validated-capsule', description: 'Validate the capsule boundary and digest references before comparison.' }),
      Object.freeze({ id: 'resolve-inventory', operation: 'TRANSFORM', reads: ['object-inventory', 'validated-capsule'], produces: 'resolution-report', description: 'Compare exact references and keep PRESENT, MISSING, and MISMATCH distinct.' })
    ]),
    qualityClaims: Object.freeze([
      'The diagnostic does not infer PRESENT from similar names or nearby versions.',
      'The diagnostic performs no restore, install, promotion, or CANON action.',
      'Missing and mismatched continuity remain visible for later review.'
    ])
  }),
  Object.freeze({
    id: 'lineage-how-to-guide',
    name: 'Lineage How To Guide',
    purpose: 'Describe a tutorial body that explains how descendants relate to one ancestor concept while preserving what is proven, unproven, and still awaiting review.',
    capability: 'documentation.lineage-guide.compose',
    inputFields: Object.freeze([
      Object.freeze({ id: 'concept-ref', type: 'object', required: true, description: 'Exact ancestor concept reference.' }),
      Object.freeze({ id: 'body-receipts', type: 'array', required: true, description: 'Receipts from descendant bodies that may be explained.' })
    ]),
    outputFields: Object.freeze([
      Object.freeze({ id: 'tutorial-outline', type: 'object', source: 'tutorial-outline', description: 'Inert how-to outline with lineage and truth-boundary sections.' })
    ]),
    steps: Object.freeze([
      Object.freeze({ id: 'validate-concept-ref', operation: 'VALIDATE', reads: ['concept-ref'], produces: 'validated-concept-ref', description: 'Validate that the tutorial starts from one exact ancestor reference.' }),
      Object.freeze({ id: 'assemble-lineage', operation: 'ASSEMBLE', reads: ['body-receipts', 'validated-concept-ref'], produces: 'lineage-map', description: 'Assemble descendant receipts under the exact ancestor without flattening their different evidence ceilings.' }),
      Object.freeze({ id: 'format-tutorial', operation: 'FORMAT', reads: ['lineage-map'], produces: 'tutorial-outline', description: 'Format a reviewable tutorial outline while keeping limitations and open questions explicit.' })
    ]),
    qualityClaims: Object.freeze([
      'The tutorial distinguishes lineage evidence from claims of semantic equivalence.',
      'The tutorial keeps unproven claims visibly unproven.',
      'The tutorial does not turn documentation into install, promotion, or CANON authority.'
    ])
  })
]);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function exactKeys(value, expected, label) {
  assert.ok(value && typeof value === 'object' && !Array.isArray(value), label + ' must be an object');
  assert.deepStrictEqual(Object.keys(value).sort(), expected.slice().sort(), label + ' keys drifted');
}

function intentForBody(body) {
  const steps = clone(body.steps);
  return Composer.sealIntent({
    schema: Composer.INTENT_SCHEMA,
    id: body.id,
    name: body.name,
    purpose: body.purpose + ' Shared concept lineage: ' + CONCEPT_SHA256 + '.',
    capability: body.capability,
    status: 'EXPERIMENTAL',
    kind: Composer.KIND,
    inputFields: clone(body.inputFields),
    outputFields: clone(body.outputFields),
    steps,
    qualityClaims: clone(body.qualityClaims),
    resourceBudget: {
      maxInputBytes: 32768,
      maxOutputBytes: 32768,
      maxDurationMs: 1000,
      maxMemoryBytes: 67108864,
      maxOperations: steps.length
    },
    authority: 'NONE'
  });
}

function buildBody(body, sourceMode, sourceRef) {
  const intent = intentForBody(body);
  const blueprint = Composer.buildBlueprint(intent);
  const replay = Composer.buildBlueprint(intent);
  assert.deepStrictEqual(blueprint, replay, body.id + ' blueprint replay drifted');

  const inputSchema = Compiler.buildInterfaceSchema(blueprint, 'input');
  const outputSchema = Compiler.buildInterfaceSchema(blueprint, 'output');
  const matrix = Compiler.buildAcceptanceMatrix(blueprint, inputSchema, outputSchema);

  assert.strictEqual(inputSchema.additionalProperties, false, body.id + ' input schema is open');
  assert.strictEqual(outputSchema.additionalProperties, false, body.id + ' output schema is open');
  assert.ok(matrix.cases.every((item) => item.verdict === 'UNRUN'), body.id + ' acceptance matrix executed a case');
  assert.ok(blueprint.desiredOutcomes.every((item) => item.status === 'UNPROVEN'), body.id + ' promoted a desired outcome');
  assert.deepStrictEqual(blueprint.permissions, [], body.id + ' gained permissions');
  for (const refusal of ['generated-code-execution', 'automatic-install', 'automatic-promotion', 'automatic-canon', 'persistent-learning-admission']) {
    assert.ok(blueprint.boundaries.refuses.includes(refusal), body.id + ' lost refusal ' + refusal);
  }

  return {
    bodyId: body.id,
    sourceMode,
    sourceRef,
    conceptRef: {
      id: CONCEPT.id,
      schema: CONCEPT.schema,
      sha256: CONCEPT_SHA256
    },
    intentRef: {
      id: intent.id,
      schema: intent.schema,
      sha256: intent.intentDigest
    },
    blueprintRef: {
      id: blueprint.id,
      schema: blueprint.schema,
      sha256: blueprint.blueprintDigest
    },
    interfaceSchemaRefs: [
      { direction: 'input', schema: inputSchema.$id, sha256: Composer.sha256(inputSchema) },
      { direction: 'output', schema: outputSchema.$id, sha256: Composer.sha256(outputSchema) }
    ],
    acceptanceMatrixRef: {
      schema: matrix.schema,
      sha256: matrix.matrixDigest
    },
    truth: {
      deterministicReplayMatched: true,
      desiredOutcomesRemainUnproven: true,
      acceptanceCasesExecuted: false,
      permissionsGranted: false,
      generatedCodeExecuted: false,
      installed: false,
      promoted: false,
      canonChanged: false
    }
  };
}

function loadAiProposal(filePath) {
  const proposal = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  exactKeys(proposal, ['schema', 'sourceMode', 'proposalId', 'body'], 'AI proposal');
  assert.strictEqual(proposal.schema, AI_PROPOSAL_SCHEMA, 'AI proposal schema mismatch');
  assert.strictEqual(proposal.sourceMode, AI_SOURCE_MODE, 'AI proposal is not explicit opt-in');
  assert.match(proposal.proposalId, /^[a-z0-9][a-z0-9-]{1,79}$/);
  exactKeys(proposal.body, ['id', 'name', 'purpose', 'capability', 'inputFields', 'outputFields', 'steps', 'qualityClaims'], 'AI proposal body');
  return proposal;
}

function parseArgs(argv) {
  const result = { aiProposalPath: null, outputPath: null };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--ai-opt-in') {
      assert.ok(index + 1 < argv.length, '--ai-opt-in requires a proposal path');
      result.aiProposalPath = argv[++index];
    } else if (token === '--output') {
      assert.ok(index + 1 < argv.length, '--output requires a path');
      result.outputPath = argv[++index];
    } else {
      throw new Error('unsupported argument ' + token);
    }
  }
  return result;
}

function run(argv) {
  const args = parseArgs(argv);

  assert.strictEqual(Composer.PROFILE.network, 'DISABLED');
  assert.strictEqual(Composer.PROFILE.childProcesses, 'DISABLED');
  assert.strictEqual(Composer.PROFILE.generatedCodeExecution, 'DISABLED');
  assert.deepStrictEqual(CONCEPT.roots, ['truth', 'agency-non-domination', 'continuity', 'wisdom-over-speed']);

  const bodies = DETERMINISTIC_BODIES.map((body) => buildBody(
    body,
    DETERMINISTIC_SOURCE_MODE,
    { schema: 'axm.waldo-mirror.fabric-deterministic-body/v0.1', id: body.id, sha256: Composer.sha256(body) }
  ));

  let aiProposalRef = null;
  if (args.aiProposalPath) {
    const resolved = path.resolve(args.aiProposalPath);
    const proposal = loadAiProposal(resolved);
    aiProposalRef = {
      id: proposal.proposalId,
      schema: proposal.schema,
      sha256: Composer.sha256(proposal)
    };
    bodies.push(buildBody(proposal.body, AI_SOURCE_MODE, aiProposalRef));
  }

  assert.strictEqual(new Set(bodies.map((item) => item.blueprintRef.sha256)).size, bodies.length, 'different bodies collapsed to one blueprint');
  assert.ok(bodies.every((item) => item.conceptRef.sha256 === CONCEPT_SHA256), 'body lost shared concept lineage');

  const core = {
    schema: RECEIPT_SCHEMA,
    status: 'EXPERIMENTAL',
    challenge: 'ONE_CONCEPT_MANY_BODIES',
    donor: DONOR,
    conceptRef: {
      id: CONCEPT.id,
      schema: CONCEPT.schema,
      sha256: CONCEPT_SHA256
    },
    deterministicDefault: true,
    aiOptInUsed: Boolean(args.aiProposalPath),
    aiProposalRef,
    bodies,
    privateOrganFactory: {
      included: false,
      availability: 'NOT_PUBLIC_IN_DONOR',
      effectOnThisResult: 'NONE'
    },
    truth: {
      donorFabricModified: false,
      liveAiInvocationPerformedByHarness: false,
      networkRequestedByHarness: false,
      generatedExecutableCodeProduced: false,
      candidateCodeExecuted: false,
      runtimeBehaviorProven: false,
      humanQualityApproved: false,
      installationPerformed: false,
      promotionPerformed: false,
      canonChanged: false
    }
  };
  const receipt = { ...core, receiptSha256: Composer.sha256(core) };
  const rendered = JSON.stringify(receipt, null, 2) + '\n';
  if (args.outputPath) fs.writeFileSync(args.outputPath, rendered, { flag: 'wx' });
  process.stdout.write(rendered);
  return receipt;
}

if (require.main === module) {
  run(process.argv.slice(2));
}

module.exports = { CONCEPT, CONCEPT_SHA256, DETERMINISTIC_BODIES, intentForBody, buildBody, loadAiProposal, run };
