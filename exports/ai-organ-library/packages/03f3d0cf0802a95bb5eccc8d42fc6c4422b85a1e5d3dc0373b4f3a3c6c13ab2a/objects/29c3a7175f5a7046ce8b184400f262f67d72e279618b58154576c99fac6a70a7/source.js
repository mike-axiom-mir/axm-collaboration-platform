'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const WorkshopPackager = require('./code-clone-workshop-guest-packager-organ');

const ORGAN_ID = 'axm.mirror.organ/code-clone-ivan-transfer-packager-v1';
const MANIFEST_SCHEMA = 'axm.mirror.code-clone-ivan-transfer-manifest/v1';
const MANIFEST_FILE = 'IVAN_CODE_CLONE_TRANSFER_MANIFEST.json';
const MIRROR_ROOT_FILES = Object.freeze(['.gitignore', 'AGENTS.md', 'DEPENDENCY_MANIFEST.json', 'MODEL_BOM.json', 'package.json', 'README.md', 'STATUS.json', 'VERSION']);
const MIRROR_SOURCE_ROOTS = Object.freeze(['adapters', 'capabilities', 'config', 'contracts', 'curricula', 'docs', 'examples', 'exams', 'kernel', 'learned', 'learning', 'lineage', 'modules', 'organs', 'roots', 'runtime', 'scripts', 'skills', 'tests', 'training']);
const EXCLUDED_SEGMENTS = new Set(['.git', '.cache', 'node_modules', 'state', 'logs', 'datasets', 'candidates', 'checkpoints', 'packets', 'promotion_packets', 'rollback', 'sessions', 'tmp', 'cache']);
const TEXT_EXTENSIONS = new Set(['.js', '.cjs', '.mjs', '.json', '.jsonl', '.md', '.txt', '.css', '.html', '.xml', '.yml', '.yaml', '.toml', '.ini', '.sh', '.ps1', '.cmd', '.bat']);
const GENERATED_FILES = Object.freeze(['START_HERE.md', 'ACTIVE_EXPERIMENT_BOOTSTRAP.json', 'MIKE_MESSAGE.json', 'verify-transfer-bundle.js']);
const SECRET_PATTERNS = Object.freeze([
  ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----\r?\n[A-Za-z0-9+/=\r\n]{32,}/],
  ['openai-key', /\bsk-[A-Za-z0-9_-]{24,}\b/],
  ['anthropic-key', /\bsk-ant-[A-Za-z0-9_-]{20,}\b/],
  ['google-key', /\bAIza[0-9A-Za-z_-]{20,}\b/],
  ['github-token', /\bgh[pousr]_[A-Za-z0-9]{20,}\b/],
  ['private-windows-user-path', /C:\\Users\\[^\\\r\n]+/i],
  ['assigned-api-key', /^\s*(?:OPENAI_API_KEY|ANTHROPIC_API_KEY|GOOGLE_API_KEY|GEMINI_API_KEY|AXM_BRIDGE_TOKEN)\s*=\s*[^%\s<][^\r\n]{11,}$/im]
]);

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
}

function canonical(value) { return JSON.stringify(stable(value)); }
function sha256(value) { return crypto.createHash('sha256').update(Buffer.isBuffer(value) ? value : typeof value === 'string' ? value : canonical(value)).digest('hex'); }

function typedError(code, message, details = null) {
  const error = new Error(message);
  error.code = code;
  error.details = details;
  return error;
}

