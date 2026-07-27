'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const MAP_SCHEMA = 'axm.archive-intake-map/v1';
const RECORD_SCHEMA = 'axm.archive-intake-record/v1';
const RELATION_SCHEMA = 'axm.archive-overlap-relation/v1';
const DEFAULT_TTL_MS = 2 * 60 * 60 * 1000;
const MAX_ARCHIVES = 256;
const MAX_ARCHIVE_BYTES = 512 * 1024 * 1024;
const MAX_ENTRIES = 20000;
const MAX_DEPTH = 12;

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function issue(code, detail, entry) {
  return {
    code,
    detail: detail || null,
    entry: entry || null
  };
}

function normalizedRelative(root, absolute) {
  return path.relative(root, absolute).split(path.sep).join('/');
}

function safeArchiveEntry(name) {
  const normalized = String(name || '').replace(/\\/g, '/');
  if (!normalized || normalized.includes('\0') || normalized.startsWith('/') || /^[a-zA-Z]:/.test(normalized)) {
    return false;
  }
  const directory = normalized.endsWith('/');
  const parts = normalized.split('/');
  if (directory) parts.pop();
  return parts.length > 0 && parts.every(part => part && part !== '.' && part !== '..');
}

function findEndOfCentralDirectory(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 22) throw new Error('ZIP is too small to contain an end record');
  const signature = 0x06054b50;
  const floor = Math.max(0, bytes.length - 65557);
  for (let offset = bytes.length - 22; offset >= floor; offset -= 1) {
    if (bytes.readUInt32LE(offset) !== signature) continue;
    const commentLength = bytes.readUInt16LE(offset + 20);
    if (offset + 22 + commentLength !== bytes.length) continue;
    const disk = bytes.readUInt16LE(offset + 4);
    const centralDisk = bytes.readUInt16LE(offset + 6);
    const entriesHere = bytes.readUInt16LE(offset + 8);
    const entriesTotal = bytes.readUInt16LE(offset + 10);
    const centralSize = bytes.readUInt32LE(offset + 12);
    const centralOffset = bytes.readUInt32LE(offset + 16);
    if (disk !== 0 || centralDisk !== 0 || entriesHere !== entriesTotal) {
      throw new Error('multi-disk ZIP is not supported');
    }
    if (entriesTotal === 0xffff || centralSize === 0xffffffff || centralOffset === 0xffffffff) {
      throw new Error('ZIP64 requires a separate review path');
    }
    if (entriesTotal > MAX_ENTRIES) throw new Error('ZIP exceeds the 20,000-entry review limit');
    if (centralOffset + centralSize > offset) throw new Error('central directory escapes archive bounds');
    return { offset, entriesTotal, centralSize, centralOffset };
  }
  throw new Error('ZIP end-of-central-directory record not found');
}

