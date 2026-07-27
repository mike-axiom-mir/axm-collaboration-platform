'use strict';

const assert = require('assert');
const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Core = require('./recipe-core');

const MODULE_ROOT = __dirname;
const REQUIRED = [
  'code_cheats_1000.html', 'code_cheats_1000.xlsx', 'code_cheats_1000.csv',
  'code_cheats_1000.json', 'CODE_CHEATS_1000_README.md', 'code_cheats_1000_quality_report.json'
];
const RISK_PATTERN = /(rm\s+-rf|drop\s+(table|database)|kubectl\s+delete|terraform\s+destroy|git\s+(reset\s+--hard|push\s+--force)|docker\s+system\s+prune|remove-item.*-recurse|curl[^\n]*\|\s*(sh|bash)|chmod\s+777|dd\s+if=|truncate\s+-s\s+0|delete\s+from|revoke\s+|alter\s+user|npm\s+publish|gh\s+release|kubectl\s+apply|terraform\s+apply)/i;

function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function normalizeText(value) { return String(value == null ? '' : value).replace(/\r\n?/g, '\n'); }

function readBundle(zipPath) {
  zipPath = path.resolve(zipPath);
  if (!fs.existsSync(zipPath) || !fs.statSync(zipPath).isFile()) throw new Error('bundle file does not exist');
  const script = String.raw`
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=[Text.Encoding]::UTF8
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zipPath=[Environment]::GetEnvironmentVariable('AXM_CODE_RECIPE_BUNDLE')
$required=@('code_cheats_1000.html','code_cheats_1000.xlsx','code_cheats_1000.csv','code_cheats_1000.json','CODE_CHEATS_1000_README.md','code_cheats_1000_quality_report.json')
$zip=[System.IO.Compression.ZipFile]::OpenRead($zipPath)
try {
  if($zip.Entries.Count -gt 20){throw 'archive entry limit exceeded'}
  $total=0L; $meta=@(); $files=[ordered]@{}
  foreach($entry in $zip.Entries){
    $name=$entry.FullName.Replace('\','/')
    if($name.StartsWith('/') -or $name -match '^[A-Za-z]:' -or @($name.Split('/')|Where-Object{$_ -eq '..'}).Count -gt 0){throw ('unsafe archive path: '+$name)}
    $total += $entry.Length
    if($total -gt 10485760){throw 'archive uncompressed limit exceeded'}
    if($entry.CompressedLength -gt 0 -and ($entry.Length / $entry.CompressedLength) -gt 100){throw ('archive compression ratio refused: '+$name)}
    $meta += [ordered]@{name=$name;bytes=$entry.Length;compressed=$entry.CompressedLength}
  }
  foreach($name in $required){
    $entry=$zip.GetEntry($name); if(-not $entry){throw ('required bundle entry missing: '+$name)}
    if($name -in @('code_cheats_1000.json','code_cheats_1000.csv','CODE_CHEATS_1000_README.md','code_cheats_1000_quality_report.json')){
      $stream=$entry.Open(); $memory=[IO.MemoryStream]::new()
      try{$stream.CopyTo($memory);$files[$name]=[Convert]::ToBase64String($memory.ToArray())}finally{$memory.Dispose();$stream.Dispose()}
    }
  }
  [ordered]@{entries=$meta;files=$files}|ConvertTo-Json -Depth 6 -Compress
} finally {$zip.Dispose()}`;
  const run = childProcess.spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
    cwd: MODULE_ROOT,
    env: Object.assign({}, process.env, { AXM_CODE_RECIPE_BUNDLE: zipPath }),
    encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, windowsHide: true
  });
  if (run.status !== 0) throw new Error('bundle read refused: ' + String(run.stderr || run.stdout).trim());
  const envelope = JSON.parse(run.stdout);
  const files = {};
  Object.keys(envelope.files).forEach(name => { files[name] = Buffer.from(envelope.files[name], 'base64'); });
  return { zipPath, zipBytes: fs.statSync(zipPath).size, zipSha256: sha256(fs.readFileSync(zipPath)), entries: envelope.entries, files };
}