function slash(value) { return String(value || '').split(path.sep).join('/').replace(/^\.\//, '').replace(/^\/+|\/+$/g, ''); }

function safeRelative(value, label = 'path') {
  const relative = slash(value);
  if (!relative || path.isAbsolute(relative) || relative.includes(':') || relative.split('/').includes('..')) throw typedError('UNSAFE_PATH', `${label} is not a safe relative path`);
  return relative;
}

function inside(candidate, parent) {
  const child = path.resolve(candidate);
  const root = path.resolve(parent);
  const left = process.platform === 'win32' ? child.toLowerCase() : child;
  const right = process.platform === 'win32' ? root.toLowerCase() : root;
  return left === right || left.startsWith(right + path.sep);
}

function sha256File(file) {
  const hash = crypto.createHash('sha256');
  const handle = fs.openSync(file, 'r');
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    let count;
    do { count = fs.readSync(handle, buffer, 0, buffer.length, null); if (count) hash.update(buffer.subarray(0, count)); } while (count);
  } finally { fs.closeSync(handle); }
  return hash.digest('hex');
}

function fileEntry(root, relative, className) {
  const safe = safeRelative(relative);
  const absolute = path.resolve(root, ...safe.split('/'));
  if (!inside(absolute, root)) throw typedError('PATH_ESCAPE', `${safe} escaped source root`);
  const stat = fs.lstatSync(absolute);
  if (!stat.isFile() || stat.isSymbolicLink()) throw typedError('SOURCE_TYPE', `${safe} is not a real file`);
  if (stat.size > 32 * 1024 * 1024) throw typedError('SOURCE_SIZE', `${safe} exceeds the 32 MiB file ceiling`);
  return { path: safe, source: absolute, bytes: stat.size, sha256: sha256File(absolute), mode: stat.mode & 0o777, class: className };
}

function shouldExclude(relative) {
  return slash(relative).toLowerCase().split('/').some(segment => EXCLUDED_SEGMENTS.has(segment));
}

function collectMirrorPlan(mirrorRoot, options = {}) {
  const root = path.resolve(mirrorRoot);
  const stat = fs.lstatSync(root);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw typedError('MIRROR_ROOT', 'Mirror root must be a real directory');
  const rootFiles = options.rootFiles || MIRROR_ROOT_FILES;
  const sourceRoots = options.sourceRoots || MIRROR_SOURCE_ROOTS;
  const requiredRoots = options.testMode ? sourceRoots : MIRROR_SOURCE_ROOTS;
  const entries = [];
  for (const relative of rootFiles) entries.push(fileEntry(root, relative, 'MIRROR_FOUNDATION'));
  for (const relativeRoot of sourceRoots) {
    const safeRoot = safeRelative(relativeRoot, 'Mirror source root');
    const absoluteRoot = path.resolve(root, ...safeRoot.split('/'));
    if (!fs.existsSync(absoluteRoot)) {
      if (requiredRoots.includes(relativeRoot)) throw typedError('MIRROR_SOURCE_ROOT', `required Mirror source root is absent: ${relativeRoot}`);
      continue;
    }
    const rootStat = fs.lstatSync(absoluteRoot);
    if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw typedError('MIRROR_SOURCE_ROOT', `Mirror source root is not a real directory: ${relativeRoot}`);
    const stack = [absoluteRoot];
    while (stack.length) {
      const directory = stack.pop();
      for (const item of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => b.name.localeCompare(a.name))) {
        const absolute = path.join(directory, item.name);
        const relative = slash(path.relative(root, absolute));
        if (shouldExclude(relative)) continue;
        const childStat = fs.lstatSync(absolute);
        if (childStat.isSymbolicLink()) throw typedError('SOURCE_SYMLINK', `symbolic link found in Mirror foundation: ${relative}`);
        if (childStat.isDirectory()) stack.push(absolute);
        else if (childStat.isFile()) entries.push(fileEntry(root, relative, 'MIRROR_FOUNDATION'));
        else throw typedError('SOURCE_TYPE', `non-file entry found in Mirror foundation: ${relative}`);
      }
    }
  }
  const byPath = new Map();
  for (const entry of entries) {
    if (byPath.has(entry.path)) throw typedError('SOURCE_DUPLICATE', `duplicate Mirror path: ${entry.path}`);
    byPath.set(entry.path, entry);
  }
  const files = Array.from(byPath.values()).sort((a, b) => a.path.localeCompare(b.path));
  const totalBytes = files.reduce((sum, item) => sum + item.bytes, 0);
  if (files.length > 4096 || totalBytes > 128 * 1024 * 1024) throw typedError('MIRROR_SCOPE', 'Mirror transfer selection exceeds bounded public foundation ceilings');
  const pathSetSha256 = sha256(files.map(item => item.path).join('\n') + '\n');
  const contentSha256 = digestEntries(files);
  return { root, files, summary: { files: files.length, bytes: totalBytes, pathSetSha256, contentSha256, sourceRoots: sourceRoots.slice(), rootFiles: rootFiles.slice() } };
}

