'use strict';

const fs = require('fs');
const path = require('path');
const Codec = require('./canonical');
const Contracts = require('./contracts');
const Compiler = require('./compiler');
const StepReceipts = require('./step-receipt-contract');

const START_CONFIRMATION = 'RUN GAME PRODUCTION CANDIDATE';
const CLAIM_STATUSES = ['PASS', 'FAIL', 'WARNING', 'UNKNOWN', 'MISSING_VALIDATOR', 'HUMAN_REVIEW', 'NOT_APPLICABLE'];

function inside(root, candidate) {
  const base = path.resolve(root), target = path.resolve(candidate);
  return target === base || target.startsWith(base + path.sep);
}

function resolveExistingLinks(candidate) {
  let cursor = path.resolve(candidate);
  const tail = [];
  while (!fs.existsSync(cursor)) {
    const parent = path.dirname(cursor);
    if (parent === cursor) break;
    tail.unshift(path.basename(cursor));
    cursor = parent;
  }
  const existing = fs.existsSync(cursor) ? fs.realpathSync.native(cursor) : cursor;
  return path.resolve(existing, ...tail);
}

function assertJobRoot(jobRoot, sourceRoot) {
  if (!path.isAbsolute(String(jobRoot || ''))) throw new Error('job root must be an explicit absolute path');
  const requested = path.resolve(jobRoot), resolved = resolveExistingLinks(requested), parsed = path.parse(resolved);
  if (resolved === parsed.root) throw new Error('job root may not be a filesystem root');
  const source = resolveExistingLinks(sourceRoot || process.cwd());
  if (inside(source, resolved) || inside(resolved, source)) throw new Error('job root must be isolated from the source tree');
  if (requested.toLowerCase() !== resolved.toLowerCase()) throw new Error('job root may not traverse a symbolic link or junction');
  return resolved;
}