function parseCentralDirectory(bytes) {
  const findings = [];
  let end;
  try {
    end = findEndOfCentralDirectory(bytes);
  } catch (error) {
    return {
      ok: false,
      entries: [],
      findings: [issue('CENTRAL_DIRECTORY_INVALID', error.message)],
      declaredEntries: null,
      declaredCompressedBytes: 0,
      declaredUncompressedBytes: 0
    };
  }

  const entries = [];
  let offset = end.centralOffset;
  const centralEnd = end.centralOffset + end.centralSize;
  let compressedTotal = 0;
  let uncompressedTotal = 0;

  for (let index = 0; index < end.entriesTotal; index += 1) {
    if (offset + 46 > centralEnd || bytes.readUInt32LE(offset) !== 0x02014b50) {
      findings.push(issue('CENTRAL_ENTRY_INVALID', 'Central entry ' + index + ' is truncated or has the wrong signature.'));
      break;
    }
    const madeBy = bytes.readUInt16LE(offset + 4);
    const flags = bytes.readUInt16LE(offset + 8);
    const compressionMethod = bytes.readUInt16LE(offset + 10);
    const crc32 = bytes.readUInt32LE(offset + 16);
    const compressedSize = bytes.readUInt32LE(offset + 20);
    const uncompressedSize = bytes.readUInt32LE(offset + 24);
    const nameLength = bytes.readUInt16LE(offset + 28);
    const extraLength = bytes.readUInt16LE(offset + 30);
    const commentLength = bytes.readUInt16LE(offset + 32);
    const externalAttributes = bytes.readUInt32LE(offset + 38);
    const next = offset + 46 + nameLength + extraLength + commentLength;
    if (next > centralEnd) {
      findings.push(issue('CENTRAL_ENTRY_INVALID', 'Central entry ' + index + ' extends beyond the directory.'));
      break;
    }
    const nameBytes = bytes.subarray(offset + 46, offset + 46 + nameLength);
    const rawName = nameBytes.toString('utf8');
    const name = rawName.replace(/\\/g, '/');
    const directory = name.endsWith('/');
    const host = madeBy >>> 8;
    const unixMode = host === 3 ? (externalAttributes >>> 16) & 0xffff : 0;
    const symlink = (unixMode & 0xf000) === 0xa000;
    const encrypted = Boolean(flags & 0x0001);
    const utf8Named = Boolean(flags & 0x0800);
    const crc = crc32.toString(16).padStart(8, '0');
    const entry = {
      name,
      directory,
      encrypted,
      symlink,
      utf8Named,
      compressionMethod,
      crc32: crc,
      compressedSize,
      uncompressedSize,
      identity: name + '\u0000' + crc + '\u0000' + uncompressedSize
    };
    entries.push(entry);
    compressedTotal += compressedSize;
    uncompressedTotal += uncompressedSize;
    offset = next;
  }

  if (entries.length !== end.entriesTotal) {
    findings.push(issue('ENTRY_COUNT_MISMATCH', 'Parsed ' + entries.length + ' of ' + end.entriesTotal + ' declared entries.'));
  }
  if (offset < centralEnd) {
    findings.push(issue('CENTRAL_DIRECTORY_TRAILING_BYTES', (centralEnd - offset) + ' unparsed central-directory bytes remain.'));
  }

  return {
    ok: !findings.some(item => item.code === 'CENTRAL_DIRECTORY_INVALID' || item.code === 'CENTRAL_ENTRY_INVALID' || item.code === 'ENTRY_COUNT_MISMATCH'),
    entries,
    findings,
    declaredEntries: end.entriesTotal,
    declaredCompressedBytes: compressedTotal,
    declaredUncompressedBytes: uncompressedTotal
  };
}