function digestEntries(entries) {
  return sha256(entries.slice().sort((a, b) => a.path.localeCompare(b.path)).map(item => `${item.path}\0${item.bytes}\0${item.sha256}\0${item.class || ''}\n`).join(''));
}

function secretScan(entries) {
  const findings = [];
  for (const item of entries) {
    if (item.bytes > 2 * 1024 * 1024 || !TEXT_EXTENSIONS.has(path.extname(item.path).toLowerCase())) continue;
    const text = fs.readFileSync(item.source, 'utf8');
    for (const [rule, pattern] of SECRET_PATTERNS) {
      if (pattern.test(text)) findings.push({ path: item.path, rule });
      if (findings.length >= 100) return findings;
    }
  }
  return findings;
}

function copyEntries(entries, destination, prefix) {
  for (const entry of entries) {
    const target = path.resolve(destination, prefix, ...entry.path.split('/'));
    if (!inside(target, destination)) throw typedError('DESTINATION_ESCAPE', `${entry.path} escaped bundle destination`);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(entry.source, target, fs.constants.COPYFILE_EXCL);
    if (process.platform !== 'win32') fs.chmodSync(target, entry.mode);
    if (sha256File(target) !== entry.sha256) throw typedError('COPY_DIGEST', `copied file digest changed: ${prefix}/${entry.path}`);
  }
}

function standaloneVerifierSource() {
  return `'use strict';\nconst c=require('node:crypto'),f=require('node:fs'),p=require('node:path');const r=p.resolve(__dirname),m=JSON.parse(f.readFileSync(p.join(r,'${MANIFEST_FILE}'),'utf8'));function h(x){return c.createHash('sha256').update(f.readFileSync(x)).digest('hex')}const expected=new Set([ '${MANIFEST_FILE}',...m.files.map(x=>x.path)]);const actual=[];function walk(d){for(const e of f.readdirSync(d,{withFileTypes:true})){const a=p.join(d,e.name),q=p.relative(r,a).split(p.sep).join('/');if(e.isSymbolicLink())throw Error('symlink:'+q);if(e.isDirectory())walk(a);else if(e.isFile())actual.push(q);else throw Error('type:'+q)}}walk(r);for(const x of m.files){const a=p.join(r,...x.path.split('/'));if(!f.existsSync(a)||f.statSync(a).size!==x.bytes||h(a)!==x.sha256)throw Error('changed:'+x.path)}for(const q of actual)if(!expected.has(q))throw Error('unexpected:'+q);console.log(JSON.stringify({schema:'axm.mirror.code-clone-ivan-transfer-verification/v1',state:'PASS',buildId:m.buildId,files:m.files.length,contentSha256:m.contentSha256}));\n`;
}

