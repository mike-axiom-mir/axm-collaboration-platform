'use strict';

const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream/promises');
const { Readable } = require('stream');
const Zip = require('./zip');

const LOCK_SCHEMA = 'axm.external-substrate-lock/v1';
const INVENTORY_SCHEMA = 'axm.external-substrate-inventory/v1';
const INSTALL_RECEIPT_SCHEMA = 'axm.external-substrate-install-receipt/v1';
const LOCK_PATH = path.join(__dirname, 'substrates.lock.json');
const MAX_REDIRECTS = 6;
const TRUSTED_INVENTORIES = new WeakSet();

function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function fileSha256(file) { return sha256(fs.readFileSync(file)); }
function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
  return JSON.stringify(value);
}
function digest(value) { return sha256(Buffer.from(canonical(value), 'utf8')); }
function cleanText(value, maximum) {
  return String(value == null ? '' : value)
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .replace(/[A-Za-z]:[\\/][^\r\n\t"']+/g, '<private-path>')
    .replace(/file:\/\/\/[^\s"']+/gi, '<private-path>')
    .trim().slice(0, maximum || 2000);
}
function safeId(value) {
  const id = String(value || '');
  if (!/^[a-z0-9][a-z0-9.-]{1,79}$/.test(id)) throw new Error('invalid substrate id');
  return id;
}
function safeRelative(value) {
  const relative = String(value || '').replace(/\\/g, '/');
  if (!relative || relative.startsWith('/') || /^[A-Za-z]:/.test(relative) || relative.split('/').some((part) => !part || part === '.' || part === '..')) throw new Error('unsafe relative substrate path');
  return relative;
}
function inside(root, relative) {
  const base = path.resolve(root);
  const target = path.resolve(base, safeRelative(relative));
  if (!target.startsWith(base + path.sep)) throw new Error('substrate path escaped root');
  return target;
}
function assertSafeRoot(root) {
  const resolved = path.resolve(String(root || ''));
  const parsed = path.parse(resolved);
  if (!resolved || resolved === parsed.root || resolved === path.resolve(process.cwd())) throw new Error('substrate root must be a dedicated directory');
  return resolved;
}
function defaultRoot() {
  if (process.env.AXM_SUBSTRATE_ROOT) return assertSafeRoot(process.env.AXM_SUBSTRATE_ROOT);
  const local = process.env.LOCALAPPDATA;
  if (!local) throw new Error('AXM_SUBSTRATE_ROOT or LOCALAPPDATA is required');
  return assertSafeRoot(path.join(local, 'AXM', 'substrates'));
}

function loadLock(file) {
  const lock = JSON.parse(fs.readFileSync(file || LOCK_PATH, 'utf8'));
  if (lock.schema !== LOCK_SCHEMA || lock.platform !== 'windows-x64' || !Array.isArray(lock.entries) || !lock.entries.length) throw new Error('invalid substrate lock');
  const ids = new Set();
  for (const entry of lock.entries) {
    safeId(entry.id);
    if (ids.has(entry.id)) throw new Error('duplicate substrate id: ' + entry.id);
    ids.add(entry.id);
    if (!/^[a-f0-9]{64}$/.test(entry.source && entry.source.sha256 || '')) throw new Error(entry.id + ' needs an exact SHA-256');
    if (!Number.isSafeInteger(entry.source.size_bytes) || entry.source.size_bytes < 1) throw new Error(entry.id + ' needs an exact byte size');
    if (!Array.isArray(entry.source.allowed_hosts) || !entry.source.allowed_hosts.length) throw new Error(entry.id + ' needs an explicit download host allowlist');
    if (!entry.licence || entry.licence.review_status !== 'REVIEWED_FOR_LOCAL_TEST') throw new Error(entry.id + ' licence is not reviewed for local test');
    safeRelative(entry.installation.destination);
    (entry.dependencies || []).forEach(safeId);
  }
  for (const entry of lock.entries) for (const dependency of entry.dependencies || []) if (!ids.has(dependency)) throw new Error(entry.id + ' depends on unknown substrate ' + dependency);
  const compositionIds = new Set();
  for (const composition of lock.compositions || []) {
    safeId(composition.id);
    if (ids.has(composition.id) || compositionIds.has(composition.id)) throw new Error('duplicate substrate composition id: ' + composition.id);
    compositionIds.add(composition.id);
    if (!Array.isArray(composition.components) || composition.components.length < 2) throw new Error(composition.id + ' needs at least two component runtimes');
    for (const component of composition.components) if (!ids.has(component)) throw new Error(composition.id + ' uses unknown component ' + component);
    if (!Array.isArray(composition.provides_substrates) || !composition.provides_substrates.length) throw new Error(composition.id + ' must provide a substrate');
    composition.provides_substrates.forEach(safeId);
  }
  return Object.freeze(lock);
}

function entryById(lock, id) {
  const entry = lock.entries.find((item) => item.id === safeId(id));
  if (!entry) throw new Error('unknown substrate: ' + id);
  return entry;
}
function downloadPath(root, entry) { return inside(root, 'downloads/' + entry.source.artifact_name); }
function runtimePath(root, entry) { return inside(root, 'runtimes/' + entry.installation.destination); }
function markerPath(root, entry) {
  const target = runtimePath(root, entry);
  return entry.installation.strategy === 'python-wheel' ? inside(target, '.axm-packages/' + entry.id + '.json') : path.join(target, '.axm-substrate.json');
}
function entrypointPath(root, entry, name) {
  const relative = entry.installation.entrypoints && entry.installation.entrypoints[name];
  if (!relative) throw new Error(entry.id + ' has no entrypoint ' + name);
  return inside(runtimePath(root, entry), relative);
}
function readMarker(root, entry) {
  try { return JSON.parse(fs.readFileSync(markerPath(root, entry), 'utf8')); }
  catch (error) { return null; }
}

function markerDigestMatches(marker) {
  if (!marker || !/^[a-f0-9]{64}$/.test(marker.digest || '')) return false;
  const copy = Object.assign({}, marker);
  const expected = copy.digest;
  delete copy.digest;
  return digest(copy) === expected;
}

async function fetchResponse(url, entry, redirects) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || !entry.source.allowed_hosts.includes(parsed.hostname)) throw new Error('download host is not allowlisted for ' + entry.id + ': ' + parsed.hostname);
  const response = await fetch(parsed, { redirect: 'manual', headers: { 'User-Agent': 'AXM-External-Substrate-Pack/1.0', 'Accept-Encoding': 'identity' }, signal: AbortSignal.timeout(120000) });
  if ([301, 302, 303, 307, 308].includes(response.status)) {
    if (redirects >= MAX_REDIRECTS) throw new Error('download redirect limit exceeded');
    const location = response.headers.get('location');
    if (!location) throw new Error('download redirect lacks a location');
    return fetchResponse(new URL(location, parsed).toString(), entry, redirects + 1);
  }
  if (!response.ok || !response.body) throw new Error('download failed with HTTP ' + response.status);
  const length = Number(response.headers.get('content-length'));
  if (Number.isFinite(length) && length !== entry.source.size_bytes) throw new Error('download byte length differs from lock for ' + entry.id);
  return response;
}

async function acquire(entry, root) {
  root = assertSafeRoot(root);
  const target = downloadPath(root, entry);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (fs.existsSync(target)) {
    const stat = fs.statSync(target);
    if (stat.size === entry.source.size_bytes && fileSha256(target) === entry.source.sha256) return { status: 'CACHED_VERIFIED', file: target };
    throw new Error('cached substrate artifact conflicts with lock: ' + entry.id);
  }
  const partial = target + '.partial-' + process.pid;
  if (fs.existsSync(partial)) throw new Error('partial substrate download already exists: ' + entry.id);
  const response = await fetchResponse(entry.source.asset_url, entry, 0);
  try {
    await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(partial, { flags: 'wx' }));
    const stat = fs.statSync(partial);
    if (stat.size !== entry.source.size_bytes) throw new Error('download byte length mismatch for ' + entry.id);
    if (fileSha256(partial) !== entry.source.sha256) throw new Error('download SHA-256 mismatch for ' + entry.id);
    fs.renameSync(partial, target);
    return { status: 'DOWNLOADED_VERIFIED', file: target };
  } catch (error) {
    if (fs.existsSync(partial)) fs.rmSync(partial, { force: true });
    throw error;
  }
}

function hashEntrypoints(root, entry) {
  const values = {};
  for (const [name] of Object.entries(entry.installation.entrypoints || {})) {
    const file = entrypointPath(root, entry, name);
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) throw new Error(entry.id + ' entrypoint missing after installation: ' + name);
    values[name] = fileSha256(file);
  }
  return values;
}
function stagePath(root, entry) {
  return inside(root, '.staging/' + entry.id + '-' + process.pid + '-' + crypto.randomBytes(6).toString('hex'));
}
function removeStage(root, stage) {
  const base = path.resolve(root, '.staging');
  const resolved = path.resolve(stage);
  if (!resolved.startsWith(base + path.sep)) throw new Error('refused unsafe substrate stage cleanup');
  if (fs.existsSync(resolved)) fs.rmSync(resolved, { recursive: true, force: true });
}
function commitStage(stage, target) {
  if (fs.existsSync(target)) throw new Error('substrate target already exists without a matching marker');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.renameSync(stage, target);
}
function writeMarker(file, entry, acquisition, entrypoints, extra) {
  const marker = Object.assign({
    schema: 'axm.external-substrate-install-marker/v1',
    id: entry.id,
    runtime_version: entry.runtime_version,
    source_artifact_sha256: entry.source.sha256,
    source_size_bytes: entry.source.size_bytes,
    licence_review_status: entry.licence.review_status,
    entrypoint_sha256: entrypoints || {},
    installed_by: 'axm-substrate-pack',
    network_execution_authority: false
  }, extra || {});
  marker.digest = digest(marker);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(marker, null, 2) + '\n', { flag: 'wx' });
  return marker;
}
function patchEmbeddedPython(stage) {
  const pth = fs.readdirSync(stage).find((name) => /^python\d+\._pth$/i.test(name));
  if (!pth) throw new Error('embedded Python path configuration is missing');
  const file = path.join(stage, pth);
  const zipLine = fs.readFileSync(file, 'utf8').split(/\r?\n/).find((line) => /^python\d+\.zip$/i.test(line.trim()));
  if (!zipLine) throw new Error('embedded Python standard library ZIP is missing');
  fs.writeFileSync(file, [zipLine.trim(), '.', 'Lib', 'Lib\\site-packages', 'import site', ''].join('\r\n'));
  fs.mkdirSync(path.join(stage, 'Lib', 'site-packages'), { recursive: true });
}
function filesRecursively(root) {
  const result = [];
  function walk(dir) {
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, item.name);
      if (item.isSymbolicLink()) throw new Error('symbolic link refused in substrate stage');
      if (item.isDirectory()) walk(full);
      else if (item.isFile()) result.push(full);
    }
  }
  walk(root); return result;
}
function mergeWheel(stage, target) {
  const installed = [];
  for (const source of filesRecursively(stage)) {
    const relative = path.relative(stage, source);
    const destination = inside(target, relative.replace(/\\/g, '/'));
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    if (fs.existsSync(destination)) {
      if (fileSha256(destination) !== fileSha256(source)) throw new Error('Python wheel file collision: ' + relative);
    } else fs.copyFileSync(source, destination, fs.constants.COPYFILE_EXCL);
    installed.push({ relative: relative.replace(/\\/g, '/'), sha256: fileSha256(source) });
  }
  return installed.sort((left, right) => left.relative.localeCompare(right.relative));
}
function escapeXml(value) { return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function findFirst(root, pattern) { return filesRecursively(root).find((file) => pattern.test(path.basename(file))) || null; }
function spawn(command, args, options) {
  const result = (options && options.runner || childProcess.spawnSync)(command, args, {
    encoding: 'utf8', windowsHide: true, shell: false, timeout: options && options.timeout || 120000, maxBuffer: 8 * 1024 * 1024,
    env: Object.assign({}, process.env, options && options.env || {})
  });
  return { status: result.status, error: result.error ? cleanText(result.error.code || result.error.message, 500) : null, stdout: cleanText(result.stdout, 200000), stderr: cleanText(result.stderr, 200000) };
}

function runNsis(installer, destination, options) {
  if (process.platform !== 'win32') return spawn(installer, ['/S', '/D=' + destination], options);
  const shell = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  const command = "$process = Start-Process -FilePath $env:AXM_INSTALLER_PATH -ArgumentList @('/S', ('/D=' + $env:AXM_INSTALL_DESTINATION)) -PassThru -Wait -WindowStyle Hidden; exit $process.ExitCode";
  return spawn(shell, ['-NoProfile', '-NonInteractive', '-Command', command], Object.assign({}, options, {
    env: { AXM_INSTALLER_PATH: installer, AXM_INSTALL_DESTINATION: destination },
    timeout: options && options.timeout || 180000
  }));
}

async function installOne(id, options) {
  options = options || {};
  const lock = options.lock || loadLock(options.lockPath);
  const root = assertSafeRoot(options.root || defaultRoot());
  const entry = entryById(lock, id);
  for (const dependency of entry.dependencies || []) await installOne(dependency, Object.assign({}, options, { lock, root }));
  const existing = verifyInstalled(entry, root);
  if (existing.status === 'INSTALLED_VERIFIED') return installReceipt(entry, 'ALREADY_INSTALLED', existing, false);
  const acquisition = await acquire(entry, root);
  const target = runtimePath(root, entry);
  const stage = stagePath(root, entry);
  fs.mkdirSync(path.dirname(stage), { recursive: true });
  try {
    if (entry.installation.strategy === 'extract-zip') {
      Zip.extractFile(acquisition.file, stage, { stripPrefix: entry.installation.strip_prefix });
      if (entry.id === 'python-cpython') patchEmbeddedPython(stage);
      const entrypoints = {};
      for (const [name, relative] of Object.entries(entry.installation.entrypoints || {})) {
        const file = inside(stage, relative);
        if (!fs.existsSync(file)) throw new Error(entry.id + ' entrypoint missing from archive: ' + name);
        entrypoints[name] = fileSha256(file);
      }
      writeMarker(path.join(stage, '.axm-substrate.json'), entry, acquisition, entrypoints);
      commitStage(stage, target);
    } else if (entry.installation.strategy === 'single-file') {
      fs.mkdirSync(stage, { recursive: true });
      const relative = Object.values(entry.installation.entrypoints || {})[0] || entry.source.artifact_name;
      fs.copyFileSync(acquisition.file, inside(stage, relative), fs.constants.COPYFILE_EXCL);
      const entrypoints = {};
      for (const [name, entryRelative] of Object.entries(entry.installation.entrypoints || {})) entrypoints[name] = fileSha256(inside(stage, entryRelative));
      writeMarker(path.join(stage, '.axm-substrate.json'), entry, acquisition, entrypoints);
      commitStage(stage, target);
    } else if (entry.installation.strategy === 'python-wheel') {
      if (!fs.existsSync(target)) throw new Error('Python dependency target is not installed');
      fs.mkdirSync(stage, { recursive: true });
      Zip.extractFile(acquisition.file, stage);
      const installed = mergeWheel(stage, inside(target, 'Lib/site-packages'));
      writeMarker(markerPath(root, entry), entry, acquisition, {}, { installed_files_digest: digest(installed), installed_file_count: installed.length, installed_files: installed });
      removeStage(root, stage);
    } else if (entry.installation.strategy === 'nsis') {
      fs.mkdirSync(stage, { recursive: true });
      const result = runNsis(acquisition.file, stage, options);
      if (result.error || result.status !== 0) throw new Error('NSIS installer failed: ' + (result.error || result.stderr || result.status));
      const entrypoints = {};
      for (const [name, relative] of Object.entries(entry.installation.entrypoints || {})) entrypoints[name] = fileSha256(inside(stage, relative));
      writeMarker(path.join(stage, '.axm-substrate.json'), entry, acquisition, entrypoints);
      commitStage(stage, target);
    } else if (entry.installation.strategy === 'izpack') {
      const unpacked = stage + '-installer';
      Zip.extractFile(acquisition.file, unpacked);
      const jar = findFirst(unpacked, /^verapdf-izpack-installer-.*\.jar$/i);
      if (!jar) throw new Error('veraPDF IzPack installer JAR is missing');
      fs.mkdirSync(stage, { recursive: true });
      const automation = path.join(unpacked, 'axm-install.xml');
      const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<AutomatedInstallation langpack="eng">\n' +
        '  <com.izforge.izpack.panels.htmlhello.HTMLHelloPanel id="welcome"/>\n' +
        '  <com.izforge.izpack.panels.target.TargetPanel id="install_dir"><installpath>' + escapeXml(stage) + '</installpath></com.izforge.izpack.panels.target.TargetPanel>\n' +
        '  <com.izforge.izpack.panels.packs.PacksPanel id="sdk_pack_select"><pack index="0" name="veraPDF GUI" selected="false"/><pack index="1" name="veraPDF CLI" selected="true"/><pack index="2" name="veraPDF Documentation" selected="false"/><pack index="3" name="veraPDF Sample Plugins" selected="false"/></com.izforge.izpack.panels.packs.PacksPanel>\n' +
        '  <com.izforge.izpack.panels.install.InstallPanel id="install"/><com.izforge.izpack.panels.finish.FinishPanel id="finish"/>\n</AutomatedInstallation>\n';
      fs.writeFileSync(automation, xml);
      const javaEntry = entryById(lock, 'java-temurin-jre');
      const result = spawn(entrypointPath(root, javaEntry, 'java'), ['-jar', jar, automation], options);
      if (result.error || result.status !== 0) throw new Error('veraPDF IzPack installer failed: ' + (result.error || result.stderr || result.status));
      removeStage(root, unpacked);
      const entrypoints = {};
      for (const [name, relative] of Object.entries(entry.installation.entrypoints || {})) entrypoints[name] = fileSha256(inside(stage, relative));
      writeMarker(path.join(stage, '.axm-substrate.json'), entry, acquisition, entrypoints);
      commitStage(stage, target);
    } else throw new Error('unsupported substrate installation strategy');
    const verified = verifyInstalled(entry, root);
    if (verified.status !== 'INSTALLED_VERIFIED') throw new Error('installed substrate failed verification: ' + verified.reason);
    return installReceipt(entry, 'INSTALLED', verified, acquisition.status === 'DOWNLOADED_VERIFIED');
  } catch (error) {
    if (fs.existsSync(stage)) removeStage(root, stage);
    const installerStage = stage + '-installer';
    if (fs.existsSync(installerStage)) removeStage(root, installerStage);
    throw error;
  }
}

function verifyInstalled(entry, root) {
  root = assertSafeRoot(root);
  const marker = readMarker(root, entry);
  if (!marker) return { status: 'MISSING', reason: 'install marker is absent' };
  if (!markerDigestMatches(marker)) return { status: 'TAMPERED', reason: 'install marker digest is invalid' };
  if (marker.id !== entry.id || marker.runtime_version !== entry.runtime_version || marker.source_artifact_sha256 !== entry.source.sha256) return { status: 'TAMPERED', reason: 'install marker does not match lock' };
  const archive = downloadPath(root, entry);
  if (!fs.existsSync(archive) || fs.statSync(archive).size !== entry.source.size_bytes || fileSha256(archive) !== entry.source.sha256) return { status: 'TAMPERED', reason: 'source archive does not match lock' };
  try {
    for (const [name, expected] of Object.entries(marker.entrypoint_sha256 || {})) if (fileSha256(entrypointPath(root, entry, name)) !== expected) return { status: 'TAMPERED', reason: 'installed entrypoint digest mismatch: ' + name };
    if (entry.installation.strategy === 'python-wheel') {
      if (!Array.isArray(marker.installed_files) || marker.installed_files.length !== marker.installed_file_count || digest(marker.installed_files) !== marker.installed_files_digest) return { status: 'TAMPERED', reason: 'installed Python file manifest is invalid' };
      const sitePackages = inside(runtimePath(root, entry), 'Lib/site-packages');
      for (const item of marker.installed_files) {
        if (!item || !/^[a-f0-9]{64}$/.test(item.sha256 || '')) return { status: 'TAMPERED', reason: 'installed Python file manifest contains an invalid digest' };
        const file = inside(sitePackages, item.relative);
        if (!fs.existsSync(file) || !fs.statSync(file).isFile() || fileSha256(file) !== item.sha256) return { status: 'TAMPERED', reason: 'installed Python file digest mismatch: ' + cleanText(item.relative, 200) };
      }
    }
  } catch (error) { return { status: 'TAMPERED', reason: cleanText(error.message, 300) }; }
  return { status: 'INSTALLED_VERIFIED', reason: 'source and installed entrypoints match the exact lock', source_artifact_sha256: entry.source.sha256, marker_digest: marker.digest };
}

function renderProbe(entry, lock, root) {
  const probe = entry.probe;
  if (probe.mode === 'configuration') return { command: null, args: [], content: fs.readFileSync(entrypointPath(root, entry, probe.entrypoint), 'utf8') };
  if (probe.mode === 'zip-entry') {
    const names = Zip.list(fs.readFileSync(entrypointPath(root, entry, probe.entrypoint))).map((item) => item.name);
    if (probe.zip_entry && !names.includes(probe.zip_entry)) throw new Error('required ZIP probe entry is missing');
    return { command: null, args: [], content: names.join('\n') };
  }
  if (probe.mode === 'python-import') {
    const python = entryById(lock, 'python-cpython');
    const code = 'import ' + probe.module + '\nprint(' + probe.version_expression + ')';
    return { command: entrypointPath(root, python, 'python'), args: ['-c', code] };
  }
  let command;
  if (probe.dependency_entrypoint) {
    const [id, name] = probe.dependency_entrypoint.split(':');
    command = entrypointPath(root, entryById(lock, id), name);
  } else command = entrypointPath(root, entry, probe.entrypoint);
  const args = (probe.args || []).map((arg) => arg.replace(/\{entrypoint:([^}]+)\}/g, (match, name) => entrypointPath(root, entry, name)));
  return { command, args };
}
function runBatch(command, args, options) {
  if (process.platform !== 'win32' || !/\.(cmd|bat)$/i.test(command)) return spawn(command, args, options);
  const shell = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  const script = '$arguments = ConvertFrom-Json $env:AXM_BATCH_ARGS; & $env:AXM_BATCH_PATH @arguments; if ($null -eq $LASTEXITCODE) { exit 0 } else { exit $LASTEXITCODE }';
  return spawn(shell, ['-NoProfile', '-NonInteractive', '-Command', script], Object.assign({}, options, {
    env: Object.assign({}, options && options.env || {}, { AXM_BATCH_PATH: command, AXM_BATCH_ARGS: JSON.stringify(args) })
  }));
}
function probeOne(entry, lock, root, options) {
  const installed = verifyInstalled(entry, root);
  if (installed.status !== 'INSTALLED_VERIFIED') return { id: entry.id, runtime_version: entry.runtime_version, status: installed.status, reason: installed.reason, capabilities: entry.capabilities.slice(), provides_substrates: [] };
  for (const dependency of entry.dependencies || []) {
    const dep = probeOne(entryById(lock, dependency), lock, root, options);
    if (dep.status !== 'READY') return { id: entry.id, runtime_version: entry.runtime_version, status: 'DEPENDENCY_HOLD', reason: dependency + ' is ' + dep.status, capabilities: entry.capabilities.slice(), provides_substrates: [] };
  }
  let output = '';
  let execution = null;
  try {
    const rendered = renderProbe(entry, lock, root);
    if (entry.probe.mode === 'configuration' || entry.probe.mode === 'zip-entry') output = rendered.content;
    else {
      const probeOptions = Object.assign({}, options || {});
      if ((entry.dependencies || []).includes('java-temurin-jre')) {
        const java = entryById(lock, 'java-temurin-jre');
        const javaBin = path.dirname(entrypointPath(root, java, 'java'));
        probeOptions.env = Object.assign({}, options && options.env || {}, { PATH: javaBin + path.delimiter + (process.env.PATH || '') });
      }
      execution = runBatch(rendered.command, rendered.args, probeOptions);
      output = execution.stdout + '\n' + execution.stderr;
      const successStatuses = entry.probe.success_statuses || [0];
      if (execution.error || !successStatuses.includes(execution.status)) return { id: entry.id, runtime_version: entry.runtime_version, status: 'PROBE_FAILED', reason: cleanText(execution.error || output || 'non-zero probe exit', 500), capabilities: entry.capabilities.slice(), provides_substrates: [] };
    }
    if (!(new RegExp(entry.probe.version_pattern, 'i')).test(output)) return { id: entry.id, runtime_version: entry.runtime_version, status: 'VERSION_MISMATCH', reason: 'live probe output does not match the pinned version', capabilities: entry.capabilities.slice(), provides_substrates: [] };
    return { id: entry.id, runtime_version: entry.runtime_version, status: 'READY', reason: 'exact archive, entrypoints, dependencies and live version probe passed', artifact_sha256: entry.source.sha256, marker_digest: installed.marker_digest, probe_digest: digest({ status: execution && execution.status || 0, output: cleanText(output, 1000) }), capabilities: entry.capabilities.slice(), provides_substrates: entry.provides_substrates.slice(), licence_review_status: entry.licence.review_status };
  } catch (error) { return { id: entry.id, runtime_version: entry.runtime_version, status: 'PROBE_FAILED', reason: cleanText(error.message, 500), capabilities: entry.capabilities.slice(), provides_substrates: [] }; }
}

