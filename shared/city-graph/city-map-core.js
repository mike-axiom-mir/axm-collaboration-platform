'use strict';

const crypto = require('crypto');

const GRAPH_SCHEMA = 'axm.city-graph/v1';
const BLOCK_SCHEMA = 'axm.block-view/v1';
const RECEIPT_SCHEMA = 'axm.city-graph-receipt/v1';
const BLOCK_KINDS = new Set(['BRICK', 'SENSOR', 'ORGAN', 'HAND', 'ROOM', 'BRIDGE', 'ROUTE', 'DISTRICT', 'UNKNOWN']);
const VOLATILE_KEYS = new Set(['generatedAt', 'timestamp', 'measuredAt', 'durationMs', 'ageDays']);

class CityMapError extends Error {
  constructor(code, message, details) {
    super(message);
    this.name = 'CityMapError';
    this.code = code;
    this.details = details || null;
  }
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((out, key) => {
    out[key] = stable(value[key]);
    return out;
  }, {});
}

function canonical(value) {
  return JSON.stringify(stable(value));
}

function pretty(value) {
  return JSON.stringify(stable(value), null, 2) + '\n';
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function normalizeSemantic(value) {
  if (Array.isArray(value)) return value.map(normalizeSemantic);
  if (!value || typeof value !== 'object') {
    if (typeof value === 'string' && (/^[A-Za-z]:[\\/]/.test(value) || /^\\\\/.test(value))) return '<MACHINE_LOCAL_PATH>';
    return value;
  }
  return Object.keys(value).sort().reduce((out, key) => {
    if (VOLATILE_KEYS.has(key)) return out;
    out[key] = normalizeSemantic(value[key]);
    return out;
  }, {});
}

function semanticDigest(value) {
  return sha256(canonical(normalizeSemantic(value)));
}

function strings(value) {
  return Array.isArray(value) ? value.filter(item => typeof item === 'string' && item.trim()).map(item => item.trim()) : [];
}

function unique(values) {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

function declarationId(row) {
  const manifest = row.manifest && row.manifest.value;
  const contract = row.contract && row.contract.value;
  return String(manifest && manifest.id || contract && contract.id || row.folder || '').trim();
}

function declaredPermissions(row) {
  const manifest = row.manifest && row.manifest.value;
  const contract = row.contract && row.contract.value;
  return {
    manifest: manifest && Array.isArray(manifest.permissions) ? unique(strings(manifest.permissions)) : null,
    contract: contract && Array.isArray(contract.permissions) ? unique(strings(contract.permissions)) : null
  };
}

function socketSet(row) {
  const manifest = row.manifest && row.manifest.value || {};
  const contract = row.contract && row.contract.value || {};
  const handoffs = contract.handoffs || {};
  return {
    accepts: unique([...strings(manifest.accepts), ...strings(handoffs.accepts)]),
    emits: unique([...strings(manifest.produces), ...strings(handoffs.emits)]),
    consumes: unique(strings(contract.consumes)),
    provides: unique(strings(contract.provides))
  };
}

function effectsFor(row, permissions) {
  const manifest = row.manifest && row.manifest.value || {};
  const contract = row.contract && row.contract.value || {};
  const writes = strings(contract.boundaries && contract.boundaries.writes);
  const raw = unique([...(permissions.contract || permissions.manifest || []), ...writes]);
  const classes = new Set();
  const unknown = [];
  for (const value of raw) {
    const token = value.toLowerCase();
    if (/canon/.test(token)) classes.add('CANON_CHANGE');
    else if (/root/.test(token)) classes.add('ROOT_CHANGE');
    else if (/promot/.test(token)) classes.add('PROMOTION');
    else if (/physical|hardware|actuat|device-control/.test(token)) classes.add('PHYSICAL_ACTUATION');
    else if (/public-release|publish-public/.test(token)) classes.add('PUBLIC_RELEASE');
    else if (/network-write|github-write|remote-write|webhook/.test(token)) classes.add('NETWORK_WRITE');
    else if (/network|fetch|remote-read|github-read/.test(token)) classes.add('NETWORK_READ');
    else if (/execute|child-process|spawn|trusted-process|shell/.test(token)) classes.add('EXECUTE_TRUSTED');
    else if (/candidate|write|save|export|download|inbox|create|delete|storage/.test(token)) classes.add('WRITE_CANDIDATE');
    else if (/private/.test(token)) classes.add('READ_PRIVATE');
    else if (/read|observe|inspect/.test(token)) classes.add('OBSERVE_LOCAL');
    else unknown.push(value);
  }
  for (const declared of strings(manifest.effectClasses)) classes.add(declared);
  if (classes.size === 0) classes.add('NONE');
  return {
    capable: Array.from(classes).sort(),
    declarationInputs: raw,
    unknownDeclarations: unique(unknown),
    measured: false,
    note: 'Effects are declarations/inferences, not authority or proof that an effect occurred.'
  };
}

function classify(row, effects) {
  const manifest = row.manifest && row.manifest.value || {};
  const explicit = String(manifest.legoBlockKind || '').toUpperCase();
  if (BLOCK_KINDS.has(explicit) && explicit !== 'UNKNOWN') {
    return { kind: explicit, state: 'DECLARED', basis: ['manifest.legoBlockKind'] };
  }
  const id = declarationId(row).toLowerCase();
  const text = [id, manifest.kind, manifest.type, manifest.summary, ...strings(manifest.tags), ...strings(manifest.actions)].filter(Boolean).join(' ').toLowerCase();
  const hasEffect = effects.capable.some(effect => !['NONE', 'OBSERVE_LOCAL', 'READ_PRIVATE', 'NETWORK_READ'].includes(effect));
  if (/\b(route|workflow|pipeline)\b/.test(text)) return { kind: 'ROUTE', state: 'INFERRED_UNCONFIRMED', basis: ['route/workflow vocabulary'] };
  if (/bridge|adapter|connector|translation|sync-service/.test(text)) return { kind: 'BRIDGE', state: 'INFERRED_UNCONFIRMED', basis: ['adapter/bridge vocabulary'] };
  if (hasEffect || /\b(hand|executor|publisher|controller)\b/.test(text)) return { kind: 'HAND', state: 'INFERRED_UNCONFIRMED', basis: [hasEffect ? 'effectful declaration' : 'hand/executor vocabulary'] };
  if (/\.html?$/i.test(String(manifest.entry || '')) || manifest.type === 'hub-module' || manifest.kind === 'product') return { kind: 'ROOM', state: 'INFERRED_UNCONFIRMED', basis: ['human-facing entry/type'] };
  if (/observ|inspect|discover|readiness|verification|evidence|map/.test(text)) return { kind: 'SENSOR', state: 'INFERRED_UNCONFIRMED', basis: ['observer/verifier vocabulary'] };
  if (/pure|deterministic|transform/.test(text) && effects.capable.length === 1 && effects.capable[0] === 'NONE') return { kind: 'BRICK', state: 'INFERRED_UNCONFIRMED', basis: ['pure/deterministic vocabulary and no declared effects'] };
  return { kind: 'ORGAN', state: 'INFERRED_UNCONFIRMED', basis: ['bounded declared module fallback'] };
}

function sourceView(row) {
  const parts = [];
  if (row.manifest) parts.push(['manifest', row.manifest.sha256]);
  if (row.contract) parts.push(['contract', row.contract.sha256]);
  for (const proof of [...(row.selftests || []), ...(row.evidence || [])]) {
    if (proof && typeof proof === 'object' && proof.sha256) parts.push([proof.path, proof.sha256]);
  }
  for (const sourceFile of row.sourceFiles || []) {
    if (sourceFile && sourceFile.sha256) parts.push([sourceFile.path, sourceFile.sha256]);
  }
  return {
    root: row.root,
    declaredId: declarationId(row),
    manifest: row.manifest ? row.manifest.path : null,
    contract: row.contract ? row.contract.path : null,
    declarationFiles: unique((row.declarations || []).map(item => item.path)),
    observedSourceFileCount: (row.sourceFiles || []).length,
    digest: sha256(parts.map(([kind, digest]) => `${kind}:${digest}`).sort().join('\n'))
  };
}

function makeBlock(row) {
  const id = String(row.cityId || declarationId(row)).trim();
  if (!id) throw new CityMapError('MISSING_BLOCK_ID', `Declared module at ${row.root} has no id`, { root: row.root });
  const manifest = row.manifest && row.manifest.value || {};
  const contract = row.contract && row.contract.value || {};
  const permissions = declaredPermissions(row);
  if (permissions.manifest && permissions.contract && canonical(permissions.manifest) !== canonical(permissions.contract)) {
    throw new CityMapError('EFFECT_PERMISSION_DRIFT', `Permission declarations differ for ${id}`, { id, permissions });
  }
  const effects = effectsFor(row, permissions);
  const sockets = socketSet(row);
  return {
    schema: BLOCK_SCHEMA,
    id,
    name: String(manifest.name || id),
    version: String(manifest.version || contract.version || 'UNKNOWN'),
    source: sourceView(row),
    classification: classify(row, effects),
    status: String(manifest.status || 'EXPERIMENTAL'),
    sockets,
    effects,
    authority: {
      declaredPermissions: permissions.contract || permissions.manifest || [],
      availableIsAuthorized: false,
      grants: [],
      install: false,
      execute: false,
      networkWrite: false,
      promote: false,
      merge: false,
      canon: false,
      roots: false
    },
    proof: {
      selftests: unique((row.selftests || []).map(item => typeof item === 'string' ? item : item.path)),
      evidenceLocators: unique((row.evidence || []).map(item => typeof item === 'string' ? item : item.path)),
      behaviorProvenByGraph: false,
      freshness: 'UNKNOWN'
    },
    resources: {
      uses: unique(strings(manifest.uses)),
      readiness: unique(strings(manifest.readiness))
    },
    surfaces: {
      entry: manifest.entry || null,
      audience: manifest.audience || 'UNDECLARED',
      type: manifest.type || manifest.kind || 'UNDECLARED'
    },
    boundaries: {
      writes: unique(strings(contract.boundaries && contract.boundaries.writes)),
      refuses: unique(strings(contract.boundaries && contract.boundaries.refuses))
    }
  };
}

function schemaLike(value) {
  return /^axm\.[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value);
}

function compileSnapshot(input) {
  input = input || {};
  const rows = Array.isArray(input.declarations) ? input.declarations : [];
  const blocks = rows.map(makeBlock).sort((a, b) => a.id.localeCompare(b.id));
  const seen = new Map();
  for (const block of blocks) {
    if (seen.has(block.id)) {
      throw new CityMapError('DUPLICATE_BLOCK_ID', `Duplicate block id ${block.id}`, { first: seen.get(block.id), second: block.source.root });
    }
    seen.set(block.id, block.source.root);
  }

  const schemaRows = (Array.isArray(input.schemas) ? input.schemas : []).map(row => ({ id: row.id, path: row.path, sha256: row.sha256 })).sort((a, b) => a.id.localeCompare(b.id));
  const schemaIds = new Set(schemaRows.map(row => row.id));
  const capabilities = new Map();
  const edges = [];
  const unresolved = [];
  function capability(id) {
    if (!capabilities.has(id)) capabilities.set(id, { id, providers: [], consumers: [] });
    return capabilities.get(id);
  }
  for (const block of blocks) {
    for (const id of block.sockets.provides) capability(id).providers.push(block.id);
    for (const id of block.sockets.consumes) capability(id).consumers.push(block.id);
    for (const socket of [...block.sockets.accepts, ...block.sockets.emits]) {
      if (schemaLike(socket) && !schemaIds.has(socket)) unresolved.push({ code: 'UNRESOLVED_SCHEMA', blockId: block.id, socket, state: 'UNKNOWN' });
    }
  }
  for (const row of capabilities.values()) {
    row.providers = unique(row.providers);
    row.consumers = unique(row.consumers);
    for (const consumer of row.consumers) {
      if (row.providers.length === 0) unresolved.push({ code: 'UNRESOLVED_CAPABILITY', blockId: consumer, socket: row.id, state: 'UNKNOWN' });
      for (const provider of row.providers) edges.push({ type: 'CAPABILITY', from: provider, to: consumer, socket: row.id });
    }
  }
  const strictSchemas = input.strictSchemas === true;
  if (strictSchemas) {
    const missing = unresolved.filter(row => row.code === 'UNRESOLVED_SCHEMA');
    if (missing.length) throw new CityMapError('UNRESOLVED_SCHEMA', `Unresolved schema ${missing[0].socket} for ${missing[0].blockId}`, missing);
  }
  const declarationDigest = sha256(blocks.map(block => `${block.id}:${block.source.digest}`).join('\n'));
  const graphBase = {
    schema: GRAPH_SCHEMA,
    source: {
      commit: input.sourceCommit || null,
      commitBinding: input.sourceCommit ? 'EXPLICIT_EXTERNAL_SNAPSHOT' : 'UNBOUND_SELF_REFERENTIAL_OUTPUT',
      snapshotIdentity: declarationDigest,
      roots: unique(input.roots || []),
      declarationDigest,
      pathForm: 'repository-relative-posix'
    },
    summary: {
      blocks: blocks.length,
      blockKinds: blocks.reduce((out, block) => { out[block.classification.kind] = Number(out[block.classification.kind] || 0) + 1; return out; }, {}),
      capabilities: capabilities.size,
      schemas: schemaRows.length,
      edges: edges.length,
      unresolved: unresolved.length,
      declaredManifests: rows.filter(row => !!row.manifest).length,
      declaredContracts: rows.filter(row => !!row.contract).length
    },
    blocks,
    capabilities: Array.from(capabilities.values()).sort((a, b) => a.id.localeCompare(b.id)),
    schemas: schemaRows,
    edges: edges.sort((a, b) => canonical(a).localeCompare(canonical(b))),
    unresolved: unresolved.sort((a, b) => canonical(a).localeCompare(canonical(b))),
    truth: {
      automaticInstall: false,
      automaticExecution: false,
      capabilityGrantsAuthority: false,
      automaticPromotion: false,
      automaticCanon: false,
      inferredClassificationIsCompatibilityProof: false,
      absenceIsSafetyProof: false
    }
  };
  return { ...graphBase, semanticDigest: semanticDigest(graphBase) };
}

function humanMap(graph) {
  const lines = [
    '# AXM LEGO Software City — Generated Map',
    '',
    'Status: **EXPERIMENTAL generated view**',
    '',
    `Source commit: \`${graph.source.commit || 'UNBOUND (see declaration digest and live command receipt)'}\``,
    '',
    `Semantic graph digest: \`${graph.semanticDigest}\``,
    '',
    `Blocks: ${graph.summary.blocks} · Capabilities: ${graph.summary.capabilities} · Schemas: ${graph.summary.schemas} · Unresolved edges: ${graph.summary.unresolved}`,
    '',
    'This file is generated from the same graph as the machine views. Labels never grant installation, execution, network, promotion, merge, CANON, or root authority.',
    '',
    '| Block | LEGO kind | Status | Effects | Provides | Consumes | Proof |',
    '|---|---|---|---|---:|---:|---:|'
  ];
  for (const block of graph.blocks) {
    lines.push(`| ${block.id} | ${block.classification.kind} (${block.classification.state}) | ${block.status} | ${block.effects.capable.join(', ')} | ${block.sockets.provides.length} | ${block.sockets.consumes.length} | ${block.proof.selftests.length} selftest(s) |`);
  }
  lines.push('', '## Unresolved edges', '');
  if (graph.unresolved.length === 0) lines.push('None.');
  else for (const row of graph.unresolved) lines.push(`- \`${row.code}\` — \`${row.blockId}\` → \`${row.socket}\` (${row.state})`);
  lines.push('', '## Truth boundary', '', '- Availability is not authorization.', '- Generated classification is provisional unless explicitly declared.', '- A digest proves byte identity, not safety or correctness.', '- Passing this map gate does not promote or canonize any block.', '');
  return lines.join('\n');
}

function jsonl(rows) {
  return rows.map(row => canonical(row)).join('\n') + (rows.length ? '\n' : '');
}

function buildViews(graph) {
  const modules = {
    schema: 'axm.city-module-registry/v1',
    graphDigest: graph.semanticDigest,
    blocks: graph.blocks.map(block => ({
      id: block.id,
      name: block.name,
      version: block.version,
      kind: block.classification.kind,
      classificationState: block.classification.state,
      status: block.status,
      source: block.source,
      effects: block.effects.capable,
      authorityGranted: false
    }))
  };
  const authority = {
    schema: 'axm.city-authority-map/v1',
    graphDigest: graph.semanticDigest,
    blocks: graph.blocks.map(block => ({ id: block.id, capableEffects: block.effects.capable, declaredPermissions: block.authority.declaredPermissions, grants: [], availableIsAuthorized: false })),
    truth: { capabilityGrantsAuthority: false, aiSelfAuthorization: false, generatedMapGrantsAuthority: false }
  };
  const proof = {
    schema: 'axm.city-proof-map/v1',
    graphDigest: graph.semanticDigest,
    blocks: graph.blocks.map(block => ({ id: block.id, selftests: block.proof.selftests, evidenceLocators: block.proof.evidenceLocators, behaviorProvenByGraph: false, freshness: block.proof.freshness }))
  };
  const dependencies = { schema: 'axm.city-dependency-graph/v1', graphDigest: graph.semanticDigest, edges: graph.edges };
  const unresolved = { schema: 'axm.city-unresolved-edges/v1', graphDigest: graph.semanticDigest, count: graph.unresolved.length, edges: graph.unresolved };
  const files = {
    'registry/generated/city-graph.json': pretty(graph),
    'registry/generated/city-modules.json': pretty(modules),
    'registry/generated/city-capabilities.jsonl': jsonl(graph.capabilities.map(row => ({ schema: 'axm.city-capability/v1', graphDigest: graph.semanticDigest, ...row }))),
    'registry/generated/city-authority-map.json': pretty(authority),
    'registry/generated/city-proof-map.json': pretty(proof),
    'registry/generated/city-dependencies.json': pretty(dependencies),
    'registry/generated/city-unresolved-edges.json': pretty(unresolved),
    'docs/generated/LEGO_CITY_MAP.md': humanMap(graph)
  };
  const viewDigests = Object.fromEntries(Object.entries(files).map(([name, content]) => [name, sha256(content)]));
  const checks = [
    { id: 'graph-digest-format', pass: /^[a-f0-9]{64}$/.test(graph.semanticDigest) },
    { id: 'block-ids-unique', pass: new Set(graph.blocks.map(block => block.id)).size === graph.blocks.length },
    { id: 'authority-closed', pass: graph.blocks.every(block => block.authority.availableIsAuthorized === false && block.authority.grants.length === 0) },
    { id: 'views-derived-from-graph', pass: Object.keys(files).length === 8 }
  ];
  const receiptBase = {
    schema: RECEIPT_SCHEMA,
    state: checks.every(row => row.pass) ? 'PASS' : 'FAIL',
    sourceCommit: graph.source.commit,
    graphDigest: graph.semanticDigest,
    viewDigests,
    checks,
    authority: { install: false, execute: false, networkWrite: false, promote: false, merge: false, canon: false, roots: false }
  };
  files['registry/generated/city-graph.receipt.json'] = pretty({ ...receiptBase, receiptDigest: semanticDigest(receiptBase) });
  return files;
}

function compareGenerated(graph, existingFiles) {
  const expected = buildViews(graph);
  const failures = [];
  let previousGraph = null;
  try { previousGraph = JSON.parse(existingFiles['registry/generated/city-graph.json'] || 'null'); } catch (_) {}
  const previousIds = new Set(previousGraph && Array.isArray(previousGraph.blocks) ? previousGraph.blocks.map(block => block.id) : []);
  const newlyDiscovered = graph.blocks.map(block => block.id).filter(id => !previousIds.has(id));
  if (previousGraph && newlyDiscovered.length) failures.push({ code: 'UNINDEXED_MODULE', modules: newlyDiscovered });
  for (const [name, content] of Object.entries(expected)) {
    if (!Object.prototype.hasOwnProperty.call(existingFiles, name)) {
      failures.push({ code: name.endsWith('LEGO_CITY_MAP.md') ? 'HUMAN_VIEW_DRIFT' : 'CITY_GRAPH_DRIFT', path: name, reason: 'MISSING_GENERATED_VIEW' });
      continue;
    }
    if (existingFiles[name] !== content) {
      let code = 'GENERATED_VIEW_DRIFT';
      if (name === 'registry/generated/city-graph.json') code = 'CITY_GRAPH_DRIFT';
      else if (name === 'registry/generated/city-authority-map.json') code = 'AUTHORITY_MAP_STALE';
      else if (name.endsWith('LEGO_CITY_MAP.md')) code = 'HUMAN_VIEW_DRIFT';
      failures.push({ code, path: name, expectedSha256: sha256(content), observedSha256: sha256(existingFiles[name]) });
    }
  }
  return { state: failures.length ? 'FAIL' : 'PASS', graphDigest: graph.semanticDigest, failures, expected };
}

function validateGraph(graph) {
  const errors = [];
  if (!graph || graph.schema !== GRAPH_SCHEMA) errors.push(`schema must be ${GRAPH_SCHEMA}`);
  if (!graph || !/^[a-f0-9]{64}$/.test(String(graph.semanticDigest || ''))) errors.push('semanticDigest must be sha256');
  if (!graph || !Array.isArray(graph.blocks)) errors.push('blocks must be an array');
  if (graph && graph.truth && graph.truth.capabilityGrantsAuthority !== false) errors.push('capabilityGrantsAuthority must remain false');
  if (graph && Array.isArray(graph.blocks) && new Set(graph.blocks.map(row => row.id)).size !== graph.blocks.length) errors.push('block ids must be unique');
  if (graph && graph.semanticDigest) {
    const base = { ...graph };
    delete base.semanticDigest;
    if (semanticDigest(base) !== graph.semanticDigest) errors.push('semanticDigest does not match graph content');
  }
  return { pass: errors.length === 0, errors };
}

module.exports = {
  GRAPH_SCHEMA,
  BLOCK_SCHEMA,
  RECEIPT_SCHEMA,
  CityMapError,
  stable,
  canonical,
  pretty,
  sha256,
  normalizeSemantic,
  semanticDigest,
  compileSnapshot,
  buildViews,
  compareGenerated,
  validateGraph,
  humanMap
};
