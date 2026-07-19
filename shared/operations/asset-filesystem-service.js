'use strict';

const fs = require('fs');
const path = require('path');
const U = require('./operations-utils');

function imageSize(file, ext) {
  try {
    const fd = fs.openSync(file, 'r'), buf = Buffer.alloc(32); fs.readSync(fd, buf, 0, 32, 0); fs.closeSync(fd);
    if (ext === '.png' && buf.toString('ascii', 1, 4) === 'PNG') return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
    if (ext === '.gif' && buf.toString('ascii', 0, 3) === 'GIF') return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
  } catch (_) {}
  return null;
}

function create(options) {
  const root = options.root, assetsRoot = path.join(root, 'assets'), stateDir = path.join(options.stateRoot, 'asset-filesystem-service'), indexFile = path.join(stateDir, 'index.json'), auditFile = path.join(stateDir, 'audit.jsonl'), exportRoot = path.join(options.exportRoot, 'asset-packs');
  let memory = null, watcher = null, debounce = null;
  function build() {
    const scan = U.walk(assetsRoot, { maxFiles: 20000, maxBytes: 2 * 1024 * 1024 * 1024, excludedNames: ['.git','node_modules'] }), assets = [], duplicates = new Map();
    for (const file of scan.files) {
      const ext = path.extname(file.absolute).toLowerCase(), digest = U.fileSha256(file.absolute), id = 'asset-' + digest.slice(0, 16), dimensions = imageSize(file.absolute, ext);
      const item = { id, path: 'assets/' + file.relative, relativePath: file.relative, name: path.basename(file.absolute), extension: ext, mediaType: ['.png','.jpg','.jpeg','.gif','.webp','.svg'].includes(ext) ? 'image' : ['.wav','.mp3','.ogg','.flac'].includes(ext) ? 'audio' : ['.mp4','.webm','.mov'].includes(ext) ? 'video' : 'file', bytes: file.bytes, modifiedAt: file.modifiedAt, sha256: digest, dimensions, duplicateCount: 1 };
      assets.push(item); const group = duplicates.get(digest) || []; group.push(item.path); duplicates.set(digest, group);
    }
    assets.forEach(item => { item.duplicateCount = duplicates.get(item.sha256).length; });
    memory = { schema: 'axm.asset-filesystem-index/v1', builtAt: U.now(), assetCount: assets.length, totalBytes: scan.bytes, assets, duplicateGroups: Array.from(duplicates.entries()).filter(([, paths]) => paths.length > 1).map(([sha256, paths]) => ({ sha256, paths })) };
    U.atomicJson(indexFile, memory); U.appendJsonl(auditFile, { type: 'indexed', at: U.now(), assetCount: assets.length, totalBytes: scan.bytes, duplicateGroups: memory.duplicateGroups.length }); return summary();
  }
  function index() { if (memory) return memory; memory = U.loadJson(indexFile, null); if (!memory || memory.schema !== 'axm.asset-filesystem-index/v1') build(); return memory; }
  function list(input) { const q = String(input && input.q || '').trim().toLowerCase(), kind = String(input && input.kind || ''); let rows = index().assets; if (q) rows = rows.filter(x => (x.name + ' ' + x.path).toLowerCase().includes(q)); if (kind) rows = rows.filter(x => x.mediaType === kind); return rows.slice(0, Math.max(1, Math.min(500, Number(input && input.limit) || 200))).map(U.clone); }
  function find(id) { const item = index().assets.find(asset => asset.id === id); if (!item) throw new Error('asset not found'); return item; }
  function file(id) { const item = find(id), absolute = U.resolveUnder(assetsRoot, item.relativePath); if (!fs.existsSync(absolute) || U.fileSha256(absolute) !== item.sha256) { memory = null; throw new Error('asset changed; rebuild the index'); } return { item: U.clone(item), absolute }; }
  function createPack(input) {
    const ids = Array.from(new Set(Array.isArray(input.ids) ? input.ids.map(String) : [])); if (!ids.length || ids.length > 200) return Promise.reject(new Error('select 1–200 assets'));
    const name = String(input.name || 'asset-pack').trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'asset-pack';
    const packId = name + '-' + Date.now().toString(36), staging = path.join(exportRoot, '.staging-' + packId), zip = path.join(exportRoot, packId + '.zip');
    fs.mkdirSync(staging, { recursive: true }); const records = [];
    try {
      for (const id of ids) { const found = file(id), target = U.resolveUnder(staging, found.item.relativePath); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.copyFileSync(found.absolute, target); records.push(found.item); }
      U.atomicJson(path.join(staging, 'ASSET_PACK_MANIFEST.json'), { schema: 'axm.asset-pack/v1', id: packId, name, createdAt: U.now(), assets: records.map(x => ({ path: x.relativePath, sha256: x.sha256, bytes: x.bytes, mediaType: x.mediaType })), sourceChanges: false });
    } catch (error) { fs.rmSync(staging, { recursive: true, force: true }); return Promise.reject(error); }
    try {
      const archive = U.zipDirectory(staging, zip, { maxFiles: 201, maxBytes: 2 * 1024 * 1024 * 1024 }), stat = fs.statSync(zip);
      U.appendJsonl(auditFile, { type: 'pack-created', at: U.now(), packId, assets: records.length, bytes: stat.size, archiveEngine: 'axm-native-zip-store', requiredThirdPartyDependencies: [] });
      return Promise.resolve({ id: packId, file: path.basename(zip), url: '/exports/asset-packs/' + encodeURIComponent(path.basename(zip)), assets: records.length, bytes: stat.size, archiveEngine: 'axm-native-zip-store', requiredThirdPartyDependencies: archive.requiredThirdPartyDependencies });
    } catch (error) { return Promise.reject(error); }
    finally { try { fs.rmSync(staging, { recursive: true, force: true }); } catch (_) {} }
  }
  function startWatcher() {
    if (watcher || !fs.existsSync(assetsRoot)) return !!watcher;
    try { watcher = fs.watch(assetsRoot, { recursive: true }, () => { clearTimeout(debounce); debounce = setTimeout(() => { try { build(); } catch (_) {} }, 700); }); if (watcher.unref) watcher.unref(); } catch (_) { watcher = null; }
    return !!watcher;
  }
  function stopWatcher() { if (watcher) watcher.close(); watcher = null; clearTimeout(debounce); }
  function summary() { const value = index(); return { builtAt: value.builtAt, assetCount: value.assetCount, totalBytes: value.totalBytes, duplicateGroups: value.duplicateGroups.length, watcherActive: !!watcher }; }
  return { build, list, find, file, createPack, startWatcher, stopWatcher, summary, indexFile, auditFile };
}

module.exports = { imageSize, create };
