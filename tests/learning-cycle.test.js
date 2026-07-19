'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const Cycle = require('../training/learning-cycle');
const Episode = require('../training/session-episode');
const Seam = require('../kernel/seam-cell');

const ROOT = path.resolve(__dirname, '..');

function temp(name) { return fs.mkdtempSync(path.join(os.tmpdir(), `mirror-${name}-`)); }

function miniRoot(name) {
  const root = temp(name);
  for (const directory of ['kernel', 'learning', 'training', 'docs']) fs.mkdirSync(path.join(root, directory), { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'kernel', 'seam-cell.js'), path.join(root, 'kernel', 'seam-cell.js'));
  fs.copyFileSync(path.join(ROOT, 'learning', 'hierarchical-context-language-model.js'), path.join(root, 'learning', 'hierarchical-context-language-model.js'));
  const documents = ['docs/alpha.md', 'docs/beta.md', 'docs/gamma.md'];
  documents.forEach((relative, index) => fs.writeFileSync(path.join(root, relative), `Permissioned fixture ${index + 1}. Observe evidence, preserve uncertainty, verify the bounded result, and retain a hold when unsupported.\n`));
  return { root, documents, manifestPath: path.join(root, 'training', 'native-corpus-manifest.json') };
}

function writeManifest(fixture) {
  const manifest = {
    schema: 'axm.mirror.native-corpus-manifest/v1',
    documents: fixture.documents.map(relative => ({ path: relative, usePermission: 'allowed', permissionBasis: 'owned deterministic test fixture' }))
  };
  fs.writeFileSync(fixture.manifestPath, JSON.stringify(manifest, null, 2));
}

test('cycle is group-separated, seam-gated and never changes runtime', () => {
  const stateDir = temp('cycle-state');
  const episodes = temp('cycle-episodes');
  const result = Cycle.run({ root: ROOT, stateDir, approvedEpisodesDir: episodes, epochs: 2 });
  const cycle = result.cycle;
  assert.equal(cycle.seamInvocation.mode, 'deliberate');
  assert.equal(cycle.promotion.automatic, false);
  assert.equal(cycle.promotion.runtimePointerChanged, false);
  assert.equal(cycle.promotion.state, 'HOLD_REPAIR');
  assert.equal(cycle.corpus.approvedSessionEpisodes, 0);
  assert.equal(cycle.corpus.approvedTrainingEpisodes, 0);
  const all = cycle.corpus.splits.train.concat(cycle.corpus.splits.validation, cycle.corpus.splits.test);
  assert.equal(new Set(all).size, all.length);
  const ids = result.seamReport.seams.map(item => item.id);
  assert.ok(ids.includes('approved-experience-missing'));
  assert.ok(ids.includes('training-corpus-small'));
  assert.ok(!ids.includes('challenger-regression'));
  assert.ok(cycle.evaluation.challenger.testPerplexity < cycle.evaluation.baseline.testPerplexity);
  assert.equal(cycle.evaluation.selectionUsedTestMetrics, false);
  assert.equal(cycle.evaluation.testEvaluationsPerformedAfterSelection, 1);
  assert.equal(cycle.evaluation.testExcludedFromTraining, true);
  assert.equal(cycle.evaluation.testPreviouslyEvaluatedLocally, false);
  assert.equal(cycle.evaluation.testRole, 'FIRST_LOCAL_REGRESSION_NOT_INDEPENDENT');
  assert.equal(cycle.corpus.splitLineage.historicalCyclesInspected, 0);
  assert.equal(cycle.corpus.splitLineage.automaticEvaluationRoleReassignment, false);
  assert.equal(cycle.evaluation.independentTest, false);
  assert.ok(cycle.evaluation.canaries.every(item => item.status === 'PASS'));
  assert.match(cycle.resultDigest, /^[a-f0-9]{64}$/);
  assert.equal(Cycle.resultDigestFor(cycle), cycle.resultDigest);
  assert.equal(Cycle.cycleIdFor(cycle.inputsDigest, cycle.resultDigest), cycle.cycleId);
  assert.equal(result.seamReport.subject.digest, cycle.resultDigest);
});

test('challenger configuration is selected only on validation and candidate records contain no test metric', () => {
  const result = Cycle.run({ root: ROOT, stateDir: temp('cycle-selection'), approvedEpisodesDir: temp('selection-episodes') });
  const selection = JSON.parse(fs.readFileSync(path.join(result.runDir, 'challenger-selection.json'), 'utf8'));
  assert.equal(selection.validationOnlySelection, true);
  assert.equal(selection.testMetricsAvailableToSelection, false);
  assert.ok(selection.candidateCount > 1);
  assert.ok(selection.candidates.every(candidate => !Object.hasOwn(candidate, 'testPerplexity')));
  const ordered = selection.candidates.slice().sort((left, right) => left.validationPerplexity - right.validationPerplexity || left.order - right.order || left.unigramSmoothingAlpha - right.unigramSmoothingAlpha);
  assert.equal(selection.selectedCandidateId, ordered[0].candidateId);
  assert.equal(result.cycle.evaluation.challenger.selectedCandidateId, ordered[0].candidateId);
  assert.equal(result.cycle.evaluation.challenger.validationCandidateCount, selection.candidateCount);
});

