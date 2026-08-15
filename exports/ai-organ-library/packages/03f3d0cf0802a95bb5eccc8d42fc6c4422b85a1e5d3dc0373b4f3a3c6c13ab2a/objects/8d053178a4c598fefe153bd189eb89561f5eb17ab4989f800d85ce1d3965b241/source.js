'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ORGAN_ID = 'axm.mirror.organ/code-clone-curiosity-organ-forge-v1';
const REQUEST_SCHEMA = 'axm.mirror.code-clone-curiosity-organ-forge-request/v1';
const RECEIPT_SCHEMA = 'axm.mirror.code-clone-curiosity-organ-forge-receipt/v1';

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
}
function canonical(value) { return JSON.stringify(stable(value)); }
function sha256(value) { return crypto.createHash('sha256').update(Buffer.isBuffer(value) ? value : typeof value === 'string' ? value : canonical(value)).digest('hex'); }
function exact(value, keys, label) { if (!value || Array.isArray(value) || canonical(Object.keys(value).sort()) !== canonical(keys.slice().sort())) throw new Error(`${label} shape is closed`); }
function safeId(value, label, maximum = 240) { const text = String(value || ''); if (!text || text.length > maximum || !/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/.test(text)) throw new Error(`${label} is invalid`); return text; }
function inside(root, target) { const a = path.resolve(root); const b = path.resolve(target); const left = process.platform === 'win32' ? b.toLowerCase() : b; const right = process.platform === 'win32' ? a.toLowerCase() : a; return left !== right && left.startsWith(right + path.sep); }
function realDirectory(value, label, create = false) { const result = path.resolve(String(value || '')); if (create) fs.mkdirSync(result, { recursive: true, mode: 0o700 }); const stat = fs.lstatSync(result); if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`${label} must be a real directory`); return result; }

function normalizeRequest(input) {
  exact(input, ['schema', 'sessionId', 'cloneId', 'createdAt', 'roots', 'candidate', 'observation', 'authority'], 'forge request');
  if (input.schema !== REQUEST_SCHEMA || !Number.isFinite(Date.parse(String(input.createdAt)))) throw new Error('forge request identity is invalid');
  exact(input.roots, ['mirror', 'workshop', 'state'], 'forge roots');
  const roots = { mirror: realDirectory(input.roots.mirror, 'mirror root'), workshop: realDirectory(input.roots.workshop, 'Workshop root'), state: realDirectory(input.roots.state, 'state root', true) };
  if (roots.mirror === roots.workshop || roots.mirror === roots.state || roots.workshop === roots.state) throw new Error('forge roots must remain distinct');
  exact(input.authority, ['proposalWrite', 'testExecute', 'activeSourceWrite', 'runtimeActivation', 'parentWrite', 'canonChange'], 'forge authority');
  const expectedAuthority = { proposalWrite: true, testExecute: true, activeSourceWrite: false, runtimeActivation: false, parentWrite: false, canonChange: false };
  if (canonical(input.authority) !== canonical(expectedAuthority)) throw new Error('forge authority changed');
  const candidate = stable(input.candidate);
  if (!/^[a-f0-9]{16}$/.test(String(candidate.candidateId || '')) || !['MIRROR', 'WORKSHOP'].includes(candidate.rootKind)) throw new Error('forge candidate identity is invalid');
  const sourceRoot = candidate.rootKind === 'MIRROR' ? roots.mirror : roots.workshop;
  const sourceFile = path.resolve(sourceRoot, ...String(candidate.relativePath || '').split('/'));
  if (!inside(sourceRoot, sourceFile)) throw new Error('forge candidate escaped its observed root');
  const stat = fs.lstatSync(sourceFile);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 2 * 1024 * 1024) throw new Error('forge candidate source is not a bounded real file');
  const currentDigest = sha256(fs.readFileSync(sourceFile, 'utf8').slice(0, 32768));
  if (currentDigest !== candidate.sourceDigest) throw new Error('forge candidate source changed after observation');
  const observation = stable(input.observation);
  if (!observation || !/^https?:\/\//i.test(String(observation.url || '')) || !/^[a-f0-9]{64}$/.test(String(observation.textSha256 || ''))) throw new Error('forge requires an attributed web source observation');
  return stable({ ...input, sessionId: safeId(input.sessionId, 'sessionId'), cloneId: safeId(input.cloneId, 'cloneId'), roots, candidate, observation, authority: expectedAuthority });
}

