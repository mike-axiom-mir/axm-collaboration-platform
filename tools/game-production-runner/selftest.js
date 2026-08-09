'use strict';

const assert = require('assert');
const childProcess = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Cli = require('./cli');

let checks = 0;
function ok(value, message) { assert.ok(value, message); checks += 1; }
function equal(actual, expected, message) { assert.deepStrictEqual(actual, expected, message); checks += 1; }
function invoke(args) { return childProcess.spawnSync(process.execPath, [path.join(__dirname, 'cli.js')].concat(args), { cwd: Cli.ROOT, encoding: 'utf8', windowsHide: true, shell: false, timeout: 15000 }); }
function parsed(result) { return JSON.parse(result.stdout || result.stderr); }
function ledger(file) { return fs.readFileSync(file, 'utf8').trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line)); }

async function main() {
  equal(Cli.parse(['run-demo', '--job-root', 'X', '--resume']).resume, true, 'CLI parses explicit resume');
  equal(Cli.parse(['run-demo', '--cache-root', 'Y']).cacheRoot, 'Y', 'CLI parses an explicit cache root');
  equal(Cli.parse(['plan-cache-retention', '--reference-job-root', 'R']).referenceJobRoot, 'R', 'CLI parses a separate terminal-ledger reference root');
  equal(Cli.parse(['invalidate-cache', '--cache-key', 'a', '--explicit-invalidate']).explicitInvalidate, true, 'CLI parses explicit cache invalidation authority');
  equal(Cli.parse(['plan-cache-retention', '--max-cache-entries', '2', '--max-cache-bytes', '100', '--max-cache-age-ms', '50', '--protect-key', 'a', '--protect-key', 'b']).protectedKeys, ['a', 'b'], 'CLI preserves repeated protected cache references');
  equal(Cli.parse(['apply-cache-retention', '--proposal', 'p.json', '--approve-proposal', 'a', '--explicit-apply']).explicitApply, true, 'CLI parses separate explicit retention application authority');
  equal(Cli.parse(['probe-hand-confinement', '--explicit-probe']).explicitProbe, true, 'CLI parses explicit confinement probe consent');
  assert.throws(() => Cli.parse(['inspect', '--unknown']), /unknown argument/); checks += 1;
  ok(Cli.usage().includes('trusted in-process deterministic documentation Hand'), 'usage preserves the Hand trust boundary');

  const inspect = invoke(['inspect']);
  equal(inspect.status, 0, 'inspect exits successfully');
  equal(parsed(inspect).native_runtime_probed, false, 'inspect never probes native runtime');

  const plan = invoke(['plan-demo', '--automated-only']);
  equal(plan.status, 0, 'automated demo plan is ready');
  const planned = parsed(plan);
  equal(planned.status, 'READY', 'plan output is READY');
  equal(planned.counts.packages, 5, 'demo exposes five package foundation');
  equal(planned.truth.execution_started, false, 'planning does not execute');

  const profilePlan = invoke(['plan-profile-demo']);
  equal(profilePlan.status, 0, 'portable non-game demo plan is ready');
  const profilePlanned = parsed(profilePlan);
  equal(profilePlanned.plan.schema, 'axm.production-plan/v1', 'portable CLI returns the neutral plan schema');
  equal(profilePlanned.plan.domain, 'documentation', 'portable CLI retains the documentation domain');
  equal(profilePlanned.counts.packages, 3, 'portable demo exposes three bounded packages');

  const documentPlan = invoke(['plan-document-demo']);
  equal(documentPlan.status, 0, 'content-verified document plan is ready');
  const documentPlanned = parsed(documentPlan);
  equal(documentPlanned.plan.schema, 'axm.production-plan/v1', 'document Hand uses the neutral plan schema');
  equal(documentPlanned.counts.packages, 3, 'document Hand declares three content-derived packages');

  const noProbe = invoke(['probe-godot']);
  equal(noProbe.status, 0, 'unrequested Godot probe is a safe no-op');
  equal(parsed(noProbe).status, 'NOT_PROBED', 'Godot remains unprobed without opt-in');
  const noConfinementProbe = invoke(['probe-hand-confinement']);
  equal(noConfinementProbe.status, 0, 'unrequested confinement probe is a safe no-op');
  equal(parsed(noConfinementProbe).status, 'NOT_PROBED', 'confinement remains unprobed without opt-in');
  const confinementProbe = invoke(['probe-hand-confinement', '--explicit-probe']);
  equal(confinementProbe.status, 2, 'degraded confinement substrate exits held');
  const confinementResult = parsed(confinementProbe);
  equal(confinementResult.status, 'DEGRADED', 'CLI exposes the supported Node 20-24 network denial gap');
  equal(confinementResult.activation, { execution_authority: false, trusted_hand_process: 'HOLD', untrusted_code: 'REFUSED' }, 'CLI confinement receipt grants no activation authority');
  ok(confinementResult.checks.slice(0, 5).every((item) => item.verdict === 'PASS') && confinementResult.checks[5].verdict === 'FAIL', 'CLI preserves each passed and failed confinement observation');
  equal(confinementResult.cleanup, { loopback_server_closed: true, temporary_root_removed: true }, 'CLI confinement probe cleans disposable resources');
  ok(!/[A-Za-z]:\\/.test(JSON.stringify(confinementResult)), 'CLI confinement receipt contains no machine path');

  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'AXM-GPR-CLI-'));
  try {
    const denied = invoke(['run-demo', '--automated-only', '--job-root', path.join(temporary, 'denied')]);
    equal(denied.status, 1, 'run without confirmation is refused');
    ok(/explicit start/.test(parsed(denied).reason), 'refusal names explicit start gate');

    const run = invoke(['run-demo', '--automated-only', '--job-root', path.join(temporary, 'runs'), '--run-id', 'cli-test-run', '--confirm', 'RUN GAME PRODUCTION CANDIDATE']);
    equal(run.status, 0, 'confirmed fixture run exits successfully');
    const result = parsed(run);
    equal(result.state.status, 'CANDIDATE_READY', 'CLI returns candidate ready fixture state');
    equal(result.native_game_proven, false, 'CLI does not relabel fixture as native game proof');
    equal(result.automatic_install, false, 'CLI never installs candidate');
    ok(fs.existsSync(path.join(result.local_run_directory, 'run-receipt.json')), 'CLI writes sealed run receipt in external job root');
    equal(JSON.parse(fs.readFileSync(path.join(result.local_run_directory, 'run-receipt.json'), 'utf8')).step_receipt_schema, 'axm.game-step-receipt/v1', 'game CLI preserves its game receipt schema');
    ok(ledger(path.join(result.local_run_directory, 'step-receipts.jsonl')).every((receipt) => receipt.schema === 'axm.game-step-receipt/v1'), 'game CLI ledger remains game scoped');

    const resume = invoke(['run-demo', '--automated-only', '--job-root', path.join(temporary, 'runs'), '--run-id', 'cli-test-run', '--resume', '--confirm', 'RUN GAME PRODUCTION CANDIDATE']);
    equal(resume.status, 0, 'explicit terminal resume is safe');
    equal(parsed(resume).state.status, 'CANDIDATE_READY', 'resume observes completed state');

    const profileDenied = invoke(['run-profile-demo', '--job-root', path.join(temporary, 'profile-denied')]);
    equal(profileDenied.status, 1, 'portable run without its confirmation is refused');
    ok(/portable production confirmation/.test(parsed(profileDenied).reason), 'portable refusal names its distinct start gate');
    const profileRun = invoke(['run-profile-demo', '--job-root', path.join(temporary, 'profile-runs'), '--run-id', 'profile-cli-run', '--confirm', 'RUN PRODUCTION CANDIDATE']);
    equal(profileRun.status, 0, 'confirmed portable fixture exits successfully');
    const profileResult = parsed(profileRun);
    equal(profileResult.state.state, 'CANDIDATE_READY', 'portable CLI returns candidate ready state');
    equal(profileResult.domain, 'documentation', 'portable CLI output names its domain');
    equal(profileResult.proof_scope, 'cross-domain orchestration mechanics only', 'portable CLI preserves its evidence ceiling');
    equal(profileResult.automatic_install, false, 'portable CLI never installs the candidate');
    ok(fs.existsSync(path.join(profileResult.local_run_directory, 'portable-run-receipt.json')), 'portable CLI preserves the neutral receipt');
    equal(profileResult.state.step_receipt_schema, 'axm.production-step-receipt/v1', 'portable CLI state declares neutral step receipts');
    equal(JSON.parse(fs.readFileSync(path.join(profileResult.local_run_directory, 'portable-run-receipt.json'), 'utf8')).step_receipt_schema, 'axm.production-step-receipt/v1', 'portable CLI receipt declares the neutral ledger schema');
    ok(ledger(path.join(profileResult.local_run_directory, 'step-receipts.jsonl')).every((receipt) => receipt.schema === 'axm.production-step-receipt/v1'), 'portable CLI ledger is neutral at every step');

    const documentRun = invoke(['run-document-demo', '--job-root', path.join(temporary, 'document-runs'), '--run-id', 'document-cli-run', '--confirm', 'RUN PRODUCTION CANDIDATE']);
    equal(documentRun.status, 0, 'confirmed content-verified document run exits successfully');
    const documentResult = parsed(documentRun);
    equal(documentResult.state.state, 'CANDIDATE_READY', 'document CLI returns candidate ready state');
    ok(/content-derived deterministic documentation verification/.test(documentResult.proof_scope), 'document CLI names its content-derived evidence scope');
    equal(documentResult.automatic_install, false, 'document CLI never installs the candidate');
    ok(fs.existsSync(path.join(documentResult.local_run_directory, 'portable-run-receipt.json')), 'document CLI preserves the neutral receipt');
    equal(documentResult.state.step_receipt_schema, 'axm.production-step-receipt/v1', 'content-verified document state declares neutral step receipts');
    ok(ledger(path.join(documentResult.local_run_directory, 'step-receipts.jsonl')).every((receipt) => receipt.schema === 'axm.production-step-receipt/v1'), 'content-verified document ledger is neutral at every step');

    const cacheRuns = path.join(temporary, 'cache-cli-runs'), cacheStore = path.join(temporary, 'cache-cli-store');
    const cacheMiss = invoke(['run-document-demo', '--job-root', cacheRuns, '--cache-root', cacheStore, '--run-id', 'cache-cli-miss', '--confirm', 'RUN PRODUCTION CANDIDATE']);
    equal(cacheMiss.status, 0, 'CLI explicit cache miss run exits successfully');
    const cacheMissResult = parsed(cacheMiss);
    const cacheMissLedger = ledger(path.join(cacheMissResult.local_run_directory, 'step-receipts.jsonl'));
    ok(cacheMissLedger.every((receipt) => receipt.cache.state === 'MISS_STORED' && receipt.process.executor_invoked === true), 'CLI cache miss stores exact verified artifacts');
    const cacheHit = invoke(['run-document-demo', '--job-root', cacheRuns, '--cache-root', cacheStore, '--run-id', 'cache-cli-hit', '--confirm', 'RUN PRODUCTION CANDIDATE']);
    equal(cacheHit.status, 0, 'CLI explicit cache hit run exits successfully');
    const cacheHitResult = parsed(cacheHit);
    ok(ledger(path.join(cacheHitResult.local_run_directory, 'step-receipts.jsonl')).every((receipt) => receipt.cache.state === 'HIT' && receipt.process.executor_invoked === false && receipt.evidence.length === 1), 'CLI hit skips executors but preserves fresh verifier evidence');
    const discoveredCacheReferences = invoke(['discover-cache-references', '--job-root', cacheRuns]);
    equal(discoveredCacheReferences.status, 0, 'CLI bounded terminal-ledger reference discovery exits successfully');
    const discoveredCacheReferenceSet = parsed(discoveredCacheReferences);
    ok(discoveredCacheReferenceSet.status === 'COMPLETE' && discoveredCacheReferenceSet.protected_keys.length === 3 && discoveredCacheReferenceSet.authority.protection_granted, 'CLI derives all three exact protected cache keys from sealed terminal runs');
    ok(!/[A-Za-z]:\\/.test(JSON.stringify(discoveredCacheReferenceSet)) && !JSON.stringify(discoveredCacheReferenceSet).includes('cache-cli-miss'), 'CLI reference set exposes neither machine paths nor private run identifiers');
    const unrequestedRetentionRoot = path.join(temporary, 'unrequested-retention-cache');
    const unrequestedRetention = invoke(['apply-cache-retention', '--cache-root', unrequestedRetentionRoot, '--approve-proposal', 'a'.repeat(64)]);
    equal(unrequestedRetention.status, 0, 'unrequested CLI retention application is a safe no-op');
    equal(parsed(unrequestedRetention).status, 'NOT_REQUESTED', 'unrequested CLI retention emits a sealed authority receipt');
    ok(!fs.existsSync(unrequestedRetentionRoot), 'unrequested retention application creates no cache directory');
    const retentionInventory = invoke(['inventory-cache', '--cache-root', cacheStore]);
    equal(retentionInventory.status, 0, 'CLI read-only cache inventory exits successfully for a plain cache');
    ok(parsed(retentionInventory).usage.entries === 3 && parsed(retentionInventory).status === 'COMPLETE', 'CLI inventory observes all three cache entries without deleting them');
    const fullyReferencedPlan = invoke(['plan-cache-retention', '--cache-root', cacheStore, '--reference-job-root', cacheRuns, '--max-cache-entries', '1', '--max-cache-bytes', '9999999', '--max-cache-age-ms', '999999999999']);
    equal(fullyReferencedPlan.status, 2, 'CLI holds a policy that would require deleting discovered referenced evidence');
    const fullyReferencedResult = parsed(fullyReferencedPlan);
    ok(fullyReferencedResult.reference_set.status === 'COMPLETE' && fullyReferencedResult.proposal.status === 'HELD' && fullyReferencedResult.proposal.candidates.length === 0 && fullyReferencedResult.proposal.protected.length === 3, 'CLI plan binds terminal-ledger discovery and proposes no referenced deletion');
    const retentionPlan = invoke(['plan-cache-retention', '--cache-root', cacheStore, '--max-cache-entries', '1', '--max-cache-bytes', '9999999', '--max-cache-age-ms', '999999999999', '--protect-key', cacheMissLedger[0].cache.key]);
    equal(retentionPlan.status, 0, 'CLI retention dry-run produces an applicable proposal');
    const retentionPlanResult = parsed(retentionPlan), retentionProposal = retentionPlanResult.proposal;
    ok(retentionPlanResult.deletion_performed === false && retentionProposal.candidates.length === 2 && retentionProposal.protected[0].key === cacheMissLedger[0].cache.key, 'CLI plan protects the referenced key and proposes the other two exact entries');
    const retentionProposalFile = path.join(temporary, 'retention-proposal.json');
    fs.writeFileSync(retentionProposalFile, JSON.stringify(retentionProposal, null, 2) + '\n');
    const wrongRetentionApproval = invoke(['apply-cache-retention', '--cache-root', cacheStore, '--proposal', retentionProposalFile, '--approve-proposal', 'f'.repeat(64), '--explicit-apply']);
    equal(wrongRetentionApproval.status, 2, 'CLI wrong proposal approval exits held');
    equal(parsed(wrongRetentionApproval).status, 'APPROVAL_MISMATCH', 'CLI wrong proposal approval deletes nothing');
    const appliedRetention = invoke(['apply-cache-retention', '--cache-root', cacheStore, '--proposal', retentionProposalFile, '--approve-proposal', retentionProposal.digest, '--explicit-apply']);
    equal(appliedRetention.status, 0, 'CLI exact approved retention application exits successfully');
    ok(parsed(appliedRetention).status === 'APPLIED' && parsed(appliedRetention).outcomes.length === 2 && parsed(appliedRetention).usage_after.entries === 1, 'CLI retention applies two exact deletions and verifies one protected entry remains');
    const unrequestedInvalidationRoot = path.join(temporary, 'unrequested-invalidation-cache');
    const unrequestedInvalidation = invoke(['invalidate-cache', '--cache-root', unrequestedInvalidationRoot, '--cache-key', cacheMissLedger[0].cache.key]);
    equal(unrequestedInvalidation.status, 0, 'unrequested CLI cache invalidation is a safe no-op');
    equal(parsed(unrequestedInvalidation).status, 'NOT_REQUESTED', 'unrequested invalidation returns a sealed refusal receipt');
    ok(!fs.existsSync(unrequestedInvalidationRoot), 'unrequested invalidation creates no cache directory');
    const explicitInvalidation = invoke(['invalidate-cache', '--cache-root', cacheStore, '--cache-key', cacheMissLedger[0].cache.key, '--explicit-invalidate']);
    equal(explicitInvalidation.status, 0, 'explicit CLI invalidation succeeds');
    equal(parsed(explicitInvalidation).status, 'REMOVED', 'CLI invalidation reports exact selected-entry removal');
    const cacheOverlap = invoke(['run-document-demo', '--job-root', path.join(temporary, 'overlap-runs'), '--cache-root', path.join(temporary, 'overlap-runs', 'cache'), '--run-id', 'cache-overlap', '--confirm', 'RUN PRODUCTION CANDIDATE']);
    equal(cacheOverlap.status, 1, 'CLI refuses a cache root nested inside its job root');
    ok(/CACHE_ROOT_OVERLAPS_JOB_ROOT/.test(parsed(cacheOverlap).reason), 'CLI cache isolation refusal is explicit');

    const sourceDenied = invoke(['run-demo', '--automated-only', '--job-root', path.join(Cli.ROOT, 'exports', 'bad-run'), '--run-id', 'source-denied', '--confirm', 'RUN GAME PRODUCTION CANDIDATE']);
    equal(sourceDenied.status, 1, 'source-tree candidate root is refused');
    ok(/isolated from the source tree/.test(parsed(sourceDenied).reason), 'source-tree refusal is explicit');
  } finally {
    const resolved = path.resolve(temporary), base = path.resolve(os.tmpdir());
    if (!resolved.startsWith(base + path.sep) || !path.basename(resolved).startsWith('AXM-GPR-CLI-')) throw new Error('refused unsafe CLI selftest cleanup');
    fs.rmSync(resolved, { recursive: true, force: true });
  }
  console.log('Game Production Runner CLI self-test passed ' + checks + ' checks.');
}

main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
