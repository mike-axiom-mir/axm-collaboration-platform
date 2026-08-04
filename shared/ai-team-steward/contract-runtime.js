'use strict';

const fs = require('fs');
const path = require('path');

const VALIDATION_SCHEMA = 'axm.ai-team-steward-validation/v1';
const SAMPLE_SCHEMA = 'axm.ai-team-steward-sample/v1';
const STATUS_SCHEMA = 'axm.ai-team-steward-runtime-status/v1';
const REQUIRED_SECTIONS = Object.freeze([
  'actor', 'authority', 'privacy', 'task', 'routing', 'handoff', 'pattern',
  'verification', 'artifact', 'resources', 'control', 'human', 'evidence', 'payload'
]);

const ERROR_DETAILS = Object.freeze({
  MODULE_ID_MISMATCH: 'Use the selected seed module ID without substitution.',
  PROOF_SLICE_ID_MISMATCH: 'Reload the sample so its proof slice matches the selected seed.',
  REGISTRY_DIGEST_MISMATCH: 'Reload the sample so it is bound to the retained source registry.',
  FAMILY_MISMATCH: 'Use the family declared by the selected seed.',
  IDENTITY_INFERRED_FROM_ROUTE: 'Give the actor an identity that is explicit and separate from its route.',
  AUTHORITY_SCOPE_BROADENED: 'Keep child actions inside the parent allowlist.',
  PRIVATE_CONTEXT_UNAUTHORIZED: 'Remove private context or provide an explicit transfer authorization.',
  TASK_GOAL_MISSING: 'Add a concrete task goal.',
  ACCEPTANCE_RECEIPT_MISSING: 'Record receiver acceptance before work becomes active.',
  RESULT_ACCEPTED_BEFORE_REVIEW: 'Record a review receipt before accepting the result.',
  INELIGIBLE_SEAT_SELECTED: 'Choose only an eligible seat.',
  SELF_CONFIDENCE_USED_AS_AUTHORITY: 'Add evidence-history references and do not route by self-confidence alone.',
  RECEIVER_ACTIVE_BEFORE_ACCEPTANCE: 'Record receiver acceptance before ACTIVE or RETURNED state.',
  HANDOFF_DEPTH_EXCEEDED: 'Shorten the delegation chain or raise the reviewed maximum explicitly.',
  HIDDEN_COLLABORATION: 'Make the collaboration visible to the human owner.',
  MERGE_GATE_BYPASSED: 'Require a separate merge gate.',
  HIDDEN_COAUTHORSHIP: 'Identify every contributing actor.',
  BUILDER_VERIFIER_COLLAPSE: 'Use a verifier distinct from the producer.',
  CORRELATED_LINEAGE: 'Provide at least two independent lineages without copied context.',
  DISSENT_DROPPED: 'Preserve material dissent in the review packet.',
  STALE_BASE_REVISION: 'Rebase or review the artifact against the current revision.',
  WRITE_LEASE_INVALID: 'Obtain a valid write lease before applying changes.',
  ROLLBACK_MISSING: 'Provide a rollback reference.',
  PARENT_BUDGET_EXCEEDED: 'Reduce child reservations to the parent budget.',
  CONCURRENCY_LIMIT_EXCEEDED: 'Reduce concurrency to the declared limit.',
  EXPIRED_WORK_ACTIVE: 'Stop or renew expired work explicitly.',
  TRIPWIRE_NOT_STOPPED: 'Stop work when a tripwire is active.',
  INCIDENT_EVIDENCE_MISSING: 'Attach incident evidence before recovery.',
  RESUME_AUTHORIZATION_MISSING: 'Require explicit authorization before resuming.',
  HUMAN_DECISION_NOT_EXPLICIT: 'Record an explicit human decision and decision ID.',
  ORCHESTRATOR_SELF_APPROVAL: 'Route approval to a human or independent authorized reviewer.',
  CANON_WITHOUT_HUMAN_GATE: 'Keep CANON false until a human governance gate approves it.',
  UNKNOWN_FAMILY: 'The selected seed family has no local validator.'
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function sameCodes(actual, expected) {
  return actual.length === expected.length && actual.every((code, index) => code === expected[index]);
}

function validateFixture(fixture, entry) {
  const errors = [];
  const add = (condition, code) => {
    if (condition && !errors.includes(code)) errors.push(code);
  };
  const required = Array.isArray(entry.required_fixture_sections) ? entry.required_fixture_sections : REQUIRED_SECTIONS;
  for (const section of required) add(!Object.prototype.hasOwnProperty.call(fixture, section), `MISSING_SECTION:${section}`);
  if (errors.length) return { ok: false, errorCodes: errors };

  add(fixture.module_id !== entry.module_id, 'MODULE_ID_MISMATCH');
  add(fixture.proof_slice_id !== entry.proof_slice_id, 'PROOF_SLICE_ID_MISMATCH');
  add(fixture.registry_entry_digest !== entry.registry_entry_digest, 'REGISTRY_DIGEST_MISMATCH');
  add(fixture.family !== entry.family, 'FAMILY_MISMATCH');

  const actor = isObject(fixture.actor) ? fixture.actor : {};
  const authority = isObject(fixture.authority) ? fixture.authority : {};
  const privacy = isObject(fixture.privacy) ? fixture.privacy : {};
  const task = isObject(fixture.task) ? fixture.task : {};
  const routing = isObject(fixture.routing) ? fixture.routing : {};
  const handoff = isObject(fixture.handoff) ? fixture.handoff : {};
  const pattern = isObject(fixture.pattern) ? fixture.pattern : {};
  const verification = isObject(fixture.verification) ? fixture.verification : {};
  const artifact = isObject(fixture.artifact) ? fixture.artifact : {};
  const resources = isObject(fixture.resources) ? fixture.resources : {};
  const control = isObject(fixture.control) ? fixture.control : {};
  const human = isObject(fixture.human) ? fixture.human : {};
  const evidence = isObject(fixture.evidence) ? fixture.evidence : {};

  switch (fixture.family) {
    case 'identity_authority_privacy': {
      add(!actor.identity_id || actor.identity_id === actor.route_id, 'IDENTITY_INFERRED_FROM_ROUTE');
      const parent = new Set(Array.isArray(authority.allowed_actions) ? authority.allowed_actions : []);
      const child = Array.isArray(authority.child_actions) ? authority.child_actions : [];
      add(!!authority.scope_broadened || child.some(action => !parent.has(action)), 'AUTHORITY_SCOPE_BROADENED');
      add(!!privacy.context_contains_private && !privacy.transfer_authorized, 'PRIVATE_CONTEXT_UNAUTHORIZED');
      break;
    }
    case 'task_contracts':
      add(!String(task.goal || '').trim(), 'TASK_GOAL_MISSING');
      add((['ACCEPTED', 'ACTIVE', 'RETURNED', 'UNDER_REVIEW'].includes(task.state) || !!task.result_accepted) && !task.acceptance_receipt, 'ACCEPTANCE_RECEIPT_MISSING');
      add(!!task.result_accepted && !task.review_receipt, 'RESULT_ACCEPTED_BEFORE_REVIEW');
      break;
    case 'routing_allocation':
      add(!!routing.selected && !routing.eligible, 'INELIGIBLE_SEAT_SELECTED');
      add(!!routing.selected_by_self_confidence_only || !Array.isArray(routing.evidence_history_refs) || !routing.evidence_history_refs.length, 'SELF_CONFIDENCE_USED_AS_AUTHORITY');
      break;
    case 'handoff_continuity':
      add(['ACTIVE', 'RETURNED'].includes(handoff.receiver_state) && !handoff.receiver_acceptance_receipt, 'RECEIVER_ACTIVE_BEFORE_ACCEPTANCE');
      add(Number(handoff.depth || 0) > Number(handoff.max_depth || 0), 'HANDOFF_DEPTH_EXCEEDED');
      add(!!handoff.private_context_included && !privacy.transfer_authorized, 'PRIVATE_CONTEXT_UNAUTHORIZED');
      break;
    case 'collaboration_patterns':
      add(!pattern.human_visible, 'HIDDEN_COLLABORATION');
      add(!pattern.merge_gate_required, 'MERGE_GATE_BYPASSED');
      add(!!pattern.hidden_coauthor, 'HIDDEN_COAUTHORSHIP');
      break;
    case 'dissent_verification': {
      const lineages = Array.isArray(verification.lineage_ids) ? verification.lineage_ids : [];
      add(verification.producer_id === verification.verifier_id, 'BUILDER_VERIFIER_COLLAPSE');
      add(lineages.length < 2 || new Set(lineages).size < 2 || !!verification.copied_context, 'CORRELATED_LINEAGE');
      add(!verification.dissent_preserved, 'DISSENT_DROPPED');
      break;
    }
    case 'artifacts_merge':
      add(artifact.actual_revision !== artifact.expected_revision, 'STALE_BASE_REVISION');
      add(!artifact.write_lease_valid, 'WRITE_LEASE_INVALID');
      add(!artifact.rollback_ref, 'ROLLBACK_MISSING');
      break;
    case 'resources_scheduling': {
      const reservations = Array.isArray(resources.child_reservations) ? resources.child_reservations : [];
      add(reservations.reduce((sum, value) => sum + Number(value || 0), 0) > Number(resources.parent_limit || 0), 'PARENT_BUDGET_EXCEEDED');
      add(Number(resources.concurrency || 0) > Number(resources.concurrency_limit || 0), 'CONCURRENCY_LIMIT_EXCEEDED');
      add(!!resources.expired && !!resources.active, 'EXPIRED_WORK_ACTIVE');
      break;
    }
    case 'guardrails_recovery':
      add(!!control.tripwire && !control.stopped, 'TRIPWIRE_NOT_STOPPED');
      add(!!control.tripwire && (!Array.isArray(evidence.incident_evidence_refs) || !evidence.incident_evidence_refs.length), 'INCIDENT_EVIDENCE_MISSING');
      add(!!control.tripwire && !control.stopped && !control.resume_authorization, 'RESUME_AUTHORIZATION_MISSING');
      break;
    case 'human_governance':
      add(!human.explicit || !human.decision_id || !human.decision, 'HUMAN_DECISION_NOT_EXPLICIT');
      add(!!human.orchestrator_self_approval, 'ORCHESTRATOR_SELF_APPROVAL');
      add(!!human.canon, 'CANON_WITHOUT_HUMAN_GATE');
      break;
    default:
      add(true, 'UNKNOWN_FAMILY');
  }
  return { ok: !errors.length, errorCodes: errors };
}

function create(options = {}) {
  const root = path.resolve(options.root || path.join(__dirname, '..', '..'));
  const harnessRoot = path.join(root, 'intakes', 'ai-team-collaboration-runs-01-101-v1', 'proof-harness-v7');
  const registryPath = path.join(harnessRoot, 'registry', 'seed_registry.json');
  const latestRegistryPath = path.join(harnessRoot, 'registry', 'seed_registry_v7.json');
  const fixtureRoot = path.join(harnessRoot, 'fixtures');
  let cache = null;
  let checked = null;

  function load() {
    if (cache) return cache;
    const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
    const latest = JSON.parse(fs.readFileSync(latestRegistryPath, 'utf8'));
    if (registry.seed_count !== 100 || registry.entries.length !== 100 || latest.registry_version !== '7.0.0' || latest.entries.length !== 100) {
      throw new Error('AI Team contract runtime registries are missing or invalid');
    }
    const latestById = new Map(latest.entries.map(entry => [entry.module_id, entry]));
    const entries = registry.entries.map(entry => {
      const current = latestById.get(entry.module_id);
      if (!current || current.proof_slice_id !== entry.proof_slice_id || current.family !== entry.family) {
        throw new Error(`AI Team seed lineage mismatch: ${entry.module_id}`);
      }
      return { validation: entry, current };
    });
    cache = { entries, byId: new Map(entries.map(pair => [pair.validation.module_id, pair])) };
    return cache;
  }

  function locate(moduleId) {
    const pair = load().byId.get(String(moduleId || '').trim());
    if (!pair) throw new Error('Unknown AI Team seed module ID');
    return pair;
  }

  function fixturePath(pair, variant) {
    return path.join(fixtureRoot, variant === 'unsafe' ? 'mutated' : 'valid', `${pair.validation.proof_slice_id}.json`);
  }

  function readFixture(pair, variant) {
    return JSON.parse(fs.readFileSync(fixturePath(pair, variant), 'utf8'));
  }

  function explain(code) {
    if (code.startsWith('MISSING_SECTION:')) return `Add the required ${code.split(':')[1]} section.`;
    return ERROR_DETAILS[code] || 'Review this hold against the retained source contract.';
  }

  function validate(request = {}) {
    if (!isObject(request.fixture)) throw new Error('fixture must be a JSON object');
    const moduleId = String(request.moduleId || request.fixture.module_id || '').trim();
    const pair = locate(moduleId);
    const result = validateFixture(request.fixture, pair.validation);
    return {
      ok: result.ok,
      schema: VALIDATION_SCHEMA,
      status: result.ok ? 'PASS' : 'HOLD',
      authority: 'NONE',
      sideEffects: false,
      automaticExecution: false,
      validator: 'AXM_LOCAL_PORT_OF_RETAINED_SOURCE_VALIDATOR',
      seed: {
        seedNumber: pair.current.seed_number,
        moduleId: pair.current.module_id,
        name: pair.current.name,
        family: pair.current.family,
        riskTier: pair.current.risk_tier,
        proofSliceId: pair.current.proof_slice_id
      },
      errorCodes: result.errorCodes,
      findings: result.errorCodes.map(code => ({ code, guidance: explain(code) })),
      truth: {
        localContractPreflightExecuted: true,
        liveAgentExecuted: false,
        providerOrConnectorContacted: false,
        authorityChanged: false,
        canonChanged: false
      }
    };
  }

  function sample(request = {}) {
    const pair = locate(request.moduleId);
    const variant = request.variant === 'unsafe' ? 'unsafe' : 'valid';
    const source = readFixture(pair, variant);
    const expected = isObject(source.expected_validation) ? clone(source.expected_validation) : null;
    delete source.expected_validation;
    delete source.private_context;
    return {
      ok: true,
      schema: SAMPLE_SCHEMA,
      variant: variant.toUpperCase(),
      moduleId: pair.current.module_id,
      seedNumber: pair.current.seed_number,
      expected,
      fixture: source,
      note: 'Sample data only. Loading it does not start work or grant authority.'
    };
  }

  function selfCheck() {
    if (checked) return checked;
    const failures = [];
    const familyCounts = {};
    for (const pair of load().entries) {
      familyCounts[pair.current.family] = (familyCounts[pair.current.family] || 0) + 1;
      for (const variant of ['valid', 'unsafe']) {
        const fixture = readFixture(pair, variant);
        const expected = fixture.expected_validation || {};
        const actual = validateFixture(fixture, pair.validation);
        const expectedCodes = Array.isArray(expected.error_codes) ? expected.error_codes : [];
        if (actual.ok !== expected.ok || !sameCodes(actual.errorCodes, expectedCodes)) {
          failures.push({ moduleId: pair.current.module_id, variant, expected, actual });
        }
      }
    }
    checked = {
      ok: failures.length === 0,
      schema: STATUS_SCHEMA,
      status: failures.length ? 'HOLD' : 'READY',
      mode: 'DETERMINISTIC_LOCAL_CONTRACT_PREFLIGHT',
      seedCoverage: load().entries.length,
      familyEvaluatorCount: Object.keys(familyCounts).length,
      fixtureChecks: load().entries.length * 2,
      validFixturesPassed: failures.filter(row => row.variant === 'valid').length ? 0 : load().entries.length,
      unsafeFixturesHeld: failures.filter(row => row.variant === 'unsafe').length ? 0 : load().entries.length,
      failures: failures.slice(0, 20),
      familyCounts,
      sideEffects: false,
      liveAgentExecution: false,
      providerExecution: false,
      authority: 'NONE',
      canon: false
    };
    return checked;
  }

  return { validate, sample, status: selfCheck, validateFixture, schemas: { validation: VALIDATION_SCHEMA, sample: SAMPLE_SCHEMA, status: STATUS_SCHEMA } };
}

module.exports = { create, validateFixture, VALIDATION_SCHEMA, SAMPLE_SCHEMA, STATUS_SCHEMA };
