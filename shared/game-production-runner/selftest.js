'use strict';

const assert = require('assert');
const childProcess = require('child_process');
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

function setTreeMtime(root, milliseconds) {
  for (const name of fs.readdirSync(root)) {
    const target = path.join(root, name), stat = fs.lstatSync(target);
    if (stat.isDirectory() && !stat.isSymbolicLink()) setTreeMtime(target, milliseconds);
    else fs.utimesSync(target, new Date(milliseconds), new Date(milliseconds));
  }
  fs.utimesSync(root, new Date(milliseconds), new Date(milliseconds));
}

function resealRunLedger(runDir, mutate) {
  let receipts = lines(path.join(runDir, 'step-receipts.jsonl')).map((line) => JSON.parse(line));
  mutate(receipts);
  let previous = null;
  receipts = receipts.map((receipt) => {
    receipt.previous_receipt_digest = previous;
    const sealed = Core.canonical.seal(receipt);
    previous = sealed.digest;
    return sealed;
  });
  fs.writeFileSync(path.join(runDir, 'step-receipts.jsonl'), receipts.map((receipt) => JSON.stringify(receipt)).join('\n') + '\n');
  const runReceiptFile = path.join(runDir, 'run-receipt.json');
  const runReceipt = JSON.parse(fs.readFileSync(runReceiptFile, 'utf8'));
  runReceipt.step_receipts = receipts.filter((receipt) => receipt.state === 'VERIFIED').map((receipt) => receipt.digest);
  fs.writeFileSync(runReceiptFile, JSON.stringify(Core.canonical.seal(runReceipt), null, 2) + '\n');
}

