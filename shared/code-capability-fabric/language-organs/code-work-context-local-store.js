'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const dock = require('./code-work-context-dock.js');

function hashText(v) {
  return crypto.createHash('sha256').update(String(v)).digest('hex');
}

function safeSegment(v) {
  const s = String(v || '').trim();
  if (!s || !/^[a-zA-Z0-9._-]{1,120}$/.test(s) || s === '.' || s === '..') {
    throw new Error('WORK_CONTEXT_STORE_PROJECT_ID_UNSAFE');
  }
  return s;
}

function assertRegularOrMissing(target) {
  if (!fs.existsSync(target)) return;
  const stat = fs.lstatSync(target);
  if (stat.isSymbolicLink()) throw new Error(`WORK_CONTEXT_STORE_SYMLINK_REFUSED:${target}`);
}

function ensureDir(target) {
  assertRegularOrMissing(target);
  if (!fs.existsSync(target)) fs.mkdirSync(target, { recursive: true });
  const stat = fs.lstatSync(target);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`WORK_CONTEXT_STORE_DIRECTORY_INVALID:${target}`);
}

function resolveProjectRoot(rootInput, projectId) {
  const root = path.resolve(String(rootInput || ''));
  if (!rootInput) throw new Error('WORK_CONTEXT_STORE_ROOT_REQUIRED');
  ensureDir(root);
  const projectRoot = path.resolve(root, safeSegment(projectId));
  if (!projectRoot.startsWith(root + path.sep)) throw new Error('WORK_CONTEXT_STORE_PATH_ESCAPE');
  ensureDir(projectRoot);
  return { root, projectRoot };
}

