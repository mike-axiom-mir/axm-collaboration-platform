'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ORGAN_ID = 'axm.mirror.code-clone-workshop-guest-packager-organ/v1';
const PROFILE_SCHEMA = 'axm.mirror.code-clone-workshop-guest-profile/v1';
const MANIFEST_SCHEMA = 'axm.mirror.code-clone-workshop-guest-manifest/v1';
const REFUSAL_SCHEMA = 'axm.mirror.code-clone-workshop-guest-build-refusal/v1';
const MANIFEST_FILE = 'MIRROR_GUEST_MANIFEST.json';
const GENERATED_FILES = Object.freeze([
  'MIRROR_GUEST_PROFILE.json',
  'MIRROR_START_HERE.md',
  'start-mirror-workshop.sh',
  'verify-mirror-workshop-guest.js'
]);
const RESERVED_FILES = new Set([MANIFEST_FILE, ...GENERATED_FILES]);
const TEXT_EXTENSIONS = new Set([
  '.js', '.cjs', '.mjs', '.html', '.css', '.json', '.jsonl', '.txt', '.md',
  '.bat', '.cmd', '.ps1', '.sh', '.yml', '.yaml', '.xml', '.toml', '.ini'
]);
const SECRET_PATTERNS = Object.freeze([
  ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----\r?\n[A-Za-z0-9+/=\r\n]{32,}/],
  ['openai-key', /\bsk-[A-Za-z0-9_-]{24,}\b/],
  ['anthropic-key', /\bsk-ant-[A-Za-z0-9_-]{20,}\b/],
  ['google-key', /\bAIza[0-9A-Za-z_-]{20,}\b/],
  ['github-token', /\bgh[pousr]_[A-Za-z0-9]{20,}\b/],
  ['discord-webhook', /https:\/\/(?:canary\.|ptb\.)?(?:discord(?:app)?\.com)\/api\/webhooks\/[0-9]+\/[A-Za-z0-9._-]+/],
  ['private-windows-user-path', /C:\\Users\\[^\\\r\n]+/i],
  ['assigned-api-key', /^\s*(?:OPENAI_API_KEY|ANTHROPIC_API_KEY|GOOGLE_API_KEY|GEMINI_API_KEY|AXM_BRIDGE_TOKEN)\s*=\s*[^%\s<][^\r\n]{11,}$/im]
]);

function errorWithCode(code, message, details) {
  const error = new Error(message);
  error.code = code;
  if (details) error.details = details;
  return error;
}

function slash(value) {
  return String(value || '').replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+|\/+$/g, '');
}

function safeRelative(value, label = 'path') {
  const relative = slash(value);
  if (!relative || path.isAbsolute(relative) || relative.includes(':') || relative.split('/').includes('..')) {
    throw errorWithCode('UNSAFE_PATH', `${label} is not a safe relative path: ${value}`);
  }
  return relative;
}

function isUnder(candidate, parent) {
  const child = path.resolve(candidate);
  const root = path.resolve(parent);
  const comparison = process.platform === 'win32'
    ? [child.toLowerCase(), root.toLowerCase()]
    : [child, root];
  return comparison[0] === comparison[1] || comparison[0].startsWith(comparison[1] + path.sep);
}

function sha256Bytes(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function sha256File(file) {
  const hash = crypto.createHash('sha256');
  const handle = fs.openSync(file, 'r');
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    let bytesRead = 0;
    do {
      bytesRead = fs.readSync(handle, buffer, 0, buffer.length, null);
      if (bytesRead) hash.update(buffer.subarray(0, bytesRead));
    } while (bytesRead);
  } finally {
    fs.closeSync(handle);
  }
  return hash.digest('hex');
}

function stable(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
  return '{' + Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(',') + '}';
}

function digestEntries(entries) {
  return sha256Bytes(Buffer.from(entries
    .slice()
    .sort((a, b) => a.path.localeCompare(b.path))
    .map(entry => `${entry.path}\0${entry.bytes}\0${entry.sha256}\n`)
    .join(''), 'utf8'));
}

