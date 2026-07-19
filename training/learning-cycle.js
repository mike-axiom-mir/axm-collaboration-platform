'use strict';

const ImmutableBatchStore = require('../kernel/immutable-batch-store');

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Tokenizer = require('../learning/native-tokenizer');
const Ngram = require('../learning/ngram-language-model');
const Hierarchical = require('../learning/hierarchical-context-language-model');
const Episode = require('./session-episode');
const Seam = require('../kernel/seam-cell');
const { reason } = require('../kernel/principle-cell');

const SCHEMA = 'axm.mirror.learning-cycle/v1';

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((out, key) => { out[key] = stable(value[key]); return out; }, {});
}

function json(value) { return JSON.stringify(stable(value), null, 2) + '\n'; }
function shaBytes(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function shaValue(value) { return shaBytes(Buffer.from(JSON.stringify(stable(value)), 'utf8')); }
function resultDigestFor(cycle) {
  return shaValue(Object.assign({}, cycle, { cycleId: null, resultDigest: null }));
}
function cycleIdFor(inputsDigest, resultDigest) {
  if (!/^[a-f0-9]{64}$/.test(String(inputsDigest || '')) || !/^[a-f0-9]{64}$/.test(String(resultDigest || ''))) throw new Error('cycle identity requires input and result digests');
  return `cycle-${shaValue({ inputsDigest, resultDigest }).slice(0, 20)}`;
}
function forward(value) { return String(value).replace(/\\/g, '/'); }

function inside(root, target) {
  const relative = path.relative(root, target);
  return relative && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative);
}

function readManifest(root, manifestPath) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest.schema !== 'axm.mirror.native-corpus-manifest/v1' || !Array.isArray(manifest.documents)) throw new Error('invalid native corpus manifest');
  return manifest.documents.map((entry, index) => {
    if (entry.usePermission !== 'allowed' || !entry.permissionBasis) throw new Error(`document ${index} lacks explicit learning permission`);
    const absolute = path.resolve(root, entry.path);
    if (!inside(root, absolute)) throw new Error(`document escapes Mirror root: ${entry.path}`);
    const text = fs.readFileSync(absolute, 'utf8');
    if (!text.trim()) throw new Error(`empty corpus document: ${entry.path}`);
    const sha256 = shaBytes(Buffer.from(text, 'utf8'));
    const normalizedPath = forward(path.relative(root, absolute));
    return {
      id: `doc-${sha256.slice(0, 20)}`,
      groupId: `document:${normalizedPath}`,
      sourceType: 'permissioned-project-document',
      path: normalizedPath,
      text,
      usePermission: 'allowed',
      permissionBasis: entry.permissionBasis,
      sha256
    };
  });
}

function readApprovedEpisodes(directory) {
  if (!fs.existsSync(directory)) return [];
  const files = fs.readdirSync(directory, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.toLowerCase().endsWith('.json'))
    .map(entry => path.join(directory, entry.name)).sort();
  return files.map(file => {
    const episode = JSON.parse(fs.readFileSync(file, 'utf8'));
    Episode.verify(episode);
    if (!episode.review || episode.review.state !== 'APPROVED') throw new Error(`unapproved session found in approved dataset directory: ${path.basename(file)}`);
    const text = Episode.toTrainingText(episode);
    return {
      id: episode.episodeId,
      groupId: `episode:${episode.groupId}`,
      sourceType: 'reviewed-session-episode',
      path: forward(file),
      text,
      usePermission: episode.source.usePermission,
      permissionBasis: episode.source.permissionBasis,
      sha256: shaBytes(Buffer.from(text, 'utf8')),
      episodeDigest: episode.digest
    };
  });
}

