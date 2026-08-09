'use strict';

const fs = require('fs');
const path = require('path');
const Codec = require('./canonical');
const GameContracts = require('./contracts');
const GameCompiler = require('./compiler');
const GameRunner = require('./runner');
const StepReceipts = require('./step-receipt-contract');

const START_CONFIRMATION = 'RUN PRODUCTION CANDIDATE';
const ADAPTER = Object.freeze({ id: 'axm.production-profile.game-runner-adapter', version: '0.1.0' });
const SCHEMAS = Object.freeze({
  intent: 'axm.production-intent-lock/v1',
  package: 'axm.production-package/v1',
  graph: 'axm.production-graph/v1',
  plan: 'axm.production-plan/v1',
  step: StepReceipts.SCHEMAS.production,
  runState: 'axm.production-run-state/v1',
  run: 'axm.production-run/v1',
  binding: 'axm.production-profile-binding/v1'
});

function exactPortableRecord(value, schema, label) {
  if (!value || value.schema !== schema) throw new Error(label + ' schema mismatch');
  if (!Codec.validDigest(value)) throw new Error(label + ' exact canonical digest mismatch');
  return value;
}

function sameRef(ref, value) {
  return !!ref && ref.id === value.id && ref.version === value.version && ref.digest === value.digest;
}

function internalRecord(value, schema) {
  const copy = Codec.clone(value);
  copy.schema = schema;
  return Codec.seal(copy);
}

function validatePortableReferences(spec) {
  const packages = spec.packages || [];
  const ids = packages.map((pkg) => pkg.id);
  if (!packages.length || new Set(ids).size !== ids.length) throw new Error('portable packages must be non-empty with unique ids');
  if (!sameRef(spec.graph.intent_ref, spec.intent)) throw new Error('portable graph intent_ref mismatch');
  const nodes = new Map((spec.graph.nodes || []).map((node) => [node && node.package_id, node && node.package_digest]));
  if (nodes.size !== packages.length || packages.some((pkg) => nodes.get(pkg.id) !== pkg.digest)) throw new Error('portable graph package binding mismatch');
}

function adaptSpec(spec) {
  spec = spec || {};
  exactPortableRecord(spec.intent, SCHEMAS.intent, 'portable intent');
  if (!Array.isArray(spec.packages)) throw new Error('portable packages must be an array');
  spec.packages.forEach((pkg, index) => exactPortableRecord(pkg, SCHEMAS.package, 'portable package ' + index));
  exactPortableRecord(spec.graph, SCHEMAS.graph, 'portable graph');
  validatePortableReferences(spec);

  const intent = internalRecord(spec.intent, GameContracts.SCHEMAS.intent);
  const packages = spec.packages.map((pkg) => internalRecord(pkg, GameContracts.SCHEMAS.package));
  const packageMap = new Map(packages.map((pkg) => [pkg.id, pkg]));
  const graphSource = Codec.clone(spec.graph);
  graphSource.schema = GameContracts.SCHEMAS.graph;
  graphSource.intent_ref = { id: intent.id, version: intent.version, digest: intent.digest };
  graphSource.nodes = graphSource.nodes.map((node) => ({ package_id: node.package_id, package_digest: packageMap.get(node.package_id).digest }));
  const graph = Codec.seal(graphSource);

  GameContracts.assertValid('intent', intent);
  packages.forEach((pkg) => GameContracts.assertValid('package', pkg));
  GameContracts.assertValid('graph', graph, { intent, packages });

  const binding = Codec.seal({
    schema: SCHEMAS.binding,
    adapter: ADAPTER,
    domain: spec.intent.target.domain,
    portable: {
      intent_ref: { id: spec.intent.id, version: spec.intent.version, digest: spec.intent.digest },
      graph_ref: { id: spec.graph.id, version: spec.graph.version, digest: spec.graph.digest },
      package_refs: spec.packages.map((pkg) => ({ id: pkg.id, version: pkg.version, digest: pkg.digest }))
    },
    internal: {
      intent_ref: { id: intent.id, version: intent.version, digest: intent.digest },
      graph_ref: { id: graph.id, version: graph.version, digest: graph.digest },
      package_refs: packages.map((pkg) => ({ id: pkg.id, version: pkg.version, digest: pkg.digest }))
    },
    authority: { execution: false, install: false, promote: false, canon: false }
  });
  return { internal: { intent, packages, graph, source_anchor: 'portable-profile:' + String(spec.source_anchor || spec.graph.digest) }, binding };
}

function compile(spec, inventory) {
  const adapted = adaptSpec(spec);
  const internalPlan = GameCompiler.compile(adapted.internal, inventory);
  const binding = Codec.seal(Object.assign({}, Codec.clone(adapted.binding), { internal_plan_digest: internalPlan.digest }));
  return Codec.seal({
    schema: SCHEMAS.plan,
    version: '0.1.0',
    status: internalPlan.status,
    domain: spec.intent.target.domain,
    intent_ref: { id: spec.intent.id, version: spec.intent.version, digest: spec.intent.digest },
    graph_ref: { id: spec.graph.id, version: spec.graph.version, digest: spec.graph.digest },
    source_anchor: String(spec.source_anchor || 'portable-profile-local'),
    execution_order: internalPlan.execution_order.slice(),
    package_refs: internalPlan.package_refs.map((ref) => {
      const source = spec.packages.find((pkg) => pkg.id === ref.id);
      return { id: source.id, version: source.version, digest: source.digest, executor: Codec.clone(ref.executor), verifier: Codec.clone(ref.verifier) };
    }),
    capability_gaps: Codec.clone(internalPlan.capability_gaps),
    policy: Codec.clone(internalPlan.policy),
    adapter_binding: binding,
    limitations: ['Execution is adapter-hosted by the experimental Game Production Runner v0.1.', 'Cross-domain success proves orchestration mechanics only, not domain quality.']
  });
}

