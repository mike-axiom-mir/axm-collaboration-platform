'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const WorkshopRoot = require('../config/workshop-root');
const ImmutableStore = require('../kernel/immutable-batch-store');

const ROOT = path.resolve(__dirname, '..');
const ORGAN_ID = 'axm.mirror.sensorium-pack-intake-organ/v3';
const RECEIPT_SCHEMA = 'axm.mirror.sensorium-pack-intake-receipt/v3';
const PACK_RELATIVE = path.join('tools', 'agent-tool-forge', 'skills', 'sensorium');
const DEFAULT_STATE_DIR = path.join(ROOT, 'state', 'sensorium-pack-intake-runs');
const MAX_FILE_BYTES = 1024 * 1024;
const MAX_PACK_BYTES = 16 * 1024 * 1024;
const PACK_VERSION = '1.4.0';
const PACK_STATUS = 'TEST';
const CARD_PACK = `axm-sensorium/${PACK_VERSION}`;
const SKILL_IDS = [
  'compaction-steward',
  'corroboration-triangulator',
  'drift-detector-ambient',
  'ears-stream-listener',
  'eye-accessibility-inspector',
  'eye-change-differ',
  'eye-live-visual-verifier',
  'eye-static-image-inspector',
  'handoff-continuity-steward',
  'interoception-capacity-gauge',
  'taint-sniffer',
  'time-sense-ttl-verifier',
  'touch-environment-probe'
];
const REQUIRED_SHARED_CEILINGS = [
  'No authority inheritance.',
  'No raw sense material after seal.',
  'No automatic action or promotion.',
  'UNKNOWN remains visible.'
];
const PACK_SUPPORT_FILES = ['sensorium.index.json', 'host-metadata.json', 'bundle.manifest.json', 'README.md', 'HANDOFF_TO_CODEX.md'];
const PACK_FILES = PACK_SUPPORT_FILES.concat(SKILL_IDS.flatMap(id => [`${id}.skill.json`, `${id}.SKILL.md`]));

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.keys(value).sort().reduce((out, key) => { out[key] = stable(value[key]); return out; }, {});
  return value;
}
function same(left, right) { return JSON.stringify(stable(left)) === JSON.stringify(stable(right)); }
function digest(value) { return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex'); }
function sha(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex'); }
function exactKeys(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !same(Object.keys(value).sort(), keys.slice().sort())) throw new Error(`${label} fields changed`);
}
function ensureRealDirectory(directory, label) {
  const target = path.resolve(directory);
  const stat = fs.lstatSync(target);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`${label} must be a real directory`);
  return target;
}
function readBounded(root, relative) {
  const file = path.resolve(root, relative);
  if (!file.startsWith(path.resolve(root) + path.sep)) throw new Error(`sensorium path escaped its pack root: ${relative}`);
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_FILE_BYTES) throw new Error(`sensorium source is not a bounded real file: ${relative}`);
  const bytes = fs.readFileSync(file);
  return { relative: relative.replace(/\\/g, '/'), file, bytes, size: bytes.length, sha256: sha(bytes), text: bytes.toString('utf8') };
}
function parseJson(file, label) {
  const value = JSON.parse(file.text);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be a JSON object`);
  return value;
}
function markdownFrontmatter(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(text);
  if (!match) return {};
  const out = {};
  for (const line of match[1].split(/\r?\n/)) {
    const index = line.indexOf(':');
    if (index > 0) out[line.slice(0, index).trim()] = line.slice(index + 1).trim();
  }
  return out;
}
function finding(code, severity, skillId, statement) { return { code, severity, skillId: skillId || null, statement }; }
function authority() {
  return {
    workshopRead: true,
    privateReceiptWrite: true,
    workshopWrite: false,
    skillExecution: false,
    sensoryCapture: false,
    rawSenseRetention: false,
    externalCodeExecution: false,
    accessGrant: false,
    evidenceAdmission: false,
    trainingAdmission: false,
    organInstall: false,
    runtimePromotion: false,
    canonChange: false,
    worldAction: false
  };
}
function inspect(options = {}) {
  const packRoot = ensureRealDirectory(options.packRoot || path.join(options.workshopRoot, PACK_RELATIVE), 'sensorium pack root');
  const fileNames = PACK_FILES;
  const files = fileNames.map(name => readBounded(packRoot, name));
  const totalBytes = files.reduce((sum, item) => sum + item.size, 0);
  if (totalBytes > MAX_PACK_BYTES) throw new Error('sensorium pack exceeds its byte bound');
  const byName = new Map(files.map(item => [item.relative, item]));
  const index = parseJson(byName.get('sensorium.index.json'), 'sensorium index');
  const hostMetadata = parseJson(byName.get('host-metadata.json'), 'sensorium host metadata');
  const bundle = parseJson(byName.get('bundle.manifest.json'), 'sensorium bundle manifest');
  if (index.schema !== 'axm.skill-pack/v1' || index.pack !== 'axm-sensorium' || index.version !== PACK_VERSION || index.status !== PACK_STATUS) throw new Error('sensorium index identity changed');
  if (!Array.isArray(index.skills) || !same(index.skills.map(item => item.id).sort(), SKILL_IDS)) throw new Error('sensorium index skill set changed');
  if (!index.retention_law || !/EPHEMERAL BY DEFAULT/.test(String(index.retention_law.law)) || index.retention_law.raw_retained_after_step !== 'zero') throw new Error('sensorium retention law changed');
  if (!Array.isArray(index.shared_ceilings) || !same(index.shared_ceilings.slice().sort(), REQUIRED_SHARED_CEILINGS.slice().sort())) throw new Error('sensorium shared ceilings changed');
  if (hostMetadata.schema !== 'axm.sensorium-host-metadata/v1' || hostMetadata.version !== PACK_VERSION || !Array.isArray(hostMetadata.capabilities) || !same(hostMetadata.capabilities.map(item => item.id).sort(), SKILL_IDS)) throw new Error('sensorium host metadata identity changed');
  if (bundle.schema !== 'axm.sensorium-bundle-manifest/v1' || bundle.version !== PACK_VERSION || !/^[a-f0-9]{64}$/.test(String(bundle.sourceDigest || '')) || !same((bundle.generatedArtifacts || []).slice().sort(), PACK_FILES.slice().sort())) throw new Error('sensorium bundle manifest identity changed');
  if (!same(bundle.publicSafety, { localPaths: false, machineState: false, rawCaptures: false, receipts: false, tokens: false })) throw new Error('sensorium public bundle boundary changed');
  const findings = [];
  const skills = [];
  const receiptSchemas = new Set();
  for (const id of SKILL_IDS) {
    const jsonFile = byName.get(`${id}.skill.json`);
    const markdownFile = byName.get(`${id}.SKILL.md`);
    const card = parseJson(jsonFile, `${id} card`);
    const frontmatter = markdownFrontmatter(markdownFile.text);
    const indexCard = index.skills.find(item => item.id === id);
    const hostCard = hostMetadata.capabilities.find(item => item.id === id);
    if (card.schema !== 'axm.sensorium-skill/v1' || card.id !== id || card.type !== 'skill' || card.pack !== CARD_PACK || card.status !== 'ACCEPT_FOR_TEST' || card.authorityInherited !== false || card.promotionGate !== 'Mike') findings.push(finding('CARD_IDENTITY_MISMATCH', 'BLOCKING', id, 'The JSON card identity, type, pack, status, or non-authority boundary changed.'));
    if (!indexCard || indexCard.status !== card.status || indexCard.sense !== card.sense) findings.push(finding('INDEX_CARD_MISMATCH', 'BLOCKING', id, 'The generated index does not match the JSON card sense and status.'));
    if (!hostCard || hostCard.capability !== card.capability || hostCard.routeType !== (card.runtime && card.runtime.routeType)) findings.push(finding('HOST_ROUTE_CARD_MISMATCH', 'BLOCKING', id, 'The host metadata route does not match the JSON card capability and route type.'));
    if (frontmatter.name !== id || frontmatter.pack !== CARD_PACK || frontmatter.status !== card.status || frontmatter.sense !== card.sense || frontmatter.capability !== card.capability) findings.push(finding('DUAL_FORM_FRONTMATTER_MISMATCH', 'BLOCKING', id, 'The Markdown frontmatter does not match the JSON card identity, pack, sense, capability, and status.'));
    const retention = card.retention;
    if (!retention || typeof retention !== 'object') findings.push(finding('RETENTION_BLOCK_ABSENT', 'BLOCKING', id, 'The skill lacks a machine-readable retention block.'));
    const retentionDeclarationPass = !!(retention && same(retention, index.retention_law) && /EPHEMERAL BY DEFAULT/.test(String(retention.law)) && retention.raw_retained_after_step === 'zero' && /flat and zero/i.test(String(retention.accumulation_across_uses)) && /exact id or path/i.test(String(retention.deletion_scope)) && /never a wildcard/i.test(String(retention.deletion_scope)));
    if (!retentionDeclarationPass) findings.push(finding('RETENTION_DECLARATION_INCOMPLETE', 'BLOCKING', id, 'The retention block does not exactly match the pack law, zero retained raw material, flat accumulation, and exact deletion scope.'));
    if (!/ephemeral by default/i.test(markdownFile.text) || !/authority|permission|read-only|never judges|never discards/i.test(markdownFile.text)) findings.push(finding('MARKDOWN_RETENTION_OR_AUTHORITY_BOUNDARY_ABSENT', 'BLOCKING', id, 'The portable Markdown twin does not carry both retention and non-authority boundaries.'));
    const receiptSchema = card.receipt && card.receipt.schema;
    const receiptEnvelopeSchema = card.receipt && card.receipt.envelopeSchema;
    if (!receiptSchema || receiptEnvelopeSchema !== 'axm.sensorium-receipt/v1') findings.push(finding('TYPED_RECEIPT_DECLARATION_ABSENT', 'BLOCKING', id, 'The skill does not declare both a specific typed receipt and the common Sensorium envelope.'));
    else if (receiptSchemas.has(receiptSchema)) findings.push(finding('DUPLICATE_RECEIPT_SCHEMA', 'BLOCKING', id, `Receipt schema ${receiptSchema} is reused by another skill.`));
    else receiptSchemas.add(receiptSchema);
    const cap = String(retention && retention.receipt_cap || '');
    const boundedHotCap = /newest\s+\d+/i.test(cap) || /oldest\s+(?:is\s+)?dropped/i.test(cap);
    const declaredArchiveRoute = /cold|archive/i.test(cap) && /digest/i.test(cap) && /retriev/i.test(cap);
    if (boundedHotCap && !declaredArchiveRoute) findings.push(finding('HOT_RECEIPT_EVICTION_HAS_NO_DECLARED_ARCHIVE_ROUTE', 'BLOCKING', id, 'The card caps the hot receipt store but does not bind evicted receipts to the pack\'s digest-checked cold archive and retrieval route.'));
    skills.push({
      id,
      sense: card.sense,
      status: card.status,
      routeType: card.runtime && card.runtime.routeType || null,
      selfReportedExecutorStatus: card.statuses && card.statuses.executorStatus || null,
      selfReportedProofStatus: card.statuses && card.statuses.proofStatus || null,
      jsonSha256: jsonFile.sha256,
      markdownSha256: markdownFile.sha256,
      receiptSchema: receiptSchema || null,
      receiptEnvelopeSchema: receiptEnvelopeSchema || null,
      retentionDeclarationPass,
      rawMaterial: retention && retention.raw_material || null,
      releasePoint: retention && retention.released_when || null,
      survivingRecord: retention && retention.survives || null,
      receiptCap: cap || null,
      executableImplementationObservedByIntake: false,
      runtimeFlatRawRetentionVerdict: 'UNTESTED_BY_READ_ONLY_INTAKE'
    });
  }
  const blocking = findings.filter(item => item.severity === 'BLOCKING');
  const state = blocking.some(item => item.code === 'HOT_RECEIPT_EVICTION_HAS_NO_DECLARED_ARCHIVE_ROUTE')
    ? 'HOLD_RECEIPT_ARCHIVE_ROUTE_UNDECLARED'
    : blocking.length
      ? 'HOLD_SENSORIUM_PACK_CONTRACT_INVALID'
      : 'STATIC_SENSORIUM_PACK_ACCEPTED_FOR_RUNTIME_TEST';
  const recordedAt = String(options.recordedAt || new Date().toISOString());
  const receipt = {
    schema: RECEIPT_SCHEMA,
    receiptId: null,
    receiptDigest: null,
    recordedAt,
    organ: { id: ORGAN_ID, status: 'TEST', learnedWeights: false, claimCeiling: 'READ_ONLY_STATIC_SENSORIUM_DECLARATION_AND_RETENTION_CONTRADICTION_INTAKE' },
    source: {
      packRoot: PACK_RELATIVE.replace(/\\/g, '/'),
      pack: index.pack,
      version: index.version,
      status: index.status,
      indexSha256: byName.get('sensorium.index.json').sha256,
      hostMetadataSha256: byName.get('host-metadata.json').sha256,
      bundleManifestSha256: byName.get('bundle.manifest.json').sha256,
      readmeSha256: byName.get('README.md').sha256,
      handoffSha256: byName.get('HANDOFF_TO_CODEX.md').sha256,
      sourceDigest: bundle.sourceDigest,
      files: files.map(item => ({ path: item.relative, bytes: item.size, sha256: item.sha256 })).sort((left, right) => left.path.localeCompare(right.path)),
      totalBytes
    },
    retentionLaw: {
      law: index.retention_law.law,
      rawMaterial: index.retention_law.raw_material,
      releasedWhen: index.retention_law.released_when,
      survives: index.retention_law.survives,
      rawRetainedAfterStep: index.retention_law.raw_retained_after_step,
      accumulationAcrossUses: index.retention_law.accumulation_across_uses,
      receiptCap: index.retention_law.receipt_cap,
      deletionScope: index.retention_law.deletion_scope
    },
    skills,
    findings: findings.sort((left, right) => left.code.localeCompare(right.code) || String(left.skillId).localeCompare(String(right.skillId))),
    metrics: {
      declaredSkills: skills.length,
      staticRetentionDeclarationsPassed: skills.filter(item => item.retentionDeclarationPass).length,
      declaredWorkingSkills: skills.filter(item => item.status === 'WORKING').length,
      declaredAcceptForTestSkills: skills.filter(item => item.status === 'ACCEPT_FOR_TEST').length,
      declaredExecutableSkills: skills.filter(item => item.routeType === 'EXECUTABLE').length,
      declaredHostMediatedSkills: skills.filter(item => item.routeType === 'HOST_MEDIATED').length,
      executableSkillsRunByIntake: 0,
      flatRawRetentionRuntimePassesByIntake: 0,
      compositionTestsObservedByIntake: 0,
      blockingFindings: blocking.length,
      advisoryFindings: findings.filter(item => item.severity === 'ADVISORY').length,
      rawSenseFilesCopiedToMirror: 0,
      rawSenseBytesRetainedByMirror: 0,
      workshopWrites: 0,
      externalCodeExecutions: 0,
      accessGrants: 0,
      evidenceAdmissions: 0,
      trainingAdmissions: 0,
      organInstalls: 0,
      runtimePromotions: 0,
      canonChanges: 0,
      worldActions: 0
    },
    state,
    authority: authority(),
    boundary: `This TEST intake reads and hashes the settled Sensorium ${PACK_VERSION} declarations only. It preserves generated card identity, host-route metadata, retention wording, receipt shapes, status ceilings, and contradictions without executing a skill, capturing a sense, copying raw material, granting access, admitting evidence or training, installing an organ, promoting runtime, changing CANON, or acting. Self-reported executor and proof statuses are declarations, not runtime proof produced by this intake.`
  };
  receipt.receiptId = `sensorium-pack-intake-${digest(Object.assign({}, receipt, { receiptId: null, receiptDigest: null })).slice(0, 24)}`;
  receipt.receiptDigest = digest(Object.assign({}, receipt, { receiptDigest: null }));
  return stable(receipt);
}
function verify(receipt, options = {}, runDir) {
  exactKeys(receipt, ['schema', 'receiptId', 'receiptDigest', 'recordedAt', 'organ', 'source', 'retentionLaw', 'skills', 'findings', 'metrics', 'state', 'authority', 'boundary'], 'sensorium intake receipt');
  if (receipt.schema !== RECEIPT_SCHEMA || receipt.organ.id !== ORGAN_ID || receipt.organ.status !== 'TEST' || receipt.organ.learnedWeights !== false || receipt.organ.claimCeiling !== 'READ_ONLY_STATIC_SENSORIUM_DECLARATION_AND_RETENTION_CONTRADICTION_INTAKE') throw new Error('sensorium intake boundary changed');
  if (!same(receipt.authority, authority())) throw new Error('sensorium intake gained authority');
  const zeros = ['executableSkillsRunByIntake', 'flatRawRetentionRuntimePassesByIntake', 'compositionTestsObservedByIntake', 'rawSenseFilesCopiedToMirror', 'rawSenseBytesRetainedByMirror', 'workshopWrites', 'externalCodeExecutions', 'accessGrants', 'evidenceAdmissions', 'trainingAdmissions', 'organInstalls', 'runtimePromotions', 'canonChanges', 'worldActions'];
  if (zeros.some(key => receipt.metrics[key] !== 0)) throw new Error('sensorium intake claim ceiling changed');
  const reconstructed = inspect(Object.assign({}, options, { recordedAt: receipt.recordedAt }));
  if (!same(reconstructed, receipt)) throw new Error('sensorium intake receipt does not replay from the settled pack');
  const expectedId = `sensorium-pack-intake-${digest(Object.assign({}, receipt, { receiptId: null, receiptDigest: null })).slice(0, 24)}`;
  const expectedDigest = digest(Object.assign({}, receipt, { receiptDigest: null }));
  if (receipt.receiptId !== expectedId || receipt.receiptDigest !== expectedDigest) throw new Error('sensorium intake identity changed');
  if (runDir) {
    const disk = JSON.parse(fs.readFileSync(path.join(runDir, 'receipt.json'), 'utf8'));
    if (!same(disk, receipt)) throw new Error('stored sensorium intake receipt changed');
  }
  return true;
}
function record(options = {}) {
  const receipt = inspect(options);
  verify(receipt, options);
  if (options.write === false) return { receipt, written: false, reused: false, runDir: null };
  const root = path.resolve(options.stateDir || DEFAULT_STATE_DIR);
  fs.mkdirSync(root, { recursive: true });
  const stat = fs.lstatSync(root);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('sensorium intake state root must be a real directory');
  const finalDir = path.join(root, receipt.receiptId);
  if (fs.existsSync(finalDir)) {
    const existing = JSON.parse(fs.readFileSync(path.join(finalDir, 'receipt.json'), 'utf8'));
    verify(existing, options, finalDir);
    if (!same(existing, receipt)) throw new Error('sensorium intake immutable identity collision');
    return { receipt: existing, written: false, reused: true, runDir: finalDir };
  }
  const stageDir = path.join(root, `.${receipt.receiptId}-${process.pid}-${Date.now()}`);
  fs.mkdirSync(stageDir);
  fs.writeFileSync(path.join(stageDir, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
  verify(receipt, options, stageDir);
  const commit = ImmutableStore.commitDirectory(stageDir, finalDir);
  return { receipt, written: !commit.reused, reused: commit.reused, runDir: commit.runDir };
}
function intake(options = {}) {
  const resolution = WorkshopRoot.inspect({ workshopRoot: options.workshopRoot, config: options.config, configRoot: ROOT, environment: options.environment, platform: options.platform, homeDirectory: options.homeDirectory });
  if (!resolution.available) return { state: 'HOLD_WORKSHOP_ABSENT', receipt: null, workshopRootResolution: resolution, rawSenseBytesRetainedByMirror: 0, workshopWrites: 0, externalCodeExecutions: 0 };
  const result = record(Object.assign({}, options, { workshopRoot: resolution.root, packRoot: options.packRoot || path.join(resolution.root, PACK_RELATIVE) }));
  return Object.assign(result, { state: result.receipt.state, workshopRootResolution: resolution });
}

module.exports = { ROOT, ORGAN_ID, RECEIPT_SCHEMA, PACK_RELATIVE, DEFAULT_STATE_DIR, MAX_FILE_BYTES, MAX_PACK_BYTES, PACK_VERSION, PACK_STATUS, CARD_PACK, PACK_FILES, SKILL_IDS, REQUIRED_SHARED_CEILINGS, stable, same, digest, authority, inspect, verify, record, intake };
