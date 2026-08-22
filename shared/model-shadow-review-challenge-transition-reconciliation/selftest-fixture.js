'use strict';

const fs = require('fs');
const path = require('path');
const Reconciliation = require('./model-shadow-review-challenge-transition-reconciliation');
const TransitionLedger = require('../model-shadow-review-challenge-transition-ledger/model-shadow-review-challenge-transition-ledger');
const TransitionGate = require('../model-shadow-review-challenge-transition-gate/model-shadow-review-challenge-transition-gate');
const TransitionFixture = require('../model-shadow-review-challenge-transition-gate/selftest-fixture');
const Continuity = require('../model-shadow-review-challenge-continuity/model-shadow-review-challenge-continuity');
const ChallengeLedger = require('../model-shadow-review-challenge-ledger/model-shadow-review-challenge-ledger');
const ChallengeFixture = require('../model-shadow-review-challenge-ledger/selftest-fixture');

function copy(value) {
  return JSON.parse(JSON.stringify(value));
}

function separatedRef(chain) {
  return {
    id: chain.separationReceipt.receiptId,
    schema: chain.separationReceipt.schema,
    sha256: chain.separationReceipt.receiptDigest
  };
}

function snapshot(root, ledgerId, tag, observedAt) {
  return Continuity.captureState({ stateRoot: root, ledgerId, observationId: 'observation:reconciliation-' + tag, observedAt });
}

function checkpoint(currentSnapshot, checkpointId, anchoredAt) {
  return Continuity.buildCheckpoint({ checkpointId, anchoredAt, currentSnapshot });
}

function advanceInput(entryId, recordedAt, transitionInput) {
  return {
    entryId,
    recordedAt,
    confirmation: TransitionLedger.CONFIRMATION,
    transitionInput: copy(transitionInput),
    transitionReceipt: TransitionGate.buildTransition(transitionInput)
  };
}

function entryRef(entry) {
  return { id: entry.entryId, schema: entry.schema, sha256: entry.entryDigest };
}

function item(advance, entry) {
  return { advanceInput: copy(advance), entry: copy(entry) };
}

function presentationInput(tag, manifest, items, presentedAt) {
  return {
    presentationId: 'presentation:reconciliation-' + tag,
    presentedAt: presentedAt || '2026-08-20T14:50:00.000Z',
    manifest: copy(manifest),
    items: copy(items)
  };
}

function reconciliationInput(leftInput, leftPresentation, rightInput, rightPresentation, tag, reconciledAt) {
  return {
    reconciliationId: 'reconciliation:' + tag,
    reconciledAt: reconciledAt || '2026-08-20T14:55:00.000Z',
    leftPresentationInput: copy(leftInput),
    leftPresentation: copy(leftPresentation),
    rightPresentationInput: copy(rightInput),
    rightPresentation: copy(rightPresentation)
  };
}