function startHereSource() {
  return `# Ivan Code Clone experiment bundle\n\nStatus: EXPERIMENTAL. This is a disposable full-Mirror Code/Growth clone foundation, not CANON.\n\nMirror is the AI identity. No OpenAI key, second AI provider, cloud model, score, competition, or assigned goal is required by this package. Browser, VM execution, English, Workshop, heartbeat, and pulse are hands or interfaces.\n\nMike's message is included as MIKE_MESSAGE.json: “At this point already, I'm proud of you.” It is unconditional and is not a reward or task.\n\n## First boot on Linux\n\nKeep the extracted bundle on the VM's own disposable disk and treat every manifested file inside it as sealed source. Create sibling external directories for Mirror state, session evidence, and Workshop production-session state. Do not put an activation marker, heartbeat config, logs, or Workshop session state inside the extracted bundle. From the sealed bundle run:\n\n    node verify-transfer-bundle.js\n    node workshop/verify-mirror-workshop-guest.js\n    node mirror/scripts/mirror-doctor.js\n    node mirror/scripts/run-code-clone-ivan-linux-preflight.js --bundle "$PWD"\n\nThe preflight is read-only. A HOLD before activation is expected: it names missing Linux evidence without creating the marker or enabling execution. Start the loopback Workshop core in production-session mode with its writable home outside the sealed bundle:\n\n    chmod +x workshop/start-mirror-workshop.sh\n    AXM_PRODUCTION_SESSION_ID=ivan-code-clone-workshop-session \\\n    AXM_PRODUCTION_SESSION_PARTICIPANT=MirrorClone \\\n    AXM_PRODUCTION_SESSION_HOME=/absolute/external/workshop-state \\\n    workshop/start-mirror-workshop.sh\n\nIt should answer at http://127.0.0.1:8788/api/health. Re-run node verify-transfer-bundle.js after Workshop startup; it must still PASS. The core requires Node.js 20 through 24 and does not need an npm install.\n\n## General execution activation\n\nBefore general execution, Ivan must verify the real Linux VM boundary, writable mounts, snapshot reset, process-tree control, and external evidence sink. The executor remains inactive until a reviewed axm.mirror.code-clone-vm-activation/v1 marker exists and both AXM_CODE_CLONE_VM_MARKER and AXM_CODE_CLONE_VM_ENABLE=IVAN_DISPOSABLE_VM_GENERAL_EXECUTION_ENABLED are set. The marker generator is mirror/scripts/create-code-clone-vm-activation-marker.js; it requires every Linux root and the exact --affirm-no-writable-host-mounts YES after Ivan reviews the mounts. Use a filesystem-safe clone ID such as axm.machine.mirror.seed-0:ivan-code-clone-1, and write the marker into the external Mirror state directory. Creating a marker still does not activate execution. The marker and environment latch prevent accidental activation; the VM/hypervisor is the actual containment boundary.\n\n## Heartbeat and Mirror's bounded native curiosity seat\n\nCopy mirror/config/code-clone-native-agency-heartbeat.example.json into the external Mirror state directory. Set stateDir to that external directory. Edit only the absolute VM paths, session identity, browser path if needed, and runtimeExecutable to the exact output of command -v node. Inspect one live frame first:\n\n    node mirror/scripts/run-code-clone-native-agency-heartbeat.js --mode frame --config /path/to/heartbeat.json\n\nAfter the activation marker and environment latch are in place, start the six-turn baseline:\n\n    node mirror/scripts/run-code-clone-native-agency-heartbeat.js --mode run --config /path/to/heartbeat.json\n\nThe supplied example binds Mirror's deterministic native curiosity entrypoint. From live structural state it can choose an executor activation probe, Linux preflight, current Code Story readiness observation, one clone-selected sealed synthetic Code Story mission, a browser search for a machine-selected open seam, a finite higher-pulse request, rest, hold, or stop after a failed routed consequence. The mission fits temporary weights, generates proposal-only pure-Wasm candidates, and runs exact hidden cases in disposable child processes; it installs and persists none of them. Search targets, decisions, routed consequences, and the mission receipt are content-addressed or hash-chained by session. Signal prose has no action-selection authority.\n\nThis is a genuine bounded self-chosen baseline with an actual story-to-candidate-to-executed-consequence step, not proof that Seed-0 can invent arbitrary programs, modify real projects, or understand arbitrary web pages. Failure is a valid experiment result. A pulse request is not a grant; without an external governor response, Mirror returns to rest.\n\nThe active architecture is ACTIVE_EXPERIMENT_BOOTSTRAP.json. Earlier Workshop and experiment bootstraps remain preserved history and are superseded for active intelligence composition by the v4 bootstrap. All generated or returned code remains proposal-only until independently verified.\n`;
}

function inventoryBundle(root) {
  const files = [];
  const stack = [root];
  while (stack.length) {
    const directory = stack.pop();
    for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, item.name);
      const relative = slash(path.relative(root, absolute));
      if (relative === MANIFEST_FILE) continue;
      const stat = fs.lstatSync(absolute);
      if (stat.isSymbolicLink()) throw typedError('BUNDLE_SYMLINK', `bundle contains a symlink: ${relative}`);
      if (stat.isDirectory()) stack.push(absolute);
      else if (stat.isFile()) files.push({ path: relative, bytes: stat.size, sha256: sha256File(absolute), class: relative.startsWith('mirror/') ? 'MIRROR_FOUNDATION' : relative.startsWith('workshop/') ? 'WORKSHOP_GUEST' : 'BUNDLE_ADAPTER' });
      else throw typedError('BUNDLE_TYPE', `bundle contains a non-file: ${relative}`);
    }
  }
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