function loadProfile(profilePath) {
  const absolute = path.resolve(profilePath);
  const raw = fs.readFileSync(absolute);
  const profile = JSON.parse(raw.toString('utf8').replace(/^\uFEFF/, ''));
  if (profile.schema !== PROFILE_SCHEMA) throw errorWithCode('PROFILE_SCHEMA', 'unexpected guest profile schema');
  if (profile.status !== 'EXPERIMENTAL') throw errorWithCode('PROFILE_STATUS', 'guest profile must remain EXPERIMENTAL');
  if (profile.sourceSelection.sourceReadOnly !== true) throw errorWithCode('SOURCE_AUTHORITY', 'guest profile must keep Workshop source read-only');
  if (profile.foundationCoverage.selectionRule !== 'INCLUDE_EVERY_PUBLIC_SAFE_PATH_NOT_AN_ALLOWLISTED_SUBSET') {
    throw errorWithCode('PROFILE_SCOPE', 'guest profile is not the full public-safe foundation');
  }
  return { profile, raw, absolute, sha256: sha256Bytes(raw) };
}

function loadPlanner(workshopRoot, profile) {
  const plannerRelative = safeRelative(profile.sourceSelection.plannerPath, 'planner path');
  const plannerPath = path.resolve(workshopRoot, ...plannerRelative.split('/'));
  if (!isUnder(plannerPath, workshopRoot)) throw errorWithCode('PLANNER_ESCAPE', 'planner escaped Workshop source');
  const observed = sha256File(plannerPath);
  if (observed !== profile.sourceSelection.plannerSha256) {
    throw errorWithCode('SOURCE_POLICY_DRIFT', 'Workshop public-safe planner digest changed', {
      path: plannerRelative,
      expectedSha256: profile.sourceSelection.plannerSha256,
      observedSha256: observed
    });
  }
  delete require.cache[require.resolve(plannerPath)];
  const planner = require(plannerPath);
  if (!planner || typeof planner.collectFiles !== 'function') {
    throw errorWithCode('PLANNER_INTERFACE', 'Workshop planner does not expose collectFiles');
  }
  return { planner, plannerPath, plannerSha256: observed };
}

function excludedByGuestProfile(relative, exclusions) {
  const rel = slash(relative);
  return exclusions.some(value => rel === value || rel.startsWith(value + '/'));
}

function collectPlan(options) {
  const workshopRoot = path.resolve(options.workshopRoot);
  if (!fs.statSync(workshopRoot).isDirectory()) throw errorWithCode('SOURCE_MISSING', 'Workshop source is not a directory');
  const loaded = loadProfile(options.profilePath);
  const plannerBinding = loadPlanner(workshopRoot, loaded.profile);
  const selected = plannerBinding.planner.collectFiles(workshopRoot, []);
  const exclusions = (loaded.profile.sourceSelection.additionalExclusions || []).map(value => safeRelative(value, 'additional exclusion'));
  const files = [];
  for (const [relativeValue, absolute] of selected.files) {
    const relative = safeRelative(relativeValue, 'selected source path');
    if (excludedByGuestProfile(relative, exclusions)) continue;
    if (RESERVED_FILES.has(relative)) throw errorWithCode('RESERVED_COLLISION', `Workshop source collides with generated guest file: ${relative}`);
    const stat = fs.lstatSync(absolute);
    if (!stat.isFile() || stat.isSymbolicLink()) throw errorWithCode('SOURCE_TYPE', `selected source is not a regular file: ${relative}`);
    files.push({ path: relative, source: absolute, bytes: stat.size, mode: stat.mode & 0o777 });
  }
  files.sort((a, b) => a.path.localeCompare(b.path));
  const selectedPaths = new Set(files.map(item => item.path));
  for (const requiredValue of loaded.profile.foundationCoverage.requiredPaths) {
    const required = safeRelative(requiredValue, 'required foundation path');
    const present = selectedPaths.has(required) || files.some(item => item.path.startsWith(required + '/'));
    if (!present) throw errorWithCode('REQUIRED_FOUNDATION_MISSING', `required foundation path is absent: ${required}`);
  }
  const bytes = files.reduce((total, item) => total + item.bytes, 0);
  const pathSetSha256 = sha256Bytes(Buffer.from(files.map(item => item.path + '\n').join(''), 'utf8'));
  const catalog = typeof plannerBinding.planner.discoverCatalog === 'function'
    ? plannerBinding.planner.discoverCatalog(workshopRoot)
    : [];
  const kinds = {};
  for (const item of catalog) kinds[item.kind] = (kinds[item.kind] || 0) + 1;
  return {
    schema: 'axm.mirror.code-clone-workshop-guest-plan/v1',
    organId: ORGAN_ID,
    profileId: loaded.profile.profileId,
    profileSha256: loaded.sha256,
    plannerSha256: plannerBinding.plannerSha256,
    selection: loaded.profile.sourceSelection.mode,
    files,
    summary: { files: files.length, bytes, pathSetSha256, catalogEntries: catalog.length, catalogKinds: kinds },
    profile: loaded.profile,
    profileRaw: loaded.raw
  };
}

