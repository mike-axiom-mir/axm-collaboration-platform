"use strict"; const { iso, sha256, clamp }=require("../common");
function evaluateSteadyState(contract={},samples=[],options={}){
 const observedAt=options.observedAt||iso(); const minSamples=contract.minimumSamples||1; const rules=contract.metrics||{}; const findings=[]; const byMetric={};
 for(const [name,rule] of Object.entries(rules)){ const vals=samples.map(s=>s.metrics&&s.metrics[name]).filter(Number.isFinite); const violations=vals.filter(v=>(Number.isFinite(rule.min)&&v<rule.min)||(Number.isFinite(rule.max)&&v>rule.max)); const ratio=vals.length?violations.length/vals.length:null; const tolerance=Number.isFinite(rule.toleratedViolationRatio)?rule.toleratedViolationRatio:0; const state=vals.length<minSamples?"UNKNOWN":ratio<=tolerance?"PASS":"FAIL"; byMetric[name]={state,sampleCount:vals.length,violationCount:violations.length,violationRatio:ratio,tolerance,min:rule.min??null,max:rule.max??null}; if(state==="FAIL")findings.push(name); }
 const unknown=Object.keys(byMetric).filter(k=>byMetric[k].state==="UNKNOWN"); const state=findings.length?"DEVIATED":unknown.length?"INSUFFICIENT_EVIDENCE":"STEADY"; const confidence=clamp(samples.length/Math.max(1,minSamples),0,1);
 const out={schema:"axm.steady-state.evaluation/v1",observedAt,state,confidence,metrics:byMetric,violations:findings,unknown,declaredUserOutcome:contract.userOutcome||null,authority:"OBSERVE_ONLY"}; out.digest=sha256(out); return out;
}
module.exports={evaluateSteadyState};
