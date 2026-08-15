'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const ReviewCell = require('../kernel/code-story-innovation-review-cell');
const ImmutableStore = require('../kernel/immutable-batch-store');

const ORGAN_ID = 'axm.mirror.organ/code-story-innovation-review-v1';
const ROOT = path.resolve(__dirname, '..');
const DEFAULT_SUBJECT_PATH = path.join(ROOT, 'lineage', 'code-story-innovation-review-subject-v1.json');
const DEFAULT_REVIEW_ROOT = path.join(ROOT, 'state', 'code-story-innovation-reviews');

function json(value) { return `${JSON.stringify(ReviewCell.stable(value), null, 2)}\n`; }
function relativePath(root, target, label) {
  const base = path.resolve(root);
  const absolute = path.resolve(target);
  const relative = path.relative(base, absolute);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error(`${label} must be a child of the configured Mirror root`);
  return relative.split(path.sep).join('/');
}
function realFile(root, relative, label) {
  const base = path.resolve(root);
  const absolute = path.resolve(base, relative);
  if (relativePath(base, absolute, label) !== String(relative).replace(/\\/g, '/')) throw new Error(`${label} path is not normalized inside Mirror`);
  const stat = fs.lstatSync(absolute);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`${label} must be a real file`);
  return absolute;
}
function realDirectory(directory, label, create = false) {
  const absolute = path.resolve(directory);
  if (create) fs.mkdirSync(absolute, { recursive: true });
  const stat = fs.lstatSync(absolute);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`${label} must be a real directory`);
  return absolute;
}
function readJsonFile(absolute, label) {
  const bytes = fs.readFileSync(absolute);
  let value;
  try { value = JSON.parse(bytes.toString('utf8')); } catch (error) { throw new Error(`${label} is not valid JSON: ${error.message}`); }
  return { bytes, value };
}

function loadPacket(options = {}) {
  const root = realDirectory(options.root || ROOT, 'Mirror root');
  const subjectPath = path.resolve(options.subjectPath || path.join(root, 'lineage', 'code-story-innovation-review-subject-v1.json'));
  relativePath(root, subjectPath, 'review subject');
  const subjectLoaded = readJsonFile(realFile(root, relativePath(root, subjectPath, 'review subject'), 'review subject'), 'review subject');
  ReviewCell.verifySubject(subjectLoaded.value);
  const sources = {};
  for (const [name, binding] of Object.entries(subjectLoaded.value.sourceBindings)) {
    const absolute = realFile(root, binding.path, `${name} review source`);
    const bytes = fs.readFileSync(absolute);
    const common = { path: binding.path, sha256: ReviewCell.digest(bytes) };
    if (name === 'harness') sources[name] = Object.assign(common, { text: bytes.toString('utf8') });
    else {
      let value;
      try { value = JSON.parse(bytes.toString('utf8')); } catch (error) { throw new Error(`${name} review source is not valid JSON: ${error.message}`); }
      sources[name] = Object.assign(common, { value });
    }
  }
  const packet = ReviewCell.buildPacket({ subject: subjectLoaded.value, sources });
  ReviewCell.verifyPacket(packet, { subject: subjectLoaded.value, sources });
  return { packet, subject: subjectLoaded.value, sources, subjectPath };
}

function storeReceipt(receipt, options = {}) {
  ReviewCell.verifyReceipt(receipt);
  const reviewRoot = realDirectory(options.reviewRoot || DEFAULT_REVIEW_ROOT, 'Code Story innovation review root', true);
  const kind = receipt.review.kind.toLowerCase();
  const parent = path.join(reviewRoot, receipt.source.packetId, kind);
  fs.mkdirSync(parent, { recursive: true });
  realDirectory(parent, 'Code Story innovation review kind root');
  const final = path.join(parent, receipt.receiptId);
  const stage = path.join(parent, `.${receipt.receiptId}-${process.pid}-${crypto.randomBytes(4).toString('hex')}`);
  fs.mkdirSync(stage);
  fs.writeFileSync(path.join(stage, 'receipt.json'), json(receipt), { flag: 'wx' });
  const commit = ImmutableStore.commitDirectory(stage, final);
  return { reused: commit.reused, runDir: commit.runDir, receiptPath: path.join(commit.runDir, 'receipt.json'), commitState: commit.state };
}

