#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Core = require('./core/archive-map-core');

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

function makeZip(entries, options = {}) {
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
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(body.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    name.copy(local, 30);
    locals.push(local, body);

    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(input.symlink ? 0x0314 : 20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(flags, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(body.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    const mode = input.symlink ? 0xa1ff : 0;
    central.writeUInt32LE((mode << 16) >>> 0, 38);
    central.writeUInt32LE(localOffset, 42);
    name.copy(central, 46);
    centrals.push(central);
    localOffset += local.length + body.length;
  }

  const centralBody = Buffer.concat(centrals);
  const comment = Buffer.from(String(options.comment || ''), 'utf8');
  const end = Buffer.alloc(22 + comment.length);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBody.length, 12);
  end.writeUInt32LE(localOffset, 16);
  end.writeUInt16LE(comment.length, 20);
  comment.copy(end, 22);
  return Buffer.concat([...locals, centralBody, end]);
}

function inspected(entries, label, options) {
  return Core.inspectArchiveBytes(makeZip(entries, options), label || 'fixture.zip');
}

function recursiveFiles(root) {
  const result = [];
  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const absolute = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        result.push('SYMLINK:' + path.relative(root, absolute));
      } else if (entry.isDirectory()) {
        visit(absolute);
      } else {
        result.push(path.relative(root, absolute) + ':' + fs.statSync(absolute).size);
      }
    }
  }
  visit(root);
  return result;
}