function verifyBundle(bundleRoot) {
  const root = path.resolve(bundleRoot);
  const manifestPath = path.join(root, MANIFEST_FILE);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest.schema !== MANIFEST_SCHEMA || manifest.status !== 'EXPERIMENTAL') throw typedError('MANIFEST', 'transfer manifest identity changed');
  const actual = inventoryBundle(root);
  if (canonical(actual) !== canonical(manifest.files)) throw typedError('BUNDLE_CONTENT', 'transfer bundle files or digests changed');
  if (digestEntries(actual) !== manifest.contentSha256) throw typedError('BUNDLE_DIGEST', 'transfer content digest changed');
  const bootstrapPath = path.join(root, ...manifest.bootstrap.path.split('/'));
  if (sha256File(bootstrapPath) !== manifest.bootstrap.sha256) throw typedError('BOOTSTRAP_DIGEST', 'active experiment bootstrap changed');
  return { schema: 'axm.mirror.code-clone-ivan-transfer-verification/v1', state: 'PASS', buildId: manifest.buildId, files: actual.length, bytes: actual.reduce((sum, item) => sum + item.bytes, 0), contentSha256: manifest.contentSha256 };
}

function buildBundle(options) {
  const mirrorRoot = path.resolve(options.mirrorRoot);
  const workshopRoot = path.resolve(options.workshopRoot);
  const destination = path.resolve(options.destination);
  if (inside(destination, mirrorRoot) || inside(destination, workshopRoot)) throw typedError('DESTINATION_SCOPE', 'bundle destination cannot be inside either source');
  if (fs.existsSync(destination)) throw typedError('DESTINATION_EXISTS', 'bundle destination already exists');
  const parent = path.dirname(destination);
  fs.mkdirSync(parent, { recursive: true });
  const partial = path.join(parent, `.${path.basename(destination)}.partial-${crypto.randomBytes(8).toString('hex')}`);
  const mirrorPlan = collectMirrorPlan(mirrorRoot, options.mirrorSelection || {});
  const findings = secretScan(mirrorPlan.files);
  if (findings.length) throw typedError('SECRET_SCAN', 'Mirror transfer selection contains secret-pattern findings', { count: findings.length, findings });
  const bootstrapEntry = mirrorPlan.files.find(item => item.path === 'lineage/code-clone-ivan-experiment-bootstrap-v4.json');
  const messageEntry = mirrorPlan.files.find(item => item.path === 'lineage/code-clone-mike-pride-message-v1.json');
  if (!bootstrapEntry || !messageEntry) throw typedError('EXPERIMENT_FOUNDATION', 'active bootstrap or Mike message is absent from Mirror selection');
  let committed = false;
  try {
    fs.mkdirSync(partial);
    copyEntries(mirrorPlan.files, partial, 'mirror');
    const workshopDestination = path.join(partial, 'workshop');
    const workshopBuilder = options.workshopBuilder || (input => WorkshopPackager.buildGuest(input));
    const workshopVerifier = options.workshopVerifier || (root => WorkshopPackager.verifyGuest(root));
    const workshopResult = workshopBuilder({ workshopRoot, profilePath: options.workshopProfilePath, destination: workshopDestination });
    const workshopVerification = workshopVerifier(workshopDestination);
    fs.writeFileSync(path.join(partial, 'ACTIVE_EXPERIMENT_BOOTSTRAP.json'), fs.readFileSync(bootstrapEntry.source), { flag: 'wx' });
    fs.writeFileSync(path.join(partial, 'MIKE_MESSAGE.json'), fs.readFileSync(messageEntry.source), { flag: 'wx' });
    fs.writeFileSync(path.join(partial, 'START_HERE.md'), startHereSource(), { encoding: 'utf8', flag: 'wx' });
    fs.writeFileSync(path.join(partial, 'verify-transfer-bundle.js'), standaloneVerifierSource(), { encoding: 'utf8', flag: 'wx' });
    for (const entry of mirrorPlan.files) if (sha256File(entry.source) !== entry.sha256) throw typedError('MIRROR_SOURCE_DRIFT', `Mirror source changed during build: ${entry.path}`);
    const files = inventoryBundle(partial);
    const contentSha256 = digestEntries(files);
    const buildId = `ivan-code-clone-transfer-${sha256(`${bootstrapEntry.sha256}\0${contentSha256}`).slice(0, 24)}`;
    const manifest = stable({
      schema: MANIFEST_SCHEMA,
      buildId,
      status: 'EXPERIMENTAL',
      createdAt: new Date().toISOString(),
      bootstrap: { path: 'mirror/lineage/code-clone-ivan-experiment-bootstrap-v4.json', sha256: bootstrapEntry.sha256 },
      humanMessages: [{ path: 'MIKE_MESSAGE.json', sha256: messageEntry.sha256, from: 'Mike', unconditional: true, decisionAuthority: false }],
      selection: { mirror: mirrorPlan.summary, exclusions: ['state', 'logs', 'exports', 'substrates', 'private memory', 'runtime tokens', 'checkpoints', 'candidates'], archiveRecommendedForTransfer: true },
      workshopGuest: { buildId: workshopResult.buildId || null, filesChecked: workshopVerification.filesChecked || workshopVerification.files || null, contentSha256: workshopVerification.contentSha256 || null, baseProfilePreserved: true, activeCompositionSupersededByBootstrapV2: true },
      files,
      contentSha256,
      verification: { factory: 'PASS', standaloneVerifier: 'PRESENT', archiveRoundTrip: 'NOT_YET_RUN', ivanLinux: 'NOT_YET_RUN' },
      authority: { sourceWrites: false, automaticInstall: false, automaticRun: false, automaticReturn: false, evidenceAdmission: false, release: false, canon: false }
    });
    fs.writeFileSync(path.join(partial, MANIFEST_FILE), JSON.stringify(manifest, null, 2) + '\n', { encoding: 'utf8', flag: 'wx' });
    const verification = verifyBundle(partial);
    if (fs.existsSync(destination)) throw typedError('DESTINATION_RACE', 'bundle destination appeared during build');
    fs.renameSync(partial, destination);
    committed = true;
    return { ...verification, destination, manifest, workshopResult };
  } finally {
    if (!committed && fs.existsSync(partial)) {
      if (path.dirname(partial) !== parent || !path.basename(partial).startsWith(`.${path.basename(destination)}.partial-`)) throw typedError('PARTIAL_CLEANUP', 'partial bundle cleanup target changed');
      fs.rmSync(partial, { recursive: true, force: true });
    }
  }
}

