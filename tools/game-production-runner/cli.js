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
    else if (item === '--reference-job-root') result.referenceJobRoot = argv[++index];
    else if (item === '--cache-root') result.cacheRoot = argv[++index];
    else if (item === '--cache-key') result.cacheKey = argv[++index];
    else if (item === '--max-cache-entries') result.maxCacheEntries = Number(argv[++index]);
    else if (item === '--max-cache-bytes') result.maxCacheBytes = Number(argv[++index]);
    else if (item === '--max-cache-age-ms') result.maxCacheAgeMs = Number(argv[++index]);
    else if (item === '--minimum-released-age-ms') result.minimumReleasedAgeMs = Number(argv[++index]);
    else if (item === '--minimum-expired-age-ms') result.minimumExpiredAgeMs = Number(argv[++index]);
    else if (item === '--max-curation-candidates') result.maxCurationCandidates = Number(argv[++index]);
    else if (item === '--protect-key') { result.protectedKeys = result.protectedKeys || []; result.protectedKeys.push(argv[++index]); }
    else if (item === '--proposal') result.proposal = argv[++index];
    else if (item === '--approve-proposal') result.approvedProposal = argv[++index];
    else if (item === '--run-id') result.runId = argv[++index];
    else if (item === '--confirm') result.confirmation = argv[++index];
    else if (item === '--max-steps') result.maxSteps = Number(argv[++index]);
    else if (item === '--substrate-root') result.substrateRoot = argv[++index];
    else if (item === '--resume') result.resume = true;
    else if (item === '--automated-only') result.automatedOnly = true;
    else if (item === '--read-only-probe') result.readOnlyProbe = true;
    else if (item === '--explicit-probe') result.explicitProbe = true;
    else if (item === '--explicit-invalidate') result.explicitInvalidate = true;
    else if (item === '--explicit-apply') result.explicitApply = true;
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
    '  run-demo --job-root DIRECTORY [--cache-root DIRECTORY] [--run-id ID] [--resume] [--max-steps N] --confirm "' + Core.runner.START_CONFIRMATION + '"',
    '  run-profile-demo --job-root DIRECTORY [--cache-root DIRECTORY] [--run-id ID] [--resume] [--max-steps N] --confirm "' + Core.portable.START_CONFIRMATION + '"',
    '  run-document-demo --job-root DIRECTORY [--cache-root DIRECTORY] [--run-id ID] [--resume] [--max-steps N] --confirm "' + Core.portable.START_CONFIRMATION + '"',
    '  invalidate-cache --cache-root DIRECTORY --cache-key SHA256 --explicit-invalidate',
    '  discover-cache-leases --cache-root DIRECTORY',
    '  plan-cache-lease-curation --cache-root DIRECTORY --minimum-released-age-ms N --minimum-expired-age-ms N --max-curation-candidates N',
    '  apply-cache-lease-curation --cache-root DIRECTORY --proposal FILE --approve-proposal SHA256 --explicit-apply',
    '  audit-cache-lease-archives --cache-root DIRECTORY',
    '  discover-cache-references --job-root DIRECTORY',
    '  inventory-cache --cache-root DIRECTORY',
    '  plan-cache-retention --cache-root DIRECTORY --max-cache-entries N --max-cache-bytes N --max-cache-age-ms N [--reference-job-root DIRECTORY] [--protect-key SHA256 ...]',
    '  apply-cache-retention --cache-root DIRECTORY --proposal FILE --approve-proposal SHA256 [--reference-job-root DIRECTORY] --explicit-apply',
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

function loadProposal(file) {
  if (!file) throw new Error('proposal file is required');
  const resolved = path.resolve(file), stat = fs.lstatSync(resolved);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 2097152) throw new Error('proposal must be a plain JSON file no larger than 2 MiB');
  return JSON.parse(fs.readFileSync(resolved, 'utf8'));
}

function retentionPolicy(options) {
  return {
    max_entries: options.maxCacheEntries,
    max_logical_bytes: options.maxCacheBytes,
    max_filesystem_age_ms: options.maxCacheAgeMs
  };
}