function inspectArchiveBytes(bytes, relativePath) {
  const parsed = parseCentralDirectory(bytes);
  const findings = parsed.findings.slice();
  const nameCounts = new Map();
  let unsafePathEntries = 0;
  let encryptedEntries = 0;
  let symlinkEntries = 0;
  let legacyNameFlags = 0;

  for (const entry of parsed.entries) {
    nameCounts.set(entry.name, (nameCounts.get(entry.name) || 0) + 1);
    if (!safeArchiveEntry(entry.name)) {
      unsafePathEntries += 1;
      findings.push(issue('UNSAFE_ENTRY_PATH', 'Archive entry path is absolute, empty, or traversing.', entry.name));
    }
    if (entry.encrypted) {
      encryptedEntries += 1;
      findings.push(issue('ENCRYPTED_ENTRY_REVIEW', 'Encrypted content cannot be inspected by this structural mapper.', entry.name));
    }
    if (entry.symlink) {
      symlinkEntries += 1;
      findings.push(issue('ARCHIVED_SYMLINK_REVIEW', 'Archived symlink requires an explicit intake decision.', entry.name));
    }
    if (!entry.utf8Named && /[^\x20-\x7e]/.test(entry.name)) legacyNameFlags += 1;
  }

  const duplicateNames = Array.from(nameCounts.entries())
    .filter(([, count]) => count > 1)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name));
  for (const duplicate of duplicateNames) {
    findings.push(issue('DUPLICATE_ENTRY_NAME_REVIEW', duplicate.count + ' entries share this path.', duplicate.name));
  }
  if (legacyNameFlags) {
    findings.push(issue('LEGACY_NAME_ENCODING_REVIEW', legacyNameFlags + ' non-ASCII name(s) lack the UTF-8 flag.'));
  }

  const files = parsed.entries.filter(entry => !entry.directory);
  const pathSet = new Set(files.map(entry => entry.name));
  const identityByPath = new Map();
  for (const entry of files) {
    if (!identityByPath.has(entry.name)) identityByPath.set(entry.name, entry.identity);
  }
  const identities = files.map(entry => entry.identity).sort();
  const paths = Array.from(pathSet).sort();

  let status = 'READY_FOR_CONTENT_REVIEW';
  if (!parsed.ok || unsafePathEntries) status = 'NEEDS_REPAIR';
  else if (encryptedEntries || symlinkEntries || duplicateNames.length || legacyNameFlags) status = 'REVIEW_REQUIRED';

  const record = {
    schema: RECORD_SCHEMA,
    relativePath: String(relativePath || 'archive.zip').replace(/\\/g, '/'),
    bytes: bytes.length,
    sha256: sha256(bytes),
    status,
    zipEntriesDeclared: parsed.declaredEntries,
    parsedEntries: parsed.entries.length,
    fileEntries: files.length,
    directoryEntries: parsed.entries.length - files.length,
    declaredCompressedBytes: parsed.declaredCompressedBytes,
    declaredUncompressedBytes: parsed.declaredUncompressedBytes,
    centralDirectoryFingerprint: sha256(Buffer.from(JSON.stringify(identities))),
    pathFingerprint: sha256(Buffer.from(JSON.stringify(paths))),
    unsafePathEntries,
    encryptedEntries,
    symlinkEntries,
    duplicateEntryNames: duplicateNames.length,
    findings,
    truth: {
      archiveExtracted: false,
      entryContentDecompressed: false,
      crcContentVerified: false,
      semanticEquivalenceProven: false,
      installationPerformed: false
    }
  };

  return { record, pathSet, identityByPath };
}

function intersectionSize(left, right) {
  let count = 0;
  const smaller = left.size <= right.size ? left : right;
  const larger = smaller === left ? right : left;
  for (const value of smaller) if (larger.has(value)) count += 1;
  return count;
}

function relationBetween(left, right) {
  const a = left.record;
  const b = right.record;
  const leftCount = left.pathSet.size;
  const rightCount = right.pathSet.size;
  const pathIntersection = intersectionSize(left.pathSet, right.pathSet);
  let identicalAtSamePath = 0;
  for (const [entryPath, identity] of left.identityByPath) {
    if (right.identityByPath.get(entryPath) === identity) identicalAtSamePath += 1;
  }
  const union = leftCount + rightCount - pathIntersection;
  const ratio = value => Number((value || 0).toFixed(6));
  const leftCoverage = leftCount ? pathIntersection / leftCount : rightCount ? 0 : 1;
  const rightCoverage = rightCount ? pathIntersection / rightCount : leftCount ? 0 : 1;
  const jaccard = union ? pathIntersection / union : 1;
  let kind;
  let superset = null;
  let subset = null;

  if (a.sha256 === b.sha256) {
    kind = 'EXACT_ARCHIVE_DUPLICATE';
  } else if (a.status === 'NEEDS_REPAIR' || b.status === 'NEEDS_REPAIR') {
    kind = 'UNKNOWN_PARSE_HOLD';
  } else if (leftCount === rightCount && pathIntersection === leftCount) {
    kind = identicalAtSamePath === leftCount
      ? 'SAME_ENTRY_SET_DIFFERENT_ARCHIVE_BYTES'
      : 'SAME_PATH_SET_WITH_CHANGES';
  } else if (pathIntersection === leftCount && leftCount < rightCount) {
    superset = b.relativePath;
    subset = a.relativePath;
    kind = identicalAtSamePath === leftCount
      ? 'LEFT_ENTRY_SUBSET_OF_RIGHT'
      : 'LEFT_PATH_SUBSET_OF_RIGHT_WITH_CHANGES';
  } else if (pathIntersection === rightCount && rightCount < leftCount) {
    superset = a.relativePath;
    subset = b.relativePath;
    kind = identicalAtSamePath === rightCount
      ? 'RIGHT_ENTRY_SUBSET_OF_LEFT'
      : 'RIGHT_PATH_SUBSET_OF_LEFT_WITH_CHANGES';
  } else if (pathIntersection > 0) {
    kind = 'PARTIAL_PATH_OVERLAP';
  } else {
    kind = 'DISJOINT_PATHS';
  }

  return {
    schema: RELATION_SCHEMA,
    left: a.relativePath,
    right: b.relativePath,
    kind,
    superset,
    subset,
    leftFileEntries: leftCount,
    rightFileEntries: rightCount,
    pathIntersection,
    identicalAtSamePath,
    changedAtSamePath: Math.max(0, pathIntersection - identicalAtSamePath),
    leftPathCoverage: ratio(leftCoverage),
    rightPathCoverage: ratio(rightCoverage),
    pathJaccard: ratio(jaccard),
    truth: {
      filenameOverlapIsNotSemanticEquivalence: true,
      crcAndSizeAreNotCryptographicContentProof: true,
      newestOrCanonInferred: false,
      automaticMergeAllowed: false
    }
  };
}