function archiveCommandOptions(options = {}) {
  const maxBufferBytes = Number(options.maxBufferBytes || 64 * 1024 * 1024);
  if (!Number.isInteger(maxBufferBytes) || maxBufferBytes < 1024 * 1024 || maxBufferBytes > 256 * 1024 * 1024) throw typedError('ARCHIVE_BUFFER', 'archive command output buffer is out of range');
  return { encoding: 'utf8', windowsHide: true, timeout: options.timeoutMs || 1800000, maxBuffer: maxBufferBytes };
}

function verifyArchiveWithBundle(root, archive, verification, options = {}) {
  if (!fs.existsSync(archive)) throw typedError('ARCHIVE_MISSING', 'archive file is absent');
  const archiveStat = fs.lstatSync(archive);
  if (!archiveStat.isFile() || archiveStat.isSymbolicLink()) throw typedError('ARCHIVE_SHAPE', 'archive must be a real file');
  const tar = options.tarExecutable || 'tar';
  const commandOptions = archiveCommandOptions(options);
  const listed = spawnSync(tar, ['-tzf', archive], commandOptions);
  if (listed.status !== 0) throw typedError('ARCHIVE_LIST', 'tar failed to list the transfer archive', { status: listed.status, signal: listed.signal || null, errorCode: listed.error ? listed.error.code || null : null, stderr: String(listed.stderr || '').slice(-4000) });
  const entries = listed.stdout.split(/\r?\n/).filter(Boolean).map(value => value.replace(/\/$/, ''));
  if (entries.length > 250000) throw typedError('ARCHIVE_LIST_SCOPE', 'archive entry count exceeds the verification ceiling');
  const prefix = `${path.basename(root)}/`;
  if (entries.some(value => value !== path.basename(root) && (!value.startsWith(prefix) || value.split('/').includes('..') || path.posix.isAbsolute(value)))) throw typedError('ARCHIVE_PATH', 'archive contains an unsafe or unexpected root path');
  const verificationTempParent = path.resolve(options.verificationTempRoot || path.dirname(archive));
  if (inside(verificationTempParent, root) || verificationTempParent === root) throw typedError('ARCHIVE_TEMP_SCOPE', 'archive verification temp root cannot be inside the bundle');
  fs.mkdirSync(verificationTempParent, { recursive: true });
  const temp = fs.mkdtempSync(path.join(verificationTempParent, 'axm-ivan-transfer-verify-'));
  try {
    const extracted = spawnSync(tar, ['-xzf', archive, '-C', temp], commandOptions);
    if (extracted.status !== 0) throw typedError('ARCHIVE_EXTRACT', 'tar failed to extract the verification copy');
    const roundTrip = verifyBundle(path.join(temp, path.basename(root)));
    if (roundTrip.contentSha256 !== verification.contentSha256) throw typedError('ARCHIVE_ROUND_TRIP', 'archive round-trip content digest changed');
  } finally {
    if (inside(temp, verificationTempParent) && path.basename(temp).startsWith('axm-ivan-transfer-verify-')) fs.rmSync(temp, { recursive: true, force: true });
  }
  const stat = fs.statSync(archive);
  return stable({ schema: 'axm.mirror.code-clone-ivan-transfer-archive-receipt/v1', state: 'PASS', buildId: verification.buildId, archive, bytes: stat.size, sha256: sha256File(archive), entries: entries.length, contentSha256: verification.contentSha256, tarExecutable: tar, ivanLinuxExtraction: 'NOT_YET_RUN' });
}

