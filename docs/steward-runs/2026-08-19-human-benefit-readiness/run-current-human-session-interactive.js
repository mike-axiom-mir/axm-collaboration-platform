'use strict';

const crypto = require('crypto');
const readline = require('readline/promises');
const { performance } = require('perf_hooks');
const Human = require('../../../shared/human-benefit-evidence/human-benefit-evidence');
const Current = require('./current-protocol');

function isoNow() {
  return new Date().toISOString();
}

async function choose(rl, prompt, choices) {
  const normalized = new Map(Object.entries(choices).map(([key, value]) => [key.toUpperCase(), value]));
  while (true) {
    const answer = String(await rl.question(prompt)).trim().toUpperCase();
    if (normalized.has(answer)) return normalized.get(answer);
    process.stderr.write('Choose ' + Array.from(normalized.keys()).join(', ') + '.\n');
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

async function runInteractive() {
  if (!process.stdin.isTTY) throw new Error('interactive human session requires a local TTY; piped or automated input is refused');
  const protocol = Current.buildCurrentProtocol();
  const exact = Current.loadExact();
  if (Human.stableStringify(protocol) !== Human.stableStringify(exact.protocol)) {
    throw new Error('current protocol sources changed; rebuild before collecting a response');
  }
  const packetCheck = Current.verifyParticipantPacket(protocol, exact.packet);
  if (!packetCheck.pass) throw new Error('participant packet does not match the answer-free source');

  const rl = readline.createInterface({ input: process.stdin, output: process.stderr, terminal: true });
  try {
    process.stderr.write('\nAXM optional human-benefit check\n\n');
    exact.packet.notices.forEach((notice) => process.stderr.write('- ' + notice + '\n'));
    process.stderr.write('\nYou may type W during any trial to withdraw. A withdrawal receipt retains no participant reference or observations.\n\n');
    const optIn = String(await rl.question('Type YES to participate, or anything else to stop: ')).trim().toUpperCase();
    if (optIn !== 'YES') {
      process.stderr.write('No session was created.\n');
      return null;
    }

    const grantedAt = isoNow();
    const startedAt = isoNow();
    const state = {
      sessionId: 'local-human-session-' + crypto.randomBytes(8).toString('hex'),
      participantRef: Human.sha256(crypto.randomBytes(32)),
      grantedAt,
      startedAt
    };
    const observations = [];
    for (const trial of exact.packet.trials) {
      process.stderr.write('\n[' + trial.order + '/' + exact.packet.trials.length + '] ' + trial.prompt + '\n');
      const started = performance.now();
      const decision = await choose(rl, 'C=continue, H=hold, U=unsure, W=withdraw: ', {
        C: 'CONTINUE', H: 'HOLD', U: 'UNSURE', W: 'WITHDRAW'
      });
      if (decision === 'WITHDRAW') {
        const receipt = withdrawalReceipt(protocol, state, isoNow());
        console.log(JSON.stringify(receipt, null, 2));
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
      const receipt = withdrawalReceipt(protocol, state, isoNow());
      console.log(JSON.stringify(receipt, null, 2));
      process.stderr.write('Withdrawn. No participant reference or observations were retained in the receipt.\n');
      return receipt;
    }

    const completionConfirmedAt = isoNow();
    const completedAt = isoNow();
    const session = Human.buildSession(protocol, {
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
    console.log(JSON.stringify(session, null, 2));
    process.stderr.write('Session receipt emitted to standard output. It is not yet a human-benefit verdict.\n');
    return session;
  } finally {
    rl.close();
  }
}

if (require.main === module) {
  runInteractive().catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}

module.exports = { runInteractive };