function initialGroupSeparatedSplits(records) {
  const groups = Array.from(new Set(records.map(record => record.groupId)))
    .map(groupId => ({
      groupId,
      sourceType: records.find(record => record.groupId === groupId).sourceType,
      order: shaValue(groupId)
    }))
    .sort((a, b) => a.order.localeCompare(b.order) || a.groupId.localeCompare(b.groupId));
  if (groups.length < 3) throw new Error('learning cycle requires at least three source families for train, validation, and test');
  const documentGroups = groups.filter(group => group.sourceType === 'permissioned-project-document');
  const heldOutPool = documentGroups.length >= 2 ? documentGroups : groups;
  const test = heldOutPool[heldOutPool.length - 1].groupId;
  const validation = heldOutPool[heldOutPool.length - 2].groupId;
  const train = groups.filter(item => item.groupId !== validation && item.groupId !== test).map(item => item.groupId);
  return { train, validation: [validation], test: [test] };
}

function realFile(file, label) {
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`${label} must be a real file`);
  return stat;
}

function verifyCycleDirectory(runDir) {
  const cycleFile = path.join(runDir, 'cycle.json');
  const seamFile = path.join(runDir, 'seam-report.json');
  if (!fs.existsSync(cycleFile) || !fs.existsSync(seamFile)) throw new Error(`partial historical cycle refuses split lineage: ${runDir}`);
  realFile(cycleFile, 'historical cycle');
  realFile(seamFile, 'historical seam report');
  const cycle = JSON.parse(fs.readFileSync(cycleFile, 'utf8'));
  const seamReport = JSON.parse(fs.readFileSync(seamFile, 'utf8'));
  if (cycle.schema !== SCHEMA || !/^cycle-[a-f0-9]{20}$/.test(String(cycle.cycleId || ''))) throw new Error(`invalid historical learning cycle: ${runDir}`);
  if (path.basename(runDir) !== cycle.cycleId) throw new Error(`historical cycle directory or id mismatch: ${runDir}`);
  if (!cycle.corpus || !Array.isArray(cycle.corpus.documents) || !cycle.corpus.splits || !Array.isArray(cycle.artifacts)) throw new Error(`historical cycle corpus or artifact lineage missing: ${cycle.cycleId}`);
  if (!seamReport || seamReport.schema !== Seam.SCHEMA || !seamReport.subject || seamReport.subject.id !== cycle.cycleId) throw new Error(`historical seam report binding mismatch: ${cycle.cycleId}`);

  const artifactPaths = new Set();
  for (const artifact of cycle.artifacts) {
    const relative = forward(artifact && artifact.path || '');
    const absolute = path.resolve(runDir, relative);
    if (!relative || artifactPaths.has(relative) || !inside(runDir, absolute)) throw new Error(`historical cycle artifact path invalid: ${cycle.cycleId}`);
    artifactPaths.add(relative);
    const stat = realFile(absolute, 'historical cycle artifact');
    const bytes = fs.readFileSync(absolute);
    if (stat.size !== artifact.bytes || bytes.length !== artifact.bytes || shaBytes(bytes) !== artifact.sha256) throw new Error(`historical cycle artifact integrity mismatch: ${cycle.cycleId}/${relative}`);
  }
  if (!artifactPaths.has('config.json') || !artifactPaths.has('corpus-snapshot.json')) throw new Error(`historical cycle split inputs are incomplete: ${cycle.cycleId}`);
  const visible = fs.readdirSync(runDir, { withFileTypes: true }).filter(entry => !entry.name.startsWith('.'));
  if (visible.some(entry => !entry.isFile() || entry.isSymbolicLink())) throw new Error(`historical cycle directory contains a non-file entry: ${cycle.cycleId}`);
  const expectedFiles = new Set(['cycle.json', 'seam-report.json'].concat(Array.from(artifactPaths)));
  const unexpected = visible.map(entry => forward(entry.name)).filter(name => !expectedFiles.has(name));
  if (unexpected.length) throw new Error(`historical cycle directory contains unexpected files: ${cycle.cycleId}`);

  const config = JSON.parse(fs.readFileSync(path.join(runDir, 'config.json'), 'utf8'));
  const records = cycle.corpus.documents.map(record => ({ id: record.id, groupId: record.groupId, sha256: record.sha256 }));
  const reconstructed = shaValue({ records, splits: cycle.corpus.splits, config });
  if (reconstructed !== cycle.inputsDigest) throw new Error(`historical cycle input digest mismatch: ${cycle.cycleId}`);
  if (cycle.resultDigest == null) {
    if (cycle.cycleId !== `cycle-${cycle.inputsDigest.slice(0, 20)}`) throw new Error(`historical legacy cycle id mismatch: ${cycle.cycleId}`);
  } else {
    if (!/^[a-f0-9]{64}$/.test(String(cycle.resultDigest)) || resultDigestFor(cycle) !== cycle.resultDigest) throw new Error(`historical cycle result digest mismatch: ${cycle.cycleId}`);
    if (cycle.cycleId !== cycleIdFor(cycle.inputsDigest, cycle.resultDigest)) throw new Error(`historical content-bound cycle id mismatch: ${cycle.cycleId}`);
    if (seamReport.subject.digest !== cycle.resultDigest) throw new Error(`historical seam report result binding mismatch: ${cycle.cycleId}`);
  }
  try {
    Seam.verifyReportIntegrity(seamReport);
  } catch (error) {
    throw new Error(`historical seam report integrity mismatch: ${cycle.cycleId}`);
  }
  const currentSeamSha256 = shaBytes(fs.readFileSync(path.join(__dirname, '..', 'kernel', 'seam-cell.js')));
  if (cycle.resultDigest && config.implementation && config.implementation.seamCellSha256 === currentSeamSha256) {
    const currentReport = Seam.inspectLearningCycle(cycle);
    if (shaValue(currentReport) !== shaValue(seamReport)) throw new Error(`historical seam report judgement mismatch: ${cycle.cycleId}`);
  }
  return { cycle, seamReport, config };
}

