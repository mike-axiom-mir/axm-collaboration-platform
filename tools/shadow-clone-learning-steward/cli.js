#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const Core = require('./lib/shadow-clone-learning-core');

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.resolve(file), 'utf8').replace(/^\uFEFF/, ''));
}

function writeJsonExclusive(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
}

function digestWithout(value, key) {
  const copy = JSON.parse(JSON.stringify(value));
  delete copy[key];
  return Core.digest(copy);
}

function isWithin(candidate, root) {
  const target = path.resolve(candidate);
  const parent = path.resolve(root);
  const left = process.platform === 'win32' ? target.toLowerCase() : target;
  const right = process.platform === 'win32' ? parent.toLowerCase() : parent;
  return left === right || left.startsWith(right + path.sep);
}

function newOutput(folder) {
  const output = path.resolve(folder);
  if (fs.existsSync(output)) fail('OUTPUT_EXISTS', 'output already exists; refusing overwrite');
  fs.mkdirSync(output, { recursive: true });
  return output;
}

function runLearning(inputFile, outputFolder, previousLedgerFile) {
  const input = readJson(inputFile);
  if (previousLedgerFile) {
    if (input.previousLedger !== null) fail('PREVIOUS_LEDGER_CONFLICT', 'input already carries a previous ledger; refusing ambiguous continuity');
    input.previousLedger = Core.validateLedgerDigest(readJson(previousLedgerFile));
  }
  const ledger = Core.compileSnapshotSet(input);
  const output = newOutput(outputFolder);
  writeJsonExclusive(path.join(output, 'control', 'redacted-compact-snapshot-set.json'), input);
  writeJsonExclusive(path.join(output, 'LEARNING_LEDGER.json'), ledger);
  const receipt = { schema: 'axm.shadow-clone.learning-run-receipt/v1', receiptDigest: null, status: 'EXPERIMENTAL', state: ledger.state, inputDigest: ledger.source.inputDigest, ledgerDigest: ledger.ledgerDigest, outputFiles: ['control/redacted-compact-snapshot-set.json', 'LEARNING_LEDGER.json'], parentWrites: 0, canonicalWrites: 0, automaticIntegration: false, canon: false };
  receipt.receiptDigest = digestWithout(receipt, 'receiptDigest');
  writeJsonExclusive(path.join(output, 'RUN_RECEIPT.json'), receipt);
  return { output, ledger, receipt };
}

function replayLearning(runFolder, outputFolder) {
  const source = path.resolve(runFolder);
  const output = path.resolve(outputFolder);
  if (!fs.existsSync(source) || !fs.statSync(source).isDirectory()) fail('RUN_MISSING', 'learning run is unavailable');
  if (fs.existsSync(output)) fail('OUTPUT_EXISTS', 'output already exists; refusing overwrite');
  if (isWithin(output, source) || isWithin(source, output)) fail('OUTPUT_BOUNDARY', 'replay output must be separate from its source');
  const recorded = Core.validateLedgerDigest(readJson(path.join(source, 'LEARNING_LEDGER.json')));
  const input = readJson(path.join(source, 'control', 'redacted-compact-snapshot-set.json'));
  const replayed = Core.compileSnapshotSet(input);
  const state = replayed.ledgerDigest === recorded.ledgerDigest ? 'PASS_CLEAN_LEARNING_REPLAY' : 'FAIL_LEARNING_REPLAY_DRIFT';
  if (state !== 'PASS_CLEAN_LEARNING_REPLAY') fail('REPLAY_DRIFT', 'learning replay did not reproduce the recorded digest');
  newOutput(output);
  writeJsonExclusive(path.join(output, 'LEARNING_LEDGER.json'), replayed);
  const receipt = { schema: 'axm.shadow-clone.learning-replay-receipt/v1', receiptDigest: null, state, expectedLedgerDigest: recorded.ledgerDigest, observedLedgerDigest: replayed.ledgerDigest, parentWrites: 0, canonicalWrites: 0, automaticIntegration: false, canon: false };
  receipt.receiptDigest = digestWithout(receipt, 'receiptDigest');
  writeJsonExclusive(path.join(output, 'REPLAY_RECEIPT.json'), receipt);
  return { output, receipt };
}

