'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Core = require('./index');

let checks = 0;
function ok(value, message) { assert.ok(value, message); checks += 1; }
function equal(actual, expected, message) { assert.deepStrictEqual(actual, expected, message); checks += 1; }
function throws(fn, pattern, message) { assert.throws(fn, pattern, message); checks += 1; }
async function rejects(fn, pattern, message) { await assert.rejects(fn, pattern, message); checks += 1; }
function clock() { let tick = 0; return () => new Date(Date.UTC(2000, 0, 1, 0, 0, tick++)).toISOString(); }
function lines(file) { return fs.readFileSync(file, 'utf8').trim().split(/\r?\n/).filter(Boolean); }

function resealGraph(spec) {
  spec.graph.nodes = spec.packages.map((pkg) => ({ package_id: pkg.id, package_digest: pkg.digest }));
  spec.graph = Core.canonical.seal(spec.graph);
  return spec;
}

async function main() {
  equal(Core.canonical.canonical({ b: 2, a: 1 }), '{"a":1,"b":2}', 'canonical object keys are sorted');
  equal(Core.canonical.digest({ a: 1, b: 2 }), Core.canonical.digest({ b: 2, a: 1 }), 'canonical digest ignores insertion order');
  throws(() => Core.canonical.canonical(NaN), /non-finite/, 'non-finite numbers are refused');
  const cycle = {}; cycle.self = cycle;
  throws(() => Core.canonical.canonical(cycle), /cycles/, 'cycles are refused');
  const sparse = []; sparse[1] = 1;
  throws(() => Core.canonical.canonical(sparse), /sparse/, 'sparse arrays are refused');
  const accessor = {}; Object.defineProperty(accessor, 'value', { enumerable: true, get() { throw new Error('must not execute'); } });
  throws(() => Core.canonical.canonical(accessor), /accessors/, 'accessors are refused without invocation');
  const sealed = Core.canonical.seal({ schema: 'fixture', value: 1 });
  ok(Core.canonical.validDigest(sealed), 'sealed record verifies');
  sealed.value = 2;
  ok(!Core.canonical.validDigest(sealed), 'tampered record is rejected');

  const registry = Core.fixtures.create();
  const spec = Core.proofyard.build({ includeHumanReview: false });
  equal(Core.contracts.validateIntent(spec.intent), [], 'locked intent validates');
  ok(spec.packages.every((pkg) => Core.contracts.validatePackage(pkg).length === 0), 'all foundation packages validate');
  equal(Core.contracts.validateGraph(spec.graph, spec.packages, spec.intent), [], 'production graph validates');
  const planA = Core.compiler.compile(spec, registry.inventory);
  const planB = Core.compiler.compile(Core.canonical.clone(spec), registry.inventory);
  equal(planA.digest, planB.digest, 'unchanged compile is deterministic');

  const portableSpec = Core.portableFixture.build();
  const portablePlanA = Core.portable.compile(portableSpec, registry.inventory);
  const portablePlanB = Core.portable.compile(Core.canonical.clone(portableSpec), registry.inventory);
  equal(portablePlanA.schema, Core.portable.SCHEMAS.plan, 'portable profile emits a neutral plan schema');
  equal(Core.portable.SCHEMAS.step, 'axm.production-step-receipt/v1', 'portable profile declares the neutral step receipt schema');
  const productionStepSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'schemas', 'production-step-receipt.schema.json'), 'utf8'));
  equal(productionStepSchema.properties.schema.const, Core.portable.SCHEMAS.step, 'neutral step receipt schema document and runtime constant agree');
  equal(portablePlanA.domain, 'documentation', 'portable plan preserves the non-game domain');
  equal(portablePlanA.digest, portablePlanB.digest, 'portable adaptation and compilation are deterministic');
  ok(Core.canonical.validDigest(portablePlanA.adapter_binding), 'portable-to-internal binding is sealed');
  equal(portablePlanA.adapter_binding.authority.execution, false, 'profile binding grants no execution authority');
  equal(Core.portable.compile(portableSpec, { executors: registry.inventory.executors, verifiers: [] }).status, 'HELD', 'portable plan fails closed when its verifier is unavailable');
  const portableTamper = Core.canonical.clone(portableSpec);
  portableTamper.intent.human_goal = 'silently changed';
  throws(() => Core.portable.compile(portableTamper, registry.inventory), /digest mismatch/, 'portable intent mutation cannot compile');
  const portableRefTamper = Core.canonical.clone(portableSpec);
  portableRefTamper.graph.intent_ref.digest = 'f'.repeat(64);
  portableRefTamper.graph = Core.canonical.seal(portableRefTamper.graph);
  throws(() => Core.portable.compile(portableRefTamper, registry.inventory), /intent_ref mismatch/, 'resealed portable graph cannot detach from its intent');

  const documentRegistry = Core.documentRegistry.create();
  const documentSpec = Core.portableDocuments.build();
  const documentPlan = Core.portable.compile(documentSpec, documentRegistry.inventory);
  equal(documentPlan.status, 'READY', 'content-verified documentation profile is ready');
  ok(Core.documentRegistry.EXECUTOR.id !== Core.documentRegistry.VERIFIER.id, 'documentation producer and verifier identities are separate');
  equal(documentPlan.domain, 'documentation', 'content-verified profile retains its domain');
  const normalizedDocumentBrief = Core.documentRegistry.normalizeBrief(documentSpec.packages[0].document_payload);
  const renderedDocumentBrief = Core.documentRegistry.renderReleaseNote(normalizedDocumentBrief);
  ok(Core.documentRegistry.inspectReleaseNote(renderedDocumentBrief, normalizedDocumentBrief), 'documentation verifier independently parses a correct deterministic draft');
  ok(!Core.documentRegistry.inspectReleaseNote(renderedDocumentBrief.replace(normalizedDocumentBrief.evidence[0], 'altered evidence'), normalizedDocumentBrief), 'documentation verifier rejects a semantically altered deterministic draft');
  const confinementSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'schemas', 'hand-process-confinement-probe.schema.json'), 'utf8'));
  equal(confinementSchema.$id, Core.confinement.SCHEMA, 'confinement schema document and runtime constant agree');
  const confinementInspection = Core.confinement.inspect({ clock: () => '2000-01-01T00:00:00.000Z' });
  equal(confinementInspection.status, 'NOT_PROBED', 'confinement inspection starts no child probes');
  equal(confinementInspection.execution_authority, false, 'confinement inspection grants no execution authority');
  const priorNodeOptions = process.env.NODE_OPTIONS;
  process.env.NODE_OPTIONS = '--require=AXM_GPR_PROBE_MUST_SCRUB';
  let confinement;
  try {
    confinement = await Core.confinement.probe({ explicitProbe: true, clock: () => '2000-01-01T00:00:00.000Z' });
  } finally {
    if (priorNodeOptions === undefined) delete process.env.NODE_OPTIONS;
    else process.env.NODE_OPTIONS = priorNodeOptions;
  }
  ok(Core.canonical.validDigest(confinement), 'confinement probe receipt is sealed');
  equal(confinement.cleanup, { temporary_root_removed: true, loopback_server_closed: true }, 'confinement probe cleans its temporary root and listener');
  equal(confinement.checks.map((item) => item.id), ['permission-api-available', 'filesystem-read-denied', 'filesystem-write-denied', 'child-process-denied', 'worker-thread-denied', 'loopback-network-denied'], 'confinement probe covers the declared capability set');
  ok(confinement.checks.slice(0, 5).every((item) => item.verdict === 'PASS'), 'permission API, filesystem, child-process, and worker denials pass');
  equal(confinement.checks[0].observed.outcome, 'AVAILABLE', 'confinement probe scrubs ambient NODE_* child settings');
  const networkConfinement = confinement.checks.find((item) => item.id === 'loopback-network-denied');
  equal(networkConfinement.observed.outcome, 'ALLOWED', 'supported Node 20-24 substrate does not deny loopback network');
  equal(confinement.status, 'DEGRADED', 'missing network denial holds the trusted Hand process substrate');
  equal(confinement.activation, { trusted_hand_process: 'HOLD', untrusted_code: 'REFUSED', execution_authority: false }, 'degraded confinement receipt refuses activation and untrusted code');
  ok(!/[A-Za-z]:\\/.test(JSON.stringify(confinement)), 'confinement receipt exposes no local machine path');
  const repeatedConfinement = await Core.confinement.probe({ explicitProbe: true, clock: () => '2000-01-01T00:00:00.000Z' });
  equal(repeatedConfinement.digest, confinement.digest, 'same runtime and clock produce the same confinement receipt digest');
  equal(planA.status, 'READY', 'exact fixture Hands make plan ready');
  equal(planA.execution_order, spec.packages.map((pkg) => pkg.id), 'serial order follows dependencies');
  const heldPlan = Core.compiler.compile(spec, { executors: [], verifiers: [] });
  equal(heldPlan.status, 'HELD', 'missing Hands hold the plan');
  equal(heldPlan.capability_gaps.length, spec.packages.length * 2, 'every missing executor and verifier is named');

  const tamperedIntent = Core.canonical.clone(spec.intent); tamperedIntent.human_goal = 'silently changed';
  throws(() => Core.compiler.compile(Object.assign({}, spec, { intent: tamperedIntent }), registry.inventory), /digest mismatch/, 'intent mutation cannot compile');
  const cyclic = Core.canonical.clone(spec); cyclic.graph.edges.push({ from: spec.packages[4].id, to: spec.packages[0].id }); cyclic.graph = Core.canonical.seal(cyclic.graph);
  ok(Core.contracts.validateGraph(cyclic.graph, cyclic.packages, cyclic.intent).some((error) => /cycle/.test(error)), 'cycle is held');
  let selfVerifying = Core.canonical.clone(spec.packages[0]); selfVerifying.verifier = Core.canonical.clone(selfVerifying.executor); selfVerifying = Core.canonical.seal(selfVerifying);
  ok(Core.contracts.validatePackage(selfVerifying).some((error) => /executor as verifier/.test(error)), 'self-verification is refused');
  let escaped = Core.canonical.clone(spec.packages[0]); escaped.outputs[0].path = '../escape'; escaped = Core.canonical.seal(escaped);
  ok(Core.contracts.validatePackage(escaped).some((error) => /output paths/.test(error)), 'path escape is refused at contract time');

  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'AXM-GPR-Selftest-'));
  const sourceRoot = path.resolve(__dirname, '..', '..');
  try {
    throws(() => Core.runner.assertJobRoot(sourceRoot, sourceRoot), /isolated/, 'source tree cannot be a job root');
    try {
      const linkedSource = path.join(temporary, 'linked-source');
      fs.symlinkSync(sourceRoot, linkedSource, 'junction');
      throws(() => Core.runner.assertJobRoot(path.join(linkedSource, 'candidate'), sourceRoot), /isolated|symbolic link|junction/, 'junction cannot disguise a source-tree job root');
    } catch (error) {
      if (!['EPERM', 'EACCES', 'UNKNOWN'].includes(error && error.code)) throw error;
    }
    await rejects(() => Core.runner.run({ plan: planA, packages: spec.packages, executors: registry.executors, verifiers: registry.verifiers, jobRoot: path.join(temporary, 'missing-confirm'), sourceRoot }), /explicit start/, 'run needs exact human confirmation');

    const complete = await Core.runner.run({ plan: planA, packages: spec.packages, executors: registry.executors, verifiers: registry.verifiers, receiptValidator: Core.adapters.verificationReceiptValidator(sourceRoot), jobRoot: path.join(temporary, 'complete'), sourceRoot, runId: 'complete-run', confirmation: Core.runner.START_CONFIRMATION, clock: clock() });
    equal(complete.state.status, 'CANDIDATE_READY', 'automated fixture path reaches candidate ready');
    equal(Object.keys(complete.state.steps).length, 5, 'all five packages execute');
    ok(Core.canonical.validDigest(complete.runReceipt), 'final run receipt is sealed');
    equal(complete.runReceipt.authority.installed, false, 'candidate is not installed');
    const gameLedger = lines(path.join(complete.runDir, 'step-receipts.jsonl')).map((line) => JSON.parse(line));
    equal(gameLedger.length, 5, 'step ledger is append-only and complete');
    ok(gameLedger.every((receipt) => receipt.schema === Core.stepReceipts.SCHEMAS.game), 'legacy game entry point retains game-scoped step receipts');
    equal(complete.runReceipt.step_receipt_schema, Core.stepReceipts.SCHEMAS.game, 'game run receipt declares its exact step receipt schema');
    equal(Core.stepReceipts.validate(gameLedger[0], Core.stepReceipts.SCHEMAS.game), [], 'runtime step contract accepts an exact emitted game receipt');
    const inventedReceiptField = Core.canonical.seal(Object.assign(Core.canonical.clone(gameLedger[0]), { invented_authority: true }));
    ok(Core.stepReceipts.validate(inventedReceiptField, Core.stepReceipts.SCHEMAS.game).some((error) => /undeclared field/.test(error)), 'runtime step contract rejects an undeclared receipt field');
    const terminalResume = await Core.runner.run({ plan: planA, packages: spec.packages, executors: registry.executors, verifiers: registry.verifiers, jobRoot: path.join(temporary, 'complete'), sourceRoot, runId: 'complete-run', confirmation: Core.runner.START_CONFIRMATION, resume: true, clock: clock() });
    equal(terminalResume.state.status, 'CANDIDATE_READY', 'terminal resume is read-only');
    equal(lines(path.join(complete.runDir, 'step-receipts.jsonl')).length, 5, 'terminal resume does not duplicate receipts');

    const terminalReceiptFile = path.join(complete.runDir, 'run-receipt.json');
    const corruptedTerminalReceipt = JSON.parse(fs.readFileSync(terminalReceiptFile, 'utf8'));
    corruptedTerminalReceipt.authority.installed = true;
    fs.writeFileSync(terminalReceiptFile, JSON.stringify(corruptedTerminalReceipt, null, 2) + '\n');
    await rejects(() => Core.runner.run({ plan: planA, packages: spec.packages, executors: registry.executors, verifiers: registry.verifiers, jobRoot: path.join(temporary, 'complete'), sourceRoot, runId: 'complete-run', confirmation: Core.runner.START_CONFIRMATION, resume: true, clock: clock() }), /terminal run receipt integrity/, 'terminal resume refuses a tampered authority receipt');

    const interruptedRoot = path.join(temporary, 'interrupted');
    const interrupted = await Core.runner.run({ plan: planA, packages: spec.packages, executors: registry.executors, verifiers: registry.verifiers, jobRoot: interruptedRoot, sourceRoot, runId: 'resume-run', confirmation: Core.runner.START_CONFIRMATION, maxSteps: 2, clock: clock() });
    equal(interrupted.state.status, 'INTERRUPTED', 'bounded stop preserves interrupted state');
    equal(Object.keys(interrupted.state.steps).length, 2, 'interruption stops at exact package boundary');
    const resumed = await Core.runner.run({ plan: planA, packages: spec.packages, executors: registry.executors, verifiers: registry.verifiers, jobRoot: interruptedRoot, sourceRoot, runId: 'resume-run', confirmation: Core.runner.START_CONFIRMATION, resume: true, clock: clock() });
    equal(resumed.state.status, 'CANDIDATE_READY', 'resume completes remaining packages');
    equal(lines(path.join(resumed.runDir, 'step-receipts.jsonl')).length, 5, 'resume preserves one receipt per successful package');

    const tamperRoot = path.join(temporary, 'tamper');
    const partial = await Core.runner.run({ plan: planA, packages: spec.packages, executors: registry.executors, verifiers: registry.verifiers, jobRoot: tamperRoot, sourceRoot, runId: 'tamper-run', confirmation: Core.runner.START_CONFIRMATION, maxSteps: 1, clock: clock() });
    const firstOutput = partial.state.steps[spec.packages[0].id].outputs[0];
    fs.appendFileSync(path.join(partial.runDir, firstOutput.run_relative_path), 'tamper');
    await rejects(() => Core.runner.run({ plan: planA, packages: spec.packages, executors: registry.executors, verifiers: registry.verifiers, jobRoot: tamperRoot, sourceRoot, runId: 'tamper-run', confirmation: Core.runner.START_CONFIRMATION, resume: true, clock: clock() }), /output drift/, 'resume refuses changed verified bytes');

    const stateTamperRoot = path.join(temporary, 'state-tamper');
    const statePartial = await Core.runner.run({ plan: planA, packages: spec.packages, executors: registry.executors, verifiers: registry.verifiers, jobRoot: stateTamperRoot, sourceRoot, runId: 'state-tamper-run', confirmation: Core.runner.START_CONFIRMATION, maxSteps: 1, clock: clock() });
    const stateFile = path.join(statePartial.runDir, 'run-state.json');
    const corruptedState = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    corruptedState.steps[spec.packages[0].id].receipt_digest = 'f'.repeat(64);
    fs.writeFileSync(stateFile, JSON.stringify(corruptedState, null, 2) + '\n');
    await rejects(() => Core.runner.run({ plan: planA, packages: spec.packages, executors: registry.executors, verifiers: registry.verifiers, jobRoot: stateTamperRoot, sourceRoot, runId: 'state-tamper-run', confirmation: Core.runner.START_CONFIRMATION, resume: true, clock: clock() }), /not bound to its step receipt/, 'resume refuses state that is detached from the receipt ledger');

    const ledgerTamperRoot = path.join(temporary, 'ledger-tamper');
    const ledgerPartial = await Core.runner.run({ plan: planA, packages: spec.packages, executors: registry.executors, verifiers: registry.verifiers, jobRoot: ledgerTamperRoot, sourceRoot, runId: 'ledger-tamper-run', confirmation: Core.runner.START_CONFIRMATION, maxSteps: 1, clock: clock() });
    const ledgerFile = path.join(ledgerPartial.runDir, 'step-receipts.jsonl');
    const corruptedLedger = JSON.parse(lines(ledgerFile)[0]);
    corruptedLedger.detail = 'tampered after sealing';
    fs.writeFileSync(ledgerFile, JSON.stringify(corruptedLedger) + '\n');
    await rejects(() => Core.runner.run({ plan: planA, packages: spec.packages, executors: registry.executors, verifiers: registry.verifiers, jobRoot: ledgerTamperRoot, sourceRoot, runId: 'ledger-tamper-run', confirmation: Core.runner.START_CONFIRMATION, resume: true, clock: clock() }), /ledger digest mismatch/, 'resume refuses a tampered receipt ledger');

    const chainTamperRoot = path.join(temporary, 'chain-tamper');
    const chainPartial = await Core.runner.run({ plan: planA, packages: spec.packages, executors: registry.executors, verifiers: registry.verifiers, jobRoot: chainTamperRoot, sourceRoot, runId: 'chain-tamper-run', confirmation: Core.runner.START_CONFIRMATION, maxSteps: 2, clock: clock() });
    const chainFile = path.join(chainPartial.runDir, 'step-receipts.jsonl');
    const chainLines = lines(chainFile);
    const resealedFirst = JSON.parse(chainLines[0]);
    resealedFirst.detail = 'individually resealed but detached from the next receipt';
    chainLines[0] = JSON.stringify(Core.canonical.seal(resealedFirst));
    fs.writeFileSync(chainFile, chainLines.join('\n') + '\n');
    await rejects(() => Core.runner.run({ plan: planA, packages: spec.packages, executors: registry.executors, verifiers: registry.verifiers, jobRoot: chainTamperRoot, sourceRoot, runId: 'chain-tamper-run', confirmation: Core.runner.START_CONFIRMATION, resume: true, clock: clock() }), /ledger chain mismatch/, 'resume refuses a resealed receipt that breaks the append-only chain');

    const missingEvidence = Core.proofyard.build({ includeHumanReview: false });
    delete missingEvidence.packages[1].fixture.facts.claims['player.moves'];
    missingEvidence.packages[1] = Core.canonical.seal(missingEvidence.packages[1]); resealGraph(missingEvidence);
    const missingPlan = Core.compiler.compile(missingEvidence, registry.inventory);
    const held = await Core.runner.run({ plan: missingPlan, packages: missingEvidence.packages, executors: registry.executors, verifiers: registry.verifiers, jobRoot: path.join(temporary, 'missing-evidence'), sourceRoot, runId: 'missing-evidence-run', confirmation: Core.runner.START_CONFIRMATION, clock: clock() });
    equal(held.state.status, 'HELD', 'missing behavioral evidence holds the run');
    ok(/lacks evidence/.test(held.state.hold_reason), 'hold names the missing evidence seam');

    const humanSpec = Core.proofyard.build({ includeHumanReview: true });
    const humanPlan = Core.compiler.compile(humanSpec, registry.inventory);
    const human = await Core.runner.run({ plan: humanPlan, packages: humanSpec.packages, executors: registry.executors, verifiers: registry.verifiers, jobRoot: path.join(temporary, 'human'), sourceRoot, runId: 'human-review-run', confirmation: Core.runner.START_CONFIRMATION, clock: clock() });
    equal(human.state.status, 'HUMAN_REVIEW', 'subjective game quality remains human review');
    equal(human.runReceipt.overall_verdict, 'HUMAN_REVIEW', 'final receipt preserves human judgment');

    await rejects(() => Core.portable.run({ spec: portableSpec, plan: portablePlanA, executors: registry.executors, verifiers: registry.verifiers, jobRoot: path.join(temporary, 'portable-denied'), sourceRoot, confirmation: Core.runner.START_CONFIRMATION, clock: clock() }), /portable production confirmation/, 'portable profile has its own explicit start phrase');
    const portable = await Core.portable.run({ spec: portableSpec, plan: portablePlanA, executors: registry.executors, verifiers: registry.verifiers, receiptValidator: Core.adapters.verificationReceiptValidator(sourceRoot), jobRoot: path.join(temporary, 'portable'), sourceRoot, runId: 'portable-doc-run', confirmation: Core.portable.START_CONFIRMATION, clock: clock() });
    equal(portable.state.state, 'CANDIDATE_READY', 'non-game profile reaches candidate ready through the same bounded mechanics');
    equal(portable.runReceipt.schema, Core.portable.SCHEMAS.run, 'portable profile emits a neutral run receipt');
    equal(portable.runReceipt.domain, 'documentation', 'portable receipt retains the source domain');
    equal(portable.state.step_receipt_schema, Core.portable.SCHEMAS.step, 'portable state declares the neutral step receipt schema');
    equal(portable.runReceipt.step_receipt_schema, Core.portable.SCHEMAS.step, 'portable run receipt declares the neutral step receipt schema');
    equal(portable.runReceipt.authority.installed, false, 'portable candidate is not installed');
    ok(Core.canonical.validDigest(portable.runReceipt), 'portable run receipt is sealed');
    ok(fs.existsSync(portable.runReceiptFile), 'portable run receipt is preserved beside internal evidence');
    const portableLedger = lines(path.join(portable.runDir, 'step-receipts.jsonl')).map((line) => JSON.parse(line));
    ok(portableLedger.every((receipt) => receipt.schema === Core.portable.SCHEMAS.step), 'portable ledger contains only neutral step receipts');
    const portableResume = await Core.portable.run({ spec: portableSpec, plan: portablePlanA, executors: registry.executors, verifiers: registry.verifiers, jobRoot: path.join(temporary, 'portable'), sourceRoot, runId: 'portable-doc-run', confirmation: Core.portable.START_CONFIRMATION, resume: true, clock: clock() });
    equal(portableResume.runReceipt.digest, portable.runReceipt.digest, 'portable terminal resume preserves exact receipt identity');
    equal(lines(path.join(portableResume.runDir, 'step-receipts.jsonl')).length, portableLedger.length, 'portable terminal resume does not duplicate neutral receipts');
    const internalPortableReceiptFile = path.join(portable.runDir, 'run-receipt.json');
    const internalPortableReceiptBytes = fs.readFileSync(internalPortableReceiptFile, 'utf8');
    const internalPortableReceiptTamper = JSON.parse(internalPortableReceiptBytes);
    internalPortableReceiptTamper.step_receipt_schema = Core.stepReceipts.SCHEMAS.game;
    fs.writeFileSync(internalPortableReceiptFile, JSON.stringify(Core.canonical.seal(internalPortableReceiptTamper), null, 2) + '\n');
    await rejects(() => Core.portable.run({ spec: portableSpec, plan: portablePlanA, executors: registry.executors, verifiers: registry.verifiers, jobRoot: path.join(temporary, 'portable'), sourceRoot, runId: 'portable-doc-run', confirmation: Core.portable.START_CONFIRMATION, resume: true, clock: clock() }), /terminal run receipt step schema mismatch/, 'portable resume refuses a resealed terminal schema substitution');
    fs.writeFileSync(internalPortableReceiptFile, internalPortableReceiptBytes);
    const portableReceiptFile = portable.runReceiptFile;
    const portableReceiptTamper = JSON.parse(fs.readFileSync(portableReceiptFile, 'utf8'));
    portableReceiptTamper.authority.installed = true;
    fs.writeFileSync(portableReceiptFile, JSON.stringify(portableReceiptTamper, null, 2) + '\n');
    await rejects(() => Core.portable.run({ spec: portableSpec, plan: portablePlanA, executors: registry.executors, verifiers: registry.verifiers, jobRoot: path.join(temporary, 'portable'), sourceRoot, runId: 'portable-doc-run', confirmation: Core.portable.START_CONFIRMATION, resume: true, clock: clock() }), /portable run receipt drift/, 'portable resume refuses a tampered adapter authority receipt');

    const neutralInterruptedRoot = path.join(temporary, 'neutral-interrupted');
    const neutralInterrupted = await Core.portable.run({ spec: portableSpec, plan: portablePlanA, executors: registry.executors, verifiers: registry.verifiers, jobRoot: neutralInterruptedRoot, sourceRoot, runId: 'neutral-interrupted-run', confirmation: Core.portable.START_CONFIRMATION, maxSteps: 1, clock: clock() });
    equal(neutralInterrupted.state.state, 'INTERRUPTED', 'neutral receipt run preserves interrupted state');
    equal(lines(path.join(neutralInterrupted.runDir, 'step-receipts.jsonl')).length, 1, 'neutral interruption stops at an exact receipt boundary');
    const neutralResumed = await Core.portable.run({ spec: portableSpec, plan: portablePlanA, executors: registry.executors, verifiers: registry.verifiers, jobRoot: neutralInterruptedRoot, sourceRoot, runId: 'neutral-interrupted-run', confirmation: Core.portable.START_CONFIRMATION, resume: true, clock: clock() });
    equal(neutralResumed.state.state, 'CANDIDATE_READY', 'neutral receipt run resumes to candidate ready');
    ok(lines(path.join(neutralResumed.runDir, 'step-receipts.jsonl')).map((line) => JSON.parse(line)).every((receipt) => receipt.schema === Core.portable.SCHEMAS.step), 'neutral resume never mixes step receipt schemas');

    const schemaTamperRoot = path.join(temporary, 'neutral-schema-tamper');
    const schemaTamper = await Core.portable.run({ spec: portableSpec, plan: portablePlanA, executors: registry.executors, verifiers: registry.verifiers, jobRoot: schemaTamperRoot, sourceRoot, runId: 'neutral-schema-tamper-run', confirmation: Core.portable.START_CONFIRMATION, maxSteps: 1, clock: clock() });
    const schemaTamperFile = path.join(schemaTamper.runDir, 'step-receipts.jsonl');
    const schemaTamperReceipt = JSON.parse(lines(schemaTamperFile)[0]);
    schemaTamperReceipt.schema = Core.stepReceipts.SCHEMAS.game;
    fs.writeFileSync(schemaTamperFile, JSON.stringify(Core.canonical.seal(schemaTamperReceipt)) + '\n');
    await rejects(() => Core.portable.run({ spec: portableSpec, plan: portablePlanA, executors: registry.executors, verifiers: registry.verifiers, jobRoot: schemaTamperRoot, sourceRoot, runId: 'neutral-schema-tamper-run', confirmation: Core.portable.START_CONFIRMATION, resume: true, clock: clock() }), /schema/, 'portable resume refuses a validly resealed game schema substitution');

    const legacyPortableRoot = path.join(temporary, 'legacy-portable');
    const legacyAdapted = Core.portable.adaptSpec(portableSpec);
    const legacyInternalPlan = Core.compiler.compile(legacyAdapted.internal, registry.inventory);
    const legacyPartial = await Core.runner.run({ plan: legacyInternalPlan, packages: legacyAdapted.internal.packages, executors: registry.executors, verifiers: registry.verifiers, jobRoot: legacyPortableRoot, sourceRoot, runId: 'legacy-portable-run', confirmation: Core.runner.START_CONFIRMATION, maxSteps: 1, clock: clock() });
    const legacyStateFile = path.join(legacyPartial.runDir, 'run-state.json');
    const legacyState = JSON.parse(fs.readFileSync(legacyStateFile, 'utf8'));
    delete legacyState.step_receipt_schema;
    fs.writeFileSync(legacyStateFile, JSON.stringify(legacyState, null, 2) + '\n');
    const legacyResumed = await Core.portable.run({ spec: portableSpec, plan: portablePlanA, executors: registry.executors, verifiers: registry.verifiers, jobRoot: legacyPortableRoot, sourceRoot, runId: 'legacy-portable-run', confirmation: Core.portable.START_CONFIRMATION, resume: true, clock: clock() });
    equal(legacyResumed.state.state, 'CANDIDATE_READY', 'pre-upgrade portable game ledger remains resumable');
    equal(legacyResumed.internal.step_receipt_schema, Core.stepReceipts.SCHEMAS.game, 'legacy continuation retains its original game receipt schema');
    equal(legacyResumed.internal.legacy_step_receipt_schema, true, 'legacy continuation is explicitly disclosed');
    ok(lines(path.join(legacyResumed.runDir, 'step-receipts.jsonl')).map((line) => JSON.parse(line)).every((receipt) => receipt.schema === Core.stepReceipts.SCHEMAS.game), 'legacy continuation never mixes neutral receipts into the old ledger');
    ok(!Object.prototype.hasOwnProperty.call(legacyResumed.runReceipt, 'step_receipt_schema'), 'legacy portable receipt preserves its pre-upgrade external shape');
    const legacyTerminalResume = await Core.portable.run({ spec: portableSpec, plan: portablePlanA, executors: registry.executors, verifiers: registry.verifiers, jobRoot: legacyPortableRoot, sourceRoot, runId: 'legacy-portable-run', confirmation: Core.portable.START_CONFIRMATION, resume: true, clock: clock() });
    equal(legacyTerminalResume.runReceipt.digest, legacyResumed.runReceipt.digest, 'legacy portable terminal resume preserves exact receipt identity');

    const documents = await Core.portable.run({ spec: documentSpec, plan: documentPlan, executors: documentRegistry.executors, verifiers: documentRegistry.verifiers, receiptValidator: Core.adapters.verificationReceiptValidator(sourceRoot), jobRoot: path.join(temporary, 'documents'), sourceRoot, runId: 'content-document-run', confirmation: Core.portable.START_CONFIRMATION, clock: clock() });
    equal(documents.state.state, 'CANDIDATE_READY', 'content-inspected documentation Hand reaches candidate ready');
    const documentLedger = lines(path.join(documents.runDir, 'step-receipts.jsonl')).map((line) => JSON.parse(line));
    equal(documentLedger.length, 3, 'documentation run preserves three independently verified steps');
    ok(documentLedger.every((receipt) => receipt.evidence[0].claims[0].evidence[0].kind === 'artifact-content-inspection'), 'documentation claims derive from artifact-content inspection');
    ok(documentLedger.every((receipt) => !JSON.stringify(receipt.evidence).includes('fixture-declaration')), 'documentation verifier does not rely on fixture declarations');
    const draftStep = documents.state.completed_packages.includes('document.release-note-draft');
    ok(draftStep, 'content-verified draft is present in the portable state');
    const draftReceipt = documentLedger.find((receipt) => receipt.package_ref.id === 'document.release-note-draft');
    const draftBytes = fs.readFileSync(path.join(documents.runDir, draftReceipt.outputs[0].run_relative_path), 'utf8');
    equal(draftBytes, renderedDocumentBrief, 'written draft bytes match the deterministic rendering');

    const lyingExecutor = {
      identity: Core.documentRegistry.EXECUTOR,
      execute(context) {
        return { artifacts: context.package.outputs.map((item) => ({ path: item.path, content: '{}' })), facts: { claims: Object.fromEntries(context.package.claims.map((claim) => [claim.id, true])) } };
      }
    };
    const lied = await Core.portable.run({ spec: documentSpec, plan: documentPlan, executors: [lyingExecutor], verifiers: documentRegistry.verifiers, jobRoot: path.join(temporary, 'lying-documents'), sourceRoot, runId: 'lying-document-run', confirmation: Core.portable.START_CONFIRMATION, clock: clock() });
    equal(lied.state.state, 'FAILED', 'content verifier rejects malformed bytes despite executor PASS facts');
    const liedLedger = lines(path.join(lied.runDir, 'step-receipts.jsonl')).map((line) => JSON.parse(line));
    ok(liedLedger.every((receipt) => receipt.verdict === 'FAILED'), 'executor testimony cannot convert failed content evidence into PASS');

    const escapingVerifier = {
      identity: Core.documentRegistry.VERIFIER,
      verify(context) { context.readArtifact('../undeclared'); return documentRegistry.verifiers[0].verify(context); }
    };
    const escapedVerification = await Core.portable.run({ spec: documentSpec, plan: documentPlan, executors: documentRegistry.executors, verifiers: [escapingVerifier], jobRoot: path.join(temporary, 'escaping-verifier'), sourceRoot, runId: 'escaping-verifier-run', confirmation: Core.portable.START_CONFIRMATION, clock: clock() });
    equal(escapedVerification.state.state, 'FAILED', 'verifier cannot read outside declared outputs');

    const mutatingVerifier = {
      identity: Core.documentRegistry.VERIFIER,
      verify(context) {
        context.readArtifact(context.package.outputs[0].path).fill(0);
        return documentRegistry.verifiers[0].verify(context);
      }
    };
    const mutationProof = await Core.portable.run({ spec: documentSpec, plan: documentPlan, executors: documentRegistry.executors, verifiers: [mutatingVerifier], jobRoot: path.join(temporary, 'mutating-verifier'), sourceRoot, runId: 'mutating-verifier-run', confirmation: Core.portable.START_CONFIRMATION, clock: clock() });
    equal(mutationProof.state.state, 'CANDIDATE_READY', 'verifier receives an isolated copy of declared artifact bytes');
    const mutationLedger = lines(path.join(mutationProof.runDir, 'step-receipts.jsonl')).map((line) => JSON.parse(line));
    const mutationDraftReceipt = mutationLedger.find((receipt) => receipt.package_ref.id === 'document.release-note-draft');
    const mutationDraftBytes = fs.readFileSync(path.join(mutationProof.runDir, mutationDraftReceipt.outputs[0].run_relative_path), 'utf8');
    equal(mutationDraftBytes, draftBytes, 'mutating a verifier byte copy cannot change runner-owned output');

    const undeclaredInputVerifier = {
      identity: Core.documentRegistry.VERIFIER,
      verify(context) {
        context.readInput('not-a-dependency', 'private/undeclared.txt');
        return documentRegistry.verifiers[0].verify(context);
      }
    };
    const undeclaredInput = await Core.portable.run({ spec: documentSpec, plan: documentPlan, executors: documentRegistry.executors, verifiers: [undeclaredInputVerifier], jobRoot: path.join(temporary, 'undeclared-input-verifier'), sourceRoot, runId: 'undeclared-input-verifier-run', confirmation: Core.portable.START_CONFIRMATION, clock: clock() });
    equal(undeclaredInput.state.state, 'FAILED', 'verifier cannot read undeclared dependency inputs');

    const cancelled = await Core.runner.run({ plan: planA, packages: spec.packages, executors: registry.executors, verifiers: registry.verifiers, jobRoot: path.join(temporary, 'cancelled'), sourceRoot, runId: 'cancelled-run', confirmation: Core.runner.START_CONFIRMATION, cancelled: () => true, clock: clock() });
    equal(cancelled.state.status, 'CANCELLED', 'explicit cancellation stops before work');
    equal(Object.keys(cancelled.state.steps).length, 0, 'cancelled run has no produced steps');

    const integration = Core.adapters.inspect(sourceRoot);
    equal(integration.status, 'AVAILABLE_WITH_RUNTIME_HOLDS', 'tracked AXM integration seams are discoverable');
    equal(Core.adapters.probeGodot(sourceRoot).status, 'NOT_PROBED', 'native runtime is never probed implicitly');
    const adapted = Core.adapters.adaptGameOrganismReceipt({ schema: 'axm.game-organism-assembly-receipt/v1', verdict: 'CANDIDATE_READY', digest: 'a'.repeat(64), execution_order: ['design'], evidence_plan: ['design:check'], human_judgments: [], truth: { assemblyPlanCreated: true, executionStarted: false, automaticPromotion: false } });
    equal(adapted.grants_execution_authority, false, 'Game Organism adapter cannot grant execution authority');
    ok(Core.canonical.validDigest(adapted), 'adapted planning input is sealed');
  } finally {
    const resolved = path.resolve(temporary), tempBase = path.resolve(os.tmpdir());
    if (!resolved.startsWith(tempBase + path.sep) || !path.basename(resolved).startsWith('AXM-GPR-Selftest-')) throw new Error('refused unsafe selftest cleanup');
    fs.rmSync(resolved, { recursive: true, force: true });
  }
  console.log('Game Production Runner core self-test passed ' + checks + ' checks. Native Godot behavior remains unclaimed.');
}

main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