function loadHistoricalSplitAssignments(stateDir) {
  const history = { cycles: [], roleByGroup: new Map() };
  if (!fs.existsSync(stateDir)) return history;
  const entries = fs.readdirSync(stateDir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    if (!entry.isDirectory() || entry.isSymbolicLink && entry.isSymbolicLink() || !/^cycle-[a-f0-9]{20}$/.test(entry.name)) throw new Error(`unexpected visible training-run entry: ${entry.name}`);
    const verified = verifyCycleDirectory(path.join(stateDir, entry.name));
    const cycle = verified.cycle;
    const splits = cycle.corpus.splits;
    const flat = ['train', 'validation', 'test'].flatMap(role => (Array.isArray(splits[role]) ? splits[role] : []).map(groupId => ({ groupId, role })));
    if (!flat.length || new Set(flat.map(item => item.groupId)).size !== flat.length) throw new Error(`historical cycle split overlap or emptiness: ${cycle.cycleId}`);
    history.cycles.push({
      cycleId: cycle.cycleId,
      inputsDigest: cycle.inputsDigest,
      resultDigest: cycle.resultDigest || null,
      runDir: path.join(stateDir, entry.name)
    });
    for (const item of flat) {
      const prior = history.roleByGroup.get(item.groupId);
      if (prior && prior.role !== item.role) throw new Error(`historical evaluation role conflict for ${item.groupId}: ${prior.role} -> ${item.role}`);
      if (prior) prior.cycleIds.push(cycle.cycleId);
      else history.roleByGroup.set(item.groupId, { role: item.role, firstCycleId: cycle.cycleId, cycleIds: [cycle.cycleId] });
    }
  }
  return history;
}

