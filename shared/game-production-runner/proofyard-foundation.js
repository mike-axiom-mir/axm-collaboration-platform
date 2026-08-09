'use strict';

const Codec = require('./canonical');
const Contracts = require('./contracts');
const Fixtures = require('./fixture-registry');

function claim(id, kind, passCondition, required) { return { id, kind, required: required !== false, pass_condition: passCondition }; }
function output(path, media) { return { path, media_type: media || 'application/json' }; }

function packageRecord(id, title, dependencies, outputs, claims, fixture) {
  return Codec.seal({
    schema: Contracts.SCHEMAS.package,
    id,
    version: '0.1.0',
    title,
    dependencies,
    inputs: dependencies.map((dependency) => ({ from_package: dependency, selection: 'declared-verified-outputs' })),
    outputs,
    executor: Fixtures.EXECUTOR,
    verifier: Fixtures.VERIFIER,
    claims,
    sandbox: { network: false, write_scope: 'candidate-package-only' },
    resource_budget: { timeout_ms: 2000, max_output_bytes: 65536 },
    repair_policy: { max_attempts: 2, may_change_intent: false },
    authority: { source_write: false, install: false, promote: false, canon: false },
    fixture
  });
}

function build(options) {
  options = options || {};
  const includeHumanReview = options.includeHumanReview !== false;
  const requiredFeatures = [
    claim('project.importable', 'structure', 'A complete project scaffold is present.'),
    claim('player.moves', 'behavior', 'Seeded input changes authoritative player position.'),
    claim('walls.block', 'behavior', 'A collision trace proves walls block movement.'),
    claim('integration.loads', 'structure', 'Verified package outputs assemble into one candidate scene.'),
    claim('intent.matches', 'behavior', 'Every required feature resolves against the locked intent.')
  ];
  if (includeHumanReview) requiredFeatures.push(claim('experience.fun', 'human', 'A human reviews movement feel, readability, coherence, and fun.'));
  const intent = Codec.seal({
    schema: Contracts.SCHEMAS.intent,
    id: 'proofyard.signal-run.foundation',
    version: '0.1.0',
    status: 'LOCKED',
    human_goal: 'Prove one complete evidence-bound path from locked game intent to an assembled candidate.',
    target: { domain: 'game', profile: 'deterministic-2d-top-down-foundation', engine: 'fixture-only-before-godot' },
    required_features: requiredFeatures,
    forbidden_substitutions: ['screenshot-only', 'title-screen-only', 'unrelated-game', 'dirty-process-only'],
    constraints: { network: false, candidate_only: true, engine_execution: 'held-until-exact-substrate' },
    change_policy: { revision_creates_new_digest: true, silent_rewrite: false }
  });

  const packages = [
    packageRecord('proofyard.project-scaffold', 'Project scaffold', [], [output('project/project.godot', 'text/plain')], [requiredFeatures[0]], {
      artifacts: [{ path: 'project/project.godot', content: '[application]\nconfig/name="Proofyard"\n' }],
      facts: { claims: { 'project.importable': true } }
    }),
    packageRecord('proofyard.player-motion', 'Player motion', ['proofyard.project-scaffold'], [output('scripts/player.gd', 'text/plain')], [requiredFeatures[1]], {
      artifacts: [{ path: 'scripts/player.gd', content: 'extends CharacterBody2D\n# fixture source; native proof still held\n' }],
      facts: { claims: { 'player.moves': true }, trace: { before: [0, 0], input: [1, 0], after: [1, 0] } }
    }),
    packageRecord('proofyard.collision', 'Collision behavior', ['proofyard.player-motion'], [output('evidence/collision-trace.json')], [requiredFeatures[2]], {
      artifacts: [{ path: 'evidence/collision-trace.json', content: JSON.stringify({ before: [2, 2], attempted: [3, 2], wall: [3, 2], after: [2, 2] }) }],
      facts: { claims: { 'walls.block': true } }
    }),
    packageRecord('proofyard.integration', 'Verified integration candidate', ['proofyard.collision'], [output('project/main.tscn', 'text/plain')], [requiredFeatures[3]], {
      artifacts: [{ path: 'project/main.tscn', content: '[gd_scene format=3]\n' }],
      facts: { claims: { 'integration.loads': true } }
    }),
    packageRecord('proofyard.intent-comparison', 'Final intent comparison', ['proofyard.integration'], [output('evidence/intent-comparison.json')], requiredFeatures.slice(4), {
      artifacts: [{ path: 'evidence/intent-comparison.json', content: JSON.stringify({ intent: intent.digest, required: requiredFeatures.map((item) => item.id), fixtureOnly: true }) }],
      facts: { claims: { 'intent.matches': true } }
    })
  ];
  const edges = [];
  for (const pkg of packages) for (const dependency of pkg.dependencies) edges.push({ from: dependency, to: pkg.id });
  const graph = Codec.seal({
    schema: Contracts.SCHEMAS.graph,
    id: 'proofyard.signal-run.foundation-graph',
    version: '0.1.0',
    status: 'READY',
    intent_ref: { id: intent.id, version: intent.version, digest: intent.digest },
    nodes: packages.map((pkg) => ({ package_id: pkg.id, package_digest: pkg.digest })),
    edges,
    policy: { execution: 'serial', explicit_start: true, verified_only_assembly: true }
  });
  return { intent, packages, graph, source_anchor: 'local-proofyard-foundation-fixture/v0.1' };
}

module.exports = { build };
