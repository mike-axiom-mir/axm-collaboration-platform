'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const ArchiveCore = require('../../archive-intake-cartographer/core/archive-map-core');

const RECEIPT_SCHEMA = 'axm.bulk-intake-conveyor-receipt/v1';
const ARCHIVE_SCHEMA = 'axm.bulk-intake-archive-work-item/v1';
const CANDIDATE_SCHEMA = 'axm.bulk-intake-candidate-work-item/v1';
const DEFAULT_BATCH_SIZE = 50;
const MAX_BATCH_SIZE = 100;

const DISPOSITION_PRIORITY = {
  HOLD_NEEDS_REPAIR: 10,
  HOLD_STRUCTURAL_REVIEW: 20,
  JUDGMENT_ACTIVE_NAME_COLLISION: 30,
  JUDGMENT_ARCHIVE_OVERLAP: 40,
  JUDGMENT_UNCLASSIFIED_STRUCTURE: 50,
  READY_FOR_DEEPER_REVIEW: 80,
  PARK_EXACT_DUPLICATE: 90
};

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    const result = {};
    for (const key of Object.keys(value).sort()) result[key] = stableValue(value[key]);
    return result;
  }
  return value;
}

function stableJson(value) {
  return JSON.stringify(stableValue(value));
}

function posixRelative(root, target) {
  return path.relative(root, target).split(path.sep).join('/');
}

function resolveArchive(root, relativePath) {
  const base = path.resolve(root);
  const target = path.resolve(base, ...String(relativePath || '').split('/'));
  const prefix = base.endsWith(path.sep) ? base : base + path.sep;
  if (!target.startsWith(prefix)) throw new Error('archive path escaped the selected supply root');
  const stat = fs.lstatSync(target);
  if (stat.isSymbolicLink() || !stat.isFile()) throw new Error('archive must remain a regular non-symlink file');
  return target;
}

function inspectActiveModules(workshopRoot) {
  const root = path.resolve(workshopRoot);
  const toolsRoot = path.join(root, 'tools');
  const stat = fs.lstatSync(toolsRoot);
  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    throw new Error('Workshop tools root must be a regular non-symlink directory');
  }
  const modules = [];
  for (const entry of fs.readdirSync(toolsRoot, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
    const manifestPath = path.join(toolsRoot, entry.name, 'manifest.json');
    if (!fs.existsSync(manifestPath)) continue;
    let manifest = {};
    let manifestState = 'PRESENT';
    try {
      const manifestStat = fs.lstatSync(manifestPath);
      if (manifestStat.isSymbolicLink() || !manifestStat.isFile()) throw new Error('not a regular file');
      manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8').replace(/^\uFEFF/, ''));
    } catch (error) {
      manifestState = 'INVALID';
    }
    modules.push({
      folder: entry.name,
      id: typeof manifest.id === 'string' && manifest.id.trim() ? manifest.id.trim() : null,
      version: typeof manifest.version === 'string' ? manifest.version : null,
      status: typeof manifest.status === 'string' ? manifest.status : null,
      manifestState
    });
  }
  const identityRows = modules.map(item => ({
    folder: item.folder,
    id: item.id,
    version: item.version,
    status: item.status,
    manifestState: item.manifestState
  }));
  const names = new Map();
  for (const module of modules) {
    for (const value of [module.folder, module.id]) {
      if (!value) continue;
      const key = value.toLowerCase();
      if (!names.has(key)) names.set(key, []);
      names.get(key).push({ folder: module.folder, id: module.id });
    }
  }
  return {
    label: path.basename(root),
    fingerprint: sha256(Buffer.from(stableJson(identityRows))),
    moduleCount: modules.length,
    invalidManifests: modules.filter(item => item.manifestState !== 'PRESENT').length,
    modules,
    names
  };
}

function parentOf(relativePath) {
  const directory = path.posix.dirname(relativePath);
  return directory === '.' ? '.' : directory;
}

function underRoot(root, relativePath) {
  return root === '.' || relativePath === root || relativePath.startsWith(root + '/');
}