function choosePattern(request) {
  const source = `${request.candidate.concepts.join(' ')} ${request.observation.title} ${request.observation.text.slice(0, 12000)}`.toLowerCase();
  if (/\b(?:url|uri|http|fetch|network|browser|link)\b/.test(source)) return 'URL_EVIDENCE_INSPECTOR';
  if (/\b(?:json|schema|object|property|key)\b/.test(source)) return 'JSON_SHAPE_INSPECTOR';
  if (/\b(?:test|assert|verify|receipt|evidence)\b/.test(source)) return 'VERIFICATION_STATE_INSPECTOR';
  return 'STRUCTURAL_NOVELTY_INSPECTOR';
}

function organSource(request, pattern, candidateOrganId) {
  const sourceRef = stable({ url: request.observation.url, title: request.observation.title, visibleTextSha256: request.observation.textSha256, localRoot: request.candidate.rootKind, localPath: request.candidate.relativePath, localSourceDigest: request.candidate.sourceDigest });
  return `'use strict';\n\n// EXPERIMENTAL clone-local candidate. Web text was evidence for pattern selection, not copied as authority.\nconst crypto = require('node:crypto');\nconst ORGAN_ID = ${JSON.stringify(candidateOrganId)};\nconst PATTERN = ${JSON.stringify(pattern)};\nconst SOURCE_REF = Object.freeze(${JSON.stringify(sourceRef, null, 2)});\nfunction stable(value) { if (Array.isArray(value)) return value.map(stable); if (!value || typeof value !== 'object') return value; return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])); }\nfunction sha256(value) { return crypto.createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(stable(value))).digest('hex'); }\nfunction inspect(input) {\n  const value = input == null ? null : input;\n  const text = typeof value === 'string' ? value : JSON.stringify(stable(value));\n  const urls = Array.from(new Set((text.match(/https?:\\/\\/[^\\s\\\"'<>]+/g) || []).map(item => item.slice(0, 2048)))).sort().slice(0, 32);\n  const keys = value && typeof value === 'object' && !Array.isArray(value) ? Object.keys(value).sort().slice(0, 256) : [];\n  const states = Array.from(new Set((text.match(/\\b(?:PASS|FAIL|FAILED|HELD|HOLD|UNKNOWN|NEEDS_REVIEW|EXPERIMENTAL|WORKING)\\b/g) || []))).sort();\n  const observations = PATTERN === 'URL_EVIDENCE_INSPECTOR' ? { urls, count: urls.length } : PATTERN === 'JSON_SHAPE_INSPECTOR' ? { keys, count: keys.length } : PATTERN === 'VERIFICATION_STATE_INSPECTOR' ? { states, count: states.length } : { valueType: Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value, textCharacters: text.length };\n  const basis = stable({ organId: ORGAN_ID, pattern: PATTERN, sourceRef: SOURCE_REF, inputDigest: sha256(text), observations });\n  return stable({ schema: 'axm.mirror.experimental-curiosity-organ-observation/v1', status: 'EXPERIMENTAL', ...basis, observationDigest: sha256(basis), authority: { evidenceAdmission: false, permissionGrant: false, runtimeActivation: false, canonChange: false } });\n}\nmodule.exports = { ORGAN_ID, PATTERN, SOURCE_REF, inspect };\n`;
}

function testSource(organPath, pattern) {
  return `'use strict';\nconst assert = require('node:assert/strict');\nconst organ = require(${JSON.stringify(organPath)});\nconst first = organ.inspect({ status: 'UNKNOWN', url: 'https://example.invalid/path', nested: { value: 1 } });\nconst second = organ.inspect({ nested: { value: 1 }, url: 'https://example.invalid/path', status: 'UNKNOWN' });\nassert.deepEqual(first, second);\nassert.equal(first.status, 'EXPERIMENTAL');\nassert.equal(first.authority.runtimeActivation, false);\nassert.equal(first.authority.canonChange, false);\nassert.equal(organ.PATTERN, ${JSON.stringify(pattern)});\nprocess.stdout.write(JSON.stringify({ state: 'PASS', organId: organ.ORGAN_ID, pattern: organ.PATTERN, observationDigest: first.observationDigest }));\n`;
}

