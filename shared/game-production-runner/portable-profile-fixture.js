'use strict';

const Codec = require('./canonical');
const Portable = require('./portable-profile');
const Fixtures = require('./fixture-registry');

function claim(id, kind, passCondition) { return { id, kind, required: true, pass_condition: passCondition }; }
function output(path, mediaType) { return { path, media_type: mediaType || 'application/json' }; }

function packageRecord(id, title, dependencies, outputs, claims, fixture) {
  return Codec.seal({
    schema: Portable.SCHEMAS.package,
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
    resource_budget: { timeout_ms: 2000, max_output_bytes: 32768 },
    repair_policy: { max_attempts: 2, may_change_intent: false },
    authority: { source_write: false, install: false, promote: false, canon: false },
    fixture
  });
}

function build() {
  const claims = [
    claim('brief.source-present', 'structure', 'The locked source brief is preserved as a declared artifact.'),
    claim('brief.draft-complete', 'behavior', 'The draft includes every required section from the locked brief.'),
    claim('brief.packet-matches-intent', 'behavior', 'The final comparison binds the packet to the exact intent digest.')
  ];
  const intent = Codec.seal({
    schema: Portable.SCHEMAS.intent,
    id: 'portable.release-note-packet',
    version: '0.1.0',
    status: 'LOCKED',
    human_goal: 'Produce a bounded release-note candidate from one locked documentation brief.',
    target: { domain: 'documentation', profile: 'release-note-candidate' },
    required_features: claims,
    forbidden_substitutions: ['game-project', 'unbound-summary', 'automatic-publication'],
    constraints: { network: false, candidate_only: true },
    change_policy: { revision_creates_new_digest: true, silent_rewrite: false }
  });
  const packages = [
    packageRecord('portable.brief-source', 'Locked brief source', [], [output('source/brief.json')], [claims[0]], {
      artifacts: [{ path: 'source/brief.json', content: JSON.stringify({ title: 'Portable runner trial', sections: ['change', 'evidence', 'limits'] }) }],
      facts: { claims: { 'brief.source-present': true } }
    }),
    packageRecord('portable.brief-draft', 'Release-note draft', ['portable.brief-source'], [output('draft/release-note.md', 'text/markdown')], [claims[1]], {
      artifacts: [{ path: 'draft/release-note.md', content: '# Portable runner trial\n\n## Change\nAdapter trial.\n\n## Evidence\nFixture only.\n\n## Limits\nNo publication.\n' }],
      facts: { claims: { 'brief.draft-complete': true } }
    }),
    packageRecord('portable.brief-comparison', 'Intent-bound comparison', ['portable.brief-draft'], [output('evidence/intent-comparison.json')], [claims[2]], {
      artifacts: [{ path: 'evidence/intent-comparison.json', content: JSON.stringify({ intent_digest: intent.digest, publication: false, fixture_only: true }) }],
      facts: { claims: { 'brief.packet-matches-intent': true } }
    })
  ];
  const graph = Codec.seal({
    schema: Portable.SCHEMAS.graph,
    id: 'portable.release-note-packet-graph',
    version: '0.1.0',
    status: 'READY',
    intent_ref: { id: intent.id, version: intent.version, digest: intent.digest },
    nodes: packages.map((pkg) => ({ package_id: pkg.id, package_digest: pkg.digest })),
    edges: [{ from: packages[0].id, to: packages[1].id }, { from: packages[1].id, to: packages[2].id }],
    policy: { execution: 'serial', explicit_start: true, verified_only_assembly: true }
  });
  return { intent, packages, graph, source_anchor: 'portable-documentation-fixture/v0.1' };
}

module.exports = { build };