function buildFixture(tempRoot) {
  const roots = {};
  ['base', 'a', 'b', 'c', 'd'].forEach(name => {
    roots[name] = path.join(tempRoot, 'challenge-' + name);
    fs.mkdirSync(roots[name]);
  });
  const challengeLedgerId = 'ledger:transition-reconciliation-selftest';
  const requests = {
    base: ChallengeFixture.buildRequest('reconciliation-base'),
    a: ChallengeFixture.buildRequest('reconciliation-a'),
    b: ChallengeFixture.buildRequest('reconciliation-b'),
    c: ChallengeFixture.buildRequest('reconciliation-c'),
    d: ChallengeFixture.buildRequest('reconciliation-d')
  };
  ChallengeLedger.createService({ stateRoot: roots.base, ledgerId: challengeLedgerId }).consume(copy(requests.base));
  const serviceA = ChallengeLedger.createService({ stateRoot: roots.a, ledgerId: challengeLedgerId });
  serviceA.consume(copy(requests.base)); serviceA.consume(copy(requests.a));
  const serviceB = ChallengeLedger.createService({ stateRoot: roots.b, ledgerId: challengeLedgerId });
  serviceB.consume(copy(requests.base)); serviceB.consume(copy(requests.b));
  const serviceC = ChallengeLedger.createService({ stateRoot: roots.c, ledgerId: challengeLedgerId });
  serviceC.consume(copy(requests.base)); serviceC.consume(copy(requests.a)); serviceC.consume(copy(requests.c));
  const serviceD = ChallengeLedger.createService({ stateRoot: roots.d, ledgerId: challengeLedgerId });
  serviceD.consume(copy(requests.base)); serviceD.consume(copy(requests.a)); serviceD.consume(copy(requests.d));

  const checkpoints = {
    base: checkpoint(snapshot(roots.base, challengeLedgerId, 'base', '2026-08-20T14:07:00.000Z'), 'checkpoint:reconciliation-base', '2026-08-20T14:07:30.000Z'),
    a: checkpoint(snapshot(roots.a, challengeLedgerId, 'a', '2026-08-20T14:12:00.000Z'), 'checkpoint:reconciliation-a', '2026-08-20T14:12:30.000Z'),
    b: checkpoint(snapshot(roots.b, challengeLedgerId, 'b', '2026-08-20T14:13:00.000Z'), 'checkpoint:reconciliation-b', '2026-08-20T14:13:30.000Z'),
    c: checkpoint(snapshot(roots.c, challengeLedgerId, 'c', '2026-08-20T14:17:00.000Z'), 'checkpoint:reconciliation-c', '2026-08-20T14:17:30.000Z'),
    d: checkpoint(snapshot(roots.d, challengeLedgerId, 'd', '2026-08-20T14:18:00.000Z'), 'checkpoint:reconciliation-d', '2026-08-20T14:18:30.000Z')
  };
  const authority = TransitionFixture.createAuthority('reconciliation-stable');
  const chains = {
    base: TransitionFixture.buildSeparatedChain(checkpoints.base, 'reconciliation-base', authority, { minute: 8 }),
    a: TransitionFixture.buildSeparatedChain(checkpoints.a, 'reconciliation-a', authority, { minute: 13 }),
    b: TransitionFixture.buildSeparatedChain(checkpoints.b, 'reconciliation-b', authority, { minute: 14 }),
    c: TransitionFixture.buildSeparatedChain(checkpoints.c, 'reconciliation-c', authority, { minute: 18 }),
    d: TransitionFixture.buildSeparatedChain(checkpoints.d, 'reconciliation-d', authority, { minute: 19 })
  };
  const transitionInputs = {
    a: TransitionFixture.transitionInput(chains.base, chains.a, 'reconciliation-base-to-a'),
    b: TransitionFixture.transitionInput(chains.base, chains.b, 'reconciliation-base-to-b'),
    c: TransitionFixture.transitionInput(chains.a, chains.c, 'reconciliation-a-to-c'),
    d: TransitionFixture.transitionInput(chains.a, chains.d, 'reconciliation-a-to-d')
  };
  const advances = {
    a: advanceInput('entry:reconciliation-a', '2026-08-20T14:41:00.000Z', transitionInputs.a),
    b: advanceInput('entry:reconciliation-b', '2026-08-20T14:41:30.000Z', transitionInputs.b),
    c: advanceInput('entry:reconciliation-c', '2026-08-20T14:42:00.000Z', transitionInputs.c),
    d: advanceInput('entry:reconciliation-d', '2026-08-20T14:42:30.000Z', transitionInputs.d)
  };
  const genesisRef = separatedRef(chains.base);
  const logId = 'transition-log:reconciliation-domain';
  const manifest = TransitionLedger.buildManifest(logId, genesisRef);
  const entries = {};
  entries.a = TransitionLedger.buildEntry(advances.a, { manifest, sequence: 1, previousEntryRef: null });
  entries.b = TransitionLedger.buildEntry(advances.b, { manifest, sequence: 1, previousEntryRef: null });
  entries.c = TransitionLedger.buildEntry(advances.c, { manifest, sequence: 2, previousEntryRef: entryRef(entries.a) });
  entries.d = TransitionLedger.buildEntry(advances.d, { manifest, sequence: 2, previousEntryRef: entryRef(entries.a) });

  advances.alternateA = copy(advances.a);
  advances.alternateA.entryId = 'entry:reconciliation-a-alternate-record';
  advances.alternateA.recordedAt = '2026-08-20T14:41:15.000Z';
  entries.alternateA = TransitionLedger.buildEntry(advances.alternateA, { manifest, sequence: 1, previousEntryRef: null });
  advances.equivocatingB = copy(advances.b);
  advances.equivocatingB.entryId = entries.a.entryId;
  entries.equivocatingB = TransitionLedger.buildEntry(advances.equivocatingB, { manifest, sequence: 1, previousEntryRef: null });

  const presentationInputs = {
    empty: presentationInput('empty', manifest, []),
    a: presentationInput('a', manifest, [item(advances.a, entries.a)]),
    aReplay: presentationInput('a-replay', manifest, [item(advances.a, entries.a)], '2026-08-20T14:51:00.000Z'),
    b: presentationInput('b', manifest, [item(advances.b, entries.b)]),
    ac: presentationInput('a-c', manifest, [item(advances.a, entries.a), item(advances.c, entries.c)]),
    ad: presentationInput('a-d', manifest, [item(advances.a, entries.a), item(advances.d, entries.d)]),
    alternateA: presentationInput('a-alternate-record', manifest, [item(advances.alternateA, entries.alternateA)]),
    equivocatingB: presentationInput('b-equivocating-entry-id', manifest, [item(advances.equivocatingB, entries.equivocatingB)])
  };
  const otherLogManifest = TransitionLedger.buildManifest('transition-log:other-domain', genesisRef);
  presentationInputs.otherLog = presentationInput('other-log', otherLogManifest, []);
  const otherGenesisManifest = TransitionLedger.buildManifest(logId, separatedRef(chains.b));
  presentationInputs.otherGenesis = presentationInput('other-genesis', otherGenesisManifest, []);

  const presentations = {};
  Object.entries(presentationInputs).forEach(([key, value]) => { presentations[key] = Reconciliation.buildPresentation(value); });
  return {
    roots,
    chains,
    advances,
    entries,
    manifest,
    genesisRef,
    logId,
    presentationInputs,
    presentations,
    reconciliationInput
  };
}

module.exports = { copy, separatedRef, presentationInput, reconciliationInput, buildFixture };