function structuralName(root, archivePath) {
  if (root === '.') return path.posix.basename(archivePath, path.posix.extname(archivePath));
  return path.posix.basename(root);
}

function inspectArchiveStructure(sourceRoot, archiveRecord, active) {
  if (!archiveRecord.sha256 || archiveRecord.bytes > ArchiveCore.MAX_ARCHIVE_BYTES) {
    return { candidateRoots: [], fileEntries: [], inventoryState: 'UNAVAILABLE' };
  }
  const absolute = resolveArchive(sourceRoot, archiveRecord.relativePath);
  const parsed = ArchiveCore.parseCentralDirectory(fs.readFileSync(absolute));
  if (!parsed.ok) return { candidateRoots: [], fileEntries: [], inventoryState: 'PARSE_HOLD' };
  const fileEntries = parsed.entries.filter(item => !item.directory).map(item => item.name).sort();
  const roots = Array.from(new Set(fileEntries
    .filter(entry => entry === 'manifest.json' || entry.endsWith('/manifest.json'))
    .map(parentOf))).sort();
  const candidateRoots = roots.map(root => {
    const prefix = root === '.' ? '' : root + '/';
    const name = structuralName(root, archiveRecord.relativePath);
    const activeMatches = active.names.get(name.toLowerCase()) || [];
    const filesBelowRoot = fileEntries.filter(entry => underRoot(root, entry));
    return {
      root,
      structuralName: name,
      filesBelowRoot: filesBelowRoot.length,
      signals: {
        manifest: true,
        contract: fileEntries.includes(prefix + 'module.contract.json'),
        bundle: fileEntries.includes(prefix + 'module-bundle.json'),
        candidateReceipt: fileEntries.includes(prefix + 'candidate.receipt.json'),
        indexHtml: fileEntries.includes(prefix + 'index.html')
      },
      activeNameMatches: activeMatches,
      truth: {
        structuralNameIsNotDeclaredModuleIdentity: true,
        fileContentsRead: false,
        manifestParsed: false,
        activeNameMatchIsNotEquivalence: true
      }
    };
  });
  return { candidateRoots, fileEntries, inventoryState: 'CENTRAL_DIRECTORY_ONLY' };
}

function relationIndex(relations) {
  const result = new Map();
  for (const relation of relations) {
    for (const archive of [relation.left, relation.right]) {
      if (!result.has(archive)) result.set(archive, []);
      result.get(archive).push({
        peer: archive === relation.left ? relation.right : relation.left,
        kind: relation.kind,
        pathIntersection: relation.pathIntersection,
        changedAtSamePath: relation.changedAtSamePath
      });
    }
  }
  for (const rows of result.values()) rows.sort((a, b) => a.peer.localeCompare(b.peer) || a.kind.localeCompare(b.kind));
  return result;
}

function duplicateRepresentatives(archives) {
  const groups = new Map();
  for (const archive of archives) {
    if (!archive.sha256) continue;
    if (!groups.has(archive.sha256)) groups.set(archive.sha256, []);
    groups.get(archive.sha256).push(archive.relativePath);
  }
  const result = new Map();
  for (const [digest, members] of groups) {
    members.sort();
    result.set(digest, { representative: members[0], members });
  }
  return result;
}

