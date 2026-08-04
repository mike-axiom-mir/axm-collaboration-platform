"use strict";
const { createLineage } = require("../lineage-propagator");
const { GoldenSignalSampler } = require("../golden-signal-sampler");
const { evaluateResourcePressure } = require("../resource-pressure-sentinel");
const { evaluateMultiStateHealth } = require("../multi-state-health-probe");
const { detectProgressStall } = require("../progress-stall-detector");
const { evaluateLease } = require("../heartbeat-lease-monitor");
const { createEnvelope } = require("../cross-signal-envelope");
function buildHealthTelemetryPacket(input={}) {
 const lineage=createLineage(input.lineage||{}); const sampler=new GoldenSignalSampler({capacity:input.signalCapacity||120});
 for(const sample of input.goldenSignalSamples||[]) sampler.record(sample.target,sample);
 const signals=(input.targets||[]).map(target=>sampler.snapshot(target)); const pressure=evaluateResourcePressure(input.resources||{});
 const progress=detectProgressStall(input.progress||{}); const lease=evaluateLease(input.lease,input.nowMs);
 const health=evaluateMultiStateHealth(input.healthDimensions||{});
 const envelope=createEnvelope({lineageId:lineage.lineageId,metrics:signals,stateChanges:[pressure,progress,lease,health],limitations:["Standalone prototype packet; not live AXM runtime proof."]});
 return {schema:"axm.health-telemetry-packet/v1",lineage,signals,pressure,progress,lease,health,envelope,authority:"OBSERVE_ONLY"};
}
module.exports={buildHealthTelemetryPacket};
