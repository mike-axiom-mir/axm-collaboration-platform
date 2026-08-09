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