function chooseDisposition(archive, structure, relations, duplicateGroup) {
  if (archive.status === 'NEEDS_REPAIR') {
    return { disposition: 'HOLD_NEEDS_REPAIR', reason: 'Archive structure failed a bounded safety check.' };
  }
  if (duplicateGroup && duplicateGroup.representative !== archive.relativePath) {
    return {
      disposition: 'PARK_EXACT_DUPLICATE',
      reason: 'Whole-archive SHA-256 matches the deterministic batch representative.',
      representative: duplicateGroup.representative
    };
  }
  if (archive.status === 'REVIEW_REQUIRED') {
    return { disposition: 'HOLD_STRUCTURAL_REVIEW', reason: 'Encrypted, symlink, duplicate-name, or legacy-name evidence requires judgment.' };
  }
  if (structure.candidateRoots.some(item => item.activeNameMatches.length)) {
    return {
      disposition: 'JUDGMENT_ACTIVE_NAME_COLLISION',
      reason: 'At least one structural candidate name matches an active module folder or declared id.'
    };
  }
  const overlapKinds = relations.map(item => item.kind).filter(kind => ![
    'EXACT_ARCHIVE_DUPLICATE',
    'DISJOINT_PATHS',
    'UNKNOWN_PARSE_HOLD'
  ].includes(kind));
  if (overlapKinds.length) {
    return {
      disposition: 'JUDGMENT_ARCHIVE_OVERLAP',
      reason: 'Archive paths overlap another carrier; precedence and merge direction are intentionally unresolved.'
    };
  }
  if (!structure.candidateRoots.length) {
    return {
      disposition: 'JUDGMENT_UNCLASSIFIED_STRUCTURE',
      reason: 'No manifest-root candidate was visible in central-directory paths.'
    };
  }
  return {
    disposition: 'READY_FOR_DEEPER_REVIEW',
    reason: 'Bounded archive structure passed and no batch-local collision requires an earlier decision.'
  };
}

function decisionSignature(item) {
  const material = {
    sha256: item.sha256,
    status: item.archiveStatus,
    disposition: item.disposition,
    representative: item.representative,
    relations: item.relations,
    candidates: item.candidateRoots.map(candidate => ({
      root: candidate.root,
      structuralName: candidate.structuralName,
      signals: candidate.signals,
      activeNameMatches: candidate.activeNameMatches
    }))
  };
  return sha256(Buffer.from(stableJson(material)));
}

function previousIndex(previous) {
  const index = new Map();
  if (!previous || previous.schema !== RECEIPT_SCHEMA || !Array.isArray(previous.archives)) return index;
  for (const archive of previous.archives) {
    if (archive && archive.relativePath && archive.sha256 && archive.decisionSignature) {
      index.set(archive.relativePath + '\u0000' + archive.sha256, archive.decisionSignature);
    }
  }
  return index;
}

function batch(items, batchSize, prefix) {
  const batches = [];
  for (let offset = 0; offset < items.length; offset += batchSize) {
    const members = items.slice(offset, offset + batchSize);
    batches.push({
      id: prefix + '-' + String(batches.length + 1).padStart(3, '0'),
      workItems: members.map(item => item.id),
      count: members.length
    });
  }
  return batches;
}