function secretScan(files) {
  const findings = [];
  for (const item of files) {
    if (item.bytes > 2 * 1024 * 1024 || !TEXT_EXTENSIONS.has(path.extname(item.path).toLowerCase())) continue;
    const content = fs.readFileSync(item.source, 'utf8');
    for (const [rule, pattern] of SECRET_PATTERNS) {
      if (pattern.test(content)) findings.push({ path: item.path, rule });
      if (findings.length >= 100) return findings;
    }
  }
  return findings;
}

function copyAndHash(source, destination, mode) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const input = fs.openSync(source, 'r');
  const output = fs.openSync(destination, 'wx');
  const hash = crypto.createHash('sha256');
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  let bytes = 0;
  try {
    let count = 0;
    do {
      count = fs.readSync(input, buffer, 0, buffer.length, null);
      if (count) {
        const chunk = buffer.subarray(0, count);
        fs.writeSync(output, chunk);
        hash.update(chunk);
        bytes += count;
      }
    } while (count);
  } finally {
    fs.closeSync(input);
    fs.closeSync(output);
  }
  try { fs.chmodSync(destination, mode); } catch (_) {}
  return { bytes, sha256: hash.digest('hex') };
}

function generatedLauncher(profile) {
  return `#!/usr/bin/env sh
set -eu
cd -- "$(dirname -- "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "AXM Mirror Workshop needs Node.js ${profile.linuxRuntime.nodeRange}." >&2
  exit 20
fi
major="$(node -p "Number(process.versions.node.split('.')[0])")"
if [ "$major" -lt 20 ] || [ "$major" -ge 25 ]; then
  echo "Unsupported Node.js major: $major (need ${profile.linuxRuntime.nodeRange})." >&2
  exit 21
fi
export AXM_HOST="127.0.0.1"
export AXM_PORT="${'${AXM_PORT:-8788}'}"
export AXM_NO_BROWSER="1"
export AXM_OPEN="none"
exec node server.js --open=none
`;
}

function generatedGuide(profile) {
  return `# Mirror Workshop guest

This is the full public-safe AXM Workshop foundation prepared for the disposable full-Mirror Code/Growth clone. It preserves human rooms and machine-native discovery over one trace. Module declarations are choices to inspect, not proof that every capability works.

## Start on Ivan's Linux VM

1. Install a compatible Node.js (${profile.linuxRuntime.nodeRange}). The core does not require \`npm install\`.
2. Run \`chmod +x start-mirror-workshop.sh\` once after archive extraction if needed.
3. Run \`./start-mirror-workshop.sh\`.
4. Check \`http://127.0.0.1:8788/api/health\` from inside the VM.

The launcher fixes the core server to loopback, does not open a browser, and does not start the full launcher, AI bridge, or a LAN game listener. A human outside the VM can use an SSH tunnel or a separately reviewed edge.

## Machine directions

- Begin with \`AI_START_HERE.md\` and \`AXM_DISCOVERY_ROOT.md\`.
- Read \`registry/modules.json\`, \`registry/capabilities.jsonl\`, and \`registry/proofs.json\`.
- Compile a task view with \`node shared/technical-glasses/technical-glasses-cli.js --focus="your current question"\`.
- Use module manifests, contracts, tests, discovery-seam reviews, Heartbeat, Body Pulse, direction, continuity, evidence, readiness, resource, recovery, creative, game, and world systems as distinct organs.

## Human directions

Open the Hub through the local address or tunnel. The complete shareable Hub, rooms, studios, games, worlds, visual surfaces, diagnostics, recovery, review, and documentation are retained.

## Authority and continuity

This guest copy belongs to the clone inside the disposable VM and may be changed there. It has no automatic write or return path to main Mirror, main Workshop, release gates, permissions, evidence admission, or CANON. Preserve failures and actual resource costs in the clone's experience memory.
`;
}

