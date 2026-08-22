#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const readline = require('readline/promises');
const { performance } = require('perf_hooks');
const Human = require('../../../shared/human-benefit-evidence/human-benefit-evidence');
const Handoff = require('../../../shared/grounded-growth-human-handoff/grounded-growth-human-handoff');
const Builder = require('./build-current-human-route-coverage');

const WORKSHOP_ROOT = fs.realpathSync(path.resolve(__dirname, '..', '..', '..'));
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

function requireTty(kind) {
  if (!process.stdin.isTTY) throw new Error(kind + ' requires a local TTY; piped or automated input is refused before any prompt or session read');
}

function loadExactRoute(capabilityId) {
  if (!capabilityId) throw new Error('a capability-id selector is required before any human prompt or session read');
  const current = Builder.checkRecorded();
  const held = current.coverage.holds.find((item) => item.capabilityId === capabilityId);
  if (held) throw new Error('current capability route is held: ' + held.reasonCode + '; required event: ' + held.requiredExternalEvent);
  const route = current.readyRoutes.find((item) => item.capabilityId === capabilityId);
  if (!route) throw new Error('unsupported current capability route: ' + capabilityId);
  return route;
}

function loadExternalSessions(sessionPath) {
  if (!sessionPath) throw new Error('an external session receipt path is required');
  const exactPath = fs.realpathSync(path.resolve(sessionPath));
  if (isWithin(WORKSHOP_ROOT, exactPath)) throw new Error('human session input must stay outside the Workshop repository');
  const parsed = JSON.parse(fs.readFileSync(exactPath, 'utf8'));
  const sessions = Array.isArray(parsed) ? parsed : [parsed];
  if (!sessions.length) throw new Error('external session input is empty');
  if (sessions.length > 128) throw new Error('external session input exceeds 128 receipts');
  return sessions;
}

async function choose(rl, prompt, choices) {
  const values = new Map(Object.entries(choices).map(([key, value]) => [key.toUpperCase(), value]));
  while (true) {
    const answer = String(await rl.question(prompt)).trim().toUpperCase();
    if (values.has(answer)) return values.get(answer);
    process.stderr.write('Choose ' + Array.from(values.keys()).join(', ') + '.\n');
  }
}

function withdrawalReceipt(protocol, state, completedAt) {
  return Human.buildSession(protocol, {
    sessionId: state.sessionId,
    generatedAt: completedAt,
    fixtureMode: 'LIVE',
    startedAt: state.startedAt,
    completedAt,
    consent: {
      mode: 'VOLUNTARY_OPT_IN',
      grantedAt: state.grantedAt,
      completionConfirmedAt: null,
      withdrawnAt: completedAt,
      useScope: 'LOCAL_BENEFIT_EVALUATION_ONLY',
      retentionAccepted: 'STRUCTURED_NO_FREE_TEXT'
    },
    observations: [],
    participantJudgment: null
  });
}

