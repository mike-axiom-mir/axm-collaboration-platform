#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const Core = require('./workspace-activity-core');

let checks = 0;
function check(value, label) {
  assert.ok(value, label);
  checks += 1;
}

function file(path, modifiedAt, sizeBytes, sharedSeam, sha256) {
  return { path, modifiedAt, sizeBytes, sharedSeam: sharedSeam === true, sha256: sha256 || undefined };
}

function snapshot(overrides) {
  const base = {
    schema: Core.SNAPSHOT_SCHEMA,
    root: '/fixture/axm-workshop',
    generatedAt: '2026-08-16T10:00:00.000Z',
    windowsMinutes: { recent: 30, active: 5 },
    git: { available: true, root: '/fixture/axm-workshop', branch: 'codex/example', status: [' M README.md'] },
    counts: { filesScanned: 100, recentFiles: 4, activeFiles: 3, activeSharedSeams: 2 },
    recentFiles: [
      file('AXM_AETHERGLASS_VISUAL_ENGINE_v7_1_0/MODULE_MANIFEST.json', '2059-12-31T18:00:00.000Z', 4000, true),
      file('tools/alpha/app.js', '2026-08-16T09:58:00.000Z', 120, false),
      file('tools/alpha/manifest.json', '2026-08-16T09:57:00.000Z', 80, true),
      file('docs/note.md', '2026-08-16T09:40:00.000Z', 60, false)
    ],
    activeFiles: [],
    cautions: [],
    truncated: false
  };
  return Object.assign(base, overrides || {});
}

const analyzed = Core.analyzeSnapshot(snapshot());
check(analyzed.schema === Core.ANALYSIS_SCHEMA, 'analysis uses the declared schema');
check(/^[a-f0-9]{64}$/.test(analyzed.sourceObservationDigest), 'analysis seals the normalized source observation');
check(analyzed.verdict === 'MOVEMENT_OBSERVED', 'plausible active files produce a movement observation');
check(analyzed.counts.rawActiveFiles === 3 && analyzed.counts.plausibleActiveFiles === 2, 'future timestamps are excluded from plausible active counts');
check(analyzed.counts.futureDatedFiles === 1, 'future timestamp anomaly remains visible');
check(analyzed.confidence === 'QUALIFIED', 'future timestamp anomalies qualify confidence even when the scan is complete');
check(analyzed.counts.plausibleActiveSharedSeams === 1, 'only plausible active seams are counted');
check(analyzed.futureDatedFiles[0].path.includes('AETHERGLASS'), 'future-dated source path is preserved as counterevidence');
check(analyzed.truth.futureTimestampsCountedAsActivity === false && analyzed.truth.ownershipAssigned === false, 'truth boundaries refuse false activity and ownership');

const guardedSeam = Core.analyzeSnapshot(snapshot({
  counts: { filesScanned: 100, recentFiles: 1, activeFiles: 1, activeSharedSeams: 0 },
  recentFiles: [file('tools-index.json', '2026-08-16T09:59:00.000Z', 5000, false)]
}));
check(guardedSeam.counts.plausibleActiveSharedSeams === 1, 'Workshop root tools-index is guarded as a shared seam when the source observer misses it');

