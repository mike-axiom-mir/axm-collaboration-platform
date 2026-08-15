'use strict';

const fs = require('fs');
const path = require('path');
const ImmutableBatchStore = require('../kernel/immutable-batch-store');
const Cell = require('../kernel/pattern-command-center-cell');
const WorkshopRoot = require('../config/workshop-root');

const ORGAN_ID = 'axm.mirror.organ/pattern-command-center-v1';
const DEFAULT_STATE_ROOT = path.resolve(__dirname, '..', 'state', 'pattern-command-center');
const MAX_REQUESTS = 64;
const MAX_RETURNS = 128;

function json(value) { return JSON.stringify(Cell.stable(value), null, 2) + '\n'; }
function inside(root, target) {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  return !!relative && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}
function directory(root, name) {
  const result = path.join(root, name);
  if (!inside(root, result)) throw new Error('pattern command center state path escaped');
  fs.mkdirSync(result, { recursive: true });
  const stat = fs.lstatSync(result);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('pattern command center state directory is unsafe');
  return result;
}
function visibleDirectories(root) {
  return fs.readdirSync(root, { withFileTypes: true }).filter(entry => entry.isDirectory() && !entry.isSymbolicLink() && !entry.name.startsWith('.')).sort((a, b) => a.name.localeCompare(b.name));
}
function stages(root) {
  return fs.readdirSync(root, { withFileTypes: true }).filter(entry => entry.name.startsWith('.stage-')).map(entry => entry.name).sort();
}

function verifyRequestDirectory(runDir) {
  const requestFile = path.join(runDir, 'request.json');
  if (!fs.existsSync(requestFile)) throw new Error('pattern command center request record is missing');
  const request = JSON.parse(fs.readFileSync(requestFile, 'utf8'));
  Cell.verifyRequest(request);
  const directoryName = path.basename(runDir);
  const isStage = directoryName.startsWith(`.stage-${request.requestId}-`);
  if (directoryName !== request.requestId && !isStage) throw new Error('pattern command center request directory identity changed');
  const expected = ['request.json', request.source.storedName].sort();
  const actual = fs.readdirSync(runDir).sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error('pattern command center request inventory changed');
  const sourceFile = path.join(runDir, request.source.storedName);
  const sourceStat = fs.lstatSync(sourceFile);
  if (!sourceStat.isFile() || sourceStat.isSymbolicLink()) throw new Error('pattern command center source is unsafe');
  const sourceBytes = fs.readFileSync(sourceFile);
  if (sourceBytes.length !== request.source.bytes || Cell.digest(sourceBytes) !== request.source.sha256) throw new Error('pattern command center source bytes changed');
  return { request, sourceBytes, runDir };
}

function createRequest(input = {}, options = {}) {
  const root = path.resolve(options.stateRoot || DEFAULT_STATE_ROOT);
  const requestsRoot = directory(root, 'requests');
  const built = Cell.createRequest(input);
  const runDir = path.join(requestsRoot, built.request.requestId);
  if (visibleDirectories(requestsRoot).length >= MAX_REQUESTS && !fs.existsSync(runDir)) throw new Error(`pattern command center already contains the maximum ${MAX_REQUESTS} lesson requests`);
  if (fs.existsSync(runDir)) {
    const verified = verifyRequestDirectory(runDir);
    if (verified.request.requestDigest !== built.request.requestDigest || !verified.sourceBytes.equals(built.sourceBytes)) throw new Error('pattern command center request identity collision');
    return { request: verified.request, prompt: Cell.buildPlatformPrompt(verified.request, verified.sourceBytes), runDir, reused: true };
  }
  const stageDir = path.join(requestsRoot, `.stage-${built.request.requestId}-${process.pid}`);
  fs.mkdirSync(stageDir, { recursive: false });
  fs.writeFileSync(path.join(stageDir, 'request.json'), json(built.request), { flag: 'wx' });
  fs.writeFileSync(path.join(stageDir, built.request.source.storedName), built.sourceBytes, { flag: 'wx' });
  verifyRequestDirectory(stageDir);
  const committed = ImmutableBatchStore.commitDirectory(stageDir, runDir);
  const verified = verifyRequestDirectory(runDir);
  return { request: verified.request, prompt: Cell.buildPlatformPrompt(verified.request, verified.sourceBytes), runDir, reused: committed.reused };
}

function loadRequest(requestId, options = {}) {
  if (!/^shared-coding-lesson-[a-f0-9]{24}$/.test(String(requestId || ''))) throw new Error('pattern command center request ID is invalid');
  const root = path.resolve(options.stateRoot || DEFAULT_STATE_ROOT);
  const requestsRoot = directory(root, 'requests');
  const runDir = path.join(requestsRoot, requestId);
  if (!inside(requestsRoot, runDir) || !fs.existsSync(runDir)) throw new Error('pattern command center request is unknown');
  return verifyRequestDirectory(runDir);
}

