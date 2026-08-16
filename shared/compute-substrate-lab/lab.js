'use strict';

const Research = require('../deterministic-research');
const knownStart = require('./KNOWN_START.json');

const { Core, Ledger } = Research;
const INTAKE_SCHEMA = 'axm.compute-substrate-intake/v1';
const PACKAGE_SCHEMA = 'axm.compute-substrate-package/v1';
const ROOT_PROPOSAL_SCHEMA = 'axm.compute-root-change-proposal/v1';
const ROOT_DECISION_SCHEMA = 'axm.compute-root-change-decision/v1';
const SNAPSHOT_SCHEMA = 'axm.compute-substrate-snapshot/v1';
const FAMILIES = new Set(['MECHANICAL','ELECTROMECHANICAL','ELECTRONIC','ANALOG','OPTICAL','FLUIDIC','BIOLOGICAL','QUANTUM','HYBRID','OTHER']);
const ROLES = new Set(['GENERAL_COMPUTE','CONTROL','MEMORY','SIGNAL','ACCELERATOR','INTERFACE','OTHER']);
const LAYERS = new Set(['BODY','VILLAGE','WORKSHOP','CLOUD','OTHER']);
const CLAIM_KINDS = new Set(['EXISTENCE','STATIC_STRUCTURE','BEHAVIOR','HISTORICAL','PERFORMANCE','RESOURCE_SAFETY','QUALITY']);
const RISKS = new Set(['LOW','MEDIUM','HIGH']);

function object(value, label) {
  Core.assert(value && typeof value === 'object' && !Array.isArray(value), label + ' must be an object');
  return value;
}

function unique(records, label) {
  const ids = new Set();
  for (const record of records) {
    Core.assert(!ids.has(record.id), 'duplicate ' + label + ' id: ' + record.id);
    ids.add(record.id);
  }
}

function normalizeSource(raw) {
  const source = object(raw, 'source');
  const normalized = {
    id: Core.text(source.id, 120), title: Core.text(source.title, 300), kind: Core.text(source.kind, 80).toUpperCase(),
    locator: Core.text(source.locator, 1000), evidenceStatus: Core.text(source.evidenceStatus || 'UNREVIEWED', 40).toUpperCase(),
    contentDigest: Core.text(source.contentDigest, 128), notes: Core.text(source.notes, 2000)
  };
  Core.assert(normalized.title && normalized.kind && normalized.locator, 'source title, kind, and locator are required');
  Core.assert(['UNREVIEWED','LOCATOR_ONLY','DIGEST_BOUND','CONFLICTING'].includes(normalized.evidenceStatus), 'unsupported source evidence status');
  if (normalized.evidenceStatus === 'DIGEST_BOUND') Core.assert(/^[a-f0-9]{64}$/.test(normalized.contentDigest), 'digest-bound source needs a sha256 digest');
  if (!normalized.id) normalized.id = Core.id('compute-source', normalized);
  return normalized;
}

function normalizeMilestone(raw) {
  const milestone = object(raw, 'milestone');
  const normalized = {
    id: Core.text(milestone.id, 120), year: Number(milestone.year), title: Core.text(milestone.title, 300),
    claim: Core.text(milestone.claim, 4000), sourceIds: Core.list(milestone.sourceIds, 200), status: 'RESEARCH_CANDIDATE'
  };
  Core.assert(Number.isInteger(normalized.year) && normalized.year >= -10000 && normalized.year <= 9999, 'milestone year is invalid');
  Core.assert(normalized.title && normalized.claim, 'milestone title and claim are required');
  if (!normalized.id) normalized.id = Core.id('compute-milestone', normalized);
  return normalized;
}

function knownMilestones() {
  const selected = knownStart.selectedRoot;
  return [
    { id:selected.id, year:selected.year, title:selected.title, claim:selected.claim, sourceIds:[], status:'PROVISIONAL_ROOT' },
    ...knownStart.earlierCandidates.map(item => ({ id:item.id, year:item.year, title:item.title, claim:item.claim, sourceIds:[], status:'RESEARCH_CANDIDATE' }))
  ];
}

function normalizeSubstrate(raw) {
  const substrate = object(raw, 'substrate');
  const normalized = {
    id: Core.text(substrate.id, 120), family: Core.text(substrate.family, 60).toUpperCase(), role: Core.text(substrate.role, 60).toUpperCase(),
    title: Core.text(substrate.title, 300), description: Core.text(substrate.description, 4000), sourceIds: Core.list(substrate.sourceIds, 200),
    constraints: Core.list(substrate.constraints, 200), potentialAdvantages: Core.list(substrate.potentialAdvantages, 200),
    readiness: 'RESEARCH_CANDIDATE', physicalExecutionAuthority:false
  };
  Core.assert(FAMILIES.has(normalized.family), 'unsupported compute substrate family');
  Core.assert(ROLES.has(normalized.role), 'unsupported compute substrate role');
  Core.assert(normalized.title && normalized.description, 'substrate title and description are required');
  if (!normalized.id) normalized.id = Core.id('compute-substrate', normalized);
  return normalized;
}

