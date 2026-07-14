'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SCHEMA = 'axm.game-asset/v1';
const ACCEPTANCE_SCHEMA = 'axm.game-asset-acceptance/v1';
const MAX_BYTES = 6 * 1024 * 1024;
const MAX_DIMENSION = 8192;
const SOURCE_MODULES = ['studio', 'chatgpt-connector'];

function safeSlug(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 72) || 'studio-asset';
}

function inspectPng(dataUrl) {
  const match = String(dataUrl || '').match(/^data:image\/png;base64,([a-z0-9+/=\r\n]+)$/i);
  if (!match) throw new Error('asset must be a PNG data URL');
  const bytes = Buffer.from(match[1], 'base64');
  if (!bytes.length || bytes.length > MAX_BYTES) throw new Error('asset PNG size is outside the 1..' + MAX_BYTES + ' byte boundary');
  if (bytes.length < 8 || bytes.slice(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error('asset data is not a PNG');
  let offset = 8, chunkIndex = 0, width = 0, height = 0, sawIdat = false, sawIend = false;
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    const dataStart = offset + 8;
    const chunkEnd = dataStart + length + 4;
    if (chunkEnd > bytes.length) throw new Error('asset PNG contains a truncated ' + (type || 'unknown') + ' chunk');
    if (chunkIndex === 0) {
      if (type !== 'IHDR' || length !== 13) throw new Error('asset PNG must begin with a 13-byte IHDR chunk');
      width = bytes.readUInt32BE(dataStart);
      height = bytes.readUInt32BE(dataStart + 4);
      if (!width || !height || width > MAX_DIMENSION || height > MAX_DIMENSION) {
        throw new Error('asset PNG dimensions must be between 1 and ' + MAX_DIMENSION + ' pixels');
      }
    } else if (type === 'IHDR') {
      throw new Error('asset PNG contains more than one IHDR chunk');
    }
    if (type === 'IDAT') sawIdat = true;
    offset = chunkEnd;
    chunkIndex++;
    if (type === 'IEND') {
      if (length !== 0) throw new Error('asset PNG IEND chunk must be empty');
      if (offset !== bytes.length) throw new Error('asset PNG has trailing data after IEND');
      sawIend = true;
      break;
    }
  }
  if (!chunkIndex) throw new Error('asset PNG is missing its IHDR chunk');
  if (!sawIend) throw new Error('asset PNG is missing its IEND chunk');
  if (!sawIdat) throw new Error('asset PNG is missing image data');
  return { bytes, width, height };
}

function decodePng(dataUrl) {
  return inspectPng(dataUrl).bytes;
}

function findGameDir(libraryDir, gameId) {
  if (!fs.existsSync(libraryDir)) return null;
  for (const item of fs.readdirSync(libraryDir)) {
    const dir = path.join(libraryDir, item);
    const manifest = path.join(dir, 'game.manifest.json');
    if (!fs.existsSync(manifest)) continue;
    try { if (JSON.parse(fs.readFileSync(manifest, 'utf8')).game_id === gameId) return dir; } catch (e) {}
  }
  return null;
}

function validatePacket(packet, libraryDir) {
  const errors = [];
  if (!packet || typeof packet !== 'object') return { pass: false, errors: ['packet is not an object'] };
  if (packet.schema !== SCHEMA) errors.push('schema must be ' + SCHEMA);
  if (SOURCE_MODULES.indexOf(packet.source_module) < 0) errors.push('source_module must be studio or chatgpt-connector');
  if (!String(packet.target_game_id || '').trim()) errors.push('target_game_id is required');
  else if (!findGameDir(libraryDir, packet.target_game_id)) errors.push('target game is not installed');
  if (!String(packet.name || '').trim()) errors.push('name is required');
  if (packet.status && packet.status !== 'proposal') errors.push('new handoff status must be proposal');
  try { inspectPng(packet.data_url); } catch (e) { errors.push(e.message); }
  return { pass: errors.length === 0, errors };
}

function createHandoff(opts) {
  const packet = opts.packet;
  const checked = validatePacket(packet, opts.libraryDir);
  if (!checked.pass) throw new Error(checked.errors.join('; '));
  const id = 'asset-' + Date.now() + '-' + crypto.randomBytes(3).toString('hex');
  const dir = path.join(opts.inboxDir, id);
  const png = inspectPng(packet.data_url);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'asset.png'), png.bytes);
  const record = {
    schema: SCHEMA,
    id,
    name: String(packet.name).trim().slice(0, 120),
    kind: safeSlug(packet.kind || 'skin'),
    source_module: packet.source_module,
    target_game_id: packet.target_game_id,
    status: 'proposal',
    dimensions: { width: png.width, height: png.height },
    created_at: new Date().toISOString(),
    provenance: packet.provenance && typeof packet.provenance === 'object' ? packet.provenance : {},
    asset_file: 'asset.png'
  };
  fs.writeFileSync(path.join(dir, 'handoff.json'), JSON.stringify(record, null, 2));
  return record;
}

function readRecord(inboxDir, id) {
  const safeId = safeSlug(id);
  if (safeId !== id) throw new Error('invalid handoff id');
  const dir = path.resolve(inboxDir, safeId);
  const prefix = path.resolve(inboxDir) + path.sep;
  if (!dir.startsWith(prefix)) throw new Error('handoff path escape refused');
  const meta = path.join(dir, 'handoff.json');
  if (!fs.existsSync(meta)) throw new Error('handoff not found');
  return { dir, record: JSON.parse(fs.readFileSync(meta, 'utf8')) };
}

function listHandoffs(inboxDir) {
  if (!fs.existsSync(inboxDir)) return [];
  const out = [];
  for (const item of fs.readdirSync(inboxDir)) {
    try { out.push(readRecord(inboxDir, item).record); } catch (e) {}
  }
  return out.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}

function acceptHandoff(opts) {
  const found = readRecord(opts.inboxDir, opts.id);
  const record = found.record;
  if (record.status !== 'proposal') throw new Error('only proposal handoffs can be accepted');
  const gameDir = findGameDir(opts.libraryDir, record.target_game_id);
  if (!gameDir) throw new Error('target game is not installed');
  const destDir = path.join(gameDir, 'assets', safeSlug(record.source_module || 'studio'));
  fs.mkdirSync(destDir, { recursive: true });
  const fileName = safeSlug(record.name) + '-' + record.id.slice(-6) + '.png';
  const dest = path.resolve(destDir, fileName);
  const gamePrefix = path.resolve(gameDir) + path.sep;
  if (!dest.startsWith(gamePrefix)) throw new Error('accepted asset path escape refused');
  fs.copyFileSync(path.join(found.dir, record.asset_file), dest);
  record.status = 'accepted';
  record.acceptance = {
    schema: ACCEPTANCE_SCHEMA,
    accepted_at: new Date().toISOString(),
    package_path: path.relative(gameDir, dest).replace(/\\/g, '/'),
    decision: 'explicit-user-accept'
  };
  fs.writeFileSync(path.join(found.dir, 'handoff.json'), JSON.stringify(record, null, 2));
  return record;
}

module.exports = { SCHEMA, ACCEPTANCE_SCHEMA, MAX_BYTES, MAX_DIMENSION, SOURCE_MODULES, safeSlug, inspectPng, decodePng, validatePacket, createHandoff, listHandoffs, acceptHandoff };
