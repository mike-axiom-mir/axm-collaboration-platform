'use strict';

const Research = require('../deterministic-research');

const { Core, Ledger } = Research;
const INTAKE_SCHEMA = 'axm.hardware-research-intake/v1';
const PACKAGE_SCHEMA = 'axm.hardware-research-package/v1';
const SNAPSHOT_SCHEMA = 'axm.hardware-research-snapshot/v1';
const SOURCE_STATES = new Set(['UNREVIEWED', 'LOCATOR_ONLY', 'DIGEST_BOUND', 'CONFLICTING']);
const CANDIDATE_CLASSES = new Set([
  'ROBOT_BODY', 'SENSOR', 'ACTUATOR', 'POWER', 'MATERIAL', 'TOOLING',
  'RECOVERED_HARDWARE', 'COMPUTE_DEVICE', 'COMMUNICATION', 'OTHER'
]);
const CLAIM_KINDS = new Set(['EXISTENCE', 'STATIC_STRUCTURE', 'BEHAVIOR', 'SAFETY', 'PERFORMANCE', 'QUALITY', 'HISTORICAL']);
const RISKS = new Set(['LOW', 'MEDIUM', 'HIGH']);

function object(value, label) {
  Core.assert(value && typeof value === 'object' && !Array.isArray(value), label + ' must be an object');
  return value;
}

function unique(records, label) {
  const seen = new Set();
  for (const record of records) {
    Core.assert(!seen.has(record.id), 'duplicate ' + label + ' id: ' + record.id);
    seen.add(record.id);
  }
}

function normalizeSource(raw) {
  const source = object(raw, 'source');
  const normalized = {
    id: Core.text(source.id, 120),
    title: Core.text(source.title, 300),
    kind: Core.text(source.kind, 80).toUpperCase(),
    locator: Core.text(source.locator, 1000),
    evidenceStatus: Core.text(source.evidenceStatus || 'UNREVIEWED', 40).toUpperCase(),
    contentDigest: Core.text(source.contentDigest, 128),
    notes: Core.text(source.notes, 2000)
  };
  Core.assert(normalized.title && normalized.kind && normalized.locator, 'source title, kind, and locator are required');
  Core.assert(SOURCE_STATES.has(normalized.evidenceStatus), 'unsupported source evidence status');
  if (normalized.evidenceStatus === 'DIGEST_BOUND') Core.assert(/^[a-f0-9]{64}$/.test(normalized.contentDigest), 'digest-bound source needs a sha256 digest');
  if (!normalized.id) normalized.id = Core.id('source', normalized);
  return normalized;
}

function normalizeCandidate(raw) {
  const candidate = object(raw, 'candidate');
  const normalized = {
    id: Core.text(candidate.id, 120),
    class: Core.text(candidate.class, 80).toUpperCase(),
    title: Core.text(candidate.title, 300),
    description: Core.text(candidate.description, 4000),
    sourceIds: Core.list(candidate.sourceIds, 200),
    readiness: 'RESEARCH_CANDIDATE',
    safety: {
      risk: Core.text(candidate.safety && candidate.safety.risk || 'HIGH', 20).toUpperCase(),
      hazards: Core.list(candidate.safety && candidate.safety.hazards, 100),
      requiredAuthorities: Core.list(candidate.safety && candidate.safety.requiredAuthorities, 100)
    },
    tags: Core.list(candidate.tags, 100)
  };
  Core.assert(CANDIDATE_CLASSES.has(normalized.class), 'unsupported hardware candidate class');
  Core.assert(normalized.title && normalized.description, 'candidate title and description are required');
  Core.assert(RISKS.has(normalized.safety.risk), 'unsupported safety risk');
  if (!normalized.id) normalized.id = Core.id('hardware', normalized);
  return normalized;
}