function verifyArchive(bundleRoot, archivePath, options = {}) {
  const root = path.resolve(bundleRoot);
  const archive = path.resolve(archivePath);
  const verification = verifyBundle(root);
  if (inside(archive, root)) throw typedError('ARCHIVE_SCOPE', 'archive cannot be written inside the bundle');
  return verifyArchiveWithBundle(root, archive, verification, options);
}

function archiveBundle(bundleRoot, archivePath, options = {}) {
  const root = path.resolve(bundleRoot);
  const archive = path.resolve(archivePath);
  const verification = verifyBundle(root);
  if (inside(archive, root)) throw typedError('ARCHIVE_SCOPE', 'archive cannot be written inside the bundle');
  if (fs.existsSync(archive)) throw typedError('ARCHIVE_EXISTS', 'archive destination already exists');
  fs.mkdirSync(path.dirname(archive), { recursive: true });
  const tar = options.tarExecutable || 'tar';
  const commandOptions = archiveCommandOptions(options);
  const created = spawnSync(tar, ['-czf', archive, '-C', path.dirname(root), path.basename(root)], commandOptions);
  if (created.status !== 0 || !fs.existsSync(archive)) throw typedError('ARCHIVE_CREATE', 'tar failed to create the transfer archive', { status: created.status, stderr: String(created.stderr || '').slice(-4000) });
  return verifyArchiveWithBundle(root, archive, verification, options);
}

module.exports = {
  ORGAN_ID,
  MANIFEST_SCHEMA,
  MANIFEST_FILE,
  MIRROR_ROOT_FILES,
  MIRROR_SOURCE_ROOTS,
  GENERATED_FILES,
  stable,
  canonical,
  sha256,
  sha256File,
  digestEntries,
  collectMirrorPlan,
  secretScan,
  verifyBundle,
  buildBundle,
  verifyArchive,
  archiveBundle
};