function run(input) {
  const request = normalizeRequest(input);
  const pattern = choosePattern(request);
  const candidateDigest = sha256({ candidate: request.candidate, observation: { url: request.observation.url, title: request.observation.title, textSha256: request.observation.textSha256 }, pattern });
  const candidateOrganId = `axm.mirror.organ/experimental-curiosity-${candidateDigest.slice(0, 24)}`;
  const sessionRoot = path.join(request.roots.state, 'experimental-curiosity-forge', request.sessionId);
  fs.mkdirSync(sessionRoot, { recursive: true, mode: 0o700 });
  const runRoot = path.join(sessionRoot, candidateDigest.slice(0, 24));
  if (!inside(request.roots.state, runRoot)) throw new Error('forge run escaped state root');
  fs.mkdirSync(runRoot, { recursive: true, mode: 0o700 });
  const sourcePath = path.join(runRoot, 'candidate.js');
  const testPath = path.join(runRoot, 'candidate.test.js');
  const source = organSource(request, pattern, candidateOrganId);
  const test = testSource(sourcePath, pattern);
  if (!fs.existsSync(sourcePath)) fs.writeFileSync(sourcePath, source, { flag: 'wx', mode: 0o600 });
  if (fs.readFileSync(sourcePath, 'utf8') !== source) throw new Error('preserved candidate source conflicts with this request');
  if (!fs.existsSync(testPath)) fs.writeFileSync(testPath, test, { flag: 'wx', mode: 0o600 });
  if (fs.readFileSync(testPath, 'utf8') !== test) throw new Error('preserved candidate test conflicts with this request');
  const checked = spawnSync(process.execPath, [testPath], { cwd: runRoot, encoding: 'utf8', timeout: 30000, windowsHide: true, env: { PATH: process.env.PATH || '' } });
  const testState = checked.status === 0 ? 'PASS' : checked.error && checked.error.code === 'ETIMEDOUT' ? 'TIMEOUT' : 'FAIL';
  let installed = null;
  if (testState === 'PASS') {
    const shelf = path.join(request.roots.mirror, 'organs', 'experimental-curiosity');
    fs.mkdirSync(shelf, { recursive: true });
    const destination = path.join(shelf, `${candidateDigest.slice(0, 24)}.js`);
    if (!inside(request.roots.mirror, destination)) throw new Error('experimental organ escaped clone Mirror root');
    if (!fs.existsSync(destination)) fs.writeFileSync(destination, source, { flag: 'wx', mode: 0o600 });
    if (fs.readFileSync(destination, 'utf8') !== source) throw new Error('experimental organ shelf contains a conflicting candidate');
    installed = { relativePath: path.relative(request.roots.mirror, destination).split(path.sep).join('/'), sha256: sha256(source), activeRuntime: false };
  }
  const receiptBase = stable({
    schema: RECEIPT_SCHEMA,
    receiptId: null,
    receiptDigest: null,
    status: 'EXPERIMENTAL',
    organId: ORGAN_ID,
    sessionId: request.sessionId,
    cloneId: request.cloneId,
    candidateOrganId,
    pattern,
    source: { local: { rootKind: request.candidate.rootKind, relativePath: request.candidate.relativePath, sha256: request.candidate.sourceDigest }, web: { url: request.observation.url, title: request.observation.title, visibleTextSha256: request.observation.textSha256 } },
    proposal: { relativePath: path.relative(request.roots.state, sourcePath).split(path.sep).join('/'), sourceSha256: sha256(source), testSha256: sha256(test) },
    verification: { state: testState, separateProcess: true, authoredIndependently: false, exitCode: checked.status, signal: checked.signal || null, stdoutSha256: sha256(checked.stdout || ''), stderrSha256: sha256(checked.stderr || '') },
    installation: installed,
    authority: request.authority,
    boundary: 'A deterministic Seed-0 forge selected one template from observed structural and web evidence. A fresh process verified the candidate, but the verifier was generated by the same forge and is not independent authorship. Passing candidates enter only the clone-local experimental organ shelf and are not active runtime, admitted evidence, promotion, or CANON.'
  });
  const receiptDigest = sha256({ ...receiptBase, receiptId: null, receiptDigest: null });
  const receipt = stable({ ...receiptBase, receiptId: `curiosity-forge-receipt-${receiptDigest.slice(0, 24)}`, receiptDigest });
  const receiptPath = path.join(runRoot, 'receipt.json');
  const serialized = JSON.stringify(receipt, null, 2) + '\n';
  if (!fs.existsSync(receiptPath)) fs.writeFileSync(receiptPath, serialized, { flag: 'wx', mode: 0o600 });
  if (fs.readFileSync(receiptPath, 'utf8') !== serialized) throw new Error('preserved forge receipt conflicts with this request');
  return stable({ state: testState === 'PASS' ? 'PASS_EXPERIMENTAL_ORGAN_SHELVED_INACTIVE' : 'FAILED_ORGAN_PRESERVED_NOT_INSTALLED', receipt, receiptPath });
}

module.exports = { ORGAN_ID, REQUEST_SCHEMA, RECEIPT_SCHEMA, stable, sha256, normalizeRequest, choosePattern, organSource, testSource, run };