function returnRequestId(bytes) {
  if (!Buffer.isBuffer(bytes) || !bytes.length || bytes.length > Cell.MAX_RETURN_BYTES) throw new Error('pattern command center return bytes are empty or too large');
  let value;
  try { value = JSON.parse(bytes.toString('utf8')); } catch (error) { throw new Error(`pattern command center return JSON is invalid: ${error.message}`); }
  return value && value.request && value.request.requestId;
}

function verifyReturnDirectory(runDir, options = {}) {
  const actual = fs.readdirSync(runDir).sort();
  if (JSON.stringify(actual) !== JSON.stringify(['assessment.json', 'returned.json'])) throw new Error('pattern command center return inventory changed');
  const assessment = JSON.parse(fs.readFileSync(path.join(runDir, 'assessment.json'), 'utf8'));
  Cell.verifyAssessment(assessment);
  const directoryName = path.basename(runDir);
  const isStage = directoryName.startsWith(`.stage-${assessment.assessmentId}-`);
  if (directoryName !== assessment.assessmentId && !isStage) throw new Error('pattern command center assessment directory identity changed');
  const returnedBytes = fs.readFileSync(path.join(runDir, 'returned.json'));
  if (returnedBytes.length !== assessment.source.bytes || Cell.digest(returnedBytes) !== assessment.source.sha256) throw new Error('pattern command center returned bytes changed');
  const loaded = loadRequest(assessment.request.requestId, options);
  const rebuilt = Cell.parseReturn(returnedBytes, loaded.request, assessment.source.name);
  if (rebuilt.assessment.assessmentDigest !== assessment.assessmentDigest) throw new Error('pattern command center assessment reconstruction changed');
  return { assessment, returnedBytes, runDir };
}

function intakeReturn(rawBytes, options = {}) {
  const bytes = Buffer.isBuffer(rawBytes) ? rawBytes : Buffer.from(rawBytes || '');
  const requestId = returnRequestId(bytes);
  const loaded = loadRequest(requestId, options);
  const sourceName = `platform-lesson-return-${Cell.digest(bytes).slice(0, 24)}.json`;
  const parsed = Cell.parseReturn(bytes, loaded.request, sourceName);
  const root = path.resolve(options.stateRoot || DEFAULT_STATE_ROOT);
  const returnsRoot = directory(root, 'returns');
  const runDir = path.join(returnsRoot, parsed.assessment.assessmentId);
  if (visibleDirectories(returnsRoot).length >= MAX_RETURNS && !fs.existsSync(runDir)) throw new Error(`pattern command center already contains the maximum ${MAX_RETURNS} lesson returns`);
  if (fs.existsSync(runDir)) {
    const verified = verifyReturnDirectory(runDir, options);
    if (!verified.returnedBytes.equals(bytes)) throw new Error('pattern command center return identity collision');
    return { assessment: verified.assessment, runDir, reused: true };
  }
  const stageDir = path.join(returnsRoot, `.stage-${parsed.assessment.assessmentId}-${process.pid}`);
  fs.mkdirSync(stageDir, { recursive: false });
  fs.writeFileSync(path.join(stageDir, 'assessment.json'), json(parsed.assessment), { flag: 'wx' });
  fs.writeFileSync(path.join(stageDir, 'returned.json'), bytes, { flag: 'wx' });
  const assessment = JSON.parse(fs.readFileSync(path.join(stageDir, 'assessment.json'), 'utf8'));
  Cell.verifyAssessment(assessment);
  const committed = ImmutableBatchStore.commitDirectory(stageDir, runDir);
  const verified = verifyReturnDirectory(runDir, options);
  return { assessment: verified.assessment, runDir, reused: committed.reused };
}

