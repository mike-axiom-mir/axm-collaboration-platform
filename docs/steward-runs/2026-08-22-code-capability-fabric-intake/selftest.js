#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = __dirname;
const read = (name) => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));

const source = read('SOURCE_DECLARATION.json');
const archives = read('STATIC_ARCHIVE_RECEIPT.json');
const evolution = read('VERSION_EVOLUTION.json');
const overlap = read('LOCAL_OVERLAP_ASSESSMENT.json');
const findings = read('STATIC_REVIEW_FINDINGS.json');
const decision = read('INTAKE_DECISION.json');
const requirements = read('CAPABILITY_REQUIREMENTS.json');
const graft = read('NATIVE_GRAFT_RECEIPT.json');
const verification = read('VERIFICATION_RECEIPT.json');
const deletion = read('DELETION_RECEIPT.json');

assert.equal(source.authority, 'NONE');
assert.equal(source.pinnedCommitPresentLocally, true);
assert.equal(source.pinnedCommitIsAncestorOfIntakeBaseline, true);
assert.equal(source.licenceOrReuseGrantPresentInArchives, false);

assert.equal(archives.artifacts.length, 3);
assert(archives.artifacts.every((item) => /^sha256:[a-f0-9]{64}$/.test(item.sha256)));
assert(archives.artifacts.slice(0, 2).every((item) =>
  item.unsafePaths === 0 && item.duplicateNames === 0 && item.symbolicLinks === 0 &&
  item.bundle.exactFolderParity === true && item.nurseryStructuralStatus === 'READY_FOR_LATER_INTAKE'));
assert.equal(archives.truth.packageCodeLoaded, false);
assert.equal(archives.truth.packageCodeExecuted, false);
assert.equal(archives.truth.packageSelftestsExecuted, false);

assert.deepEqual(evolution.fileDelta, { added: 14, removed: 0, modified: 17, identical: 17 });
assert.equal(evolution.lineage.parentArchiveDigestBound, false);
assert.equal(evolution.lineage.parentBundleDigestBound, false);

assert.equal(overlap.disposition, 'VALID_MISSING_COMPOSITION_LAYER');
assert.equal(overlap.preIntakeExactNamespaceSearch.existingExactProviders, 0);
assert.equal(overlap.nativeGraft.plannerBuilt, true);
assert.equal(overlap.nativeGraft.providerExecutionBuilt, false);
assert.equal(overlap.consciousnessClaimed, false);

const repairCodes = new Set(findings.repairRequired.map((item) => item.code));
[
  'RUN_OUTPUT_REPLACES_PRIOR_EVIDENCE',
  'SOURCE_OUTPUT_DISJOINTNESS_NOT_ENFORCED',
  'EXECUTOR_INHERITS_HOST_AUTHORITY',
  'PRIVATE_CONTENT_RETAINED_IN_EVIDENCE',
  'RESOURCE_BUDGET_DECLARED_NOT_ENFORCED',
  'LINEAGE_NOT_BOUND_TO_PARENT_BYTES'
].forEach((code) => assert(repairCodes.has(code), 'missing repair finding ' + code));
assert.equal(findings.truth.packageCodeExecuted, false);
assert.equal(findings.truth.systemCompositionGapSupported, true);

assert.equal(decision.disposition.researchThesis, 'SUPPORTED');
assert.equal(decision.disposition.suppliedRuntime, 'QUARANTINED_NOT_EXECUTED');
assert.equal(decision.truth.nativeRoutePlannerBuilt, true);
assert.equal(decision.truth.nativeExecutionRuntimeBuilt, false);
assert.equal(decision.truth.consciousnessClaimed, false);
assert.equal(decision.authority, 'NONE');

const missing = requirements.requirements.filter((item) => item.status === 'MISSING');
assert(missing.length >= 7);
assert.equal(requirements.overall, 'READY_FOR_NATIVE_REPAIR_PLANNING_RUNTIME_HELD');

assert.equal(graft.derivation.suppliedPackageCodeCopied, false);
assert.equal(graft.truth.plannerBuilt, true);
assert.equal(graft.truth.executorBuilt, false);
for (const file of graft.module.files) {
  const bytes = fs.readFileSync(path.join(root, '..', '..', '..', 'shared', 'code-capability-fabric', file.path));
  assert.equal(bytes.length, file.bytes, 'native graft byte count drift: ' + file.path);
  assert.equal('sha256:' + crypto.createHash('sha256').update(bytes).digest('hex'), file.sha256, 'native graft digest drift: ' + file.path);
}

assert.equal(verification.summary.requiredCommandSuitesPassed, 10);
assert.equal(verification.summary.focusedCommandSuitesPassed, 3);
assert.equal(verification.summary.commandSuitesFailed, 0);
assert.equal(verification.truth.suppliedPackageCodeExecuted, false);
assert.equal(deletion.deleted.files, 82);
assert.equal(deletion.truth.originalsDeleted, false);
assert.equal(deletion.truth.packageInstalled, false);

process.stdout.write('Code Capability Fabric intake evidence self-test: PASS\n');