function standaloneVerifierSource() {
  return `'use strict';
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname);
const manifestPath = path.join(root, 'MIRROR_GUEST_MANIFEST.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
if (manifest.schema !== 'axm.mirror.code-clone-workshop-guest-manifest/v1') throw new Error('unexpected manifest schema');
const allowRuntimeState = process.argv.includes('--allow-runtime-state');
function safe(value) {
  const rel = String(value || '').replace(/\\\\/g, '/').replace(/^\\.\\//, '').replace(/^\\/+|\\/+$/g, '');
  if (!rel || path.isAbsolute(rel) || rel.includes(':') || rel.split('/').includes('..')) throw new Error('unsafe manifest path: ' + value);
  return rel;
}
function hash(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }
const declared = new Set();
let checked = 0;
for (const entry of manifest.files) {
  const rel = safe(entry.path);
  if (declared.has(rel)) throw new Error('duplicate manifest path: ' + rel);
  declared.add(rel);
  const target = path.resolve(root, ...rel.split('/'));
  if (target !== root && !target.startsWith(root + path.sep)) throw new Error('manifest path escaped: ' + rel);
  const stat = fs.statSync(target);
  if (!stat.isFile() || stat.size !== entry.bytes || hash(target) !== entry.sha256) throw new Error('manifest mismatch: ' + rel);
  checked += 1;
}
function walk(dir) {
  const found = [];
  for (const name of fs.readdirSync(dir).sort()) {
    const target = path.join(dir, name);
    const stat = fs.lstatSync(target);
    if (stat.isSymbolicLink()) throw new Error('unexpected symbolic link: ' + target);
    if (stat.isDirectory()) found.push(...walk(target));
    else if (stat.isFile()) found.push(path.relative(root, target).split(path.sep).join('/'));
  }
  return found;
}
let runtimeFilesIgnored = 0;
const mutableRoots = new Set((manifest.linuxRuntime.runtimeMutableRoots || []).map(safe));
for (const rel of walk(root)) {
  if (rel === 'MIRROR_GUEST_MANIFEST.json' || declared.has(rel)) continue;
  const top = safe(rel).split('/')[0];
  if (allowRuntimeState && mutableRoots.has(top)) { runtimeFilesIgnored += 1; continue; }
  throw new Error('unexpected file: ' + rel);
}
if (checked !== manifest.fileCount) throw new Error('manifest count mismatch');
process.stdout.write(JSON.stringify({ok:true, schema:manifest.schema, buildId:manifest.buildId, filesChecked:checked, runtimeFilesIgnored, contentSha256:manifest.contentSha256}) + '\\n');
`;
}

function writeGenerated(root, relative, content, mode) {
  const target = path.join(root, ...relative.split('/'));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, { encoding: 'utf8', flag: 'wx', mode });
  return { path: relative, bytes: Buffer.byteLength(content), sha256: sha256Bytes(Buffer.from(content, 'utf8')), source: 'GENERATED_GUEST_ADAPTER' };
}

function walkRelativeFiles(root, current = root) {
  const output = [];
  for (const name of fs.readdirSync(current).sort((a, b) => a.localeCompare(b))) {
    const target = path.join(current, name);
    const stat = fs.lstatSync(target);
    if (stat.isSymbolicLink()) throw errorWithCode('UNEXPECTED_SYMLINK', `unexpected symbolic link: ${target}`);
    if (stat.isDirectory()) output.push(...walkRelativeFiles(root, target));
    else if (stat.isFile()) output.push(path.relative(root, target).split(path.sep).join('/'));
  }
  return output;
}

