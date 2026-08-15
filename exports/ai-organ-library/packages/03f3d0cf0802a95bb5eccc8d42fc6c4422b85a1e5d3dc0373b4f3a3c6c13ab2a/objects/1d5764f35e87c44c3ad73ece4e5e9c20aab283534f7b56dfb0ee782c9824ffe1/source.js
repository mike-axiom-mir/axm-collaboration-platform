'use strict';

const fs = require('fs');
const path = require('path');
const CodeReturn = require('../kernel/human-guided-code-return-cell');
const Steward = require('./human-guided-steward-organ');
const ImmutableBatchStore = require('../kernel/immutable-batch-store');

const ORGAN_ID = 'axm.mirror.organ/human-guided-code-return-intake-v1';
const ROOT = path.resolve(__dirname, '..');
const DEFAULT_INBOX_DIR = path.join(ROOT, 'state', 'human-guided-steward-code-inbox');
const DEFAULT_CANDIDATE_DIR = path.join(ROOT, 'state', 'human-guided-steward-code-candidates');
const MAX_INBOX_FILES = 32;

function stable(value) { return CodeReturn.stable(value); }
function same(left, right) { return JSON.stringify(stable(left)) === JSON.stringify(stable(right)); }
function json(value) { return JSON.stringify(stable(value), null, 2) + '\n'; }

function realDirectory(directory, label, create) {
  const resolved = path.resolve(directory);
  if (create) fs.mkdirSync(resolved, { recursive: true });
  const stat = fs.lstatSync(resolved);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`${label} must be a real directory`);
  return resolved;
}

function boundedChild(parent, child) {
  const root = path.resolve(parent);
  const resolved = path.resolve(root, child);
  if (path.dirname(resolved) !== root) throw new Error(`external code intake path escapes state root: ${child}`);
  return resolved;
}

function atomicReadInboxFile(filePath, expectedEntry) {
  const before = fs.lstatSync(filePath);
  if (!before.isFile() || before.isSymbolicLink() || !expectedEntry.isFile() || expectedEntry.isSymbolicLink()) throw new Error('inbox entry must be a real file');
  if (before.size > CodeReturn.MAX_RETURN_BYTES) {
    return { bytes: Buffer.alloc(CodeReturn.MAX_RETURN_BYTES + 1), sourceStat: { size: before.size, mtimeMs: before.mtimeMs } };
  }
  const bytes = fs.readFileSync(filePath);
  const after = fs.lstatSync(filePath);
  if (!after.isFile() || after.isSymbolicLink() || before.dev !== after.dev || before.ino !== after.ino || before.size !== after.size || before.mtimeMs !== after.mtimeMs) {
    throw new Error('inbox file changed while it was being inspected');
  }
  return { bytes, sourceStat: { size: after.size, mtimeMs: after.mtimeMs } };
}

function verifyStoredCandidate(runDir, expectedAssessment) {
  const root = path.resolve(runDir);
  const rootStat = fs.lstatSync(root);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new Error('external code candidate must be a real directory');
  const assessmentPath = path.join(root, 'assessment.json');
  const assessmentStat = fs.lstatSync(assessmentPath);
  if (!assessmentStat.isFile() || assessmentStat.isSymbolicLink()) throw new Error('external code assessment must be a real file');
  const assessment = JSON.parse(fs.readFileSync(assessmentPath, 'utf8'));
  CodeReturn.verifyAssessment(assessment);
  if (!same(assessment, expectedAssessment)) throw new Error('external code candidate assessment changed');
  const names = fs.readdirSync(root).sort();
  if (assessment.state !== 'ISOLATED_CANDIDATE_READY_FOR_INDEPENDENT_REVIEW') {
    if (!same(names, ['assessment.json'])) throw new Error('held external code return gained candidate files');
    return assessment;
  }
  if (!same(names, ['assessment.json', 'files', 'install-manifest.json'])) throw new Error('external code candidate fields changed');
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'install-manifest.json'), 'utf8'));
  if (manifest.schema !== 'axm.mirror.external-code-candidate-install-manifest/v1' || manifest.assessmentId !== assessment.assessmentId || manifest.assessmentDigest !== assessment.assessmentDigest || manifest.state !== 'REVIEW_REQUIRED_NOT_INSTALLED') throw new Error('external code candidate manifest changed');
  if (!same(manifest.files, assessment.files)) throw new Error('external code candidate manifest inventory changed');
  for (const file of assessment.files) {
    const candidatePath = path.join(root, 'files', ...file.path.split('/'));
    const stat = fs.lstatSync(candidatePath);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`external code candidate file changed: ${file.path}`);
    if (CodeReturn.digest(fs.readFileSync(candidatePath)) !== file.sha256) throw new Error(`external code candidate bytes changed: ${file.path}`);
  }
  return assessment;
}