function leaseCurationPolicy(options) {
  return {
    minimum_released_age_ms: options.minimumReleasedAgeMs,
    minimum_expired_age_ms: options.minimumExpiredAgeMs,
    max_candidates: options.maxCurationCandidates
  };
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
    const result = await Core.runner.run({ plan, packages: spec.packages, executors: registry.executors, verifiers: registry.verifiers, receiptValidator: Core.adapters.verificationReceiptValidator(ROOT), jobRoot: path.resolve(options.jobRoot), cacheRoot: options.cacheRoot ? path.resolve(options.cacheRoot) : undefined, sourceRoot: ROOT, runId: options.runId, confirmation: options.confirmation, resume: options.resume, maxSteps: Number.isInteger(options.maxSteps) ? options.maxSteps : undefined });
    const output = { schema: 'axm.game-production-runner-cli-result/v1', state: result.state, run_receipt: result.runReceipt, run_checkpoint: result.checkpointReceipt, cache_lease_release: result.cacheLeaseRelease, local_run_directory: result.runDir, native_game_proven: false, automatic_install: false, canon: false };
    return { output: JSON.stringify(output, null, 2), code: ['CANDIDATE_READY', 'HUMAN_REVIEW', 'INTERRUPTED'].includes(result.state.status) ? 0 : 2 };
  }
  if (options.command === 'run-profile-demo') {
    if (!options.jobRoot) throw new Error('run-profile-demo requires --job-root');
    const registry = Core.fixtures.create();
    const spec = Core.portableFixture.build();
    const plan = Core.portable.compile(spec, registry.inventory);
    const result = await Core.portable.run({ spec, plan, executors: registry.executors, verifiers: registry.verifiers, receiptValidator: Core.adapters.verificationReceiptValidator(ROOT), jobRoot: path.resolve(options.jobRoot), cacheRoot: options.cacheRoot ? path.resolve(options.cacheRoot) : undefined, sourceRoot: ROOT, runId: options.runId, confirmation: options.confirmation, resume: options.resume, maxSteps: Number.isInteger(options.maxSteps) ? options.maxSteps : undefined });
    const output = { schema: 'axm.production-runner-cli-result/v1', state: result.state, run_receipt: result.runReceipt, run_checkpoint: result.checkpointReceipt, cache_lease_release: result.cacheLeaseRelease, local_run_directory: result.runDir, domain: plan.domain, proof_scope: 'cross-domain orchestration mechanics only', automatic_install: false, canon: false };
    return { output: JSON.stringify(output, null, 2), code: ['CANDIDATE_READY', 'HUMAN_REVIEW', 'INTERRUPTED'].includes(result.state.state) ? 0 : 2 };
  }
  if (options.command === 'run-document-demo') {
    if (!options.jobRoot) throw new Error('run-document-demo requires --job-root');
    const registry = Core.documentRegistry.create();
    const spec = Core.portableDocuments.build();
    const plan = Core.portable.compile(spec, registry.inventory);
    const result = await Core.portable.run({ spec, plan, executors: registry.executors, verifiers: registry.verifiers, receiptValidator: Core.adapters.verificationReceiptValidator(ROOT), jobRoot: path.resolve(options.jobRoot), cacheRoot: options.cacheRoot ? path.resolve(options.cacheRoot) : undefined, sourceRoot: ROOT, runId: options.runId, confirmation: options.confirmation, resume: options.resume, maxSteps: Number.isInteger(options.maxSteps) ? options.maxSteps : undefined });
    const output = { schema: 'axm.production-runner-cli-result/v1', state: result.state, run_receipt: result.runReceipt, run_checkpoint: result.checkpointReceipt, cache_lease_release: result.cacheLeaseRelease, local_run_directory: result.runDir, domain: plan.domain, proof_scope: 'content-derived deterministic documentation verification; editorial quality remains human review', automatic_install: false, canon: false };
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
  if (options.command === 'invalidate-cache') {
    if (!options.explicitInvalidate) return { output: JSON.stringify(Core.artifactCache.invalidationNotRequested(options.cacheKey), null, 2), code: 0 };
    if (!options.cacheRoot) throw new Error('invalidate-cache requires --cache-root');
    const cache = Core.artifactCache.open({ cacheRoot: path.resolve(options.cacheRoot), sourceRoot: ROOT });
    const result = cache.invalidate(options.cacheKey, { explicit: true });
    return { output: JSON.stringify(result, null, 2), code: ['REMOVED', 'ABSENT'].includes(result.status) ? 0 : 2 };
  }
  if (options.command === 'inventory-cache') {
    if (!options.cacheRoot) throw new Error('inventory-cache requires --cache-root');
    const result = Core.cacheRetention.inventory({ cacheRoot: path.resolve(options.cacheRoot), sourceRoot: ROOT });
    return { output: JSON.stringify(result, null, 2), code: result.status === 'COMPLETE' ? 0 : 2 };
  }
  if (options.command === 'discover-cache-leases') {
    if (!options.cacheRoot) throw new Error('discover-cache-leases requires --cache-root');
    const result = Core.cacheLeases.discover({ cacheRoot: path.resolve(options.cacheRoot), sourceRoot: ROOT });
    return { output: JSON.stringify(result, null, 2), code: result.status === 'COMPLETE' ? 0 : 2 };
  }
  if (options.command === 'plan-cache-lease-curation') {
    if (!options.cacheRoot) throw new Error('plan-cache-lease-curation requires --cache-root');
    const leaseSet = Core.cacheLeases.discover({ cacheRoot: path.resolve(options.cacheRoot), sourceRoot: ROOT });
    const proposal = Core.cacheLeaseCuration.plan(leaseSet, leaseCurationPolicy(options));
    const result = { schema: 'axm.production-artifact-cache-lease-curation-plan-output/v1', lease_set: leaseSet, proposal, source_segment_deletion_performed: false };
    return { output: JSON.stringify(result, null, 2), code: ['READY', 'READY_WITH_LIMITS', 'NO_CHANGES'].includes(proposal.status) ? 0 : 2 };
  }
  if (options.command === 'apply-cache-lease-curation') {
    if (!options.explicitApply) return { output: JSON.stringify(Core.cacheLeaseCuration.applicationNotRequested(options.approvedProposal), null, 2), code: 0 };
    if (!options.cacheRoot) throw new Error('apply-cache-lease-curation requires --cache-root');
    if (!options.approvedProposal) throw new Error('apply-cache-lease-curation requires --approve-proposal');
    const result = Core.cacheLeaseCuration.apply({ cacheRoot: path.resolve(options.cacheRoot), sourceRoot: ROOT, proposal: loadProposal(options.proposal), approvedDigest: options.approvedProposal, explicit: true });
    return { output: JSON.stringify(result, null, 2), code: result.status === 'APPLIED' ? 0 : 2 };
  }
  if (options.command === 'audit-cache-lease-archives') {
    if (!options.cacheRoot) throw new Error('audit-cache-lease-archives requires --cache-root');
    const result = Core.cacheLeaseCuration.audit({ cacheRoot: path.resolve(options.cacheRoot), sourceRoot: ROOT });
    return { output: JSON.stringify(result, null, 2), code: result.status === 'COMPLETE' ? 0 : 2 };
  }
  if (options.command === 'discover-cache-references') {
    if (!options.jobRoot) throw new Error('discover-cache-references requires --job-root');
    const result = Core.cacheReferences.discover({ jobRoot: path.resolve(options.jobRoot), sourceRoot: ROOT });
    return { output: JSON.stringify(result, null, 2), code: result.status === 'COMPLETE' ? 0 : 2 };
  }
  if (options.command === 'plan-cache-retention') {
    if (!options.cacheRoot) throw new Error('plan-cache-retention requires --cache-root');
    const inventory = Core.cacheRetention.inventory({ cacheRoot: path.resolve(options.cacheRoot), sourceRoot: ROOT });
    const referenceSet = options.referenceJobRoot ? Core.cacheReferences.discover({ jobRoot: path.resolve(options.referenceJobRoot), sourceRoot: ROOT }) : null;
    const proposal = Core.cacheRetention.plan(inventory, retentionPolicy(options), options.protectedKeys || [], referenceSet);
    const result = { schema: 'axm.production-artifact-cache-retention-plan-output/v1', inventory, reference_set: referenceSet, proposal, deletion_performed: false };
    return { output: JSON.stringify(result, null, 2), code: ['READY', 'READY_WITH_LIMITS', 'NO_CHANGES'].includes(proposal.status) ? 0 : 2 };
  }
  if (options.command === 'apply-cache-retention') {
    if (!options.explicitApply) return { output: JSON.stringify(Core.cacheRetention.applicationNotRequested(options.approvedProposal), null, 2), code: 0 };
    if (!options.cacheRoot) throw new Error('apply-cache-retention requires --cache-root');
    if (!options.approvedProposal) throw new Error('apply-cache-retention requires --approve-proposal');
    const result = Core.cacheRetention.apply({ cacheRoot: path.resolve(options.cacheRoot), sourceRoot: ROOT, referenceJobRoot: options.referenceJobRoot ? path.resolve(options.referenceJobRoot) : undefined, proposal: loadProposal(options.proposal), approvedDigest: options.approvedProposal, explicit: true });
    return { output: JSON.stringify(result, null, 2), code: result.status === 'APPLIED' ? 0 : 2 };
  }
  throw new Error('unknown command: ' + options.command + '\n' + usage());
}

if (require.main === module) main().then((result) => { process.stdout.write(result.output + '\n'); process.exitCode = result.code; }).catch((error) => { process.stderr.write(JSON.stringify({ schema: 'axm.game-production-runner-cli-error/v1', status: 'ERROR', reason: String(error.message || error) }, null, 2) + '\n'); process.exitCode = 1; });

module.exports = { ROOT, parse, usage, loadSpec, loadProposal, retentionPolicy, leaseCurationPolicy, summary, main };
