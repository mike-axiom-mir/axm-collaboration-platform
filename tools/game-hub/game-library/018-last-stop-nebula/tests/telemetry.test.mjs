import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewGame } from '../runtime/game-core.mjs';
import {
  MAX_LEDGER_RUNS,
  createRunSummary,
  gradeRun,
  addRunToLedger,
  normalizeLedger,
  aggregateRunHistory,
  aggregateReviewCurve,
  createBalanceReport,
  BALANCE_REPORT_SCHEMA
} from '../runtime/run-telemetry.mjs';

function completedRun(seed, overrides = {}) {
  const state = createNewGame(overrides.mode || 'standard', seed);
  state.elapsed = (overrides.survivedDays || state.totalDays) * state.dayLength;
  state.day = overrides.survivedDays || state.totalDays;
  state.ended = true;
  state.outcome = overrides.outcome || 'retired';
  state.badReviews = overrides.badReviews ?? 420;
  state.credits = overrides.credits ?? 4800;
  state.debt = overrides.debt ?? 0;
  state.upgrades = Array.from({ length: overrides.upgrades ?? 8 }, (_, index) => `upgrade-${index}`);
  state.stats.served = overrides.served ?? 260;
  state.stats.lost = overrides.lost ?? 20;
  state.stats.manual = overrides.manual ?? 90;
  state.stats.automated = state.stats.served - state.stats.manual;
  state.stats.earned = 11000;
  state.telemetry = [
    { day: 1, badReviews: 64, served: 0, lost: 0 },
    { day: state.day, badReviews: state.badReviews, served: state.stats.served, lost: state.stats.lost }
  ];
  return state;
}

test('run summary exposes the metrics needed for retirement-timer calibration', () => {
  const state = completedRun(101);
  const summary = createRunSummary(state, 7200, Date.UTC(2026, 6, 28));
  assert.equal(summary.runId, state.runId);
  assert.equal(summary.outcome, 'retired');
  assert.equal(summary.reviewsGained, 356);
  assert.equal(summary.reviewVelocity, 17);
  assert.equal(summary.captureRate, 92.9);
  assert.equal(summary.automatedShare, 65.4);
  assert.equal(summary.curve.length, 2);
  assert.match(summary.grade.label, /ESCAPE|LEGEND|PANIC|RETIRED/);
});

test('failed runs receive a failure grade while strong retirements can earn A or S', () => {
  const failed = createRunSummary(completedRun(102, { outcome: 'reviews', survivedDays: 10, badReviews: 1000, lost: 220 }), 0);
  assert.equal(gradeRun(failed).id, 'f');
  const strong = createRunSummary(completedRun(103, { badReviews: 180, lost: 2, upgrades: 10, credits: 8500 }), 9000);
  assert.ok(['s', 'a'].includes(gradeRun(strong).id));
});

test('ledger is deduplicated by run id and capped at the newest 24 summaries', () => {
  let ledger = null;
  for (let index = 0; index < MAX_LEDGER_RUNS + 5; index += 1) {
    const state = completedRun(200 + index);
    ledger = addRunToLedger(ledger, createRunSummary(state, 5000 + index, Date.UTC(2026, 6, index + 1)));
  }
  assert.equal(ledger.runs.length, MAX_LEDGER_RUNS);
  const newest = ledger.runs[0];
  ledger = addRunToLedger(ledger, { ...newest, score: 9999 });
  assert.equal(ledger.runs.length, MAX_LEDGER_RUNS);
  assert.equal(ledger.runs[0].score, 9999);
  assert.equal(normalizeLedger({ nonsense: true }).runs.length, 0);
});

test('balance estimate waits for three runs and remains informational', () => {
  let ledger = addRunToLedger(null, createRunSummary(completedRun(301, { badReviews: 500 }), 7000));
  let history = aggregateRunHistory(ledger, 'standard');
  assert.equal(history.calibrationReady, false);
  assert.equal(history.runsNeeded, 2);
  ledger = addRunToLedger(ledger, createRunSummary(completedRun(302, { badReviews: 620 }), 6500));
  ledger = addRunToLedger(ledger, createRunSummary(completedRun(303, { outcome: 'reviews', survivedDays: 18, badReviews: 1000 }), 0));
  history = aggregateRunHistory(ledger, 'standard');
  assert.equal(history.calibrationReady, true);
  assert.ok(history.projectedCollapseDay > 1);
  assert.ok(history.suggestedStandardDays >= 14 && history.suggestedStandardDays <= 30);
  assert.equal(history.totalRuns, 3);
});

test('contract calibration never mixes quick, standard, and legend runs', () => {
  let ledger = addRunToLedger(null, createRunSummary(completedRun(401, { mode: 'quick', badReviews: 240 }), 5100));
  ledger = addRunToLedger(ledger, createRunSummary(completedRun(402, { mode: 'standard', badReviews: 520 }), 7100));
  ledger = addRunToLedger(ledger, createRunSummary(completedRun(403, { mode: 'legend', badReviews: 880 }), 9300));
  const all = aggregateRunHistory(ledger, 'all');
  const standard = aggregateRunHistory(ledger, 'standard');
  assert.equal(all.totalRuns, 3);
  assert.equal(all.calibrationReady, false);
  assert.equal(all.suggestedContractDays, null);
  assert.equal(standard.totalRuns, 1);
  assert.equal(standard.runsNeeded, 2);
  assert.equal(standard.byModeCounts.quick, 1);
  assert.equal(standard.byModeCounts.legend, 1);
});

test('review curve carries revoked runs at 1,000 to avoid survivor bias', () => {
  let ledger = addRunToLedger(null, createRunSummary(completedRun(501, { badReviews: 484 }), 7000));
  ledger = addRunToLedger(ledger, createRunSummary(completedRun(502, { outcome: 'reviews', survivedDays: 10, badReviews: 1000 }), 0));
  const series = aggregateReviewCurve(ledger, 'standard');
  assert.equal(series.runCount, 2);
  assert.equal(series.maxDay, 21);
  assert.equal(series.curve[0].sampleSize, 2);
  assert.equal(series.curve.find(point => point.day === 10).sampleSize, 2);
  assert.equal(series.curve.find(point => point.day === 11).sampleSize, 2);
  assert.ok(series.curve.find(point => point.day === 11).averageReviews > 500);
  assert.equal(series.curve.at(-1).day, 21);
});

test('anonymous balance report is portable and omits run identity and exact timestamps', () => {
  let ledger = addRunToLedger(null, createRunSummary(completedRun(601), 7200, Date.UTC(2026, 6, 28)));
  ledger = addRunToLedger(ledger, createRunSummary(completedRun(602, { mode: 'quick' }), 5200, Date.UTC(2026, 6, 27)));
  const report = createBalanceReport(ledger, Date.UTC(2026, 6, 29));
  const serialized = JSON.stringify(report);
  assert.equal(report.schema, BALANCE_REPORT_SCHEMA);
  assert.equal(report.totalRuns, 2);
  assert.equal(report.byMode.standard.runs, 1);
  assert.equal(report.byMode.quick.runs, 1);
  assert.doesNotMatch(serialized, /runId|endedAt|qa-ledger|standard-601/);
  assert.match(report.privacy, /No player identity/);
});