function normalizeArchitecture(raw) {
  const architecture = object(raw, 'architecture');
  const hardwareRefs = (Array.isArray(architecture.hardwareRefs) ? architecture.hardwareRefs : []).map(ref => ({
    schema:'axm.compute-hardware-reference/v1', hardwarePackageDigest:Core.text(ref && ref.hardwarePackageDigest, 128),
    hardwareSubjectId:Core.text(ref && ref.hardwareSubjectId, 120), relation:Core.text(ref && ref.relation, 120)
  }));
  for (const ref of hardwareRefs) Core.assert(/^[a-f0-9]{64}$/.test(ref.hardwarePackageDigest) && ref.hardwareSubjectId && ref.relation, 'hardware reference must be digest-bound and typed');
  const normalized = {
    id: Core.text(architecture.id, 120), title: Core.text(architecture.title, 300), objective: Core.text(architecture.objective, 4000),
    layers: Core.list(architecture.layers, 20).map(item => item.toUpperCase()), substrateIds: Core.list(architecture.substrateIds, 500),
    hardwareRefs, state:'PROPOSED', deploymentAuthority:false, failureModes:Core.list(architecture.failureModes, 200)
  };
  Core.assert(normalized.title && normalized.objective && normalized.layers.length > 0, 'architecture title, objective, and layers are required');
  Core.assert(normalized.layers.every(layer => LAYERS.has(layer)), 'unsupported compute architecture layer');
  if (!normalized.id) normalized.id = Core.id('compute-architecture', normalized);
  return normalized;
}

function normalizeClaim(raw) {
  const claim = object(raw, 'claim');
  const normalized = {
    id:Core.text(claim.id,120), statement:Core.text(claim.statement,4000), kind:Core.text(claim.kind,40).toUpperCase(),
    risk:Core.text(claim.risk || 'HIGH',20).toUpperCase(), subjectRefs:Core.list(claim.subjectRefs,500),
    passCondition:Core.text(claim.passCondition,4000), counterevidence:Core.text(claim.counterevidence,4000),
    primarySurface:Core.text(claim.primarySurface,300), secondarySurface:Core.text(claim.secondarySurface,300), verdict:'UNTESTED'
  };
  Core.assert(normalized.statement && normalized.passCondition && normalized.counterevidence && normalized.primarySurface, 'claim statement and evidence route are required');
  Core.assert(CLAIM_KINDS.has(normalized.kind) && RISKS.has(normalized.risk), 'unsupported compute claim kind or risk');
  if (normalized.risk === 'HIGH') Core.assert(normalized.secondarySurface, 'high-risk claim needs an independent secondary surface');
  if (!normalized.id) normalized.id = Core.id('compute-claim', normalized);
  return normalized;
}

function rootState(selected, history) {
  const state = { selected:Core.clone(selected), history:Core.clone(history || []) };
  state.rootStateDigest = Core.digest({ selected:state.selected, history:state.history });
  return state;
}