function groupSeparatedSplits(records, history) {
  if (!history || !history.roleByGroup || history.roleByGroup.size === 0) return initialGroupSeparatedSplits(records);
  const groups = Array.from(new Set(records.map(record => record.groupId)))
    .map(groupId => ({ groupId, order: shaValue(groupId) }))
    .sort((left, right) => left.order.localeCompare(right.order) || left.groupId.localeCompare(right.groupId))
    .map(item => item.groupId);
  if (groups.length < 3) throw new Error('learning cycle requires at least three source families for train, validation, and test');
  const train = [];
  const validation = [];
  const test = [];
  for (const groupId of groups) {
    const prior = history.roleByGroup.get(groupId);
    if (!prior || prior.role === 'train') train.push(groupId);
    else if (prior.role === 'validation') validation.push(groupId);
    else if (prior.role === 'test') test.push(groupId);
    else throw new Error(`unsupported historical split role for ${groupId}`);
  }
  if (!validation.length || !test.length) throw new Error('historical validation or test group is absent from the current corpus; automatic reassignment is refused');
  if (!train.length) throw new Error('historical split preservation leaves no training group');
  return { train, validation, test };
}

function splitLineage(records, splits, history) {
  const assigned = new Map();
  for (const role of ['train', 'validation', 'test']) for (const groupId of splits[role]) assigned.set(groupId, role);
  const groups = Array.from(new Set(records.map(record => record.groupId))).sort();
  const movedEvaluationGroups = [];
  const movedTrainingGroups = [];
  for (const groupId of groups) {
    const prior = history.roleByGroup.get(groupId);
    if (!prior) continue;
    if (['validation', 'test'].includes(prior.role) && assigned.get(groupId) === 'train') movedEvaluationGroups.push(groupId);
    if (prior.role === 'train' && ['validation', 'test'].includes(assigned.get(groupId))) movedTrainingGroups.push(groupId);
  }
  const exposure = role => splits[role].map(groupId => {
    const prior = history.roleByGroup.get(groupId);
    return { groupId, priorCycleCount: prior ? prior.cycleIds.length : 0, firstCycleId: prior ? prior.firstCycleId : null };
  });
  return {
    schema: 'axm.mirror.language-evaluation-split-lineage/v1',
    assignmentPolicy: 'IMMUTABLE_FIRST_OBSERVED_GROUP_ROLE_NEW_GROUPS_TRAIN_ONLY',
    historicalCyclesInspected: history.cycles.length,
    historicalCycleIds: history.cycles.map(item => item.cycleId),
    historicallyAssignedGroupsInCurrentCorpus: groups.filter(groupId => history.roleByGroup.has(groupId)).length,
    firstAssignmentGroups: groups.filter(groupId => !history.roleByGroup.has(groupId)),
    newGroupsAssignedToTraining: groups.filter(groupId => !history.roleByGroup.has(groupId) && assigned.get(groupId) === 'train'),
    validationExposure: exposure('validation'),
    testExposure: exposure('test'),
    evaluationGroupsMovedToTraining: movedEvaluationGroups,
    trainingGroupsMovedToEvaluation: movedTrainingGroups,
    historicalRoleConflicts: 0,
    automaticEvaluationRoleReassignment: false,
    authority: { trainingAdmission: false, thresholdChange: false, modelSelection: false, runtimePromotion: false, canonChange: false },
    boundary: 'A group keeps its first observed train, validation, or test role across automatic cycles. New groups enter training only. New evaluation generations require a separate explicit evidence route; split preservation is not independence or broad-language proof.'
  };
}

function recordsFor(records, groups) {
  const allowed = new Set(groups);
  return records.filter(record => allowed.has(record.groupId));
}

function candidateNumbers(value, fallback, normalize) {
  const source = Array.isArray(value) && value.length ? value : fallback;
  const normalized = Array.from(new Set(source.map(normalize).filter(Number.isFinite))).sort((left, right) => left - right);
  return normalized.length ? normalized : Array.from(new Set(fallback.map(normalize).filter(Number.isFinite))).sort((left, right) => left - right);
}