function storeAssessment(parsed, candidateDir = DEFAULT_CANDIDATE_DIR) {
  CodeReturn.verifyAssessment(parsed.assessment);
  const root = realDirectory(candidateDir, 'external code candidate root', true);
  const runDir = boundedChild(root, parsed.assessment.assessmentId);
  if (fs.existsSync(runDir)) {
    verifyStoredCandidate(runDir, parsed.assessment);
    return { runDir, reused: true };
  }
  const stageDir = boundedChild(root, `.stage-${parsed.assessment.assessmentId}-${process.pid}`);
  if (fs.existsSync(stageDir)) throw new Error(`external code candidate stage already exists: ${stageDir}`);
  fs.mkdirSync(stageDir, { recursive: false });
  fs.writeFileSync(path.join(stageDir, 'assessment.json'), json(parsed.assessment), { flag: 'wx' });
  if (parsed.allowed) {
    const manifest = {
      schema: 'axm.mirror.external-code-candidate-install-manifest/v1',
      assessmentId: parsed.assessment.assessmentId,
      assessmentDigest: parsed.assessment.assessmentDigest,
      request: stable(parsed.assessment.request),
      files: stable(parsed.assessment.files),
      state: 'REVIEW_REQUIRED_NOT_INSTALLED',
      authority: { publicSourceWrite: false, sourceExecution: false, candidateInstall: false, permissionGrant: false, runtimePromotion: false, canonChange: false },
      boundary: 'This inventory binds isolated candidate bytes to intended paths. A separate independent review and explicit human installation act are required.'
    };
    fs.writeFileSync(path.join(stageDir, 'install-manifest.json'), json(manifest), { flag: 'wx' });
    const filesRoot = path.join(stageDir, 'files');
    fs.mkdirSync(filesRoot, { recursive: false });
    for (const file of parsed.files.sort((a, b) => a.path.localeCompare(b.path))) {
      const destination = path.join(filesRoot, ...file.path.split('/'));
      const relative = path.relative(filesRoot, destination);
      if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error(`external code candidate path escaped: ${file.path}`);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, file.content, { encoding: 'utf8', flag: 'wx' });
    }
  }
  verifyStoredCandidate(stageDir, parsed.assessment);
  const committed = ImmutableBatchStore.commitDirectory(stageDir, runDir);
  verifyStoredCandidate(runDir, parsed.assessment);
  return { runDir, reused: committed.reused };
}

function intakeFile(filePath, packet, options = {}) {
  const absolute = path.resolve(filePath);
  const inbox = realDirectory(options.inboxDir || path.dirname(absolute), 'external code inbox', false);
  if (path.dirname(absolute) !== inbox) throw new Error('external code return must be a direct inbox child');
  const name = path.basename(absolute);
  if (!/^[A-Za-z0-9._-]{1,180}\.json$/.test(name)) throw new Error('external code return inbox name is invalid');
  const entry = fs.readdirSync(inbox, { withFileTypes: true }).find(item => item.name === name);
  if (!entry) throw new Error('external code return disappeared before inspection');
  const read = atomicReadInboxFile(absolute, entry);
  const parsed = CodeReturn.parseReturn(read.bytes, packet, name);
  const stored = storeAssessment(parsed, options.candidateDir || DEFAULT_CANDIDATE_DIR);
  return {
    source: { path: absolute, retainedInInbox: true, size: read.sourceStat.size, mtimeMs: read.sourceStat.mtimeMs },
    assessment: parsed.assessment,
    storage: { runDir: stored.runDir, reused: stored.reused, copiedCandidateFiles: parsed.allowed ? parsed.files.length : 0 },
    state: parsed.assessment.state,
    authority: parsed.assessment.authority
  };
}

