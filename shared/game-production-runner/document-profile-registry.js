'use strict';

const Codec = require('./canonical');

const EXECUTOR = Object.freeze({ id: 'axm.hand.documentation.release-note', version: '1.0.0' });
const VERIFIER = Object.freeze({ id: 'axm.verifier.documentation.release-note', version: '1.0.0' });

function cleanText(value, label) {
  const text = String(value == null ? '' : value).replace(/\r?\n/g, ' ').trim();
  if (!text) throw new Error(label + ' is required');
  return text;
}

function cleanList(value, label) {
  if (!Array.isArray(value) || !value.length) throw new Error(label + ' must be a non-empty array');
  return value.map((item, index) => cleanText(item, label + ' ' + index));
}

function normalizeBrief(value) {
  value = value || {};
  return {
    title: cleanText(value.title, 'brief title'),
    change: cleanText(value.change, 'brief change'),
    evidence: cleanList(value.evidence, 'brief evidence'),
    limits: cleanList(value.limits, 'brief limits')
  };
}

function outputPath(pkg) {
  if (!pkg.outputs || pkg.outputs.length !== 1) throw new Error('documentation package requires exactly one output');
  return pkg.outputs[0].path;
}

function sourceRef(pkg) {
  const ref = pkg.document_input;
  if (!ref || !ref.package_id || !ref.path) throw new Error('documentation input reference is required');
  return ref;
}

function renderReleaseNote(brief) {
  return [
    '# ' + brief.title,
    '',
    '## Change',
    brief.change,
    '',
    '## Evidence',
    ...brief.evidence.map((item) => '- ' + item),
    '',
    '## Limits',
    ...brief.limits.map((item) => '- ' + item),
    ''
  ].join('\n');
}

function inspectHeadings(markdown) {
  return ['## Change', '## Evidence', '## Limits'].every((heading) => markdown.includes(heading));
}

function inspectReleaseNote(markdown, brief) {
  if (typeof markdown !== 'string' || !markdown.endsWith('\n')) return false;
  const lines = markdown.slice(0, -1).split('\n');
  let cursor = 0;
  function take(expected) { const pass = lines[cursor] === expected; cursor += 1; return pass; }
  if (!take('# ' + brief.title) || !take('') || !take('## Change') || !take(brief.change) || !take('') || !take('## Evidence')) return false;
  for (const item of brief.evidence) if (!take('- ' + item)) return false;
  if (!take('') || !take('## Limits')) return false;
  for (const item of brief.limits) if (!take('- ' + item)) return false;
  return cursor === lines.length;
}

function execute(context) {
  const pkg = context.package;
  const operation = pkg.document_operation;
  const path = outputPath(pkg);
  if (operation === 'brief-source') {
    const brief = normalizeBrief(pkg.document_payload);
    return { artifacts: [{ path, content: JSON.stringify(brief, null, 2) + '\n' }], facts: { operation } };
  }
  if (operation === 'release-note-draft') {
    const ref = sourceRef(pkg);
    const brief = normalizeBrief(JSON.parse(context.readInput(ref.package_id, ref.path).toString('utf8')));
    return { artifacts: [{ path, content: renderReleaseNote(brief) }], facts: { operation } };
  }
  if (operation === 'intent-comparison') {
    const ref = sourceRef(pkg);
    const markdown = context.readInput(ref.package_id, ref.path).toString('utf8');
    const comparison = {
      intent_digest: cleanText(pkg.document_payload && pkg.document_payload.intent_digest, 'intent digest'),
      draft_digest: Codec.sha256(Buffer.from(markdown, 'utf8')),
      required_headings_present: inspectHeadings(markdown),
      publication_performed: false
    };
    return { artifacts: [{ path, content: JSON.stringify(comparison, null, 2) + '\n' }], facts: { operation } };
  }
  throw new Error('unsupported documentation operation');
}

function inspect(context) {
  const pkg = context.package;
  const operation = pkg.document_operation;
  const path = outputPath(pkg);
  const bytes = context.readArtifact(path);
  let pass = false;
  let detail = 'unsupported documentation operation';
  if (operation === 'brief-source') {
    const actual = normalizeBrief(JSON.parse(bytes.toString('utf8')));
    const expected = normalizeBrief(pkg.document_payload);
    pass = Codec.canonical(actual) === Codec.canonical(expected);
    detail = pass ? 'Brief bytes match the exact normalized package payload.' : 'Brief bytes differ from the normalized package payload.';
  } else if (operation === 'release-note-draft') {
    const ref = sourceRef(pkg);
    const brief = normalizeBrief(JSON.parse(context.readInput(ref.package_id, ref.path).toString('utf8')));
    const markdown = bytes.toString('utf8');
    pass = inspectReleaseNote(markdown, brief);
    detail = pass ? 'Draft bytes independently parse to the exact brief fields and structure.' : 'Draft bytes do not independently parse to the exact brief fields and structure.';
  } else if (operation === 'intent-comparison') {
    const ref = sourceRef(pkg);
    const markdown = context.readInput(ref.package_id, ref.path).toString('utf8');
    const actual = JSON.parse(bytes.toString('utf8'));
    pass = actual.intent_digest === pkg.document_payload.intent_digest && actual.draft_digest === Codec.sha256(Buffer.from(markdown, 'utf8')) && actual.required_headings_present === inspectHeadings(markdown) && actual.publication_performed === false;
    detail = pass ? 'Comparison bytes bind the exact input draft and intent without publication.' : 'Comparison bytes fail draft, intent, heading, or publication binding.';
  }
  return { pass, detail, bytes, path };
}

function verify(context) {
  let observation;
  try { observation = inspect(context); } catch (error) { observation = { pass: false, detail: String(error.message || error), bytes: Buffer.alloc(0), path: context.package.outputs && context.package.outputs[0] && context.package.outputs[0].path || 'unknown' }; }
  const descriptor = (context.artifacts || []).find((item) => item.path === observation.path);
  return {
    schema: 'axm.verification-receipt/v2',
    id: 'document-content-verification-' + context.package.id,
    verifier: { id: VERIFIER.id, version: VERIFIER.version, category: 'documentation' },
    subject: { id: context.package.id, kind: 'production-package', version: context.package.version, digest: context.package.digest },
    target_profile: 'portable-document-release-note',
    claims: context.package.claims.map((claim) => ({
      id: claim.id,
      status: observation.pass ? 'PASS' : 'FAIL',
      required: claim.required,
      risk: claim.kind === 'behavior' ? 'medium' : 'low',
      summary: claim.pass_condition,
      evidence: [{ kind: 'artifact-content-inspection', artifact_path: observation.path, artifact_digest: descriptor && descriptor.digest || null, bytes: descriptor && descriptor.bytes || observation.bytes.length, detail: observation.detail }],
      limitations: ['Deterministic content and structure only; editorial quality remains human review.']
    })),
    created_at: '2000-01-01T00:00:00.000Z'
  };
}

function create() {
  const executor = { identity: EXECUTOR, cache_policy: 'deterministic-v1', execute };
  const verifier = { identity: VERIFIER, verify };
  return { executors: [executor], verifiers: [verifier], inventory: { executors: [EXECUTOR], verifiers: [VERIFIER] } };
}

module.exports = { EXECUTOR, VERIFIER, normalizeBrief, renderReleaseNote, inspectHeadings, inspectReleaseNote, create };