const status = Core.analyzeGitStatus([
  ' M tools/alpha/manifest.json',
  'M  staged.js',
  'MM both.js',
  '?? new.js',
  ' D deleted.txt',
  'R  old.js -> renamed.js',
  'UU conflict.js',
  'A  added.js',
  'broken'
]);
check(status.counts.total === 9 && status.counts.valid === 8 && status.counts.invalid === 1, 'Git status parsing keeps valid and invalid line counts explicit');
check(status.counts.tracked === 7 && status.counts.untracked === 1, 'tracked and untracked paths are separated');
check(status.counts.staged === 4 && status.counts.worktreeChanged === 3 && status.counts.conflicted === 1, 'staged, worktree, and conflict states are independently counted');
check(status.counts.deleted === 1 && status.counts.renamed === 1 && status.counts.added === 1, 'Git operation categories remain visible');
check(status.counts.sharedSeams === 1 && status.sampleSharedSeamPaths[0] === 'tools/alpha/manifest.json', 'status-only manifest paths are guarded as shared seams');
check(/^[a-f0-9]{64}$/.test(status.statusDigest), 'normalized Git status receives an exact digest');
check(status.statusDigest === Core.analyzeGitStatus(status.sampleInvalidLines.concat([
  'A  added.js',
  'UU conflict.js',
  'R  old.js -> renamed.js',
  ' D deleted.txt',
  '?? new.js',
  'MM both.js',
  'M  staged.js',
  ' M tools/alpha/manifest.json'
])).statusDigest, 'Git status digest is independent of input order');
check(Core.parseGitStatusLine('R  old.js -> new.js').fromPath === 'old.js' && Core.parseGitStatusLine('R  old.js -> new.js').path === 'new.js', 'rename source and destination remain distinct');
check(status.topLevelConcentrations[0].path === '<root>' && status.topLevelConcentrations[0].total === 7, 'status paths are ranked into bounded top-level concentrations');
check(status.topLevelConcentrations.find(function (item) { return item.path === 'tools'; }).sharedSeams === 1, 'concentrations preserve shared-seam counts');

const recoveredStatus = Core.analyzeGitStatus(['D .env.example', ' M README.md']);
check(recoveredStatus.counts.valid === 2 && recoveredStatus.counts.invalid === 0, 'first-line leading-space transport loss is narrowly recovered');
check(recoveredStatus.counts.transportRecovered === 1 && recoveredStatus.counts.deleted === 1, 'transport recovery remains explicit and restores the worktree deletion');
check(recoveredStatus.truth.transportRecoveryApplied === true, 'status truth records transport recovery');

const laterStable = snapshot({ generatedAt: '2026-08-16T10:01:00.000Z' });
const stable = Core.compareSnapshots(snapshot(), laterStable);
check(stable.schema === Core.COMPARISON_SCHEMA, 'comparison uses the declared schema');
check(stable.verdict === 'STABLE_WITHIN_SNAPSHOT_SCOPE', 'unchanged complete observations receive only a scoped stability verdict');
check(stable.changedPaths.length === 0, 'future-only anomalies do not manufacture movement');
check(stable.qualifications.includes('FUTURE_DATED_FILES_EXCLUDED'), 'scoped comparison keeps the future-time qualification');
check(stable.truth.stableClaimScope === 'declared-file-metadata-scope-observed-files-and-windows' && stable.truth.fileContentStabilityProven === false, 'stability scope and missing content proof are explicit');

const changedFiles = laterStable.recentFiles.map(function (item) { return Object.assign({}, item); });
changedFiles[2] = file('tools/alpha/manifest.json', '2026-08-16T10:00:30.000Z', 81, true);
const moving = Core.compareSnapshots(snapshot(), Object.assign({}, laterStable, { recentFiles: changedFiles }));
check(moving.verdict === 'MOVING_WORKSPACE', 'plausible changed metadata produces a moving-workspace verdict');
check(moving.changedSharedSeams.length === 1 && moving.changedSharedSeams[0].path === 'tools/alpha/manifest.json', 'changed shared seam is named exactly');

const statusMoving = Core.compareSnapshots(snapshot(), Object.assign({}, laterStable, {
  git: Object.assign({}, laterStable.git, { status: [' M README.md', '?? new-file.js'] })
}));
check(statusMoving.verdict === 'MOVING_WORKSPACE' && statusMoving.gitStatusChanges.some(function (item) { return item.path === 'new-file.js'; }), 'Git status deltas independently prove workspace movement');

const removedInsideWindow = laterStable.recentFiles.filter(function (item) { return item.path !== 'tools/alpha/app.js'; });
const missing = Core.compareSnapshots(snapshot(), Object.assign({}, laterStable, { recentFiles: removedInsideWindow }));
check(missing.changedPaths.some(function (item) { return item.path === 'tools/alpha/app.js' && item.kind === 'LEFT_OBSERVATION_BEFORE_WINDOW_EXPIRY'; }), 'a path missing before its observation window expires is surfaced without claiming deletion');
check(missing.truth.deletionProven === false, 'an absent observation does not become a deletion claim');

