'use strict';

const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const REVIEW_ROOT = path.join(ROOT, 'state', 'review-copies');

function digest(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function normalized(relativePath) {
  return String(relativePath || '').replace(/\\/g, '/').replace(/^\.\//, '');
}

function refusedPath(relativePath) {
  const file = normalized(relativePath);
  const lower = file.toLowerCase();
  return !file || file.startsWith('../') || path.isAbsolute(file) ||
    lower === '.git' || lower.startsWith('.git/') ||
    lower === 'state' || lower.startsWith('state/') ||
    lower === 'logs' || lower.startsWith('logs/') ||
    lower === 'memory/private' || lower.startsWith('memory/private/') ||
    lower === 'models/checkpoints' || lower.startsWith('models/checkpoints/') ||
    lower === 'training/datasets' || lower.startsWith('training/datasets/') ||
    lower === 'training/candidates' || lower.startsWith('training/candidates/') ||
    /^config\/.*\.local\.json$/i.test(file) ||
    /\.(token|key|secret)$/i.test(file);
}

function gitVisibleFiles(root = ROOT) {
  const output = childProcess.execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: root, encoding: 'buffer', windowsHide: true });
  return output.toString('utf8').split('\0').map(normalized).filter(Boolean).sort();
}

function copyListedFiles(sourceRoot, destinationRoot, files) {
  const source = path.resolve(sourceRoot);
  const destination = path.resolve(destinationRoot);
  const copied = [];
  const refused = [];
  for (const relativePath of Array.from(new Set(files.map(normalized))).sort()) {
    if (refusedPath(relativePath)) { refused.push({ path: relativePath, reason: 'PRIVATE_OR_UNSAFE_PATH_CLASS' }); continue; }
    const sourceFile = path.resolve(source, relativePath);
    const relation = path.relative(source, sourceFile);
    if (!relation || relation.startsWith(`..${path.sep}`) || path.isAbsolute(relation)) { refused.push({ path: relativePath, reason: 'OUTSIDE_SOURCE_ROOT' }); continue; }
    let stat;
    try { stat = fs.lstatSync(sourceFile); } catch (_) { refused.push({ path: relativePath, reason: 'SOURCE_MISSING' }); continue; }
    if (!stat.isFile() || stat.isSymbolicLink()) { refused.push({ path: relativePath, reason: 'NOT_REGULAR_FILE_OR_SYMBOLIC' }); continue; }
    const bytes = fs.readFileSync(sourceFile);
    const target = path.resolve(destination, relativePath);
    const targetRelation = path.relative(destination, target);
    if (!targetRelation || targetRelation.startsWith(`..${path.sep}`) || path.isAbsolute(targetRelation)) throw new Error('review copy target escaped destination');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, bytes, { flag: 'wx' });
    copied.push({ path: relativePath, bytes: bytes.length, sha256: digest(bytes) });
  }
  return { copied, refused };
}

function run(options = {}) {
  const id = options.id || `mirror-review-${new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14)}`;
  if (!/^mirror-review-[0-9A-Za-z._-]+$/.test(id)) throw new Error('review copy ID is unsafe');
  const destination = path.resolve(REVIEW_ROOT, id);
  const relation = path.relative(REVIEW_ROOT, destination);
  if (!relation || relation.startsWith(`..${path.sep}`) || path.isAbsolute(relation) || fs.existsSync(destination)) throw new Error('review copy destination must be a new child of state/review-copies');
  fs.mkdirSync(destination, { recursive: true });
  const files = gitVisibleFiles(ROOT);
  const result = copyListedFiles(ROOT, destination, files);
  const manifest = {
    schema: 'axm.mirror.safe-review-copy/v1',
    id,
    sourceRoot: ROOT,
    destination,
    selection: 'git tracked plus untracked nonignored files, followed by explicit private-path refusal',
    copiedFiles: result.copied.length,
    copiedBytes: result.copied.reduce((sum, item) => sum + item.bytes, 0),
    refusedFiles: result.refused,
    files: result.copied,
    boundary: 'This review copy excludes ignored/private state, logs, private memory, datasets, checkpoints, local config, and token/key/secret extensions. It is a source-review surface, not a complete machine-state backup.'
  };
  manifest.manifestDigest = digest(Buffer.from(JSON.stringify(manifest), 'utf8'));
  fs.writeFileSync(path.join(destination, 'REVIEW_COPY_MANIFEST.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
  console.log(`Safe review copy: ${destination}`);
  console.log(`Files: ${manifest.copiedFiles}; bytes: ${manifest.copiedBytes}; explicitly refused: ${manifest.refusedFiles.length}`);
  return manifest;
}

if (require.main === module) {
  try { run({ id: process.argv[2] }); } catch (error) { console.error(`REFUSED: ${error.message}`); process.exitCode = 1; }
}

module.exports = { ROOT, REVIEW_ROOT, digest, normalized, refusedPath, gitVisibleFiles, copyListedFiles, run };