function storeUploadedReturn(bytes, packet, options = {}) {
  const body = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes || '');
  if (!body.length) throw new Error('uploaded external code return is empty');
  if (body.length > CodeReturn.MAX_RETURN_BYTES) throw new Error(`uploaded external code return exceeds ${CodeReturn.MAX_RETURN_BYTES} bytes`);
  const inbox = realDirectory(options.inboxDir || DEFAULT_INBOX_DIR, 'external code inbox', true);
  const name = `platform-return-${CodeReturn.digest(body).slice(0, 32)}.json`;
  const destination = boundedChild(inbox, name);
  if (fs.existsSync(destination)) {
    const stat = fs.lstatSync(destination);
    if (!stat.isFile() || stat.isSymbolicLink() || !fs.readFileSync(destination).equals(body)) throw new Error('uploaded external code return identity collision');
  } else {
    const count = fs.readdirSync(inbox, { withFileTypes: true }).length;
    if (count >= MAX_INBOX_FILES) throw new Error(`external code inbox already contains the maximum ${MAX_INBOX_FILES} entries`);
    fs.writeFileSync(destination, body, { flag: 'wx' });
  }
  return Object.assign({ upload: { name, path: destination, sha256: CodeReturn.digest(body), bytes: body.length, sourceFilenameTrusted: false } }, intakeFile(destination, packet, Object.assign({}, options, { inboxDir: inbox })));
}

function scan(options = {}) {
  const steward = options.stewardResult || Steward.run(options.stewardOptions || {});
  const packet = steward.packet;
  const inbox = realDirectory(options.inboxDir || DEFAULT_INBOX_DIR, 'external code inbox', true);
  const entries = fs.readdirSync(inbox, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
  if (entries.length > MAX_INBOX_FILES) throw new Error(`external code inbox exceeds ${MAX_INBOX_FILES} direct entries`);
  const results = [];
  const refusedEntries = [];
  for (const entry of entries) {
    if (!entry.isFile() || entry.isSymbolicLink() || !/^[A-Za-z0-9._-]{1,180}\.json$/.test(entry.name)) {
      refusedEntries.push({ name: entry.name, reason: 'UNEXPECTED_OR_NON_FILE_INBOX_ENTRY' });
      continue;
    }
    try {
      results.push(intakeFile(path.join(inbox, entry.name), packet, Object.assign({}, options, { inboxDir: inbox })));
    } catch (error) {
      refusedEntries.push({ name: entry.name, reason: 'INTAKE_REFUSED', detail: error.message });
    }
  }
  const ready = results.filter(item => item.state === 'ISOLATED_CANDIDATE_READY_FOR_INDEPENDENT_REVIEW').length;
  const held = results.length - ready;
  return {
    organ: { id: ORGAN_ID, status: 'TEST_PROPOSAL_ONLY_EXTERNAL_CODE_INTAKE', learnedWeights: false, returnedSourceExecution: false },
    packet: { packetId: packet.packetId, packetDigest: packet.packetDigest },
    inbox: { path: inbox, retainedSourceFiles: true },
    results,
    refusedEntries,
    summary: { inspectedFiles: results.length, readyForIndependentReview: ready, heldReturns: held, refusedEntries: refusedEntries.length, executedFiles: 0, publicFilesWritten: 0, candidatesInstalled: 0, permissionsGranted: 0, runtimePromotions: 0, canonChanges: 0 },
    state: ready ? 'ISOLATED_CANDIDATE_AWAITS_INDEPENDENT_REVIEW' : entries.length ? 'NO_INSTALLABLE_CANDIDATE_INBOX_RESULTS_HELD_OR_REFUSED' : 'INBOX_EMPTY',
    boundary: 'The inbox scanner preserves the outside response and may copy statically accepted bytes only into ignored isolated candidate state. It never executes source, writes a public Mirror path, installs a candidate, grants permission, promotes runtime, or changes CANON.'
  };
}

module.exports = { ORGAN_ID, DEFAULT_INBOX_DIR, DEFAULT_CANDIDATE_DIR, MAX_INBOX_FILES, realDirectory, boundedChild, atomicReadInboxFile, verifyStoredCandidate, storeAssessment, intakeFile, storeUploadedReturn, scan };