function exportOne(kind, value, outputFolder) {
  const output = newOutput(outputFolder);
  writeJsonExclusive(path.join(output, kind), value);
  return { output, value };
}

function scoreTrial(inputFile, outputFolder) {
  const input = readJson(inputFile);
  const receipt = Core.scoreValueTrial(input);
  const output = newOutput(outputFolder);
  writeJsonExclusive(path.join(output, 'control', 'redacted-value-trial.json'), input);
  writeJsonExclusive(path.join(output, 'VALUE_TRIAL_RECEIPT.json'), receipt);
  return { output, receipt };
}

function scoreEvidenceTrial(inputFile, outputFolder) {
  const input = readJson(inputFile);
  const receipt = Core.scoreEvidenceBoundTrial(input);
  const output = newOutput(outputFolder);
  writeJsonExclusive(path.join(output, 'control', 'redacted-evidence-bound-value-trial.json'), input);
  writeJsonExclusive(path.join(output, 'EVIDENCE_BOUND_VALUE_RECEIPT.json'), receipt);
  return { output, receipt };
}

function prepareTrialAssignment(ledgerFile, requestFile, outputFolder) {
  return exportOne('TRIAL_ASSIGNMENT.json', Core.prepareTrialAssignment(readJson(ledgerFile), readJson(requestFile)), outputFolder);
}

function prepareReviewDecision(ledgerFile, requestFile, outputFolder) {
  return exportOne('CANDIDATE_REVIEW_DECISION.json', Core.createReviewDecision(readJson(ledgerFile), readJson(requestFile)), outputFolder);
}

function replayTrial(runFolder, outputFolder) {
  const source = path.resolve(runFolder);
  const output = path.resolve(outputFolder);
  if (!fs.existsSync(source) || !fs.statSync(source).isDirectory()) fail('RUN_MISSING', 'value trial run is unavailable');
  if (fs.existsSync(output)) fail('OUTPUT_EXISTS', 'output already exists; refusing overwrite');
  if (isWithin(output, source) || isWithin(source, output)) fail('OUTPUT_BOUNDARY', 'trial replay output must be separate from its source');
  const input = readJson(path.join(source, 'control', 'redacted-value-trial.json'));
  const recorded = readJson(path.join(source, 'VALUE_TRIAL_RECEIPT.json'));
  if (digestWithout(recorded, 'receiptDigest') !== recorded.receiptDigest) fail('VALUE_RECEIPT_DIGEST', 'recorded value receipt digest is invalid');
  const replayed = Core.scoreValueTrial(input);
  if (replayed.receiptDigest !== recorded.receiptDigest) fail('REPLAY_DRIFT', 'value trial replay drifted');
  newOutput(output);
  writeJsonExclusive(path.join(output, 'VALUE_TRIAL_RECEIPT.json'), replayed);
  const receipt = { schema: 'axm.shadow-clone.value-trial-replay/v1', state: 'PASS_CLEAN_VALUE_TRIAL_REPLAY', expectedReceiptDigest: recorded.receiptDigest, observedReceiptDigest: replayed.receiptDigest, automaticIntegration: false, canon: false };
  receipt.replayDigest = Core.digest(receipt);
  writeJsonExclusive(path.join(output, 'REPLAY_RECEIPT.json'), receipt);
  return { output, receipt };
}