function verifyGuest(guestRoot, options = {}) {
  const root = path.resolve(guestRoot);
  const manifestPath = path.join(root, MANIFEST_FILE);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8').replace(/^\uFEFF/, ''));
  if (manifest.schema !== MANIFEST_SCHEMA) throw errorWithCode('MANIFEST_SCHEMA', 'unexpected guest manifest schema');
  const declared = new Set();
  let bytes = 0;
  for (const entry of manifest.files) {
    const relative = safeRelative(entry.path, 'manifest entry');
    if (declared.has(relative)) throw errorWithCode('DUPLICATE_MANIFEST_PATH', `duplicate manifest entry: ${relative}`);
    declared.add(relative);
    const target = path.resolve(root, ...relative.split('/'));
    if (!isUnder(target, root)) throw errorWithCode('MANIFEST_ESCAPE', `manifest entry escaped: ${relative}`);
    const stat = fs.lstatSync(target);
    if (!stat.isFile() || stat.isSymbolicLink()) throw errorWithCode('MANIFEST_FILE_TYPE', `manifest target is not a regular file: ${relative}`);
    if (stat.size !== entry.bytes) throw errorWithCode('MANIFEST_SIZE', `manifest size mismatch: ${relative}`);
    if (sha256File(target) !== entry.sha256) throw errorWithCode('MANIFEST_DIGEST', `manifest digest mismatch: ${relative}`);
    bytes += stat.size;
  }
  const actual = walkRelativeFiles(root);
  const mutableRoots = new Set((manifest.linuxRuntime.runtimeMutableRoots || []).map(value => safeRelative(value, 'runtime mutable root')));
  let runtimeFilesIgnored = 0;
  for (const relative of actual) {
    if (relative === MANIFEST_FILE || declared.has(relative)) continue;
    const top = safeRelative(relative, 'actual guest path').split('/')[0];
    if (options.allowRuntimeState === true && mutableRoots.has(top)) {
      runtimeFilesIgnored += 1;
      continue;
    }
    throw errorWithCode('UNEXPECTED_FILE', `unexpected guest file: ${relative}`);
  }
  if (manifest.fileCount !== declared.size) throw errorWithCode('MANIFEST_COUNT', 'manifest file count mismatch');
  if (manifest.contentSha256 !== digestEntries(manifest.files)) throw errorWithCode('MANIFEST_CONTENT_DIGEST', 'manifest content digest mismatch');
  return { ok: true, schema: manifest.schema, buildId: manifest.buildId, filesChecked: declared.size, bytesChecked: bytes, runtimeFilesIgnored, contentSha256: manifest.contentSha256 };
}

function writeRefusal(destination, reason, details, clock) {
  const parent = path.dirname(destination);
  fs.mkdirSync(parent, { recursive: true });
  const suffix = sha256Bytes(Buffer.from(`${reason}\0${stable(details || {})}\0${clock}`, 'utf8')).slice(0, 16);
  const receipt = path.join(parent, path.basename(destination) + `.REFUSED-${suffix}.json`);
  fs.writeFileSync(receipt, JSON.stringify({
    schema: REFUSAL_SCHEMA,
    status: 'KNOWN_FAIL',
    reason,
    recordedAt: clock,
    details: details || null,
    sourceContentRetained: false,
    destinationCreated: false
  }, null, 2) + '\n', { encoding: 'utf8', flag: 'wx' });
  return receipt;
}

function validateDestination(workshopRoot, destination) {
  const source = path.resolve(workshopRoot);
  const target = path.resolve(destination);
  const parent = path.dirname(target);
  if (target === path.parse(target).root || target === parent) throw errorWithCode('UNSAFE_DESTINATION', 'destination is too broad');
  if (isUnder(target, source) || isUnder(source, target)) throw errorWithCode('SOURCE_DESTINATION_OVERLAP', 'source and destination may not contain one another');
  if (fs.existsSync(target)) throw errorWithCode('DESTINATION_EXISTS', 'destination already exists');
  return { source, target, parent };
}

