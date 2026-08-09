'use strict';

const Codec = require('./canonical');
const Portable = require('./portable-profile');
const Documents = require('./document-profile-registry');

function claim(id, kind, passCondition) { return { id, kind, required: true, pass_condition: passCondition }; }
function output(path, mediaType) { return { path, media_type: mediaType }; }

function packageRecord(id, title, dependencies, outputRecord, claimRecord, operation, payload, input) {
  const record = {
    schema: Portable.SCHEMAS.package,
    id,
    version: '0.1.0',
    title,
    dependencies,
    inputs: dependencies.map((dependency) => ({ from_package: dependency, selection: 'declared-verified-outputs' })),
    outputs: [outputRecord],
    executor: Documents.EXECUTOR,
    verifier: Documents.VERIFIER,
    claims: [claimRecord],
    sandbox: { network: false, write_scope: 'candidate-package-only' },
    resource_budget: { timeout_ms: 2000, max_output_bytes: 32768 },
    repair_policy: { max_attempts: 2, may_change_intent: false },
    authority: { source_write: false, install: false, promote: false, canon: false },
    document_operation: operation,
    document_payload: payload || {}
  };
  if (input) record.document_input = input;
  return Codec.seal(record);
}

function build(options) {
  options = options || {};
  const brief = Documents.normalizeBrief(options.brief || {
    title: 'Portable production runner',
    change: 'Added content-derived independent verification for declared production artifacts.',
    evidence: ['The appointed verifier reads produced bytes directly.', 'Executor-supplied claim facts are not used.'],
    limits: ['Candidate only.', 'No publication or promotion.', 'Editorial taste remains human review.']
  });
  const claims = [
    claim('document.brief-exact', 'structure', 'The source artifact exactly preserves the normalized locked brief.'),
    claim('document.draft-covers-brief', 'behavior', 'The release-note bytes exactly cover every independently read brief section.'),
    claim('document.comparison-bound', 'behavior', 'The comparison binds the exact draft and intent and proves no publication occurred.')
  ];
  const intent = Codec.seal({
    schema: Portable.SCHEMAS.intent,
    id: 'portable.document-release-note',
    version: '0.1.0',
    status: 'LOCKED',
    human_goal: 'Produce a deterministic release-note candidate whose claims are derived from artifact bytes rather than executor testimony.',
    target: { domain: 'documentation', profile: 'content-verified-release-note' },
    required_features: claims,
    forbidden_substitutions: ['executor-fact-only-verification', 'unbound-summary', 'automatic-publication'],
    constraints: { network: false, candidate_only: true },
    change_policy: { revision_creates_new_digest: true, silent_rewrite: false }
  });
  const source = packageRecord('document.brief-source', 'Exact brief source', [], output('source/brief.json', 'application/json'), claims[0], 'brief-source', brief);
  const draft = packageRecord('document.release-note-draft', 'Content-derived release note', [source.id], output('draft/release-note.md', 'text/markdown'), claims[1], 'release-note-draft', {}, { package_id: source.id, path: 'source/brief.json' });
  const comparison = packageRecord('document.intent-comparison', 'Intent and draft comparison', [draft.id], output('evidence/intent-comparison.json', 'application/json'), claims[2], 'intent-comparison', { intent_digest: intent.digest }, { package_id: draft.id, path: 'draft/release-note.md' });
  const packages = [source, draft, comparison];
  const graph = Codec.seal({
    schema: Portable.SCHEMAS.graph,
    id: 'portable.document-release-note-graph',
    version: '0.1.0',
    status: 'READY',
    intent_ref: { id: intent.id, version: intent.version, digest: intent.digest },
    nodes: packages.map((pkg) => ({ package_id: pkg.id, package_digest: pkg.digest })),
    edges: [{ from: source.id, to: draft.id }, { from: draft.id, to: comparison.id }],
    policy: { execution: 'serial', explicit_start: true, verified_only_assembly: true }
  });
  return { intent, packages, graph, source_anchor: 'portable-document-content-hand/v0.1' };
}

module.exports = { build };
