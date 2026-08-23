'use strict';

const core = require('./core.js');
const softwarePack = require('./field-packs/software-workshop.json');

function refusal(code, message, details) {
  const error = new Error(message);
  error.code = code;
  if (details !== undefined) error.details = details;
  return error;
}

function omit(value, key) {
  const copy = core.clone(value);
  delete copy[key];
  return copy;
}

function normalizeBrief(input) {
  const brief = core.clone(input || {});
  if (!Array.isArray(brief.affectedSurfaces)) throw refusal('AFFECTED_SURFACES_REQUIRED', 'affectedSurfaces must be an explicit array of bounded surface tokens.');
  brief.affectedSurfaces = Array.from(new Set(brief.affectedSurfaces.map(String))).sort();
  return brief;
}

function assertCandidate(candidate) {
  const packageCheck = core.verifyPackage(candidate);
  if (!packageCheck.ok) throw refusal('CANDIDATE_PACKAGE_INVALID', 'The candidate package is not intact.', packageCheck.errors);
  const definition = candidate.definition || {};
  const lineage = definition.lineage || {};
  if (candidate.evaluation.status !== 'VALID') throw refusal('CANDIDATE_NOT_VALID', 'Only a candidate with a VALID evaluation receipt can be planned.');
  if (definition.field !== softwarePack.id || lineage.pack.id !== softwarePack.id || lineage.pack.version !== softwarePack.version || lineage.pack.digest !== softwarePack.packDigest) throw refusal('FIELD_PACK_LINEAGE_STALE', 'The candidate does not bind the current Software & Workshop field pack.');
  if (!lineage.runtime || lineage.runtime.id !== core.RUNTIME_ID || lineage.runtime.version !== core.RUNTIME_VERSION || lineage.runtime.digest !== core.RUNTIME_DIGEST) throw refusal('RUNTIME_LINEAGE_STALE', 'The candidate does not bind the current trusted runtime.');
  if (core.canonicalJson(lineage.routeTokenRegistry) !== core.canonicalJson(core.VERIFICATION_ROUTE_TOKEN_REGISTRY_REF)) throw refusal('ROUTE_TOKEN_REGISTRY_LINEAGE_STALE', 'The candidate does not bind the current route-token registry.');
  let intent;
  try { intent = JSON.parse(candidate.files['organ.intent.json']); } catch (error) { throw refusal('BOUND_INTENT_INVALID', 'The package does not carry a readable bound intent.'); }
  const reevaluated = core.evaluateDefinition(definition, intent, softwarePack);
  if (reevaluated.status !== 'VALID') throw refusal('TRUSTED_REEVALUATION_FAILED', 'The candidate definition fails a fresh trusted evaluation.', reevaluated.gates.filter(function(gate){return !gate.ok;}));
  try {
    if (core.canonicalJson(JSON.parse(candidate.files['verification-route-token-registry.json'])) !== core.canonicalJson(core.VERIFICATION_ROUTE_TOKEN_REGISTRY)) throw new Error('registry mismatch');
  } catch (error) { throw refusal('BOUND_ROUTE_TOKEN_REGISTRY_INVALID', 'The package does not carry the exact bound route-token registry.'); }
  return packageCheck;
}

function riskName(value) {
  return Number(value) >= 4 ? 'HIGH' : Number(value) >= 3 ? 'MEDIUM' : 'LOW';
}

function planVerificationRoute(candidate, input) {
  assertCandidate(candidate);
  const brief = normalizeBrief(input);
  const result = core.runDefinition(candidate.definition, brief);
  if (!result.ok) throw refusal(result.refusal && result.refusal.code || 'ORGAN_RUNTIME_REFUSAL', 'The trusted runtime refused the change brief.', result.refusal || result);
  if (!Array.isArray(result.output.route)) throw refusal('ROUTE_OUTPUT_INVALID', 'The organ did not emit a route array.');
  const bindings = result.output.route.map(function (token) {
    const binding = core.VERIFICATION_ROUTE_TOKEN_REGISTRY.tokens[token];
    if (!binding) throw refusal('ROUTE_TOKEN_UNKNOWN', 'The organ emitted a token outside its bound registry.', { token:token });
    return { token:token, description:binding.description, evidenceDesk:core.clone(binding.evidenceDesk), verificationSpine:core.clone(binding.verificationSpine) };
  });
  const observations = bindings.map(function (binding, index) {
    return {
      id:'route-'+String(index+1),
      claim:binding.description,
      kind:binding.evidenceDesk.claimKind,
      risk:riskName(brief.risk),
      verdict:'UNKNOWN',
      pass_condition:binding.evidenceDesk.passCondition,
      primary_surface:binding.evidenceDesk.primarySurface,
      observed_evidence:'',
      counterevidence:'Not yet tested; record any failing, contradictory, or missing evidence.',
      source_kind:'deterministic-organ-route-plan',
      source:candidate.package.packageDigest,
      named_seam:brief.affectedSurfaces.join(', ')
    };
  });
  const plan = {
    schema:'axm.verification-route-plan/v1',
    status:'EXPERIMENTAL',
    candidate:{id:candidate.package.id,packageDigest:candidate.package.packageDigest,definitionDigest:candidate.definition.definitionDigest,evaluationDigest:candidate.evaluation.receiptDigest,runtime:core.clone(candidate.definition.lineage.runtime),pack:core.clone(candidate.definition.lineage.pack),routeTokenRegistry:core.clone(candidate.definition.lineage.routeTokenRegistry)},
    input:{brief:brief,inputDigest:core.digest(brief)},
    output:core.clone(result.output),
    bindings:bindings,
    evidenceDeskPrefill:{schema:'axm.evidence-fields/v2',title:'Verification route · '+candidate.package.id,goal:candidate.definition.purpose,source_checkpoint:candidate.package.packageDigest,actor:{id:'deterministic-organ-fabric',type:'deterministic-planner'},observations:observations,actions:[],checks:[],changes:[],limitations:['This packet contains proposed evidence routes, not observed evidence.','Every verdict remains UNKNOWN until the native proof surface is actually used.'],next_actions:result.output.route.slice()},
    limitations:(candidate.evaluation.limitations||[]).concat(['This adapter plans only. It does not run tests, operate a browser, write state, or authorize implementation.']),
    authority:{executed:false,wroteState:false,installed:false,registered:false,staged:false,promoted:false,canonChanged:false,foundationChanged:false},
    planDigest:''
  };
  plan.planDigest = core.digest(omit(plan, 'planDigest'));
  return plan;
}

function verifyVerificationRoutePlan(plan, candidate, input) {
  const errors = [];
  try {
    const rebuilt = planVerificationRoute(candidate, input || (plan.input && plan.input.brief));
    if (core.canonicalJson(rebuilt) !== core.canonicalJson(plan)) errors.push({code:'PLAN_REBUILD_MISMATCH',path:'$',message:'Plan does not rebuild identically.'});
  } catch (error) {
    errors.push({code:error.code||'PLAN_VERIFY_REFUSAL',path:'$',message:String(error.message||error),details:error.details});
  }
  return {ok:errors.length===0,errors:errors,planDigest:plan&&plan.planDigest||null};
}

module.exports = { planVerificationRoute:planVerificationRoute, verifyVerificationRoutePlan:verifyVerificationRoutePlan, normalizeBrief:normalizeBrief };