function replayEvidenceTrial(runFolder, outputFolder) {
  const source = path.resolve(runFolder);
  const output = path.resolve(outputFolder);
  if (!fs.existsSync(source) || !fs.statSync(source).isDirectory()) fail('RUN_MISSING', 'evidence-bound value trial run is unavailable');
  if (fs.existsSync(output)) fail('OUTPUT_EXISTS', 'output already exists; refusing overwrite');
  if (isWithin(output, source) || isWithin(source, output)) fail('OUTPUT_BOUNDARY', 'evidence-bound replay output must be separate from its source');
  const input = readJson(path.join(source, 'control', 'redacted-evidence-bound-value-trial.json'));
  const recorded = readJson(path.join(source, 'EVIDENCE_BOUND_VALUE_RECEIPT.json'));
  if (digestWithout(recorded, 'receiptDigest') !== recorded.receiptDigest) fail('EVIDENCE_VALUE_RECEIPT_DIGEST', 'recorded evidence-bound value receipt digest is invalid');
  const replayed = Core.scoreEvidenceBoundTrial(input);
  if (replayed.receiptDigest !== recorded.receiptDigest) fail('REPLAY_DRIFT', 'evidence-bound value trial replay drifted');
  newOutput(output);
  writeJsonExclusive(path.join(output, 'EVIDENCE_BOUND_VALUE_RECEIPT.json'), replayed);
  const receipt = { schema: 'axm.shadow-clone.evidence-bound-value-replay/v1', state: 'PASS_CLEAN_EVIDENCE_BOUND_VALUE_REPLAY', expectedReceiptDigest: recorded.receiptDigest, observedReceiptDigest: replayed.receiptDigest, automaticIntegration: false, canon: false };
  receipt.replayDigest = Core.digest(receipt);
  writeJsonExclusive(path.join(output, 'REPLAY_RECEIPT.json'), receipt);
  return { output, receipt };
}

function argsMap(argv) {
  const result = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith('--')) result._.push(item);
    else result[item.slice(2)] = argv[index + 1] && !argv[index + 1].startsWith('--') ? argv[++index] : true;
  }
  return result;
}

function required(args, key) {
  if (!args[key] || args[key] === true) fail('ARGUMENT', '--' + key + ' is required');
  return args[key];
}

async function main(argv) {
  const args = argsMap(argv);
  const command = args._[0];
  let result;
  if (command === 'capability') result = Core.providerCapabilityReceipt(required(args, 'as-of'));
  else if (command === 'compile') result = runLearning(required(args, 'input'), required(args, 'output'), args['previous-ledger'] && args['previous-ledger'] !== true ? args['previous-ledger'] : null);
  else if (command === 'replay') result = replayLearning(required(args, 'run'), required(args, 'output'));
  else if (command === 'import-garden') result = exportOne('LEARNING_LEDGER.json', Core.adaptGrandGardenLedger(readJson(required(args, 'ledger'))), required(args, 'output'));
  else if (command === 'pickup') result = exportOne('ANTI_DRIFT_PICKUP.json', Core.createPickup(readJson(required(args, 'ledger')), readJson(required(args, 'request'))), required(args, 'output'));
  else if (command === 'mirror-proposal') result = exportOne('MIRROR_LESSON_PROPOSAL.json', Core.createMirrorProposal(readJson(required(args, 'ledger')), readJson(required(args, 'request'))), required(args, 'output'));
  else if (command === 'review-decision') result = prepareReviewDecision(required(args, 'ledger'), required(args, 'request'), required(args, 'output'));
  else if (command === 'trial-assignment') result = prepareTrialAssignment(required(args, 'ledger'), required(args, 'request'), required(args, 'output'));
  else if (command === 'score-trial') result = scoreTrial(required(args, 'input'), required(args, 'output'));
  else if (command === 'replay-trial') result = replayTrial(required(args, 'run'), required(args, 'output'));
  else if (command === 'score-evidence-trial') result = scoreEvidenceTrial(required(args, 'input'), required(args, 'output'));
  else if (command === 'replay-evidence-trial') result = replayEvidenceTrial(required(args, 'run'), required(args, 'output'));
  else fail('COMMAND', 'expected capability, compile, replay, import-garden, pickup, mirror-proposal, review-decision, trial-assignment, score-trial, replay-trial, score-evidence-trial, or replay-evidence-trial');
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  return result;
}

if (require.main === module) main(process.argv.slice(2)).catch(error => { console.error(JSON.stringify({ ok: false, code: error.code || 'ERROR', message: error.message })); process.exitCode = 1; });

module.exports = { digestWithout, exportOne, isWithin, main, newOutput, prepareReviewDecision, prepareTrialAssignment, readJson, replayEvidenceTrial, replayLearning, replayTrial, runLearning, scoreEvidenceTrial, scoreTrial, writeJsonExclusive };