function normalizeBuild(raw) {
  const build = object(raw, 'build');
  Core.assert(!build.state || String(build.state).toUpperCase() === 'DESIGN_ONLY', 'build state must remain DESIGN_ONLY');
  const normalized = {
    id: Core.text(build.id, 120),
    title: Core.text(build.title, 300),
    purpose: Core.text(build.purpose, 4000),
    candidateIds: Core.list(build.candidateIds, 500),
    designArtifactRefs: (Array.isArray(build.designArtifactRefs) ? build.designArtifactRefs : []).map(ref => ({
      locator: Core.text(ref && ref.locator, 1000),
      digest: Core.text(ref && ref.digest, 128)
    })).filter(ref => ref.locator),
    state: 'DESIGN_ONLY',
    executionAuthority: false,
    safetyApproval: false,
    openQuestions: Core.list(build.openQuestions, 200)
  };
  Core.assert(normalized.title && normalized.purpose, 'build title and purpose are required');
  Core.assert(normalized.candidateIds.length > 0, 'build needs at least one candidate reference');
  if (!normalized.id) normalized.id = Core.id('build-design', normalized);
  return normalized;
}

function normalizeClaim(raw) {
  const claim = object(raw, 'claim');
  const normalized = {
    id: Core.text(claim.id, 120),
    statement: Core.text(claim.statement, 4000),
    kind: Core.text(claim.kind, 40).toUpperCase(),
    risk: Core.text(claim.risk || 'HIGH', 20).toUpperCase(),
    subjectRefs: Core.list(claim.subjectRefs, 500),
    passCondition: Core.text(claim.passCondition, 4000),
    counterevidence: Core.text(claim.counterevidence, 4000),
    primarySurface: Core.text(claim.primarySurface, 300),
    secondarySurface: Core.text(claim.secondarySurface, 300),
    verdict: 'UNTESTED'
  };
  Core.assert(normalized.statement && normalized.passCondition && normalized.counterevidence && normalized.primarySurface, 'claim statement and evidence route are required');
  Core.assert(CLAIM_KINDS.has(normalized.kind), 'unsupported hardware claim kind');
  Core.assert(RISKS.has(normalized.risk), 'unsupported claim risk');
  if (normalized.risk === 'HIGH') Core.assert(normalized.secondarySurface, 'high-risk claim needs an independent secondary surface');
  if (!normalized.id) normalized.id = Core.id('hardware-claim', normalized);
  return normalized;
}

function compile(raw) {
  const intake = object(raw, 'hardware intake');
  Core.assert(intake.schema === INTAKE_SCHEMA, 'hardware intake schema is unsupported');
  const sources = (Array.isArray(intake.sources) ? intake.sources : []).map(normalizeSource).sort((a, b) => a.id.localeCompare(b.id));
  const candidates = (Array.isArray(intake.candidates) ? intake.candidates : []).map(normalizeCandidate).sort((a, b) => a.id.localeCompare(b.id));
  const builds = (Array.isArray(intake.builds) ? intake.builds : []).map(normalizeBuild).sort((a, b) => a.id.localeCompare(b.id));
  const claims = (Array.isArray(intake.claims) ? intake.claims : []).map(normalizeClaim).sort((a, b) => a.id.localeCompare(b.id));
  unique(sources, 'source'); unique(candidates, 'candidate'); unique(builds, 'build'); unique(claims, 'claim');
  const sourceIds = new Set(sources.map(item => item.id));
  const candidateIds = new Set(candidates.map(item => item.id));
  const subjects = new Set([...candidateIds, ...builds.map(item => item.id)]);
  for (const candidate of candidates) for (const id of candidate.sourceIds) Core.assert(sourceIds.has(id), 'candidate references unknown source: ' + id);
  for (const build of builds) for (const id of build.candidateIds) Core.assert(candidateIds.has(id), 'build references unknown candidate: ' + id);
  for (const claim of claims) for (const id of claim.subjectRefs) Core.assert(subjects.has(id), 'claim references unknown subject: ' + id);
  const result = {
    schema: PACKAGE_SCHEMA,
    id: Core.text(intake.id, 120),
    title: Core.text(intake.title, 300),
    objective: Core.text(intake.objective, 4000),
    family: 'HARDWARE_COMPUTE_RESEARCH',
    domain: 'ROBOTICA_AND_PHYSICAL_SYSTEMS',
    defaultField: 'HARDWARE',
    authority: 'RECOMMENDATION_ONLY',
    sources, candidates, builds, claims,
    boundaries: {
      physicalExecution: false,
      automaticBuild: false,
      automaticSafetyApproval: false,
      automaticProcurement: false,
      automaticPromotion: false,
      inputIsData: true
    }
  };
  Core.assert(result.title && result.objective, 'hardware package title and objective are required');
  if (!result.id) result.id = Core.id('hardware-research', { title: result.title, objective: result.objective });
  result.packageDigest = Core.digest(result);
  return result;
}