function repairBuddyDeclaration(options = {}) {
  let workshopRoot;
  try { workshopRoot = WorkshopRoot.resolve({ workshopRoot: options.workshopRoot }); } catch (error) {
    return { state: 'WORKSHOP_ABSENT', status: 'UNKNOWN', detail: error.message, automaticPatternInstall: false };
  }
  const directoryPath = path.join(workshopRoot, 'tools', 'repairbuddy');
  const manifestFile = path.join(directoryPath, 'manifest.json');
  const contractFile = path.join(directoryPath, 'module.contract.json');
  try {
    for (const file of [manifestFile, contractFile]) {
      if (!inside(workshopRoot, file) || !fs.existsSync(file)) throw new Error(`missing ${path.basename(file)}`);
      const stat = fs.lstatSync(file);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 65536) throw new Error(`unsafe ${path.basename(file)}`);
    }
    const manifestBytes = fs.readFileSync(manifestFile);
    const contractBytes = fs.readFileSync(contractFile);
    const manifest = JSON.parse(manifestBytes.toString('utf8'));
    const contract = JSON.parse(contractBytes.toString('utf8'));
    if (manifest.id !== 'repairbuddy' || contract.schema !== 'axm.module-contract/v1' || contract.id !== 'repairbuddy') throw new Error('RepairBuddy declaration identity mismatch');
    return {
      state: 'DECLARED_READ_ONLY',
      status: String(contract.status || manifest.status || 'UNKNOWN'),
      version: String(contract.version || manifest.version || 'UNKNOWN'),
      manifestSha256: Cell.digest(manifestBytes),
      contractSha256: Cell.digest(contractBytes),
      automaticPatternInstall: false,
      workshopWrite: false
    };
  } catch (error) {
    return { state: 'DECLARATION_HOLD', status: 'UNKNOWN', detail: error.message, automaticPatternInstall: false, workshopWrite: false };
  }
}

function latestVerified(root, verifier) {
  const entries = visibleDirectories(root).map(entry => {
    const runDir = path.join(root, entry.name);
    const stat = fs.statSync(runDir);
    return { runDir, mtimeMs: stat.mtimeMs, name: entry.name };
  }).sort((a, b) => b.mtimeMs - a.mtimeMs || a.name.localeCompare(b.name));
  return entries.length ? verifier(entries[0].runDir) : null;
}

function status(options = {}) {
  const root = path.resolve(options.stateRoot || DEFAULT_STATE_ROOT);
  const requestsRoot = directory(root, 'requests');
  const returnsRoot = directory(root, 'returns');
  const requestEntries = visibleDirectories(requestsRoot);
  const returnEntries = visibleDirectories(returnsRoot);
  if (requestEntries.length > MAX_REQUESTS || returnEntries.length > MAX_RETURNS) throw new Error('pattern command center state exceeds its bounded inventory');
  for (const entry of requestEntries) verifyRequestDirectory(path.join(requestsRoot, entry.name));
  for (const entry of returnEntries) verifyReturnDirectory(path.join(returnsRoot, entry.name), options);
  const latestRequest = latestVerified(requestsRoot, verifyRequestDirectory);
  const latestReturn = latestVerified(returnsRoot, runDir => verifyReturnDirectory(runDir, options));
  const assessments = returnEntries.map(entry => JSON.parse(fs.readFileSync(path.join(returnsRoot, entry.name, 'assessment.json'), 'utf8')));
  return {
    organ: { id: ORGAN_ID, status: 'TEST_PRIVATE_SHARED_PATTERN_LESSON_STUDIO', learnedWeights: false },
    mirror: { state: 'SHADOW_LESSON_INTAKE_ONLY', lessonsAdmitted: 0, trainingAdmissions: 0 },
    repairBuddy: repairBuddyDeclaration(options),
    inventory: {
      lessonRequests: requestEntries.length,
      lessonReturns: returnEntries.length,
      readyForHumanReview: assessments.filter(item => item.state !== 'HOLD_SHARED_CODING_LESSON_RETURN').length,
      held: assessments.filter(item => item.state === 'HOLD_SHARED_CODING_LESSON_RETURN').length,
      stagingEntries: stages(requestsRoot).length + stages(returnsRoot).length
    },
    latest: {
      request: latestRequest ? latestRequest.request : null,
      prompt: latestRequest ? Cell.buildPlatformPrompt(latestRequest.request, latestRequest.sourceBytes) : null,
      assessment: latestReturn ? latestReturn.assessment : null
    },
    authority: {
      privateLessonCandidateWrite: true,
      sourceExecution: false,
      lessonAdmission: false,
      patternInstall: false,
      publicSourceWrite: false,
      workshopWrite: false,
      trainingAdmission: false,
      permissionGrant: false,
      runtimePromotion: false,
      canonChange: false,
      worldAction: false
    },
    boundary: 'The Pattern Command Center stores source and return candidates privately, renders prompts and plain-language views, and keeps Mirror and RepairBuddy projections separate. It does not execute, install, admit, train, write Workshop or public Mirror, promote, or change CANON.'
  };
}

module.exports = {
  ORGAN_ID, DEFAULT_STATE_ROOT, MAX_REQUESTS, MAX_RETURNS, inside, verifyRequestDirectory,
  createRequest, loadRequest, returnRequestId, verifyReturnDirectory, intakeReturn,
  repairBuddyDeclaration, status
};