function compile(raw) {
  const intake = object(raw, 'compute intake');
  Core.assert(intake.schema === INTAKE_SCHEMA, 'compute intake schema is unsupported');
  const sources = (Array.isArray(intake.sources) ? intake.sources : []).map(normalizeSource).sort((a,b) => a.id.localeCompare(b.id));
  const milestoneMap = new Map(knownMilestones().map(item => [item.id,item]));
  for (const item of (Array.isArray(intake.milestones) ? intake.milestones : []).map(normalizeMilestone)) {
    if (milestoneMap.has(item.id)) Core.assert(Core.stable(milestoneMap.get(item.id)) === Core.stable(item), 'milestone conflicts with protected known-start record');
    else milestoneMap.set(item.id, item);
  }
  const milestones = [...milestoneMap.values()].sort((a,b) => a.year - b.year || a.id.localeCompare(b.id));
  const substrates = (Array.isArray(intake.substrates) ? intake.substrates : []).map(normalizeSubstrate).sort((a,b) => a.id.localeCompare(b.id));
  const architectures = (Array.isArray(intake.architectures) ? intake.architectures : []).map(normalizeArchitecture).sort((a,b) => a.id.localeCompare(b.id));
  const claims = (Array.isArray(intake.claims) ? intake.claims : []).map(normalizeClaim).sort((a,b) => a.id.localeCompare(b.id));
  unique(sources,'source'); unique(milestones,'milestone'); unique(substrates,'substrate'); unique(architectures,'architecture'); unique(claims,'claim');
  const sourceIds = new Set(sources.map(item => item.id));
  const substrateIds = new Set(substrates.map(item => item.id));
  const subjects = new Set([...milestones.map(item => item.id), ...substrateIds, ...architectures.map(item => item.id)]);
  for (const item of [...milestones, ...substrates]) for (const id of item.sourceIds || []) Core.assert(sourceIds.has(id), 'record references unknown source: ' + id);
  for (const architecture of architectures) for (const id of architecture.substrateIds) Core.assert(substrateIds.has(id), 'architecture references unknown substrate: ' + id);
  for (const claim of claims) for (const id of claim.subjectRefs) Core.assert(subjects.has(id), 'claim references unknown compute subject: ' + id);
  const result = {
    schema:PACKAGE_SCHEMA, id:Core.text(intake.id,120), title:Core.text(intake.title,300), objective:Core.text(intake.objective,4000),
    family:'HARDWARE_COMPUTE_RESEARCH', domain:'COMPUTATION_AND_PHYSICAL_SYSTEMS', defaultField:'COMPUTE', authority:'RECOMMENDATION_ONLY',
    knownStartPolicyDigest:Core.digest(knownStart), root:rootState(knownStart.selectedRoot, []), sources, milestones, substrates, architectures, claims,
    boundaries:{ physicalExecution:false, automaticBenchmark:false, automaticDeployment:false, automaticRootChange:false, automaticCanon:false, inputIsData:true }
  };
  Core.assert(result.title && result.objective, 'compute package title and objective are required');
  if (!result.id) result.id = Core.id('compute-substrate-research', {title:result.title, objective:result.objective});
  result.packageDigest = Core.digest(result);
  return result;
}

function verify(pkg) {
  try {
    Core.assert(pkg && pkg.schema === PACKAGE_SCHEMA, 'compute package schema is unsupported');
    const copy = Core.clone(pkg), digest = copy.packageDigest; delete copy.packageDigest;
    Core.assert(Core.digest(copy) === digest, 'compute package digest mismatch');
    Core.assert(pkg.knownStartPolicyDigest === Core.digest(knownStart), 'known-start policy digest mismatch');
    let previous = null;
    for (const event of pkg.root.history || []) {
      const eventCopy = Core.clone(event), eventDigest = eventCopy.eventDigest; delete eventCopy.eventDigest;
      Core.assert(eventCopy.previousHistoryDigest === previous && Core.digest(eventCopy) === eventDigest, 'root history chain mismatch');
      previous = eventDigest;
    }
    Core.assert(Core.digest({selected:pkg.root.selected,history:pkg.root.history}) === pkg.root.rootStateDigest, 'root state digest mismatch');
    Core.assert(pkg.boundaries && pkg.boundaries.physicalExecution === false && pkg.boundaries.automaticRootChange === false, 'compute authority boundary changed');
    Core.assert((pkg.architectures || []).every(item => item.state === 'PROPOSED' && item.deploymentAuthority === false), 'architecture authority boundary changed');
    return {pass:true,reason:null,digest};
  } catch (error) { return {pass:false,reason:error.message}; }
}

function normalizeEvidenceRefs(refs) {
  const normalized = (Array.isArray(refs) ? refs : []).map(ref => ({
    surface:Core.text(ref && ref.surface,200), locator:Core.text(ref && ref.locator,1000), digest:Core.text(ref && ref.digest,128)
  }));
  Core.assert(normalized.length >= 2, 'root change needs two independent digest-bound evidence references');
  Core.assert(normalized.every(ref => ref.surface && ref.locator && /^[a-f0-9]{64}$/.test(ref.digest)), 'root evidence reference is incomplete');
  Core.assert(new Set(normalized.map(ref => ref.surface)).size >= 2, 'root evidence needs two independent surfaces');
  return normalized.sort((a,b) => a.surface.localeCompare(b.surface) || a.locator.localeCompare(b.locator));
}

function planRootChange(pkg, rawRequest) {
  Core.assert(verify(pkg).pass, 'compute package must verify before root planning');
  const request = object(rawRequest, 'root change request');
  const candidate = pkg.milestones.find(item => item.id === request.candidateMilestoneId);
  Core.assert(candidate, 'root candidate milestone is unknown');
  Core.assert(candidate.year < pkg.root.selected.year, 'root candidate must be earlier than the selected root');
  const proposal = {
    schema:ROOT_PROPOSAL_SCHEMA, basePackageDigest:pkg.packageDigest, currentRootDigest:Core.digest(pkg.root.selected),
    candidateMilestoneId:candidate.id, candidateYear:candidate.year, reason:Core.text(request.reason,4000),
    evidenceRefs:normalizeEvidenceRefs(request.evidenceRefs), status:'PROPOSED', automatic:false, canonAuthority:false
  };
  Core.assert(proposal.reason, 'root change reason is required');
  proposal.proposalDigest = Core.digest(proposal);
  return proposal;
}