function categoryCounts(rows) {
  return rows.reduce((out, row) => { out[row.category] = Number(out[row.category] || 0) + 1; return out; }, {});
}
function difficultyCounts(rows) {
  return rows.reduce((out, row) => { out[row.difficulty] = Number(out[row.difficulty] || 0) + 1; return out; }, {});
}
function comparable(row) {
  const fields = ['id','rank','category','category_rank','title','snippet','what_it_does','notes_safety','difficulty','platform','version_basis','source_url','research_date','verification'];
  const out = {};
  fields.forEach(field => { out[field] = normalizeText(row[field]); });
  out.tags = Core.parseTags(row.tags).map(value => value.toLowerCase()).sort();
  return Core.stableStringify(out);
}

function transformRow(row) {
  const notesSafety = normalizeText(row.notes_safety).trim();
  const holdReasons = [];
  if (RISK_PATTERN.test(normalizeText(row.snippet)) && !notesSafety) holdReasons.push('SAFETY_NOTE_MISSING_FOR_CONSEQUENTIAL_COMMAND');
  return {
    rank: Number(row.rank), title: row.title, snippet: row.snippet, description: row.what_it_does,
    primaryLanguage: row.category, domain: row.category, tags: row.tags, sourceUrl: row.source_url,
    popularityIndicator: 'Popularity not measured; editorial global rank #' + Number(row.rank) + '.',
    popularityScope: 'not-measured', rankingBasis: 'EDITORIAL_NOT_POPULARITY_MEASURED',
    familyKey: Core.slug(row.category + ' ' + row.title), familyKeySource: 'DERIVED_CATEGORY_TITLE',
    sourceId: row.id, categoryRank: Number(row.category_rank), notesSafety: notesSafety,
    difficulty: row.difficulty, platform: row.platform, versionBasis: row.version_basis,
    researchDate: row.research_date, verification: row.verification, holdReasons
  };
}

function compileBundle(bundle, observedAt) {
  const readme = bundle.files['CODE_CHEATS_1000_README.md'].toString('utf8');
  const quality = JSON.parse(bundle.files['code_cheats_1000_quality_report.json'].toString('utf8'));
  const source = JSON.parse(bundle.files['code_cheats_1000.json'].toString('utf8'));
  const jsonRows = Array.isArray(source.cheats) ? source.cheats : [];
  const csvRows = Core.parseCsv(bundle.files['code_cheats_1000.csv'].toString('utf8'));
  assert.equal(jsonRows.length, 1000, 'JSON must contain exactly 1,000 rows');
  assert.equal(csvRows.length, 1000, 'CSV must contain exactly 1,000 rows');
  assert.equal(Number(source.metadata && source.metadata.entry_count), 1000, 'metadata count must be 1,000');
  assert.equal(Number(quality.entry_count), 1000, 'quality-report count must be 1,000');
  assert.equal(new Set(jsonRows.map(row => row.id)).size, 1000, 'source ids must be unique');
  assert.equal(Object.keys(categoryCounts(jsonRows)).length, 25, '25 categories are required');
  Object.values(categoryCounts(jsonRows)).forEach(count => assert.equal(count, 40, 'each category must contain 40 rows'));
  assert.deepEqual(difficultyCounts(jsonRows), { Beginner:500, Intermediate:350, Advanced:150 }, 'difficulty distribution mismatch');
  jsonRows.forEach((row, index) => assert.equal(comparable(row), comparable(csvRows[index]), 'JSON/CSV mismatch at source row ' + (index + 1)));
  const canonical = jsonRows.map(transformRow);
  const result = Core.ingest(JSON.stringify(canonical), { format:'json', maxSnippetLines:20, reviewPolicy:'LONG_FORM_HOLD' });
  assert.equal(result.summary.rawRows, 1000, 'intake raw count mismatch');
  assert.equal(result.summary.accepted, 1000, 'all rows must remain structurally represented');
  assert.equal(result.summary.rejectedRows, 0, 'no source row may be silently rejected');
  assert.equal(result.summary.exactDuplicates, 0, 'exact duplicate found');
  assert.equal(result.summary.reviewReady, 937, 'review-ready count changed');
  assert.equal(result.summary.held, 63, 'review-hold count changed');
  assert.equal(result.summary.families, 1000, 'mechanical family count changed');
  const generatedAt = observedAt || new Date().toISOString();
  const pack = Core.buildPack(result, { label:'code_cheats_1000_bundle.zip', generatedAt });
  pack.source = {
    label: 'code_cheats_1000_bundle.zip', format: 'json+csv-cross-check', originalArtifactAvailable: true,
    bundleSha256: bundle.zipSha256, bundleBytes: bundle.zipBytes,
    jsonSha256: sha256(bundle.files['code_cheats_1000.json']), csvSha256: sha256(bundle.files['code_cheats_1000.csv']),
    readmeSha256: sha256(bundle.files['CODE_CHEATS_1000_README.md']), qualityReportSha256: sha256(bundle.files['code_cheats_1000_quality_report.json']),
    researchDate: source.metadata.research_date, rankingNote: source.metadata.ranking_note,
    verificationNote: source.metadata.verification_note, licenseNote: source.metadata.license_note,
    jsonCsvRowsMatched: 1000, categoryCount: 25, entriesPerCategory: 40
  };
  pack.summary.categoryCounts = categoryCounts(jsonRows);
  pack.summary.difficultyCounts = difficultyCounts(jsonRows);
  pack.summary.longFormHolds = result.issues.filter(item => item.code === 'SNIPPET_LONG_FORM_HOLD').length;
  pack.summary.safetyNoteHolds = result.issues.filter(item => item.code === 'DECLARED_REVIEW_HOLD').length;
  pack.truth.popularityMeasured = false;
  pack.truth.editorialRankPreserved = true;
  pack.truth.jsonCsvCrossCheck = true;
  pack.truth.recipeSetSha256 = sha256(Core.stableStringify(pack.recipes));
  const receipt = Core.buildReceipt(result, { label:'code_cheats_1000_bundle.zip', observedAt:generatedAt });
  receipt.source = pack.source;
  receipt.bundleChecks = {
    archiveSafe: true, requiredEntries: REQUIRED, entryCount: bundle.entries.length,
    jsonCsvRowsMatched: 1000, uniqueSourceIds: 1000, exactDuplicates: 0,
    categories: 25, entriesPerCategory: 40, popularityMeasured: false,
    priorNarrativeMatchesBundle: false,
    mismatchTruth: 'Recovered bundle is 25 categories x 40 with editorial ranking and no declared semantic families; it is not the earlier 22-stack / 600-family narrative.'
  };
  return { pack, receipt, readme, quality, sourceMetadata:source.metadata };
}

