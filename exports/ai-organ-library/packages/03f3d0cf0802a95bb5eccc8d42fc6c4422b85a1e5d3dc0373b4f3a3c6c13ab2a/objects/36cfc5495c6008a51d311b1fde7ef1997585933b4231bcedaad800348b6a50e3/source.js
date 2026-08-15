'use strict';

const fs = require('fs');
const path = require('path');
const ChoiceCell = require('../kernel/human-guided-steward-choice-cell');
const FrontierRouter = require('./foundation-development-frontier-router-organ');
const HandPlanner = require('./foundation-development-hand-planner-organ');
const ImmutableBatchStore = require('../kernel/immutable-batch-store');

const ORGAN_ID = 'axm.mirror.organ/human-guided-steward-v1';
const ROOT = path.resolve(__dirname, '..');
const DEFAULT_STATE_DIR = path.join(ROOT, 'state', 'human-guided-steward-v1-runs');

function stable(value) { return ChoiceCell.stable(value); }
function same(left, right) { return JSON.stringify(stable(left)) === JSON.stringify(stable(right)); }
function json(value) { return JSON.stringify(stable(value), null, 2) + '\n'; }
function boundedChild(parent, child) {
  const resolvedParent = path.resolve(parent);
  const resolved = path.resolve(resolvedParent, child);
  if (path.dirname(resolved) !== resolvedParent) throw new Error(`guided steward path escapes its state directory: ${child}`);
  return resolved;
}

function verifiers() {
  return { frontier: batch => FrontierRouter.verifyBatch(batch), hand: (batch, frontier) => HandPlanner.verifyBatch(batch, frontier) };
}

function loadSources(options = {}) {
  if (options.frontierBatch || options.handBatch) {
    if (!options.frontierBatch || !options.handBatch) throw new Error('guided steward explicit sources require frontier and hand batches together');
    ChoiceCell.verifySourceBatches(options.frontierBatch, options.handBatch, verifiers());
    return { frontierBatch: options.frontierBatch, handBatch: options.handBatch };
  }
  const frontierBatch = HandPlanner.loadCurrentFrontier(options);
  const planned = HandPlanner.run(Object.assign({}, options, { frontierBatch, stateDir: path.resolve(options.handStateDir || HandPlanner.DEFAULT_STATE_DIR) }));
  ChoiceCell.verifySourceBatches(frontierBatch, planned.batch, verifiers());
  return { frontierBatch, handBatch: planned.batch };
}

function storeRecord(stateDir, id, fileName, value, verify) {
  const resolvedStateDir = path.resolve(stateDir || DEFAULT_STATE_DIR);
  fs.mkdirSync(resolvedStateDir, { recursive: true });
  const runDir = boundedChild(resolvedStateDir, id);
  if (fs.existsSync(runDir)) {
    const existing = JSON.parse(fs.readFileSync(path.join(runDir, fileName), 'utf8'));
    verify(existing, runDir);
    if (!same(existing, value)) throw new Error('guided steward content-addressed identity collision');
    return { value: existing, runDir, reused: true };
  }
  const stageDir = boundedChild(resolvedStateDir, `.stage-${id}-${process.pid}`);
  if (fs.existsSync(stageDir)) throw new Error(`guided steward staging directory already exists: ${stageDir}`);
  fs.mkdirSync(stageDir, { recursive: true });
  fs.writeFileSync(path.join(stageDir, fileName), json(value), { flag: 'wx' });
  verify(value, stageDir);
  const commit = ImmutableBatchStore.commitDirectory(stageDir, runDir);
  return { value, runDir, reused: commit.reused };
}

function storePacket(packet, stateDir) {
  return storeRecord(stateDir, packet.packetId, 'packet.json', packet, (value, runDir) => {
    ChoiceCell.verifyChoicePacket(value);
    const disk = JSON.parse(fs.readFileSync(path.join(runDir, 'packet.json'), 'utf8'));
    if (!same(disk, value)) throw new Error('guided steward packet file changed');
  });
}

