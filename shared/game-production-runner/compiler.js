'use strict';

const Codec = require('./canonical');
const Contracts = require('./contracts');

function key(identity) { return identity.id + '@' + identity.version; }
function inventoryKeys(items) { return new Set((items || []).map((item) => key(item))); }

function compile(input, inventory) {
  input = input || {}; inventory = inventory || {};
  Contracts.assertValid('intent', input.intent);
  const packages = (input.packages || []).map((pkg) => Contracts.assertValid('package', pkg));
  if (!packages.length) throw new Contracts.ContractError('packages', ['at least one package is required']);
  const packageIds = packages.map((pkg) => pkg.id);
  if (new Set(packageIds).size !== packageIds.length) throw new Contracts.ContractError('packages', ['package ids must be unique']);
  Contracts.assertValid('graph', input.graph, { packages, intent: input.intent });

  const executors = inventoryKeys(inventory.executors);
  const verifiers = inventoryKeys(inventory.verifiers);
  const gaps = [];
  for (const pkg of packages) {
    if (!executors.has(key(pkg.executor))) gaps.push({ capability_id: 'executor:' + key(pkg.executor), package_id: pkg.id, gap_type: 'HAND' });
    if (!verifiers.has(key(pkg.verifier))) gaps.push({ capability_id: 'verifier:' + key(pkg.verifier), package_id: pkg.id, gap_type: 'EVIDENCE' });
  }
  const order = Contracts.topologicalOrder(input.graph.nodes.map((node) => node.package_id), input.graph.edges);
  const plan = {
    schema: Contracts.SCHEMAS.plan,
    version: '0.1.0',
    status: gaps.length ? 'HELD' : 'READY',
    intent_ref: { id: input.intent.id, version: input.intent.version, digest: input.intent.digest },
    graph_ref: { id: input.graph.id, version: input.graph.version, digest: input.graph.digest },
    source_anchor: String(input.source_anchor || 'local-reviewed-head'),
    execution_order: order,
    package_refs: order.map((id) => {
      const pkg = packages.find((item) => item.id === id);
      return { id: pkg.id, version: pkg.version, digest: pkg.digest, executor: Codec.clone(pkg.executor), verifier: Codec.clone(pkg.verifier) };
    }),
    capability_gaps: gaps,
    policy: {
      explicit_start: true,
      execution: 'serial',
      network: false,
      source_write: false,
      verified_only_assembly: true,
      automatic_install: false,
      automatic_promotion: false,
      automatic_canon: false
    }
  };
  return Codec.seal(plan);
}

function validatePlan(plan, packages) {
  const errors = [];
  if (!plan || plan.schema !== Contracts.SCHEMAS.plan) errors.push('plan schema mismatch');
  if (!plan || !['READY', 'HELD'].includes(plan.status)) errors.push('plan status unsupported');
  if (!Codec.validDigest(plan)) errors.push('plan digest mismatch');
  if (!plan || !Array.isArray(plan.execution_order) || !plan.execution_order.length || new Set(plan.execution_order).size !== plan.execution_order.length) errors.push('plan execution order is invalid');
  const refs = new Map((plan && plan.package_refs || []).map((ref) => [ref.id, ref]));
  if ((plan && plan.execution_order || []).some((id) => !refs.has(id))) errors.push('plan order references an unknown package');
  for (const pkg of packages || []) { const ref = refs.get(pkg.id); if (!ref || ref.digest !== pkg.digest) errors.push('plan package digest mismatch for ' + pkg.id); }
  if (!plan || !plan.policy || plan.policy.explicit_start !== true || plan.policy.network !== false || plan.policy.source_write !== false || plan.policy.verified_only_assembly !== true) errors.push('plan policy widened authority');
  return errors;
}

module.exports = { compile, validatePlan, identityKey: key };
