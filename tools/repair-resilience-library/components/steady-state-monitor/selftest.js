"use strict";const assert=require("assert");const {evaluateSteadyState}=require("./index");
const c={minimumSamples:3,metrics:{latency:{max:100,toleratedViolationRatio:.34},errors:{max:0}}};
let r=evaluateSteadyState(c,[{metrics:{latency:90,errors:0}}]); assert.equal(r.state,"INSUFFICIENT_EVIDENCE");
r=evaluateSteadyState(c,[{metrics:{latency:90,errors:0}},{metrics:{latency:120,errors:0}},{metrics:{latency:95,errors:0}}]); assert.equal(r.state,"STEADY");
r=evaluateSteadyState(c,[{metrics:{latency:120,errors:0}},{metrics:{latency:130,errors:0}},{metrics:{latency:95,errors:1}}]); assert.equal(r.state,"DEVIATED"); assert(r.violations.includes("latency"));
console.log("PASS steady-state-monitor");
