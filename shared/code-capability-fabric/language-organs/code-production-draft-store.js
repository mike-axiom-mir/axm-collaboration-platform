'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function hashText(v) {
  return crypto.createHash('sha256').update(String(v)).digest('hex');
}

function safeSegment(v, code = 'PRODUCTION_STORE_SEGMENT_UNSAFE') {
  const s = String(v || '').trim();
  if (!s || !/^[a-zA-Z0-9._:-]{1,160}$/.test(s) || s === '.' || s === '..') throw new Error(code);
  return s;
}

function assertRegularOrMissing(target) {
  if (!fs.existsSync(target)) return;
  const stat = fs.lstatSync(target);
  if (stat.isSymbolicLink()) throw new Error(`PRODUCTION_STORE_SYMLINK_REFUSED:${target}`);
}

function ensureDir(target) {
  assertRegularOrMissing(target);
  if (!fs.existsSync(target)) fs.mkdirSync(target, { recursive: true });
  const stat = fs.lstatSync(target);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`PRODUCTION_STORE_DIRECTORY_INVALID:${target}`);
}

function stableJson(value) {
  function stable(v) {
    if (Array.isArray(v)) return v.map(stable);
    if (v && typeof v === 'object') {
      const out = {};
      for (const key of Object.keys(v).sort()) out[key] = stable(v[key]);
      return out;
    }
    return v;
  }
  return JSON.stringify(stable(value), null, 2) + '\n';
}

function writeImmutable(file, value) {
  assertRegularOrMissing(file);
  ensureDir(path.dirname(file));
  const body = stableJson(value);
  if (fs.existsSync(file)) {
    const current = fs.readFileSync(file, 'utf8');
    if (current !== body) throw new Error(`PRODUCTION_STORE_IMMUTABLE_COLLISION:${file}`);
    return { result: 'IMMUTABLE_OBJECT_ALREADY_PRESENT', fileDigest: hashText(current) };
  }
  fs.writeFileSync(file, body, { encoding: 'utf8', flag: 'wx' });
  return { result: 'IMMUTABLE_OBJECT_WRITTEN', fileDigest: hashText(body) };
}