function safeTarget(root, relative) {
  if (!Contracts.safeRelative(relative)) throw new Error('unsafe artifact path: ' + relative);
  const target = path.resolve(root, String(relative).replace(/\//g, path.sep));
  if (!inside(root, target) || target === path.resolve(root)) throw new Error('artifact escaped package root');
  if (!inside(resolveExistingLinks(root), resolveExistingLinks(target))) throw new Error('artifact path escaped through a symbolic link or junction');
  return target;
}

function registryMap(items, method) {
  const map = new Map();
  for (const item of items || []) {
    if (!item || !Contracts.exactIdentity(item.identity) || typeof item[method] !== 'function') throw new Error('invalid ' + method + ' registry entry');
    const key = Compiler.identityKey(item.identity);
    if (map.has(key)) throw new Error('duplicate registry identity: ' + key);
    map.set(key, item);
  }
  return map;
}

function writeJsonAtomic(file, value) {
  const temporary = file + '.next';
  fs.writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n', { flag: 'w' });
  fs.renameSync(temporary, file);
}

function appendReceipt(file, receipt) {
  fs.appendFileSync(file, JSON.stringify(receipt) + '\n', { encoding: 'utf8', flag: 'a' });
}

function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }

function readReceiptLedger(file, expectedSchema) {
  if (!fs.existsSync(file)) return [];
  const raw = fs.readFileSync(file, 'utf8').trim();
  if (!raw) return [];
  const lines = raw.split(/\r?\n/);
  const receipts = lines.map((line, index) => {
    let receipt;
    try { receipt = JSON.parse(line); } catch (_) { throw new Error('step receipt ledger line ' + (index + 1) + ' is invalid JSON'); }
    if (!Codec.validDigest(receipt)) throw new Error('step receipt ledger digest mismatch at line ' + (index + 1));
    return receipt;
  });
  const observedSchema = StepReceipts.inferSchema(receipts, expectedSchema || StepReceipts.SCHEMAS.game);
  if (expectedSchema && observedSchema !== expectedSchema) throw new Error('step receipt ledger schema mismatch');
  receipts.forEach((receipt, index) => {
    const errors = StepReceipts.validate(receipt, observedSchema);
    if (errors.length) throw new Error('step receipt ledger contract mismatch at line ' + (index + 1) + ': ' + errors.join('; '));
  });
  return receipts.map((receipt, index) => {
    const expected = index === 0 ? null : receipts[index - 1].digest;
    if (receipt.previous_receipt_digest !== expected) throw new Error('step receipt ledger chain mismatch at line ' + (index + 1));
    return receipt;
  });
}

function assertResumeIntegrity(state, plan, receiptFile, runReceiptFile, stepReceiptSchema) {
  const ledger = readReceiptLedger(receiptFile, stepReceiptSchema);
  if (state.ledger_count !== ledger.length) throw new Error('step receipt ledger count mismatch');
  const tail = ledger.length ? ledger[ledger.length - 1].digest : null;
  if (state.ledger_tail !== tail) throw new Error('step receipt ledger tail mismatch');
  const byDigest = new Map(ledger.map((receipt) => [receipt.digest, receipt]));
  if (byDigest.size !== ledger.length) throw new Error('step receipt ledger contains a duplicate digest');
  for (const step of Object.values(state.steps || {})) {
    if (step.state !== 'VERIFIED') throw new Error('resume state contains an unsupported step state');
    const receipt = byDigest.get(step.receipt_digest);
    if (!receipt || receipt.run_id !== state.id || receipt.package_ref.id !== step.package_id || receipt.state !== 'VERIFIED') throw new Error('resume state is not bound to its step receipt for ' + step.package_id);
    if (Codec.canonical(receipt.outputs) !== Codec.canonical(step.outputs)) throw new Error('resume state output index drift for ' + step.package_id);
  }
  if (state.status === 'CANDIDATE_READY') {
    const completed = new Set(Object.keys(state.steps || {}));
    if (plan.execution_order.some((id) => !completed.has(id)) || completed.size !== plan.execution_order.length) throw new Error('terminal candidate state is incomplete');
  }
  if (terminal(state)) {
    if (!fs.existsSync(runReceiptFile)) throw new Error('terminal run has no sealed run receipt');
    const receipt = readJson(runReceiptFile);
    if (!Codec.validDigest(receipt) || receipt.id !== state.id || receipt.state !== state.status || receipt.intent_ref.digest !== plan.intent_ref.digest || receipt.graph_ref.digest !== plan.graph_ref.digest) throw new Error('terminal run receipt integrity mismatch');
    const terminalSchemaRequired = stepReceiptSchema === StepReceipts.SCHEMAS.production || !!state.step_receipt_schema;
    if ((terminalSchemaRequired && receipt.step_receipt_schema !== stepReceiptSchema) || (receipt.step_receipt_schema != null && receipt.step_receipt_schema !== stepReceiptSchema)) throw new Error('terminal run receipt step schema mismatch');
    if (Codec.canonical(receipt.step_receipts) !== Codec.canonical(Object.values(state.steps).map((step) => step.receipt_digest))) throw new Error('terminal run receipt step binding mismatch');
    return receipt;
  }
  return null;
}

function verificationErrors(receipt, pkg) {
  const errors = [];
  if (!receipt || receipt.schema !== 'axm.verification-receipt/v2') errors.push('verification receipt schema mismatch');
  if (!receipt || !receipt.verifier || receipt.verifier.id !== pkg.verifier.id || receipt.verifier.version !== pkg.verifier.version) errors.push('appointed verifier identity mismatch');
  if (!receipt || !receipt.subject || receipt.subject.id !== pkg.id || receipt.subject.digest !== pkg.digest) errors.push('verification subject does not bind exact package digest');
  if (!receipt || !Array.isArray(receipt.claims)) errors.push('verification receipt needs claims');
  for (const claim of receipt && receipt.claims || []) {
    if (!claim || !Contracts.portableId(claim.id) || !CLAIM_STATUSES.includes(claim.status) || typeof claim.required !== 'boolean' || !Array.isArray(claim.evidence)) errors.push('verification receipt contains an invalid atomic claim');
  }
  return errors;
}

function verdictFor(pkg, receipt) {
  const rows = new Map((receipt.claims || []).map((claim) => [claim.id, claim]));
  let warning = false, review = false;
  for (const declared of pkg.claims) {
    const claim = rows.get(declared.id);
    if (!claim) return { verdict: 'HELD', reason: 'missing required claim receipt: ' + declared.id };
    if (claim.required !== declared.required) return { verdict: 'HELD', reason: 'claim required flag drifted: ' + declared.id };
    if (declared.required && claim.status === 'FAIL') return { verdict: 'FAILED', reason: 'required claim failed: ' + declared.id };
    if (declared.required && ['UNKNOWN', 'MISSING_VALIDATOR', 'NOT_APPLICABLE'].includes(claim.status)) return { verdict: 'HELD', reason: 'required claim lacks evidence: ' + declared.id };
    if (declared.required && claim.status === 'HUMAN_REVIEW') review = true;
    if (claim.status === 'WARNING' || (!declared.required && claim.status === 'FAIL')) warning = true;
  }
  if (review) return { verdict: 'HUMAN_REVIEW', reason: 'required human judgment remains unresolved' };
  if (warning) return { verdict: 'VERIFIED_WITH_LIMITS', reason: 'only optional warnings remain' };
  return { verdict: 'VERIFIED', reason: 'all required claims have native evidence' };
}

function artifactIndex(state) {
  const index = [];
  for (const step of Object.values(state.steps || {})) for (const artifact of step.outputs || []) index.push(Object.assign({ package_id: step.package_id }, artifact));
  return index;
}

function verifyPreservedOutputs(runDir, step) {
  for (const artifact of step.outputs || []) {
    const file = safeTarget(runDir, artifact.run_relative_path);
    if (!fs.existsSync(file)) return false;
    const bytes = fs.readFileSync(file);
    if (bytes.length !== artifact.bytes || Codec.sha256(bytes) !== artifact.digest) return false;
  }
  return true;
}

function timeout(promise, milliseconds) {
  let timer;
  return Promise.race([
    Promise.resolve(promise),
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('executor exceeded cooperative timeout')), milliseconds); })
  ]).finally(() => clearTimeout(timer));
}

