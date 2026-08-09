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
    equal(lines(path.join(complete.runDir, 'step-receipts.jsonl')).length, 5, 'step ledger is append-only and complete');
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