function buildGuest(options) {
  const clock = typeof options.clock === 'function' ? options.clock().toISOString() : new Date().toISOString();
  const bounds = validateDestination(options.workshopRoot, options.destination);
  const plan = collectPlan(options);
  const findings = secretScan(plan.files);
  if (findings.length) {
    const receipt = writeRefusal(bounds.target, 'SECRET_SCAN_FINDINGS', { findings }, clock);
    throw errorWithCode('SECRET_SCAN_FINDINGS', `guest build refused by ${findings.length} secret-pattern finding(s)`, { receipt, findings });
  }
  fs.mkdirSync(bounds.parent, { recursive: true });
  const partial = path.join(bounds.parent, `.${path.basename(bounds.target)}.partial-${crypto.randomBytes(6).toString('hex')}`);
  if (!isUnder(partial, bounds.parent) || fs.existsSync(partial)) throw errorWithCode('PARTIAL_PATH', 'unsafe or occupied partial destination');
  let committed = false;
  try {
    fs.mkdirSync(partial, { recursive: false });
    const sourceEntries = [];
    for (const item of plan.files) {
      const target = path.join(partial, ...item.path.split('/'));
      const copied = copyAndHash(item.source, target, item.mode);
      if (copied.bytes !== item.bytes) throw errorWithCode('SOURCE_CHANGED_DURING_COPY', `source size changed during copy: ${item.path}`);
      sourceEntries.push({ path: item.path, bytes: copied.bytes, sha256: copied.sha256, source: 'WORKSHOP_PUBLIC_SAFE' });
    }

    const generatedEntries = [
      writeGenerated(partial, 'MIRROR_GUEST_PROFILE.json', plan.profileRaw.toString('utf8'), 0o644),
      writeGenerated(partial, 'MIRROR_START_HERE.md', generatedGuide(plan.profile), 0o644),
      writeGenerated(partial, 'start-mirror-workshop.sh', generatedLauncher(plan.profile), 0o755),
      writeGenerated(partial, 'verify-mirror-workshop-guest.js', standaloneVerifierSource(), 0o755)
    ];

    if (typeof options.beforeSourceStabilityCheck === 'function') options.beforeSourceStabilityCheck({ plan, partial });
    for (let index = 0; index < plan.files.length; index += 1) {
      const observed = sha256File(plan.files[index].source);
      if (observed !== sourceEntries[index].sha256) {
        throw errorWithCode('SOURCE_DRIFT_AFTER_COPY', `Workshop source drifted during build: ${plan.files[index].path}`);
      }
    }

    const entries = sourceEntries.concat(generatedEntries).sort((a, b) => a.path.localeCompare(b.path));
    const sourceContentSha256 = digestEntries(sourceEntries);
    const contentSha256 = digestEntries(entries);
    const buildId = 'mirror-workshop-guest-' + sha256Bytes(Buffer.from(`${plan.profileSha256}\0${sourceContentSha256}`, 'utf8')).slice(0, 24);
    const manifest = {
      schema: MANIFEST_SCHEMA,
      status: 'EXPERIMENTAL',
      buildId,
      builtAt: clock,
      profileId: plan.profileId,
      profileSha256: plan.profileSha256,
      sourceSelection: plan.selection,
      sourcePlannerSha256: plan.plannerSha256,
      sourcePathSetSha256: plan.summary.pathSetSha256,
      sourceContentSha256,
      contentSha256,
      fileCount: entries.length,
      sourceFileCount: sourceEntries.length,
      generatedFileCount: generatedEntries.length,
      totalBytesExcludingManifest: entries.reduce((total, entry) => total + entry.bytes, 0),
      requiredPaths: plan.profile.foundationCoverage.requiredPaths,
      linuxRuntime: plan.profile.linuxRuntime,
      nativeDirections: plan.profile.nativeDirections,
      authority: plan.profile.cloneAuthority,
      files: entries
    };
    fs.writeFileSync(path.join(partial, MANIFEST_FILE), JSON.stringify(manifest, null, 2) + '\n', { encoding: 'utf8', flag: 'wx' });
    const verification = verifyGuest(partial);
    if (fs.existsSync(bounds.target)) throw errorWithCode('DESTINATION_RACE', 'destination appeared while building');
    fs.renameSync(partial, bounds.target);
    committed = true;
    return { ...verification, destination: bounds.target, manifest, sourceFiles: sourceEntries.length, generatedFiles: generatedEntries.length, secretScan: 'PASS', sourceStability: 'PASS' };
  } catch (error) {
    if (!committed && fs.existsSync(partial)) {
      if (!isUnder(partial, bounds.parent) || path.dirname(partial) !== bounds.parent || !path.basename(partial).startsWith(`.${path.basename(bounds.target)}.partial-`)) {
        throw errorWithCode('PARTIAL_CLEANUP_REFUSED', 'partial cleanup target failed exact validation', { originalError: error.message });
      }
      fs.rmSync(partial, { recursive: true, force: true });
    }
    if (['SOURCE_CHANGED_DURING_COPY', 'SOURCE_DRIFT_AFTER_COPY', 'DESTINATION_RACE'].includes(error.code)) {
      try { error.details = { ...(error.details || {}), receipt: writeRefusal(bounds.target, error.code, { message: error.message }, clock) }; } catch (_) {}
    }
    throw error;
  }
}

module.exports = {
  ORGAN_ID,
  PROFILE_SCHEMA,
  MANIFEST_SCHEMA,
  REFUSAL_SCHEMA,
  MANIFEST_FILE,
  GENERATED_FILES,
  collectPlan,
  secretScan,
  buildGuest,
  verifyGuest,
  sha256File,
  digestEntries
};
