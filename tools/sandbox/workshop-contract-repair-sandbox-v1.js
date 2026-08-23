'use strict';

const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');
const Readiness = require('../../shared/readiness/tool-readiness');
const ContractVerifier = require('../../hub/module-contract-verifier');
const Planner = require('../../shared/code-capability-fabric/workshop-contract-repair-planner-v1');

const VERSION = '1.0.0';
const RECEIPT_SCHEMA = 'axm.workshop-contract-repair-draft-receipt/v1';
const ROOT_NAMES = Object.freeze({ source: 'source', output: 'output', evidence: 'evidence' });
const ITERATION = /^iteration-([0-9]{3})$/;
const HOST_ROOT = path.resolve(__dirname, '../..');
const CONTRACT_REPAIR_STATE_ROOT = path.resolve(__dirname, '../../state/workshop-contract-repair-sandboxes');
const REVIEW_CSP = "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; object-src 'none'; frame-ancestors 'self'";
const GENERATOR_PATHS = Object.freeze([
  'tools/sandbox/workshop-contract-repair-sandbox-v1.js',
  'shared/code-capability-fabric/workshop-contract-repair-planner-v1.js',
  'shared/readiness/tool-readiness.js',
  'hub/module-contract-verifier.js',
  'tools/deterministic-json-core/index.js'
]);

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function canonical(value) { return Planner.canonical(value); }
function same(left, right) { return Planner.same(left, right); }
function hashBytes(bytes) { return 'sha256:' + crypto.createHash('sha256').update(bytes).digest('hex'); }
function hashValue(value) { return Planner.hashValue(value); }
function jsonBytes(value) { return Buffer.from(JSON.stringify(value, null, 2) + '\n', 'utf8'); }
function exact(value, keys, label) { if (!value || typeof value !== 'object' || Array.isArray(value) || !same(Object.keys(value).sort(), keys.slice().sort())) throw new Error(label + ' fields are not exact'); }
function safeId(value, label) { if (typeof value !== 'string' || !/^[a-z0-9][a-z0-9._-]{1,127}$/.test(value)) throw new Error(label + ' must be a portable id'); return value; }
function validateDigest(value, label) { if (typeof value !== 'string' || !/^sha256:[0-9a-f]{64}$/.test(value)) throw new Error(label + ' must be a SHA-256 digest'); return value; }
function assertAbsolute(value, label) { if (typeof value !== 'string' || !path.isAbsolute(value)) throw new Error(label + ' must be an absolute path'); return path.resolve(value); }
function contained(root, target) { const relative = path.relative(root, target); return !!relative && relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative); }
function assertContained(root, target, label) { if (!contained(root, target)) throw new Error(label + ' must be contained by its declared root'); }
function assertDisjoint(left, right, label) { if (left.toLowerCase() === right.toLowerCase() || contained(left, right) || contained(right, left)) throw new Error(label + ' roots must be disjoint'); }
function assertOrdinaryDirectory(target, label) {
  if (!fs.existsSync(target)) throw new Error(label + ' is missing');
  const info = fs.lstatSync(target);
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error(label + ' must be an ordinary directory');
  const real = fs.realpathSync.native(target);
  if (path.resolve(real).toLowerCase() !== path.resolve(target).toLowerCase()) throw new Error(label + ' must not be a path alias or junction');
}
function ensureStateParent(parentRoot) {
  const resolved = assertAbsolute(parentRoot, 'parentRoot');
  if (!fs.existsSync(CONTRACT_REPAIR_STATE_ROOT)) fs.mkdirSync(CONTRACT_REPAIR_STATE_ROOT, { recursive: true });
  assertOrdinaryDirectory(CONTRACT_REPAIR_STATE_ROOT, 'contract repair state root');
  if (resolved.toLowerCase() !== CONTRACT_REPAIR_STATE_ROOT.toLowerCase()) {
    assertContained(CONTRACT_REPAIR_STATE_ROOT, resolved, 'parentRoot');
    if (path.dirname(resolved).toLowerCase() !== CONTRACT_REPAIR_STATE_ROOT.toLowerCase()) throw new Error('parentRoot must be the state root or one direct child');
    if (!fs.existsSync(resolved)) fs.mkdirSync(resolved, { recursive: false });
    assertOrdinaryDirectory(resolved, 'parentRoot');
  }
  return resolved;
}
function assertSourceRoot(sourceRoot, stateRoot = CONTRACT_REPAIR_STATE_ROOT) {
  const resolved = assertAbsolute(sourceRoot, 'sourceRoot');
  assertOrdinaryDirectory(resolved, 'sourceRoot');
  assertDisjoint(resolved, path.resolve(stateRoot), 'source and state');
  const tools = path.join(resolved, 'tools');
  assertOrdinaryDirectory(tools, 'source tools root');
  return resolved;
}
function resolveOrdinaryFile(root, relative, label) {
  Planner.portablePath(relative, label + '.path');
  const target = path.resolve(root, ...relative.split('/'));
  assertContained(root, target, label);
  let cursor = root;
  for (const segment of relative.split('/')) {
    cursor = path.join(cursor, segment);
    if (!fs.existsSync(cursor)) throw new Error(label + ' is missing');
    const info = fs.lstatSync(cursor);
    if (info.isSymbolicLink()) throw new Error(label + ' cannot traverse a symlink or junction');
  }
  const info = fs.lstatSync(target);
  if (!info.isFile() || info.isSymbolicLink()) throw new Error(label + ' must be an ordinary file');
  return target;
}
function readFile(root, relative, label) {
  const target = resolveOrdinaryFile(root, relative, label), bytes = fs.readFileSync(target);
  return { path: relative, bytes, ref: { path: relative, sha256: hashBytes(bytes), byteLength: bytes.length } };
}
function publicRef(read) { return clone(read.ref); }
function generatorRefs() { return GENERATOR_PATHS.map((relative) => publicRef(readFile(HOST_ROOT, relative, 'trusted generator input'))); }
function topLevelKeys(text, label) {
  const stack = [], keys = new Set(); let inString = false, escaped = false, start = -1, expectingKey = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (inString) {
      if (escaped) { escaped = false; continue; }
      if (char === '\\') { escaped = true; continue; }
      if (char === '"') {
        inString = false;
        if (stack.length === 1 && stack[0] === '{' && expectingKey) {
          const key = JSON.parse(text.slice(start, index + 1));
          if (keys.has(key)) throw new Error(label + ' has a duplicate top-level field: ' + key);
          keys.add(key); expectingKey = false;
        }
      }
      continue;
    }
    if (char === '"') { inString = true; start = index; continue; }
    if (char === '{' || char === '[') { stack.push(char); if (stack.length === 1 && char === '{') expectingKey = true; continue; }
    if (char === '}' || char === ']') { stack.pop(); continue; }
    if (char === ',' && stack.length === 1 && stack[0] === '{') expectingKey = true;
  }
  return keys;
}
function parseObject(read, label) {
  let text;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(read.bytes); } catch (error) { throw new Error(label + ' must be valid UTF-8'); }
  if (text.charCodeAt(0) === 0xfeff) throw new Error(label + ' must not contain a byte-order mark');
  topLevelKeys(text, label);
  let value; try { value = JSON.parse(text); } catch (error) { throw new Error(label + ' must be valid JSON: ' + error.message); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(label + ' must be a JSON object');
  return { text, value };
}
function validation(errors) { const clean = Array.from(new Set(errors.map(String))); return { pass: clean.length === 0, errors: clean }; }
function permissionParity(manifest, contract) {
  const left = Array.isArray(manifest.permissions) ? Array.from(new Set(manifest.permissions)).sort() : [];
  const right = Array.isArray(contract.permissions) ? Array.from(new Set(contract.permissions)).sort() : [];
  return same(left, right);
}
function scanSource(sourceRoot, inputRequest) {
  const request = Planner.normalizeRequest(inputRequest), root = assertSourceRoot(sourceRoot);
  const manifestRead = readFile(root, request.target.manifestPath, 'target manifest');
  const contractRead = readFile(root, request.target.contractPath, 'target contract');
  const selftestRead = readFile(root, request.target.selftestPath, 'target selftest');
  const inputReads = [manifestRead, contractRead, selftestRead], inputBytes = inputReads.reduce((sum, read) => sum + read.bytes.length, 0);
  if (inputReads.length > request.resources.maxInputFiles || inputBytes > request.resources.maxInputBytes) throw new Error('contract repair input budget exceeded');
  const parsedManifest = parseObject(manifestRead, 'target manifest'), parsedContract = parseObject(contractRead, 'target contract');
  const manifest = parsedManifest.value, contract = parsedContract.value;
  if (manifest.id !== request.target.toolId) throw new Error('target manifest identity drifted');
  if (manifest.contract !== 'module.contract.json') throw new Error('target manifest contract path is not exact');
  if (contract.schema !== 'axm.module-contract/v1' || contract.id !== request.target.toolId) throw new Error('target contract identity drifted');
  const hasSchema = Object.prototype.hasOwnProperty.call(manifest, 'schema'), hasKind = Object.prototype.hasOwnProperty.call(manifest, 'kind');
  if (hasSchema && typeof manifest.schema !== 'string') throw new Error('present manifest schema must be a string');
  if (hasKind && typeof manifest.kind !== 'string') throw new Error('present manifest kind must be a string');
  const schemaState = !hasSchema ? 'MISSING' : manifest.schema === 'axm.tool-manifest/v1' ? 'PRESENT_VALID' : 'PRESENT_INVALID';
  const kindState = !hasKind ? 'MISSING' : Planner.ALLOWED_KINDS.includes(manifest.kind) ? 'PRESENT_VALID' : 'PRESENT_INVALID';
  const manifestErrors = Readiness.validateTargetManifest(manifest, request.target.toolId);
  const contractCheck = ContractVerifier.validateContract(contract, manifest);
  const inputRefs = inputReads.map(publicRef).sort((a, b) => Planner.compareText(a.path, b.path));
  const observation = Planner.sealObservation({
    schema: Planner.OBSERVATION_SCHEMA, version: Planner.VERSION, status: 'TEST', id: request.id + '-observation', sourceLabel: request.sourceLabel, evaluatedAt: request.evaluatedAt, scopeId: Planner.SCOPE_ID, target: clone(request.target), inputRefs,
    manifest: { ref: publicRef(manifestRead), declaredSchema: hasSchema ? manifest.schema : null, schemaState, id: manifest.id, kindState, declaredKind: hasKind ? manifest.kind : null, validation: validation(manifestErrors) },
    contract: { ref: publicRef(contractRead), schema: contract.schema, id: contract.id, permissionParity: permissionParity(manifest, contract), validation: validation(contractCheck.errors) },
    selftest: { ref: publicRef(selftestRead), state: 'PRESENT_NOT_RUN' }, allowedKinds: clone(Planner.ALLOWED_KINDS),
    resources: { inputFiles: inputReads.length, inputBytes, networkRequests: 0, childProcesses: 0, enforced: true }, privacy: clone(Planner.PRIVACY),
    truth: { sourceRead: true, sourceWritten: false, candidateBytesRetainedInOutput: true, candidateExecuted: false, testsExecuted: false, networkUsed: false, childProcessSpawned: false, installed: false, integrated: false, published: false, promoted: false, canonChanged: false }, authority: 'NONE'
  });
  return { root, request, observation, manifestRead, contractRead, selftestRead, manifest, contract, manifestText: parsedManifest.text };
}
function insertDeclarations(manifestRead, manifest, kind) {
  if (Object.prototype.hasOwnProperty.call(manifest, 'schema') || Object.prototype.hasOwnProperty.call(manifest, 'kind')) throw new Error('legacy declaration target already declares schema or kind');
  const text = new TextDecoder('utf-8', { fatal: true }).decode(manifestRead.bytes);
  const objectStart = text.search(/\S/);
  if (objectStart < 0 || text[objectStart] !== '{') throw new Error('kind insertion requires a JSON object');
  let cursor = objectStart + 1; while (/\s/.test(text[cursor] || '')) cursor += 1;
  const comma = text[cursor] === '}' ? '' : ',';
  const candidateText = text.slice(0, objectStart + 1) + JSON.stringify('schema') + ':' + JSON.stringify('axm.tool-manifest/v1') + ',' + JSON.stringify('kind') + ':' + JSON.stringify(kind) + comma + text.slice(objectStart + 1);
  const candidateRead = { bytes: Buffer.from(candidateText, 'utf8') }, parsed = parseObject(candidateRead, 'candidate manifest');
  if (parsed.value.schema !== 'axm.tool-manifest/v1' || parsed.value.kind !== kind) throw new Error('candidate manifest declaration insertion failed');
  const withoutDeclarations = clone(parsed.value); delete withoutDeclarations.schema; delete withoutDeclarations.kind;
  if (!same(withoutDeclarations, manifest)) throw new Error('candidate manifest changed fields outside schema and kind');
  return { bytes: candidateRead.bytes, manifest: parsed.value };
}
function buildCandidate(scan, plan) {
  if (plan.status !== 'DRAFT_ALTERNATIVES_PLANNED') return { packet: null, packetBytes: null, outputs: [] };
  const outputs = [], alternatives = plan.alternatives.map((entry) => {
    const generated = insertDeclarations(scan.manifestRead, scan.manifest, entry.kind);
    const manifestCheck = validation(Readiness.validateTargetManifest(generated.manifest, scan.request.target.toolId));
    const contractCheck = validation(ContractVerifier.validateContract(scan.contract, generated.manifest).errors);
    if (!manifestCheck.pass || !contractCheck.pass || !permissionParity(generated.manifest, scan.contract)) throw new Error('generated kind alternative failed structural validation: ' + entry.id);
    const relative = 'alternatives/' + entry.id + '/manifest.json';
    outputs.push({ path: relative, bytes: generated.bytes });
    return { ...entry, candidateRef: { path: relative, sha256: hashBytes(generated.bytes), byteLength: generated.bytes.length }, manifestValidation: manifestCheck, contractValidation: contractCheck };
  });
  const packet = Planner.sealCandidate({
    schema: Planner.CANDIDATE_SCHEMA, version: Planner.VERSION, status: 'EXPERIMENTAL', id: scan.request.id + '-candidate', requestRef: plan.requestRef, observationRef: plan.observationRef, planRef: { id: plan.id, schema: plan.schema, sha256: plan.planDigest }, target: clone(plan.target), repairClass: Planner.REPAIR_CLASS, alternatives,
    comparison: { ranking: 'NONE', selectedAlternative: null, equalAuthority: true, permissionDelta: { added: [], removed: [] }, contractBytesChanged: false }, requiredTests: clone(plan.requiredTests), limitations: clone(plan.limitations),
    truth: { draftDetached: true, alternativesUnranked: true, humanSelectionRequired: true, candidateExecuted: false, testsExecuted: false, sourceWritten: false, permissionsChanged: false, contractBytesChanged: false, installed: false, integrated: false, published: false, promoted: false, canonChanged: false }, authority: 'NONE'
  });
  const packetBytes = jsonBytes(packet); outputs.push({ path: 'candidate-packet.json', bytes: packetBytes }); outputs.sort((a, b) => Planner.compareText(a.path, b.path));
  return { packet, packetBytes, outputs };
}
function prepare(options) {
  exact(options, ['sourceRoot', 'request'], 'prepare options');
  const scan = scanSource(options.sourceRoot, options.request), plan = Planner.plan(scan.request, scan.observation), built = buildCandidate(scan, plan), refs = generatorRefs();
  const outputBytes = built.outputs.reduce((sum, output) => sum + output.bytes.length, 0);
  if (built.outputs.length > scan.request.resources.maxOutputFiles || outputBytes > scan.request.resources.maxOutputBytes) throw new Error('contract repair output budget exceeded');
  const core = { sourceRoot: scan.root, request: scan.request, observation: scan.observation, plan, candidate: built.packet, generatorRefs: refs, outputRefs: built.outputs.map((output) => ({ path: output.path, sha256: hashBytes(output.bytes), byteLength: output.bytes.length })) };
  return { ...core, outputs: built.outputs, preparedDigest: hashValue(core) };
}
function verifyPrepared(prepared) {
  exact(prepared, ['sourceRoot', 'request', 'observation', 'plan', 'candidate', 'generatorRefs', 'outputRefs', 'outputs', 'preparedDigest'], 'prepared contract repair');
  const rebuilt = prepare({ sourceRoot: prepared.sourceRoot, request: prepared.request });
  const core = { sourceRoot: prepared.sourceRoot, request: prepared.request, observation: prepared.observation, plan: prepared.plan, candidate: prepared.candidate, generatorRefs: prepared.generatorRefs, outputRefs: prepared.outputRefs };
  if (!same(core, { sourceRoot: rebuilt.sourceRoot, request: rebuilt.request, observation: rebuilt.observation, plan: rebuilt.plan, candidate: rebuilt.candidate, generatorRefs: rebuilt.generatorRefs, outputRefs: rebuilt.outputRefs }) || prepared.preparedDigest !== hashValue(core)) throw new Error('prepared contract repair lineage drifted');
  if (prepared.outputs.length !== rebuilt.outputs.length || prepared.outputs.some((output, index) => output.path !== rebuilt.outputs[index].path || Buffer.compare(output.bytes, rebuilt.outputs[index].bytes) !== 0)) throw new Error('prepared contract repair output bytes drifted');
  return true;
}
function writeExclusive(target, bytes) { fs.writeFileSync(target, bytes, { flag: 'wx' }); }
function makeReadonly(target) { fs.chmodSync(target, 0o444); }
function makeWritableTree(root) { if (!fs.existsSync(root)) return; for (const entry of fs.readdirSync(root, { withFileTypes: true })) { const target = path.join(root, entry.name); if (entry.isDirectory()) makeWritableTree(target); else if (entry.isFile()) fs.chmodSync(target, 0o644); } }
function iterationId(number) { return 'iteration-' + String(number).padStart(3, '0'); }
function outputRefsWithPacket(prepared) { return prepared.outputRefs.map(clone); }
function receiptCore(sessionId, number, prepared, observationBytes, planBytes, outputBytes) {
  const id = iterationId(number);
  return {
    schema: RECEIPT_SCHEMA, version: VERSION, status: 'TEST', sessionId, iteration: { id, number }, sourceLabel: prepared.request.sourceLabel,
    requestRef: { id: prepared.request.id, schema: prepared.request.schema, sha256: prepared.request.requestDigest }, observationRef: { id: prepared.observation.id, schema: prepared.observation.schema, sha256: prepared.observation.observationDigest }, sourceStateDigest: prepared.observation.sourceStateDigest,
    planRef: { id: prepared.plan.id, schema: prepared.plan.schema, sha256: prepared.plan.planDigest }, candidateRef: { id: prepared.candidate.id, schema: prepared.candidate.schema, sha256: prepared.candidate.candidateDigest }, generatorRefs: clone(prepared.generatorRefs), outputRefs: outputRefsWithPacket(prepared), roots: clone(ROOT_NAMES),
    resources: { inputFiles: prepared.observation.resources.inputFiles, inputBytes: prepared.observation.resources.inputBytes, sourceRecordFiles: 1, sourceRecordBytes: observationBytes.length, outputFiles: prepared.outputs.length, outputBytes, evidenceFiles: 2, evidenceBytesExcludingReceipt: planBytes.length, networkRequests: 0, childProcesses: 0, enforced: true },
    privacy: { sourceBytesInEvidence: false, candidateBytesInOutput: true, stdoutRetained: false, stderrRetained: false, machinePathsRetained: false, secretsRead: false },
    truth: { sourceSnapshotReverifiedBeforeWrite: true, sourceWritten: false, draftDetached: true, alternativesUnranked: true, humanSelectionRequired: true, machineSelected: false, candidateExecuted: false, testsExecuted: false, installed: false, integrated: false, published: false, promoted: false, canonChanged: false }, authority: 'NONE'
  };
}
function reobserveMatches(prepared) {
  const fresh = prepare({ sourceRoot: prepared.sourceRoot, request: prepared.request });
  return fresh.observation.sourceStateDigest === prepared.observation.sourceStateDigest && fresh.plan.planDigest === prepared.plan.planDigest && same(fresh.generatorRefs, prepared.generatorRefs) && same(fresh.outputRefs, prepared.outputRefs);
}
function materializeIteration(sessionRoot, sessionId, number, prepared) {
  verifyPrepared(prepared);
  if (prepared.plan.status !== 'DRAFT_ALTERNATIVES_PLANNED' || !prepared.candidate) throw new Error('only planned contract repair alternatives can be materialized');
  if (!reobserveMatches(prepared)) throw new Error('contract repair source changed before write');
  const id = iterationId(number), sourceRoot = path.join(sessionRoot, ROOT_NAMES.source), outputRoot = path.join(sessionRoot, ROOT_NAMES.output), evidenceRoot = path.join(sessionRoot, ROOT_NAMES.evidence);
  const observationPath = path.join(sourceRoot, id + '.observation.json'), iterationRoot = path.join(outputRoot, id), planPath = path.join(evidenceRoot, id + '.plan.json'), receiptPath = path.join(evidenceRoot, id + '.receipt.json');
  if ([observationPath, iterationRoot, planPath, receiptPath].some(fs.existsSync)) throw new Error('contract repair iteration destination already exists');
  const observationBytes = jsonBytes(prepared.observation), planBytes = jsonBytes(prepared.plan), outputBytes = prepared.outputs.reduce((sum, output) => sum + output.bytes.length, 0);
  const core = receiptCore(sessionId, number, prepared, observationBytes, planBytes, outputBytes), receipt = { ...core, receiptDigest: hashValue(core) }, receiptBytes = jsonBytes(receipt);
  if (observationBytes.length + planBytes.length + receiptBytes.length > prepared.request.resources.maxEvidenceBytes || 3 > prepared.request.resources.maxEvidenceFiles) throw new Error('contract repair evidence budget exceeded');
  fs.mkdirSync(iterationRoot, { recursive: false });
  try {
    writeExclusive(observationPath, observationBytes); writeExclusive(planPath, planBytes);
    for (const output of prepared.outputs) { const target = path.join(iterationRoot, ...output.path.split('/')); fs.mkdirSync(path.dirname(target), { recursive: true }); writeExclusive(target, output.bytes); }
    writeExclusive(receiptPath, receiptBytes);
    const written = [observationPath, planPath, receiptPath, ...prepared.outputs.map((output) => path.join(iterationRoot, ...output.path.split('/')))]; written.forEach(makeReadonly);
    if (!reobserveMatches(prepared)) throw new Error('contract repair source changed during write');
    return { id, number, receipt, observation: prepared.observation, plan: prepared.plan, candidate: prepared.candidate, outputRoot: iterationRoot };
  } catch (error) {
    makeWritableTree(sessionRoot);
    for (const target of [observationPath, iterationRoot, planPath, receiptPath]) { try { if (fs.existsSync(target)) { const info = fs.lstatSync(target); if (info.isDirectory()) fs.rmSync(target, { recursive: true }); else fs.unlinkSync(target); } } catch (_) {} }
    throw error;
  }
}
function createSession(options) {
  exact(options, ['parentRoot', 'sessionId', 'prepared'], 'create session options');
  const parentRoot = ensureStateParent(options.parentRoot), sessionId = safeId(options.sessionId, 'sessionId'), sessionRoot = path.join(parentRoot, sessionId);
  if (fs.existsSync(sessionRoot)) throw new Error('contract repair session already exists');
  assertDisjoint(options.prepared.sourceRoot, sessionRoot, 'source and session');
  fs.mkdirSync(sessionRoot, { recursive: false });
  for (const name of Object.values(ROOT_NAMES)) fs.mkdirSync(path.join(sessionRoot, name), { recursive: false });
  try { const latest = materializeIteration(sessionRoot, sessionId, 0, options.prepared); return { sessionId, sessionRoot, parentRoot, sourceRoot: options.prepared.sourceRoot, request: clone(options.prepared.request), latest }; }
  catch (error) { makeWritableTree(sessionRoot); try { fs.rmSync(sessionRoot, { recursive: true }); } catch (_) {} throw error; }
}
function listIterations(sessionRoot) {
  return fs.readdirSync(path.join(sessionRoot, ROOT_NAMES.evidence)).filter((name) => name.endsWith('.receipt.json')).map((name) => name.slice(0, -'.receipt.json'.length)).map((id) => ({ id, number: ITERATION.test(id) ? Number(id.match(ITERATION)[1]) : -1 })).sort((a, b) => a.number - b.number);
}
function validateFileRef(value, label) { return Planner.fileRef(value, label); }
function readReceipt(sessionRoot, id) {
  const target = path.join(sessionRoot, ROOT_NAMES.evidence, id + '.receipt.json'), value = JSON.parse(fs.readFileSync(target, 'utf8'));
  exact(value, ['schema', 'version', 'status', 'sessionId', 'iteration', 'sourceLabel', 'requestRef', 'observationRef', 'sourceStateDigest', 'planRef', 'candidateRef', 'generatorRefs', 'outputRefs', 'roots', 'resources', 'privacy', 'truth', 'authority', 'receiptDigest'], 'contract repair receipt');
  if (value.schema !== RECEIPT_SCHEMA || value.version !== VERSION || value.status !== 'TEST' || value.authority !== 'NONE') throw new Error('contract repair receipt identity drifted');
  safeId(value.sessionId, 'receipt.sessionId'); exact(value.iteration, ['id', 'number'], 'receipt.iteration');
  if (typeof value.sourceLabel !== 'string' || !value.sourceLabel.length || value.sourceLabel.length > 160 || /[\u0000-\u001f]/.test(value.sourceLabel)) throw new Error('contract repair receipt source label is invalid');
  if (value.iteration.id !== id || !ITERATION.test(id) || value.iteration.number !== Number(id.match(ITERATION)[1])) throw new Error('contract repair receipt iteration drifted');
  for (const refName of ['requestRef', 'observationRef', 'planRef', 'candidateRef']) { exact(value[refName], ['id', 'schema', 'sha256'], 'receipt.' + refName); safeId(value[refName].id, 'receipt.' + refName + '.id'); validateDigest(value[refName].sha256, 'receipt.' + refName + '.sha256'); }
  validateDigest(value.sourceStateDigest, 'receipt.sourceStateDigest'); validateDigest(value.receiptDigest, 'receipt.receiptDigest');
  if (!Array.isArray(value.generatorRefs) || value.generatorRefs.length !== GENERATOR_PATHS.length || !Array.isArray(value.outputRefs) || value.outputRefs.length !== 6) throw new Error('contract repair receipt refs are incomplete');
  value.generatorRefs.forEach((ref, index) => { validateFileRef(ref, 'receipt.generatorRefs[' + index + ']'); if (ref.path !== GENERATOR_PATHS[index]) throw new Error('contract repair generator path drifted'); });
  value.outputRefs.forEach((ref, index) => validateFileRef(ref, 'receipt.outputRefs[' + index + ']'));
  const outputPaths = value.outputRefs.map((ref) => ref.path);
  if (new Set(outputPaths).size !== outputPaths.length || !same(outputPaths, outputPaths.slice().sort())) throw new Error('contract repair output refs must be unique and sorted');
  if (!same(value.roots, ROOT_NAMES)) throw new Error('contract repair receipt roots drifted');
  const expectedPrivacy = { sourceBytesInEvidence: false, candidateBytesInOutput: true, stdoutRetained: false, stderrRetained: false, machinePathsRetained: false, secretsRead: false };
  if (!same(value.privacy, expectedPrivacy)) throw new Error('contract repair receipt privacy drifted');
  const expectedTruth = { sourceSnapshotReverifiedBeforeWrite: true, sourceWritten: false, draftDetached: true, alternativesUnranked: true, humanSelectionRequired: true, machineSelected: false, candidateExecuted: false, testsExecuted: false, installed: false, integrated: false, published: false, promoted: false, canonChanged: false };
  if (!same(value.truth, expectedTruth)) throw new Error('contract repair receipt truth drifted');
  exact(value.resources, ['inputFiles', 'inputBytes', 'sourceRecordFiles', 'sourceRecordBytes', 'outputFiles', 'outputBytes', 'evidenceFiles', 'evidenceBytesExcludingReceipt', 'networkRequests', 'childProcesses', 'enforced'], 'receipt.resources');
  if (value.resources.inputFiles !== 3 || value.resources.sourceRecordFiles !== 1 || value.resources.outputFiles !== 6 || value.resources.evidenceFiles !== 2 || value.resources.networkRequests !== 0 || value.resources.childProcesses !== 0 || value.resources.enforced !== true) throw new Error('contract repair receipt resource policy drifted');
  for (const key of ['inputBytes', 'sourceRecordBytes', 'outputBytes', 'evidenceBytesExcludingReceipt']) if (!Number.isSafeInteger(value.resources[key]) || value.resources[key] < 1) throw new Error('contract repair receipt resource measurement is invalid: ' + key);
  if (value.resources.inputBytes > Planner.RESOURCES.maxInputBytes || value.resources.outputBytes > Planner.RESOURCES.maxOutputBytes || value.resources.sourceRecordBytes + value.resources.evidenceBytesExcludingReceipt > Planner.RESOURCES.maxEvidenceBytes) throw new Error('contract repair receipt resource budget drifted');
  const { receiptDigest, ...core } = value; if (receiptDigest !== hashValue(core)) throw new Error('contract repair receipt integrity drifted');
  return value;
}
function resumeSession(options) {
  exact(options, ['sourceRoot', 'parentRoot', 'sessionId', 'request'], 'resume session options');
  const parentRoot = ensureStateParent(options.parentRoot), sessionId = safeId(options.sessionId, 'sessionId'), sessionRoot = path.join(parentRoot, sessionId), sourceRoot = assertSourceRoot(options.sourceRoot, parentRoot), request = Planner.normalizeRequest(options.request);
  assertOrdinaryDirectory(sessionRoot, 'contract repair session root'); assertDisjoint(sourceRoot, sessionRoot, 'source and session');
  const iterations = listIterations(sessionRoot); if (!iterations.length) throw new Error('contract repair session has no iterations');
  let previous = -1, latest = null; const currentGenerators = generatorRefs();
  for (const iteration of iterations) {
    if (iteration.number !== previous + 1) throw new Error('contract repair iteration sequence is not contiguous'); previous = iteration.number;
    const receipt = readReceipt(sessionRoot, iteration.id);
    if (receipt.sessionId !== sessionId || receipt.sourceLabel !== request.sourceLabel || receipt.requestRef.sha256 !== request.requestDigest || !same(receipt.generatorRefs, currentGenerators)) throw new Error('contract repair receipt request or generator lineage drifted');
    const observationPath = path.join(sessionRoot, ROOT_NAMES.source, iteration.id + '.observation.json'), planPath = path.join(sessionRoot, ROOT_NAMES.evidence, iteration.id + '.plan.json'), iterationRoot = path.join(sessionRoot, ROOT_NAMES.output, iteration.id);
    const observationBytes = fs.readFileSync(observationPath), planBytes = fs.readFileSync(planPath), observation = Planner.normalizeObservation(JSON.parse(observationBytes)), storedPlan = Planner.normalizePlan(JSON.parse(planBytes)), rebuiltPlan = Planner.plan(request, observation);
    if (!same(storedPlan, rebuiltPlan) || observation.observationDigest !== receipt.observationRef.sha256 || observation.sourceStateDigest !== receipt.sourceStateDigest || storedPlan.planDigest !== receipt.planRef.sha256 || observationBytes.length !== receipt.resources.sourceRecordBytes || planBytes.length !== receipt.resources.evidenceBytesExcludingReceipt) throw new Error('contract repair observation or plan lineage drifted');
    const packetPath = path.join(iterationRoot, 'candidate-packet.json'), packetBytes = fs.readFileSync(packetPath), packet = Planner.normalizeCandidate(JSON.parse(packetBytes));
    const expectedPlanRef = { id: storedPlan.id, schema: storedPlan.schema, sha256: storedPlan.planDigest };
    if (packet.candidateDigest !== receipt.candidateRef.sha256 || receipt.candidateRef.id !== packet.id || receipt.candidateRef.schema !== packet.schema || !same(packet.requestRef, storedPlan.requestRef) || !same(packet.observationRef, storedPlan.observationRef) || !same(packet.planRef, expectedPlanRef) || !same(packet.target, storedPlan.target) || !same(packet.requiredTests, storedPlan.requiredTests) || !same(packet.limitations, storedPlan.limitations)) throw new Error('contract repair candidate packet lineage drifted');
    if (packet.alternatives.some((entry, index) => !same({ id: entry.id, kind: entry.kind, patch: entry.patch, ranking: entry.ranking, semanticFitness: entry.semanticFitness, requiresHumanSelection: entry.requiresHumanSelection }, storedPlan.alternatives[index]))) throw new Error('contract repair candidate alternatives drifted from plan');
    const expectedOutputRefs = [...packet.alternatives.map((entry) => entry.candidateRef), { path: 'candidate-packet.json', sha256: hashBytes(packetBytes), byteLength: packetBytes.length }].sort((a, b) => Planner.compareText(a.path, b.path));
    if (!same(expectedOutputRefs, receipt.outputRefs)) throw new Error('contract repair receipt output refs drifted from candidate packet');
    let measuredOutputBytes = 0;
    for (const ref of receipt.outputRefs) { const bytes = fs.readFileSync(path.join(iterationRoot, ...ref.path.split('/'))); if (hashBytes(bytes) !== ref.sha256 || bytes.length !== ref.byteLength) throw new Error('contract repair output bytes drifted: ' + ref.path); measuredOutputBytes += bytes.length; }
    if (measuredOutputBytes !== receipt.resources.outputBytes || hashBytes(packetBytes) !== receipt.outputRefs.find((ref) => ref.path === 'candidate-packet.json').sha256) throw new Error('contract repair output measurement drifted');
    for (const alternative of packet.alternatives) { const receiptRef = receipt.outputRefs.find((ref) => ref.path === alternative.candidateRef.path); if (!receiptRef || !same(receiptRef, alternative.candidateRef)) throw new Error('contract repair alternative ref drifted'); }
    latest = { ...iteration, receipt, observation, plan: storedPlan, candidate: packet, outputRoot: iterationRoot };
  }
  return { sessionId, sessionRoot, parentRoot, sourceRoot, request, latest };
}
function refreshSession(session) {
  const prepared = prepare({ sourceRoot: session.sourceRoot, request: session.request });
  if (prepared.observation.sourceStateDigest === session.latest.receipt.sourceStateDigest) return { status: 'CURRENT_NO_NEW_ITERATION', session, prepared };
  if (prepared.plan.status !== 'DRAFT_ALTERNATIVES_PLANNED') return { status: prepared.plan.status, session, prepared };
  const next = session.latest.number + 1; if (next >= session.request.resources.maxIterations) throw new Error('contract repair iteration ceiling reached');
  const latest = materializeIteration(session.sessionRoot, session.sessionId, next, prepared);
  return { status: 'NEW_ITERATION_DRAFTED', session: { ...session, latest }, prepared };
}
function html(value) { return String(value == null ? '' : value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]); }
function reviewShell(session) {
  const packet = session.latest.candidate, alternatives = packet.alternatives.map((entry) => '<li><a href="/candidate/' + html(entry.candidateRef.path) + '"><code>' + html(entry.kind) + '</code></a> · structural PASS · semantic fitness UNKNOWN</li>').join('');
  const tests = packet.requiredTests.map((entry) => '<li><code>' + html(entry.command.join(' ')) + '</code> · NOT RUN</li>').join('');
  return Buffer.from('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AXM Contract Repair Draft · TEST</title><style>body{margin:0;background:#071018;color:#eef8ff;font:16px system-ui;line-height:1.55}main{max-width:980px;margin:auto;padding:32px}header,section{border:1px solid #31526a;border-radius:16px;padding:22px;margin:0 0 18px;background:#0b1923}b,a,summary{color:#67e6ff}.hold{color:#ffd470}h1{font-size:clamp(32px,6vw,62px);line-height:1.05}code{overflow-wrap:anywhere;color:#a7efff}li{margin:.55em 0}summary{cursor:pointer;font-weight:700}</style></head><body><main><header><b>AXM WORKSHOP SHADOW · CONTRACT REPAIR · TEST</b><h1>One legacy defect.<br>Five honest alternatives.</h1><p class="hold">Nothing selected · tests not run · not installed</p><p>The target <code>' + html(packet.target.toolId) + '</code> is missing both <code>/schema</code> and <code>/kind</code>. The schema upgrade is fixed; allowed kind values are shown without ranking because current bytes do not prove semantic intent.</p></header><section><h2>Detached alternatives</h2><ul>' + alternatives + '</ul><p><a href="/candidate/candidate-packet.json">Inspect the exact candidate packet</a></p></section><section><h2>Required before acceptance</h2><ul>' + tests + '</ul></section><section><h2>Boundary</h2><details><summary>Show exact authority controls</summary><ul><li>Machine selection: denied</li><li>Candidate and test execution: denied</li><li>Source write-back: denied</li><li>Install, integrate, publish, promote, CANON: denied</li><li>Authority: NONE</li></ul></details></section></main></body></html>\n', 'utf8');
}
function send(response, status, headers, body, headOnly) { response.writeHead(status, headers); response.end(headOnly ? undefined : body); }
async function startPreview(session) {
  const fresh = prepare({ sourceRoot: session.sourceRoot, request: session.request });
  if (fresh.observation.sourceStateDigest !== session.latest.receipt.sourceStateDigest || fresh.plan.planDigest !== session.latest.receipt.planRef.sha256 || !same(fresh.generatorRefs, session.latest.receipt.generatorRefs) || !same(fresh.outputRefs, session.latest.receipt.outputRefs)) throw new Error('CONTRACT_REPAIR_DRAFT_STALE_REFRESH_REQUIRED');
  const resumed = resumeSession({ sourceRoot: session.sourceRoot, parentRoot: session.parentRoot, sessionId: session.sessionId, request: session.request });
  const shell = reviewShell(resumed), server = http.createServer((request, response) => {
    if (!['GET', 'HEAD'].includes(request.method)) return send(response, 405, { Allow: 'GET, HEAD', 'Content-Type': 'text/plain; charset=utf-8' }, Buffer.from('method not allowed\n'), request.method === 'HEAD');
    try {
      const current = prepare({ sourceRoot: resumed.sourceRoot, request: resumed.request });
      if (current.observation.sourceStateDigest !== resumed.latest.receipt.sourceStateDigest || current.plan.planDigest !== resumed.latest.receipt.planRef.sha256 || !same(current.generatorRefs, resumed.latest.receipt.generatorRefs) || !same(current.outputRefs, resumed.latest.receipt.outputRefs)) return send(response, 409, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }, Buffer.from('stale contract repair draft; refresh required\n'), request.method === 'HEAD');
    } catch (_) { return send(response, 409, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }, Buffer.from('contract repair source cannot be reverified\n'), request.method === 'HEAD'); }
    const pathname = new URL(request.url, 'http://127.0.0.1').pathname, headOnly = request.method === 'HEAD';
    if (pathname === '/') return send(response, 200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': REVIEW_CSP, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }, shell, headOnly);
    if (pathname === '/meta') return send(response, 200, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Security-Policy': "default-src 'none'", 'Cache-Control': 'no-store' }, jsonBytes({ schema: 'axm.workshop-contract-repair-preview-meta/v1', status: 'TEST', sessionId: resumed.sessionId, iteration: resumed.latest.id, sourceStateDigest: resumed.latest.receipt.sourceStateDigest, selectedAlternative: null, candidateExecuted: false, testsExecuted: false, installed: false, authority: 'NONE' }), headOnly);
    const prefix = '/candidate/';
    if (pathname.startsWith(prefix)) {
      const relative = pathname.slice(prefix.length);
      const ref = resumed.latest.receipt.outputRefs.find((entry) => entry.path === relative);
      if (!ref) return send(response, 404, { 'Content-Type': 'text/plain; charset=utf-8' }, Buffer.from('not found\n'), headOnly);
      const bytes = fs.readFileSync(path.join(resumed.latest.outputRoot, ...relative.split('/')));
      return send(response, 200, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Security-Policy': "default-src 'none'", 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }, bytes, headOnly);
    }
    return send(response, 404, { 'Content-Type': 'text/plain; charset=utf-8' }, Buffer.from('not found\n'), headOnly);
  });
  server.on('request', (request, response) => { response.on('finish', () => {}); });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const address = server.address();
  return { url: 'http://127.0.0.1:' + address.port + '/', sourceStateDigest: fresh.observation.sourceStateDigest, candidateProcesses: 0, candidateExecuted: false, testsExecuted: false, installed: false, selectedAlternative: null, close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())) };
}

module.exports = { VERSION, RECEIPT_SCHEMA, ROOT_NAMES, CONTRACT_REPAIR_STATE_ROOT, REVIEW_CSP, GENERATOR_PATHS, clone, canonical, same, hashBytes, hashValue, jsonBytes, topLevelKeys, parseObject, insertDeclarations, scanSource, buildCandidate, prepare, verifyPrepared, createSession, resumeSession, refreshSession, startPreview, reviewShell };
