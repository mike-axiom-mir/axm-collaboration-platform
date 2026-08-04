"use strict";
const { iso, deepFreeze, sha256 } = require("../common");
const DIMENSIONS = ["startup","readiness","liveness","degraded","progress","userOutcome"];
const STATES = new Set(["PASS","WARN","FAIL","UNKNOWN","NOT_APPLICABLE"]);
function normalizeDimension(name, input, observedAt) {
  if (input == null) return { state:"UNKNOWN", observedAt, evidence:[], uncertainty:[`No ${name} evidence supplied.`] };
  const state = String(input.state || "UNKNOWN").toUpperCase();
  if (!STATES.has(state)) throw new TypeError(`Invalid ${name} state: ${state}`);
  return { state, observedAt: input.observedAt || observedAt, evidence:Array.isArray(input.evidence)?input.evidence:[], uncertainty:Array.isArray(input.uncertainty)?input.uncertainty:[] };
}
function evaluateMultiStateHealth(input={}, options={}) {
  const observedAt = options.observedAt || iso(); const dimensions={};
  for (const name of DIMENSIONS) dimensions[name]=normalizeDimension(name,input[name],observedAt);
  const actionableFailures = DIMENSIONS.filter(n=>dimensions[n].state==="FAIL");
  const warnings = DIMENSIONS.filter(n=>dimensions[n].state==="WARN");
  const unknown = DIMENSIONS.filter(n=>dimensions[n].state==="UNKNOWN");
  const summary = actionableFailures.length ? "FAIL" : warnings.length ? "WARN" : unknown.length ? "PARTIAL" : "PASS";
  const snapshot={schema:"axm.multi-state-health.snapshot/v1",observedAt,summary,dimensions,actionableFailures,warnings,unknown,authority:"OBSERVE_ONLY"};
  snapshot.digest=sha256(snapshot); return deepFreeze(snapshot);
}
module.exports={DIMENSIONS,evaluateMultiStateHealth};