function inventory(options) {
  options = options || {};
  const lock = options.lock || loadLock(options.lockPath);
  const root = assertSafeRoot(options.root || defaultRoot());
  const items = lock.entries.map((entry) => probeOne(entry, lock, root, options));
  const compositions = (lock.compositions || []).map((composition) => {
    const missing = composition.components.filter((id) => !items.some((item) => item.id === id && item.status === 'READY'));
    return {
      id: composition.id,
      status: missing.length ? 'DEPENDENCY_HOLD' : 'READY',
      reason: missing.length ? 'one or more exact component runtimes are unavailable: ' + missing.join(', ') : 'all exact component runtimes passed their live probes',
      components: composition.components.slice(),
      capabilities: composition.capabilities.slice(),
      provides_substrates: missing.length ? [] : composition.provides_substrates.slice(),
      evidence_basis: composition.evidence_basis,
    };
  });
  const available = Array.from(new Set(items.filter((item) => item.status === 'READY').flatMap((item) => item.provides_substrates).concat(compositions.filter((item) => item.status === 'READY').flatMap((item) => item.provides_substrates)))).sort();
  const counts = items.reduce((out, item) => { out[item.status] = (out[item.status] || 0) + 1; return out; }, {});
  const compositionCounts = compositions.reduce((out, item) => { out[item.status] = (out[item.status] || 0) + 1; return out; }, {});
  const result = { schema: INVENTORY_SCHEMA, version: '1.0.0', lock_version: lock.version, platform: lock.platform, counts, composition_counts: compositionCounts, available_substrates: available, items, compositions, private_location_retained: false, automatic_installation: false };
  result.digest = digest(result);
  TRUSTED_INVENTORIES.add(result);
  return result;
}

