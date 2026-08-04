export const RUN_LEDGER_SCHEMA = 'last-stop-nebula-run-ledger/v1';
export const RUN_SUMMARY_SCHEMA = 'last-stop-nebula-run-summary/v1';
export const BALANCE_REPORT_SCHEMA = 'last-stop-nebula-balance-report/v1';
export const MAX_LEDGER_RUNS = 24;
const VALID_MODES = new Set(['quick', 'standard', 'legend']);

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const round = (value, places = 1) => {
  const scale = 10 ** places;
  return Math.round(finite(value) * scale) / scale;
};
const average = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

export function gradeRun(summary) {
  if (!summary || summary.outcome !== 'retired') {
    if (summary?.survivalPercent >= 80 || summary?.captureRate >= 82) return { id: 'd', label: 'ALMOST OUT', color: 'red' };
    return { id: 'f', label: 'LICENSE LOST', color: 'red' };
  }
  let points = 0;
  if (summary.finalReviews < 300) points += 3;
  else if (summary.finalReviews < 600) points += 2;
  else if (summary.finalReviews < 820) points += 1;
  if (summary.captureRate >= 92) points += 3;
  else if (summary.captureRate >= 82) points += 2;
  else if (summary.captureRate >= 70) points += 1;
  if (summary.debtRemaining === 0) points += 2;
  if (summary.upgradesBuilt >= 9) points += 1;
  if (summary.score >= 7000) points += 1;
  if (points >= 9) return { id: 's', label: 'NEBULA LEGEND', color: 'teal' };
  if (points >= 7) return { id: 'a', label: 'CLEAN ESCAPE', color: 'teal' };
  if (points >= 5) return { id: 'b', label: 'PROFITABLE PANIC', color: 'amber' };
  return { id: 'c', label: 'BARELY RETIRED', color: 'amber' };
}

export function createRunSummary(state, score = 0, endedAt = Date.now()) {
  if (!state || typeof state !== 'object') return null;
  const totalDays = Math.max(1, finite(state.totalDays, 21));
  const elapsedDays = clamp(finite(state.elapsed) / Math.max(.1, finite(state.dayLength, 24)), 0, totalDays);
  const survivedDays = state.outcome === 'retired' ? totalDays : Math.max(1, Math.ceil(elapsedDays));
  const served = Math.max(0, finite(state.stats?.served));
  const lost = Math.max(0, finite(state.stats?.lost));
  const opportunities = served + lost;
  const initialReviews = finite(state.initialBadReviews, finite(state.telemetry?.[0]?.badReviews, 64));
  const finalReviews = clamp(finite(state.badReviews), 0, 1000);
  const summary = {
    schema: RUN_SUMMARY_SCHEMA,
    runId: String(state.runId || `${state.mode || 'standard'}-${state.seed || endedAt}`),
    endedAt: new Date(endedAt).toISOString(),
    mode: String(state.mode || 'standard'),
    outcome: state.outcome === 'retired' ? 'retired' : 'reviews',
    contractDays: totalDays,
    survivedDays,
    survivalPercent: round(survivedDays / totalDays * 100),
    score: Math.max(0, Math.round(finite(score))),
    finalReviews: Math.round(finalReviews),
    reviewsGained: Math.max(0, Math.round(finalReviews - initialReviews)),
    reviewVelocity: round(Math.max(0, finalReviews - initialReviews) / Math.max(1, elapsedDays)),
    served: Math.round(served),
    lost: Math.round(lost),
    captureRate: round(opportunities ? served / opportunities * 100 : 100),
    manualShare: round(served ? finite(state.stats?.manual) / served * 100 : 0),
    automatedShare: round(served ? finite(state.stats?.automated) / served * 100 : 0),
    earned: Math.round(Math.max(0, finite(state.stats?.earned))),
    cash: Math.round(Math.max(0, finite(state.credits))),
    debtRemaining: Math.round(Math.max(0, finite(state.debt))),
    upgradesBuilt: Array.isArray(state.upgrades) ? state.upgrades.length : 0,
    peakQueue: Math.round(Math.max(0, finite(state.stats?.peakQueue))),
    fuelLeaked: round(Math.max(0, finite(state.stats?.fuelLeaked))),
    choiceCount: Array.isArray(state.stats?.choices) ? state.stats.choices.length : 0,
    curve: Array.isArray(state.telemetry) ? state.telemetry.slice(-40).map(point => ({
      day: Math.max(1, Math.round(finite(point.day, 1))),
      reviews: Math.round(clamp(finite(point.badReviews), 0, 1000)),
      served: Math.round(Math.max(0, finite(point.served))),
      lost: Math.round(Math.max(0, finite(point.lost)))
    })) : []
  };
  summary.grade = gradeRun(summary);
  return summary;
}

