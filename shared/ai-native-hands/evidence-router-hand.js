(function(root,factory){var api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;if(root)root.AXMEvidenceRouterHand=api;})(typeof self!=='undefined'?self:this,function(){
  'use strict';
  var SCHEMA='axm.evidence-route/v1',CAPABILITY='evidence.route.claim/v1';
  var MATRIX={
    existence:{primary:'direct-artifact-inspection',counter:'artifact-absent-or-unreadable',secondary:'independent-inventory-and-digest'},
    structure:{primary:'schema-or-contract-validation',counter:'parse-or-validation-failure',secondary:'independent-parser'},
    behavior:{primary:'focused-execution-with-known-inputs',counter:'reproducible-output-mismatch',secondary:'held-out-cases'},
    visual:{primary:'live-rendered-frame-at-declared-state',counter:'visible-clipping-blank-stale-or-misleading-state',secondary:'before-action-settled-frame-sequence'},
    temporal:{primary:'timestamped-frame-sequence',counter:'missing-frozen-or-out-of-order-transition',secondary:'runtime-timing-trace'},
    interaction:{primary:'complete-relevant-user-journey',counter:'blocked-input-hidden-focus-or-unrecoverable-state',secondary:'second-device-seat-or-input-method'},
    persistence:{primary:'save-restart-reload-and-compare',counter:'state-loss-or-stale-restore',secondary:'fresh-process-or-device-recovery'},
    transport:{primary:'linked-sender-and-receiver-receipts',counter:'missing-or-digest-mismatched-receipt',secondary:'payload-digest-and-acknowledgement'},
    authorization:{primary:'allowed-and-denied-identity-boundary-test',counter:'unauthorized-success-or-authorized-refusal',secondary:'permission-audit-trail'},
    performance:{primary:'telemetry-under-declared-workload-and-duration',counter:'budget-breach-or-unmeasured-condition',secondary:'repeated-baseline-comparison'},
    'resource-safety':{primary:'thermal-power-memory-and-recovery-observation',counter:'threshold-breach-or-failed-throttle',secondary:'controlled-load-hardware-telemetry'},
    learning:{primary:'held-out-evaluation-with-provenance',counter:'leakage-regression-or-baseline-loss',secondary:'multiple-seeds-and-regression-set'},
    quality:{primary:'declared-acceptance-criteria-and-artifact-inspection',counter:'required-criterion-fails',secondary:'independent-review-and-representative-journey'},
    taste:{primary:'explicit-appointed-steward-judgment',counter:'steward-rejection-or-unresolved-perspective-conflict',secondary:'multiple-independent-perspectives'}
  };
  var ALIASES={file:'existence',static:'structure',runtime:'behavior',ui:'visual',video:'temporal',motion:'temporal',controls:'interaction',saved:'persistence',network:'transport',permission:'authorization',speed:'performance',thermal:'resource-safety',model:'learning',fairness:'taste',meaning:'taste'};
  function clean(value,max){var text=String(value==null?'':value).trim();if(!text)throw new Error('non-empty value required');return text.slice(0,max||1000);}
  function kind(value){var key=String(value||'').toLowerCase().trim();return MATRIX[key]?key:(ALIASES[key]||null);}
  function route(input){
    input=input||{};var claim=clean(input.claim,2000),claimKind=kind(input.kind),risk=String(input.risk||'medium').toLowerCase();
    if(['low','medium','high'].indexOf(risk)<0)throw new Error('risk must be low, medium, or high');
    var spec=claimKind?MATRIX[claimKind]:null,required=spec?[spec.primary]:['domain-native-verifier-required'];
    if(spec&&risk==='high')required.push(spec.secondary);
    return{schema:SCHEMA,capability:CAPABILITY,id:clean(input.id||('claim-'+Date.now().toString(36)),120),claim:claim,kind:claimKind||'unknown',risk:risk,passCondition:input.passCondition?clean(input.passCondition,2000):null,primarySurface:spec?spec.primary:'unknown',counterevidence:spec?spec.counter:'name-what-would-refute-this-claim',secondarySurface:spec?spec.secondary:'independent-domain-review',requiredSurfaces:required,routeState:spec?'ROUTED':'UNKNOWN_KIND',verdict:'UNTESTED',automaticVerdict:false,automaticAction:false};
  }
  function routeMany(values){if(!Array.isArray(values)||!values.length||values.length>100)throw new Error('claims must be a bounded non-empty array');return{schema:'axm.evidence-route-set/v1',routes:values.map(route),complete:false};}
  var descriptor={id:'evidence-router',capability:CAPABILITY,version:'1.0.0',status:'TEST',accepts:['claim','claim-kind','risk','pass-condition'],produces:[SCHEMA],sideEffects:[],automaticVerdict:false};
  return{SCHEMA:SCHEMA,CAPABILITY:CAPABILITY,MATRIX:MATRIX,descriptor:descriptor,route:route,routeMany:routeMany};
});
