'use strict';

const fs = require('fs');
const path = require('path');
const C = require('./core');
const PHASES = ['P0','P1','P2','P3','P4','P5','P6','P7','P8'];
const STATUS_PATH = path.join(__dirname, 'roadmap-status.json');
const RECEIPT_PATH = path.resolve(__dirname, '..', '..', 'exports', 'sensorium-roadmap-acceptance.json');

function compile(evidence, at) {
  evidence = evidence || {};
  const phases = PHASES.map(function (id) {
    const entry = evidence[id] || {};
    const checks = Array.isArray(entry.checks) ? entry.checks : [];
    return { id, name: entry.name || id, verdict: entry.verdict === 'PASS' && checks.length && checks.every(function (check) { return check.pass === true; }) ? 'PASS' : 'FAIL', checks, evidence: entry.evidence || [], holds: entry.holds || [] };
  });
  const complete = phases.every(function (phase) { return phase.verdict === 'PASS'; });
  return {
    schema: 'axm.sensorium-roadmap-status/v1', roadmapVersion: '0.2.0', implementationVersion: '1.4.0', verifiedAt: C.now(at),
    implementationStatus: complete ? 'IMPLEMENTED_AND_VERIFIED_IN_TEST' : 'INCOMPLETE', promotionStatus: 'AWAITING_MIKE_GATE', notCanon: true,
    phases, knownHolds: ['WINDOWS_WINDOW_ISOLATION_UNAVAILABLE','SEAT_CAPACITY_ADAPTER_UNAVAILABLE'], authorityInherited: false, rawRetainedBytes: 0, rawRetainedItems: 0,
    verdict: complete ? 'PASS' : 'FAIL', evidenceDigest: C.digest(phases)
  };
}
function write(receipt) {
  fs.mkdirSync(path.dirname(RECEIPT_PATH), { recursive: true });
  fs.writeFileSync(STATUS_PATH, JSON.stringify(receipt, null, 2) + '\n', 'utf8');
  fs.writeFileSync(RECEIPT_PATH, JSON.stringify(receipt, null, 2) + '\n', 'utf8');
}

module.exports = { PHASES, STATUS_PATH, RECEIPT_PATH, compile, write };