function recordReview(input = {}, options = {}) {
  const loaded = loadPacket(options);
  if (input.packetId !== loaded.packet.packetId || input.packetDigest !== loaded.packet.packetDigest) throw new Error('Code Story innovation review state changed; refresh before recording a judgment');
  const receipt = ReviewCell.buildReceipt(loaded.packet, input);
  const stored = storeReceipt(receipt, options);
  ReviewCell.verifyReceipt(receipt, loaded.packet);
  return {
    state: receipt.state,
    packet: loaded.packet,
    receipt,
    reused: stored.reused,
    receiptPath: stored.receiptPath,
    authority: receipt.authority
  };
}

function receiptFiles(root) {
  if (!fs.existsSync(root)) return [];
  realDirectory(root, 'Code Story innovation review packet root');
  const files = [];
  for (const kindEntry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!kindEntry.isDirectory() || kindEntry.isSymbolicLink() || !['coherence', 'usefulness'].includes(kindEntry.name)) continue;
    const kindRoot = path.join(root, kindEntry.name);
    for (const receiptEntry of fs.readdirSync(kindRoot, { withFileTypes: true })) {
      if (!receiptEntry.isDirectory() || receiptEntry.isSymbolicLink() || !/^code-story-(?:coherence|usefulness)-review-[a-f0-9]{24}$/.test(receiptEntry.name)) continue;
      const receiptPath = path.join(kindRoot, receiptEntry.name, 'receipt.json');
      if (!fs.existsSync(receiptPath)) continue;
      const stat = fs.lstatSync(receiptPath);
      if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Code Story innovation review receipt must be a real file: ${receiptPath}`);
      files.push(receiptPath);
    }
  }
  return files;
}

function loadReceipts(packet, options = {}) {
  const reviewRoot = path.resolve(options.reviewRoot || DEFAULT_REVIEW_ROOT);
  const packetRoot = path.join(reviewRoot, packet.packetId);
  const receipts = receiptFiles(packetRoot).map(receiptPath => {
    const receipt = readJsonFile(receiptPath, 'Code Story innovation review receipt').value;
    ReviewCell.verifyReceipt(receipt, packet);
    return receipt;
  }).sort((left, right) => left.review.reviewedAt.localeCompare(right.review.reviewedAt) || left.receiptId.localeCompare(right.receiptId));
  return receipts;
}

function status(options = {}) {
  try {
    const loaded = loadPacket(options);
    const receipts = loadReceipts(loaded.packet, options);
    const latest = { COHERENCE: null, USEFULNESS: null };
    for (const receipt of receipts) latest[receipt.review.kind] = receipt;
    const approved = kind => latest[kind] && latest[kind].review.decision === 'APPROVE_SYNTHETIC_MECHANICS_ONLY';
    const held = kind => latest[kind] && latest[kind].review.decision === 'HOLD_FOR_REVIEW';
    let state = 'WAITING_FOR_SEPARATE_DECLARED_HUMAN_JUDGMENTS';
    if (held('COHERENCE') || held('USEFULNESS')) state = 'DECLARED_HUMAN_HOLD_RECORDED_SYNTHETIC_SUBJECT_UNCHANGED';
    else if (approved('COHERENCE') && approved('USEFULNESS')) state = 'SYNTHETIC_HUMAN_REVIEW_MECHANICS_COMPLETE_REAL_INNOVATION_QUALITY_UNPROVEN';
    else if (approved('COHERENCE') || approved('USEFULNESS')) state = 'ONE_OF_TWO_SYNTHETIC_HUMAN_REVIEW_RECEIPTS_RECORDED';
    return {
      available: true,
      organId: ORGAN_ID,
      state,
      packet: loaded.packet,
      latest,
      receiptCount: receipts.length,
      humanReviewHand: 'AVAILABLE_USER_ACTION',
      innovationQualityProof: 'BLOCKED',
      futureCodeMirror: 'BLOCKED',
      nextGate: approved('COHERENCE') && approved('USEFULNESS') ? 'REAL_PERMISSIONED_CODE_STORY_EVIDENCE_AND_SEPARATE_ADMISSION_REVIEW' : 'DECLARED_HUMAN_MAY_REVIEW_OR_HOLD_EACH_QUESTION_SEPARATELY',
      authority: loaded.packet.authority,
      boundary: loaded.packet.claimCeiling
    };
  } catch (error) {
    return {
      available: false,
      organId: ORGAN_ID,
      state: 'SOURCE_OR_RECEIPT_HOLD',
      error: error.message,
      humanReviewHand: 'HELD',
      innovationQualityProof: 'BLOCKED',
      futureCodeMirror: 'BLOCKED'
    };
  }
}

module.exports = { ORGAN_ID, ROOT, DEFAULT_SUBJECT_PATH, DEFAULT_REVIEW_ROOT, loadPacket, storeReceipt, recordReview, loadReceipts, status };
