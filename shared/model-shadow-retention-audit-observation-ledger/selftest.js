#!/usr/bin/env node
'use strict';

const assert = require('assert');
const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const ContractVerifier = require('../../hub/module-contract-verifier');
const Ledger = require('./model-shadow-retention-audit-observation-ledger');
const Fixture = require('./selftest-fixture');

let checks = 0;
function check(value, label) { assert.ok(value, label); checks += 1; console.log('PASS ' + label); }
function equal(actual, expected, label) { assert.deepStrictEqual(actual, expected, label); checks += 1; console.log('PASS ' + label); }
function copy(value) { return JSON.parse(JSON.stringify(value)); }
function expectCode(action, code, label) {
  let caught = null;
  try { action(); } catch (error) { caught = error; }
  check(caught instanceof Ledger.RetentionAuditObservationLedgerError, label + ' returns typed v2.8 error');
  equal(caught.code, code, label);
}
function treeDigest(root) {
  const entries = [];
  function walk(current, relative) {
    fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).forEach(entry => {
      const absolute = path.join(current, entry.name);
      const child = relative ? relative + '/' + entry.name : entry.name;
      if (entry.isDirectory()) { entries.push({ path: child, type: 'directory' }); walk(absolute, child); }
      else entries.push({ path: child, type: 'file', sha256: crypto.createHash('sha256').update(fs.readFileSync(absolute)).digest('hex') });
    });
  }
  walk(root, '');
  return crypto.createHash('sha256').update(JSON.stringify(entries)).digest('hex');
}
function writePackage(parent, name, value) {
  const target = path.join(parent, name + '.json');
  fs.writeFileSync(target, JSON.stringify(value), { encoding: 'utf8', mode: 0o600 });
  return target;
}
function runChild(packagePath) {
  const result = childProcess.spawnSync(process.execPath, [path.join(__dirname, 'selftest-child.js'), packagePath], {
    encoding: 'utf8', windowsHide: true, maxBuffer: 384 * 1024 * 1024
  });
  return { status: result.status, value: JSON.parse(result.stdout || '{}'), stderr: result.stderr };
}
function runChildren(packagePaths) {
  return Promise.all(packagePaths.map(packagePath => new Promise(resolve => {
    const child = childProcess.spawn(process.execPath, [path.join(__dirname, 'selftest-child.js'), packagePath], {
      windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('close', code => resolve({ status: code, value: JSON.parse(stdout || '{}'), stderr }));
  })));
}
function verifiedRemove(target, parent) {
  const resolvedTarget = path.resolve(target);
  const resolvedParent = path.resolve(parent);
  if (resolvedTarget === resolvedParent || !resolvedTarget.startsWith(resolvedParent + path.sep)) throw new Error('unsafe cleanup target');
  fs.rmSync(resolvedTarget, { recursive: true, force: true });
}
function namespace(root) { return path.join(root, Ledger.NAMESPACE); }
function manifestFile(root) { return path.join(namespace(root), 'manifest.json'); }
function observationFile(root, sequence) { return path.join(namespace(root), 'observations', String(sequence).padStart(12, '0') + '.json'); }
function rewriteCanonical(filePath, transform) {
  const value = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  transform(value);
  fs.writeFileSync(filePath, Ledger.stableStringify(value) + '\n', 'utf8');
}
function copyLedger(tempRoot, sourceRoot, name) {
  const destination = Fixture.makeDir(tempRoot, name);
  fs.cpSync(namespace(sourceRoot), namespace(destination), { recursive: true });
  return destination;
}
function serviceOptionsFor(root, base) { return Object.assign(copy(base), { stateRoot: root }); }

async function main() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-v28-retention-audit-observation-'));
  try {
    const world = Fixture.buildWorld(tempRoot, 'primary');
    equal(world.exactAudit.classification, 'EXACT_HISTORY_MATCH', 'fixture supplies non-held exact v2.7 audit');
    equal(world.exactAudit.decision.holdRequired, false, 'exact v2.7 fixture audit is non-held');
    equal(world.absentAudit.classification, 'OBSERVED_LEDGER_ABSENT', 'fixture supplies held absent v2.7 audit');
    equal(world.absentAudit.decision.holdRequired, true, 'absent v2.7 fixture audit is held');

    equal(Ledger.VERSION, '2.8.0', 'version is exact');
    equal(Ledger.STATUS, 'TEST', 'status remains TEST');
    equal(Ledger.MAX_RECORDS, 10000, 'observation count is bounded');
    equal(Ledger.MAX_ARTIFACT_CANONICAL_BYTES, 4194304, 'artifact bound is four MiB');
    equal(Ledger.MAX_AGGREGATE_STORAGE_BYTES, 268435456, 'aggregate observation bound is 256 MiB');
    equal(Ledger.MAX_CAPTURE_INPUT_CANONICAL_BYTES, 402653184, 'capture input bound is 384 MiB');

    const observationRoot = Fixture.makeDir(tempRoot, 'observation-primary');
    const serviceOptions = Fixture.serviceOptions(observationRoot, 'v28-audit-observation-log');
    const service = Ledger.createService(copy(serviceOptions));
    equal(service.inspect(), null, 'absent observation namespace inspects as null');
    equal(fs.existsSync(namespace(observationRoot)), false, 'read-only absent inspect creates no namespace');

    const exactInput = Fixture.captureInput(
      'v28-observation:exact',
      '2026-08-20T16:32:46.000Z',
      world,
      world.exactAuditInput,
      world.exactAudit
    );
    const wrongConfirmation = copy(exactInput);
    wrongConfirmation.confirmation = 'NOT_CONFIRMED';
    expectCode(() => service.capture(wrongConfirmation), 'AUDIT_OBSERVATION_CONFIRMATION_REQUIRED', 'capture requires exact confirmation');
    equal(fs.existsSync(namespace(observationRoot)), false, 'wrong confirmation creates no observation namespace');

    const overlapService = Ledger.createService(Fixture.serviceOptions(world.retentionRoot, 'v28-overlap-log'));
    expectCode(() => overlapService.capture(copy(exactInput)), 'AUDIT_OBSERVATION_ROOT_OVERLAP', 'observation and retention roots cannot overlap');
    equal(fs.existsSync(path.join(world.retentionRoot, Ledger.NAMESPACE)), false, 'overlap refusal creates no observation namespace in retention root');
    const nestedObservationRoot = Fixture.makeDir(world.source.root, 'nested-observation-root');
    const nestedService = Ledger.createService(Fixture.serviceOptions(nestedObservationRoot, 'v28-nested-log'));
    expectCode(() => nestedService.capture(copy(exactInput)), 'AUDIT_OBSERVATION_ROOT_OVERLAP', 'nested observation and source roots cannot overlap');
    equal(fs.existsSync(namespace(nestedObservationRoot)), false, 'nested-root refusal creates no observation namespace');

    const invalidReceipt = copy(exactInput);
    invalidReceipt.auditReceipt.auditDigest = 'sha256:' + '0'.repeat(64);
    expectCode(() => service.capture(invalidReceipt), 'AUDIT_OBSERVATION_V27_AUDIT_INVALID', 'capture refuses corrupt v2.7 receipt');
    const mismatchedPackage = copy(exactInput);
    mismatchedPackage.auditInput = copy(world.absentAuditInput);
    expectCode(() => service.capture(mismatchedPackage), 'AUDIT_OBSERVATION_V27_AUDIT_INVALID', 'capture refuses receipt and live input mismatch');
    const earlyInput = copy(exactInput);
    earlyInput.observedAt = '2026-08-20T16:32:44.999Z';
    expectCode(() => service.capture(earlyInput), 'AUDIT_OBSERVATION_TIME_INVALID', 'capture cannot predate v2.7 audit');
    equal(fs.existsSync(namespace(observationRoot)), false, 'invalid exact packages leave no observation namespace');

    const sourceBeforeCapture = treeDigest(world.source.root);
    const retentionBeforeCapture = treeDigest(world.retentionRoot);
    const exactObservation = service.capture(copy(exactInput));
    equal(treeDigest(world.source.root), sourceBeforeCapture, 'exact capture leaves durable source bytes unchanged');
    equal(treeDigest(world.retentionRoot), retentionBeforeCapture, 'exact capture leaves durable retention bytes unchanged');
    equal(exactObservation.schema, Ledger.OBSERVATION_SCHEMA, 'observation schema is exact');
    equal(exactObservation.classification, Ledger.NONHOLD_CLASSIFICATION, 'exact audit becomes non-held observation');
    equal(exactObservation.v27Audit, world.exactAudit, 'observation persists complete exact v2.7 audit');
    equal(exactObservation.decision.reviewRequired, true, 'non-held observation still requires review');
    equal(exactObservation.decision.observationOnly, true, 'receipt is explicitly observation-only');
    equal(exactObservation.decision.autonomousActionCount, 0, 'receipt grants no autonomous action');
    equal(exactObservation.truth.v27AuditExactRebuiltBeforeWrite, true, 'receipt records exact v2.7 rebuild before write');
    equal(exactObservation.truth.observationExclusiveCreateAndFileFsyncCompleted, true, 'receipt records exclusive create and file fsync');
    equal(exactObservation.truth.sourceOrRetentionPresentationRequiredForReload, false, 'receipt declares origin-independent reload boundary');
    equal(exactObservation.truth.externalRetentionProven, false, 'receipt claims no external retention');
    equal(exactObservation.truth.protectedMonotonicStateProven, false, 'receipt claims no protected monotonic state');
    equal(exactObservation.truth.hostAuthorizationAuthenticated, false, 'receipt claims no host authentication');
    equal(exactObservation.truth.actualHumanParticipationProven, false, 'receipt claims no human participation');
    equal(exactObservation.truth.executionAuthorized, false, 'receipt authorizes no execution');
    equal(exactObservation.truth.automaticCanon, false, 'receipt performs no canonization');
    check(fs.existsSync(manifestFile(observationRoot)), 'first capture persists manifest');
    check(fs.existsSync(observationFile(observationRoot, 1)), 'first capture persists observation one');
    equal(fs.readFileSync(observationFile(observationRoot, 1), 'utf8'), Ledger.stableStringify(exactObservation) + '\n', 'observation file is exact canonical JSON');
    equal(service.read(1), exactObservation, 'read returns exact first observation');
    equal(service.verifyPersisted(exactObservation).pass, true, 'persisted observation verifies without v2.7 audit input');

    const firstSnapshot = service.inspect();
    equal(firstSnapshot.schema, Ledger.SNAPSHOT_SCHEMA, 'snapshot schema is exact');
    equal(firstSnapshot.observationCount, 1, 'snapshot counts first observation');
    equal(firstSnapshot.heldObservationCount, 0, 'snapshot counts no held observation yet');
    equal(firstSnapshot.nonholdObservationCount, 1, 'snapshot counts one non-held observation');
    equal(firstSnapshot.latestV27AuditRef.sha256, world.exactAudit.auditDigest, 'snapshot binds latest v2.7 audit digest');
    equal(firstSnapshot.truth.completeObservationChainValidated, true, 'snapshot records complete chain validation');
    equal(firstSnapshot.truth.sourceOrRetentionPresentationRequiredForReload, false, 'snapshot reload requires no compared root presentation');

    expectCode(() => service.capture(copy(exactInput)), 'AUDIT_OBSERVATION_DUPLICATE', 'duplicate observation id and audit are refused');
    const duplicateAudit = copy(exactInput);
    duplicateAudit.observationId = 'v28-observation:duplicate-audit';
    duplicateAudit.observedAt = '2026-08-20T16:32:47.000Z';
    expectCode(() => service.capture(duplicateAudit), 'AUDIT_OBSERVATION_DUPLICATE', 'duplicate v2.7 audit digest under another id is refused');
    equal(service.inspect().observationCount, 1, 'duplicate refusals append no observation');

    const sameTimeAuditInput = copy(world.exactAuditInput);
    sameTimeAuditInput.auditId = 'v28-retention-audit:same-observed-time';
    const sameTimeAudit = world.retentionService.auditLatest(copy(sameTimeAuditInput));
    const nonForwardInput = Fixture.captureInput(
      'v28-observation:non-forward-time',
      exactObservation.observedAt,
      world,
      sameTimeAuditInput,
      sameTimeAudit
    );
    expectCode(() => service.capture(nonForwardInput), 'AUDIT_OBSERVATION_TIME_INVALID', 'observation times must move strictly forward');

    const absentInput = Fixture.captureInput(
      'v28-observation:absent',
      '2026-08-20T16:32:51.000Z',
      world,
      world.absentAuditInput,
      world.absentAudit
    );
    const sourceBeforeHeldCapture = treeDigest(world.absentRoot);
    const retentionBeforeHeldCapture = treeDigest(world.retentionRoot);
    const heldObservation = service.capture(copy(absentInput));
    equal(treeDigest(world.absentRoot), sourceBeforeHeldCapture, 'held capture leaves absent source root unchanged');
    equal(treeDigest(world.retentionRoot), retentionBeforeHeldCapture, 'held capture leaves durable retention bytes unchanged');
    equal(heldObservation.classification, Ledger.HELD_CLASSIFICATION, 'absent audit becomes held observation');
    equal(heldObservation.v27Audit, world.absentAudit, 'held observation persists complete absence audit');
    equal(heldObservation.decision.holdRequired, true, 'held observation preserves hold requirement');
    equal(heldObservation.log.sequence, 2, 'held observation advances contiguous sequence');
    equal(heldObservation.log.previousObservationRef.sha256, exactObservation.observationDigest, 'held observation chains exact prior digest');
    equal(heldObservation.retentionManifestRef, exactObservation.retentionManifestRef, 'both observations bind one retention manifest');
    equal(service.read(2), heldObservation, 'read returns exact held observation');
    equal(service.verifyPersisted(heldObservation).pass, true, 'held observation verifies from stored state');
    const finalSnapshot = service.inspect();
    equal(finalSnapshot.observationCount, 2, 'snapshot counts both observations');
    equal(finalSnapshot.heldObservationCount, 1, 'snapshot counts one held observation');
    equal(finalSnapshot.nonholdObservationCount, 1, 'snapshot counts one non-held observation');
    equal(finalSnapshot.latestClassification, Ledger.HELD_CLASSIFICATION, 'snapshot exposes latest held classification');

    const otherWorld = Fixture.buildWorld(tempRoot, 'identity-drift');
    check(otherWorld.exactAudit.retention.manifestRef.sha256 !== exactObservation.retentionManifestRef.sha256, 'second world has distinct retention manifest identity');
    const identityDriftInput = Fixture.captureInput(
      'v28-observation:identity-drift',
      '2026-08-20T16:32:52.000Z',
      otherWorld,
      otherWorld.exactAuditInput,
      otherWorld.exactAudit
    );
    expectCode(() => service.capture(identityDriftInput), 'AUDIT_OBSERVATION_RETENTION_IDENTITY_DRIFT', 'one observation log refuses retention manifest identity drift');
    equal(service.inspect().observationCount, 2, 'identity drift refusal appends no observation');

    const childInspectPath = writePackage(tempRoot, 'child-inspect-before-loss', { action: 'inspect', serviceOptions });
    const childInspect = runChild(childInspectPath);
    equal(childInspect.status, 0, 'fresh child process reload exits zero');
    equal(childInspect.value.result, finalSnapshot, 'fresh child process reloads exact snapshot');
    const childReadPath = writePackage(tempRoot, 'child-read-before-loss', { action: 'read', serviceOptions, sequence: 2 });
    const childRead = runChild(childReadPath);
    equal(childRead.status, 0, 'fresh child read exits zero');
    equal(childRead.value.result, heldObservation, 'fresh child reads exact held observation');

    const corruptDigestRoot = copyLedger(tempRoot, observationRoot, 'corrupt-digest');
    rewriteCanonical(observationFile(corruptDigestRoot, 1), value => { value.observationDigest = 'sha256:' + '0'.repeat(64); });
    expectCode(() => Ledger.createService(serviceOptionsFor(corruptDigestRoot, serviceOptions)).inspect(), 'AUDIT_OBSERVATION_RECORD_CORRUPT', 'corrupt observation digest fails closed');
    const corruptChainRoot = copyLedger(tempRoot, observationRoot, 'corrupt-chain');
    rewriteCanonical(observationFile(corruptChainRoot, 2), value => {
      value.log.previousObservationRef.sha256 = 'sha256:' + '1'.repeat(64);
      const comparable = copy(value);
      delete comparable.observationDigest;
      value.observationDigest = Ledger.sha256(comparable);
    });
    expectCode(() => Ledger.createService(serviceOptionsFor(corruptChainRoot, serviceOptions)).inspect(), 'AUDIT_OBSERVATION_RECORD_CORRUPT', 'corrupt previous-reference chain fails closed');
    const gapRoot = copyLedger(tempRoot, observationRoot, 'gap');
    fs.renameSync(observationFile(gapRoot, 2), observationFile(gapRoot, 3));
    expectCode(() => Ledger.createService(serviceOptionsFor(gapRoot, serviceOptions)).inspect(), 'AUDIT_OBSERVATION_SEQUENCE_CORRUPT', 'observation sequence gap fails closed');
    const extraRoot = copyLedger(tempRoot, observationRoot, 'extra');
    fs.writeFileSync(path.join(namespace(extraRoot), 'unexpected.txt'), 'unexpected', 'utf8');
    expectCode(() => Ledger.createService(serviceOptionsFor(extraRoot, serviceOptions)).inspect(), 'AUDIT_OBSERVATION_NAMESPACE_CORRUPT', 'unexpected namespace item fails closed');
    const noncanonicalRoot = copyLedger(tempRoot, observationRoot, 'noncanonical');
    fs.appendFileSync(observationFile(noncanonicalRoot, 1), ' ');
    expectCode(() => Ledger.createService(serviceOptionsFor(noncanonicalRoot, serviceOptions)).inspect(), 'AUDIT_OBSERVATION_RECORD_CORRUPT', 'noncanonical record bytes fail closed');
    const missingManifestRoot = copyLedger(tempRoot, observationRoot, 'missing-manifest');
    fs.rmSync(manifestFile(missingManifestRoot), { force: true });
    expectCode(() => Ledger.createService(serviceOptionsFor(missingManifestRoot, serviceOptions)).inspect(), 'AUDIT_OBSERVATION_MANIFEST_MISSING', 'records without manifest fail closed');
    const oversizedRoot = copyLedger(tempRoot, observationRoot, 'oversized-record');
    fs.writeFileSync(observationFile(oversizedRoot, 1), Buffer.alloc(Ledger.MAX_ARTIFACT_CANONICAL_BYTES + 2, 0x20));
    expectCode(() => Ledger.createService(serviceOptionsFor(oversizedRoot, serviceOptions)).inspect(), 'AUDIT_OBSERVATION_RECORD_CORRUPT', 'oversized stored observation fails closed');
    const wrongIdentityOptions = copy(serviceOptions);
    wrongIdentityOptions.auditLogId = 'v28-wrong-configured-log';
    expectCode(() => Ledger.createService(wrongIdentityOptions).inspect(), 'AUDIT_OBSERVATION_MANIFEST_CORRUPT', 'configured manifest identity mismatch fails closed');

    fs.writeFileSync(path.join(namespace(observationRoot), Ledger.LOCK_FILE), '{}\n', 'utf8');
    expectCode(() => service.inspect(), 'AUDIT_OBSERVATION_BUSY', 'pre-existing operation lock fails closed');
    fs.rmSync(path.join(namespace(observationRoot), Ledger.LOCK_FILE), { force: true });
    equal(service.inspect(), finalSnapshot, 'ledger reloads after exact synthetic lock cleanup');

    const concurrentWorld = Fixture.buildWorld(tempRoot, 'concurrent');
    const concurrentRoot = Fixture.makeDir(tempRoot, 'concurrent-observations');
    const concurrentOptions = Fixture.serviceOptions(concurrentRoot, 'v28-concurrent-log');
    const concurrentInput = Fixture.captureInput(
      'v28-observation:concurrent',
      '2026-08-20T16:32:46.000Z',
      concurrentWorld,
      concurrentWorld.exactAuditInput,
      concurrentWorld.exactAudit
    );
    const concurrentPackage = { action: 'capture', serviceOptions: concurrentOptions, input: concurrentInput };
    const concurrentResults = await runChildren([
      writePackage(tempRoot, 'concurrent-a', concurrentPackage),
      writePackage(tempRoot, 'concurrent-b', concurrentPackage)
    ]);
    equal(concurrentResults.filter(result => result.status === 0).length, 1, 'exactly one concurrent duplicate writer succeeds');
    equal(concurrentResults.filter(result => result.status !== 0).length, 1, 'exactly one concurrent duplicate writer fails closed');
    equal(Ledger.createService(concurrentOptions).inspect().observationCount, 1, 'concurrent race persists exactly one observation');

    const publicArtifacts = [exactObservation, heldObservation, finalSnapshot];
    const publicText = JSON.stringify(publicArtifacts);
    const publicKeys = new Set();
    (function collectKeys(value) {
      if (Array.isArray(value)) return value.forEach(collectKeys);
      if (!value || typeof value !== 'object') return;
      Object.keys(value).forEach(key => { publicKeys.add(key); collectKeys(value[key]); });
    })(publicArtifacts);
    check(!publicText.includes(tempRoot), 'public artifacts embed no configured machine path');
    check(!publicKeys.has('stateRoot'), 'public artifacts embed no state root field');
    check(!publicKeys.has('serviceOptions'), 'public artifacts embed no service options package');
    check(!publicKeys.has('records'), 'public artifacts embed no current record package');
    check(!publicKeys.has('checkpointInput'), 'public artifacts embed no checkpoint origin package');
    check(!publicText.includes('BEGIN PRIVATE KEY'), 'public artifacts embed no private key PEM');
    check(!publicKeys.has('modelOutput'), 'public artifacts embed no model output payload field');
    check(!publicKeys.has('privateContext'), 'public artifacts embed no private context payload field');
    check(publicText.includes('rawV27AuditInputEmbedded') && publicText.includes('privateContextEmbedded'), 'public artifacts retain explicit negative minimization truth fields');
    equal(Ledger.stableStringify(JSON.parse(Ledger.stableStringify(finalSnapshot))), Ledger.stableStringify(finalSnapshot), 'snapshot canonical JSON is stable');
    equal(Ledger.buildManifest, undefined, 'write-completion manifest builder is not exported');
    equal(Ledger.buildObservation, undefined, 'write-completion observation builder is not exported');

    const implementation = fs.readFileSync(path.join(__dirname, 'model-shadow-retention-audit-observation-ledger.js'), 'utf8');
    check(!implementation.includes('fetch(') && !implementation.includes('https.request') && !implementation.includes('http.request'), 'implementation has no network invocation');
    check(!implementation.includes('child_process'), 'runtime launches no child process');
    check(!implementation.includes('bridge-token') && !implementation.includes('Authorization:'), 'runtime contains no credential source');
    check(implementation.includes('fs.openSync') && implementation.includes("'wx'") && implementation.includes('fs.fsyncSync'), 'runtime uses exclusive create and file fsync');
    check(implementation.includes('directoryEntryOrHardwareDurabilityProven: false'), 'runtime refuses directory and hardware durability claim');
    check(implementation.includes('externalRetentionProven: false'), 'runtime refuses external retention claim');
    check(implementation.includes('protectedMonotonicStateProven: false'), 'runtime refuses protected monotonic state claim');
    check(implementation.includes('humanBenefitProven: false') && implementation.includes('broadLearningClaimed: false'), 'runtime refuses benefit and learning claims');

    const contract = require('./module.contract.json');
    equal(contract.version, 'v2.8', 'contract version is exact');
    equal(contract.status, 'TEST', 'contract status remains TEST');
    equal(contract.merge_gate, 'Mike Tobi / AXM', 'contract preserves human merge gate');
    equal(contract.lifecycle.installed, false, 'module remains uninstalled');
    equal(contract.lifecycle.promoted, false, 'module remains unpromoted');
    check(contract.boundaries.writes.some(value => value.includes('observation') && value.includes('file-fsync')), 'contract declares observation file-fsync write');
    check(contract.boundaries.refuses.includes('caller-owned-local-root-as-independent-external-retention'), 'contract refuses local root as external retention');
    check(contract.boundaries.refuses.includes('joint-source-retention-and-observation-root-loss-as-original-continuity'), 'contract refuses joint three-root loss continuity');
    check(contract.boundaries.refuses.includes('confirmation-string-as-host-actor-human-organization-or-policy-authentication'), 'contract refuses confirmation authentication');
    const contractCheck = ContractVerifier.validateContract(contract);
    equal(contractCheck.pass, true, 'module contract passes repository verifier');
    equal(contractCheck.errors, [], 'module contract verifier reports no errors');

    const schemas = ['manifest.schema.json', 'observation.schema.json', 'snapshot.schema.json'];
    schemas.forEach(name => {
      const schema = JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8'));
      equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema', name + ' declares Draft 2020-12');
      equal(schema.additionalProperties, false, name + ' is closed at root');
    });
    const observationSchema = require('./observation.schema.json');
    equal(observationSchema.properties.v27Audit.$ref, '../model-shadow-history-checkpoint-retention-ledger/audit.schema.json', 'observation schema reuses exact v2.7 audit schema');
    equal(observationSchema.properties.truth.properties.externalRetentionProven.const, false, 'observation schema fixes external retention false');
    equal(observationSchema.properties.truth.properties.executionAuthorized.const, false, 'observation schema fixes execution authority false');

    verifiedRemove(world.source.root, tempRoot);
    verifiedRemove(world.absentRoot, tempRoot);
    verifiedRemove(world.retentionRoot, tempRoot);
    equal(fs.existsSync(world.source.root), false, 'synthetic exact source root is absent after bounded removal');
    equal(fs.existsSync(world.absentRoot), false, 'synthetic absent-presentation root is absent after bounded removal');
    equal(fs.existsSync(world.retentionRoot), false, 'synthetic retention root is absent after bounded removal');
    const afterLossInspectPath = writePackage(tempRoot, 'child-inspect-after-origin-loss', { action: 'inspect', serviceOptions });
    const afterLossInspect = runChild(afterLossInspectPath);
    equal(afterLossInspect.status, 0, 'fresh process reload after compared-root loss exits zero');
    equal(afterLossInspect.value.result, finalSnapshot, 'fresh process reloads exact snapshot after compared-root loss');
    const afterLossReadPath = writePackage(tempRoot, 'child-read-after-origin-loss', { action: 'read', serviceOptions, sequence: 2 });
    const afterLossRead = runChild(afterLossReadPath);
    equal(afterLossRead.status, 0, 'fresh process read after compared-root loss exits zero');
    equal(afterLossRead.value.result, heldObservation, 'fresh process preserves exact held audit after compared-root loss');

    const replacementWorld = Fixture.buildWorld(tempRoot, 'joint-replacement');
    const replacementObservationRoot = Fixture.makeDir(tempRoot, 'joint-replacement-observations');
    const replacementOptions = Fixture.serviceOptions(replacementObservationRoot, 'v28-joint-replacement-log');
    const replacementService = Ledger.createService(replacementOptions);
    const replacementInput = Fixture.captureInput(
      'v28-observation:joint-replacement',
      '2026-08-20T16:32:46.000Z',
      replacementWorld,
      replacementWorld.exactAuditInput,
      replacementWorld.exactAudit
    );
    const replacementObservation = replacementService.capture(replacementInput);
    equal(replacementService.verifyPersisted(replacementObservation).pass, true, 'replacement triple is internally exact');
    check(replacementObservation.observationDigest !== exactObservation.observationDigest, 'replacement triple has no original observation identity');
    verifiedRemove(observationRoot, tempRoot);
    equal(fs.existsSync(observationRoot), false, 'synthetic original observation root is absent after joint-loss simulation');
    equal(service.inspect(), null, 'original service has no continuity after its third root is removed');
    equal(replacementService.inspect().observationCount, 1, 'another internally exact local triple remains possible after joint loss');
    equal(replacementService.inspect().truth.jointThreeRootLossExcluded, false, 'replacement snapshot refuses protected joint-loss claim');

    console.log('RESULT ' + checks + ' focused assertions passed');
  } finally {
    verifiedRemove(tempRoot, path.dirname(tempRoot));
  }
}

main().catch(error => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