test('tokenizer trains on the training split only and artifacts are hash-verified', () => {
  const stateDir = temp('cycle-artifacts');
  const result = Cycle.run({ root: ROOT, stateDir, approvedEpisodesDir: temp('empty-episodes'), epochs: 2 });
  const tokenizer = JSON.parse(fs.readFileSync(path.join(result.runDir, 'tokenizer.json'), 'utf8'));
  const trainDocumentCount = result.cycle.corpus.documents.filter(item => result.cycle.corpus.splits.train.includes(item.groupId)).length;
  assert.equal(tokenizer.training.documentCount, trainDocumentCount);
  for (const artifact of result.cycle.artifacts) {
    const bytes = fs.readFileSync(path.join(result.runDir, artifact.path));
    assert.equal(Cycle.shaBytes(bytes), artifact.sha256);
  }
});

test('unapproved material in the approved episode directory is refused', () => {
  const episodes = temp('unapproved');
  const candidate = Episode.normalize({
    schema: Episode.SCHEMA, groupId: 'fixture-family',
    source: { provider: 'fixture', model: 'fixture', usePermission: 'allowed', permissionBasis: 'test fixture', capturedBy: 'test' },
    goal: 'Test refusal.', observations: ['Candidate only.'], candidates: ['Hold.'], decision: 'Hold.', outcome: 'Held.', verification: ['No action.'], repairs: [], limitations: []
  });
  fs.writeFileSync(path.join(episodes, 'candidate.json'), JSON.stringify(candidate));
  assert.throws(() => Cycle.run({ root: ROOT, stateDir: temp('refuse-state'), approvedEpisodesDir: episodes, epochs: 1 }), /unapproved session/);
});

test('identical deterministic cycle is reused without overwrite', () => {
  const stateDir = temp('cycle-reuse');
  const options = { root: ROOT, stateDir, approvedEpisodesDir: temp('reuse-episodes'), epochs: 2 };
  const first = Cycle.run(options);
  const second = Cycle.run(options);
  assert.equal(first.cycle.cycleId, second.cycle.cycleId);
  assert.equal(second.reused, true);
});

test('future corpus growth preserves every first-observed evaluation role and sends new groups to training only', () => {
  const fixture = miniRoot('longitudinal-splits');
  writeManifest(fixture);
  const stateDir = path.join(fixture.root, 'state', 'training-runs');
  const approvedEpisodesDir = path.join(fixture.root, 'training', 'episodes');
  const first = Cycle.run({ root: fixture.root, manifestPath: fixture.manifestPath, stateDir, approvedEpisodesDir });
  const originalValidation = first.cycle.corpus.splits.validation.slice();
  const originalTest = first.cycle.corpus.splits.test.slice();
  const existing = first.cycle.corpus.documents.map(record => ({ groupId: record.groupId, sourceType: record.sourceType }));

  let added = null;
  for (let index = 0; index < 10000 && !added; index += 1) {
    const relative = `docs/growth-${index}.md`;
    const groupId = `document:${relative}`;
    const fresh = Cycle.initialGroupSeparatedSplits(existing.concat({ groupId, sourceType: 'permissioned-project-document' }));
    if (fresh.validation[0] !== originalValidation[0] || fresh.test[0] !== originalTest[0]) added = { relative, groupId };
  }
  assert.ok(added, 'a deterministic filename that would reshuffle the old algorithm must exist');
  fs.writeFileSync(path.join(fixture.root, added.relative), 'A new permissioned growth document that must not reshuffle prior evaluation exposure.\n');
  fixture.documents.push(added.relative);
  writeManifest(fixture);

  const second = Cycle.run({ root: fixture.root, manifestPath: fixture.manifestPath, stateDir, approvedEpisodesDir });
  assert.notEqual(second.cycle.cycleId, first.cycle.cycleId);
  assert.deepEqual(second.cycle.corpus.splits.validation, originalValidation);
  assert.deepEqual(second.cycle.corpus.splits.test, originalTest);
  assert.ok(second.cycle.corpus.splits.train.includes(added.groupId));
  assert.equal(second.cycle.corpus.splitLineage.historicalCyclesInspected, 1);
  assert.deepEqual(second.cycle.corpus.splitLineage.evaluationGroupsMovedToTraining, []);
  assert.deepEqual(second.cycle.corpus.splitLineage.trainingGroupsMovedToEvaluation, []);
  assert.ok(second.cycle.corpus.splitLineage.validationExposure.every(item => item.priorCycleCount === 1));
  assert.ok(second.cycle.corpus.splitLineage.testExposure.every(item => item.priorCycleCount === 1));
  assert.equal(second.cycle.evaluation.testPreviouslyEvaluatedLocally, true);
  assert.equal(second.cycle.evaluation.testRole, 'REPEATED_LOCAL_REGRESSION_ONLY');
});

