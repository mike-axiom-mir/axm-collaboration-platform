'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const Core = require('./discovery-core');

const WORKSHOP = path.resolve(__dirname, '..', '..');
const MIRROR = path.resolve(process.env.AXM_MIRROR_ROOT || 'C:\\AXM_MIRROR_LOCAL');
const RUNS = path.join(MIRROR, 'state', 'training-runs');
const OUT_DIR = path.join(MIRROR, 'exports', 'action-reports');

function latestCycle() {
  if (!fs.existsSync(RUNS)) throw new Error('Mirror has no learning-run directory');
  const candidates = fs.readdirSync(RUNS, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && entry.name.startsWith('cycle-'))
    .map(entry => ({ name: entry.name, file: path.join(RUNS, entry.name, 'cycle.json') }))
    .filter(entry => fs.existsSync(entry.file))
    .map(entry => ({ ...entry, mtime: fs.statSync(entry.file).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  if (!candidates.length) throw new Error('Mirror has no completed learning cycle');
  const cycle = JSON.parse(fs.readFileSync(candidates[0].file, 'utf8'));
  const seamFile = path.join(path.dirname(candidates[0].file), 'seam-report.json');
  return { cycle, seams: JSON.parse(fs.readFileSync(seamFile, 'utf8')), file: candidates[0].file };
}

function record(state, stage, text, claimLabel, source, pass) {
  const result = Core.recordDiscovery(state, stage, {
    text: `[PASS ${pass}] ${text}`,
    claimLabel,
    source,
    rationale: 'A bounded internal review record; not independent validation.',
    status: 'INTERNAL_REVIEW'
  }, {
    now: null,
    actorId: 'mirror-learning-audit',
    actorKind: 'AI',
    provider: 'local-node',
    model: 'deterministic-audit',
    recordId: `mirror-learning-${pass}-${stage}-${state.history.events.length}`
  });
  if (!result.ok) throw new Error(result.errors.map(error => error.message).join('; '));
  return result.state;
}

function run() {
  const current = latestCycle();
  const cycle = current.cycle;
  const open = current.seams.seams.filter(seam => seam.status === 'OPEN');
  const tests = spawnSync(process.execPath, ['--test', 'tests/learning-cycle.test.js', 'tests/seam-cell.test.js', 'tests/session-episode.test.js', 'tests/human-discovery-skill.test.js', 'tests/promotion-review.test.js'], {
    cwd: MIRROR, encoding: 'utf8', windowsHide: true
  });
  let state = Core.createSession({
    id: `mirror-learning-review-${cycle.cycleId}`,
    title: 'Mirror learning loop repeated seam review',
    subject: 'Mirror Seed-0 deliberate Seam Cell, reviewed session learning and secondary human Discovery skill',
    question: 'Which remaining gaps are implementation defects, which are honest capability limits, and what is the cheapest disconfirming check for each?',
    intendedUse: 'Improve the local learning loop without granting authority or hiding failure.',
    boundaries: ['No runtime promotion', 'No private reasoning intake', 'No internet or external-model call', 'No automatic canon'],
    exclusions: ['marketing claims', 'consciousness claims', 'automatic training'],
    stakeholders: ['Mike', 'Mirror', 'AXM collaborators', 'future beginner users'],
    stakes: 'HIGH', evidenceProfile: 'SOFTWARE',
    accessLogic: 'Machine-native proof first; plain-language human status second.',
    successIsNot: ['a fluent sample', 'a green training loss', 'a model that merely runs']
  }, { actorId: 'codex', actorKind: 'AI', provider: 'local', model: 'codex' });

  state = record(state, 'knownSpace', `The cycle ${cycle.cycleId} completed with promotion=${cycle.promotion.state}, automatic=${cycle.promotion.automatic}, runtimePointerChanged=${cycle.promotion.runtimePointerChanged}.`, 'OBSERVED', current.file, 1);
  state = record(state, 'seams', `${open.length} native seam(s) remain: ${open.map(seam => seam.id).join(', ')}.`, 'MEASURED_IN_HARNESS', path.join(path.dirname(current.file), 'seam-report.json'), 1);

  state = record(state, 'realityChecks', `Focused executable proof exited ${tests.status}; ${tests.status === 0 ? 'all focused checks passed' : 'one or more focused checks failed'}.`, tests.status === 0 ? 'MEASURED_IN_HARNESS' : 'BLOCKED', 'node --test focused learning suite', 2);
  state = record(state, 'blindSpots', 'An approved episode must be present specifically in the training partition; total approved episode count alone is insufficient.', 'REPAIRED', path.join(MIRROR, 'kernel', 'seam-cell.js'), 2);
  state = record(state, 'blindSpots', 'Cycle identity now includes the learning-loop and Seam Cell implementation hashes, preventing changed code from silently reusing stale results.', 'REPAIRED', path.join(MIRROR, 'training', 'learning-cycle.js'), 2);

  state = record(state, 'soulChecks', 'The human Discovery/Stance method is available only as an explicit secondary advisory skill. It cannot close native seams, grant permission or promote learning.', 'OBSERVED', path.join(MIRROR, 'skills', 'human-discovery-stance', 'skill.json'), 3);
  state = record(state, 'realityChecks', `The challenger test perplexity is ${cycle.evaluation.challenger.testPerplexity.toFixed(3)} versus baseline ${cycle.evaluation.baseline.testPerplexity.toFixed(3)}; holding is correct.`, 'MEASURED_IN_HARNESS', current.file, 3);

  state = record(state, 'minimalChecks', 'Experience seam: approve one digest-bound, outcome-verified session episode and verify that approvedTrainingEpisodes becomes 1 without split leakage.', 'TEST_HOLD', path.join(MIRROR, 'training', 'session-episode.js'), 4);
  state = record(state, 'minimalChecks', 'Data seam: repeat only after at least 50,000 permissioned, deduplicated training tokens while keeping the same untouched test groups.', 'TEST_HOLD', current.file, 4);
  state = record(state, 'minimalChecks', 'Model seam: a repaired challenger must beat the frozen simple baseline on the untouched test and keep every behavioral canary green.', 'TEST_HOLD', current.file, 4);
  state = record(state, 'knownSpace', 'A digest-bound promotion-review gate now exists. Even an eligible clean cycle can produce only a reviewed proposal receipt; it cannot load weights, change canon, add permission or grant tool authority.', 'OBSERVED', path.join(MIRROR, 'training', 'promotion-review.js'), 5);
  state = record(state, 'minimalChecks', 'Promotion seam: attempt review of the current HOLD_REPAIR cycle and require refusal before reading any reviewer statement as approval.', 'TEST_HOLD', path.join(MIRROR, 'tests', 'promotion-review.test.js'), 5);

  const validation = Core.validate(state);
  if (!validation.ok) throw new Error(validation.errors.join('; '));
  const output = {
    schema: 'axm.mirror.learning-discovery-audit/v1',
    status: tests.status === 0 ? 'IMPLEMENTATION_CHECKS_PASS_CAPABILITY_SEAMS_REMAIN' : 'IMPLEMENTATION_REPAIR_REQUIRED',
    cycleId: cycle.cycleId,
    passes: 5,
    focusedTestExitCode: tests.status,
    nativeOpenSeams: open.map(seam => ({ id: seam.id, severity: seam.severity, statement: seam.statement, disconfirmingCheck: seam.disconfirmingCheck })),
    validation,
    bundle: Core.exportBundle(state),
    boundary: 'Repeated internal Discovery/Stance review is not independent validation and does not promote Mirror.'
  };
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const earlier = fs.readdirSync(OUT_DIR)
    .filter(name => name.startsWith(`MIRROR_LEARNING_SEAM_AUDIT_${cycle.cycleId}`) && name.endsWith('.json'))
    .map(name => path.join(OUT_DIR, name))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  output.supersedes = earlier.length ? earlier[0] : null;
  const revisionDigest = crypto.createHash('sha256').update(JSON.stringify(output)).digest('hex').slice(0, 12);
  const out = path.join(OUT_DIR, `MIRROR_LEARNING_SEAM_AUDIT_${cycle.cycleId}_${revisionDigest}.json`);
  if (fs.existsSync(out)) {
    const existing = fs.readFileSync(out, 'utf8');
    const proposed = JSON.stringify(output, null, 2) + '\n';
    if (existing !== proposed) throw new Error(`audit revision already exists and will not be silently overwritten: ${out}`);
    output.outputPath = out;
    output.reused = true;
    return output;
  }
  fs.writeFileSync(out, JSON.stringify(output, null, 2) + '\n', 'utf8');
  output.outputPath = out;
  output.reused = false;
  return output;
}

if (require.main === module) {
  try {
    const output = run();
    console.log(`${output.status}: ${output.passes} pass(es), ${output.nativeOpenSeams.length} honest capability seam(s).`);
    for (const seam of output.nativeOpenSeams) console.log(`- ${seam.id}: ${seam.disconfirmingCheck}`);
    console.log(`Report: ${output.outputPath}${output.reused ? ' (identical existing report reused)' : ''}`);
  } catch (error) {
    console.error(`REFUSED: ${error.message}`);
    process.exit(1);
  }
}

module.exports = { run };