function storeSelectionAndSession(selection, session, stateDir) {
  const value = { schema: 'axm.mirror.human-guided-steward-step-record/v1', selection, session };
  return storeRecord(stateDir, session.sessionId, 'step.json', value, (record, runDir) => {
    if (!record || record.schema !== 'axm.mirror.human-guided-steward-step-record/v1') throw new Error('guided steward step record schema changed');
    ChoiceCell.verifySelection(record.selection);
    ChoiceCell.verifySession(record.session);
    const disk = JSON.parse(fs.readFileSync(path.join(runDir, 'step.json'), 'utf8'));
    if (!same(disk, record)) throw new Error('guided steward step file changed');
  });
}

function verifyRun(result, sources) {
  if (!result || !result.analysis || !result.packet) throw new Error('guided steward run is incomplete');
  ChoiceCell.verifyAnalysis(result.analysis, sources.frontierBatch, sources.handBatch, verifiers());
  ChoiceCell.verifyChoicePacket(result.packet, result.analysis);
  if (result.selection || result.session) {
    if (!result.selection || !result.session) throw new Error('guided steward selection and session must be present together');
    ChoiceCell.verifySelection(result.selection, result.packet);
    ChoiceCell.verifySession(result.session, result.packet, result.selection);
  }
  if (result.summary.actionsExecuted !== 0 || result.summary.permissionsGranted !== 0 || result.summary.workshopWrites !== 0 || result.summary.trainingAdmissions !== 0 || result.summary.promotions !== 0 || result.summary.canonChanges !== 0 || result.summary.worldActions !== 0) throw new Error('guided steward run exceeded its claim ceiling');
  return true;
}

function run(options = {}) {
  const sources = loadSources(options);
  const analysis = ChoiceCell.buildAnalysis(sources.frontierBatch, sources.handBatch, verifiers());
  const packet = ChoiceCell.buildChoicePacket(analysis);
  const storedPacket = storePacket(packet, options.stateDir || DEFAULT_STATE_DIR);
  if (options.expectedPacketId && options.expectedPacketId !== storedPacket.value.packetId) throw new Error('guided steward state changed; reload choices before selecting');
  let selection = null;
  let session = null;
  let storedStep = null;
  if (options.choiceNumber !== undefined && options.choiceNumber !== null) {
    selection = ChoiceCell.buildSelection(storedPacket.value, Number(options.choiceNumber), options.actorId || 'mike-local-steward');
    session = ChoiceCell.buildSession(storedPacket.value, selection);
    storedStep = storeSelectionAndSession(selection, session, options.stateDir || DEFAULT_STATE_DIR);
  }
  const result = {
    organ: { id: ORGAN_ID, status: 'TEST_HUMAN_GUIDED_DETERMINISTIC_STEWARD', learnedWeights: false, directHumanCommunication: false },
    analysis,
    packet: storedPacket.value,
    selection,
    session,
    storage: { packetRunDir: storedPacket.runDir, packetReused: storedPacket.reused, stepRunDir: storedStep && storedStep.runDir || null, stepReused: storedStep && storedStep.reused || false },
    summary: { choices: packet.summary.choices, actionsExecuted: 0, permissionsGranted: 0, workshopWrites: 0, trainingAdmissions: 0, promotions: 0, canonChanges: 0, worldActions: 0 },
    state: selection ? 'HUMAN_GUIDED_STEP_RECORDED_NO_ACTION_EXECUTED' : 'AWAITING_EXPLICIT_HUMAN_SELECTION',
    boundary: 'This TEST organ gives the human steward a fixed rendering of typed verified machine choices. It can write only immutable ignored packet and selection traces. It cannot converse, code a new organ, choose priority, execute commands, access or write Workshop, grant permission, train, promote, change CANON, or act.'
  };
  verifyRun(result, sources);
  return result;
}

module.exports = { ORGAN_ID, DEFAULT_STATE_DIR, verifiers, loadSources, storeRecord, storePacket, storeSelectionAndSession, verifyRun, run };
