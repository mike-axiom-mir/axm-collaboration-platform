'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const readline = require('readline/promises');
const Human = require('../../../shared/human-benefit-evidence/human-benefit-evidence');
const Handoff = require('../../../shared/grounded-growth-human-handoff/grounded-growth-human-handoff');
const Current = require('../2026-08-19-reuse-existing-human-bridge-ancestry/build-current-readiness');

const WORKSPACE_ROOT = fs.realpathSync(path.resolve(__dirname, '..', '..', '..'));
const RATIONALE_CODES = [
  'OBJECTIVE_AND_EXPERIENTIAL_BENEFIT',
  'BENEFIT_NOT_ESTABLISHED',
  'HARM_OR_BURDEN',
  'INSUFFICIENT_OR_MIXED',
  'SCOPE_LIMITED'
];

function isoNow() {
  return new Date().toISOString();
}

function randomId(prefix) {
  return prefix + '-' + crypto.randomBytes(8).toString('hex');
}

function isWithin(root, target) {
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative));
}

function loadExactRoute(capabilityId) {
  if (!capabilityId) throw new Error('a capability-id selector is required before any human prompt or session read');
  const current = Current.verifyRecorded();
  const route = current.routes.find((item) => item.definition.capabilityId === capabilityId);
  if (!route) throw new Error('unsupported current capability route: ' + capabilityId);
  return route;
}

function loadExternalSessions(sessionPath) {
  if (!sessionPath) throw new Error('an external session receipt path is required');
  const exactPath = fs.realpathSync(path.resolve(sessionPath));
  if (isWithin(WORKSPACE_ROOT, exactPath)) throw new Error('human session input must stay outside the Workshop repository');
  const parsed = JSON.parse(fs.readFileSync(exactPath, 'utf8'));
  const sessions = Array.isArray(parsed) ? parsed : [parsed];
  if (!sessions.length) throw new Error('external session input is empty');
  if (sessions.length > 128) throw new Error('external session input exceeds 128 receipts');
  return sessions;
}

function prepareCurrentEvaluation(capabilityId, sessionPath, generatedAt) {
  const route = loadExactRoute(capabilityId);
  const sessions = loadExternalSessions(sessionPath);
  const evaluation = Handoff.prepareEvaluation({
    cycleReceipt: route.current.outcome.cycleReceipt,
    protocol: route.protocol,
    sessions,
    evaluationId: randomId('local-human-evaluation'),
    generatedAt: generatedAt || isoNow()
  });
  return { route, sessions, evaluation };
}

async function choose(rl, prompt, choices) {
  const values = new Map(Object.entries(choices).map(([key, value]) => [key.toUpperCase(), value]));
  while (true) {
    const answer = String(await rl.question(prompt)).trim().toUpperCase();
    if (values.has(answer)) return values.get(answer);
    process.stderr.write('Choose ' + Array.from(values.keys()).join(', ') + '.\n');
  }
}

async function chooseRationales(rl) {
  while (true) {
    process.stderr.write('\nRationale codes:\n');
    RATIONALE_CODES.forEach((code, index) => process.stderr.write('  ' + (index + 1) + '. ' + code + '\n'));
    const answer = String(await rl.question('Enter one or more numbers separated by commas: ')).trim();
    const indexes = Array.from(new Set(answer.split(',').map((item) => Number(item.trim()) - 1)));
    if (indexes.length && indexes.every((index) => Number.isInteger(index) && index >= 0 && index < RATIONALE_CODES.length)) {
      return indexes.map((index) => RATIONALE_CODES[index]);
    }
    process.stderr.write('Choose only listed rationale numbers.\n');
  }
}

