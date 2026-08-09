#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Core = require('../../shared/game-production-runner');

const ROOT = path.resolve(__dirname, '..', '..');

function parse(argv) {
  const result = { command: argv[0] || 'help' };
  for (let index = 1; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === '--spec') result.spec = argv[++index];
    else if (item === '--job-root') result.jobRoot = argv[++index];
    else if (item === '--run-id') result.runId = argv[++index];
    else if (item === '--confirm') result.confirmation = argv[++index];
    else if (item === '--max-steps') result.maxSteps = Number(argv[++index]);
    else if (item === '--substrate-root') result.substrateRoot = argv[++index];
    else if (item === '--resume') result.resume = true;
    else if (item === '--automated-only') result.automatedOnly = true;
    else if (item === '--read-only-probe') result.readOnlyProbe = true;
    else if (item === '--explicit-probe') result.explicitProbe = true;
    else throw new Error('unknown argument: ' + item);
  }
  return result;
}

function usage() {
  return [
    'AXM Game Production Runner v0.1 · EXPERIMENTAL',
    '  inspect',
    '  plan-demo [--automated-only]',
    '  plan-profile-demo',
    '  plan-document-demo',
    '  plan --spec FILE',
    '  run-demo --job-root DIRECTORY [--run-id ID] [--resume] [--max-steps N] --confirm "' + Core.runner.START_CONFIRMATION + '"',
    '  run-profile-demo --job-root DIRECTORY [--run-id ID] [--resume] [--max-steps N] --confirm "' + Core.portable.START_CONFIRMATION + '"',
    '  run-document-demo --job-root DIRECTORY [--run-id ID] [--resume] [--max-steps N] --confirm "' + Core.portable.START_CONFIRMATION + '"',
    '  probe-godot --read-only-probe [--substrate-root DIRECTORY]',
    '  probe-hand-confinement --explicit-probe',
    '',
    'v0.1 runs inert fixtures and one trusted in-process deterministic documentation Hand. It does not install, promote, canonize, release, or execute Godot.'
  ].join('\n');
}

function loadSpec(file) {
  if (!file) throw new Error('plan requires --spec');
  const resolved = path.resolve(file);
  return JSON.parse(fs.readFileSync(resolved, 'utf8'));
}

function summary(spec, plan) {
  return {
    schema: 'axm.game-production-runner-plan-output/v1',
    status: plan.status,
    plan,
    counts: { packages: spec.packages.length, steps: plan.execution_order.length, capability_gaps: plan.capability_gaps.length },
    truth: { execution_started: false, native_game_proven: false, automatic_install: false, canon: false }
  };
}