const truncated = Core.compareSnapshots(snapshot(), Object.assign({}, laterStable, { truncated: true }));
check(truncated.verdict === 'UNKNOWN' && truncated.qualifications.includes('SCAN_TRUNCATED'), 'truncated scans refuse a stability verdict');

const incompleteInputs = Object.assign({}, laterStable, {
  git: Object.assign({}, laterStable.git, { complete: false }),
  counts: Object.assign({}, laterStable.counts, { scanErrors: 1 })
});
const incompleteAnalysis = Core.analyzeSnapshot(incompleteInputs);
check(incompleteAnalysis.confidence === 'QUALIFIED' && incompleteAnalysis.counts.scanErrors === 1, 'scan errors and incomplete Git explicitly qualify a single observation');
check(incompleteAnalysis.sourceObservationDigest !== Core.analyzeSnapshot(laterStable).sourceObservationDigest, 'source digest seals declared Git and scan completeness');
const incompleteComparison = Core.compareSnapshots(snapshot(), incompleteInputs);
check(incompleteComparison.verdict === 'UNKNOWN' && incompleteComparison.qualifications.includes('SCAN_ERRORS_PRESENT') && incompleteComparison.qualifications.includes('GIT_STATUS_INCOMPLETE'), 'incomplete scan or Git evidence refuses a comparison verdict');

const branchChanged = Core.compareSnapshots(snapshot(), Object.assign({}, laterStable, { git: Object.assign({}, laterStable.git, { branch: 'codex/other' }) }));
check(branchChanged.verdict === 'UNKNOWN' && branchChanged.qualifications.includes('BRANCH_CHANGED'), 'branch drift refuses a workspace comparison');

const safeGitPolicy = { optionalLocksDisabled: true, fsMonitorDisabled: true, hooksPathDisabled: true, terminalPromptDisabled: true, repositoryFiltersGloballyDisabled: false };
const safePolicySnapshot = snapshot({ git: Object.assign({}, snapshot().git, { observationPolicy: safeGitPolicy }) });
const safePolicyAnalysis = Core.analyzeSnapshot(safePolicySnapshot);
check(safePolicyAnalysis.gitObservationPolicy.issues.length === 0 && safePolicyAnalysis.truth.configuredExternalFilterSideEffectsExcluded === false, 'safe Git observation controls retain the configured-filter limitation');
const unsafePolicy = Object.assign({}, safeGitPolicy, { optionalLocksDisabled: false });
const unsafePolicySnapshot = Object.assign({}, laterStable, { git: Object.assign({}, laterStable.git, { observationPolicy: unsafePolicy }) });
check(Core.analyzeSnapshot(unsafePolicySnapshot).gitObservationPolicy.issues.includes('GIT_OPTIONAL_LOCKS_NOT_DISABLED'), 'missing no-optional-lock enforcement is explicit');
const policyChanged = Core.compareSnapshots(safePolicySnapshot, unsafePolicySnapshot);
check(policyChanged.verdict === 'UNKNOWN' && policyChanged.qualifications.includes('GIT_OBSERVATION_POLICY_CHANGED') && policyChanged.qualifications.includes('GIT_OBSERVATION_POLICY_UNSAFE_OR_INCOMPLETE'), 'Git observation policy drift refuses a comparison verdict');