export function normalizeRunSummary(value) {
  if (!value || value.schema !== RUN_SUMMARY_SCHEMA || !value.runId) return null;
  const summary = {
    ...value,
    mode: ['quick','standard','legend'].includes(value.mode) ? value.mode : 'standard',
    outcome: value.outcome === 'retired' ? 'retired' : 'reviews',
    contractDays: clamp(Math.round(finite(value.contractDays, 21)), 1, 60),
    survivedDays: clamp(Math.round(finite(value.survivedDays, 1)), 1, 60),
    score: Math.max(0, Math.round(finite(value.score))),
    finalReviews: clamp(Math.round(finite(value.finalReviews)), 0, 1000),
    reviewVelocity: clamp(round(value.reviewVelocity), 0, 1000),
    captureRate: clamp(round(value.captureRate), 0, 100),
    automatedShare: clamp(round(value.automatedShare), 0, 100),
    debtRemaining: Math.max(0, Math.round(finite(value.debtRemaining))),
    upgradesBuilt: clamp(Math.round(finite(value.upgradesBuilt)), 0, 12),
    curve: Array.isArray(value.curve) ? value.curve.slice(-40) : []
  };
  summary.grade = gradeRun(summary);
  return summary;
}

export function normalizeLedger(value) {
  const source = Array.isArray(value) ? value : value?.schema === RUN_LEDGER_SCHEMA && Array.isArray(value.runs) ? value.runs : [];
  const unique = new Map();
  source.forEach(record => {
    const normalized = normalizeRunSummary(record);
    if (normalized) unique.set(normalized.runId, normalized);
  });
  const runs = [...unique.values()]
    .sort((a, b) => String(b.endedAt).localeCompare(String(a.endedAt)))
    .slice(0, MAX_LEDGER_RUNS);
  return { schema: RUN_LEDGER_SCHEMA, runs };
}

export function addRunToLedger(ledger, summary) {
  const current = normalizeLedger(ledger);
  const normalized = normalizeRunSummary(summary);
  if (!normalized) return current;
  return normalizeLedger({ schema: RUN_LEDGER_SCHEMA, runs: [normalized, ...current.runs.filter(run => run.runId !== normalized.runId)] });
}

function modeFilter(value) {
  return VALID_MODES.has(value) ? value : 'all';
}

function runsForMode(ledger, mode) {
  const selectedMode = modeFilter(mode);
  return selectedMode === 'all' ? ledger.runs : ledger.runs.filter(run => run.mode === selectedMode);
}

function reviewAtDay(run, day) {
  if (day >= run.survivedDays) return run.finalReviews;
  const points = new Map();
  points.set(1, 64);
  (Array.isArray(run.curve) ? run.curve : []).forEach(point => {
    const pointDay = clamp(Math.round(finite(point?.day, 1)), 1, run.survivedDays);
    points.set(pointDay, clamp(finite(point?.reviews, 64), 0, 1000));
  });
  points.set(run.survivedDays, run.finalReviews);
  const ordered = [...points.entries()].map(([pointDay, reviews]) => ({ day: pointDay, reviews })).sort((a, b) => a.day - b.day);
  const exact = ordered.find(point => point.day === day);
  if (exact) return exact.reviews;
  const before = [...ordered].reverse().find(point => point.day < day) || ordered[0];
  const after = ordered.find(point => point.day > day) || ordered.at(-1);
  if (!before || !after || before.day === after.day) return finite(before?.reviews, 64);
  const progress = (day - before.day) / (after.day - before.day);
  return before.reviews + (after.reviews - before.reviews) * progress;
}