function writeCompiled(compiled, outputDir) {
  outputDir = path.resolve(outputDir || path.join(MODULE_ROOT, 'catalog'));
  const allowed = path.resolve(MODULE_ROOT, 'catalog');
  if (outputDir !== allowed) throw new Error('catalog output is restricted to the module-local catalog folder');
  fs.mkdirSync(outputDir, { recursive:true });
  const files = {
    'code-cheats-1000.code-recipes.json': JSON.stringify(compiled.pack, null, 2) + '\n',
    'code-cheats-1000.intake-receipt.json': JSON.stringify(compiled.receipt, null, 2) + '\n',
    'SOURCE_README.md': compiled.readme.replace(/\r\n?/g, '\n'),
    'source-quality-report.json': JSON.stringify(compiled.quality, null, 2) + '\n'
  };
  Object.keys(files).forEach(name => fs.writeFileSync(path.join(outputDir, name), files[name], 'utf8'));
  return Object.keys(files).map(name => ({ path:path.relative(MODULE_ROOT, path.join(outputDir, name)).replace(/\\/g, '/'), sha256:sha256(files[name]), bytes:Buffer.byteLength(files[name]) }));
}

function parseArgs(argv) {
  const sourceIndex = argv.indexOf('--source');
  return { source:sourceIndex >= 0 ? argv[sourceIndex + 1] : null, write:argv.includes('--write') };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.source) throw new Error('--source <bundle.zip> is required');
  const bundle = readBundle(args.source);
  const compiled = compileBundle(bundle);
  const files = args.write ? writeCompiled(compiled) : [];
  console.log(JSON.stringify({
    schema:'axm.code-recipe-bundle-compile/v1', mode:args.write ? 'WRITE' : 'DRY_RUN',
    source:{file:path.basename(bundle.zipPath),sha256:bundle.zipSha256,entries:bundle.entries.length},
    summary:compiled.pack.summary, truth:compiled.pack.truth, files
  }, null, 2));
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }
}

module.exports = { REQUIRED, RISK_PATTERN, categoryCounts, difficultyCounts, comparable, transformRow, compileBundle, writeCompiled, readBundle };