function buildReceipt(options) {
  const started = process.hrtime.bigint();
  const sourceRoot = path.resolve(options.sourceRoot);
  const workshopRoot = path.resolve(options.workshopRoot);
  const requestedBatchSize = Number(options.batchSize === undefined ? DEFAULT_BATCH_SIZE : options.batchSize);
  if (!Number.isInteger(requestedBatchSize) || requestedBatchSize < 1 || requestedBatchSize > MAX_BATCH_SIZE) {
    throw new Error('batchSize must be an integer between 1 and ' + MAX_BATCH_SIZE);
  }

  const archiveMap = ArchiveCore.scanSupply(sourceRoot, { now: options.now });
  const mapped = process.hrtime.bigint();
  const active = inspectActiveModules(workshopRoot);
  const activeMapped = process.hrtime.bigint();
  const relations = relationIndex(archiveMap.relations);
  const duplicateGroups = duplicateRepresentatives(archiveMap.archives);
  const prior = previousIndex(options.previousReceipt);
  const archives = [];

  for (const archive of archiveMap.archives) {
    const structure = inspectArchiveStructure(sourceRoot, archive, active);
    const archiveRelations = relations.get(archive.relativePath) || [];
    const duplicateGroup = archive.sha256 ? duplicateGroups.get(archive.sha256) : null;
    const decision = chooseDisposition(archive, structure, archiveRelations, duplicateGroup);
    const item = {
      schema: ARCHIVE_SCHEMA,
      id: 'archive:' + archive.relativePath,
      relativePath: archive.relativePath,
      bytes: archive.bytes,
      sha256: archive.sha256,
      archiveStatus: archive.status,
      disposition: decision.disposition,
      dispositionPriority: DISPOSITION_PRIORITY[decision.disposition],
      reason: decision.reason,
      representative: decision.representative || null,
      inventoryState: structure.inventoryState,
      candidateRootCount: structure.candidateRoots.length,
      candidateRoots: structure.candidateRoots,
      relations: archiveRelations,
      findings: archive.findings,
      truth: {
        archiveExtracted: false,
        contentExecuted: false,
        candidateAccepted: false,
        reviewVoteCast: false,
        installationPerformed: false,
        promotionPerformed: false,
        canonChanged: false
      }
    };
    item.decisionSignature = decisionSignature(item);
    const priorSignature = prior.get(item.relativePath + '\u0000' + item.sha256);
    item.resumeState = priorSignature === item.decisionSignature ? 'UNCHANGED' : priorSignature ? 'RECLASSIFIED' : 'NEW';
    archives.push(item);
  }

  archives.sort((a, b) => a.dispositionPriority - b.dispositionPriority || a.relativePath.localeCompare(b.relativePath));
  const candidates = [];
  for (const archive of archives) {
    for (const candidate of archive.candidateRoots) {
      let disposition = archive.disposition;
      if (disposition === 'READY_FOR_DEEPER_REVIEW' && candidate.activeNameMatches.length) {
        disposition = 'JUDGMENT_ACTIVE_NAME_COLLISION';
      }
      candidates.push({
        schema: CANDIDATE_SCHEMA,
        id: 'candidate:' + archive.relativePath + '#' + candidate.root,
        archive: archive.relativePath,
        archiveSha256: archive.sha256,
        root: candidate.root,
        structuralName: candidate.structuralName,
        disposition,
        dispositionPriority: DISPOSITION_PRIORITY[disposition],
        signals: candidate.signals,
        activeNameMatches: candidate.activeNameMatches,
        truth: candidate.truth
      });
    }
  }
  candidates.sort((a, b) => a.dispositionPriority - b.dispositionPriority || a.structuralName.localeCompare(b.structuralName) || a.id.localeCompare(b.id));

  const dispositionCounts = {};
  for (const archive of archives) dispositionCounts[archive.disposition] = (dispositionCounts[archive.disposition] || 0) + 1;
  const candidateDispositionCounts = {};
  for (const candidate of candidates) candidateDispositionCounts[candidate.disposition] = (candidateDispositionCounts[candidate.disposition] || 0) + 1;
  const judgmentArchives = archives.filter(item => item.disposition.startsWith('HOLD_') || item.disposition.startsWith('JUDGMENT_'));
  const readyCandidates = candidates.filter(item => item.disposition === 'READY_FOR_DEEPER_REVIEW');
  const judgmentCandidates = candidates.filter(item => item.disposition.startsWith('HOLD_') || item.disposition.startsWith('JUDGMENT_'));
  const parkedCandidates = candidates.filter(item => item.disposition === 'PARK_EXACT_DUPLICATE');
  const resumeCounts = { NEW: 0, UNCHANGED: 0, RECLASSIFIED: 0 };
  for (const archive of archives) resumeCounts[archive.resumeState] += 1;

  const workload = {
    archives: archives.length,
    archiveBytes: archives.reduce((sum, item) => sum + item.bytes, 0),
    pairRelations: archiveMap.relations.length,
    structuralCandidateRoots: candidates.length,
    activeModulesCompared: active.moduleCount
  };
  const fingerprintMaterial = {
    sourceFingerprint: archiveMap.source.fingerprint,
    activeFingerprint: active.fingerprint,
    batchSize: requestedBatchSize,
    archives: archives.map(item => ({ id: item.id, decisionSignature: item.decisionSignature })),
    candidates: candidates.map(item => ({ id: item.id, disposition: item.disposition, activeNameMatches: item.activeNameMatches }))
  };
  const receiptDigest = sha256(Buffer.from(stableJson(fingerprintMaterial)));
  const completed = process.hrtime.bigint();
  const milliseconds = value => Number(value) / 1e6;

  return {
    schema: RECEIPT_SCHEMA,
    version: 'v0.1',
    measuredAt: new Date(options.now === undefined ? Date.now() : options.now).toISOString(),
    receiptDigest,
    source: {
      label: archiveMap.source.label,
      fingerprint: archiveMap.source.fingerprint,
      absolutePathExposed: false,
      symlinksFollowed: false,
      skippedSymlinks: archiveMap.source.skippedSymlinks
    },
    activeWorkshop: {
      label: active.label,
      fingerprint: active.fingerprint,
      moduleCount: active.moduleCount,
      invalidManifests: active.invalidManifests,
      absolutePathExposed: false
    },
    limits: {
      maxArchives: ArchiveCore.MAX_ARCHIVES,
      maxArchiveBytes: ArchiveCore.MAX_ARCHIVE_BYTES,
      maxEntriesPerArchive: ArchiveCore.MAX_ENTRIES,
      batchSize: requestedBatchSize,
      maxBatchSize: MAX_BATCH_SIZE
    },
    summary: {
      ...workload,
      uniqueArchiveDigests: archiveMap.summary.uniqueArchiveDigests,
      exactDuplicateCopies: archiveMap.summary.exactDuplicateCopies,
      judgmentArchives: judgmentArchives.length,
      readyCandidates: readyCandidates.length,
      judgmentCandidates: judgmentCandidates.length,
      parkedCandidates: parkedCandidates.length,
      archiveDispositionCounts: dispositionCounts,
      candidateDispositionCounts,
      resume: resumeCounts
    },
    archives,
    candidates,
    queues: {
      archiveJudgment: judgmentArchives.map(item => item.id),
      candidateJudgment: judgmentCandidates.map(item => item.id),
      candidateReadyForDeeperReview: readyCandidates.map(item => item.id),
      candidateParkedExactDuplicate: parkedCandidates.map(item => item.id)
    },
    batches: {
      judgment: batch(judgmentCandidates, requestedBatchSize, 'judgment'),
      deeperReview: batch(readyCandidates, requestedBatchSize, 'deeper-review')
    },
    performance: {
      measurement: 'single local deterministic run under the workload declared here; not a capacity guarantee',
      workload,
      archiveMapWallMs: Number(milliseconds(mapped - started).toFixed(3)),
      activeInventoryWallMs: Number(milliseconds(activeMapped - mapped).toFixed(3)),
      totalWallMs: Number(milliseconds(completed - started).toFixed(3)),
      cpuPressureMeasured: false,
      peakMemoryMeasured: false
    },
    handoff: {
      nextOwner: 'Mike + Codex merge gate',
      automaticExtractionAllowed: false,
      automaticReviewApprovalAllowed: false,
      automaticInstallAllowed: false,
      automaticPromotionAllowed: false,
      canonRequiresMike: true
    },
    truth: {
      archiveBytesHashed: true,
      centralDirectoryInspected: true,
      activeManifestIdentityCompared: true,
      archiveExtractionPerformed: false,
      archivedFileContentsRead: false,
      archivedCodeExecuted: false,
      semanticEquivalenceProven: false,
      candidateAccepted: false,
      reviewVoteCast: false,
      installerStagingPerformed: false,
      installationPerformed: false,
      sourceMutationPerformed: false,
      permissionChanged: false,
      promotionPerformed: false,
      canonChanged: false
    }
  };
}

module.exports = {
  RECEIPT_SCHEMA,
  ARCHIVE_SCHEMA,
  CANDIDATE_SCHEMA,
  DEFAULT_BATCH_SIZE,
  MAX_BATCH_SIZE,
  DISPOSITION_PRIORITY,
  sha256,
  stableValue,
  inspectActiveModules,
  inspectArchiveStructure,
  chooseDisposition,
  buildReceipt
};
