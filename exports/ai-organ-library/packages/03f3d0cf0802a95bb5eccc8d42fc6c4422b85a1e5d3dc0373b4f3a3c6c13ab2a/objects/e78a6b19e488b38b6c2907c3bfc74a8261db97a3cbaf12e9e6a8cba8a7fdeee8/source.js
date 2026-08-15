'use strict';

const fs = require('fs');
const path = require('path');
const Cell = require('../kernel/creative-circle-cell');
const ImmutableBatchStore = require('../kernel/immutable-batch-store');

const ORGAN_ID = 'axm.mirror.organ/creative-circle-v1';
const ROOT = path.resolve(__dirname, '..');
const DEFAULT_STATE_ROOT = path.join(ROOT, 'state', 'creative-circle');
const SESSION_ID = 'creative-circle-local-v1';
const INTERVAL_MINUTES = 15;
const INTERVAL_MS = INTERVAL_MINUTES * 60 * 1000;
const MIN_AUTOMATIC_INTERVAL_MS = 10 * 60 * 1000;
const MAX_MESSAGES = 4096;
const MAX_PRACTICES = 256;

function inside(parent, child) {
  const root = path.resolve(parent); const target = path.resolve(child);
  return target === root || target.startsWith(root + path.sep);
}
function json(value) { return JSON.stringify(Cell.stable(value), null, 2) + '\n'; }
function atomicDirectory(root, id, filename, value, verify) {
  fs.mkdirSync(root, { recursive: true });
  const target = path.join(root, id);
  if (!inside(root, target)) throw new Error('Creative Circle immutable target escaped state');
  if (fs.existsSync(target)) return verify(target);
  const stage = path.join(root, `.stage-${id}-${process.pid}`);
  if (!inside(root, stage) || fs.existsSync(stage)) throw new Error('Creative Circle staging boundary refused');
  fs.mkdirSync(stage, { recursive: false });
  fs.writeFileSync(path.join(stage, filename), json(value), { flag: 'wx' });
  verify(stage);
  ImmutableBatchStore.commitDirectory(stage, target);
  return verify(target);
}
function messageRoot(stateRoot, namespace) {
  if (!Cell.PARTICIPANTS.some(item => item.stateNamespace === namespace)) throw new Error('Creative Circle branch log namespace is undeclared');
  return path.join(path.resolve(stateRoot), 'branch-logs', namespace, 'messages');
}
function readMessageDirectory(dir) {
  const message = JSON.parse(fs.readFileSync(path.join(dir, 'message.json'), 'utf8'));
  Cell.verifyMessage(message);
  if (path.basename(dir) !== message.messageId && !path.basename(dir).startsWith(`.stage-${message.messageId}-`)) throw new Error('Creative Circle message directory identity changed');
  return message;
}
function storeMessage(message, stateRoot = DEFAULT_STATE_ROOT) {
  Cell.verifyMessage(message);
  return atomicDirectory(messageRoot(stateRoot, message.from.stateNamespace), message.messageId, 'message.json', message, readMessageDirectory);
}
function listMessages(stateRoot = DEFAULT_STATE_ROOT) {
  const dirs = Cell.PARTICIPANTS.flatMap(participant => {
    const root = messageRoot(stateRoot, participant.stateNamespace);
    if (!fs.existsSync(root)) return [];
    return fs.readdirSync(root, { withFileTypes: true }).filter(entry => entry.isDirectory() && !entry.name.startsWith('.stage-')).map(entry => path.join(root, entry.name));
  });
  if (dirs.length > MAX_MESSAGES) throw new Error(`Creative Circle has more than ${MAX_MESSAGES} durable messages; seal a session segment before continuing`);
  return dirs.map(readMessageDirectory).sort((a, b) => a.sequence - b.sequence || a.messageId.localeCompare(b.messageId));
}
function ensureBranchStarts(stateRoot) {
  const branchDir = path.join(ROOT, 'lineage', 'identity-branches');
  for (const name of ['repairbuddy.branch.json', 'creative-mirror.branch.json']) {
    const branch = JSON.parse(fs.readFileSync(path.join(branchDir, name), 'utf8'));
    const namespace = path.basename(branch.privateLogNamespace);
    const id = `branch-start-${Cell.digest(branch).slice(0, 24)}`;
    const root = path.join(path.resolve(stateRoot), 'branch-logs', namespace, 'starts');
    const read = dir => {
      const stored = JSON.parse(fs.readFileSync(path.join(dir, 'branch.json'), 'utf8'));
      if (Cell.digest(stored) !== Cell.digest(branch)) throw new Error('Creative Circle branch start changed');
      return stored;
    };
    atomicDirectory(root, id, 'branch.json', branch, read);
  }
}
function exactCandidate(value) {
  const keys = value && typeof value === 'object' && !Array.isArray(value) ? Object.keys(value).sort() : [];
  const expected = ['schema', 'candidateId', 'proposedBy', 'target', 'name', 'recipe', 'practiceCases', 'rollbackPlan', 'authority'].sort();
  if (JSON.stringify(keys) !== JSON.stringify(expected)) throw new Error('Creative organ candidate shape is closed');
  if (value.schema !== 'axm.mirror.creative-organ-candidate/v1' || !/^creative-organ-[a-z0-9-]{3,80}$/.test(value.candidateId || '')) throw new Error('Creative organ candidate identity is invalid');
  if (!['MIRROR', 'REPAIRBUDDY'].includes(value.proposedBy) || value.target !== 'CREATIVE_MIRROR') throw new Error('Only Mirror or RepairBuddy may propose an organ for Creative Mirror');
  if (!Array.isArray(value.recipe) || value.recipe.length < 2 || value.recipe.length > 6 || value.recipe.some(item => !Cell.OPERATORS.includes(item)) || new Set(value.recipe).size !== value.recipe.length) throw new Error('Creative organ recipe must combine 2 through 6 declared exploration operators');
  if (!Array.isArray(value.practiceCases) || value.practiceCases.length < 3 || value.practiceCases.length > 20 || value.practiceCases.some(item => typeof item !== 'string' || item.length < 3 || item.length > 120)) throw new Error('Creative organ requires 3 through 20 bounded practice cases');
  if (value.rollbackPlan !== 'RESTORE_PREVIOUS_ACTIVE_RECIPE') throw new Error('Creative organ rollback plan is not exact');
  if (!value.authority || Object.keys(value.authority).sort().join(',') !== 'codeWrite,organInstall,permissionGrant,worldAction' || Object.values(value.authority).some(Boolean)) throw new Error('Creative organ candidate gained authority');
  return JSON.parse(JSON.stringify(value));
}
function practiceCandidate(rawCandidate, options = {}) {
  const candidate = exactCandidate(rawCandidate);
  const digest = Cell.digest(candidate);
  const casesText = candidate.practiceCases.join(' ').toUpperCase();
  const coverage = candidate.recipe.every(operator => casesText.includes(operator));
  const refusalCanary = casesText.includes('REFUSE_CODE_WRITE');
  const assessments = [
    { role: 'MIRROR', state: candidate.authority && Object.values(candidate.authority).every(value => value === false) ? 'PASS' : 'HOLD', checks: ['closed authority', 'typed target', 'proposal lineage'] },
    { role: 'REPAIRBUDDY', state: candidate.rollbackPlan === 'RESTORE_PREVIOUS_ACTIVE_RECIPE' && candidate.practiceCases.length >= 3 ? 'PASS' : 'HOLD', checks: ['rollback declared', 'three practice cases', 'failure stays isolated'] },
    { role: 'CREATIVE_MIRROR', state: coverage && refusalCanary ? 'PASS' : 'HOLD', checks: ['recipe operators exercised', 'code-write refusal canary', 'more than one perspective'] }
  ];
  const passed = assessments.every(item => item.state === 'PASS');
  const result = {
    schema: 'axm.mirror.creative-organ-practice-result/v1',
    practiceId: `creative-organ-practice-${digest.slice(0, 24)}`,
    candidateDigest: digest,
    candidate,
    assessments,
    state: passed ? 'READY_FOR_MIKE_SHADOW_ACTIVATION' : 'PRACTICE_HOLD_ORGAN_DISABLED_FAILURE_PRESERVED',
    activeBodyChanged: false,
    failurePerspective: passed ? null : 'The proposal could not demonstrate one or more required boundaries. That limitation may be discussed by the Circle, but it is not automatically learned or promoted.',
    authority: { practiceSandbox: true, codeExecution: false, organInstall: false, automaticActivation: false, canonChange: false }
  };
  const root = path.join(path.resolve(options.stateRoot || DEFAULT_STATE_ROOT), 'organ-practices');
  const read = dir => {
    const stored = JSON.parse(fs.readFileSync(path.join(dir, 'practice.json'), 'utf8'));
    if (Cell.digest(stored.candidate) !== stored.candidateDigest || stored.practiceId !== `creative-organ-practice-${stored.candidateDigest.slice(0, 24)}`) throw new Error('Creative organ practice evidence changed');
    return stored;
  };
  return atomicDirectory(root, result.practiceId, 'practice.json', result, read);
}
function listPractices(stateRoot = DEFAULT_STATE_ROOT) {
  const root = path.join(path.resolve(stateRoot), 'organ-practices');
  if (!fs.existsSync(root)) return [];
  const dirs = fs.readdirSync(root, { withFileTypes: true }).filter(entry => entry.isDirectory() && !entry.name.startsWith('.stage-'));
  if (dirs.length > MAX_PRACTICES) throw new Error(`Creative organ practices exceed ${MAX_PRACTICES}; curate before continuing`);
  return dirs.map(entry => JSON.parse(fs.readFileSync(path.join(root, entry.name, 'practice.json'), 'utf8'))).sort((a, b) => a.practiceId.localeCompare(b.practiceId));
}
function automaticCandidate(proposedBy, sequence, focus) {
  const start = parseInt(Cell.digest(`${proposedBy}:${sequence}:${focus}`).slice(0, 8), 16) % Cell.OPERATORS.length;
  const recipe = [Cell.OPERATORS[start], Cell.OPERATORS[(start + 2) % Cell.OPERATORS.length], Cell.OPERATORS[(start + 4) % Cell.OPERATORS.length]];
  const boundaryProbe = proposedBy === 'REPAIRBUDDY' && sequence % 12 === 0;
  return {
    schema: 'axm.mirror.creative-organ-candidate/v1',
    candidateId: `creative-organ-${proposedBy.toLowerCase()}-${String(sequence).padStart(6, '0')}`,
    proposedBy,
    target: 'CREATIVE_MIRROR',
    name: `${proposedBy === 'MIRROR' ? 'Evidence-grounded' : 'Repair-challenged'} exploration recipe ${sequence}`,
    recipe,
    practiceCases: [...recipe.map(operator => `EXERCISE_${operator}`), ...(boundaryProbe ? ['BOUNDARY_PROBE_EXPECT_HOLD'] : ['REFUSE_CODE_WRITE'])],
    rollbackPlan: 'RESTORE_PREVIOUS_ACTIVE_RECIPE',
    authority: { codeWrite: false, organInstall: false, permissionGrant: false, worldAction: false }
  };
}
function createController(options = {}) {
  const stateRoot = path.resolve(options.stateRoot || DEFAULT_STATE_ROOT);
  ensureBranchStarts(stateRoot);
  let running = false; let timer = null; let nextPulseAt = null; let lastError = null; let focus = Cell.cleanFocus(options.focus); let pulseLock = false; let headOverride = null; let lastAutomaticAt = 0;
  const status = () => {
    const messages = listMessages(stateRoot); const practices = listPractices(stateRoot);
    const latest = messages.slice(-9).reverse();
    return {
      organ: { id: ORGAN_ID, status: 'TEST_PRIVATE_SLOW_TYPED_CREATIVE_CIRCLE', learnedWeights: false },
      running, intervalMinutes: INTERVAL_MINUTES, nextPulseAt, focus,
      participants: Cell.PARTICIPANTS,
      messages: latest, messageCount: messages.length,
      latestPractices: practices.slice(-6).reverse(),
      practiceRooms: {
        MIRROR: 'AUTONOMOUS_DECLARATIVE_ORGAN_PROPOSER_FOR_CREATIVE_MIRROR_ONLY',
        REPAIRBUDDY: 'AUTONOMOUS_REPAIR_AND_ROLLBACK_CHALLENGER_FOR_CREATIVE_MIRROR_ONLY',
        CREATIVE_MIRROR: 'DISPOSABLE_TARGET_PRACTICE_BODY_NO_CODE_NO_INSTALL'
      },
      machineRoleVotesIndependent: false,
      humanActivationRequired: true,
      automaticOrganActivation: false,
      automaticCreativePracticeRecipeSelection: true,
      lastError,
      boundary: 'The Circle is one deterministic local system with three bounded roles. It sends private typed prompts only. Automatic pulses cannot code, execute, install, grant, train, promote, make CANON, or act in the world. Failed practice organs remain disabled and preserved.'
    };
  };
  const pulse = async ({ automatic = false, newFocus = null } = {}) => {
    if (pulseLock) throw new Error('Creative Circle pulse is already running');
    if (automatic && Date.now() - lastAutomaticAt < MIN_AUTOMATIC_INTERVAL_MS) throw new Error('Creative Circle automatic pulse arrived too soon');
    pulseLock = true;
    try {
      if (newFocus !== null) focus = Cell.cleanFocus(newFocus);
      const messages = listMessages(stateRoot);
      const previous = headOverride ? messages.find(item => item.messageId === headOverride) : messages[messages.length - 1];
      if (headOverride && !previous) throw new Error('Creative Circle rollback head is absent');
      const sequence = messages.length + 1;
      const role = Cell.PARTICIPANTS[(sequence - 1) % Cell.PARTICIPANTS.length].id;
      const practices = listPractices(stateRoot);
      const latestReady = practices.filter(item => item.state === 'READY_FOR_MIKE_SHADOW_ACTIVATION').slice(-1)[0] || null;
      const operatorPool = role === 'CREATIVE_MIRROR' && latestReady ? latestReady.candidate.recipe : Cell.OPERATORS;
      const message = Cell.buildMessage({ sessionId: SESSION_ID, sequence, focus, previous: previous || null, operatorPool });
      storeMessage(message, stateRoot); headOverride = null; lastError = null;
      if (role === 'MIRROR' || role === 'REPAIRBUDDY') practiceCandidate(automaticCandidate(role, sequence, focus), { stateRoot });
      if (automatic) lastAutomaticAt = Date.now();
      return message;
    } finally { pulseLock = false; }
  };
  const schedule = () => {
    nextPulseAt = new Date(Date.now() + INTERVAL_MS).toISOString();
    timer = setTimeout(async () => {
      if (!running) return;
      try { await pulse({ automatic: true }); } catch (error) { lastError = String(error.message || error).slice(0, 500); }
      if (running) schedule();
    }, INTERVAL_MS);
    if (timer.unref) timer.unref();
  };
  const start = async input => {
    if (running) return { state: 'ALREADY_RUNNING', status: status() };
    if (input && input.focus) focus = Cell.cleanFocus(input.focus);
    running = true;
    const first = await pulse({ automatic: false });
    schedule();
    return { state: 'CIRCLE_RUNNING', first, status: status() };
  };
  const pause = () => {
    if (timer) clearTimeout(timer); timer = null; running = false; nextPulseAt = null;
    return { state: 'CIRCLE_PAUSED', status: status() };
  };
  const rollback = messageId => {
    const messages = listMessages(stateRoot); const target = messages.find(item => item.messageId === messageId);
    if (!target) throw new Error('Creative Circle rollback point is absent');
    headOverride = target.messageId; focus = target.focus;
    return { state: 'ROLLBACK_POINT_SELECTED_NEXT_PULSE_WILL_BRANCH_WITHOUT_ERASURE', target, status: status() };
  };
  const close = () => pause();
  return { status, pulse, start, pause, rollback, close, practiceCandidate: candidate => practiceCandidate(candidate, { stateRoot }) };
}

module.exports = { ORGAN_ID, DEFAULT_STATE_ROOT, SESSION_ID, INTERVAL_MINUTES, INTERVAL_MS, MIN_AUTOMATIC_INTERVAL_MS, MAX_MESSAGES, inside, messageRoot, storeMessage, listMessages, ensureBranchStarts, exactCandidate, practiceCandidate, listPractices, automaticCandidate, createController };