function publishCacheInChild(payload) {
  return new Promise((resolve, reject) => {
    const source = [
      "'use strict';",
      "const payload=JSON.parse(Buffer.from(process.env.AXM_CACHE_PUBLISH_PAYLOAD,'base64').toString('utf8'));",
      "const Cache=require(payload.module);",
      "const handle=Cache.open({cacheRoot:payload.cacheRoot,sourceRoot:payload.sourceRoot,jobRoot:payload.jobRoot});",
      "const result=handle.publish(payload.pkg,payload.inputs,payload.seed,payload.produced);",
      "process.stdout.write(JSON.stringify(result));"
    ].join('\n');
    const environment = Object.assign({}, process.env, { AXM_CACHE_PUBLISH_PAYLOAD: Buffer.from(JSON.stringify(payload), 'utf8').toString('base64') });
    const child = childProcess.spawn(process.execPath, ['-e', source], { encoding: 'utf8', windowsHide: true, env: environment, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.once('error', reject);
    child.once('close', (code) => {
      if (code !== 0) { reject(new Error('cache publisher child failed: ' + stderr)); return; }
      try { resolve(JSON.parse(stdout)); } catch (error) { reject(error); }
    });
  });
}

function protectLeaseInChild(payload) {
  const source = [
    "'use strict';",
    "const payload=JSON.parse(Buffer.from(process.env.AXM_CACHE_LEASE_PAYLOAD,'base64').toString('utf8'));",
    "const Leases=require(payload.module);",
    "const session=Leases.acquire(payload.options);",
    "const event=session.protect(payload.key,payload.protectAt);",
    "process.stdout.write(JSON.stringify(event));"
  ].join('\n');
  const environment = Object.assign({}, process.env, { AXM_CACHE_LEASE_PAYLOAD: Buffer.from(JSON.stringify(payload), 'utf8').toString('base64') });
  const child = childProcess.spawnSync(process.execPath, ['-e', source], { encoding: 'utf8', windowsHide: true, env: environment });
  if (child.status !== 0) throw new Error('cache lease child failed: ' + child.stderr);
  return JSON.parse(child.stdout);
}

function cycleLeaseInChild(payload) {
  const source = [
    "'use strict';",
    "const payload=JSON.parse(Buffer.from(process.env.AXM_CACHE_LEASE_CYCLE_PAYLOAD,'base64').toString('utf8'));",
    "const Leases=require(payload.module);",
    "const session=Leases.acquire(payload.options);",
    "const acquired=session.event;",
    "const protectedEvent=session.protect(payload.key,payload.protectAt);",
    "const released=session.release(payload.releaseAt);",
    "process.stdout.write(JSON.stringify({acquired,protectedEvent,released}));"
  ].join('\n');
  const environment = Object.assign({}, process.env, { AXM_CACHE_LEASE_CYCLE_PAYLOAD: Buffer.from(JSON.stringify(payload), 'utf8').toString('base64') });
  const child = childProcess.spawnSync(process.execPath, ['-e', source], { encoding: 'utf8', windowsHide: true, env: environment });
  if (child.status !== 0) throw new Error('cache lease cycle child failed: ' + child.stderr);
  return JSON.parse(child.stdout);
}

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
    ok(interrupted.runReceipt === null && Core.runCheckpoints.validate(interrupted.checkpointReceipt).length === 0, 'graceful interruption returns a sealed nonterminal checkpoint instead of a terminal receipt');
    const interruptedCheckpoints = lines(path.join(interrupted.runDir, 'run-checkpoints.jsonl')).map((line) => JSON.parse(line));
    ok(interruptedCheckpoints.length === 1 && interruptedCheckpoints[0].ledger_count === 2 && interruptedCheckpoints[0].ledger_tail === interrupted.state.ledger_tail && interruptedCheckpoints[0].previous_checkpoint_digest === null, 'first checkpoint binds the exact current ledger count, tail, and chain origin');
    ok(interruptedCheckpoints[0].verified_step_receipts.length === 2 && Object.values(interruptedCheckpoints[0].authority).every((value) => value === false), 'checkpoint binds every verified step while granting no execution or lifecycle authority');
    const gameCheckpointReferenceRoot = path.join(temporary, 'game-checkpoint-reference-root');
    fs.mkdirSync(gameCheckpointReferenceRoot);
    fs.cpSync(interrupted.runDir, path.join(gameCheckpointReferenceRoot, 'checkpointed-game-run'), { recursive: true });
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

    const checkpointTamperRoot = path.join(temporary, 'checkpoint-tamper');
    const checkpointTamper = await Core.runner.run({ plan: planA, packages: spec.packages, executors: registry.executors, verifiers: registry.verifiers, jobRoot: checkpointTamperRoot, sourceRoot, runId: 'checkpoint-tamper-run', confirmation: Core.runner.START_CONFIRMATION, maxSteps: 1, clock: clock() });
    const checkpointTamperFile = path.join(checkpointTamper.runDir, 'run-checkpoints.jsonl');
    const checkpointTamperReceipt = JSON.parse(lines(checkpointTamperFile)[0]);
    checkpointTamperReceipt.updated_at = 'changed without resealing';
    fs.writeFileSync(checkpointTamperFile, JSON.stringify(checkpointTamperReceipt) + '\n');
    await rejects(() => Core.runner.run({ plan: planA, packages: spec.packages, executors: registry.executors, verifiers: registry.verifiers, jobRoot: checkpointTamperRoot, sourceRoot, runId: 'checkpoint-tamper-run', confirmation: Core.runner.START_CONFIRMATION, resume: true, clock: clock() }), /RUN_CHECKPOINT_INVALID/, 'resume refuses a tampered nonterminal checkpoint history');

    const legacyInterruptedRoot = path.join(temporary, 'legacy-interrupted-without-checkpoint');
    const legacyInterrupted = await Core.runner.run({ plan: planA, packages: spec.packages, executors: registry.executors, verifiers: registry.verifiers, jobRoot: legacyInterruptedRoot, sourceRoot, runId: 'legacy-interrupted-run', confirmation: Core.runner.START_CONFIRMATION, maxSteps: 1, clock: clock() });
    fs.unlinkSync(path.join(legacyInterrupted.runDir, 'run-checkpoints.jsonl'));
    const legacyInterruptedResumed = await Core.runner.run({ plan: planA, packages: spec.packages, executors: registry.executors, verifiers: registry.verifiers, jobRoot: legacyInterruptedRoot, sourceRoot, runId: 'legacy-interrupted-run', confirmation: Core.runner.START_CONFIRMATION, resume: true, clock: clock() });
    equal(legacyInterruptedResumed.state.status, 'CANDIDATE_READY', 'pre-checkpoint interrupted runs remain resumable from their independently validated state and step ledger');

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
    ok(neutralInterrupted.checkpointReceipt.step_receipt_schema === Core.stepReceipts.SCHEMAS.production && neutralInterrupted.internal.checkpoint_receipt_digest === neutralInterrupted.checkpointReceipt.digest, 'portable adapter exposes the exact neutral checkpoint without inventing a second authority record');
    const neutralInterruptedAgain = await Core.portable.run({ spec: portableSpec, plan: portablePlanA, executors: registry.executors, verifiers: registry.verifiers, jobRoot: neutralInterruptedRoot, sourceRoot, runId: 'neutral-interrupted-run', confirmation: Core.portable.START_CONFIRMATION, resume: true, maxSteps: 1, clock: clock() });
    equal(neutralInterruptedAgain.state.state, 'INTERRUPTED', 'a resumed portable run can checkpoint again at its next exact package boundary');
    const neutralCheckpointLedger = Core.runCheckpoints.readFile(path.join(neutralInterruptedAgain.runDir, 'run-checkpoints.jsonl'));
    ok(neutralCheckpointLedger.length === 2 && neutralCheckpointLedger[1].previous_checkpoint_digest === neutralCheckpointLedger[0].digest && neutralCheckpointLedger[1].ledger_count === 2, 'repeated interruptions form one monotonic digest-chained checkpoint history');
    ok(neutralCheckpointLedger[0].verified_step_receipts.every((digest, index) => neutralCheckpointLedger[1].verified_step_receipts[index] === digest), 'later checkpoint preserves the complete earlier verified receipt prefix');
    const resealedCheckpointRollback = Core.canonical.clone(neutralCheckpointLedger[1]);
    resealedCheckpointRollback.ledger_count = 0;
    resealedCheckpointRollback.ledger_tail = null;
    resealedCheckpointRollback.verified_step_receipts = [];
    const rollbackCheckpointLedger = JSON.stringify(neutralCheckpointLedger[0]) + '\n' + JSON.stringify(Core.canonical.seal(resealedCheckpointRollback)) + '\n';
    throws(() => Core.runCheckpoints.parseLedger(rollbackCheckpointLedger), /RUN_CHECKPOINT_LEDGER_ROLLBACK/, 'validly resealed checkpoint rollback cannot rewrite append-only progress');
    const repeatedCheckpointReferenceRoot = path.join(temporary, 'repeated-checkpoint-reference-root');
    fs.mkdirSync(repeatedCheckpointReferenceRoot);
    fs.cpSync(neutralInterruptedAgain.runDir, path.join(repeatedCheckpointReferenceRoot, 'checkpointed-portable-run'), { recursive: true });
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
    ok(documentLedger.every((receipt) => receipt.cache.state === 'DISABLED' && receipt.process.executor_invoked === true), 'a run without an explicit cache root performs no cache reuse or write');
    ok(documentLedger.every((receipt) => receipt.evidence[0].claims[0].evidence[0].kind === 'artifact-content-inspection'), 'documentation claims derive from artifact-content inspection');
    ok(documentLedger.every((receipt) => !JSON.stringify(receipt.evidence).includes('fixture-declaration')), 'documentation verifier does not rely on fixture declarations');
    const draftStep = documents.state.completed_packages.includes('document.release-note-draft');
    ok(draftStep, 'content-verified draft is present in the portable state');
    const draftReceipt = documentLedger.find((receipt) => receipt.package_ref.id === 'document.release-note-draft');
    const draftBytes = fs.readFileSync(path.join(documents.runDir, draftReceipt.outputs[0].run_relative_path), 'utf8');
    equal(draftBytes, renderedDocumentBrief, 'written draft bytes match the deterministic rendering');

    const verifierTimeoutSpec = Core.canonical.clone(documentSpec);
    verifierTimeoutSpec.packages[0].resource_budget.timeout_ms = 25;
    verifierTimeoutSpec.packages[0].repair_policy.max_attempts = 1;
    verifierTimeoutSpec.packages[0] = Core.canonical.seal(verifierTimeoutSpec.packages[0]);
    resealGraph(verifierTimeoutSpec);
    const verifierTimeoutRegistry = Core.documentRegistry.create();
    verifierTimeoutRegistry.verifiers[0].verify = () => new Promise(() => {});
    const verifierTimeoutPlan = Core.portable.compile(verifierTimeoutSpec, verifierTimeoutRegistry.inventory);
    const verifierTimeoutRun = await Core.portable.run({ spec: verifierTimeoutSpec, plan: verifierTimeoutPlan, executors: verifierTimeoutRegistry.executors, verifiers: verifierTimeoutRegistry.verifiers, jobRoot: path.join(temporary, 'verifier-timeout-runs'), cacheRoot: path.join(temporary, 'verifier-timeout-cache'), sourceRoot, runId: 'verifier-timeout-run', confirmation: Core.portable.START_CONFIRMATION, clock: clock() });
    const verifierTimeoutReceipt = JSON.parse(lines(path.join(verifierTimeoutRun.runDir, 'step-receipts.jsonl'))[0]);
    ok(verifierTimeoutRun.state.state === 'FAILED' && verifierTimeoutReceipt.detail === 'verifier exceeded cooperative timeout' && verifierTimeoutRun.cacheLeaseRelease.event === 'RELEASED', 'verifier work is cooperatively bounded and a timed-out terminal run releases its protected cache lease after evidence');

    const cacheEntrySchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'schemas', 'production-artifact-cache-entry.schema.json'), 'utf8'));
    const cacheLeaseEventSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'schemas', 'production-artifact-cache-lease-event.schema.json'), 'utf8'));
    const cacheLeaseSetSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'schemas', 'production-artifact-cache-lease-set.schema.json'), 'utf8'));
    const cacheLeaseArchiveAnchorSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'schemas', 'production-artifact-cache-lease-archive-anchor.schema.json'), 'utf8'));
    const cacheLeaseArchiveReceiptSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'schemas', 'production-artifact-cache-lease-archive-receipt.schema.json'), 'utf8'));
    const cacheLeaseArchiveAuditSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'schemas', 'production-artifact-cache-lease-archive-audit.schema.json'), 'utf8'));
    const cacheLeaseCurationProposalSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'schemas', 'production-artifact-cache-lease-curation-proposal.schema.json'), 'utf8'));
    const cacheLeaseCurationApplicationSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'schemas', 'production-artifact-cache-lease-curation-application.schema.json'), 'utf8'));
    equal(cacheEntrySchema.$id, Core.artifactCache.ENTRY_SCHEMA, 'tracked artifact cache schema matches the runtime contract');
    equal([cacheLeaseEventSchema.$id, cacheLeaseSetSchema.$id], [Core.cacheLeases.EVENT_SCHEMA, Core.cacheLeases.SET_SCHEMA], 'tracked cache lease schemas match the runtime contracts');
    equal([cacheLeaseArchiveAnchorSchema.$id, cacheLeaseArchiveReceiptSchema.$id, cacheLeaseArchiveAuditSchema.$id, cacheLeaseCurationProposalSchema.$id, cacheLeaseCurationApplicationSchema.$id], [Core.cacheLeases.ARCHIVE_ANCHOR_SCHEMA, Core.cacheLeases.ARCHIVE_RECEIPT_SCHEMA, Core.cacheLeases.ARCHIVE_AUDIT_SCHEMA, Core.cacheLeaseCuration.PROPOSAL_SCHEMA, Core.cacheLeaseCuration.APPLICATION_SCHEMA], 'tracked cache lease curation and archive schemas match the runtime contracts');
    const cacheRunsRoot = path.join(temporary, 'cache-runs');
    const cacheRoot = path.join(temporary, 'artifact-cache');
    const cachedRegistry = Core.documentRegistry.create();
    const cachedExecute = cachedRegistry.executors[0].execute;
    const cachedVerify = cachedRegistry.verifiers[0].verify;
    let cacheExecutions = 0, cacheVerifications = 0;
    cachedRegistry.executors[0].execute = (context) => { cacheExecutions += 1; return cachedExecute(context); };
    cachedRegistry.verifiers[0].verify = (context) => { cacheVerifications += 1; return cachedVerify(context); };
    const cachedRunOptions = { spec: documentSpec, plan: documentPlan, executors: cachedRegistry.executors, verifiers: cachedRegistry.verifiers, receiptValidator: Core.adapters.verificationReceiptValidator(sourceRoot), jobRoot: cacheRunsRoot, cacheRoot, sourceRoot, confirmation: Core.portable.START_CONFIRMATION };
    const cacheMissRun = await Core.portable.run(Object.assign({}, cachedRunOptions, { runId: 'cache-miss-run', clock: clock() }));
    const cacheMissLedger = lines(path.join(cacheMissRun.runDir, 'step-receipts.jsonl')).map((line) => JSON.parse(line));
    equal(cacheExecutions, 3, 'cold cache executes every deterministic documentation package once');
    equal(cacheVerifications, 3, 'cold cache independently verifies every produced package');
    ok(cacheMissLedger.every((receipt) => receipt.cache.state === 'MISS_STORED' && receipt.process.executor_invoked === true), 'cold run atomically stores every exact verified miss');
    ok(cacheMissLedger.every((receipt) => Core.stepReceipts.validate(receipt, Core.portable.SCHEMAS.step).length === 0), 'cache miss receipts satisfy the neutral step contract');
    ok(cacheMissRun.cacheLeaseRelease && cacheMissRun.cacheLeaseRelease.event === 'RELEASED' && cacheMissRun.internal.cache_lease_release_digest === cacheMissRun.cacheLeaseRelease.digest, 'terminal portable run releases its exact cache lease only after sealing terminal evidence');
    const terminalLeaseSet = Core.cacheLeases.discover({ cacheRoot, sourceRoot, jobRoot: cacheRunsRoot, nowMs: Date.now() });
    ok(Core.cacheLeases.validateSet(terminalLeaseSet).length === 0 && terminalLeaseSet.usage.released === 1 && terminalLeaseSet.leases[0].key_count === 3 && terminalLeaseSet.leases[0].generation === 5 && terminalLeaseSet.protected_keys.length === 0, 'runner protects each exact cache key before use and leaves an auditable non-protective terminal release');
    ok(!/[A-Za-z]:\\/.test(JSON.stringify(terminalLeaseSet)) && !JSON.stringify(terminalLeaseSet).includes('cache-miss-run'), 'lease discovery discloses owner digests without local paths or private run identifiers');
    const crashProtectedKey = cacheMissLedger[0].cache.key;
    const leaseCrashRoot = path.join(temporary, 'lease-crash-cache'), leaseCrashJobs = path.join(temporary, 'lease-crash-jobs');
    fs.mkdirSync(leaseCrashJobs);
    Core.artifactCache.open({ cacheRoot: leaseCrashRoot, sourceRoot, jobRoot: leaseCrashJobs });
    const leaseCrashOptions = { cacheRoot: leaseCrashRoot, sourceRoot, jobRoot: leaseCrashJobs, runId: 'crashed-lease-run', planDigest: 'c'.repeat(64), startedAt: 'crashed-run-start', durationMs: 1000, nowMs: 20000000 };
    const childLeaseEvent = protectLeaseInChild({ module: require.resolve('./artifact-cache-lease'), options: leaseCrashOptions, key: crashProtectedKey, protectAt: 20000001 });
    ok(childLeaseEvent.event === 'PROTECTED' && childLeaseEvent.generation === 2, 'fresh child process persists active lease protection before exiting without release');
    const liveCrashLeaseSet = Core.cacheLeases.discover({ cacheRoot: leaseCrashRoot, sourceRoot, jobRoot: leaseCrashJobs, nowMs: 20000500 });
    ok(liveCrashLeaseSet.status === 'COMPLETE' && liveCrashLeaseSet.protected_keys[0] === crashProtectedKey && liveCrashLeaseSet.usage.active === 1, 'crashed process lease remains protective only inside its bounded expiry window');
    const expiredCrashLeaseSet = Core.cacheLeases.discover({ cacheRoot: leaseCrashRoot, sourceRoot, jobRoot: leaseCrashJobs, nowMs: 20002000 });
    ok(expiredCrashLeaseSet.usage.expired === 1 && expiredCrashLeaseSet.protected_keys.length === 0 && expiredCrashLeaseSet.snapshot_digest === liveCrashLeaseSet.snapshot_digest, 'expiry removes protection without rewriting the append-only lease evidence snapshot');
    equal(Core.cacheLeases.discover({ cacheRoot: leaseCrashRoot, sourceRoot, jobRoot: leaseCrashJobs, nowMs: 20000500, scanMaxEvents: 1 }).status, 'LIMIT_EXCEEDED', 'lease discovery enforces its aggregate event ceiling');
    equal(Core.cacheLeases.discover({ cacheRoot: leaseCrashRoot, sourceRoot, jobRoot: leaseCrashJobs, nowMs: 20000500, scanMaxBytes: 1 }).status, 'LIMIT_EXCEEDED', 'lease discovery enforces its aggregate byte ceiling');
    const recoveredLease = Core.cacheLeases.acquire(Object.assign({}, leaseCrashOptions, { nowMs: 20002000 }));
    ok(recoveredLease.event.event === 'RENEWED' && recoveredLease.event.generation === 3 && recoveredLease.event.keys[0] === crashProtectedKey, 'resume renews the crashed owner binding and preserves every previously protected key');
    const recoveredLeaseSet = Core.cacheLeases.discover({ cacheRoot: leaseCrashRoot, sourceRoot, jobRoot: leaseCrashJobs, nowMs: 20002001 });
    equal(recoveredLeaseSet.protected_keys, [crashProtectedKey], 'crash recovery restores active protection from the same append-only ledger');
    const supersedingLease = Core.cacheLeases.acquire(Object.assign({}, leaseCrashOptions, { nowMs: 20002001 }));
    throws(() => recoveredLease.protect('d'.repeat(64), 20002002), /CACHE_LEASE_SESSION_STALE/, 'new recovery session fences an older same-run session before it can add keys');
    const supersedingRelease = supersedingLease.release(20002003);
    ok(supersedingRelease.event === 'RELEASED' && supersedingRelease.generation === 5, 'superseding session appends an exact release event');
    throws(() => Core.cacheLeases.duration(Core.cacheLeases.MAX_DURATION_MS + 1), /CACHE_LEASE_DURATION_INVALID/, 'lease duration cannot silently exceed its seven-day resource ceiling');
    equal(Core.cacheLeases.durationForPackages([{ id: 'budgeted', resource_budget: { timeout_ms: 1000 }, repair_policy: { max_attempts: 2 } }], { steps: {}, attempts: {} }), 426000, 'lease budget covers cache-hit verification plus executor and verifier fallback for every remaining attempt');

    const releasedLedgerFile = path.join(leaseCrashRoot, 'leases', supersedingLease.leaseId + '.jsonl');
    const releasedLedgerBytes = fs.readFileSync(releasedLedgerFile);
    const releasedBeforeCuration = Core.cacheLeases.discover({ cacheRoot: leaseCrashRoot, sourceRoot, jobRoot: leaseCrashJobs, nowMs: 20002004 });
    const releasedCurationPlan = Core.cacheLeaseCuration.plan(releasedBeforeCuration, { minimum_released_age_ms: 0, minimum_expired_age_ms: 0, max_candidates: 10 });
    ok(releasedCurationPlan.status === 'READY' && releasedCurationPlan.candidates.length === 1 && releasedCurationPlan.candidates[0].state === 'RELEASED' && !releasedCurationPlan.authority.source_segment_deletion, 'lease curation dry-run selects one exact released segment without deletion authority');
    const reshapedCurationPlan = Core.canonical.seal(Object.assign({}, releasedCurationPlan, { unexpected_authority: true }));
    throws(() => Core.cacheLeaseCuration.validateProposal(reshapedCurationPlan), /CACHE_LEASE_CURATION_PROPOSAL_INVALID/, 'lease curation rejects a freshly sealed proposal with undeclared fields');
    const refusedCuration = Core.cacheLeaseCuration.apply({ cacheRoot: leaseCrashRoot, sourceRoot, jobRoot: leaseCrashJobs, proposal: releasedCurationPlan, approvedDigest: '0'.repeat(64), explicit: true, nowMs: 20002004 });
    ok(refusedCuration.status === 'APPROVAL_MISMATCH' && fs.existsSync(releasedLedgerFile), 'lease curation refuses a non-matching approval digest without mutation');
    const copiedCurationRoot = path.join(temporary, 'copied-curation-cache');
    fs.cpSync(leaseCrashRoot, copiedCurationRoot, { recursive: true });
    const copiedRootCuration = Core.cacheLeaseCuration.apply({ cacheRoot: copiedCurationRoot, sourceRoot, jobRoot: leaseCrashJobs, proposal: releasedCurationPlan, approvedDigest: releasedCurationPlan.digest, explicit: true, nowMs: 20002004 });
    ok(copiedRootCuration.status === 'STALE' && fs.existsSync(path.join(copiedCurationRoot, 'leases', supersedingLease.leaseId + '.jsonl')), 'exact approval remains bound to the cache root observed by the proposal');
    const releasedCuration = Core.cacheLeaseCuration.apply({ cacheRoot: leaseCrashRoot, sourceRoot, jobRoot: leaseCrashJobs, proposal: releasedCurationPlan, approvedDigest: releasedCurationPlan.digest, explicit: true, nowMs: 20002004 });
    const releasedAfterCuration = Core.cacheLeases.discover({ cacheRoot: leaseCrashRoot, sourceRoot, jobRoot: leaseCrashJobs, nowMs: 20002004 });
    ok(releasedCuration.status === 'APPLIED' && releasedCuration.outcomes[0].source_removed && !fs.existsSync(releasedLedgerFile) && releasedAfterCuration.usage.events < releasedBeforeCuration.usage.events, 'approved curation replaces the hot released ledger with one compact anchor and records exact source removal');
    equal(releasedAfterCuration.leases.map((item) => [item.tail_event_digest, item.generation, item.state, item.key_set_digest]), releasedBeforeCuration.leases.map((item) => [item.tail_event_digest, item.generation, item.state, item.key_set_digest]), 'compaction preserves the complete discovery semantics of the released lease tail');
    fs.writeFileSync(releasedLedgerFile, releasedLedgerBytes, { flag: 'wx' });
    equal(Core.cacheLeases.discover({ cacheRoot: leaseCrashRoot, sourceRoot, jobRoot: leaseCrashJobs, nowMs: 20002004 }).status, 'REVIEW_REQUIRED', 'a crash window that leaves archived source bytes beside the new anchor holds ordinary discovery');
    const recoveredCuration = Core.cacheLeaseCuration.apply({ cacheRoot: leaseCrashRoot, sourceRoot, jobRoot: leaseCrashJobs, proposal: releasedCurationPlan, approvedDigest: releasedCurationPlan.digest, explicit: true, nowMs: 20002004 });
    ok(recoveredCuration.status === 'APPLIED' && recoveredCuration.outcomes[0].status === 'RECOVERED' && !fs.existsSync(releasedLedgerFile), 'reapplying the same exact proposal completes an interrupted source-removal window idempotently');
    const archivedChildCycle = cycleLeaseInChild({ module: require.resolve('./artifact-cache-lease'), options: Object.assign({}, leaseCrashOptions, { nowMs: 20002005 }), key: 'e'.repeat(64), protectAt: 20002006, releaseAt: 20002007 });
    ok(archivedChildCycle.acquired.event === 'ACQUIRED' && archivedChildCycle.acquired.generation === 6 && archivedChildCycle.acquired.keys.length === 0 && archivedChildCycle.released.generation === 8, 'a fresh process continues the released archive generation, protects a new key, and appends its release');
    const secondCurationSet = Core.cacheLeases.discover({ cacheRoot: leaseCrashRoot, sourceRoot, jobRoot: leaseCrashJobs, nowMs: 20002008 });
    const secondCurationPlan = Core.cacheLeaseCuration.plan(secondCurationSet, { minimum_released_age_ms: 0, minimum_expired_age_ms: 0, max_candidates: 10 });
    const secondCuration = Core.cacheLeaseCuration.apply({ cacheRoot: leaseCrashRoot, sourceRoot, jobRoot: leaseCrashJobs, proposal: secondCurationPlan, approvedDigest: secondCurationPlan.digest, explicit: true, nowMs: 20002008 });
    const twoSegmentAudit = Core.cacheLeaseCuration.audit({ cacheRoot: leaseCrashRoot, sourceRoot, jobRoot: leaseCrashJobs, nowMs: 20002008 });
    ok(secondCuration.status === 'APPLIED' && twoSegmentAudit.status === 'COMPLETE' && twoSegmentAudit.usage.segments === 2 && twoSegmentAudit.usage.history_events === 8, 'full cold audit rehashes, decompresses, and validates two archive segments as one eight-event chain');
    equal(Core.cacheLeaseCuration.audit({ cacheRoot: leaseCrashRoot, sourceRoot, jobRoot: leaseCrashJobs, nowMs: 20002008, auditMaxSegments: 1 }).status, 'LIMIT_EXCEEDED', 'cold archive audit enforces its independent segment ceiling');

    const expiredArchiveOptions = { cacheRoot: leaseCrashRoot, sourceRoot, jobRoot: leaseCrashJobs, runId: 'expired-archive-run', planDigest: 'f'.repeat(64), startedAt: 'expired-archive-start', durationMs: 100, nowMs: 30000000 };
    const expiredArchiveLease = Core.cacheLeases.acquire(expiredArchiveOptions);
    const expiredArchiveKey = '1'.repeat(64);
    expiredArchiveLease.protect(expiredArchiveKey, 30000001);
    const expiredArchiveSet = Core.cacheLeases.discover({ cacheRoot: leaseCrashRoot, sourceRoot, jobRoot: leaseCrashJobs, nowMs: 30000200 });
    const expiredCurationPlan = Core.cacheLeaseCuration.plan(expiredArchiveSet, { minimum_released_age_ms: 0, minimum_expired_age_ms: 0, max_candidates: 10 });
    const expiredCuration = Core.cacheLeaseCuration.apply({ cacheRoot: leaseCrashRoot, sourceRoot, jobRoot: leaseCrashJobs, proposal: expiredCurationPlan, approvedDigest: expiredCurationPlan.digest, explicit: true, nowMs: 30000200 });
    const expiredAfterCuration = Core.cacheLeases.discover({ cacheRoot: leaseCrashRoot, sourceRoot, jobRoot: leaseCrashJobs, nowMs: 30000200 });
    const archivedExpiredSummary = expiredAfterCuration.leases.find((item) => item.lease_id === expiredArchiveLease.leaseId);
    ok(expiredCuration.status === 'APPLIED' && archivedExpiredSummary.state === 'EXPIRED' && archivedExpiredSummary.key_count === 1 && archivedExpiredSummary.protected_keys.length === 0 && archivedExpiredSummary.live_segment_digest === null, 'expired curation preserves recovery keys and audit history without granting stale protection');
    const expiredRecovery = cycleLeaseInChild({ module: require.resolve('./artifact-cache-lease'), options: Object.assign({}, expiredArchiveOptions, { nowMs: 30000201 }), key: expiredArchiveKey, protectAt: 30000201, releaseAt: 30000202 });
    ok(expiredRecovery.acquired.event === 'RENEWED' && expiredRecovery.acquired.generation === 3 && expiredRecovery.acquired.keys[0] === expiredArchiveKey && expiredRecovery.released.generation === 4, 'fresh-process recovery resumes an expired archive anchor and restores its prior key set under a new bounded session');

    const activeCurationRoot = path.join(temporary, 'active-curation-cache'), activeCurationJobs = path.join(temporary, 'active-curation-jobs');
    fs.mkdirSync(activeCurationJobs);
    Core.artifactCache.open({ cacheRoot: activeCurationRoot, sourceRoot, jobRoot: activeCurationJobs });
    const activeCurationOptions = { cacheRoot: activeCurationRoot, sourceRoot, jobRoot: activeCurationJobs, runId: 'active-curation-run', planDigest: '2'.repeat(64), startedAt: 'active-curation-start', durationMs: 1000, nowMs: 40000000 };
    const activeCurationLease = Core.cacheLeases.acquire(activeCurationOptions);
    activeCurationLease.protect('3'.repeat(64), 40000001);
    const activeCurationSet = Core.cacheLeases.discover({ cacheRoot: activeCurationRoot, sourceRoot, jobRoot: activeCurationJobs, nowMs: 40000002 });
    const activeCurationPlan = Core.cacheLeaseCuration.plan(activeCurationSet, { minimum_released_age_ms: 0, minimum_expired_age_ms: 0, max_candidates: 10 });
    ok(activeCurationPlan.status === 'NO_CHANGES' && activeCurationPlan.active_leases === 1 && activeCurationPlan.candidates.length === 0, 'active lease history is never a curation candidate even under a zero-age policy');
    activeCurationLease.release(40000003);
    const staleCurationSet = Core.cacheLeases.discover({ cacheRoot: activeCurationRoot, sourceRoot, jobRoot: activeCurationJobs, nowMs: 40000004 });
    const staleCurationPlan = Core.cacheLeaseCuration.plan(staleCurationSet, { minimum_released_age_ms: 0, minimum_expired_age_ms: 0, max_candidates: 10 });
    const busyCuration = Core.cacheLeases.withLeaseLock(activeCurationOptions, activeCurationLease.leaseId, () => Core.cacheLeaseCuration.apply({ cacheRoot: activeCurationRoot, sourceRoot, jobRoot: activeCurationJobs, proposal: staleCurationPlan, approvedDigest: staleCurationPlan.digest, explicit: true, nowMs: 40000004 }));
    ok(busyCuration.status === 'COORDINATION_BUSY' && fs.existsSync(path.join(activeCurationRoot, 'leases', activeCurationLease.leaseId + '.jsonl')), 'held per-lease coordination prevents curation from racing a runner lifecycle mutation');
    const staleReacquire = Core.cacheLeases.acquire(Object.assign({}, activeCurationOptions, { nowMs: 40000005 }));
    const staleCuration = Core.cacheLeaseCuration.apply({ cacheRoot: activeCurationRoot, sourceRoot, jobRoot: activeCurationJobs, proposal: staleCurationPlan, approvedDigest: staleCurationPlan.digest, explicit: true, nowMs: 40000005 });
    ok(staleCuration.status === 'STALE' && !staleCuration.authority.source_segments_removed, 'a newer runner session invalidates the exact curation candidate before source deletion');
    staleReacquire.release(40000006);

    const expiredAnchorFile = path.join(leaseCrashRoot, 'leases', expiredArchiveLease.leaseId + '.anchor.json');
    const expiredAnchor = JSON.parse(fs.readFileSync(expiredAnchorFile, 'utf8'));
    const expiredArchiveBlob = path.join(leaseCrashRoot, 'lease-archives', expiredArchiveLease.leaseId, expiredAnchor.latest_archive_receipt_digest + '.jsonl.gz');
    const predecessorTamperRoot = path.join(temporary, 'predecessor-tamper-cache');
    fs.cpSync(leaseCrashRoot, predecessorTamperRoot, { recursive: true });
    const twoSegmentAnchorName = fs.readdirSync(path.join(predecessorTamperRoot, 'leases')).find((name) => name.endsWith('.anchor.json') && JSON.parse(fs.readFileSync(path.join(predecessorTamperRoot, 'leases', name), 'utf8')).archived_segment_count === 2);
    const twoSegmentAnchorFile = path.join(predecessorTamperRoot, 'leases', twoSegmentAnchorName), twoSegmentAnchor = JSON.parse(fs.readFileSync(twoSegmentAnchorFile, 'utf8'));
    const twoSegmentArchiveRoot = path.join(predecessorTamperRoot, 'lease-archives', twoSegmentAnchor.lease_id), oldLatestReceiptFile = path.join(twoSegmentArchiveRoot, twoSegmentAnchor.latest_archive_receipt_digest + '.json');
    const oldLatestBlobFile = path.join(twoSegmentArchiveRoot, twoSegmentAnchor.latest_archive_receipt_digest + '.jsonl.gz'), falsePredecessorReceipt = Core.canonical.seal(Object.assign({}, JSON.parse(fs.readFileSync(oldLatestReceiptFile, 'utf8')), { previous_anchor_digest: '0'.repeat(64) }));
    fs.writeFileSync(path.join(twoSegmentArchiveRoot, falsePredecessorReceipt.digest + '.json'), JSON.stringify(falsePredecessorReceipt) + '\n', { flag: 'wx' });
    fs.copyFileSync(oldLatestBlobFile, path.join(twoSegmentArchiveRoot, falsePredecessorReceipt.digest + '.jsonl.gz'), fs.constants.COPYFILE_EXCL);
    fs.writeFileSync(twoSegmentAnchorFile, JSON.stringify(Core.canonical.seal(Object.assign({}, twoSegmentAnchor, { latest_archive_receipt_digest: falsePredecessorReceipt.digest }))) + '\n');
    equal(Core.cacheLeaseCuration.audit({ cacheRoot: predecessorTamperRoot, sourceRoot, nowMs: 30000203 }).status, 'REVIEW_REQUIRED', 'full archive audit reconstructs and refuses a separately resealed false predecessor-anchor link');
    const missingArchiveRoot = path.join(temporary, 'missing-archive-cache');
    fs.cpSync(leaseCrashRoot, missingArchiveRoot, { recursive: true });
    fs.unlinkSync(path.join(missingArchiveRoot, 'lease-archives', expiredArchiveLease.leaseId, expiredAnchor.latest_archive_receipt_digest + '.jsonl.gz'));
    equal(Core.cacheLeases.discover({ cacheRoot: missingArchiveRoot, sourceRoot, nowMs: 30000203 }).status, 'REVIEW_REQUIRED', 'ordinary discovery fails closed when the exact cold blob named by an anchor is missing');
    const tamperedArchiveBytes = fs.readFileSync(expiredArchiveBlob);
    tamperedArchiveBytes[Math.floor(tamperedArchiveBytes.length / 2)] ^= 1;
    fs.writeFileSync(expiredArchiveBlob, tamperedArchiveBytes);
    const tamperedArchiveAudit = Core.cacheLeaseCuration.audit({ cacheRoot: leaseCrashRoot, sourceRoot, jobRoot: leaseCrashJobs, nowMs: 30000203 });
    ok(tamperedArchiveAudit.status === 'REVIEW_REQUIRED' && !/[A-Za-z]:\\/.test(JSON.stringify(tamperedArchiveAudit)) && !JSON.stringify(tamperedArchiveAudit).includes('expired-archive-run'), 'explicit cold audit detects same-size archive corruption while keeping its derived receipt path- and run-id-private');

    const tamperedLeaseRoot = path.join(temporary, 'tampered-lease-cache');
    fs.cpSync(leaseCrashRoot, tamperedLeaseRoot, { recursive: true });
    const tamperedLeaseFile = path.join(tamperedLeaseRoot, 'leases', fs.readdirSync(path.join(tamperedLeaseRoot, 'leases')).find((name) => name.endsWith('.jsonl')));
    const tamperedLeaseLines = lines(tamperedLeaseFile), tamperedLeaseTail = JSON.parse(tamperedLeaseLines[tamperedLeaseLines.length - 1]);
    tamperedLeaseTail.expires_at_ms += 1;
    tamperedLeaseLines[tamperedLeaseLines.length - 1] = JSON.stringify(tamperedLeaseTail);
    fs.writeFileSync(tamperedLeaseFile, tamperedLeaseLines.join('\n') + '\n');
    const tamperedLeaseSet = Core.cacheLeases.discover({ cacheRoot: tamperedLeaseRoot, sourceRoot, nowMs: 20002004 });
    ok(tamperedLeaseSet.status === 'REVIEW_REQUIRED' && !tamperedLeaseSet.authority.protection_granted, 'tampered lease ledger holds the aggregate set instead of granting or silently dropping protection');
    equal(Core.cacheRetention.inventory({ cacheRoot: tamperedLeaseRoot, sourceRoot, nowMs: 20002004 }).status, 'REVIEW_REQUIRED', 'retention inherits malformed lease evidence as a no-delete review hold');
    const cacheHandle = Core.artifactCache.open({ cacheRoot, sourceRoot, jobRoot: cacheRunsRoot });
    const firstCacheKey = cacheMissLedger[0].cache.key;
    const firstEntryRoot = path.join(cacheRoot, 'entries', firstCacheKey.slice(0, 2), firstCacheKey);
    const firstEntry = JSON.parse(fs.readFileSync(path.join(firstEntryRoot, 'entry.json'), 'utf8'));
    ok(Core.canonical.validDigest(firstEntry) && firstEntry.digest === cacheMissLedger[0].cache.entry_digest, 'cache miss receipt binds the sealed immutable entry');
    ok(!/[A-Za-z]:\\/.test(JSON.stringify(firstEntry)), 'cache entry contains no local machine path');

    cacheExecutions = 0; cacheVerifications = 0;
    const cacheHitRun = await Core.portable.run(Object.assign({}, cachedRunOptions, { runId: 'cache-hit-run', clock: clock() }));
    const cacheHitLedger = lines(path.join(cacheHitRun.runDir, 'step-receipts.jsonl')).map((line) => JSON.parse(line));
    equal(cacheExecutions, 0, 'warm cache skips all deterministic executor calls');
    equal(cacheVerifications, 3, 'warm cache still invokes the current verifier for every hit');
    ok(cacheHitLedger.every((receipt) => receipt.cache.state === 'HIT' && receipt.process.executor_invoked === false), 'warm run discloses exact verified hits and skipped executors');
    equal(cacheHitLedger.map((receipt) => receipt.outputs.map((item) => item.digest)), cacheMissLedger.map((receipt) => receipt.outputs.map((item) => item.digest)), 'cache hits reproduce the exact independently verified artifact digests');
    const cacheCheckpointRunsRoot = path.join(temporary, 'cache-checkpoint-runs');
    const cacheCheckpointRun = await Core.portable.run(Object.assign({}, cachedRunOptions, { jobRoot: cacheCheckpointRunsRoot, runId: 'cache-checkpoint-run', maxSteps: 1, clock: clock() }));
    const cacheCheckpointLedger = lines(path.join(cacheCheckpointRun.runDir, 'step-receipts.jsonl')).map((line) => JSON.parse(line));
    ok(cacheCheckpointRun.state.state === 'INTERRUPTED' && cacheCheckpointLedger.length === 1 && cacheCheckpointLedger[0].cache.state === 'HIT', 'warm cached production can stop at an exact checkpointed reference boundary');
    ok(cacheCheckpointRun.cacheLeaseRelease.event === 'RELEASED' && cacheCheckpointRun.checkpointReceipt.digest, 'graceful interruption seals its checkpoint before releasing in-flight cache protection');

    const intermittentRegistry = Core.documentRegistry.create();
    const intermittentExecute = intermittentRegistry.executors[0].execute;
    const intermittentVerify = intermittentRegistry.verifiers[0].verify;
    let intermittentExecutions = 0, intermittentVerifications = 0;
    intermittentRegistry.executors[0].execute = (context) => { intermittentExecutions += 1; return intermittentExecute(context); };
    intermittentRegistry.verifiers[0].verify = (context) => {
      intermittentVerifications += 1;
      const receipt = intermittentVerify(context);
      if (intermittentVerifications === 1) receipt.claims.forEach((claim) => { claim.status = 'FAIL'; });
      return receipt;
    };
    const reverified = await Core.portable.run(Object.assign({}, cachedRunOptions, { executors: intermittentRegistry.executors, verifiers: intermittentRegistry.verifiers, runId: 'cache-reverify-rejection-run', clock: clock() }));
    const reverifiedLedger = lines(path.join(reverified.runDir, 'step-receipts.jsonl')).map((line) => JSON.parse(line));
    equal(intermittentExecutions, 1, 'a cache hit rejected by the current verifier falls back to one fresh execution');
    equal(intermittentVerifications, 4, 'cache rejection preserves fresh verification instead of trusting prior testimony');
    equal(reverifiedLedger[0].cache.state, 'REJECTED', 'current-verifier disagreement remains visible in the successful fresh step receipt');
    equal(reverified.state.state, 'CANDIDATE_READY', 'fresh verified execution can recover from a rejected cache hit');

    const tamperedArtifactFile = path.join(firstEntryRoot, firstEntry.artifacts[0].entry_relative_path.replace(/\//g, path.sep));
    fs.writeFileSync(tamperedArtifactFile, 'tampered cache bytes\n');
    cacheExecutions = 0; cacheVerifications = 0;
    const tamperRecovery = await Core.portable.run(Object.assign({}, cachedRunOptions, { runId: 'cache-tamper-recovery-run', clock: clock() }));
    const tamperLedger = lines(path.join(tamperRecovery.runDir, 'step-receipts.jsonl')).map((line) => JSON.parse(line));
    equal(cacheExecutions, 1, 'tampered cache entry executes only the affected package again');
    equal(cacheVerifications, 3, 'tamper recovery still verifies fresh and reused artifacts independently');
    equal(tamperLedger[0].cache, { state: 'REJECTED', key: firstCacheKey, reason: 'CACHE_ARTIFACT_INTEGRITY_MISMATCH' }, 'tampered entry is rejected with stable counterevidence and no path disclosure');
    equal(tamperRecovery.state.state, 'CANDIDATE_READY', 'tampered cache data cannot block a valid fresh candidate result');
    const refusedInvalidation = cacheHandle.invalidate(firstCacheKey, {});
    equal(refusedInvalidation.status, 'REFUSED', 'cache invalidation requires explicit authority');
    ok(fs.existsSync(firstEntryRoot), 'refused invalidation changes no cache entry');
    equal(cacheHandle.invalidate('../escape', { explicit: true }).status, 'INVALID_KEY', 'cache invalidation rejects every non-digest path target');
    const invalidated = cacheHandle.invalidate(firstCacheKey, { explicit: true });
    equal(invalidated.status, 'REMOVED', 'explicit invalidation removes only the selected entry');
    ok(!fs.existsSync(firstEntryRoot), 'selected invalidated entry is absent');
    const secondCacheKey = cacheMissLedger[1].cache.key;
    ok(fs.existsSync(path.join(cacheRoot, 'entries', secondCacheKey.slice(0, 2), secondCacheKey)), 'selective invalidation preserves unrelated entries');
    cacheExecutions = 0; cacheVerifications = 0;
    const invalidationRecovery = await Core.portable.run(Object.assign({}, cachedRunOptions, { runId: 'cache-invalidation-recovery-run', clock: clock() }));
    const invalidationLedger = lines(path.join(invalidationRecovery.runDir, 'step-receipts.jsonl')).map((line) => JSON.parse(line));
    equal(cacheExecutions, 1, 'invalidated package is rebuilt while unaffected packages remain reusable');
    equal(invalidationLedger.map((receipt) => receipt.cache.state), ['MISS_STORED', 'HIT', 'HIT'], 'selective invalidation produces one new store and two verified hits');

    const noPolicyRegistry = Core.documentRegistry.create();
    delete noPolicyRegistry.executors[0].cache_policy;
    const bypassed = await Core.portable.run(Object.assign({}, cachedRunOptions, { executors: noPolicyRegistry.executors, verifiers: noPolicyRegistry.verifiers, runId: 'cache-policy-bypass-run', clock: clock() }));
    const bypassLedger = lines(path.join(bypassed.runDir, 'step-receipts.jsonl')).map((line) => JSON.parse(line));
    ok(bypassLedger.every((receipt) => receipt.cache.state === 'BYPASSED' && receipt.cache.reason === 'EXECUTOR_DETERMINISM_UNDECLARED'), 'cache refuses executors without an explicit deterministic policy');
    throws(() => Core.artifactCache.open({ cacheRoot: path.join(cacheRunsRoot, 'nested-cache'), sourceRoot, jobRoot: cacheRunsRoot }), /CACHE_ROOT_OVERLAPS_JOB_ROOT/, 'cache root must be isolated from candidate job roots');
    throws(() => Core.artifactCache.open({ cacheRoot: path.join(sourceRoot, 'cache-not-allowed'), sourceRoot, jobRoot: cacheRunsRoot }), /CACHE_ROOT_OVERLAPS_SOURCE/, 'cache root cannot write inside the source tree');
    const linkedEntriesCache = path.join(temporary, 'linked-entries-cache'), linkedEntriesTarget = path.join(temporary, 'linked-entries-target');
    fs.mkdirSync(linkedEntriesCache); fs.mkdirSync(linkedEntriesTarget);
    fs.symlinkSync(linkedEntriesTarget, path.join(linkedEntriesCache, 'entries'), 'junction');
    throws(() => Core.artifactCache.open({ cacheRoot: linkedEntriesCache, sourceRoot, jobRoot: cacheRunsRoot }), /CACHE_ENTRIES_NOT_PLAIN_DIRECTORY/, 'cache entries root cannot be redirected through a junction');
    const firstPackage = Core.portable.adaptSpec(documentSpec).internal.packages[0];
    const bindingInput = { package_id: 'dependency', path: 'input/a.txt', digest: 'a'.repeat(64), bytes: 10 };
    const changedPackage = Core.canonical.clone(firstPackage); changedPackage.digest = firstPackage.digest[0] === 'f' ? 'e' + firstPackage.digest.slice(1) : 'f' + firstPackage.digest.slice(1);
    const changedExecutor = Core.canonical.clone(firstPackage); changedExecutor.executor.version = '1.0.1'; changedExecutor.digest = Core.canonical.seal(changedExecutor).digest;
    const changedVerifier = Core.canonical.clone(firstPackage); changedVerifier.verifier.version = '1.0.1'; changedVerifier.digest = Core.canonical.seal(changedVerifier).digest;
    const exactKey = Core.artifactCache.keyFor(firstPackage, [], documentPlan.intent_ref.digest);
    equal(Core.artifactCache.keyFor(Core.canonical.clone(firstPackage), [], documentPlan.intent_ref.digest), exactKey, 'equivalent cache bindings produce the same exact key');
    const changedKeys = [
      Core.artifactCache.keyFor(changedPackage, [], documentPlan.intent_ref.digest),
      Core.artifactCache.keyFor(firstPackage, [bindingInput], documentPlan.intent_ref.digest),
      Core.artifactCache.keyFor(firstPackage, [Object.assign({}, bindingInput, { path: 'input/b.txt' })], documentPlan.intent_ref.digest),
      Core.artifactCache.keyFor(firstPackage, [Object.assign({}, bindingInput, { digest: 'b'.repeat(64) })], documentPlan.intent_ref.digest),
      Core.artifactCache.keyFor(firstPackage, [Object.assign({}, bindingInput, { bytes: 11 })], documentPlan.intent_ref.digest),
      Core.artifactCache.keyFor(changedExecutor, [], documentPlan.intent_ref.digest),
      Core.artifactCache.keyFor(changedVerifier, [], documentPlan.intent_ref.digest),
      Core.artifactCache.keyFor(firstPackage, [], 'different-seed')
    ];
    ok(changedKeys.every((key) => key !== exactKey) && new Set(changedKeys).size === changedKeys.length, 'every bound package, input, Hand, verifier, and seed change produces a distinct cache key');
    const concurrentRoot = path.join(temporary, 'concurrent-cache');
    const concurrentJobs = path.join(temporary, 'concurrent-jobs');
    fs.mkdirSync(concurrentJobs, { recursive: true });
    const concurrentPayload = {
      module: require.resolve('./artifact-cache'),
      cacheRoot: concurrentRoot,
      sourceRoot,
      jobRoot: concurrentJobs,
      pkg: firstPackage,
      inputs: [],
      seed: documentPlan.intent_ref.digest,
      produced: { artifacts: [{ path: firstPackage.outputs[0].path, content: JSON.stringify(Core.documentRegistry.normalizeBrief(firstPackage.document_payload), null, 2) + '\n' }], facts: { operation: firstPackage.document_operation } }
    };
    const linkedPrefixCache = path.join(temporary, 'linked-prefix-cache'), linkedPrefixTarget = path.join(temporary, 'linked-prefix-target');
    const linkedPrefixHandle = Core.artifactCache.open({ cacheRoot: linkedPrefixCache, sourceRoot, jobRoot: cacheRunsRoot });
    fs.mkdirSync(linkedPrefixTarget);
    const linkedPrefixKey = Core.artifactCache.keyFor(firstPackage, [], 'linked-prefix-seed');
    fs.symlinkSync(linkedPrefixTarget, path.join(linkedPrefixCache, 'entries', linkedPrefixKey.slice(0, 2)), 'junction');
    equal(linkedPrefixHandle.load(firstPackage, [], 'linked-prefix-seed').reason, 'CACHE_PATH_TRAVERSES_LINK', 'cache read refuses a redirected digest-prefix directory');
    equal(linkedPrefixHandle.publish(firstPackage, [], 'linked-prefix-seed', concurrentPayload.produced).reason, 'CACHE_PATH_TRAVERSES_LINK', 'cache publication refuses a redirected digest-prefix directory');
    equal(linkedPrefixHandle.invalidate(linkedPrefixKey, { explicit: true }).status, 'REFUSED_LINK', 'cache invalidation refuses a redirected digest-prefix directory');
    const concurrentResults = await Promise.all([publishCacheInChild(concurrentPayload), publishCacheInChild(concurrentPayload)]);
    equal(concurrentResults.map((item) => item.state).sort(), ['EXISTS', 'STORED'], 'concurrent publishers converge on one immutable cache entry');
    const concurrentHandle = Core.artifactCache.open({ cacheRoot: concurrentRoot, sourceRoot, jobRoot: concurrentJobs });
    equal(concurrentHandle.load(firstPackage, [], documentPlan.intent_ref.digest).state, 'HIT', 'concurrently published entry reads back with exact integrity');
    equal(fs.readdirSync(path.join(concurrentRoot, 'entries', concurrentResults[0].key.slice(0, 2))).filter((name) => name.includes('.next-')), [], 'concurrent publication leaves no temporary directories');
    const conflict = concurrentHandle.publish(firstPackage, [], documentPlan.intent_ref.digest, { artifacts: [{ path: firstPackage.outputs[0].path, content: 'different deterministic result\n' }], facts: { operation: firstPackage.document_operation } });
    equal(conflict.state, 'CONFLICT', 'same cache key with different result is preserved as nondeterminism counterevidence');

    const referenceSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'schemas', 'production-artifact-cache-reference-set.schema.json'), 'utf8'));
    const checkpointSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'schemas', 'production-run-checkpoint.schema.json'), 'utf8'));
    equal(referenceSchema.$id, Core.cacheReferences.SCHEMA, 'tracked cache reference-set schema matches the runtime contract');
    equal(checkpointSchema.$id, Core.runCheckpoints.SCHEMA, 'tracked nonterminal checkpoint schema matches the runtime contract');
    const gameReferences = Core.cacheReferences.discover({ jobRoot: interruptedRoot, sourceRoot, nowMs: 10000000 });
    ok(Core.canonical.validDigest(gameReferences) && gameReferences.status === 'COMPLETE' && gameReferences.runs.length === 1, 'read-only discovery accepts a valid terminal game ledger');
    ok(gameReferences.runs[0].ledger_schema === Core.stepReceipts.SCHEMAS.game && gameReferences.protected_keys.length === 0, 'game ledger without cache material grants no invented protection');
    const gameCheckpointReferences = Core.cacheReferences.discover({ jobRoot: gameCheckpointReferenceRoot, sourceRoot, nowMs: 10000000 });
    ok(gameCheckpointReferences.status === 'COMPLETE' && gameCheckpointReferences.runs[0].evidence_kind === 'NONTERMINAL_CHECKPOINT' && gameCheckpointReferences.runs[0].state === 'INTERRUPTED' && gameCheckpointReferences.runs[0].ledger_schema === Core.stepReceipts.SCHEMAS.game, 'discovery accepts an exact graceful game checkpoint without relabeling it terminal');
    const repeatedCheckpointReferences = Core.cacheReferences.discover({ jobRoot: repeatedCheckpointReferenceRoot, sourceRoot, nowMs: 10000000 });
    ok(repeatedCheckpointReferences.status === 'COMPLETE' && repeatedCheckpointReferences.usage.checkpoints === 2 && repeatedCheckpointReferences.runs[0].checkpoint_count === 2 && repeatedCheckpointReferences.runs[0].ledger_schema === Core.stepReceipts.SCHEMAS.production, 'discovery validates the full repeated portable checkpoint chain and latest ledger position');
    equal(Core.cacheReferences.discover({ jobRoot: repeatedCheckpointReferenceRoot, sourceRoot, nowMs: 10000000, scanMaxCheckpoints: 1 }).status, 'LIMIT_EXCEEDED', 'reference discovery stops at its aggregate checkpoint ceiling');
    equal(Core.cacheReferences.discover({ jobRoot: repeatedCheckpointReferenceRoot, sourceRoot, nowMs: 10000000, scanMaxCheckpointLedgerBytes: 1 }).status, 'LIMIT_EXCEEDED', 'reference discovery stops at its aggregate checkpoint-ledger byte ceiling');
    const cacheCheckpointReferences = Core.cacheReferences.discover({ jobRoot: cacheCheckpointRunsRoot, sourceRoot, nowMs: 10000000 });
    ok(cacheCheckpointReferences.status === 'COMPLETE' && cacheCheckpointReferences.usage.checkpoints === 1 && cacheCheckpointReferences.references[0].evidence_kinds[0] === 'NONTERMINAL_CHECKPOINT', 'checkpoint discovery produces an authoritative path-private cache reference set');
    equal(cacheCheckpointReferences.protected_keys, [cacheCheckpointLedger[0].cache.key], 'checkpoint protection includes only the exact verified cache material at the safe interruption boundary');
    ok(!/[A-Za-z]:\\/.test(JSON.stringify(cacheCheckpointReferences)) && !JSON.stringify(cacheCheckpointReferences).includes('cache-checkpoint-run'), 'checkpoint reference set discloses neither machine paths nor private run identifiers');

    const staleCheckpointRoot = path.join(temporary, 'stale-checkpoint-reference-root'), staleCheckpointRun = path.join(staleCheckpointRoot, 'stale-checkpoint-run');
    fs.mkdirSync(staleCheckpointRoot);
    fs.cpSync(cacheCheckpointRun.runDir, staleCheckpointRun, { recursive: true });
    const staleCheckpointLedgerFile = path.join(staleCheckpointRun, 'step-receipts.jsonl');
    const uncheckpointedReceipt = Core.canonical.clone(cacheCheckpointLedger[0]);
    uncheckpointedReceipt.step_id = uncheckpointedReceipt.package_ref.id + '.attempt-2';
    uncheckpointedReceipt.attempt = 2;
    uncheckpointedReceipt.previous_receipt_digest = cacheCheckpointLedger[0].digest;
    uncheckpointedReceipt.started_at = 'uncheckpointed-start';
    uncheckpointedReceipt.completed_at = 'uncheckpointed-complete';
    fs.appendFileSync(staleCheckpointLedgerFile, JSON.stringify(Core.canonical.seal(uncheckpointedReceipt)) + '\n');
    const staleCheckpointReferences = Core.cacheReferences.discover({ jobRoot: staleCheckpointRoot, sourceRoot, nowMs: 10000000 });
    ok(staleCheckpointReferences.status === 'REVIEW_REQUIRED' && staleCheckpointReferences.holds[0].reason === 'REFERENCE_CHECKPOINT_LEDGER_MISMATCH' && !staleCheckpointReferences.authority.protection_granted, 'a valid receipt appended after the latest checkpoint holds the whole reference set');

    const tamperedCheckpointReferenceRoot = path.join(temporary, 'tampered-checkpoint-reference-root'), tamperedCheckpointReferenceRun = path.join(tamperedCheckpointReferenceRoot, 'tampered-checkpoint-run');
    fs.mkdirSync(tamperedCheckpointReferenceRoot);
    fs.cpSync(cacheCheckpointRun.runDir, tamperedCheckpointReferenceRun, { recursive: true });
    const tamperedCheckpointReferenceFile = path.join(tamperedCheckpointReferenceRun, 'run-checkpoints.jsonl');
    const tamperedCheckpointAnchor = JSON.parse(lines(tamperedCheckpointReferenceFile)[0]);
    tamperedCheckpointAnchor.updated_at = 'tampered without a seal';
    fs.writeFileSync(tamperedCheckpointReferenceFile, JSON.stringify(tamperedCheckpointAnchor) + '\n');
    equal(Core.cacheReferences.discover({ jobRoot: tamperedCheckpointReferenceRoot, sourceRoot, nowMs: 10000000 }).holds[0].reason, 'REFERENCE_CHECKPOINT_LEDGER_INVALID', 'tampered checkpoint bytes cannot grant protection authority');

    const truncatedCheckpointReferenceRoot = path.join(temporary, 'truncated-checkpoint-reference-root'), truncatedCheckpointReferenceRun = path.join(truncatedCheckpointReferenceRoot, 'truncated-checkpoint-run');
    fs.mkdirSync(truncatedCheckpointReferenceRoot);
    fs.cpSync(cacheCheckpointRun.runDir, truncatedCheckpointReferenceRun, { recursive: true });
    const truncatedCheckpointFile = path.join(truncatedCheckpointReferenceRun, 'run-checkpoints.jsonl'), truncatedCheckpointBytes = fs.readFileSync(truncatedCheckpointFile);
    fs.writeFileSync(truncatedCheckpointFile, truncatedCheckpointBytes.subarray(0, truncatedCheckpointBytes.length - 7));
    equal(Core.cacheReferences.discover({ jobRoot: truncatedCheckpointReferenceRoot, sourceRoot, nowMs: 10000000 }).holds[0].reason, 'REFERENCE_CHECKPOINT_LEDGER_INVALID', 'truncated checkpoint append cannot be mistaken for a complete anchor');

    const terminalPrecedenceReferenceRoot = path.join(temporary, 'terminal-precedence-reference-root'), terminalPrecedenceReferenceRun = path.join(terminalPrecedenceReferenceRoot, 'terminal-precedence-run');
    fs.mkdirSync(terminalPrecedenceReferenceRoot);
    fs.cpSync(cacheCheckpointRun.runDir, terminalPrecedenceReferenceRun, { recursive: true });
    fs.writeFileSync(path.join(terminalPrecedenceReferenceRun, 'run-receipt.json'), '{}\n');
    const terminalPrecedenceReferences = Core.cacheReferences.discover({ jobRoot: terminalPrecedenceReferenceRoot, sourceRoot, nowMs: 10000000 });
    ok(terminalPrecedenceReferences.status === 'REVIEW_REQUIRED' && terminalPrecedenceReferences.holds[0].reason === 'REFERENCE_RUN_RECEIPT_SHAPE_INVALID', 'a present bad terminal receipt cannot fall back to an older valid checkpoint');

    const legacyCheckpointReferenceRoot = path.join(temporary, 'legacy-checkpoint-reference-root'), legacyCheckpointReferenceRun = path.join(legacyCheckpointReferenceRoot, 'legacy-interrupted-run');
    fs.mkdirSync(legacyCheckpointReferenceRoot);
    fs.cpSync(cacheCheckpointRun.runDir, legacyCheckpointReferenceRun, { recursive: true });
    fs.unlinkSync(path.join(legacyCheckpointReferenceRun, 'run-checkpoints.jsonl'));
    equal(Core.cacheReferences.discover({ jobRoot: legacyCheckpointReferenceRoot, sourceRoot, nowMs: 10000000 }).holds[0].reason, 'REFERENCE_RUN_ANCHOR_MISSING', 'legacy interrupted state without a sealed checkpoint remains visible but non-authoritative');

    const mixedAnchorReferenceRoot = path.join(temporary, 'mixed-anchor-reference-root');
    fs.mkdirSync(mixedAnchorReferenceRoot);
    fs.cpSync(cacheMissRun.runDir, path.join(mixedAnchorReferenceRoot, 'terminal-run'), { recursive: true });
    fs.cpSync(cacheCheckpointRun.runDir, path.join(mixedAnchorReferenceRoot, 'checkpoint-run'), { recursive: true });
    const mixedAnchorReferences = Core.cacheReferences.discover({ jobRoot: mixedAnchorReferenceRoot, sourceRoot, nowMs: 10000000 });
    ok(mixedAnchorReferences.status === 'COMPLETE' && new Set(mixedAnchorReferences.runs.map((run) => run.evidence_kind)).size === 2 && mixedAnchorReferences.references.some((item) => item.evidence_kinds.length === 2), 'terminal and checkpoint anchors compose without losing their distinct evidence kinds');
    const discoveredReferences = Core.cacheReferences.discover({ jobRoot: cacheRunsRoot, sourceRoot, nowMs: 10000000 });
    ok(Core.cacheReferences.validate(discoveredReferences).length === 0 && discoveredReferences.status === 'COMPLETE' && discoveredReferences.runs.length === 6, 'discovery validates all six terminal portable cache-run ledgers');
    ok(Core.cacheReferences.validate(Core.canonical.seal({ schema: Core.cacheReferences.SCHEMA, version: Core.cacheReferences.VERSION, status: 'COMPLETE' })).length > 0, 'malformed but canonically sealed reference input returns contract errors instead of escaping validation');
    equal(discoveredReferences.protected_keys, cacheMissLedger.map((receipt) => receipt.cache.key).sort(), 'discovery protects exactly the three cache keys referenced by verified material');
    ok(discoveredReferences.references.every((item) => item.entry_digests.length === 1 && item.anchor_receipt_digests.length >= 1 && item.step_receipt_digests.length >= 1), 'each protected key binds exact entry, anchor, and step receipt digests');
    ok(!/[A-Za-z]:\\/.test(JSON.stringify(discoveredReferences)) && !JSON.stringify(discoveredReferences).includes('cache-miss-run'), 'reference set discloses neither machine paths nor private run identifiers');
    const checkpointBoundCacheInventory = Core.cacheRetention.inventory({ cacheRoot, sourceRoot, jobRoot: cacheCheckpointRunsRoot, nowMs: 10000000 });
    const checkpointBoundCachePlan = Core.cacheRetention.plan(checkpointBoundCacheInventory, { max_entries: 2, max_logical_bytes: checkpointBoundCacheInventory.usage.logical_bytes, max_filesystem_age_ms: 999999999 }, [], cacheCheckpointReferences);
    ok(checkpointBoundCachePlan.status === 'READY' && checkpointBoundCachePlan.references.mismatched_keys.length === 0 && checkpointBoundCachePlan.protected[0].key === cacheCheckpointReferences.protected_keys[0], 'retention accepts an exact checkpoint-derived entry binding and excludes it from deletion candidates');
    ok(checkpointBoundCacheInventory.lease_set.protected_keys.length === 0 && checkpointBoundCachePlan.protected[0].sources.includes('SEALED_RUN_EVIDENCE'), 'released in-flight lease hands protection to the sealed checkpoint without overlapping mutable authority');
    const missingReferenceRoot = path.join(temporary, 'missing-reference-root');
    const missingReferences = Core.cacheReferences.discover({ jobRoot: missingReferenceRoot, sourceRoot, nowMs: 10000000 });
    ok(missingReferences.status === 'REVIEW_REQUIRED' && !missingReferences.authority.protection_granted && !fs.existsSync(missingReferenceRoot), 'missing reference root is a sealed non-authoritative no-op');
    throws(() => Core.cacheReferences.discover({ jobRoot: sourceRoot, sourceRoot }), /REFERENCE_JOB_ROOT_OVERLAPS_SOURCE/, 'reference discovery refuses to scan the source tree');
    equal(Core.cacheReferences.discover({ jobRoot: cacheRunsRoot, sourceRoot, nowMs: 10000000, scanMaxDirectoryEntries: 1 }).status, 'LIMIT_EXCEEDED', 'reference discovery bounds the initial direct-directory enumeration');
    equal(Core.cacheReferences.discover({ jobRoot: cacheRunsRoot, sourceRoot, nowMs: 10000000, scanMaxRuns: 1 }).status, 'LIMIT_EXCEEDED', 'reference discovery stops at its explicit run ceiling');
    equal(Core.cacheReferences.discover({ jobRoot: cacheRunsRoot, sourceRoot, nowMs: 10000000, scanMaxReceipts: 1 }).status, 'LIMIT_EXCEEDED', 'reference discovery stops at its explicit receipt ceiling');

    const incompleteReferenceRoot = path.join(temporary, 'incomplete-reference-root');
    fs.mkdirSync(incompleteReferenceRoot);
    fs.cpSync(cacheMissRun.runDir, path.join(incompleteReferenceRoot, 'valid-run-copy'), { recursive: true });
    fs.mkdirSync(path.join(incompleteReferenceRoot, 'incomplete-run'));
    const incompleteReferences = Core.cacheReferences.discover({ jobRoot: incompleteReferenceRoot, sourceRoot, nowMs: 10000000 });
    ok(incompleteReferences.status === 'REVIEW_REQUIRED' && incompleteReferences.protected_keys.length === 3 && !incompleteReferences.authority.protection_granted, 'one incomplete run holds the whole derived protection set without hiding valid references');
    const tamperedReferenceRoot = path.join(temporary, 'tampered-reference-root');
    fs.mkdirSync(tamperedReferenceRoot);
    const tamperedReferenceRun = path.join(tamperedReferenceRoot, 'tampered-run-copy');
    fs.cpSync(cacheMissRun.runDir, tamperedReferenceRun, { recursive: true });
    const tamperedReferenceLedger = lines(path.join(tamperedReferenceRun, 'step-receipts.jsonl'));
    const tamperedReferenceReceipt = JSON.parse(tamperedReferenceLedger[0]);
    tamperedReferenceReceipt.detail = 'changed without a new seal';
    tamperedReferenceLedger[0] = JSON.stringify(tamperedReferenceReceipt);
    fs.writeFileSync(path.join(tamperedReferenceRun, 'step-receipts.jsonl'), tamperedReferenceLedger.join('\n') + '\n');
    const tamperedReferences = Core.cacheReferences.discover({ jobRoot: tamperedReferenceRoot, sourceRoot, nowMs: 10000000 });
    ok(tamperedReferences.status === 'REVIEW_REQUIRED' && tamperedReferences.holds[0].reason === 'REFERENCE_LEDGER_DIGEST_INVALID', 'tampered ledger bytes cannot grant cache protection');
    const mixedReferenceRoot = path.join(temporary, 'mixed-reference-root');
    fs.mkdirSync(mixedReferenceRoot);
    const mixedReferenceRun = path.join(mixedReferenceRoot, 'mixed-run-copy');
    fs.cpSync(cacheMissRun.runDir, mixedReferenceRun, { recursive: true });
    resealRunLedger(mixedReferenceRun, (receipts) => { receipts[0].schema = Core.stepReceipts.SCHEMAS.game; });
    const mixedReferences = Core.cacheReferences.discover({ jobRoot: mixedReferenceRoot, sourceRoot, nowMs: 10000000 });
    ok(mixedReferences.status === 'REVIEW_REQUIRED' && mixedReferences.holds[0].reason === 'REFERENCE_LEDGER_SCHEMA_INVALID', 'mixed-schema ledger cannot grant cache protection even after resealing');
    const conflictingReferenceRoot = path.join(temporary, 'conflicting-reference-root');
    fs.mkdirSync(conflictingReferenceRoot);
    const originalReferenceRun = path.join(conflictingReferenceRoot, 'original-run-copy'), conflictingReferenceRun = path.join(conflictingReferenceRoot, 'conflicting-run-copy');
    fs.cpSync(cacheMissRun.runDir, originalReferenceRun, { recursive: true });
    fs.cpSync(cacheMissRun.runDir, conflictingReferenceRun, { recursive: true });
    resealRunLedger(conflictingReferenceRun, (receipts) => { receipts[0].cache.entry_digest = 'f'.repeat(64); });
    const conflictingReferences = Core.cacheReferences.discover({ jobRoot: conflictingReferenceRoot, sourceRoot, nowMs: 10000000 });
    ok(conflictingReferences.status === 'REVIEW_REQUIRED' && conflictingReferences.holds.some((item) => item.reason === 'REFERENCE_ENTRY_DIGEST_CONFLICT'), 'contradictory exact entry digests hold the aggregate reference set');
    const linkedReferenceRoot = path.join(temporary, 'linked-reference-root');
    fs.mkdirSync(linkedReferenceRoot);
    fs.symlinkSync(cacheMissRun.runDir, path.join(linkedReferenceRoot, 'linked-run'), 'junction');
    const linkedReferences = Core.cacheReferences.discover({ jobRoot: linkedReferenceRoot, sourceRoot, nowMs: 10000000 });
    ok(linkedReferences.status === 'REVIEW_REQUIRED' && linkedReferences.holds[0].reason === 'REFERENCE_RUN_DIRECTORY_LINK_REFUSED', 'reference discovery records but never follows a linked run directory');

    const inventorySchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'schemas', 'production-artifact-cache-inventory.schema.json'), 'utf8'));
    const proposalSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'schemas', 'production-artifact-cache-retention-proposal.schema.json'), 'utf8'));
    const applicationSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'schemas', 'production-artifact-cache-retention-application.schema.json'), 'utf8'));
    equal([referenceSchema.$id, inventorySchema.$id, proposalSchema.$id, applicationSchema.$id], [Core.cacheReferences.SCHEMA, Core.cacheRetention.INVENTORY_SCHEMA, Core.cacheRetention.PROPOSAL_SCHEMA, Core.cacheRetention.APPLICATION_SCHEMA], 'tracked cache governance schemas match the runtime contracts');
    const absentRetentionRoot = path.join(temporary, 'absent-retention-cache');
    const absentInventory = Core.cacheRetention.inventory({ cacheRoot: absentRetentionRoot, sourceRoot, nowMs: 10000000 });
    ok(absentInventory.status === 'COMPLETE' && absentInventory.root_exists === false && absentInventory.usage.entries === 0, 'read-only retention inventory represents an absent cache without inventing entries');
    ok(!fs.existsSync(absentRetentionRoot), 'read-only retention inventory does not create an absent cache root');

    const retentionRoot = path.join(temporary, 'retention-cache'), retentionJobs = path.join(temporary, 'retention-jobs');
    fs.mkdirSync(retentionJobs, { recursive: true });
    const retentionHandle = Core.artifactCache.open({ cacheRoot: retentionRoot, sourceRoot, jobRoot: retentionJobs });
    const retentionProduced = { artifacts: [{ path: firstPackage.outputs[0].path, content: JSON.stringify(Core.documentRegistry.normalizeBrief(firstPackage.document_payload), null, 2) + '\n' }], facts: { operation: firstPackage.document_operation } };
    const retentionStores = ['retention-oldest', 'retention-protected', 'retention-newest'].map((seed) => retentionHandle.publish(firstPackage, [], seed, retentionProduced));
    ok(retentionStores.every((item) => item.state === 'STORED'), 'retention fixture starts from three immutable verified cache entries');
    const retentionNow = 10000000;
    [10000, 5000, 1000].forEach((age, index) => setTreeMtime(path.join(retentionRoot, 'entries', retentionStores[index].key.slice(0, 2), retentionStores[index].key), retentionNow - age));
    const protectedKey = retentionStores[1].key;
    const retentionReferenceRoot = path.join(temporary, 'retention-reference-runs'), retentionReferenceRun = path.join(retentionReferenceRoot, 'sealed-reference-run');
    fs.mkdirSync(retentionReferenceRoot);
    fs.cpSync(cacheMissRun.runDir, retentionReferenceRun, { recursive: true });
    resealRunLedger(retentionReferenceRun, (receipts) => {
      receipts.forEach((receipt, index) => {
        receipt.cache = index === 0
          ? { state: 'HIT', key: protectedKey, entry_digest: retentionStores[1].entry_digest }
          : { state: 'DISABLED', key: receipt.cache.key };
      });
    });
    const retentionReferences = Core.cacheReferences.discover({ jobRoot: retentionReferenceRoot, sourceRoot, nowMs: retentionNow });
    ok(retentionReferences.status === 'COMPLETE' && retentionReferences.authority.protection_granted && Core.cacheReferences.validate(retentionReferences).length === 0, 'one fully sealed terminal ledger grants a bounded cache protection reference set');
    equal(retentionReferences.protected_keys, [protectedKey], 'the derived reference set protects only the exact verified cache key');
    const retentionOptions = { cacheRoot: retentionRoot, sourceRoot, jobRoot: retentionJobs, nowMs: retentionNow };
    const leaseRaceRoot = path.join(temporary, 'lease-retention-race-cache'), leaseRaceJobs = path.join(temporary, 'lease-retention-race-jobs');
    fs.mkdirSync(leaseRaceJobs);
    const leaseRaceHandle = Core.artifactCache.open({ cacheRoot: leaseRaceRoot, sourceRoot, jobRoot: leaseRaceJobs });
    const leaseRaceStore = leaseRaceHandle.publish(firstPackage, [], 'lease-retention-race', retentionProduced);
    const leaseRaceNow = 30000000, leaseRaceEntry = path.join(leaseRaceRoot, 'entries', leaseRaceStore.key.slice(0, 2), leaseRaceStore.key);
    setTreeMtime(leaseRaceEntry, leaseRaceNow - 10000);
    const leaseRaceOptions = { cacheRoot: leaseRaceRoot, sourceRoot, jobRoot: leaseRaceJobs, nowMs: leaseRaceNow };
    const leaseRacePolicy = { max_entries: 0, max_logical_bytes: 0, max_filesystem_age_ms: 999999999 };
    const beforeLeaseInventory = Core.cacheRetention.inventory(leaseRaceOptions);
    const beforeLeaseProposal = Core.cacheRetention.plan(beforeLeaseInventory, leaseRacePolicy, []);
    equal(beforeLeaseProposal.candidates.map((item) => item.key), [leaseRaceStore.key], 'unleased retention fixture begins as one exact deletion candidate');
    const activeRetentionLease = Core.cacheLeases.acquire({ cacheRoot: leaseRaceRoot, sourceRoot, jobRoot: leaseRaceJobs, runId: 'active-retention-run', planDigest: 'e'.repeat(64), startedAt: 'active-retention-start', durationMs: 10000, nowMs: leaseRaceNow + 1 });
    activeRetentionLease.protect(leaseRaceStore.key, leaseRaceNow + 2);
    const leasedInventory = Core.cacheRetention.inventory(Object.assign({}, leaseRaceOptions, { nowMs: leaseRaceNow + 3 }));
    const leasedProposal = Core.cacheRetention.plan(leasedInventory, leaseRacePolicy, []);
    ok(leasedInventory.lease_set.protected_keys[0] === leaseRaceStore.key && leasedProposal.candidates.length === 0 && leasedProposal.protected[0].sources.includes('ACTIVE_CACHE_LEASE'), 'retention planning excludes an exact active leased key and records its protection source');
    const staleLeaseApplication = Core.cacheRetention.apply(Object.assign({}, leaseRaceOptions, { nowMs: leaseRaceNow + 3, proposal: beforeLeaseProposal, approvedDigest: beforeLeaseProposal.digest, explicit: true }));
    ok(staleLeaseApplication.status === 'LEASES_STALE' && !staleLeaseApplication.authority.deletion_performed && fs.existsSync(leaseRaceEntry), 'lease acquired after planning invalidates approval before any deletion');
    activeRetentionLease.release(leaseRaceNow + 4);
    const releasedLeaseInventory = Core.cacheRetention.inventory(Object.assign({}, leaseRaceOptions, { nowMs: leaseRaceNow + 5 }));
    const releasedLeaseProposal = Core.cacheRetention.plan(releasedLeaseInventory, leaseRacePolicy, []);
    const busyLeaseApplication = Core.cacheLeases.withKeyLock({ cacheRoot: leaseRaceRoot, sourceRoot, jobRoot: leaseRaceJobs }, leaseRaceStore.key, () => Core.cacheRetention.apply(Object.assign({}, leaseRaceOptions, { nowMs: leaseRaceNow + 5, proposal: releasedLeaseProposal, approvedDigest: releasedLeaseProposal.digest, explicit: true })));
    ok(busyLeaseApplication.status === 'LEASE_COORDINATION_BUSY' && !busyLeaseApplication.authority.deletion_performed && fs.existsSync(leaseRaceEntry), 'held per-key coordination lock prevents the check/delete race without partial mutation');
    const releasedLeaseApplication = Core.cacheRetention.apply(Object.assign({}, leaseRaceOptions, { nowMs: leaseRaceNow + 5, proposal: releasedLeaseProposal, approvedDigest: releasedLeaseProposal.digest, explicit: true }));
    ok(releasedLeaseApplication.status === 'APPLIED' && releasedLeaseApplication.lease_snapshot_digest === releasedLeaseProposal.leases.lease_set_snapshot_digest && !fs.existsSync(leaseRaceEntry), 'released lease permits the exact approved deletion and application binds the guarded lease snapshot');
    const retentionInventory = Core.cacheRetention.inventory(retentionOptions);
    ok(Core.canonical.validDigest(retentionInventory) && retentionInventory.status === 'COMPLETE' && retentionInventory.usage.entries === 3, 'retention inventory is sealed and counts exact eligible entries');
    ok(retentionInventory.entries.every((item) => item.classification === 'TEMPORARY_CAPTURE' && item.integrity_scope === 'SEALED_MANIFEST_LAYOUT_AND_SIZE'), 'inventory classifies cache copies without claiming artifact-content revalidation');
    ok(!/[A-Za-z]:\\/.test(JSON.stringify(retentionInventory)), 'retention inventory discloses no local cache path');
    equal(Core.cacheRetention.inventory(Object.assign({}, retentionOptions, { scanMaxEntries: 1 })).status, 'LIMIT_EXCEEDED', 'retention inventory stops at its explicit entry scan budget');
    const mismatchedEntryReferenceRoot = path.join(temporary, 'mismatched-entry-reference-runs'), mismatchedEntryReferenceRun = path.join(mismatchedEntryReferenceRoot, 'sealed-reference-run');
    fs.mkdirSync(mismatchedEntryReferenceRoot);
    fs.cpSync(retentionReferenceRun, mismatchedEntryReferenceRun, { recursive: true });
    resealRunLedger(mismatchedEntryReferenceRun, (receipts) => { receipts[0].cache.entry_digest = 'f'.repeat(64); });
    const mismatchedEntryReferences = Core.cacheReferences.discover({ jobRoot: mismatchedEntryReferenceRoot, sourceRoot, nowMs: retentionNow });
    const mismatchedEntryProposal = Core.cacheRetention.plan(retentionInventory, { max_entries: 1, max_logical_bytes: retentionInventory.usage.logical_bytes, max_filesystem_age_ms: 6000 }, [], mismatchedEntryReferences);
    ok(mismatchedEntryReferences.status === 'COMPLETE' && mismatchedEntryProposal.status === 'HELD' && mismatchedEntryProposal.references.mismatched_keys[0] === protectedKey, 'a reference key bound to a different sealed entry digest holds retention instead of granting ambiguous protection');

    const bytePolicy = { max_entries: 99, max_logical_bytes: retentionInventory.usage.logical_bytes - retentionInventory.entries[0].logical_bytes, max_filesystem_age_ms: 999999 };
    const byteProposal = Core.cacheRetention.plan(retentionInventory, bytePolicy, []);
    ok(byteProposal.candidates.length === 1 && byteProposal.candidates[0].reasons.includes('LOGICAL_BYTES'), 'logical-byte pressure selects the oldest exact entry deterministically');
    const retentionPolicy = { max_entries: 1, max_logical_bytes: retentionInventory.usage.logical_bytes, max_filesystem_age_ms: 6000 };
    const retentionProposal = Core.cacheRetention.plan(retentionInventory, retentionPolicy, [], retentionReferences);
    ok(Core.canonical.validDigest(retentionProposal) && retentionProposal.status === 'READY' && retentionProposal.application_allowed, 'retention planner emits a sealed applicable proposal');
    ok(retentionProposal.references.manual_keys.length === 0 && retentionProposal.references.discovered_keys[0] === protectedKey && retentionProposal.references.reference_set_digest === retentionReferences.digest, 'retention proposal binds the discovered set instead of trusting an untracked manual key');
    equal(retentionProposal.candidates.map((item) => item.key), [retentionStores[0].key, retentionStores[2].key], 'age and count budgets select exact unprotected entries in oldest-first order');
    ok(retentionProposal.candidates[0].reasons.includes('FILESYSTEM_AGE') && retentionProposal.candidates[1].reasons.includes('ENTRY_COUNT'), 'proposal preserves the separate reason for each budget decision');
    equal(retentionProposal.protected.map((item) => item.key), [protectedKey], 'an exact referenced key is excluded from every deletion candidate');
    ok(retentionStores.every((item) => fs.existsSync(path.join(retentionRoot, 'entries', item.key.slice(0, 2), item.key))), 'planning is a dry run and deletes nothing');
    equal(Core.cacheRetention.plan(retentionInventory, Object.assign({}, retentionPolicy, { max_filesystem_age_ms: 100 }), [], retentionReferences).status, 'READY_WITH_LIMITS', 'protected expired evidence remains held instead of being evicted to fake policy satisfaction');
    throws(() => Core.cacheRetention.plan(retentionInventory, { max_entries: -1, max_logical_bytes: 1, max_filesystem_age_ms: 1 }, []), /RETENTION_POLICY_VALUE_INVALID/, 'negative retention budgets are refused');

    const notRequestedApplication = Core.cacheRetention.applicationNotRequested(retentionProposal.digest);
    ok(notRequestedApplication.status === 'NOT_REQUESTED' && !notRequestedApplication.authority.deletion_performed, 'unrequested retention application is a sealed content-free no-op');
    equal(Core.cacheRetention.apply(Object.assign({}, retentionOptions, { proposal: retentionProposal, approvedDigest: retentionProposal.digest })).status, 'NOT_APPROVED', 'proposal digest without explicit apply authority deletes nothing');
    equal(Core.cacheRetention.apply(Object.assign({}, retentionOptions, { proposal: retentionProposal, approvedDigest: 'f'.repeat(64), explicit: true })).status, 'APPROVAL_MISMATCH', 'explicit apply with the wrong proposal digest deletes nothing');
    equal(Core.cacheRetention.apply(Object.assign({}, retentionOptions, { proposal: retentionProposal, approvedDigest: retentionProposal.digest, explicit: true })).status, 'REFERENCES_REQUIRED', 'approved discovered-reference proposal cannot apply without a fresh reference root');
    const substitutedProposal = Core.canonical.clone(retentionProposal);
    substitutedProposal.candidates[0].key = protectedKey;
    substitutedProposal.candidates[0].entry_digest = retentionProposal.protected[0].entry_digest;
    const resealedSubstitution = Core.canonical.seal(substitutedProposal);
    equal(Core.cacheRetention.apply(Object.assign({}, retentionOptions, { referenceJobRoot: retentionReferenceRoot, proposal: resealedSubstitution, approvedDigest: resealedSubstitution.digest, explicit: true })).status, 'PROPOSAL_NOT_REPRODUCIBLE', 'a validly resealed arbitrary candidate substitution cannot impersonate the official planner');
    ok(retentionStores.every((item) => fs.existsSync(path.join(retentionRoot, 'entries', item.key.slice(0, 2), item.key))), 'all retention authority and proposal-integrity refusals preserve every entry');
    const lateReferenceRun = path.join(retentionReferenceRoot, 'late-terminal-run');
    fs.cpSync(retentionReferenceRun, lateReferenceRun, { recursive: true });
    equal(Core.cacheRetention.apply(Object.assign({}, retentionOptions, { referenceJobRoot: retentionReferenceRoot, proposal: retentionProposal, approvedDigest: retentionProposal.digest, explicit: true })).status, 'REFERENCES_STALE', 'a newly sealed terminal run invalidates the approved reference snapshot before deletion');
    fs.rmSync(lateReferenceRun, { recursive: true });
    ok(retentionStores.every((item) => fs.existsSync(path.join(retentionRoot, 'entries', item.key.slice(0, 2), item.key))), 'reference-snapshot refusal deletes none of the selected cache entries');
    const differentRetentionRoot = path.join(temporary, 'different-retention-cache');
    Core.artifactCache.open({ cacheRoot: differentRetentionRoot, sourceRoot, jobRoot: retentionJobs });
    equal(Core.cacheRetention.apply({ cacheRoot: differentRetentionRoot, sourceRoot, jobRoot: retentionJobs, referenceJobRoot: retentionReferenceRoot, nowMs: retentionNow, proposal: retentionProposal, approvedDigest: retentionProposal.digest, explicit: true }).status, 'STALE', 'an approved proposal is bound to one hashed cache root identity');

    const lateStore = await publishCacheInChild({ module: require.resolve('./artifact-cache'), cacheRoot: retentionRoot, sourceRoot, jobRoot: retentionJobs, pkg: firstPackage, inputs: [], seed: 'retention-late-write', produced: retentionProduced });
    equal(Core.cacheRetention.apply(Object.assign({}, retentionOptions, { referenceJobRoot: retentionReferenceRoot, proposal: retentionProposal, approvedDigest: retentionProposal.digest, explicit: true })).status, 'STALE', 'a separate publisher invalidates the approved inventory snapshot before deletion');
    ok(retentionStores.every((item) => fs.existsSync(path.join(retentionRoot, 'entries', item.key.slice(0, 2), item.key))), 'stale proposal refusal deletes none of its originally selected entries');
    equal(retentionHandle.invalidate(lateStore.key, { explicit: true }).status, 'REMOVED', 'test removes only the exact concurrent entry before retrying the original sealed proposal');
    const appliedRetention = Core.cacheRetention.apply(Object.assign({}, retentionOptions, { referenceJobRoot: retentionReferenceRoot, proposal: retentionProposal, approvedDigest: retentionProposal.digest, explicit: true }));
    ok(Core.canonical.validDigest(appliedRetention) && appliedRetention.status === 'APPLIED' && appliedRetention.policy_satisfied, 'exact approved proposal applies and seals post-delete policy satisfaction');
    equal(appliedRetention.reference_snapshot_digest, retentionReferences.snapshot_digest, 'application receipt binds the freshly rediscovered terminal-ledger snapshot');
    ok(appliedRetention.outcomes.length === 2 && appliedRetention.outcomes.every((item) => item.entry_removed && Core.canonical.validDigest({ schema: Core.artifactCache.INVALIDATION_SCHEMA, key: item.key, status: item.status, entry_removed: item.entry_removed, explicit: true, authority: { installed: false, promoted: false, canon: false }, digest: item.invalidation_receipt_digest })), 'application binds two exact selective invalidation receipts');
    ok(fs.existsSync(path.join(retentionRoot, 'entries', protectedKey.slice(0, 2), protectedKey)) && appliedRetention.usage_after.entries === 1, 'post-delete readback preserves the protected entry and observes exact remaining usage');

    const protectedRoot = path.join(retentionRoot, 'entries', protectedKey.slice(0, 2), protectedKey);
    const unexpectedFile = path.join(protectedRoot, 'unexpected.bin');
    fs.writeFileSync(unexpectedFile, 'not declared cache data');
    const heldMalformedInventory = Core.cacheRetention.inventory(retentionOptions);
    equal(heldMalformedInventory.status, 'REVIEW_REQUIRED', 'undeclared cache contents become unclassified instead of automatic deletion material');
    ok(Core.cacheRetention.plan(heldMalformedInventory, retentionPolicy, []).status === 'HELD', 'unclassified content holds the retention proposal');
    fs.unlinkSync(unexpectedFile);
    const publisherDirectory = path.join(retentionRoot, 'entries', protectedKey.slice(0, 2), protectedKey + '.next-active');
    fs.mkdirSync(publisherDirectory);
    const busyInventory = Core.cacheRetention.inventory(retentionOptions);
    ok(busyInventory.status === 'REVIEW_REQUIRED' && busyInventory.temporary_publishers === 1, 'active publication marker holds retention planning without being deleted');
    fs.rmdirSync(publisherDirectory);

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
