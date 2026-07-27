'use strict';

const fs = require('fs');
const path = require('path');
const Feed = require('../technical-glasses-feed');
const Registry = require('../registry.json');
const Matrix = require('../capability-matrix.json');
const Adapters = require('../canonical/adapters.json');
const Conformance = require('./conformance-runner');
const OUT = path.resolve(__dirname, '..', 'lab-state.json');

async function build(options) {
  options = options || {};
  const report = options.report || (fs.existsSync(Conformance.REPORT_PATH) ? JSON.parse(fs.readFileSync(Conformance.REPORT_PATH, 'utf8')) : await Conformance.run({ at: options.at }));
  const feed = Feed.compile({ registry: Registry, receipts: options.receipts || [], at: options.at });
  const proofs = {};
  (report.rows || []).forEach(function (row) { proofs[row.senseId] = row; });
  const knownHolds = (report.namedHolds || []).slice();
  const senses = feed.rows.map(function (row) {
    const canonicalHolds = knownHolds.filter(function (hold) { return (row.constraints || []).includes(hold); });
    const holds = Array.from(new Set((row.holds || []).concat(canonicalHolds)));
    return Object.assign({}, row, { holds, proof: proofs[row.senseId] || null, lease: { scope: null, expiresAt: null, status: 'NO_LEASE' }, cheapestAlternative: (Matrix.rows.find(function (entry) { return entry.senseId === row.senseId; }) || {}).cheapestAlternative || 'Keep the claim UNKNOWN.', journeyTrace: [] });
  });
  return {
    schema: 'axm.sensorium-lab-state/v1', generatedAt: options.at || report.generatedAt || new Date().toISOString(), sourceDigest: Registry.sourceDigest,
    summary: Object.assign({}, feed.counts, { holds: senses.reduce(function (sum, row) { return sum + row.holds.length; }, 0) }), senses,
    adapters: Adapters.adapters.map(function (adapter) { return { adapterId: adapter.adapterId, capabilities: adapter.capabilities, constraints: adapter.constraints, resourceBudget: adapter.resourceBudget, authorityRequired: adapter.authorityRequired, targetIsolation: adapter.targetIsolation }; }),
    knownHolds, conformance: { verdict: report.verdict, generatedAt: report.generatedAt, negativeProofs: report.coverage && report.coverage.negativeProofs },
    syntheticControls: true, canonicalSource: false, automaticAction: false, authorityRestoredOnRefresh: false
  };
}
async function write(options) { const state = await build(options); fs.writeFileSync(OUT, JSON.stringify(state, null, 2) + '\n', 'utf8'); return state; }
if (require.main === module) write().then(function (state) { console.log('Sensorium Lab state: PASS - ' + state.senses.length + ' senses'); }).catch(function (error) { console.error(error.stack || error.message); process.exitCode = 1; });

module.exports = { OUT, build, write };
