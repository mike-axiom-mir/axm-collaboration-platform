'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Composer = require('../../../shared/code-capability-fabric/declarative-blueprint-composer-v1');

const root = __dirname;
const readJson = (name) => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');

const requiredFiles = [
  'README.md',
  'AUDIT_FINDINGS.json',
  'CAPABILITY_GAP_REPORT.json',
  'CURATION_RECEIPT.json',
  'EVIDENCE_ROUTE.json',
  'INTEGRATION_HANDOFF.json',
  'SCOUT_INVENTORY_AFTER.json',
  'SCOUT_INVENTORY_BEFORE.json',
  'SCOUT_REQUIREMENTS.json',
  'SESSION_EVENTS.jsonl',
  'SESSION_SEAL.json',
  'SESSION_SUMMARY.md',
  'VERIFICATION_RECEIPT.json',
  'axm-fabric-creation-pilot-blueprint-trial-001/capability-blueprint.json',
  'axm-fabric-creation-pilot-blueprint-trial-001/composition-receipt.json'
];
for (const file of requiredFiles) assert.ok(fs.existsSync(path.join(root, file)), file);

const requirements = readJson('SCOUT_REQUIREMENTS.json');
const before = readJson('SCOUT_INVENTORY_BEFORE.json');
const after = readJson('SCOUT_INVENTORY_AFTER.json');
const requiredCapabilities = requirements.requirements.filter((item) => item.required).flatMap((item) => item.capabilities);
const beforeMap = new Map(before.capabilities.map((item) => [item.id, item]));
const afterMap = new Map(after.capabilities.map((item) => [item.id, item]));
assert.ok(requiredCapabilities.some((id) => beforeMap.get(id).status === 'unavailable'));
assert.ok(requiredCapabilities.every((id) => afterMap.get(id).status === 'available'));
assert.strictEqual(afterMap.get('creation.blueprint-to-code.provider').status, 'unavailable');

const input = Composer.buildExampleInput();
const trialRoot = path.join(root, 'axm-fabric-creation-pilot-blueprint-trial-001');
const blueprintBytes = fs.readFileSync(path.join(trialRoot, Composer.BLUEPRINT_FILE));
const trialReceipt = JSON.parse(fs.readFileSync(path.join(trialRoot, Composer.RECEIPT_FILE), 'utf8'));
const verified = Composer.verifyReceiptArtifacts(trialReceipt, blueprintBytes, input.intent);
assert.strictEqual(verified.blueprint.blueprintDigest, 'sha256:89dec506c5d2e65994b599baa42b618340348202538ca715e8e0dae88e849c39');
assert.strictEqual(trialReceipt.artifactFiles[0].sha256, 'sha256:1dc69083eba6665d274c39319512f1bc09c40ba41fdae562f6a99c8dccd43697');
assert.strictEqual(trialReceipt.receiptDigest, 'sha256:2e7dad244e19052a25b69ba18f827e22f8446ac38d77be7d0a1a593a59742e21');
assert.strictEqual(blueprintBytes.length, 6279);
assert.strictEqual(fs.statSync(path.join(trialRoot, Composer.RECEIPT_FILE)).size, 4005);
assert.strictEqual(verified.blueprint.composition.steps.length, 4);
assert.strictEqual(verified.blueprint.acceptancePlan.length, 7);
assert.ok(verified.blueprint.desiredOutcomes.every((item) => item.status === 'UNPROVEN'));
assert.strictEqual(trialReceipt.truth.candidateCodeExecuted, false);
assert.strictEqual(trialReceipt.truth.machineDefaultActivated, false);
assert.strictEqual(trialReceipt.truth.persistentLearningAdmitted, false);
assert.deepStrictEqual(fs.readdirSync(trialRoot).sort(), [Composer.BLUEPRINT_FILE, Composer.RECEIPT_FILE].sort());

const sessionBytes = fs.readFileSync(path.join(root, 'SESSION_EVENTS.jsonl'));
const sessionSeal = readJson('SESSION_SEAL.json');
assert.strictEqual(sessionSeal.parseStatus, 'valid');
assert.strictEqual(sessionSeal.sha256, sha256(sessionBytes));
assert.strictEqual(sessionSeal.eventLines, 13);
assert.strictEqual(sessionSeal.invalidJsonLines, 0);

const verification = readJson('VERIFICATION_RECEIPT.json');
assert.strictEqual(verification.requiredChecks.length, 10);
assert.ok(verification.requiredChecks.every((item) => item.status === 'PASS'));
assert.ok(verification.focusedChecks.every((item) => item.status === 'PASS'));
assert.strictEqual(verification.summary.warningObserved, 41);
assert.strictEqual(verification.summary.warningDelta, 0);
assert.strictEqual(verification.browser.status, 'NOT_RUN');
assert.strictEqual(verification.truth.semanticCodeGenerated, false);
assert.strictEqual(verification.truth.mergePerformed, false);
assert.strictEqual(verification.truth.canonChanged, false);

const routes = readJson('EVIDENCE_ROUTE.json');
assert.strictEqual(routes.claims.find((item) => item.id === 'deterministic-blueprint').verdict, 'PASS');
assert.strictEqual(routes.claims.find((item) => item.id === 'semantic-code-generation').verdict, 'UNKNOWN_NOT_IMPLEMENTED');
assert.strictEqual(routes.claims.find((item) => item.id === 'machine-default').verdict, 'FALSE_NOT_ACTIVATED');

const gaps = readJson('CAPABILITY_GAP_REPORT.json');
assert.strictEqual(gaps.status, 'DEGRADED');
assert.strictEqual(gaps.boundedRoute.status, 'READY');
assert.strictEqual(gaps.generalSemanticCodeRoute.status, 'BLOCKED');

const handoff = readJson('INTEGRATION_HANDOFF.json');
assert.strictEqual(handoff.source.branch, 'codex/code-capability-fabric-blueprint-composition-v2.0');
assert.strictEqual(handoff.source.priorReceiptTip, 'ffee40c2f3c326967e72881a5e15232aa89a3c42');
assert.strictEqual(handoff.observedCanonicalCheckout.dirty, true);
assert.strictEqual(handoff.observedCanonicalCheckout.taskRelevantStatusEntries, 0);
assert.strictEqual(handoff.observedCanonicalCheckout.containsPriorReceiptTip, false);
assert.strictEqual(handoff.authority.mergePerformed, false);
assert.strictEqual(handoff.authority.canonicalCheckoutModified, false);
assert.strictEqual(handoff.authority.canonChanged, false);
assert.ok(handoff.exactSafeReviewWorktreeCommandsFromCanonicalRepository.every((item) => item.startsWith('git')));

const evidenceText = requiredFiles
  .filter((file) => !file.startsWith('axm-fabric-creation-pilot-blueprint-trial-001/'))
  .map((file) => fs.readFileSync(path.join(root, file), 'utf8'))
  .join('\n');
assert.strictEqual(/[A-Za-z]:[\\/](?:Users|AXM_ACTIVE|CODEX_WORKTREES)/i.test(evidenceText), false);
assert.strictEqual(/bridge-token|authorization\s*:\s*bearer|private key|workshop\.log/i.test(evidenceText), false);

process.stdout.write('Code Capability Fabric blueprint-composition receipt self-test: PASS\n');
