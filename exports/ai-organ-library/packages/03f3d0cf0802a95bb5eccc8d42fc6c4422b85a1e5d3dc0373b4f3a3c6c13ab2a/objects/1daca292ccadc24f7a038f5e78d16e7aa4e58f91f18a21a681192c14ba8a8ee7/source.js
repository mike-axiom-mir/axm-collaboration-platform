'use strict';

const fs = require('fs');
const path = require('path');
const KeySafeJson = require('../kernel/key-safe-json-transport-cell');
const ReadinessCell = require('../kernel/code-story-coding-readiness-cell');
const InnovationReview = require('./code-story-innovation-review-organ');

const ORGAN_ID = 'axm.mirror.organ/code-story-coding-readiness-v1';
const ROOT = path.resolve(__dirname, '..');
const DEFAULT_SUBJECT_PATH = path.join(ROOT, 'lineage', 'code-story-coding-readiness-subject-v1.json');

function childPath(root, target, label) {
  const base = path.resolve(root);
  const absolute = path.resolve(target);
  const relative = path.relative(base, absolute);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error(`${label} must be a child of the configured Mirror root`);
  return { absolute, relative: relative.split(path.sep).join('/') };
}

function realFile(root, relative, label) {
  if (typeof relative !== 'string' || !relative || relative.includes('\\') || relative.startsWith('/') || relative.includes('..')) throw new Error(`${label} path must be normalized and relative`);
  const resolved = childPath(root, path.join(root, ...relative.split('/')), label);
  if (resolved.relative !== relative) throw new Error(`${label} path changed during resolution`);
  const stat = fs.lstatSync(resolved.absolute);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`${label} must be a real file`);
  return resolved.absolute;
}

function readJson(absolute, label) {
  const bytes = fs.readFileSync(absolute);
  let value;
  try { value = JSON.parse(bytes.toString('utf8')); } catch (error) { throw new Error(`${label} is not valid JSON: ${error.message}`); }
  return { bytes, value };
}

function loadBoundSources(options = {}) {
  const root = path.resolve(options.root || ROOT);
  const rootStat = fs.lstatSync(root);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new Error('Mirror root must be a real directory');
  const subjectTarget = path.resolve(options.subjectPath || path.join(root, 'lineage', 'code-story-coding-readiness-subject-v1.json'));
  const subjectRelative = childPath(root, subjectTarget, 'Code Story coding-readiness subject').relative;
  const loadedSubject = readJson(realFile(root, subjectRelative, 'Code Story coding-readiness subject'), 'Code Story coding-readiness subject');
  const subject = ReadinessCell.validateSubject(loadedSubject.value);
  const sources = {};
  const sourceEvidence = {};
  for (const key of ReadinessCell.SOURCE_KEYS) {
    const binding = subject.sourceBindings[key];
    const loaded = readJson(realFile(root, binding.path, `${key} source`), `${key} source`);
    const observedDigest = KeySafeJson.sha256Bytes(loaded.bytes);
    if (observedDigest !== binding.sha256) throw new Error(`${key} source drifted from the exact coding-readiness subject binding`);
    sources[key] = loaded.value;
    sourceEvidence[key] = { path: binding.path, sha256: observedDigest, bytes: loaded.bytes.length };
  }
  return { root, subject, subjectPath: subjectTarget, subjectFileSha256: KeySafeJson.sha256Bytes(loadedSubject.bytes), sources, sourceEvidence };
}

function assess(options = {}) {
  try {
    const loaded = loadBoundSources(options);
    const humanReview = InnovationReview.status({ root: loaded.root, reviewRoot: options.reviewRoot });
    const assessment = ReadinessCell.assess(loaded.subject, loaded.sources, humanReview);
    ReadinessCell.verifyAssessment(assessment);
    return {
      available: true,
      organId: ORGAN_ID,
      state: assessment.answer.supervisedRealProjectCode === 'NOT_READY'
        ? 'BOUND_SYNTHETIC_LAB_ONLY_PROJECT_CODING_NOT_READY'
        : 'SUPERVISED_PROJECT_CODE_READINESS_REVIEW_REQUIRED',
      assessment,
      sources: loaded.sourceEvidence,
      subjectFileSha256: loaded.subjectFileSha256,
      authority: assessment.authority
    };
  } catch (error) {
    return {
      available: false,
      organId: ORGAN_ID,
      state: 'SOURCE_OR_ASSESSMENT_HOLD',
      error: error.message,
      projectCodeReadiness: 'UNKNOWN',
      authority: Object.assign({ assessBoundEvidence: false }, ReadinessCell.ZERO_AUTHORITY)
    };
  }
}

module.exports = { ORGAN_ID, ROOT, DEFAULT_SUBJECT_PATH, childPath, realFile, readJson, loadBoundSources, assess };