async function runInteractive(capabilityId, sessionPath) {
  if (!process.stdin.isTTY) throw new Error('interactive human handoff requires a local TTY; piped or automated input is refused before reading session evidence');
  if (!capabilityId) throw new Error('a capability-id selector is required before any human prompt or session read');
  if (!sessionPath) throw new Error('an external session receipt path is required');

  const prepared = prepareCurrentEvaluation(capabilityId, sessionPath, isoNow());
  const { route, evaluation } = prepared;
  const rl = readline.createInterface({ input: process.stdin, output: process.stderr, terminal: true });
  try {
    process.stderr.write('\nAXM optional claim-scoped human handoff\n');
    process.stderr.write('Capability: ' + capabilityId + '\n');
    process.stderr.write('Claim: ' + evaluation.protocol.claim.statement + '\n');
    process.stderr.write('Scope: ' + evaluation.protocol.claim.scopeStatement + '\n');
    process.stderr.write('Evaluation signal: ' + evaluation.signal + '\n');
    process.stderr.write('Completed sessions: ' + evaluation.summary.completedSessions + '\n');
    process.stderr.write('\nThe signal is not the judgment. No identity or human presence is authenticated.\n');
    const review = String(await rl.question('Type REVIEW to enter a separate judgment, or anything else to stop without output: ')).trim().toUpperCase();
    if (review !== 'REVIEW') {
      process.stderr.write('Stopped. No judgment or handoff package was created.\n');
      return null;
    }

    const choices = evaluation.state === 'READY_FOR_HUMAN_JUDGMENT'
      ? { P: 'PASS', F: 'FAIL', U: 'UNKNOWN' }
      : { U: 'UNKNOWN' };
    const decision = await choose(rl, 'P=pass, F=fail, U=unknown: ', choices);
    const rationaleCodes = await chooseRationales(rl);
    process.stderr.write('\nRequired declaration:\n' + Handoff.LIVE_SOURCE_ATTESTATION + '\n');
    const declaration = String(await rl.question('Type DECLARE to make that declaration, or anything else to stop: ')).trim().toUpperCase();
    if (declaration !== 'DECLARE') {
      process.stderr.write('Stopped. No judgment or handoff package was created.\n');
      return null;
    }

    const judgeRef = Human.sha256(crypto.randomBytes(32));
    const judgment = Human.buildJudgment(evaluation, {
      judgmentId: randomId('local-human-judgment'),
      recordedAt: isoNow(),
      fixtureMode: 'LIVE',
      sourceMode: 'HUMAN_ENTERED',
      judgeRef,
      attestation: Human.LIVE_ATTESTATION,
      decision,
      rationaleCodes
    });
    const sourceDeclaration = Handoff.buildSourceDeclaration({
      declarationId: randomId('local-steward-source-declaration'),
      declaredAt: isoNow(),
      declarationMode: Handoff.LIVE_DECLARATION_MODE,
      attestation: Handoff.LIVE_SOURCE_ATTESTATION,
      evaluation,
      judgment
    });
    const closureState = await choose(rl, 'Are all exact referenced sources current? C=current, H=held, U=unknown: ', {
      C: 'CURRENT', H: 'HELD', U: 'UNKNOWN'
    });
    const generatedAt = isoNow();
    const handoffPackage = Handoff.buildPackage({
      handoffId: randomId('local-human-handoff'),
      generatedAt,
      closureId: randomId('local-human-closure'),
      closureState,
      closureCheckedAt: generatedAt,
      bridgeId: randomId('local-human-bridge-v2'),
      outcomeId: randomId('local-human-grounded-outcome'),
      cycleReceipt: route.current.outcome.cycleReceipt,
      evaluation,
      judgment,
      sourceDeclaration,
      interventionLink: route.link
    });
    console.log(JSON.stringify(handoffPackage, null, 2));
    process.stderr.write('Handoff package emitted to standard output. It was not written, installed, promoted, merged, or made CANON.\n');
    process.stderr.write('Admission state: ' + handoffPackage.state + '; mapped decision: ' + handoffPackage.mappedDecision + '.\n');
    return handoffPackage;
  } finally {
    rl.close();
  }
}

if (require.main === module) {
  runInteractive(process.argv[2], process.argv[3]).catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  WORKSPACE_ROOT,
  RATIONALE_CODES,
  isWithin,
  loadExactRoute,
  loadExternalSessions,
  prepareCurrentEvaluation,
  runInteractive
};