function walkArchivePaths(root) {
  const archives = [];
  const skippedSymlinks = [];

  function visit(directory, depth) {
    if (depth > MAX_DEPTH) throw new Error('archive supply exceeds the depth limit');
    const entries = fs.readdirSync(directory, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const absolute = path.join(directory, entry.name);
      const relative = normalizedRelative(root, absolute);
      if (entry.isSymbolicLink()) {
        skippedSymlinks.push(relative);
        continue;
      }
      if (entry.isDirectory()) {
        visit(absolute, depth + 1);
        continue;
      }
      if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.zip')) continue;
      archives.push({ absolute, relative });
      if (archives.length > MAX_ARCHIVES) throw new Error('archive supply exceeds the 256-archive limit');
    }
  }

  visit(root, 0);
  return { archives, skippedSymlinks };
}

function scanSupply(root, options = {}) {
  const sourceRoot = path.resolve(root || process.cwd());
  const sourceStat = fs.lstatSync(sourceRoot);
  if (sourceStat.isSymbolicLink() || !sourceStat.isDirectory()) {
    throw new Error('archive supply root must be a real directory, not a symlink');
  }
  const walked = walkArchivePaths(sourceRoot);
  const inspected = walked.archives.map(item => {
    const stat = fs.statSync(item.absolute);
    if (stat.size > MAX_ARCHIVE_BYTES) {
      const bytes = Buffer.from('');
      const inspectedArchive = inspectArchiveBytes(bytes, item.relative);
      inspectedArchive.record.bytes = stat.size;
      inspectedArchive.record.sha256 = null;
      inspectedArchive.record.status = 'NEEDS_REPAIR';
      inspectedArchive.record.findings.unshift(issue('ARCHIVE_SIZE_LIMIT', 'Archive exceeds the 512 MiB review limit.'));
      return inspectedArchive;
    }
    return inspectArchiveBytes(fs.readFileSync(item.absolute), item.relative);
  }).sort((a, b) => a.record.relativePath.localeCompare(b.record.relativePath));

  const relations = [];
  for (let left = 0; left < inspected.length; left += 1) {
    for (let right = left + 1; right < inspected.length; right += 1) {
      relations.push(relationBetween(inspected[left], inspected[right]));
    }
  }

  const relationCounts = {};
  for (const relation of relations) relationCounts[relation.kind] = (relationCounts[relation.kind] || 0) + 1;
  const archives = inspected.map(item => item.record);
  const states = {
    readyForContentReview: archives.filter(item => item.status === 'READY_FOR_CONTENT_REVIEW').length,
    reviewRequired: archives.filter(item => item.status === 'REVIEW_REQUIRED').length,
    needsRepair: archives.filter(item => item.status === 'NEEDS_REPAIR').length
  };
  const digestCounts = new Map();
  for (const archive of archives) {
    if (archive.sha256) digestCounts.set(archive.sha256, (digestCounts.get(archive.sha256) || 0) + 1);
  }
  const exactDuplicateCopies = Array.from(digestCounts.values()).reduce((sum, count) => sum + Math.max(0, count - 1), 0);
  const measuredAt = new Date(options.now === undefined ? Date.now() : options.now).toISOString();
  const fingerprintBody = {
    sourceLabel: path.basename(sourceRoot),
    skippedSymlinks: walked.skippedSymlinks,
    archives: archives.map(item => ({
      relativePath: item.relativePath,
      bytes: item.bytes,
      sha256: item.sha256,
      status: item.status,
      zipEntriesDeclared: item.zipEntriesDeclared,
      centralDirectoryFingerprint: item.centralDirectoryFingerprint,
      pathFingerprint: item.pathFingerprint,
      findingCodes: item.findings.map(finding => finding.code)
    })),
    relations: relations.map(item => ({
      left: item.left,
      right: item.right,
      kind: item.kind,
      pathIntersection: item.pathIntersection,
      identicalAtSamePath: item.identicalAtSamePath
    }))
  };

  return {
    schema: MAP_SCHEMA,
    measuredAt,
    freshnessTtlMs: DEFAULT_TTL_MS,
    source: {
      label: path.basename(sourceRoot),
      fingerprint: sha256(Buffer.from(JSON.stringify(fingerprintBody))),
      recursive: true,
      maxDepth: MAX_DEPTH,
      symlinksFollowed: false,
      skippedSymlinks: walked.skippedSymlinks
    },
    summary: {
      totalArchives: archives.length,
      uniqueArchiveDigests: digestCounts.size,
      exactDuplicateCopies,
      readyForContentReview: states.readyForContentReview,
      reviewRequired: states.reviewRequired,
      needsRepair: states.needsRepair,
      pairRelations: relations.length,
      relationCounts
    },
    archives,
    relations,
    truth: {
      archiveExtractionPerformed: false,
      archiveEntryExecutionPerformed: false,
      decompressedContentIntegrityProven: false,
      semanticEquivalenceProven: false,
      newestOrCanonInferred: false,
      automaticMergePerformed: false,
      installerStagingPerformed: false,
      installationPerformed: false,
      permissionChanged: false,
      rollbackChanged: false,
      canonChanged: false
    }
  };
}

function freshness(map, options = {}) {
  const now = new Date(options.now === undefined ? Date.now() : options.now).getTime();
  const observed = Date.parse(map && map.measuredAt || '');
  const requestedTtl = Number(options.ttlMs === undefined ? map && map.freshnessTtlMs : options.ttlMs);
  const ttlMs = Number.isFinite(requestedTtl) && requestedTtl >= 0 ? requestedTtl : DEFAULT_TTL_MS;
  if (!Number.isFinite(observed)) {
    return { status: 'UNTIMED', ageMs: null, ttlMs, nextRecheckAt: null };
  }
  const ageMs = Math.max(0, now - observed);
  return {
    status: ageMs <= ttlMs ? 'LIVE' : 'STALE',
    ageMs,
    ttlMs,
    nextRecheckAt: new Date(observed + ttlMs).toISOString()
  };
}

module.exports = {
  MAP_SCHEMA,
  RECORD_SCHEMA,
  RELATION_SCHEMA,
  DEFAULT_TTL_MS,
  MAX_ARCHIVES,
  MAX_ARCHIVE_BYTES,
  MAX_ENTRIES,
  scanSupply,
  inspectArchiveBytes,
  relationBetween,
  freshness,
  safeArchiveEntry
};
