'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Steward = require('./human-guided-steward-organ');
const ChoiceCell = require('../kernel/human-guided-steward-choice-cell');
const LoopbackProvider = require('../kernel/loopback-code-provider-cell');
const Intake = require('./human-guided-code-return-intake-organ');

const ORGAN_ID = 'axm.mirror.organ/human-guided-local-code-proposal-v1';

function sha256(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex'); }

function localPrompt(choice, packet) {
  return [
    ChoiceCell.renderExternalBuilderPrompt(choice, packet),
    '',
    'LOCAL PROVIDER DECLARATION OVERRIDE:',
    'Set source.platform exactly to "OLLAMA_LOOPBACK_LOCAL".',
    `Set source.model exactly to "${LoopbackProvider.DEFAULT_PROVIDER.model}".`,
    'Return only the JSON object. Your output remains an untrusted proposal and will not be executed or installed.'
  ].join('\n');
}

function writeInboxCandidate(bytes, requestId, inboxDir) {
  const root = Intake.realDirectory(inboxDir || Intake.DEFAULT_INBOX_DIR, 'external code inbox', true);
  const name = `${requestId}.local-${sha256(bytes).slice(0, 16)}.json`;
  const destination = path.join(root, name);
  if (fs.existsSync(destination)) {
    const stat = fs.lstatSync(destination);
    if (!stat.isFile() || stat.isSymbolicLink() || sha256(fs.readFileSync(destination)) !== sha256(bytes)) throw new Error('local coder inbox destination changed');
    return { destination, reused: true };
  }
  fs.writeFileSync(destination, bytes, { flag: 'wx' });
  return { destination, reused: false };
}

async function run(options = {}) {
  const choiceNumber = Number(options.choiceNumber);
  if (!Number.isInteger(choiceNumber)) throw new Error('local coder requires an explicit whole-number capability-route choice');
  const steward = options.stewardResult || Steward.run(Object.assign({}, options.stewardOptions || {}, { choiceNumber, actorId: options.actorId || 'mike-local-steward', expectedPacketId: options.expectedPacketId }));
  if (options.expectedPacketId && options.expectedPacketId !== steward.packet.packetId) throw new Error('local coder packet changed; reload before requesting code');
  if (!options.stewardResult && (!steward.selection || steward.selection.selected.number !== choiceNumber)) throw new Error('local coder requires an immutable human attention selection');
  const choice = steward.packet.choices[choiceNumber - 1];
  if (!choice || choice.kind !== 'REVIEW_CAPABILITY_OR_NEW_ORGAN_ROUTE') throw new Error('local coder only accepts a current capability-route choice');
  const request = ChoiceCell.externalBuilderRequest(choice, steward.packet);
  const generate = options.generate || LoopbackProvider.generate;
  const generated = await generate(localPrompt(choice, steward.packet), options.providerOptions || {});
  const written = writeInboxCandidate(generated.candidateBytes, request.requestId, options.inboxDir || Intake.DEFAULT_INBOX_DIR);
  const intake = Intake.intakeFile(written.destination, steward.packet, { inboxDir: options.inboxDir || Intake.DEFAULT_INBOX_DIR, candidateDir: options.candidateDir || Intake.DEFAULT_CANDIDATE_DIR });
  return {
    organ: { id: ORGAN_ID, status: 'TEST_LOCAL_PROPOSAL_ONLY', learnedWeights: true, model: LoopbackProvider.DEFAULT_PROVIDER.model },
    request,
    selection: steward.selection ? { selectionId: steward.selection.selectionId, selectionDigest: steward.selection.selectionDigest } : null,
    provider: { endpoint: 'http://127.0.0.1:11434/api/generate', loopbackOnly: true, model: LoopbackProvider.DEFAULT_PROVIDER.model, telemetry: generated.telemetry },
    inbox: { file: written.destination, reused: written.reused, retained: true },
    intake,
    state: intake.state,
    summary: { generatedCandidates: 1, executedFiles: 0, publicFilesWritten: 0, candidatesInstalled: 0, permissionsGranted: 0, workshopWrites: 0, runtimePromotions: 0, canonChanges: 0 },
    authority: { privateInboxWrite: true, privateIsolatedCandidateWrite: true, sourceExecution: false, publicSourceWrite: false, candidateInstall: false, workshopWrite: false, permissionGrant: false, trainingAdmission: false, runtimePromotion: false, canonChange: false, worldAction: false },
    boundary: 'A declared local learned coder proposed bytes from an exact typed request. Its output is untrusted and passed through the same static isolated intake. It cannot read the repository, execute or install its result, write public Mirror or Workshop files, grant permission, train Mirror, promote runtime, or change CANON.'
  };
}

module.exports = { ORGAN_ID, localPrompt, writeInboxCandidate, run };
