'use strict';

const fs = require('fs');
const path = require('path');
const ContractRuntime = require('./contract-runtime');
const OperationRuntime = require('./operation-runtime');

const CATALOG_SCHEMA = 'axm.ai-team-steward-catalog/v1';
const PLAN_SCHEMA = 'axm.ai-team-steward-plan/v1';
const RISK = Object.freeze({ LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 });

function clean(value, limit = 240) {
  return String(value == null ? '' : value).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, limit);
}

function tokens(value) {
  return [...new Set(clean(value, 2000).toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(/\s+/).filter(word => word.length > 2))];
}

function label(value) {
  return clean(value, 100).split('_').map(word => word ? word[0].toUpperCase() + word.slice(1) : '').join(' ');
}

function summarize(row) {
  return {
    seedNumber: row.seed_number,
    moduleId: row.module_id,
    name: row.name,
    family: row.family,
    familyLabel: label(row.family),
    riskTier: row.risk_tier,
    capabilityFocus: row.capability_focus,
    criticalInvariant: row.critical_invariant,
    holdRule: row.hold_rule,
    ownerSeamCandidate: row.owner_seam_candidate,
    dependencyModuleIds: Array.isArray(row.dependency_module_ids) ? row.dependency_module_ids.slice() : [],
    proofSliceId: row.proof_slice_id,
    canonStatus: row.canon_status,
    runtimeStatus: row.runtime_status,
    sourceUrl: '/shared/ai-team-steward/source-intake-v1/proof-harness-v7/registry/seed_registry_v7.json'
  };
}

function create(options = {}) {
  const root = path.resolve(options.root || path.join(__dirname, '..', '..'));
  const registryPath = path.join(root, 'shared', 'ai-team-steward', 'source-intake-v1', 'proof-harness-v7', 'registry', 'seed_registry_v7.json');
  const runtime = ContractRuntime.create({ root });
  const operations = OperationRuntime.create();

  function load() {
    const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
    if (!registry || registry.registry_version !== '7.0.0' || !Array.isArray(registry.entries) || registry.entries.length !== 100) {
      throw new Error('AI Team Steward registry is missing or invalid');
    }
    return registry;
  }

  function catalog() {
    const registry = load();
    const runtimeStatus = runtime.status();
    const operationStatus = operations.status();
    const entries = registry.entries.map(row => ({
      ...summarize(row),
      localIntegrationStatus: runtimeStatus.ok ? 'LOCAL_PREFLIGHT_AVAILABLE' : 'LOCAL_PREFLIGHT_HOLD',
      localOperation: 'VALIDATE_CONTRACT_FIXTURE'
    }));
    const families = [...new Set(entries.map(row => row.family))].sort().map(id => ({
      id,
      label: label(id),
      count: entries.filter(row => row.family === id).length
    }));
    const riskCounts = Object.fromEntries(Object.keys(RISK).map(tier => [tier, entries.filter(row => row.riskTier === tier).length]));
    return {
      ok: true,
      schema: CATALOG_SCHEMA,
      status: 'TEST_HOLD',
      authority: 'NONE',
      canon: false,
      automaticExecution: false,
      sourceHarnessVersion: registry.registry_version,
      sourceRuntimeIntegrated: registry.axm_runtime_integrated,
      localRuntimeIntegration: runtimeStatus,
      localOperationRuntime: operationStatus,
      seedCount: entries.length,
      familyCount: families.length,
      sourceUnitTestsPassed: 154,
      families,
      riskCounts,
      entries,
      existingAxmEntryPoint: '/tools/ai-team/index.html',
      truth: {
        deterministicContractEvidence: true,
        localContractPreflight: runtimeStatus.ok,
        deterministicLocalOperations: operationStatus.ok,
        liveTeamRuntimeProof: false,
        liveModelConnectorDeviceHumanEvidence: false,
        previewScope: 'REVIEW_PLANNING_AND_LOCAL_CONTRACT_PREFLIGHT'
      }
    };
  }

  function plan(request = {}) {
    const registry = load();
    const goals = (Array.isArray(request.goals) ? request.goals : [request.goals]).map(value => clean(value, 120)).filter(Boolean).slice(0, 12);
    const explicitIds = (Array.isArray(request.moduleIds) ? request.moduleIds : []).map(value => clean(value, 120)).filter(Boolean).slice(0, 24);
    const requestedFamily = clean(request.family, 80);
    const riskCeiling = RISK[clean(request.riskCeiling, 20).toUpperCase()] ? clean(request.riskCeiling, 20).toUpperCase() : 'HIGH';
    const maxRecommendations = Math.max(1, Math.min(24, Number(request.maxRecommendations) || 12));
    const goalTokens = tokens(goals.join(' '));

    const recommendations = registry.entries.map(row => {
      const summary = summarize(row);
      if (RISK[summary.riskTier] > RISK[riskCeiling]) return null;
      if (requestedFamily && summary.family !== requestedFamily) return null;
      const fields = {
        name: summary.name,
        module: summary.moduleId,
        family: `${summary.family} ${summary.familyLabel}`,
        focus: summary.capabilityFocus,
        invariant: summary.criticalInvariant,
        hold: summary.holdRule,
        seam: summary.ownerSeamCandidate
      };
      let score = explicitIds.includes(summary.moduleId) ? 1000 : 0;
      const matchedFields = [];
      for (const [field, value] of Object.entries(fields)) {
        const haystack = tokens(value);
        const matches = goalTokens.filter(word => haystack.some(candidate => candidate === word || candidate.startsWith(word) || word.startsWith(candidate)));
        if (!matches.length) continue;
        const weight = { name: 10, module: 10, family: 8, focus: 7, invariant: 5, hold: 4, seam: 3 }[field];
        score += new Set(matches).size * weight;
        matchedFields.push(field);
      }
      if (!goalTokens.length && !explicitIds.includes(summary.moduleId)) score = 0;
      return score > 0 ? { ...summary, score, matchedFields } : null;
    }).filter(Boolean).sort((a, b) => b.score - a.score || a.seedNumber - b.seedNumber).slice(0, maxRecommendations);

    return {
      ok: true,
      schema: PLAN_SCHEMA,
      status: 'REVIEW_ONLY',
      authority: 'NONE',
      canon: false,
      automaticExecution: false,
      existingAiTeamChanged: false,
      goals,
      filters: { family: requestedFamily || 'ALL', riskCeiling, maxRecommendations },
      recommendations,
      limits: [
        'No agent, model, connector, tool, or task is started',
        'No authority, approval, merge, shared memory, or CANON change is granted',
        'A recommendation is not proof that the seed exists in AXM runtime',
        'Human review is required before any implementation or consequential action'
      ]
    };
  }

  return {
    catalog,
    plan,
    runtimeStatus: runtime.status,
    sample: runtime.sample,
    validate: runtime.validate,
    operationCatalog: operations.catalog,
    executeOperation: operations.execute,
    schema: PLAN_SCHEMA,
    catalogSchema: CATALOG_SCHEMA,
    runtimeSchemas: runtime.schemas,
    operationSchemas: operations.schemas,
    registryPath
  };
}

module.exports = { create, CATALOG_SCHEMA, PLAN_SCHEMA, RISK };