function verify(pkg) {
  try {
    Core.assert(pkg && pkg.schema === PACKAGE_SCHEMA, 'hardware package schema is unsupported');
    const copy = Core.clone(pkg), digest = copy.packageDigest; delete copy.packageDigest;
    Core.assert(Core.digest(copy) === digest, 'hardware package digest mismatch');
    Core.assert((pkg.builds || []).every(item => item.state === 'DESIGN_ONLY' && item.executionAuthority === false && item.safetyApproval === false), 'build authority boundary changed');
    Core.assert(pkg.boundaries && pkg.boundaries.physicalExecution === false && pkg.boundaries.inputIsData === true, 'hardware package boundary changed');
    return { pass: true, reason: null, digest };
  } catch (error) {
    return { pass: false, reason: error.message };
  }
}

function merge(packages, title) {
  Core.assert(Array.isArray(packages) && packages.length > 0, 'merge needs at least one hardware package');
  packages.forEach(pkg => Core.assert(verify(pkg).pass, 'cannot merge an invalid hardware package'));
  function combine(key) {
    const map = new Map();
    for (const pkg of packages) for (const item of pkg[key] || []) {
      if (map.has(item.id)) Core.assert(Core.stable(map.get(item.id)) === Core.stable(item), 'conflicting ' + key + ' record: ' + item.id);
      else map.set(item.id, Core.clone(item));
    }
    return [...map.values()].sort((a, b) => a.id.localeCompare(b.id));
  }
  const merged = {
    schema: PACKAGE_SCHEMA,
    id: Core.id('hardware-research-merge', packages.map(pkg => pkg.packageDigest).sort()),
    title: Core.text(title || 'Merged hardware research registry', 300),
    objective: 'Preserve compatible hardware research and build-design records without granting physical execution authority.',
    family: 'HARDWARE_COMPUTE_RESEARCH', domain:'ROBOTICA_AND_PHYSICAL_SYSTEMS', defaultField: 'HARDWARE', authority: 'RECOMMENDATION_ONLY',
    sources: combine('sources'), candidates: combine('candidates'), builds: combine('builds'), claims: combine('claims'),
    mergedFrom: packages.map(pkg => pkg.packageDigest).sort(),
    boundaries: { physicalExecution:false, automaticBuild:false, automaticSafetyApproval:false, automaticProcurement:false, automaticPromotion:false, inputIsData:true }
  };
  merged.packageDigest = Core.digest(merged);
  return merged;
}

function createEvidenceLedger(pkg) {
  Core.assert(verify(pkg).pass, 'hardware package must verify before evidence ledger creation');
  return Ledger.create(pkg.claims.map(claim => ({ id: 'experiment-' + claim.id, gapId: 'hardware-research', claim: { id: claim.id } })));
}

function ingestEvidence(ledger, observation) { return Ledger.ingest(ledger, observation); }

function snapshot(pkg, ledger) {
  const packageCheck = verify(pkg), ledgerCheck = Ledger.verify(ledger);
  Core.assert(packageCheck.pass && ledgerCheck.pass, 'snapshot inputs must verify');
  const claimVerdicts = Object.fromEntries(['UNTESTED','PASS','FAIL','UNKNOWN','CONFLICT'].map(verdict => [verdict, ledger.claims.filter(item => item.verdict === verdict).length]));
  const result = {
    schema: SNAPSHOT_SCHEMA, packageId: pkg.id, packageDigest: pkg.packageDigest,
    ledgerDigest: ledger.ledgerDigest, counts: { sources:pkg.sources.length, candidates:pkg.candidates.length, builds:pkg.builds.length, claims:pkg.claims.length },
    claimVerdicts, physicalExecutionAuthority:false, safetyApprovalAuthority:false
  };
  result.snapshotDigest = Core.digest(result);
  return result;
}

module.exports = { INTAKE_SCHEMA, PACKAGE_SCHEMA, SNAPSHOT_SCHEMA, compile, verify, merge, createEvidenceLedger, ingestEvidence, snapshot };