const declaredScope = { complete: true, maxFiles: 200000, excludedDirectoryNames: ['.git', 'state'], symlinksFollowed: false, fileContentRead: false };
const emptyScanEvidence = { total: 0, sha256: Core.sha256([]) };
const completeScanEvidence = { scanErrorEvidence: emptyScanEvidence, excludedDirectoryEvidence: emptyScanEvidence, skippedSymlinkEvidence: emptyScanEvidence };
const scopedBefore = snapshot(Object.assign({ scan: declaredScope }, completeScanEvidence));
const scopedAfter = Object.assign({}, laterStable, completeScanEvidence, { scan: Object.assign({}, declaredScope, { excludedDirectoryNames: ['.git', 'state', 'tmp'] }) });
check(Core.analyzeSnapshot(scopedBefore).scanScope.declared && Core.analyzeSnapshot(scopedBefore).scanIntegrity.issues.length === 0, 'declared scan policy remains visible and internally consistent in analysis');
check(Core.analyzeSnapshot(scopedBefore).sourceObservationDigest !== Core.analyzeSnapshot(Object.assign({}, scopedBefore, { scan: scopedAfter.scan })).sourceObservationDigest, 'source digest seals scan policy');
const scopeChanged = Core.compareSnapshots(scopedBefore, scopedAfter);
check(scopeChanged.verdict === 'UNKNOWN' && scopeChanged.qualifications.includes('SCAN_SCOPE_CHANGED'), 'scan-scope drift refuses a workspace comparison');
const boundaryBefore = Object.assign({}, scopedBefore, { counts: Object.assign({}, scopedBefore.counts, { excludedDirectories: 1 }), excludedDirectoryEvidence: { total: 1, sha256: Core.sha256(['.git']) } });
const boundaryAfter = Object.assign({}, laterStable, completeScanEvidence, { scan: declaredScope, counts: Object.assign({}, laterStable.counts, { excludedDirectories: 2 }), excludedDirectoryEvidence: { total: 2, sha256: Core.sha256(['.git', 'state']) } });
const boundaryChanged = Core.compareSnapshots(boundaryBefore, boundaryAfter);
check(boundaryChanged.verdict === 'UNKNOWN' && boundaryChanged.qualifications.includes('SCAN_BOUNDARY_CHANGED'), 'excluded-directory boundary drift refuses a workspace comparison');
const inconsistentScan = Object.assign({}, laterStable, completeScanEvidence, { scan: Object.assign({}, declaredScope, { complete: false }) });
const inconsistentAnalysis = Core.analyzeSnapshot(inconsistentScan);
check(inconsistentAnalysis.confidence === 'QUALIFIED' && inconsistentAnalysis.scanIntegrity.issues.includes('SCAN_COMPLETE_CONTRADICTS_COUNTS'), 'contradictory scan-completeness declarations are explicit');
const inconsistentComparison = Core.compareSnapshots(snapshot(), inconsistentScan);
check(inconsistentComparison.verdict === 'UNKNOWN' && inconsistentComparison.qualifications.includes('SCAN_EVIDENCE_INCONSISTENT'), 'inconsistent scan evidence refuses a comparison verdict');
const missingEvidenceAnalysis = Core.analyzeSnapshot(snapshot({ scan: declaredScope }));
check(missingEvidenceAnalysis.scanIntegrity.issues.includes('EXCLUDED_DIRECTORY_EVIDENCE_MISSING') && missingEvidenceAnalysis.confidence === 'QUALIFIED', 'declared scan scope without boundary evidence fails closed');
const coherenceDigest = Core.sha256(['coherence']);
const emptyMetadataChangeEvidence = { total: 0, returned: 0, truncated: false, sha256: Core.sha256([]), sample: [] };
const coherentObservation = { startedAt: '2026-08-16T10:00:59.000Z', completedAt: '2026-08-16T10:01:00.000Z', durationMs: 1000, metadataPasses: 2, scanBeforeDigest: coherenceDigest, scanAfterDigest: coherenceDigest, scanStableAcrossObservation: true, gitBeforeDigest: coherenceDigest, gitAfterDigest: coherenceDigest, gitStatusStableAcrossObservation: true, metadataChangeEvidence: emptyMetadataChangeEvidence, coherentWithinDeclaredMetadataScope: true };
const coherentAnalysis = Core.analyzeSnapshot(Object.assign({}, laterStable, { observation: coherentObservation }));
check(coherentAnalysis.observationCoherence.coherent && coherentAnalysis.observationCoherence.issues.length === 0, 'valid temporal and digest brackets prove metadata-scope coherence');
const tornObservation = Object.assign({}, coherentObservation, { scanAfterDigest: Core.sha256(['moved']), scanStableAcrossObservation: false, coherentWithinDeclaredMetadataScope: false });
const tornSnapshot = Object.assign({}, laterStable, { observation: tornObservation });
const tornAnalysis = Core.analyzeSnapshot(tornSnapshot);
check(tornAnalysis.confidence === 'QUALIFIED' && tornAnalysis.observationCoherence.issues.includes('SCAN_CHANGED_DURING_OBSERVATION'), 'intra-observation metadata movement qualifies a single observation');
const tornComparison = Core.compareSnapshots(snapshot(), tornSnapshot);
check(tornComparison.verdict === 'UNKNOWN' && tornComparison.qualifications.includes('OBSERVATION_INTERNALLY_MOVING_OR_INCOHERENT'), 'a torn observation refuses a comparison verdict');
const contradictoryObservation = Object.assign({}, coherentObservation, { scanAfterDigest: Core.sha256(['different']) });
const contradictoryAnalysis = Core.analyzeSnapshot(Object.assign({}, laterStable, { observation: contradictoryObservation }));
check(contradictoryAnalysis.observationCoherence.issues.includes('SCAN_STABILITY_CONTRADICTS_DIGESTS'), 'stable flags cannot contradict bracket digests');