export function aggregateReviewCurve(value, mode = 'all') {
  const ledger = normalizeLedger(value);
  const selectedMode = modeFilter(mode);
  const runs = runsForMode(ledger, selectedMode);
  const maxDay = Math.max(0, ...runs.map(run => run.contractDays));
  const curve = [];
  for (let day = 1; day <= maxDay; day += 1) {
    const eligible = runs.filter(run => run.contractDays >= day);
    if (!eligible.length) continue;
    curve.push({
      day,
      averageReviews: Math.round(average(eligible.map(run => reviewAtDay(run, day)))),
      sampleSize: eligible.length
    });
  }
  return { mode: selectedMode, runCount: runs.length, maxDay, curve };
}

export function aggregateRunHistory(value, mode = 'all') {
  const ledger = normalizeLedger(value);
  const selectedMode = modeFilter(mode);
  const runs = runsForMode(ledger, selectedMode);
  const retired = runs.filter(run => run.outcome === 'retired');
  const velocities = runs.map(run => run.reviewVelocity).filter(value => Number.isFinite(value) && value >= 0);
  const averageVelocity = average(velocities);
  const projectedCollapseDay = averageVelocity > 0 ? 1 + (1000 - 64) / averageVelocity : null;
  const calibrationReady = selectedMode !== 'all' && runs.length >= 3;
  const suggestedContractDays = calibrationReady && projectedCollapseDay ? clamp(Math.round(projectedCollapseDay * .72), 14, 30) : null;
  return {
    mode: selectedMode,
    totalLedgerRuns: ledger.runs.length,
    totalRuns: runs.length,
    retirements: retired.length,
    retireRate: round(runs.length ? retired.length / runs.length * 100 : 0),
    averageFinalReviews: Math.round(average(runs.map(run => run.finalReviews))),
    averageReviewVelocity: round(averageVelocity),
    averageCaptureRate: round(average(runs.map(run => run.captureRate))),
    averageScore: Math.round(average(retired.map(run => run.score))),
    averageStopDay: round(average(runs.map(run => run.survivedDays))),
    projectedCollapseDay: projectedCollapseDay ? round(projectedCollapseDay) : null,
    calibrationReady,
    runsNeeded: selectedMode === 'all' ? 0 : Math.max(0, 3 - runs.length),
    confidence: runs.length >= 8 ? 'high' : runs.length >= 5 ? 'medium' : runs.length >= 3 ? 'early' : 'insufficient',
    suggestedContractDays,
    suggestedStandardDays: selectedMode === 'standard' ? suggestedContractDays : null,
    byModeCounts: {
      quick: ledger.runs.filter(run => run.mode === 'quick').length,
      standard: ledger.runs.filter(run => run.mode === 'standard').length,
      legend: ledger.runs.filter(run => run.mode === 'legend').length
    },
    recent: runs.slice(0, 8)
  };
}

export function createBalanceReport(value, createdAt = Date.now()) {
  const ledger = normalizeLedger(value);
  const byMode = Object.fromEntries(['quick', 'standard', 'legend'].map(mode => {
    const history = aggregateRunHistory(ledger, mode);
    return [mode, {
      runs: history.totalRuns,
      retireRate: history.retireRate,
      averageFinalReviews: history.averageFinalReviews,
      averageReviewVelocity: history.averageReviewVelocity,
      averageCaptureRate: history.averageCaptureRate,
      projectedCollapseDay: history.projectedCollapseDay,
      suggestedContractDays: history.suggestedContractDays,
      confidence: history.confidence
    }];
  }));
  return {
    schema: BALANCE_REPORT_SCHEMA,
    createdAt: new Date(createdAt).toISOString(),
    game: 'LAST STOP: NEBULA',
    privacy: 'No player identity, save state, exact run timestamp, or device information is included.',
    retention: `Newest ${MAX_LEDGER_RUNS} local run summaries`,
    totalRuns: ledger.runs.length,
    byMode,
    runs: ledger.runs.map((run, index) => ({
      sample: index + 1,
      mode: run.mode,
      outcome: run.outcome,
      contractDays: run.contractDays,
      survivedDays: run.survivedDays,
      score: run.score,
      finalReviews: run.finalReviews,
      reviewVelocity: run.reviewVelocity,
      captureRate: run.captureRate,
      automatedShare: run.automatedShare,
      debtRemaining: run.debtRemaining,
      upgradesBuilt: run.upgradesBuilt,
      curve: run.curve.map(point => ({ day: point.day, reviews: point.reviews }))
    }))
  };
}