function applyRootDecision(pkg, proposal, rawDecision) {
  Core.assert(verify(pkg).pass, 'compute package must verify before root decision');
  const proposalCopy = Core.clone(proposal), proposalDigest = proposalCopy.proposalDigest; delete proposalCopy.proposalDigest;
  Core.assert(proposal.schema === ROOT_PROPOSAL_SCHEMA && Core.digest(proposalCopy) === proposalDigest, 'root proposal digest mismatch');
  Core.assert(proposal.basePackageDigest === pkg.packageDigest && proposal.currentRootDigest === Core.digest(pkg.root.selected), 'root proposal is stale');
  const decision = object(rawDecision, 'root decision');
  const outcome = Core.text(decision.outcome,20).toUpperCase();
  Core.assert(['ACCEPT','REJECT'].includes(outcome), 'root decision outcome must be ACCEPT or REJECT');
  Core.assert(decision.schema === ROOT_DECISION_SCHEMA && decision.proposalDigest === proposal.proposalDigest, 'root decision does not approve the exact proposal');
  Core.assert(Core.text(decision.scope,40).toUpperCase() === 'WORKING_ROOT_ONLY', 'root decision scope must remain WORKING_ROOT_ONLY');
  const steward = {id:Core.text(decision.steward && decision.steward.id,120),kind:Core.text(decision.steward && decision.steward.kind,20).toUpperCase()};
  Core.assert(steward.id && steward.kind === 'HUMAN', 'root decision requires a named human steward');
  Core.assert(Core.text(decision.decidedAt,80), 'root decision time is required');
  if (outcome === 'ACCEPT') Core.assert(Core.text(decision.evidenceVerdict,20).toUpperCase() === 'PASS' && decision.independentReview === true, 'accepted root change needs PASS evidence and independent review');
  const next = Core.clone(pkg); delete next.packageDigest;
  const candidate = next.milestones.find(item => item.id === proposal.candidateMilestoneId);
  const previousHistoryDigest = next.root.history.length ? next.root.history[next.root.history.length - 1].eventDigest : null;
  const event = {
    type:'ROOT_CHANGE_DECIDED', proposalDigest:proposal.proposalDigest, outcome, previousHistoryDigest,
    previousRoot:Core.clone(next.root.selected), candidateRoot:Core.clone(candidate), steward,
    decidedAt:Core.text(decision.decidedAt,80), scope:'WORKING_ROOT_ONLY', canon:false,
    evidenceVerdict:Core.text(decision.evidenceVerdict,20).toUpperCase() || 'UNKNOWN', independentReview:decision.independentReview === true
  };
  event.eventDigest = Core.digest(event);
  const history = [...next.root.history, event];
  let selected = next.root.selected;
  if (outcome === 'ACCEPT') selected = {...Core.clone(candidate), status:'REVIEWED_WORKING_ROOT', selectedByDecision:event.eventDigest};
  next.root = rootState(selected, history);
  next.packageDigest = Core.digest(next);
  return next;
}

function createEvidenceLedger(pkg) {
  Core.assert(verify(pkg).pass, 'compute package must verify before evidence ledger creation');
  return Ledger.create(pkg.claims.map(claim => ({id:'experiment-'+claim.id,gapId:'compute-substrate-research',claim:{id:claim.id}})));
}
function ingestEvidence(ledger, observation) { return Ledger.ingest(ledger, observation); }
function snapshot(pkg, ledger) {
  Core.assert(verify(pkg).pass && Ledger.verify(ledger).pass, 'snapshot inputs must verify');
  const result = {
    schema:SNAPSHOT_SCHEMA, packageId:pkg.id, packageDigest:pkg.packageDigest, ledgerDigest:ledger.ledgerDigest,
    selectedRoot:{id:pkg.root.selected.id,year:pkg.root.selected.year,status:pkg.root.selected.status},
    counts:{sources:pkg.sources.length,milestones:pkg.milestones.length,substrates:pkg.substrates.length,architectures:pkg.architectures.length,claims:pkg.claims.length},
    physicalExecutionAuthority:false,deploymentAuthority:false,rootChangeAuthority:false
  };
  result.snapshotDigest = Core.digest(result); return result;
}

module.exports = { INTAKE_SCHEMA, PACKAGE_SCHEMA, ROOT_PROPOSAL_SCHEMA, ROOT_DECISION_SCHEMA, SNAPSHOT_SCHEMA, knownStart, compile, verify, planRootChange, applyRootDecision, createEvidenceLedger, ingestEvidence, snapshot };