const manyFiles = Array.from({ length: 250 }, function (_, index) {
  return file('tools/many-' + String(index).padStart(3, '0') + '/app.js', '2026-08-16T09:59:00.000Z', index, false);
});
const manyBeforeStatus = Array.from({ length: 400 }, function (_, index) { return '?? before-' + String(index).padStart(3, '0') + '.js'; });
const manyAfterStatus = Array.from({ length: 400 }, function (_, index) { return '?? after-' + String(index).padStart(3, '0') + '.js'; });
const manyBefore = snapshot({ recentFiles: manyFiles, git: Object.assign({}, snapshot().git, { status: manyBeforeStatus }), counts: { filesScanned: 250, recentFiles: 250, activeFiles: 250, activeSharedSeams: 0 } });
const manyAfter = snapshot({ generatedAt: '2026-08-16T10:01:00.000Z', recentFiles: manyFiles, git: Object.assign({}, snapshot().git, { status: manyAfterStatus }), counts: { filesScanned: 250, recentFiles: 250, activeFiles: 250, activeSharedSeams: 0 } });
const boundedAnalysis = Core.analyzeSnapshot(manyBefore);
check(boundedAnalysis.plausibleActiveFiles.length === Core.DEFAULT_SAMPLE_LIMIT && boundedAnalysis.sampleEvidence.plausibleActiveFiles.total === 250, 'large activity arrays return a bounded sample with an exact total');
check(boundedAnalysis.sampleEvidence.plausibleActiveFiles.truncated && /^[a-f0-9]{64}$/.test(boundedAnalysis.sampleEvidence.plausibleActiveFiles.sha256), 'truncated activity evidence retains a full-set digest');
check(Core.analyzeSnapshot(manyBefore, { sampleLimit: 10 }).plausibleActiveFiles.length === 10, 'explicit sample limits reduce returned evidence rows');
check(Core.analyzeSnapshot(manyBefore, { sampleLimit: 5000 }).sampleEvidence.limit === Core.MAX_SAMPLE_LIMIT, 'explicit sample limits cannot exceed the hard ceiling');
const boundedComparison = Core.compareSnapshots(manyBefore, manyAfter);
check(boundedComparison.gitStatusChanges.length === Core.DEFAULT_SAMPLE_LIMIT && boundedComparison.changeEvidence.gitStatusChanges.total === 800, 'large Git deltas return a bounded sample with an exact total');
check(boundedComparison.changeEvidence.gitStatusChanges.truncated && /^[a-f0-9]{64}$/.test(boundedComparison.comparisonDigest), 'bounded comparison retains exact change and comparison digests');
check(boundedComparison.comparisonDigest === Core.compareSnapshots(manyBefore, manyAfter).comparisonDigest, 'comparison digest repeats for identical normalized inputs');
check(boundedAnalysis.truth.fullEvidenceReconstructibleFromOutput === false && boundedComparison.truth.fullEvidenceReconstructibleFromOutput === false, 'bounded outputs do not pretend omitted rows can be reconstructed from digests');
check(Buffer.byteLength(JSON.stringify(boundedComparison)) < 300000, 'bounded comparison stays below the regression output ceiling');

assert.throws(function () { Core.analyzeSnapshot({}); }, /schema/);
checks += 1;

process.stdout.write('Workspace Activity selftest: PASS (' + checks + ' checks)\n');
