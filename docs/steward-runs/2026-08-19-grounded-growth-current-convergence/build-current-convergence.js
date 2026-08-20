#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Current = require('../../../shared/grounded-growth-current-state/grounded-growth-current-state');
const ParticipationCurrent = require('../2026-08-19-grounded-growth-participation-frontier/build-current-participation-frontier');
const EvolutionCurrent = require('../2026-08-19-verification-evolution-grounded-growth/build-verification-evolution-growth');

const GENERATED_AT = '2026-08-19T20:45:00.000Z';

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8'));
}

function currentInput() {
  return {
    receiptId: 'current-grounded-growth-convergence-20260819',
    generatedAt: GENERATED_AT,
    participationFrontierReceipt: ParticipationCurrent.current(),
    participationFrontierInput: ParticipationCurrent.currentInput(),
    latestPortfolio: EvolutionCurrent.build().portfolio
  };
}

function build() {
  const input = currentInput();
  const receipt = Current.build(input);
  const summary = {
    schema: 'axm.grounded-growth-current-convergence-summary/v1',
    generatedAt: receipt.generatedAt,
    currentStateRef: {
      id: receipt.receiptId,
      schema: receipt.schema,
      sha256: receipt.receiptDigest
    },
    state: receipt.state,
    portfolioEvolution: receipt.portfolioEvolution,
    participation: receipt.participationBinding,
    evidence: receipt.currentEvidence,
    decision: receipt.decision,
    truth: {
      currentTechnicalAndHumanReadinessVisibleTogether: true,
      historicalOutcomeRewritten: false,
      humanBenefitEstablished: receipt.currentEvidence.humanPass > 0,
      reviewStarted: false,
      sharedGrowthClaimed: receipt.truth.sharedGrowthClaimed,
      automaticAction: false,
      automaticCanon: false
    },
    summaryDigest: null
  };
  const payload = JSON.parse(JSON.stringify(summary));
  delete payload.summaryDigest;
  summary.summaryDigest = Current.sha256(payload);
  return { receipt, summary };
}

function verifyRecorded() {
  const built = build();
  const recorded = {
    receipt: readJson('CURRENT_STATE_RECEIPT.json'),
    summary: readJson('CURRENT_SUMMARY.json')
  };
  assert.ok(Current.verify(recorded.receipt, currentInput()).pass, 'recorded current-state receipt does not verify');
  assert.deepStrictEqual(recorded, built, 'recorded convergence artifacts differ from exact rebuild');
  return built;
}

function write() {
  const result = build();
  fs.writeFileSync(path.join(__dirname, 'CURRENT_STATE_RECEIPT.json'), JSON.stringify(result.receipt, null, 2) + '\n');
  fs.writeFileSync(path.join(__dirname, 'CURRENT_SUMMARY.json'), JSON.stringify(result.summary, null, 2) + '\n');
  return result;
}

if (require.main === module) {
  try {
    const result = process.argv.includes('--write') ? write() : process.argv.includes('--check-recorded') ? verifyRecorded() : build();
    process.stdout.write(JSON.stringify({
      state: result.receipt.state,
      outcomes: result.receipt.currentEvidence.outcomes,
      aiWorkflowPass: result.receipt.currentEvidence.aiWorkflowPass,
      humanPass: result.receipt.currentEvidence.humanPass,
      reviewCandidates: result.receipt.decision.reviewableActionCount,
      digest: result.receipt.receiptDigest
    }, null, 2) + '\n');
  } catch (error) {
    process.stderr.write((error.stack || error.message) + '\n');
    process.exitCode = 1;
  }
}

module.exports = { GENERATED_AT, currentInput, build, verifyRecorded, write };