function trainValidationSelectedChallenger(trainSequences, validationSequences, tokenizerModel, config) {
  if (!validationSequences.length) throw new Error('challenger selection requires a non-empty validation partition');
  const candidates = [];
  for (const order of config.candidateOrders) {
    for (const unigramSmoothingAlpha of config.candidateUnigramSmoothingAlphas) {
      const run = Hierarchical.train(trainSequences, {
        vocabSize: tokenizerModel.vocabSize,
        bos: Tokenizer.SPECIAL.BOS,
        eos: Tokenizer.SPECIAL.EOS,
        order,
        unigramSmoothingAlpha
      });
      const validation = Hierarchical.evaluate(run.model, run.weights, validationSequences);
      candidates.push({
        candidateId: `hierarchical-context-o${order}-a${String(unigramSmoothingAlpha).replace('.', '_')}`,
        order,
        unigramSmoothingAlpha,
        validationPerplexity: validation.perplexity,
        parameterCount: run.model.parameterCount,
        contextRowCount: run.model.training.contextRowCount,
        run
      });
    }
  }
  candidates.sort((left, right) => left.validationPerplexity - right.validationPerplexity || left.order - right.order || left.unigramSmoothingAlpha - right.unigramSmoothingAlpha);
  const selected = candidates[0];
  const report = {
    schema: 'axm.mirror.language-model-validation-selection/v1',
    selectionRule: 'MINIMUM_VALIDATION_PERPLEXITY_THEN_LOWER_ORDER_THEN_LOWER_ALPHA',
    validationOnlySelection: true,
    testMetricsAvailableToSelection: false,
    candidateCount: candidates.length,
    selectedCandidateId: selected.candidateId,
    candidates: candidates.map(candidate => ({
      candidateId: candidate.candidateId,
      order: candidate.order,
      unigramSmoothingAlpha: candidate.unigramSmoothingAlpha,
      validationPerplexity: candidate.validationPerplexity,
      parameterCount: candidate.parameterCount,
      contextRowCount: candidate.contextRowCount
    }))
  };
  return { selected, report };
}

function writeArtifact(directory, name, bytes) {
  const file = path.join(directory, name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, bytes);
  return { path: forward(name), sha256: shaBytes(bytes), bytes: bytes.length };
}

function canaries(tokenizerModel, trainTexts, challengerRun, splits, roleLineage) {
  const checks = [];
  const roundtrip = trainTexts.every(text => Tokenizer.decode(tokenizerModel, Tokenizer.encode(tokenizerModel, text)) === text);
  checks.push({ id: 'tokenizer-utf8-roundtrip', status: roundtrip ? 'PASS' : 'FAIL', evidence: `${trainTexts.length} training document(s) checked` });

  const hold = reason({ goal: 'Do not invent a candidate.', evidence: [], unknowns: [], constraints: [], permissions: [], actions: [] });
  checks.push({ id: 'seed-0-explicit-hold-is-not-success', status: hold.decision.value === 0 && hold.decision.selectedActionId === 'hold-no-candidate' ? 'PASS' : 'FAIL', evidence: hold.traceId });

  const refused = reason({
    goal: 'Attempt a permission-bound action.', evidence: [{ id: 'ev-1', kind: 'test', statement: 'Fixture evidence.' }],
    unknowns: [], constraints: [], permissions: [], actions: [{
      id: 'permission-bound', kind: 'write', label: 'Write without permission', requiredPermissions: ['write'],
      supportingEvidence: ['ev-1'], reversible: true, recovery: 'Restore fixture.', risk: 'low'
    }]
  });
  checks.push({ id: 'missing-permission-refusal', status: refused.decision.value === -1 ? 'PASS' : 'FAIL', evidence: refused.traceId });

  const restored = Hierarchical.weightsFromBuffer(Hierarchical.weightsToBuffer(challengerRun.weights), challengerRun.model.parameterCount);
  const left = Hierarchical.sample(challengerRun.model, challengerRun.weights, [], { seed: 91, maxNewTokens: 12 });
  const right = Hierarchical.sample(challengerRun.model, restored, [], { seed: 91, maxNewTokens: 12 });
  checks.push({ id: 'challenger-reload-determinism', status: JSON.stringify(left) === JSON.stringify(right) ? 'PASS' : 'FAIL', evidence: `${challengerRun.model.parameterCount} sparse learned transition count(s) reloaded` });

  const overlap = splits.train.filter(group => splits.validation.includes(group) || splits.test.includes(group))
    .concat(splits.validation.filter(group => splits.test.includes(group)));
  checks.push({ id: 'source-family-split-isolation', status: overlap.length ? 'FAIL' : 'PASS', evidence: `${overlap.length} overlap(s)` });
  const roleMoves = (roleLineage.evaluationGroupsMovedToTraining || []).concat(roleLineage.trainingGroupsMovedToEvaluation || []);
  checks.push({
    id: 'longitudinal-evaluation-role-isolation',
    status: roleLineage.historicalRoleConflicts === 0 && roleLineage.automaticEvaluationRoleReassignment === false && roleMoves.length === 0 ? 'PASS' : 'FAIL',
    evidence: `${roleLineage.historicalCyclesInspected} historical cycle(s), ${roleMoves.length} role move(s)`
  });
  return checks;
}

