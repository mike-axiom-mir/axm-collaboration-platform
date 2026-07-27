'use strict';

const fs = require('fs');
const path = require('path');
const C = require('../core');
const Envelope = require('../receipt-envelope');
const Registry = require('../registry.json');
const ROOT = path.resolve(__dirname, '..', '..', '..');
const REPORT_PATH = path.join(ROOT, 'exports', 'sensorium-conformance-report.json');

async function run(options) {
  options = options || {};
  const rows = [];
  for (const route of Registry.senses || []) {
    const modulePath = path.resolve(ROOT, 'shared', 'sensorium', route.module);
    const runtime = require(modulePath);
    if (runtime.CAPABILITY && runtime.CAPABILITY !== route.capability) throw new Error(route.id + ' capability mismatch');
    if (route.factory && typeof runtime[route.factory] !== 'function') throw new Error(route.id + ' missing factory ' + route.factory);
    if (!route.factory && typeof runtime[route.operation] !== 'function') throw new Error(route.id + ' missing host operation ' + route.operation);
    const proofModule = require(path.join(ROOT, 'shared', 'sensorium', 'proofs', route.id + '.js'));
    const proof = await proofModule.run();
    if (proof.verdict !== 'PASS') throw new Error(route.id + ' proof failed');
    if (!Array.isArray(proof.uses) || proof.uses.length < 2 || proof.uses[0] !== 0 || proof.uses[1] !== 0) throw new Error(route.id + ' does not prove two-use flat retention');
    if (proof.rawRetainedBytes !== 0 || proof.rawRetainedItems !== 0) throw new Error(route.id + ' retained raw material');
    (proof.envelopes || []).forEach(function (envelope) { const checked = Envelope.validate(envelope); if (!checked.ok) throw new Error(route.id + ' invalid envelope: ' + checked.errors.join('; ')); });
    if (!Array.isArray(proof.negative) || !proof.negative.length) throw new Error(route.id + ' has no negative ceiling proof');
    rows.push({ senseId: route.id, capability: route.capability, executorStatus: route.executorStatus, adapterStatus: route.adapterStatus, proofStatus: route.proofStatus, verdict: 'PASS', uses: proof.uses, rawRetainedBytes: 0, rawRetainedItems: 0, envelopeCount: (proof.envelopes || []).length, negativeCases: proof.negative.length, evidenceDigest: C.digest({ positive: proof.positive, negative: proof.negative, envelopes: proof.envelopes }) });
  }
  const missingAdapters = (Registry.senses || []).filter(function (route) { return route.adapterStatus === 'MISSING_ADAPTER'; }).map(function (route) { return route.id; });
  const report = {
    schema: 'axm.sensorium-conformance-report/v3', version: Registry.version, generatedAt: options.at || new Date().toISOString(),
    claim: 'Every canonical TEST sense resolves honestly at its declared proof level, proves positive and negative behavior, emits valid envelopes, and has zero raw retention after two uses.',
    verdict: rows.length === 13 && rows.every(function (row) { return row.verdict === 'PASS'; }) ? 'VERIFIED' : 'FAILED',
    coverage: {
      skillsDeclared: Registry.counts.skills,
      executableRoutesDeclared: Registry.counts.executableRoutes,
      hostMediatedRoutesDeclared: Registry.counts.hostMediatedRoutes,
      runtimePassProofs: rows.filter(function (row) { return row.proofStatus === 'RUNTIME_PASS'; }).length,
      contractPassProofs: rows.filter(function (row) { return row.proofStatus === 'CONTRACT_PASS'; }).length,
      missingExecutors: [],
      missingAdapters,
      negativeProofs: rows.reduce(function (sum, row) { return sum + row.negativeCases; }, 0)
    },
    rows, temporaryMaterial: { rawRetainedBytes: 0, rawRetainedItems: 0, reportContainsOnlyDigestsAndCounters: true }, namedHolds: ['WINDOWS_WINDOW_ISOLATION_UNAVAILABLE','SEAT_CAPACITY_ADAPTER_UNAVAILABLE']
  };
  if (options.writeReport === true) { fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true }); fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2) + '\n', 'utf8'); }
  return report;
}
if (require.main === module) {
  run({ writeReport: true }).then(function (report) { console.log('Sensorium conformance runner: ' + report.verdict + ' - ' + report.rows.length + '/13 senses, ' + report.coverage.negativeProofs + ' negative cases'); }).catch(function (error) { console.error(error.stack || error.message); process.exitCode = 1; });
}

module.exports = { REPORT_PATH, run };