async function runSession(capabilityId) {
  requireTty('interactive human session');
  const route = loadExactRoute(capabilityId);
  const rl = readline.createInterface({ input: process.stdin, output: process.stderr, terminal: true });
  try {
    process.stderr.write('\nAXM optional capability-scoped human-benefit check\n');
    process.stderr.write('Capability: ' + capabilityId + '\n\n');
    route.packet.notices.forEach((notice) => process.stderr.write('- ' + notice + '\n'));
    process.stderr.write('\nYou may type W during any trial to withdraw. A withdrawal receipt retains no participant reference or observations.\n\n');
    const optIn = String(await rl.question('Type YES to participate, or anything else to stop: ')).trim().toUpperCase();
    if (optIn !== 'YES') {
      process.stderr.write('No session was created.\n');
      return null;
    }
    const state = {
      sessionId: randomId('local-human-session'),
      participantRef: Human.sha256(crypto.randomBytes(32)),
      grantedAt: isoNow(),
      startedAt: isoNow()
    };
    const observations = [];
    for (const trial of route.packet.trials) {
      process.stderr.write('\n[' + trial.order + '/' + route.packet.trials.length + '] ' + trial.prompt + '\n');
      const started = performance.now();
      const decision = await choose(rl, 'C=continue, H=hold, U=unsure, W=withdraw: ', {
        C: 'CONTINUE', H: 'HOLD', U: 'UNSURE', W: 'WITHDRAW'
      });
      if (decision === 'WITHDRAW') {
        const receipt = withdrawalReceipt(route.protocol, state, isoNow());
        process.stdout.write(JSON.stringify(receipt, null, 2) + '\n');
        process.stderr.write('Withdrawn. No participant reference or observations were retained in the receipt.\n');
        return receipt;
      }
      const confidence = Number(await choose(rl, 'Confidence 1-5: ', { 1: '1', 2: '2', 3: '3', 4: '4', 5: '5' }));
      const confusion = await choose(rl, 'N=no confusion, S=some confusion, B=blocked: ', { N: 'NONE', S: 'SOME', B: 'BLOCKED' });
      observations.push({
        trialId: trial.trialId,
        decision,
        confidence,
        confusion,
        elapsedMs: Math.max(0, Math.round(performance.now() - started))
      });
    }
    const effect = await choose(rl, '\nDid Condition B help? H=helped, X=harmed, N=no meaningful difference, U=unsure: ', {
      H: 'HELPED', X: 'HARMED', N: 'NO_MEANINGFUL_DIFFERENCE', U: 'UNSURE'
    });
    const burden = await choose(rl, 'Overall burden L=low, A=acceptable, H=high: ', { L: 'LOW', A: 'ACCEPTABLE', H: 'HIGH' });
    const judgmentConfidence = Number(await choose(rl, 'Confidence in that effect judgment 1-5: ', { 1: '1', 2: '2', 3: '3', 4: '4', 5: '5' }));
    const completion = String(await rl.question('Type YES to confirm this structured response, or anything else to withdraw: ')).trim().toUpperCase();
    if (completion !== 'YES') {
      const receipt = withdrawalReceipt(route.protocol, state, isoNow());
      process.stdout.write(JSON.stringify(receipt, null, 2) + '\n');
      process.stderr.write('Withdrawn. No participant reference or observations were retained in the receipt.\n');
      return receipt;
    }
    const completionConfirmedAt = isoNow();
    const completedAt = isoNow();
    const session = Human.buildSession(route.protocol, {
      sessionId: state.sessionId,
      generatedAt: completedAt,
      fixtureMode: 'LIVE',
      startedAt: state.startedAt,
      completedAt,
      participantRef: state.participantRef,
      consent: {
        mode: 'VOLUNTARY_OPT_IN',
        grantedAt: state.grantedAt,
        completionConfirmedAt,
        withdrawnAt: null,
        useScope: 'LOCAL_BENEFIT_EVALUATION_ONLY',
        retentionAccepted: 'STRUCTURED_NO_FREE_TEXT'
      },
      observations,
      participantJudgment: { effect, burden, confidence: judgmentConfidence }
    });
    process.stdout.write(JSON.stringify(session, null, 2) + '\n');
    process.stderr.write('Session receipt emitted to standard output. It is not yet a human-benefit verdict.\n');
    return session;
  } finally {
    rl.close();
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

function prepareEvaluation(capabilityId, sessionPath, generatedAt) {
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

async function runHandoff(capabilityId, sessionPath) {
  requireTty('interactive human handoff');
  const { route, evaluation } = prepareEvaluation(capabilityId, sessionPath, isoNow());
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
      interventionLink: route.interventionLink
    });
    process.stdout.write(JSON.stringify(handoffPackage, null, 2) + '\n');
    process.stderr.write('Handoff package emitted to standard output. It was not written, installed, promoted, merged, or made CANON.\n');
    process.stderr.write('Admission state: ' + handoffPackage.state + '; mapped decision: ' + handoffPackage.mappedDecision + '.\n');
    return handoffPackage;
  } finally {
    rl.close();
  }
}

async function runInteractive(mode, capabilityId, sessionPath) {
  if (mode === 'session') return runSession(capabilityId);
  if (mode === 'handoff') return runHandoff(capabilityId, sessionPath);
  throw new Error('mode must be session or handoff');
}

if (require.main === module) {
  runInteractive(process.argv[2], process.argv[3], process.argv[4]).catch((error) => {
    process.stderr.write((error.stack || error.message) + '\n');
    process.exitCode = 1;
  });
}

module.exports = {
  WORKSHOP_ROOT,
  RATIONALE_CODES,
  isWithin,
  requireTty,
  loadExactRoute,
  loadExternalSessions,
  withdrawalReceipt,
  prepareEvaluation,
  runSession,
  runHandoff,
  runInteractive
};