const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-archive-cartographer-'));
try {
  const one = inspected([{ name: 'a.txt', content: 'alpha' }], 'one.zip');
  const oneCopy = Core.inspectArchiveBytes(makeZip([{ name: 'a.txt', content: 'alpha' }]), 'one-copy.zip');
  const oneMetadataVariant = Core.inspectArchiveBytes(makeZip([{ name: 'a.txt', content: 'alpha' }], { comment: 'different archive metadata' }), 'variant.zip');
  const changed = inspected([{ name: 'a.txt', content: 'changed' }], 'changed.zip');
  const superset = inspected([{ name: 'a.txt', content: 'alpha' }, { name: 'b.txt', content: 'beta' }], 'superset.zip');
  const changedSuperset = inspected([{ name: 'a.txt', content: 'changed' }, { name: 'b.txt', content: 'beta' }], 'changed-superset.zip');
  const partial = inspected([{ name: 'a.txt', content: 'alpha' }, { name: 'c.txt', content: 'gamma' }], 'partial.zip');
  const disjoint = inspected([{ name: 'z.txt', content: 'omega' }], 'disjoint.zip');

  check('safe archive paths accept bounded relative entries', () => {
    assert.equal(Core.safeArchiveEntry('folder/file.txt'), true);
    assert.equal(Core.safeArchiveEntry('../escape.txt'), false);
    assert.equal(Core.safeArchiveEntry('/absolute.txt'), false);
  });
  check('a valid stored ZIP produces the declared record schema', () => {
    assert.equal(one.record.schema, Core.RECORD_SCHEMA);
    assert.equal(one.record.status, 'READY_FOR_CONTENT_REVIEW');
    assert.equal(one.record.fileEntries, 1);
  });
  check('the shared central-directory parser remains structural and non-extracting', () => {
    const parsed = Core.parseCentralDirectory(
      makeZip([{ name: 'shared.txt', content: 'not decompressed' }]),
    );
    assert.equal(parsed.ok, true);
    assert.equal(parsed.entries.length, 1);
    assert.equal(parsed.entries[0].name, 'shared.txt');
    assert.equal(Object.prototype.hasOwnProperty.call(parsed.entries[0], 'content'), false);
  });
  check('structural inspection explicitly proves no extraction or content integrity', () => {
    assert.equal(one.record.truth.archiveExtracted, false);
    assert.equal(one.record.truth.entryContentDecompressed, false);
    assert.equal(one.record.truth.crcContentVerified, false);
  });
  check('whole-byte equality is the only exact archive duplicate relation', () => {
    assert.equal(Core.relationBetween(one, oneCopy).kind, 'EXACT_ARCHIVE_DUPLICATE');
  });
  check('equal entry identity with different container bytes stays distinct', () => {
    assert.equal(Core.relationBetween(one, oneMetadataVariant).kind, 'SAME_ENTRY_SET_DIFFERENT_ARCHIVE_BYTES');
  });
  check('same paths with changed entry metadata are named', () => {
    const relation = Core.relationBetween(one, changed);
    assert.equal(relation.kind, 'SAME_PATH_SET_WITH_CHANGES');
    assert.equal(relation.changedAtSamePath, 1);
  });
  check('an exact entry subset names its bounded direction', () => {
    assert.equal(Core.relationBetween(one, superset).kind, 'LEFT_ENTRY_SUBSET_OF_RIGHT');
  });
  check('a path subset with changed entry metadata is not called identical', () => {
    assert.equal(Core.relationBetween(one, changedSuperset).kind, 'LEFT_PATH_SUBSET_OF_RIGHT_WITH_CHANGES');
  });
  check('partial path overlap stays separate from subset evidence', () => {
    const relation = Core.relationBetween(superset, partial);
    assert.equal(relation.kind, 'PARTIAL_PATH_OVERLAP');
    assert.equal(relation.pathIntersection, 1);
  });
  check('disjoint entry paths are explicit', () => {
    assert.equal(Core.relationBetween(one, disjoint).kind, 'DISJOINT_PATHS');
  });
  check('an unsafe archived path needs repair without extraction', () => {
    const result = inspected([{ name: '../escape.txt', content: 'x' }], 'unsafe.zip');
    assert.equal(result.record.status, 'NEEDS_REPAIR');
    assert.equal(result.record.unsafePathEntries, 1);
  });
  check('encrypted entries remain a visible review hold', () => {
    const result = inspected([{ name: 'secret.txt', content: 'x', encrypted: true }], 'encrypted.zip');
    assert.equal(result.record.status, 'REVIEW_REQUIRED');
    assert.equal(result.record.encryptedEntries, 1);
  });
  check('archived symlinks remain a visible review hold', () => {
    const result = inspected([{ name: 'link', content: 'target', symlink: true }], 'symlink.zip');
    assert.equal(result.record.status, 'REVIEW_REQUIRED');
    assert.equal(result.record.symlinkEntries, 1);
  });
  check('duplicate archived names remain a visible review hold', () => {
    const result = inspected([{ name: 'same.txt', content: 'a' }, { name: 'same.txt', content: 'b' }], 'duplicates.zip');
    assert.equal(result.record.status, 'REVIEW_REQUIRED');
    assert.equal(result.record.duplicateEntryNames, 1);
  });
  check('malformed ZIP bytes fail closed as repair-needed', () => {
    const result = Core.inspectArchiveBytes(Buffer.from('not a zip'), 'broken.zip');
    assert.equal(result.record.status, 'NEEDS_REPAIR');
    assert(result.record.findings.some(item => item.code === 'CENTRAL_DIRECTORY_INVALID'));
  });
  check('freshness is LIVE within TTL and STALE after it', () => {
    const map = { measuredAt: '2026-07-26T00:00:00.000Z', freshnessTtlMs: 1000 };
    assert.equal(Core.freshness(map, { now: '2026-07-26T00:00:00.500Z' }).status, 'LIVE');
    assert.equal(Core.freshness(map, { now: '2026-07-26T00:00:02.000Z' }).status, 'STALE');
  });

  const supply = path.join(fixtureRoot, 'supply');
  const nested = path.join(supply, 'nested');
  fs.mkdirSync(nested, { recursive: true });
  fs.writeFileSync(path.join(supply, 'one.zip'), makeZip([{ name: 'a.txt', content: 'alpha' }]));
  fs.writeFileSync(path.join(nested, 'two.zip'), makeZip([{ name: 'b.txt', content: 'beta' }]));
  fs.writeFileSync(path.join(supply, 'ignored.txt'), 'not an archive');
  const linkedSupplyTarget = path.join(fixtureRoot, 'linked-supply-target');
  fs.mkdirSync(linkedSupplyTarget, { recursive: true });
  fs.writeFileSync(path.join(linkedSupplyTarget, 'linked.zip'), makeZip([{ name: 'linked.txt', content: 'must not be followed' }]));
  fs.symlinkSync(linkedSupplyTarget, path.join(supply, 'linked-dir'), process.platform === 'win32' ? 'junction' : 'dir');
  const before = recursiveFiles(supply);
  const first = Core.scanSupply(supply, { now: '2026-07-26T00:00:00.000Z' });
  const second = Core.scanSupply(supply, { now: '2026-07-26T00:30:00.000Z' });
  const after = recursiveFiles(supply);

  check('recursive supply scanning finds only regular ZIP files', () => {
    assert.equal(first.summary.totalArchives, 2);
    assert(first.archives.some(item => item.relativePath === 'nested/two.zip'));
  });
  check('filesystem symlinks are recorded and never followed', () => {
    assert.deepEqual(first.source.skippedSymlinks, ['linked-dir']);
    assert.equal(first.source.symlinksFollowed, false);
  });
  check('scanning performs no filesystem writes', () => {
    assert.deepEqual(after, before);
  });
  check('map fingerprints ignore measurement time', () => {
    assert.equal(first.source.fingerprint, second.source.fingerprint);
    assert.notEqual(first.measuredAt, second.measuredAt);
  });
  check('the map never exposes the absolute selected root', () => {
    assert.equal(JSON.stringify(first).includes(fixtureRoot), false);
  });
  check('archive byte drift changes the source fingerprint', () => {
    fs.writeFileSync(path.join(supply, 'one.zip'), makeZip([{ name: 'a.txt', content: 'changed' }]));
    const drifted = Core.scanSupply(supply, { now: '2026-07-26T00:31:00.000Z' });
    assert.notEqual(drifted.source.fingerprint, first.source.fingerprint);
  });
  check('map truth refuses automatic intake authority', () => {
    assert.equal(first.truth.archiveExtractionPerformed, false);
    assert.equal(first.truth.automaticMergePerformed, false);
    assert.equal(first.truth.installerStagingPerformed, false);
    assert.equal(first.truth.installationPerformed, false);
    assert.equal(first.truth.canonChanged, false);
  });

  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf8'));
  const contract = JSON.parse(fs.readFileSync(path.join(__dirname, 'module.contract.json'), 'utf8'));
  check('manifest and contract identity and permissions remain aligned', () => {
    assert.equal(manifest.schema, 'axm.tool-manifest/v1');
    assert.equal(manifest.kind, 'product');
    assert.equal(manifest.id, contract.id);
    assert.equal(manifest.version, contract.version);
    assert.deepEqual(contract.permissions, ['storage']);
    assert(manifest.uses.includes('storage'));
  });
  check('the contract explicitly refuses extraction execution and automatic merge', () => {
    for (const boundary of ['archive-extraction', 'archive-entry-execution', 'automatic-merge', 'installer-staging', 'module-installation', 'canon-change']) {
      assert(contract.boundaries.refuses.includes(boundary));
    }
  });

  const liveRoot = process.argv[2] ? path.resolve(process.argv[2]) : null;
  if (liveRoot) {
    const live = Core.scanSupply(liveRoot);
    check('selected live intake carrier contains sixteen unique archives', () => {
      assert.equal(live.summary.totalArchives, 16);
      assert.equal(live.summary.uniqueArchiveDigests, 16);
      assert.equal(live.summary.exactDuplicateCopies, 0);
    });
    check('all live archives pass structural review entry', () => {
      assert.equal(live.summary.readyForContentReview, 16);
      assert.equal(live.summary.reviewRequired, 0);
      assert.equal(live.summary.needsRepair, 0);
    });
    check('live pair mapping exposes overlap without choosing authority', () => {
      assert.equal(live.summary.pairRelations, 120);
      assert(live.relations.some(item => item.kind !== 'DISJOINT_PATHS'));
      assert(live.relations.every(item => item.truth.newestOrCanonInferred === false));
    });
    check('live mapping performs no extraction installation or CANON change', () => {
      assert.equal(live.truth.archiveExtractionPerformed, false);
      assert.equal(live.truth.installationPerformed, false);
      assert.equal(live.truth.canonChanged, false);
    });
  }
} finally {
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
}

process.stdout.write('\nArchive Intake Cartographer selftest: PASS (' + checks + ' checks)\n');