function terminal(state) { return ['CANDIDATE_READY', 'HUMAN_REVIEW', 'HELD', 'FAILED', 'CANCELLED'].includes(state.status); }

function finalReceipt(state, plan, at) {
  const receipt = {
    schema: Contracts.SCHEMAS.run,
    id: state.id,
    version: '0.1.0',
    state: state.status,
    intent_ref: Codec.clone(plan.intent_ref),
    graph_ref: Codec.clone(plan.graph_ref),
    source_anchor: plan.source_anchor,
    started_at: state.started_at,
    updated_at: at,
    step_receipt_schema: state.step_receipt_schema,
    step_receipts: Object.values(state.steps).map((step) => step.receipt_digest),
    overall_verdict: state.overall_verdict,
    human_review: state.status === 'HUMAN_REVIEW',
    authority: { installed: false, promoted: false, canon: false, released: false }
  };
  return Codec.seal(receipt);
}

async function run(options) {
  options = options || {};
  if (options.confirmation !== START_CONFIRMATION) throw new Error('explicit start confirmation is required');
  const plan = options.plan, packages = options.packages || [];
  const planErrors = Compiler.validatePlan(plan, packages);
  if (planErrors.length) throw new Contracts.ContractError('plan', planErrors);
  if (plan.status !== 'READY') throw new Error('held plan may not execute');
  const packageMap = new Map(packages.map((pkg) => [pkg.id, Contracts.assertValid('package', pkg)]));
  const executors = registryMap(options.executors, 'execute');
  const verifiers = registryMap(options.verifiers, 'verify');
  const root = assertJobRoot(options.jobRoot, options.sourceRoot);
  fs.mkdirSync(root, { recursive: true });
  const runId = String(options.runId || ('run-' + plan.digest.slice(0, 16))).toLowerCase();
  if (!Contracts.portableId(runId)) throw new Error('run id must be portable');
  const runDir = path.join(root, runId);
  if (!inside(root, runDir)) throw new Error('run directory escaped job root');
  if (fs.existsSync(runDir) && resolveExistingLinks(runDir).toLowerCase() !== path.resolve(runDir).toLowerCase()) throw new Error('run directory may not be a symbolic link or junction');
  const stateFile = path.join(runDir, 'run-state.json'), receiptFile = path.join(runDir, 'step-receipts.jsonl'), runReceiptFile = path.join(runDir, 'run-receipt.json');
  const clock = typeof options.clock === 'function' ? options.clock : () => new Date().toISOString();
  const requestedStepReceiptSchema = StepReceipts.schemaFor(options.stepReceiptProfile);
  let stepReceiptSchema = requestedStepReceiptSchema;
  let legacyStepReceiptSchema = false;
  let state;

  if (fs.existsSync(runDir)) {
    if (!options.resume) throw new Error('run already exists; explicit resume is required');
    if (!fs.existsSync(stateFile)) throw new Error('existing run has no state receipt');
    state = readJson(stateFile);
    if (state.plan_digest !== plan.digest) throw new Error('resume plan digest mismatch');
    if (state.step_receipt_compatibility != null && state.step_receipt_compatibility !== 'legacy-game') throw new Error('unsupported step receipt compatibility marker');
    const existingLedger = readReceiptLedger(receiptFile);
    const observedStepReceiptSchema = existingLedger.length ? StepReceipts.inferSchema(existingLedger) : null;
    const persistedStepReceiptSchema = state.step_receipt_schema || null;
    if (persistedStepReceiptSchema) StepReceipts.inferSchema([], persistedStepReceiptSchema);
    if (persistedStepReceiptSchema && observedStepReceiptSchema && persistedStepReceiptSchema !== observedStepReceiptSchema) throw new Error('run state step receipt schema disagrees with ledger');
    stepReceiptSchema = persistedStepReceiptSchema || observedStepReceiptSchema || StepReceipts.SCHEMAS.game;
    const legacyUpgrade = !persistedStepReceiptSchema && requestedStepReceiptSchema === StepReceipts.SCHEMAS.production && stepReceiptSchema === StepReceipts.SCHEMAS.game;
    const legacyContinuation = state.step_receipt_compatibility === 'legacy-game';
    const mismatchAllowed = options.allowLegacyGameStepReceipts === true && (legacyUpgrade || (legacyContinuation && requestedStepReceiptSchema === StepReceipts.SCHEMAS.production && stepReceiptSchema === StepReceipts.SCHEMAS.game));
    if (stepReceiptSchema !== requestedStepReceiptSchema && !mismatchAllowed) throw new Error('resume step receipt profile mismatch');
    legacyStepReceiptSchema = stepReceiptSchema !== requestedStepReceiptSchema;
    const terminalReceipt = assertResumeIntegrity(state, plan, receiptFile, runReceiptFile, stepReceiptSchema);
    state.step_receipt_schema = stepReceiptSchema;
    if (legacyStepReceiptSchema) state.step_receipt_compatibility = 'legacy-game';
    for (const step of Object.values(state.steps || {})) if (step.state === 'VERIFIED' && !verifyPreservedOutputs(runDir, step)) throw new Error('verified output drift blocks resume for ' + step.package_id);
    if (terminal(state)) return { state: Codec.clone(state), runReceipt: terminalReceipt, runDir, stepReceiptSchema, legacyStepReceiptSchema };
    state.status = 'RUNNING'; state.updated_at = clock();
  } else {
    fs.mkdirSync(runDir, { recursive: false });
    writeJsonAtomic(path.join(runDir, 'plan.json'), plan);
    writeJsonAtomic(path.join(runDir, 'packages.json'), packages);
    state = { schema: 'axm.game-production-run-state/v1', id: runId, plan_digest: plan.digest, step_receipt_schema: stepReceiptSchema, status: 'RUNNING', overall_verdict: 'PENDING', started_at: clock(), updated_at: clock(), steps: {}, attempts: {}, ledger_count: 0, ledger_tail: null, boundaries: { source_write: false, network: false, automatic_install: false, automatic_promotion: false } };
  }
  writeJsonAtomic(stateFile, state);

  let completedThisCall = 0;
  for (const packageId of plan.execution_order) {
    const pkg = packageMap.get(packageId);
    if (!pkg) throw new Error('plan package missing at runtime: ' + packageId);
    if (state.steps[packageId] && state.steps[packageId].state === 'VERIFIED') continue;
    if (typeof options.cancelled === 'function' && options.cancelled()) {
      state.status = 'CANCELLED'; state.overall_verdict = 'HELD'; state.updated_at = clock(); writeJsonAtomic(stateFile, state); break;
    }
    if (Number.isInteger(options.maxSteps) && completedThisCall >= options.maxSteps) {
      state.status = 'INTERRUPTED'; state.overall_verdict = 'HELD'; state.updated_at = clock(); writeJsonAtomic(stateFile, state); break;
    }
    const executor = executors.get(Compiler.identityKey(pkg.executor)), verifier = verifiers.get(Compiler.identityKey(pkg.verifier));
    if (!executor || !verifier) { state.status = 'HELD'; state.overall_verdict = 'HELD'; state.hold_reason = 'exact executor or verifier disappeared for ' + packageId; state.updated_at = clock(); writeJsonAtomic(stateFile, state); break; }

    const inputArtifacts = artifactIndex(state).filter((artifact) => pkg.dependencies.includes(artifact.package_id));
    let accepted = false;
    for (let attempt = (state.attempts[packageId] || 0) + 1; attempt <= pkg.repair_policy.max_attempts; attempt += 1) {
      state.attempts[packageId] = attempt; state.updated_at = clock(); writeJsonAtomic(stateFile, state);
      const startedAt = clock();
      let produced = null, verification = null, outcome = { verdict: 'FAILED', reason: 'executor did not return' }, error = null;
      try {
        produced = await timeout(executor.execute({
          package: Codec.clone(pkg),
          seed: String(options.seed || plan.intent_ref.digest),
          inputs: inputArtifacts.map((item) => ({ package_id: item.package_id, path: item.path, digest: item.digest, bytes: item.bytes })),
          readInput: (packageIdValue, relative) => {
            const artifact = inputArtifacts.find((item) => item.package_id === packageIdValue && item.path === relative);
            if (!artifact) throw new Error('undeclared input requested');
            return fs.readFileSync(safeTarget(runDir, artifact.run_relative_path));
          }
        }), pkg.resource_budget.timeout_ms);
        if (!produced || !Array.isArray(produced.artifacts)) throw new Error('executor must return artifacts');
        const declared = new Set(pkg.outputs.map((item) => item.path));
        const returned = produced.artifacts.map((item) => item && item.path);
        if (returned.length !== declared.size || new Set(returned).size !== returned.length || returned.some((item) => !declared.has(item))) throw new Error('executor outputs do not match declared paths');
        let total = 0;
        for (const artifact of produced.artifacts) {
          const content = Buffer.isBuffer(artifact.content) ? artifact.content : Buffer.from(String(artifact.content == null ? '' : artifact.content), 'utf8');
          total += content.length; artifact.content = content;
        }
        if (total > pkg.resource_budget.max_output_bytes) throw new Error('executor output exceeds package byte budget');
        const evidenceArtifacts = produced.artifacts.map((artifact) => ({ path: artifact.path, bytes: artifact.content.length, digest: Codec.sha256(artifact.content) }));
        const producedByPath = new Map(produced.artifacts.map((artifact) => [artifact.path, artifact]));
        verification = await Promise.resolve(verifier.verify({
          package: Codec.clone(pkg),
          artifacts: Codec.clone(evidenceArtifacts),
          facts: Codec.clone(produced.facts || {}),
          inputs: Codec.clone(inputArtifacts),
          readArtifact: (relative) => {
            if (!declared.has(relative) || !producedByPath.has(relative)) throw new Error('verifier requested an undeclared output');
            return Buffer.from(producedByPath.get(relative).content);
          },
          readInput: (packageIdValue, relative) => {
            const artifact = inputArtifacts.find((item) => item.package_id === packageIdValue && item.path === relative);
            if (!artifact) throw new Error('verifier requested an undeclared input');
            return Buffer.from(fs.readFileSync(safeTarget(runDir, artifact.run_relative_path)));
          }
        }));
        const receiptErrors = verificationErrors(verification, pkg);
        if (typeof options.receiptValidator === 'function') receiptErrors.push(...(options.receiptValidator(verification) || []));
        if (receiptErrors.length) outcome = { verdict: 'HELD', reason: receiptErrors.join('; ') };
        else outcome = verdictFor(pkg, verification);
      } catch (caught) { error = caught; outcome = { verdict: 'FAILED', reason: String(caught && caught.message || caught) }; }

      const attemptRootRelative = 'packages/' + pkg.id + '/attempt-' + attempt;
      const attemptRoot = safeTarget(runDir, attemptRootRelative);
      fs.mkdirSync(attemptRoot, { recursive: true });
      const outputs = [];
      if (produced && ['VERIFIED', 'VERIFIED_WITH_LIMITS', 'HUMAN_REVIEW'].includes(outcome.verdict)) {
        for (const artifact of produced.artifacts) {
          const relative = attemptRootRelative + '/artifacts/' + artifact.path;
          const target = safeTarget(runDir, relative);
          fs.mkdirSync(path.dirname(target), { recursive: true });
          fs.writeFileSync(target, artifact.content, { flag: 'wx' });
          outputs.push({ path: artifact.path, run_relative_path: relative.replace(/\\/g, '/'), bytes: artifact.content.length, digest: Codec.sha256(artifact.content) });
        }
      }
      const completedAt = clock();
      const stepReceipt = Codec.seal({
        schema: stepReceiptSchema,
        run_id: runId,
        step_id: pkg.id + '.attempt-' + attempt,
        package_ref: { id: pkg.id, version: pkg.version, digest: pkg.digest },
        attempt,
        state: outcome.verdict === 'FAILED' ? 'FAILED' : outcome.verdict === 'HELD' ? 'HELD' : 'VERIFIED',
        started_at: startedAt,
        completed_at: completedAt,
        inputs: inputArtifacts.map((item) => ({ package_id: item.package_id, path: item.path, digest: item.digest })),
        outputs,
        process: { executor: Codec.clone(pkg.executor), native_process_started: false, cooperative_timeout_ms: pkg.resource_budget.timeout_ms, error: error ? outcome.reason : null },
        evidence: verification ? [verification] : [],
        verdict: outcome.verdict,
        detail: outcome.reason,
        cache: { state: 'MISS', key: Codec.digest({ package_digest: pkg.digest, inputs: inputArtifacts.map((item) => item.digest), executor: pkg.executor, verifier: pkg.verifier, seed: String(options.seed || plan.intent_ref.digest) }) },
        previous_receipt_digest: state.ledger_tail,
        authority: { source_write: false, installed: false, promoted: false, canon: false }
      });
      appendReceipt(receiptFile, stepReceipt);
      state.ledger_count += 1;
      state.ledger_tail = stepReceipt.digest;
      if (stepReceipt.state === 'VERIFIED') {
        state.steps[packageId] = { package_id: packageId, state: 'VERIFIED', verdict: outcome.verdict, outputs, receipt_digest: stepReceipt.digest };
        accepted = true; completedThisCall += 1; state.updated_at = completedAt; writeJsonAtomic(stateFile, state);
        if (outcome.verdict === 'HUMAN_REVIEW') { state.status = 'HUMAN_REVIEW'; state.overall_verdict = 'HUMAN_REVIEW'; state.hold_reason = outcome.reason; writeJsonAtomic(stateFile, state); }
        break;
      }
      if (outcome.verdict === 'HELD') { state.status = 'HELD'; state.overall_verdict = 'HELD'; state.hold_reason = outcome.reason; state.updated_at = completedAt; writeJsonAtomic(stateFile, state); break; }
      if (attempt === pkg.repair_policy.max_attempts) { state.status = 'FAILED'; state.overall_verdict = 'FAILED'; state.hold_reason = outcome.reason; state.updated_at = completedAt; writeJsonAtomic(stateFile, state); }
    }
    if (!accepted || state.status === 'HUMAN_REVIEW') break;
  }

  if (state.status === 'RUNNING' && Object.keys(state.steps).length === plan.execution_order.length) { state.status = 'CANDIDATE_READY'; state.overall_verdict = 'VERIFIED'; state.updated_at = clock(); writeJsonAtomic(stateFile, state); }
  if (terminal(state)) { const receipt = finalReceipt(state, plan, clock()); writeJsonAtomic(runReceiptFile, receipt); return { state: Codec.clone(state), runReceipt: receipt, runDir, stepReceiptSchema, legacyStepReceiptSchema }; }
  return { state: Codec.clone(state), runReceipt: null, runDir, stepReceiptSchema, legacyStepReceiptSchema };
}

module.exports = { START_CONFIRMATION, assertJobRoot, verificationErrors, verdictFor, run };
