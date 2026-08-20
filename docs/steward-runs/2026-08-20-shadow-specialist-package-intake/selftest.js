#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Research = require('../../../shared/research-contribution-intake/research-contribution-intake');
const Core = require('../../../tools/deterministic-json-core');

const read = name => JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8'));
let checks = 0;
function check(value, label) {
  assert.ok(value, label);
  checks += 1;
  console.log('PASS ' + label);
}

const archive = read('STATIC_ARCHIVE_RECEIPT.json');
const manifest = read('MANIFEST_VERIFICATION_RECEIPT.json');
const findings = read('STATIC_REVIEW_FINDINGS.json');
const bundle = read('RESEARCH_CONTRIBUTION_BUNDLE.json');
const assessment = read('RESEARCH_CONTRIBUTION_ASSESSMENT.json');
const decision = read('SHADOW_SPECIALIST_INTAKE_DECISION.json');
const requirements = read('CAPABILITY_REQUIREMENTS.json');
const before = read('CAPABILITY_GAP_BEFORE.json');
const after = read('CAPABILITY_GAP_AFTER.json');
const seal = read('SESSION_SEGMENT.seal.json');
const curation = read('CURATION_RECEIPT.json');
const deletion = read('DELETION_RECEIPT.json');

check(archive.packages.length === 3 && archive.truth.packageCodeExecuted === false, 'three exact external artifacts remain inert');
check(archive.packages.slice(0, 2).every(item => item.unsafePaths === 0 && item.duplicateNames === 0 && item.symbolicOrSpecialEntries === 0), 'both archives passed bounded structural safety inspection');
check(manifest.packages.every(item => item.missingFiles === 0 && item.byteOrDigestMismatches === 0 && item.manifestDigestRebuilt === true), 'both manifest scopes reproduce exact listed bytes and digests');
check(manifest.packages[1].predecessorManifestDigestMatches && manifest.packages[1].predecessorArchiveDigestMatches, 'v0.2 predecessor linkage matches supplied v0.1 bytes');
check(manifest.revisionComparison.addedFiles === 49 && manifest.revisionComparison.removedFiles === 0, 'revision comparison preserves additive file-level history');
check(manifest.syntaxInspection.javascriptAndCommonJsFilesChecked === 25 && manifest.syntaxInspection.failures === 0 && manifest.syntaxInspection.packageTestsExecuted === false, 'parser-only syntax check did not execute package tests');
check(findings.disposition === 'USEFUL_KNOWLEDGE_RUNTIME_HELD' && findings.partialOrUnproven.length >= 8, 'static review retains concrete runtime holds');
check(findings.partialOrUnproven.some(item => item.code === 'INTAKE_FILESET_NOT_EXACT'), 'unmanifested-file intake gap remains explicit');
check(findings.partialOrUnproven.some(item => item.code === 'SDK_SENSITIVE_TRACE_SETTING_NOT_ENFORCED'), 'sensitive-trace enforcement gap remains explicit');
check(findings.partialOrUnproven.some(item => item.code === 'TEST_RECEIPTS_NOT_AUTHENTICATED'), 'execution and approval receipts are not promoted into authenticated proof');
check(bundle.sourceHandling === 'DATA_ONLY_NO_PACKAGE_CODE_EXECUTION' && bundle.truth.packageCodeExecuted === false, 'native research bundle preserves the data-only boundary');
check(bundle.seats[0].identityDisclosure === 'PARTIAL' && bundle.seats[0].priorOutputExposure === 'FULL', 'model identity and shared revision context are not overstated');
check(bundle.proposals.find(item => item.id === 'install-supplied-runtime').disposition === 'REJECTED', 'supplied runtime installation is rejected');
check(bundle.proposals.find(item => item.id === 'reuse-package-as-research-contribution').disposition === 'REUSE_EXISTING', 'useful knowledge routes through the existing native intake');
check(Research.verifyAssessment(assessment).pass, 'research contribution assessment verifies by exact native rebuild');
check(assessment.state === 'READY_FOR_BASELINE_SIMULATION_PLANNING', 'knowledge reaches planning only');
check(assessment.attributionAssessment.crossModelIndependenceEstablished === false, 'shared-context single-model contribution is not called independent convergence');
check(assessment.projection.truth.baselineRunBuilt === false && assessment.projection.truth.readyToExecute === false, 'planning projection is not a lab run or execution authority');
check(decision.disposition.suppliedRuntime === 'QUARANTINED_NOT_INSTALLABLE' && decision.disposition.directCodeReuse === 'REJECTED', 'runtime and direct transplant remain held');
check(decision.truth.nativeResearchAssessmentBuilt === true && decision.truth.baselineSimulationExecuted === false, 'native intake is built without claiming simulation execution');
check(decision.truth.installed === false && decision.truth.promoted === false && decision.truth.canonChanged === false, 'no install, promotion, or CANON authority was gained');
check(requirements.requirements.length === 10 && requirements.requirements.filter(item => item.required).length === 6, 'capability requirements separate inert intake from optional runtime prerequisites');
check(before.overall === 'BLOCKED' && before.requirements.filter(item => item.required).every(item => item.status === 'BLOCKED'), 'before gap records missing grounded intake');
check(after.overall === 'DEGRADED' && after.requirements.filter(item => item.required).every(item => item.status === 'READY'), 'after gap closes inert planning intake while runtime evidence remains held');
check(after.requirements.filter(item => !item.required).every(item => item.status === 'OPTIONAL_HELD'), 'all backend experiment prerequisites remain optional and held');
const segmentBytes = fs.readFileSync(path.join(__dirname, 'SESSION_SEGMENT.jsonl'));
check(seal.parseStatus === 'valid' && seal.eventLines === 9 && seal.sha256 === crypto.createHash('sha256').update(segmentBytes).digest('hex'), 'session segment is parseable and matches its structural seal');
check(curation.sealDigest === 'sha256:' + seal.sha256 && curation.durableEventsPreserved === 9, 'curation receipt binds the sealed durable event segment');
check(deletion.deleted === true && deletion.originalDownloadsRetained === true && deletion.durableEvidenceSealedBeforeDeletion === true, 'only disposable quarantine material was deleted after sealing');

if (fs.existsSync(path.join(__dirname, 'CHECK_RESULTS.json'))) {
  const results = read('CHECK_RESULTS.json');
  const payload = JSON.parse(Core.canonicalJson(results));
  delete payload.resultsDigest;
  const digest = 'sha256:' + crypto.createHash('sha256').update(Core.canonicalJson(payload)).digest('hex');
  check(results.status === 'PASS' && results.summary.commands === 18 && results.summary.failed === 0, 'all focused and AGENTS-required commands passed');
  check(results.truth.packageCodeExecuted === false && results.truth.packageTestsExecuted === false, 'verification did not execute untrusted package code or tests');
  check(results.resultsDigest === digest, 'verification result digest matches canonical content');
}

console.log('\nShadow Specialist package intake evidence selftest: PASS (' + checks + ' checks)');
