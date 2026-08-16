#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Core = require('./workspace-activity-core');
const Snapshot = require('./workspace-snapshot');

let checks = 0;
function check(value, label) {
  assert.ok(value, label);
  checks += 1;
}

function git(root, args) {
  const result = childProcess.spawnSync('git', ['-C', root].concat(args), { encoding: 'utf8', windowsHide: true, shell: false, timeout: 30000 });
  if (result.error || result.status !== 0) throw new Error(String(result.stderr || result.stdout || result.error));
  return String(result.stdout || '');
}

function removeFixture(root) {
  const resolved = path.resolve(root);
  const prefix = path.resolve(os.tmpdir()) + path.sep;
  if (!resolved.startsWith(prefix) || !path.basename(resolved).startsWith('axm-workspace-snapshot-')) throw new Error('temporary cleanup boundary refused');
  fs.rmSync(resolved, { recursive: true, force: true });
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-workspace-snapshot-'));
const nonGitRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-workspace-snapshot-nongit-'));
try {
  git(root, ['init', '-b', 'codex/snapshot-selftest']);
  git(root, ['config', 'user.name', 'Snapshot Selftest']);
  git(root, ['config', 'user.email', 'snapshot@example.invalid']);
  fs.writeFileSync(path.join(root, '.gitignore'), 'state/\n');
  fs.writeFileSync(path.join(root, '.gitattributes'), '*.probe filter=probe\n');
  fs.writeFileSync(path.join(root, '.env.example'), 'example=true\n');
  fs.writeFileSync(path.join(root, 'filter-side-effect.js'), "'use strict';\nconst fs = require('node:fs');\nfs.writeFileSync('filter-marker.txt', 'executed\\n');\nprocess.stdin.pipe(process.stdout);\n");
  fs.writeFileSync(path.join(root, 'filtered.probe'), 'original\n');
  fs.writeFileSync(path.join(root, 'old.txt'), 'old\n');
  git(root, ['add', '.']);
  git(root, ['commit', '-m', 'fixture']);
  git(root, ['config', 'filter.probe.clean', 'node filter-side-effect.js']);
  git(root, ['config', 'filter.probe.required', 'true']);

  fs.appendFileSync(path.join(root, '.env.example'), 'changed=true\n');
  fs.appendFileSync(path.join(root, 'filtered.probe'), 'changed\n');
  git(root, ['mv', 'old.txt', 'renamed file.txt']);
  fs.writeFileSync(path.join(root, 'new file.txt'), 'new\n');
  fs.mkdirSync(path.join(root, 'package'), { recursive: true });
  fs.writeFileSync(path.join(root, 'package', 'manifest.json'), '{}\n');
  fs.mkdirSync(path.join(root, 'state'), { recursive: true });
  fs.writeFileSync(path.join(root, 'state', 'ignored.json'), '{}\n');

  const active = new Date('2026-08-16T09:59:00.000Z');
  const quiet = new Date('2026-08-16T09:00:00.000Z');
  const future = new Date('2059-12-31T18:00:00.000Z');
  fs.utimesSync(path.join(root, '.gitignore'), quiet, quiet);
  fs.utimesSync(path.join(root, '.gitattributes'), quiet, quiet);
  fs.utimesSync(path.join(root, '.env.example'), active, active);
  fs.utimesSync(path.join(root, 'filter-side-effect.js'), quiet, quiet);
  fs.utimesSync(path.join(root, 'filtered.probe'), active, active);
  fs.utimesSync(path.join(root, 'renamed file.txt'), active, active);
  fs.utimesSync(path.join(root, 'new file.txt'), active, active);
  fs.utimesSync(path.join(root, 'state', 'ignored.json'), active, active);
  fs.utimesSync(path.join(root, 'package', 'manifest.json'), future, future);

  const indexRef = git(root, ['rev-parse', '--git-path', 'index']).trim();
  const indexPath = path.isAbsolute(indexRef) ? indexRef : path.resolve(root, indexRef);
  const indexBefore = fs.statSync(indexPath);
  const indexHashBefore = crypto.createHash('sha256').update(fs.readFileSync(indexPath)).digest('hex');
  const snapshot = Snapshot.buildSnapshot(root, { now: '2026-08-16T10:00:00.000Z', minutes: 30, activeMinutes: 5 });
  const indexAfter = fs.statSync(indexPath);
  const indexHashAfter = crypto.createHash('sha256').update(fs.readFileSync(indexPath)).digest('hex');
  check(snapshot.schema === Core.SNAPSHOT_SCHEMA, 'producer emits the classifier snapshot schema');
  check(snapshot.git.available && snapshot.git.branch === 'codex/snapshot-selftest', 'Git repository and branch are observed read-only');
  check(snapshot.git.complete === true, 'successful NUL-safe Git observation is marked complete');
  check(snapshot.git.status.includes(' M .env.example'), 'leading worktree status space survives NUL-safe transport');
  check(snapshot.git.status.some(function (line) { return line.includes('old.txt -> "renamed file.txt"'); }), 'rename source and spaced destination survive transport');
  check(snapshot.git.status.some(function (line) { return line === '?? "new file.txt"'; }), 'spaced untracked path is encoded without ambiguity');
  check(!snapshot.recentFiles.some(function (item) { return item.path.startsWith('state/'); }), 'runtime state directory is excluded from the file scan');
  check(snapshot.scan.maxFiles === Snapshot.DEFAULT_MAX_FILES && snapshot.scan.excludedDirectoryNames.includes('state'), 'default ceiling and exclusion policy are declared in the snapshot');
  check(snapshot.counts.excludedDirectories === 2 && snapshot.excludedDirectoryEvidence.sample.includes('.git') && snapshot.excludedDirectoryEvidence.sample.includes('state'), 'excluded directory paths remain bounded visible evidence');
  check(/^[a-f0-9]{64}$/.test(snapshot.excludedDirectoryEvidence.sha256), 'excluded directory evidence receives a full-set digest');
  check(snapshot.skippedSymlinkEvidence.total === 0 && /^[a-f0-9]{64}$/.test(snapshot.skippedSymlinkEvidence.sha256), 'empty symlink boundary is still digest-bound');
  check(snapshot.recentFiles.some(function (item) { return item.path === 'package/manifest.json' && item.sharedSeam; }), 'future-dated manifest remains visible as a shared-seam observation');
  check(snapshot.counts.scanErrors === 0 && snapshot.truncated === false && snapshot.scan.complete, 'complete fixture scan has no errors or truncation');
  check(snapshot.truth.readOnlyInspectionIntent && snapshot.truth.repositoryWritesRequested === false && snapshot.truth.readOnlySideEffectsFullyProven === false, 'producer truth separates read-only intent from unproven external side effects');
  check(snapshot.observation.metadataPasses === 2 && snapshot.observation.coherentWithinDeclaredMetadataScope, 'two metadata passes produce an internally coherent fixture observation');
  check(snapshot.observation.metadataChangeEvidence.total === 0 && /^[a-f0-9]{64}$/.test(snapshot.observation.metadataChangeEvidence.sha256), 'stable metadata passes retain zero-change evidence with a full-set digest');
  check(snapshot.git.stableAcrossObservation === true && snapshot.generatedAt === snapshot.observation.completedAt, 'Git status is bracketed and generatedAt marks observation completion');
  check(snapshot.git.observationPolicy.optionalLocksDisabled && snapshot.git.observationPolicy.fsMonitorDisabled && snapshot.git.observationPolicy.hooksPathDisabled, 'snapshot declares the enforced no-optional-lock and no-hook Git policy');
  check(snapshot.git.observationPolicy.repositoryFiltersGloballyDisabled && snapshot.git.observationPolicy.configuredFilterCount >= 1 && /^[a-f0-9]{64}$/.test(snapshot.git.observationPolicy.configuredFilterDigest), 'configured Git filter overrides are counted and digest-bound');
  check(!fs.existsSync(path.join(root, 'filter-marker.txt')), 'configured side-effecting clean filter is not executed by Git observation');
  check(indexHashBefore === indexHashAfter && indexBefore.mtimeMs === indexAfter.mtimeMs, 'Git observation leaves the fixture index content and timestamp unchanged');

  const analysis = Core.analyzeSnapshot(snapshot);
  check(analysis.scanScope.declared && /^[a-f0-9]{64}$/.test(analysis.scanScope.digest) && /^[a-f0-9]{64}$/.test(analysis.scanScope.boundaryDigest), 'classifier exposes the sealed producer scan scope and boundary');
  check(analysis.scanIntegrity.issues.length === 0 && analysis.truth.sourceScanCompleteWithinDeclaredScope, 'producer scan declarations are internally consistent');
  check(analysis.gitObservationPolicy.issues.length === 0 && analysis.truth.configuredExternalFilterSideEffectsExcluded === true, 'classifier verifies enforced Git safeguards and configured-filter exclusion');
  check(analysis.gitStatus.counts.invalid === 0 && analysis.gitStatus.counts.transportRecovered === 0, 'native status requires no lossy-transport recovery');
  check(analysis.gitStatus.counts.tracked === 3 && analysis.gitStatus.counts.untracked === 2, 'tracked and untracked fixture counts are exact');
  check(analysis.counts.futureDatedFiles === 1 && analysis.counts.plausibleActiveFiles === 4, 'future anomaly is separated from four plausible active files');

  const limited = Snapshot.buildSnapshot(root, { now: '2026-08-16T10:00:00.000Z', minutes: 30, activeMinutes: 5, maxFiles: 1 });
  check(limited.counts.filesScanned === 1 && limited.truncated && limited.scan.complete === false, 'scan limit is explicit and fail-qualified');
  check(limited.cautions.some(function (item) { return item.includes('incomplete'); }), 'truncated scan produces a visible caution');

  check(Snapshot.parsePorcelainZ(Buffer.from(' M one.txt\0?? two.txt\0')).length === 2, 'NUL parser preserves ordinary status entries');
  check(Snapshot.encodeGitPath('name with space.txt') === '"name with space.txt"', 'ambiguous paths receive JSON-compatible quoting');
  check(Snapshot.parseArgs(['--root', root, '--minutes', '10', '--active-minutes', '2', '--max-files', '50', '--json']).json, 'CLI arguments parse explicitly');
  check(Snapshot.gitInvocationArgs(root, ['status']).includes('--no-optional-locks') && Snapshot.gitInvocationEnvironment().GIT_OPTIONAL_LOCKS === '0', 'Git invocation applies redundant no-optional-lock controls');
  const syntheticPass = { scanned: 1, truncated: false, metadataDigest: 'a'.repeat(64), metadataRows: [['one.txt', 1, 1, 0]], errors: [], excludedDirectories: [], skippedSymlinks: [] };
  const tornPass = Object.assign({}, syntheticPass, { metadataDigest: 'b'.repeat(64), metadataRows: [['one.txt', 2, 2, 0]] });
  const tornObservation = Snapshot.compareObservationPasses(syntheticPass, tornPass, Snapshot.gitSnapshot(root), Snapshot.gitSnapshot(root));
  check(tornObservation.scanStableAcrossObservation === false && tornObservation.coherentWithinDeclaredMetadataScope === false, 'metadata movement between passes marks the observation torn');
  check(tornObservation.metadataChangeEvidence.total === 1 && tornObservation.metadataChangeEvidence.sample[0].path === 'one.txt', 'torn passes name bounded metadata movement evidence');

  fs.writeFileSync(path.join(nonGitRoot, 'note.txt'), 'metadata only\n');
  const nonGitSnapshot = Snapshot.buildSnapshot(nonGitRoot, { now: '2026-08-16T10:00:00.000Z' });
  check(nonGitSnapshot.git.available === false && nonGitSnapshot.git.complete === false, 'non-Git roots preserve unavailable and incomplete Git evidence');
  check(Core.analyzeSnapshot(nonGitSnapshot).confidence === 'QUALIFIED', 'missing Git evidence cannot receive unqualified confidence');

  process.stdout.write('Workspace Snapshot selftest: PASS (' + checks + ' checks)\n');
} finally {
  removeFixture(root);
  removeFixture(nonGitRoot);
}
