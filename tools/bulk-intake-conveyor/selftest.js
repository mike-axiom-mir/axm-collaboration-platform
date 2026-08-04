#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Core = require('./core/conveyor-core');

let checks = 0;
function check(label, action) {
  action();
  checks += 1;
  process.stdout.write('PASS ' + label + '\n');
}

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let value = 0; value < 256; value += 1) {
    let crc = value;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc & 1) ? (0xedb88320 ^ (crc >>> 1)) : (crc >>> 1);
    table[value] = crc >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function makeZip(entries) {
  const locals = [];
  const centrals = [];
  let localOffset = 0;
  for (const input of entries) {
    const name = Buffer.from(String(input.name), 'utf8');
    const body = Buffer.from(input.content === undefined ? '' : input.content);
    let flags = 0x0800;
    if (input.encrypted) flags |= 0x0001;
    const crc = crc32(body);
    const local = Buffer.alloc(30 + name.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(flags, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(body.length, 22);
    local.writeUInt16LE(name.length, 26);
    name.copy(local, 30);
    locals.push(local, body);

    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(flags, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(body.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(localOffset, 42);
    name.copy(central, 46);
    centrals.push(central);
    localOffset += local.length + body.length;
  }
  const centralBody = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBody.length, 12);
  end.writeUInt32LE(localOffset, 16);
  return Buffer.concat([...locals, centralBody, end]);
}

function moduleEntries(id, marker, options = {}) {
  return [
    { name: id + '/manifest.json', content: JSON.stringify({ id, version: 'v0.1', status: 'TEST', entry: 'index.html' }), encrypted: options.encrypted },
    { name: id + '/module.contract.json', content: JSON.stringify({ schema: 'axm.module-contract/v1', id, version: 'v0.1' }) },
    { name: id + '/index.html', content: '<main>' + marker + '</main>' }
  ];
}

function recursiveSnapshot(root) {
  const rows = [];
  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else rows.push(path.relative(root, absolute) + ':' + fs.statSync(absolute).size);
    }
  }
  visit(root);
  return rows;
}

const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-bulk-intake-'));
try {
  const workshop = path.join(fixtureRoot, 'workshop');
  const supply = path.join(fixtureRoot, 'supply');
  const alpha = path.join(workshop, 'tools', 'alpha');
  fs.mkdirSync(alpha, { recursive: true });
  fs.mkdirSync(supply, { recursive: true });
  fs.writeFileSync(path.join(alpha, 'manifest.json'), JSON.stringify({ id: 'alpha', version: 'v1', status: 'WORKING' }));

  const firstBytes = makeZip(moduleEntries('module-new-01', 'one'));
  fs.writeFileSync(path.join(supply, '01-new.zip'), firstBytes);
  fs.writeFileSync(path.join(supply, '02-new-copy.zip'), firstBytes);
  fs.writeFileSync(path.join(supply, '03-active-name.zip'), makeZip(moduleEntries('alpha', 'active collision')));
  fs.writeFileSync(path.join(supply, '04-overlap-change.zip'), makeZip(moduleEntries('module-new-01', 'changed')));
  fs.writeFileSync(path.join(supply, '05-broken.zip'), 'not a zip');
  fs.writeFileSync(path.join(supply, '06-encrypted.zip'), makeZip(moduleEntries('encrypted-module', 'encrypted', { encrypted: true })));
  fs.writeFileSync(path.join(supply, '07-unclassified.zip'), makeZip([{ name: 'notes/readme.txt', content: 'no manifest root' }]));
  for (let index = 8; index <= 14; index += 1) {
    const id = 'module-new-' + String(index).padStart(2, '0');
    fs.writeFileSync(path.join(supply, String(index).padStart(2, '0') + '-new.zip'), makeZip(moduleEntries(id, id)));
  }

  const before = recursiveSnapshot(supply);
  const first = Core.buildReceipt({
    sourceRoot: supply,
    workshopRoot: workshop,
    batchSize: 3,
    now: '2026-07-27T18:00:00.000Z'
  });
  const after = recursiveSnapshot(supply);

  check('fourteen carriers are mapped in one bounded receipt', () => {
    assert.equal(first.summary.archives, 14);
    assert.equal(first.limits.maxArchives, 256);
  });
  check('exact duplicate copies are parked without deletion', () => {
    assert.equal(first.summary.exactDuplicateCopies, 1);
    assert.equal(first.summary.archiveDispositionCounts.PARK_EXACT_DUPLICATE, 1);
    assert.deepEqual(after, before);
  });
  check('active module name collisions become judgment work, not equivalence claims', () => {
    const item = first.archives.find(row => row.relativePath === '03-active-name.zip');
    assert.equal(item.disposition, 'JUDGMENT_ACTIVE_NAME_COLLISION');
    assert.equal(item.candidateRoots[0].truth.activeNameMatchIsNotEquivalence, true);
  });
  check('overlapping archive paths stay at the merge judgment gate', () => {
    const item = first.archives.find(row => row.relativePath === '04-overlap-change.zip');
    assert.equal(item.disposition, 'JUDGMENT_ARCHIVE_OVERLAP');
    assert(item.relations.some(row => row.kind === 'SAME_PATH_SET_WITH_CHANGES'));
  });
  check('malformed and encrypted carriers fail into distinct holds', () => {
    assert.equal(first.archives.find(row => row.relativePath === '05-broken.zip').disposition, 'HOLD_NEEDS_REPAIR');
    assert.equal(first.archives.find(row => row.relativePath === '06-encrypted.zip').disposition, 'HOLD_STRUCTURAL_REVIEW');
  });
  check('archives without manifest roots remain visible and unclassified', () => {
    assert.equal(first.archives.find(row => row.relativePath === '07-unclassified.zip').disposition, 'JUDGMENT_UNCLASSIFIED_STRUCTURE');
  });
  check('disjoint structural candidates enter bounded deeper-review batches', () => {
    assert.equal(first.summary.readyCandidates, 7);
    assert.equal(first.batches.deeperReview.length, 3);
    assert(first.batches.deeperReview.every(row => row.count <= 3));
  });
  check('a repeated identical run marks every archive unchanged', () => {
    const second = Core.buildReceipt({
      sourceRoot: supply,
      workshopRoot: workshop,
      batchSize: 3,
      previousReceipt: first,
      now: '2026-07-27T18:01:00.000Z'
    });
    assert.equal(second.summary.resume.UNCHANGED, 14);
    assert.equal(second.receiptDigest, first.receiptDigest);
  });
  check('a new peer can reclassify an unchanged archive digest on resume', () => {
    fs.writeFileSync(path.join(supply, '15-new-peer.zip'), makeZip(moduleEntries('module-new-08', 'peer changed')));
    const changed = Core.buildReceipt({
      sourceRoot: supply,
      workshopRoot: workshop,
      batchSize: 3,
      previousReceipt: first,
      now: '2026-07-27T18:02:00.000Z'
    });
    assert(changed.summary.resume.RECLASSIFIED >= 1);
    assert.notEqual(changed.receiptDigest, first.receiptDigest);
  });
  check('receipts hide absolute source and Workshop paths', () => {
    assert.equal(JSON.stringify(first).includes(fixtureRoot), false);
    assert.equal(first.source.absolutePathExposed, false);
  });
  check('performance evidence declares workload and refuses CPU-pressure inference', () => {
    assert.equal(first.performance.workload.archives, 14);
    assert.equal(first.performance.cpuPressureMeasured, false);
    assert(first.performance.totalWallMs >= 0);
  });
  check('authority remains held after deterministic classification', () => {
    assert.equal(first.handoff.automaticInstallAllowed, false);
    assert.equal(first.handoff.automaticPromotionAllowed, false);
    assert.equal(first.handoff.canonRequiresMike, true);
    assert.equal(first.truth.archiveExtractionPerformed, false);
    assert.equal(first.truth.reviewVoteCast, false);
    assert.equal(first.truth.canonChanged, false);
  });

  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf8'));
  const contract = JSON.parse(fs.readFileSync(path.join(__dirname, 'module.contract.json'), 'utf8'));
  check('manifest and contract remain aligned', () => {
    assert.equal(manifest.schema, 'axm.tool-manifest/v1');
    assert.equal(manifest.kind, 'product');
    assert.equal(manifest.id, contract.id);
    assert.equal(manifest.version, contract.version);
    assert.deepEqual(contract.permissions, ['storage']);
  });
  check('contract refuses automatic promotion and GitHub publication', () => {
    for (const boundary of ['archive-extraction', 'automatic-review-vote', 'module-installation', 'promotion', 'git-push', 'canon-change']) {
      assert(contract.boundaries.refuses.includes(boundary));
    }
  });

  process.stdout.write('Bulk Intake Conveyor self-test passed: ' + checks + ' checks\n');
} finally {
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
}
