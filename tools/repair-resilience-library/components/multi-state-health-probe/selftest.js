"use strict"; const assert=require("assert"); const {evaluateMultiStateHealth}=require("./index");
const a=evaluateMultiStateHealth({startup:{state:"PASS"},readiness:{state:"FAIL",evidence:["db missing"]}},{observedAt:"2026-07-27T00:00:00.000Z"});
assert.equal(a.summary,"FAIL"); assert.deepEqual(a.actionableFailures,["readiness"]); assert(a.unknown.includes("liveness"));
assert.throws(()=>evaluateMultiStateHealth({startup:{state:"HEALTHYISH"}}),/Invalid/);
const b=evaluateMultiStateHealth({startup:{state:"PASS"},readiness:{state:"PASS"},liveness:{state:"PASS"},degraded:{state:"NOT_APPLICABLE"},progress:{state:"PASS"},userOutcome:{state:"WARN"}}); assert.equal(b.summary,"WARN");
console.log("PASS multi-state-health-probe");