function writeAtomic(file, value) {
  assertRegularOrMissing(file);
  ensureDir(path.dirname(file));
  const body = stableJson(value);
  const temp = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.${hashText(body).slice(0, 8)}.tmp`);
  fs.writeFileSync(temp, body, { encoding: 'utf8', flag: 'wx' });
  fs.renameSync(temp, file);
  return { result: 'POINTER_WRITTEN', fileDigest: hashText(body) };
}

function readJson(file) {
  assertRegularOrMissing(file);
  if (!fs.existsSync(file)) return null;
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`PRODUCTION_STORE_FILE_INVALID:${file}`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function projectRoot(rootInput, projectId) {
  if (!rootInput) throw new Error('PRODUCTION_STORE_ROOT_REQUIRED');
  const root = path.resolve(String(rootInput));
  ensureDir(root);
  const pid = safeSegment(projectId, 'PRODUCTION_STORE_PROJECT_ID_UNSAFE');
  const target = path.resolve(root, pid, 'production');
  if (!target.startsWith(root + path.sep)) throw new Error('PRODUCTION_STORE_PATH_ESCAPE');
  ensureDir(target);
  return { root, pid, target };
}

function layout(rootInput, projectId, batchSha256 = null, draftId = null) {
  const base = projectRoot(rootInput, projectId);
  const paths = {
    root: base.root,
    projectId: base.pid,
    productionRoot: base.target,
    batches: path.join(base.target, 'batches'),
    drafts: path.join(base.target, 'drafts')
  };
  ensureDir(paths.batches);
  ensureDir(paths.drafts);
  if (batchSha256) {
    const batch = safeSegment(batchSha256, 'PRODUCTION_STORE_BATCH_ID_UNSAFE');
    paths.batchFile = path.join(paths.batches, `${batch}.json`);
    paths.selectionFile = path.join(paths.batches, `${batch}.selection.json`);
    paths.batchDraftRoot = path.join(paths.drafts, batch);
    ensureDir(paths.batchDraftRoot);
    if (draftId) {
      const did = safeSegment(draftId, 'PRODUCTION_STORE_DRAFT_ID_UNSAFE');
      paths.draftRoot = path.join(paths.batchDraftRoot, did);
      paths.revisions = path.join(paths.draftRoot, 'revisions');
      paths.activeRevision = path.join(paths.draftRoot, 'active.json');
      ensureDir(paths.revisions);
    }
  }
  return paths;
}

function rejectRawSource(value) {
  if (!value || typeof value !== 'object') return;
  if (value.sourceCode != null || value.body != null || value.bytes != null) throw new Error('PRODUCTION_STORE_RAW_SOURCE_REFUSED');
  if (value.keyProgram && value.keyProgram.sourceCode != null) throw new Error('PRODUCTION_STORE_RAW_SOURCE_REFUSED');
  if (value.artifact && (value.artifact.sourceCode != null || value.artifact.body != null || value.artifact.bytes != null)) throw new Error('PRODUCTION_STORE_RAW_SOURCE_REFUSED');
}

function putBatch({ root, batch } = {}) {
  if (!batch || batch.schema !== 'axm.code.production-batch.v1' || batch.result !== 'PRODUCTION_BATCH_READY') throw new Error('PRODUCTION_STORE_BATCH_INVALID');
  rejectRawSource(batch);
  const paths = layout(root, batch.projectId, batch.batchSha256);
  const write = writeImmutable(paths.batchFile, batch);
  return Object.freeze({
    schema: 'axm.code.production-store-receipt.v1',
    operation: 'PUT_BATCH',
    projectId: batch.projectId,
    batchSha256: batch.batchSha256,
    relativePath: path.relative(paths.root, paths.batchFile).split(path.sep).join('/'),
    ...write,
    authority: 'SCOPED_LOCAL_STATE_ONLY'
  });
}

function putDraftRevision({ root, draft } = {}) {
  if (!draft || draft.schema !== 'axm.code.production-draft-revision.v1') throw new Error('PRODUCTION_STORE_DRAFT_INVALID');
  rejectRawSource(draft);
  const paths = layout(root, draft.projectId, draft.batchSha256, draft.draftId);
  const file = path.join(paths.revisions, `${String(draft.revision).padStart(6, '0')}-${draft.draftRevisionSha256}.json`);
  const write = writeImmutable(file, draft);
  return Object.freeze({
    schema: 'axm.code.production-store-receipt.v1',
    operation: 'PUT_DRAFT_REVISION',
    projectId: draft.projectId,
    batchSha256: draft.batchSha256,
    draftId: draft.draftId,
    draftRevisionSha256: draft.draftRevisionSha256,
    relativePath: path.relative(paths.root, file).split(path.sep).join('/'),
    ...write,
    authority: 'SCOPED_LOCAL_STATE_ONLY'
  });
}

function selectActiveDraftRevision({ root, draft, actorClass = 'UNKNOWN' } = {}) {
  if (!draft || draft.schema !== 'axm.code.production-draft-revision.v1') throw new Error('PRODUCTION_STORE_DRAFT_INVALID');
  const paths = layout(root, draft.projectId, draft.batchSha256, draft.draftId);
  const expected = path.join(paths.revisions, `${String(draft.revision).padStart(6, '0')}-${draft.draftRevisionSha256}.json`);
  if (!readJson(expected)) throw new Error('PRODUCTION_STORE_DRAFT_REVISION_NOT_PRESENT');
  const pointer = {
    schema: 'axm.code.active-production-draft-revision.v1',
    version: '1.0.0',
    projectId: draft.projectId,
    batchSha256: draft.batchSha256,
    draftId: draft.draftId,
    revision: draft.revision,
    draftRevisionSha256: draft.draftRevisionSha256,
    selectedBy: String(actorClass || 'UNKNOWN').toUpperCase(),
    truth: { pointerOnly: true, revisionNotMutated: true, selectionIsNotPromotion: true }
  };
  const write = writeAtomic(paths.activeRevision, pointer);
  return Object.freeze({
    schema: 'axm.code.production-store-receipt.v1',
    operation: 'SELECT_ACTIVE_DRAFT_REVISION',
    projectId: draft.projectId,
    batchSha256: draft.batchSha256,
    draftId: draft.draftId,
    relativePath: path.relative(paths.root, paths.activeRevision).split(path.sep).join('/'),
    ...write,
    authority: 'SCOPED_LOCAL_STATE_ONLY'
  });
}

function putSelection({ root, selection } = {}) {
  if (!selection || selection.schema !== 'axm.code.production-draft-selection.v1' || selection.result !== 'DRAFT_SELECTED_NOT_PROMOTED') throw new Error('PRODUCTION_STORE_SELECTION_INVALID');
  const paths = layout(root, selection.projectId, selection.batchSha256);
  const value = { ...selection, truth: { ...selection.truth, storedSelectionIsNotPromotion: true } };
  const write = writeAtomic(paths.selectionFile, value);
  return Object.freeze({
    schema: 'axm.code.production-store-receipt.v1',
    operation: 'PUT_SELECTION_POINTER',
    projectId: selection.projectId,
    batchSha256: selection.batchSha256,
    relativePath: path.relative(paths.root, paths.selectionFile).split(path.sep).join('/'),
    ...write,
    authority: 'SCOPED_LOCAL_STATE_ONLY'
  });
}

function readBatch({ root, projectId, batchSha256 } = {}) {
  const paths = layout(root, projectId, batchSha256);
  const batch = readJson(paths.batchFile);
  if (!batch) return Object.freeze({ schema: 'axm.code.production-store-read.v1', result: 'BATCH_NOT_FOUND', projectId: safeSegment(projectId), batchSha256, authority: 'SCOPED_LOCAL_STATE_ONLY' });
  const drafts = [];
  if (fs.existsSync(paths.batchDraftRoot)) {
    for (const entry of fs.readdirSync(paths.batchDraftRoot, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
      const dpaths = layout(root, projectId, batchSha256, entry.name);
      const files = fs.readdirSync(dpaths.revisions, { withFileTypes: true })
        .filter(e => e.isFile() && !e.isSymbolicLink() && e.name.endsWith('.json'))
        .map(e => path.join(dpaths.revisions, e.name))
        .sort();
      const revisions = files.map(readJson);
      const active = readJson(dpaths.activeRevision);
      drafts.push({ draftId: entry.name, revisions, active });
    }
  }
  const selection = readJson(paths.selectionFile);
  return Object.freeze({
    schema: 'axm.code.production-store-read.v1',
    version: '1.0.0',
    result: 'PRODUCTION_BATCH_STATE_READY',
    projectId: batch.projectId,
    batch,
    drafts,
    selection,
    truth: {
      readScope: 'OWN_WORK_CONTEXT_PRODUCTION_STATE_ONLY',
      sourceWorkspaceRead: false,
      rawSourceStored: false,
      immutableDraftRevisions: true,
      activeRevisionPointersAreNotPromotion: true
    },
    authority: 'SCOPED_LOCAL_STATE_ONLY'
  });
}

function storeDescriptor(projectId) {
  const pid = safeSegment(projectId, 'PRODUCTION_STORE_PROJECT_ID_UNSAFE');
  return Object.freeze({
    schema: 'axm.code.production-store-layout.v1',
    projectId: pid,
    logicalRoot: `state/code-work-context/${pid}/production`,
    lanes: {
      batches: 'batches/<batch-sha256>.json',
      draftRevisions: 'drafts/<batch-sha256>/<draft-id>/revisions/<revision>-<draft-revision-sha256>.json',
      activeDraftRevision: 'drafts/<batch-sha256>/<draft-id>/active.json',
      selectedDraftPointer: 'batches/<batch-sha256>.selection.json'
    },
    truth: {
      sourceWorkspaceStorage: false,
      rawSourceStored: false,
      batchAndRevisionObjectsImmutable: true,
      pointersMutableAndRebuildable: true,
      arbitraryFilesystemAccess: false
    },
    authority: 'SCOPED_LOCAL_STATE_ONLY'
  });
}

module.exports = {
  layout,
  putBatch,
  putDraftRevision,
  selectActiveDraftRevision,
  putSelection,
  readBatch,
  storeDescriptor
};