function trustedInventory(value, lock) {
  if (!value || !TRUSTED_INVENTORIES.has(value)) throw new Error('inventory snapshot was not observed by this substrate-pack process');
  const copy = Object.assign({}, value);
  const expected = copy.digest;
  delete copy.digest;
  if (digest(copy) !== expected) throw new Error('inventory snapshot digest is invalid');
  if (value.schema !== INVENTORY_SCHEMA || value.lock_version !== lock.version || value.platform !== lock.platform) throw new Error('inventory snapshot does not match the active lock');
  const observedIds = value.items.map((item) => item.id).sort();
  const lockedIds = lock.entries.map((item) => item.id).sort();
  if (observedIds.length !== lockedIds.length || observedIds.some((id, index) => id !== lockedIds[index])) throw new Error('inventory snapshot is incomplete');
  return value;
}

const REQUEST_MAP = Object.freeze({
  godot: ['godot'], epubcheck: ['epubcheck'], verapdf: ['verapdf'],
  'openimageio-openexr': ['openimageio', 'openexr'], 'gltf-validator': ['gltf-validator'],
  'ktx-tools': ['ktx-tools'], opencolorio: ['opencolorio', 'ocio-aces-config'], materialx: ['materialx'],
  blender: ['blender'], 'offline-renderer': ['blender'], 'cross-renderer-runtime': ['godot', 'blender'],
  ffmpeg: ['ffmpeg'], 'independent-audio-decoder': ['ffmpeg'], 'independent-av-decoder': ['ffmpeg'], 'loudness-meter': ['ffmpeg'], 'video-muxer': ['ffmpeg'],
  pyembroidery: ['pyembroidery'], 'embroidery-parser-or-simulator': ['pyembroidery'],
  'three-mf-editor': ['three-mf-editor'], 'official-3mf-validator': ['three-mf-editor'],
  'cadquery-ocp': ['cadquery-ocp'], 'brep-step-kernel': ['cadquery-ocp']
});
function resolveRequest(request, options) {
  options = options || {};
  const wanted = request && request.id;
  const ids = REQUEST_MAP[wanted] || [wanted];
  const lock = options.lock || loadLock(options.lockPath);
  const current = options.inventory ? trustedInventory(options.inventory, lock) : inventory(Object.assign({}, options, { lock }));
  const selected = ids.map((id) => current.items.find((item) => item.id === id)).filter(Boolean);
  if (selected.length !== ids.length || selected.some((item) => item.status !== 'READY')) return { schema: 'axm.runtime-substrate-resolution/v1', status: 'MISSING', reason: 'one or more exact external substrates are unavailable', selected: null, inventory_digest: current.digest, missing: ids.filter((id) => !selected.some((item) => item.id === id && item.status === 'READY')), installation_performed: false, private_location_retained: false };
  const runtime = { id: wanted, runtime_version: selected.map((item) => item.runtime_version).join('+'), artifact_sha256: digest(selected.map((item) => item.artifact_sha256)), component_digests: selected.map((item) => ({ id: item.id, artifact_sha256: item.artifact_sha256, marker_digest: item.marker_digest })), capabilities: Array.from(new Set(selected.flatMap((item) => item.capabilities))).sort(), licence_review_status: 'REVIEWED_FOR_LOCAL_TEST' };
  const result = { schema: 'axm.runtime-substrate-resolution/v1', status: 'READY', reason: 'all exact external substrate components passed live probes', selected: runtime, inventory_digest: current.digest, missing: [], installation_performed: false, private_location_retained: false };
  result.digest = digest(result); return result;
}
function installReceipt(entry, status, verification, downloaded) {
  const receipt = { schema: INSTALL_RECEIPT_SCHEMA, version: '1.0.0', substrate: { id: entry.id, runtime_version: entry.runtime_version }, status, source_artifact_sha256: entry.source.sha256, source_size_bytes: entry.source.size_bytes, verification, downloaded: downloaded === true, executed_installer: ['nsis', 'izpack'].includes(entry.installation.strategy), private_location_retained: false, automatic_installation: false, licence_review_status: entry.licence.review_status };
  receipt.digest = digest(receipt); return receipt;
}

module.exports = { LOCK_SCHEMA, INVENTORY_SCHEMA, INSTALL_RECEIPT_SCHEMA, LOCK_PATH, sha256, digest, cleanText, loadLock, entryById, defaultRoot, assertSafeRoot, acquire, installOne, verifyInstalled, probeOne, inventory, resolveRequest, entrypointPath, runtimePath, spawn, runBatch };