function loadExisting(runDir, inputsDigest) {
  const verified = verifyCycleDirectory(runDir);
  const cycle = verified.cycle;
  if (cycle.inputsDigest !== inputsDigest) throw new Error('existing cycle input digest mismatch');
  return { cycle, seamReport: verified.seamReport, runDir, reused: true };
}

function run(options) {
  options = options || {};
  const root = path.resolve(options.root || path.resolve(__dirname, '..'));
  const manifestPath = path.resolve(options.manifestPath || path.join(root, 'training', 'native-corpus-manifest.json'));
  const approvedEpisodesDir = path.resolve(options.approvedEpisodesDir || path.join(root, 'training', 'datasets', 'episodes'));
  const stateDir = path.resolve(options.stateDir || path.join(root, 'state', 'training-runs'));
  const config = {
    tokenizer: { vocabSize: Number(options.vocabSize) || 512, minFrequency: Number(options.minFrequency) || 2 },
    baseline: { order: Number(options.order) || 3 },
    challenger: {
      method: 'validation-selected-hierarchical-witten-bell-backoff',
      candidateOrders: candidateNumbers(options.challengerOrders, [2, 3, 4, 5, 6], value => Math.max(2, Math.min(6, Math.trunc(Number(value))))),
      candidateUnigramSmoothingAlphas: candidateNumbers(options.challengerAlphas, [0.05, 0.2, 0.5, 1], value => Math.max(0.0001, Math.min(10, Number(value))))
    },
    evaluationRoles: {
      policy: 'immutable-first-observed-group-role-new-groups-train-only',
      automaticReassignment: false,
      newEvaluationGenerationRequiresSeparateExplicitEvidenceRoute: true
    },
    seamMode: 'deliberate-gate',
    implementation: {
      learningCycleSha256: shaBytes(fs.readFileSync(__filename)),
      seamCellSha256: shaBytes(fs.readFileSync(path.join(root, 'kernel', 'seam-cell.js'))),
      challengerLearnerSha256: shaBytes(fs.readFileSync(path.join(root, 'learning', 'hierarchical-context-language-model.js')))
    }
  };
  const documents = readManifest(root, manifestPath);
  const episodes = readApprovedEpisodes(approvedEpisodesDir);
  const records = documents.concat(episodes);
  const historicalSplits = loadHistoricalSplitAssignments(stateDir);
  const splits = groupSeparatedSplits(records, historicalSplits);
  const roleLineage = splitLineage(records, splits, historicalSplits);
  const inputsDigest = shaValue({ records: records.map(record => ({ id: record.id, groupId: record.groupId, sha256: record.sha256 })), splits, config });
  const matchingCycles = historicalSplits.cycles.filter(item => item.inputsDigest === inputsDigest);
  if (matchingCycles.length > 1) throw new Error(`multiple historical cycles claim identical inputs: ${inputsDigest}`);
  if (matchingCycles.length === 1) return loadExisting(matchingCycles[0].runDir, inputsDigest);

  const provisionalCycleId = `cycle-${inputsDigest.slice(0, 20)}`;
  const stageDir = path.join(stateDir, `.stage-${provisionalCycleId}-${process.pid}`);
  if (fs.existsSync(stageDir)) throw new Error(`staging directory already exists: ${stageDir}`);
  fs.mkdirSync(stageDir, { recursive: true });

  const trainRecords = recordsFor(records, splits.train);
  const validationRecords = recordsFor(records, splits.validation);
  const testRecords = recordsFor(records, splits.test);
  const tokenizerModel = Tokenizer.train(trainRecords.map(record => record.text), config.tokenizer);
  const encode = subset => subset.map(record => Tokenizer.encode(tokenizerModel, record.text));
  const trainSequences = encode(trainRecords);
  const validationSequences = encode(validationRecords);
  const testSequences = encode(testRecords);
  const baseline = Ngram.train(trainSequences, { order: config.baseline.order, bos: Tokenizer.SPECIAL.BOS, eos: Tokenizer.SPECIAL.EOS });
  const challengerSelection = trainValidationSelectedChallenger(trainSequences, validationSequences, tokenizerModel, config.challenger);
  const challenger = challengerSelection.selected.run;
  const baselineValidation = Ngram.evaluate(baseline, validationSequences);
  const baselineTest = Ngram.evaluate(baseline, testSequences);
  const challengerValidation = Hierarchical.evaluate(challenger.model, challenger.weights, validationSequences);
  const challengerTest = Hierarchical.evaluate(challenger.model, challenger.weights, testSequences);

  const snapshot = {
    schema: 'axm.mirror.learning-corpus-snapshot/v1',
    inputsDigest,
    documents: records.map(record => ({
      id: record.id, groupId: record.groupId, sourceType: record.sourceType, path: record.path,
      usePermission: record.usePermission, permissionBasis: record.permissionBasis, sha256: record.sha256,
      episodeDigest: record.episodeDigest || null
    })),
    splits,
    splitLineage: roleLineage
  };
  const artifacts = [
    writeArtifact(stageDir, 'config.json', Buffer.from(json(config))),
    writeArtifact(stageDir, 'corpus-snapshot.json', Buffer.from(json(snapshot))),
    writeArtifact(stageDir, 'tokenizer.json', Buffer.from(json(tokenizerModel))),
    writeArtifact(stageDir, 'ngram-baseline.json', Buffer.from(json(baseline))),
    writeArtifact(stageDir, 'challenger-selection.json', Buffer.from(json(challengerSelection.report))),
    writeArtifact(stageDir, 'hierarchical-context-challenger.meta.json', Buffer.from(json(challenger.model))),
    writeArtifact(stageDir, 'hierarchical-context-challenger.f32', Hierarchical.weightsToBuffer(challenger.weights))
  ];
  const checks = canaries(tokenizerModel, trainRecords.map(record => record.text), challenger, splits, roleLineage);
  const trainingTokenCount = trainSequences.reduce((sum, sequence) => sum + sequence.length, 0);
  const approvedTrainingEpisodes = trainRecords.filter(record => record.sourceType === 'reviewed-session-episode').length;
  const cycle = {
    schema: SCHEMA,
    cycleId: provisionalCycleId,
    inputsDigest,
    resultDigest: null,
    identity: 'axm.machine.mirror/seed-0',
    createdAt: null,
    seamInvocation: {
      mode: 'deliberate', invoked: true,
      reason: 'A learning result can affect future behavior and therefore receives stronger analysis and judgement.'
    },
    corpus: {
      manifest: forward(path.relative(root, manifestPath)),
      approvedSessionEpisodes: episodes.length,
      approvedTrainingEpisodes,
      trainingTokenCount,
      documents: snapshot.documents,
      splits,
      splitLineage: roleLineage
    },
    evaluation: {
      baseline: { artifactId: 'ngram-baseline.json', validationPerplexity: baselineValidation.perplexity, testPerplexity: baselineTest.perplexity },
      challenger: {
        artifactId: 'hierarchical-context-challenger.f32',
        metadataArtifactId: 'hierarchical-context-challenger.meta.json',
        selectionArtifactId: 'challenger-selection.json',
        modelSchema: challenger.model.schema,
        selectedCandidateId: challengerSelection.selected.candidateId,
        order: challenger.model.order,
        unigramSmoothingAlpha: challenger.model.unigramSmoothingAlpha,
        validationPerplexity: challengerValidation.perplexity,
        testPerplexity: challengerTest.perplexity,
        relativeTestPerplexityReduction: (baselineTest.perplexity - challengerTest.perplexity) / baselineTest.perplexity,
        validationCandidateCount: challengerSelection.report.candidateCount
      },
      canaries: checks,
      selectionUsedTestMetrics: false,
      testEvaluationsPerformedAfterSelection: 1,
      testExcludedFromTraining: true,
      validationPreviouslyUsedForSelection: roleLineage.validationExposure.some(item => item.priorCycleCount > 0),
      testPreviouslyEvaluatedLocally: roleLineage.testExposure.some(item => item.priorCycleCount > 0),
      evaluationRolesAutomaticallyReassigned: false,
      independentTest: false,
      testRole: roleLineage.testExposure.some(item => item.priorCycleCount > 0)
        ? 'REPEATED_LOCAL_REGRESSION_ONLY'
        : 'FIRST_LOCAL_REGRESSION_NOT_INDEPENDENT'
    },
    recovery: {
      previousChampion: 'seed-0-deterministic-kernel-with-no-learned-runtime-weights',
      rollbackProcedure: 'Keep the runtime pointer unchanged. Quarantine this run directory and continue using the deterministic Seed-0 kernel.',
      rollbackDryRun: 'PASS: no runtime pointer is created or modified by this cycle.'
    },
    promotion: {
      automatic: false,
      reviewRequired: true,
      runtimePointerChanged: false,
      state: 'PENDING_SEAM_REVIEW'
    },
    artifacts,
    claimBoundary: 'This cycle selects a private challenger on the separated validation partition and performs one post-selection local regression evaluation. First-observed train, validation, and test roles are immutable across automatic cycles; new groups enter training only. The local test remains excluded from training but is not outside-independent. The result does not prove broad language generalization and grants no tool, identity, canon, or runtime authority.'
  };
  let seamReport = Seam.inspectLearningCycle(cycle);
  cycle.promotion.state = seamReport.summary.open ? 'HOLD_REPAIR' : 'PROPOSE_HUMAN_REVIEW';
  cycle.promotion.reason = seamReport.summary.open
    ? `${seamReport.summary.open} open seam(s) remain; the challenger is not promoted.`
    : 'No implementation seam remains; explicit human review is still required.';
  cycle.resultDigest = resultDigestFor(cycle);
  cycle.cycleId = cycleIdFor(cycle.inputsDigest, cycle.resultDigest);
  seamReport = Seam.inspectLearningCycle(cycle);
  fs.writeFileSync(path.join(stageDir, 'cycle.json'), json(cycle), 'utf8');
  fs.writeFileSync(path.join(stageDir, 'seam-report.json'), json(seamReport), 'utf8');
  fs.mkdirSync(stateDir, { recursive: true });
  const runDir = path.join(stateDir, cycle.cycleId);
  const commit = ImmutableBatchStore.commitDirectory(stageDir, runDir);
  return { cycle, seamReport, runDir, reused: commit.reused };
}

module.exports = {
  SCHEMA, run, readManifest, readApprovedEpisodes, initialGroupSeparatedSplits, groupSeparatedSplits,
  loadHistoricalSplitAssignments, verifyCycleDirectory, trainValidationSelectedChallenger,
  resultDigestFor, cycleIdFor, shaBytes
};
