'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TEXT_EXTENSIONS = new Set(['.js', '.json', '.md', '.html', '.css', '.bat', '.ps1', '.txt', '.yml', '.yaml']);
const PRIVATE_PREFIXES = ['state/', 'logs/', 'training/datasets/', 'training/candidates/'];

function forward(value) { return String(value).replace(/\\/g, '/'); }

function walk(directory, root, output) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === '.git') continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(absolute, root, output);
    else if (entry.isFile()) output.push({ absolute, relative: forward(path.relative(root, absolute)), bytes: fs.statSync(absolute).size });
  }
}

function sum(items, key) { return items.reduce((total, item) => total + Number(item[key] || 0), 0); }

function scan(root) {
  root = path.resolve(root || ROOT);
  const files = [];
  walk(root, root, files);
  const privateFiles = files.filter(file => PRIVATE_PREFIXES.some(prefix => file.relative.startsWith(prefix)));
  const inspectable = files.filter(file => !privateFiles.includes(file) && TEXT_EXTENSIONS.has(path.extname(file.relative).toLowerCase())).map(file => {
    const content = fs.readFileSync(file.absolute, 'utf8');
    return Object.assign({}, file, { characters: content.length, lines: (content.match(/\n/g) || []).length + 1, area: file.relative.split('/')[0] });
  });
  const areas = Array.from(new Set(inspectable.map(file => file.area))).map(area => {
    const subset = inspectable.filter(file => file.area === area);
    return { area, files: subset.length, characters: sum(subset, 'characters'), lines: sum(subset, 'lines'), bytes: sum(subset, 'bytes') };
  }).sort((a, b) => b.characters - a.characters || a.area.localeCompare(b.area));
  return {
    wholeBody: { files: files.length, bytes: sum(files, 'bytes') },
    inspectable: { files: inspectable.length, characters: sum(inspectable, 'characters'), lines: sum(inspectable, 'lines'), bytes: sum(inspectable, 'bytes') },
    privateLearningAndEvidence: { files: privateFiles.length, bytes: sum(privateFiles, 'bytes') },
    areas
  };
}

function latestSnapshot(directory) {
  if (!fs.existsSync(directory)) return null;
  const files = fs.readdirSync(directory).filter(name => /^mirror-growth-.*\.json$/i.test(name)).sort();
  if (!files.length) return null;
  try { return JSON.parse(fs.readFileSync(path.join(directory, files[files.length - 1]), 'utf8')); } catch (_) { return null; }
}

function run(options) {
  options = options || {};
  const root = path.resolve(options.root || ROOT);
  const outDir = path.resolve(options.outDir || path.join(root, 'state', 'growth-snapshots'));
  const previous = latestSnapshot(outDir);
  const metrics = scan(root);
  const createdAt = new Date().toISOString();
  const report = {
    schema: 'axm.mirror.growth-snapshot/v1',
    snapshotId: `mirror-growth-${createdAt.replace(/[^0-9]/g, '').slice(0, 17)}`,
    identity: 'axm.machine.mirror/seed-0', createdAt, metrics,
    deltaFromPrevious: previous ? {
      previousSnapshotId: previous.snapshotId,
      wholeBodyFiles: metrics.wholeBody.files - previous.metrics.wholeBody.files,
      wholeBodyBytes: metrics.wholeBody.bytes - previous.metrics.wholeBody.bytes,
      inspectableFiles: metrics.inspectable.files - previous.metrics.inspectable.files,
      inspectableCharacters: metrics.inspectable.characters - previous.metrics.inspectable.characters,
      inspectableLines: metrics.inspectable.lines - previous.metrics.inspectable.lines,
      privateLearningFiles: metrics.privateLearningAndEvidence.files - previous.metrics.privateLearningAndEvidence.files,
      privateLearningBytes: metrics.privateLearningAndEvidence.bytes - previous.metrics.privateLearningAndEvidence.bytes
    } : null,
    boundary: 'File, byte, character, and line growth measures body size, not intelligence, quality, maturity, or safety.'
  };
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, `${report.snapshotId}.json`);
  if (fs.existsSync(file)) throw new Error(`growth snapshot already exists: ${file}`);
  fs.writeFileSync(file, JSON.stringify(report, null, 2) + '\n', 'utf8');
  return { report, file };
}

if (require.main === module) {
  try {
    const result = run();
    const metrics = result.report.metrics;
    console.log(`Mirror: ${metrics.wholeBody.files} files · ${(metrics.wholeBody.bytes / 1048576).toFixed(2)} MB whole body`);
    console.log(`Inspectable: ${metrics.inspectable.files} files · ${metrics.inspectable.characters.toLocaleString('en-US')} characters · ${metrics.inspectable.lines.toLocaleString('en-US')} lines`);
    console.log(`Private learning/evidence: ${metrics.privateLearningAndEvidence.files} files · ${(metrics.privateLearningAndEvidence.bytes / 1048576).toFixed(2)} MB`);
    if (result.report.deltaFromPrevious) console.log(`Since ${result.report.deltaFromPrevious.previousSnapshotId}: ${result.report.deltaFromPrevious.inspectableCharacters >= 0 ? '+' : ''}${result.report.deltaFromPrevious.inspectableCharacters.toLocaleString('en-US')} characters`);
    else console.log('First Mirror growth baseline recorded.');
    console.log(`Snapshot: ${result.file}`);
  } catch (error) {
    console.error(`SCAN REFUSED: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = { scan, run };