function inventoryFrom(executors, verifiers) {
  return {
    executors: (executors || []).map((item) => Codec.clone(item.identity)),
    verifiers: (verifiers || []).map((item) => Codec.clone(item.identity))
  };
}

function portableState(state, plan, stepReceiptSchema, legacyStepReceiptSchema) {
  const portable = {
    schema: SCHEMAS.runState,
    id: state.id,
    state: state.status,
    overall_verdict: state.overall_verdict,
    plan_digest: plan.digest,
    completed_packages: Object.keys(state.steps || {}),
    attempt_counts: Codec.clone(state.attempts || {}),
    updated_at: state.updated_at,
    authority: { installed: false, promoted: false, canon: false, released: false }
  };
  if (!legacyStepReceiptSchema) portable.step_receipt_schema = stepReceiptSchema;
  return Codec.seal(portable);
}

function portableReceipt(result, plan, binding) {
  if (!result.runReceipt) return null;
  const receipt = {
    schema: SCHEMAS.run,
    id: result.runReceipt.id,
    version: '0.1.0',
    state: result.runReceipt.state,
    domain: plan.domain,
    intent_ref: Codec.clone(plan.intent_ref),
    graph_ref: Codec.clone(plan.graph_ref),
    source_anchor: plan.source_anchor,
    started_at: result.runReceipt.started_at,
    updated_at: result.runReceipt.updated_at,
    internal_step_receipts: Codec.clone(result.runReceipt.step_receipts),
    overall_verdict: result.runReceipt.overall_verdict,
    human_review: result.runReceipt.human_review,
    adapter: { id: ADAPTER.id, version: ADAPTER.version, binding_digest: binding.digest, internal_plan_digest: binding.internal_plan_digest, internal_run_digest: result.runReceipt.digest },
    authority: Codec.clone(result.runReceipt.authority),
    limitations: result.legacyStepReceiptSchema
      ? ['Internal step receipts retain axm.game-step-receipt/v1 until a neutral runner kernel is independently proven.', 'This receipt does not assert domain quality or receiver acceptance.']
      : ['Step receipts use axm.production-step-receipt/v1 through the adapter-hosted experimental runner.', 'This receipt does not assert domain quality or receiver acceptance.']
  };
  if (!result.legacyStepReceiptSchema) receipt.step_receipt_schema = result.stepReceiptSchema;
  return Codec.seal(receipt);
}

function preservePortableReceipt(runDir, receipt) {
  if (!receipt) return null;
  const file = path.join(runDir, 'portable-run-receipt.json');
  if (fs.existsSync(file)) {
    const existing = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!Codec.validDigest(existing) || Codec.canonical(existing) !== Codec.canonical(receipt)) throw new Error('portable run receipt drift blocks resume');
    return file;
  }
  const temporary = file + '.next';
  fs.writeFileSync(temporary, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
  fs.renameSync(temporary, file);
  return file;
}

async function run(options) {
  options = options || {};
  if (options.confirmation !== START_CONFIRMATION) throw new Error('explicit portable production confirmation is required');
  const inventory = inventoryFrom(options.executors, options.verifiers);
  const expectedPlan = compile(options.spec, inventory);
  if (!options.plan || options.plan.digest !== expectedPlan.digest || !Codec.validDigest(options.plan)) throw new Error('portable plan digest mismatch');
  if (expectedPlan.status !== 'READY') throw new Error('held portable plan may not execute');
  const adapted = adaptSpec(options.spec);
  const internalPlan = GameCompiler.compile(adapted.internal, inventory);
  const binding = expectedPlan.adapter_binding;
  const result = await GameRunner.run({
    plan: internalPlan,
    packages: adapted.internal.packages,
    executors: options.executors,
    verifiers: options.verifiers,
    receiptValidator: options.receiptValidator,
    jobRoot: options.jobRoot,
    cacheRoot: options.cacheRoot,
    sourceRoot: options.sourceRoot,
    runId: options.runId,
    confirmation: GameRunner.START_CONFIRMATION,
    resume: options.resume,
    maxSteps: options.maxSteps,
    cancelled: options.cancelled,
    clock: options.clock,
    leaseClock: options.leaseClock,
    seed: options.seed,
    stepReceiptProfile: StepReceipts.PROFILES.production,
    allowLegacyGameStepReceipts: true
  });
  const receipt = portableReceipt(result, expectedPlan, binding);
  const receiptFile = preservePortableReceipt(result.runDir, receipt);
  return {
    state: portableState(result.state, expectedPlan, result.stepReceiptSchema, result.legacyStepReceiptSchema),
    runReceipt: receipt,
    checkpointReceipt: result.checkpointReceipt,
    cacheLeaseRelease: result.cacheLeaseRelease,
    runReceiptFile: receiptFile,
    runDir: result.runDir,
    internal: {
      plan_digest: internalPlan.digest,
      run_receipt_digest: result.runReceipt && result.runReceipt.digest,
      checkpoint_receipt_digest: result.checkpointReceipt && result.checkpointReceipt.digest,
      cache_lease_release_digest: result.cacheLeaseRelease && result.cacheLeaseRelease.digest,
      step_receipt_schema: result.stepReceiptSchema,
      legacy_step_receipt_schema: result.legacyStepReceiptSchema
    }
  };
}

module.exports = { START_CONFIRMATION, ADAPTER, SCHEMAS, adaptSpec, compile, run };