test('tampered historical split evidence refuses reuse and future growth', () => {
  const fixture = miniRoot('split-tamper');
  writeManifest(fixture);
  const stateDir = path.join(fixture.root, 'state', 'training-runs');
  const options = { root: fixture.root, manifestPath: fixture.manifestPath, stateDir, approvedEpisodesDir: path.join(fixture.root, 'training', 'episodes') };
  const first = Cycle.run(options);
  const cycleFile = path.join(first.runDir, 'cycle.json');
  const altered = JSON.parse(fs.readFileSync(cycleFile, 'utf8'));
  const held = altered.corpus.splits.test[0];
  altered.corpus.splits.test[0] = altered.corpus.splits.train[0];
  altered.corpus.splits.train[0] = held;
  fs.writeFileSync(cycleFile, JSON.stringify(altered, null, 2));
  assert.throws(() => Cycle.run(options), /historical cycle input digest mismatch/);
});

test('tampered non-input cycle results refuse exact reuse', () => {
  const fixture = miniRoot('result-tamper');
  writeManifest(fixture);
  const stateDir = path.join(fixture.root, 'state', 'training-runs');
  const options = { root: fixture.root, manifestPath: fixture.manifestPath, stateDir, approvedEpisodesDir: path.join(fixture.root, 'training', 'episodes') };
  const first = Cycle.run(options);
  const cycleFile = path.join(first.runDir, 'cycle.json');
  const altered = JSON.parse(fs.readFileSync(cycleFile, 'utf8'));
  altered.evaluation.challenger.testPerplexity = altered.evaluation.challenger.testPerplexity / 2;
  fs.writeFileSync(cycleFile, JSON.stringify(altered, null, 2));
  assert.throws(() => Cycle.run(options), /historical cycle result digest mismatch/);
});

test('tampered seam judgement refuses exact reuse even when cycle results remain intact', () => {
  const fixture = miniRoot('seam-report-tamper');
  writeManifest(fixture);
  const stateDir = path.join(fixture.root, 'state', 'training-runs');
  const options = { root: fixture.root, manifestPath: fixture.manifestPath, stateDir, approvedEpisodesDir: path.join(fixture.root, 'training', 'episodes') };
  const first = Cycle.run(options);
  const seamFile = path.join(first.runDir, 'seam-report.json');
  const altered = JSON.parse(fs.readFileSync(seamFile, 'utf8'));
  altered.summary.open = 0;
  fs.writeFileSync(seamFile, JSON.stringify(altered, null, 2));
  assert.throws(() => Cycle.run(options), /historical seam report integrity mismatch/);
});

test('legacy input-bound cycles remain inspectable without being mislabelled content-sealed', () => {
  const fixture = miniRoot('legacy-cycle');
  writeManifest(fixture);
  const stateDir = path.join(fixture.root, 'state', 'training-runs');
  const first = Cycle.run({ root: fixture.root, manifestPath: fixture.manifestPath, stateDir, approvedEpisodesDir: path.join(fixture.root, 'training', 'episodes') });
  const legacyId = `cycle-${first.cycle.inputsDigest.slice(0, 20)}`;
  const legacyDir = path.join(stateDir, legacyId);
  fs.renameSync(first.runDir, legacyDir);
  const legacy = JSON.parse(JSON.stringify(first.cycle));
  legacy.cycleId = legacyId;
  delete legacy.resultDigest;
  fs.writeFileSync(path.join(legacyDir, 'cycle.json'), JSON.stringify(legacy, null, 2));
  fs.writeFileSync(path.join(legacyDir, 'seam-report.json'), JSON.stringify(Seam.inspectLearningCycle(legacy), null, 2));
  const verified = Cycle.verifyCycleDirectory(legacyDir);
  assert.equal(verified.cycle.cycleId, legacyId);
  assert.equal(verified.cycle.resultDigest, undefined);
});

test('multiple preserved outcomes claiming identical inputs force a divergence hold', () => {
  const fixture = miniRoot('duplicate-inputs');
  writeManifest(fixture);
  const stateDir = path.join(fixture.root, 'state', 'training-runs');
  const options = { root: fixture.root, manifestPath: fixture.manifestPath, stateDir, approvedEpisodesDir: path.join(fixture.root, 'training', 'episodes') };
  const first = Cycle.run(options);
  const legacyId = `cycle-${first.cycle.inputsDigest.slice(0, 20)}`;
  const legacyDir = path.join(stateDir, legacyId);
  fs.cpSync(first.runDir, legacyDir, { recursive: true });
  const legacy = JSON.parse(JSON.stringify(first.cycle));
  legacy.cycleId = legacyId;
  delete legacy.resultDigest;
  fs.writeFileSync(path.join(legacyDir, 'cycle.json'), JSON.stringify(legacy, null, 2));
  fs.writeFileSync(path.join(legacyDir, 'seam-report.json'), JSON.stringify(Seam.inspectLearningCycle(legacy), null, 2));
  assert.throws(() => Cycle.run(options), /multiple historical cycles claim identical inputs/);
});