function layout(rootInput, projectId) {
  const { root, projectRoot } = resolveProjectRoot(rootInput, projectId);
  const paths = {
    root,
    projectRoot,
    directionRevisions: path.join(projectRoot, 'direction', 'revisions'),
    activeDirection: path.join(projectRoot, 'direction', 'active.json'),
    progressEvents: path.join(projectRoot, 'progress', 'events'),
    scratchNotes: path.join(projectRoot, 'scratch', 'notes'),
    hotCard: path.join(projectRoot, 'hot', 'context-card.json')
  };
  for (const dir of [paths.directionRevisions, paths.progressEvents, paths.scratchNotes, path.dirname(paths.hotCard)]) ensureDir(dir);
  return paths;
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
  const body = stableJson(value);
  if (fs.existsSync(file)) {
    const current = fs.readFileSync(file, 'utf8');
    if (current !== body) throw new Error(`WORK_CONTEXT_STORE_IMMUTABLE_COLLISION:${file}`);
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
  return { result: 'DERIVED_OR_POINTER_WRITTEN', fileDigest: hashText(body) };
}

function readJson(file) {
  assertRegularOrMissing(file);
  if (!fs.existsSync(file)) return null;
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`WORK_CONTEXT_STORE_FILE_INVALID:${file}`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function listJson(dir) {
  ensureDir(dir);
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter(e => e.isFile() && !e.isSymbolicLink() && e.name.endsWith('.json'))
    .map(e => path.join(dir, e.name))
    .sort();
}

function putDirection({ root, direction } = {}) {
  if (!direction || direction.schema !== 'axm.code.work-direction.v1') throw new Error('WORK_CONTEXT_STORE_DIRECTION_INVALID');
  const paths = layout(root, direction.projectId);
  const file = path.join(paths.directionRevisions, `${direction.directionSha256}.json`);
  const write = writeImmutable(file, direction);
  return Object.freeze({ schema: 'axm.code.work-context-store-receipt.v1', operation: 'PUT_DIRECTION', projectId: direction.projectId, directionSha256: direction.directionSha256, relativePath: path.relative(paths.root, file).split(path.sep).join('/'), ...write, authority: 'SCOPED_LOCAL_STATE_ONLY' });
}

function selectActiveDirection({ root, projectId, directionSha256, actorClass = 'UNKNOWN' } = {}) {
  const paths = layout(root, projectId);
  const directionFile = path.join(paths.directionRevisions, `${String(directionSha256)}.json`);
  const direction = readJson(directionFile);
  if (!direction || direction.directionSha256 !== directionSha256) throw new Error('WORK_CONTEXT_STORE_DIRECTION_NOT_PRESENT');
  const pointer = {
    schema: 'axm.code.active-work-direction.v1',
    version: '1.0.0',
    projectId: direction.projectId,
    directionSha256,
    selectedBy: String(actorClass || 'UNKNOWN').toUpperCase(),
    truth: { pointerOnly: true, directionRevisionNotMutated: true, selectionIsNotCanon: true }
  };
  const write = writeAtomic(paths.activeDirection, pointer);
  return Object.freeze({ schema: 'axm.code.work-context-store-receipt.v1', operation: 'SELECT_ACTIVE_DIRECTION', projectId: direction.projectId, directionSha256, relativePath: path.relative(paths.root, paths.activeDirection).split(path.sep).join('/'), ...write, authority: 'SCOPED_LOCAL_STATE_ONLY' });
}

function putProgressEvent({ root, event } = {}) {
  if (!event || event.schema !== 'axm.code.work-progress-event.v1') throw new Error('WORK_CONTEXT_STORE_PROGRESS_INVALID');
  const paths = layout(root, event.projectId);
  const file = path.join(paths.progressEvents, `${String(event.sequence).padStart(8, '0')}-${event.eventSha256}.json`);
  const write = writeImmutable(file, event);
  return Object.freeze({ schema: 'axm.code.work-context-store-receipt.v1', operation: 'PUT_PROGRESS_EVENT', projectId: event.projectId, eventSha256: event.eventSha256, relativePath: path.relative(paths.root, file).split(path.sep).join('/'), ...write, authority: 'SCOPED_LOCAL_STATE_ONLY' });
}

function putScratchNote({ root, note } = {}) {
  if (!note || note.schema !== 'axm.code.work-scratch-note.v1') throw new Error('WORK_CONTEXT_STORE_SCRATCH_INVALID');
  const paths = layout(root, note.projectId);
  const file = path.join(paths.scratchNotes, `${String(note.sequence).padStart(8, '0')}-${note.noteSha256}.json`);
  const write = writeImmutable(file, note);
  return Object.freeze({ schema: 'axm.code.work-context-store-receipt.v1', operation: 'PUT_SCRATCH_NOTE', projectId: note.projectId, noteSha256: note.noteSha256, relativePath: path.relative(paths.root, file).split(path.sep).join('/'), ...write, authority: 'SCOPED_LOCAL_STATE_ONLY' });
}

function putContextCard({ root, card } = {}) {
  if (!card || card.schema !== 'axm.code.work-context-card.v1') throw new Error('WORK_CONTEXT_STORE_CARD_INVALID');
  const paths = layout(root, card.projectId);
  const active = readJson(paths.activeDirection);
  if (!active || active.directionSha256 !== card.directionSha256) throw new Error('WORK_CONTEXT_STORE_CARD_STALE_OR_NO_ACTIVE_DIRECTION');
  const write = writeAtomic(paths.hotCard, card);
  return Object.freeze({ schema: 'axm.code.work-context-store-receipt.v1', operation: 'PUT_CONTEXT_CARD', projectId: card.projectId, cardSha256: card.cardSha256, relativePath: path.relative(paths.root, paths.hotCard).split(path.sep).join('/'), ...write, authority: 'SCOPED_LOCAL_STATE_ONLY' });
}

function readContext({ root, projectId } = {}) {
  const paths = layout(root, projectId);
  const active = readJson(paths.activeDirection);
  if (!active) return Object.freeze({ schema: 'axm.code.work-context-read.v1', result: 'NO_ACTIVE_DIRECTION', projectId: safeSegment(projectId), authority: 'SCOPED_LOCAL_STATE_ONLY' });
  const direction = readJson(path.join(paths.directionRevisions, `${active.directionSha256}.json`));
  if (!direction) throw new Error('WORK_CONTEXT_STORE_ACTIVE_DIRECTION_MISSING');
  const progressEvents = listJson(paths.progressEvents).map(readJson).filter(e => e.directionSha256 === direction.directionSha256);
  const scratchNotes = listJson(paths.scratchNotes).map(readJson).filter(n => !n.directionSha256 || n.directionSha256 === direction.directionSha256);
  const storedCard = readJson(paths.hotCard);
  const cardStatus = storedCard ? dock.verifyContextCard({ card: storedCard, direction }).result : 'NO_STORED_CONTEXT_CARD';
  const rebuiltCard = dock.buildContextCard({ direction, progressEvents, scratchNotes });
  return Object.freeze({
    schema: 'axm.code.work-context-read.v1',
    version: '1.0.0',
    result: 'WORK_CONTEXT_READY',
    projectId: direction.projectId,
    activeDirection: active,
    direction,
    progressEvents,
    scratchNotes,
    storedCardStatus: cardStatus,
    rebuiltCard,
    truth: {
      readScope: 'OWN_WORK_CONTEXT_STATE_ONLY',
      sourceWorkspaceRead: false,
      rawSourceStored: false,
      scratchNotesVisibleToCaller: true,
      contextCardRebuiltFromImmutableAndAppendOnlyInputs: true
    },
    authority: 'SCOPED_LOCAL_STATE_ONLY'
  });
}

function storeDescriptor(projectId) {
  const pid = safeSegment(projectId);
  return Object.freeze({
    schema: 'axm.code.work-context-local-store-layout.v1',
    projectId: pid,
    logicalRoot: `state/code-work-context/${pid}`,
    lanes: {
      directionRevisions: 'direction/revisions/<direction-sha256>.json',
      activeDirectionPointer: 'direction/active.json',
      progressEvents: 'progress/events/<sequence>-<event-sha256>.json',
      scratchNotes: 'scratch/notes/<sequence>-<note-sha256>.json',
      hotContextCard: 'hot/context-card.json'
    },
    truth: {
      sourceTreeStorageRecommended: false,
      localStateOnly: true,
      directionRevisionsImmutable: true,
      progressAndScratchImmutableObjects: true,
      activePointerAndHotCardDerivedMutableState: true,
      arbitraryFilesystemAccess: false
    },
    authority: 'SCOPED_LOCAL_STATE_ONLY'
  });
}

module.exports = {
  layout,
  putDirection,
  selectActiveDirection,
  putProgressEvent,
  putScratchNote,
  putContextCard,
  readContext,
  storeDescriptor
};