async function main(argv) {
  const options = parse(argv || process.argv.slice(2));
  if (options.command === 'help' || options.command === '--help') return { output: usage(), code: 0 };
  if (options.command === 'inspect') return { output: JSON.stringify(Core.adapters.inspect(ROOT), null, 2), code: 0 };
  if (options.command === 'plan-demo' || options.command === 'plan-profile-demo' || options.command === 'plan-document-demo' || options.command === 'plan') {
    const documentProfile = options.command === 'plan-document-demo';
    const registry = documentProfile ? Core.documentRegistry.create() : Core.fixtures.create();
    const portable = options.command === 'plan-profile-demo';
    const spec = options.command === 'plan' ? loadSpec(options.spec) : documentProfile ? Core.portableDocuments.build() : portable ? Core.portableFixture.build() : Core.proofyard.build({ includeHumanReview: !options.automatedOnly });
    const plan = portable || documentProfile ? Core.portable.compile(spec, registry.inventory) : Core.compiler.compile(spec, registry.inventory);
    return { output: JSON.stringify(summary(spec, plan), null, 2), code: plan.status === 'READY' ? 0 : 2 };
  }
  if (options.command === 'run-demo') {
    if (!options.jobRoot) throw new Error('run-demo requires --job-root');
    const registry = Core.fixtures.create();
    const spec = Core.proofyard.build({ includeHumanReview: !options.automatedOnly });
    const plan = Core.compiler.compile(spec, registry.inventory);
    const result = await Core.runner.run({ plan, packages: spec.packages, executors: registry.executors, verifiers: registry.verifiers, receiptValidator: Core.adapters.verificationReceiptValidator(ROOT), jobRoot: path.resolve(options.jobRoot), sourceRoot: ROOT, runId: options.runId, confirmation: options.confirmation, resume: options.resume, maxSteps: Number.isInteger(options.maxSteps) ? options.maxSteps : undefined });
    const output = { schema: 'axm.game-production-runner-cli-result/v1', state: result.state, run_receipt: result.runReceipt, local_run_directory: result.runDir, native_game_proven: false, automatic_install: false, canon: false };
    return { output: JSON.stringify(output, null, 2), code: ['CANDIDATE_READY', 'HUMAN_REVIEW', 'INTERRUPTED'].includes(result.state.status) ? 0 : 2 };
  }
  if (options.command === 'run-profile-demo') {
    if (!options.jobRoot) throw new Error('run-profile-demo requires --job-root');
    const registry = Core.fixtures.create();
    const spec = Core.portableFixture.build();
    const plan = Core.portable.compile(spec, registry.inventory);
    const result = await Core.portable.run({ spec, plan, executors: registry.executors, verifiers: registry.verifiers, receiptValidator: Core.adapters.verificationReceiptValidator(ROOT), jobRoot: path.resolve(options.jobRoot), sourceRoot: ROOT, runId: options.runId, confirmation: options.confirmation, resume: options.resume, maxSteps: Number.isInteger(options.maxSteps) ? options.maxSteps : undefined });
    const output = { schema: 'axm.production-runner-cli-result/v1', state: result.state, run_receipt: result.runReceipt, local_run_directory: result.runDir, domain: plan.domain, proof_scope: 'cross-domain orchestration mechanics only', automatic_install: false, canon: false };
    return { output: JSON.stringify(output, null, 2), code: ['CANDIDATE_READY', 'HUMAN_REVIEW', 'INTERRUPTED'].includes(result.state.state) ? 0 : 2 };
  }
  if (options.command === 'run-document-demo') {
    if (!options.jobRoot) throw new Error('run-document-demo requires --job-root');
    const registry = Core.documentRegistry.create();
    const spec = Core.portableDocuments.build();
    const plan = Core.portable.compile(spec, registry.inventory);
    const result = await Core.portable.run({ spec, plan, executors: registry.executors, verifiers: registry.verifiers, receiptValidator: Core.adapters.verificationReceiptValidator(ROOT), jobRoot: path.resolve(options.jobRoot), sourceRoot: ROOT, runId: options.runId, confirmation: options.confirmation, resume: options.resume, maxSteps: Number.isInteger(options.maxSteps) ? options.maxSteps : undefined });
    const output = { schema: 'axm.production-runner-cli-result/v1', state: result.state, run_receipt: result.runReceipt, local_run_directory: result.runDir, domain: plan.domain, proof_scope: 'content-derived deterministic documentation verification; editorial quality remains human review', automatic_install: false, canon: false };
    return { output: JSON.stringify(output, null, 2), code: ['CANDIDATE_READY', 'HUMAN_REVIEW', 'INTERRUPTED'].includes(result.state.state) ? 0 : 2 };
  }
  if (options.command === 'probe-godot') {
    const result = Core.adapters.probeGodot(ROOT, { explicitReadOnlyProbe: options.readOnlyProbe === true, substrateRoot: options.substrateRoot });
    return { output: JSON.stringify(result, null, 2), code: result.status === 'READY' || result.status === 'NOT_PROBED' ? 0 : 2 };
  }
  if (options.command === 'probe-hand-confinement') {
    const result = await Core.confinement.probe({ explicitProbe: options.explicitProbe === true });
    return { output: JSON.stringify(result, null, 2), code: ['NOT_PROBED', 'READY_WITH_LIMITS'].includes(result.status) ? 0 : 2 };
  }
  throw new Error('unknown command: ' + options.command + '\n' + usage());
}

if (require.main === module) main().then((result) => { process.stdout.write(result.output + '\n'); process.exitCode = result.code; }).catch((error) => { process.stderr.write(JSON.stringify({ schema: 'axm.game-production-runner-cli-error/v1', status: 'ERROR', reason: String(error.message || error) }, null, 2) + '\n'); process.exitCode = 1; });

module.exports = { ROOT, parse, usage, loadSpec, summary, main };
