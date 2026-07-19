'use strict';

const path = require('path');
const U = require('./operations-utils');

const SCHEMA = 'axm.template-runtime-state/v1';
const PACK_SCHEMA = 'axm.template-pack/v1';
const SLOT_TYPES = new Set(['text','markdown','image-ref','asset-ref','number','choice']);

function seedPack() {
  return { schema: PACK_SCHEMA, id: 'workshop-brief', name: 'Workshop Brief', version: '1.0.0', basePackId: null, page: { width: 1200, height: 1600, margin: 72 }, lockedShell: true, slots: [
    { id: 'title', label: 'Title', type: 'text', required: true, locked: false, maxChars: 90, default: '' },
    { id: 'purpose', label: 'Purpose', type: 'markdown', required: true, locked: false, maxChars: 1200, default: '' },
    { id: 'provenance', label: 'Provenance note', type: 'text', required: true, locked: true, maxChars: 220, default: 'Generated inside AXM Workshop; review sources and rights before release.' }
  ], createdAt: U.now(), updatedAt: U.now(), actor: 'system-seed' };
}

function create(options) {
  const stateFile = path.join(options.stateRoot, 'template-runtime-pack-engine', 'packs.json');
  const auditFile = path.join(options.stateRoot, 'template-runtime-pack-engine', 'audit.jsonl');
  const exportDir = path.join(options.exportRoot, 'template-packs');
  function read() { const state = U.loadJson(stateFile, { schema: SCHEMA, version: 1, packs: [] }); if (!state.packs.length) { state.packs.push(seedPack()); write(state); } return state; }
  function write(state) { state.updatedAt = U.now(); U.atomicJson(stateFile, state); }
  function audit(event) { U.appendJsonl(auditFile, Object.assign({ at: U.now() }, event)); }
  function slot(raw) {
    const item = raw || {}, id = U.cleanId(item.id, 'slot id'), type = String(item.type || 'text');
    if (!SLOT_TYPES.has(type)) throw new Error('unsupported template slot type: ' + type);
    const choices = type === 'choice' ? (Array.isArray(item.choices) ? item.choices : []).map(x => String(x).slice(0, 120)).filter(Boolean).slice(0, 50) : [];
    if (type === 'choice' && !choices.length) throw new Error('choice slot needs choices');
    return { id, label: String(item.label || id).slice(0, 120), type, required: item.required === true, locked: item.locked === true, maxChars: Math.max(1, Math.min(100000, Number(item.maxChars) || 2000)), default: item.default == null ? '' : item.default, choices };
  }
  function normalizePack(raw, actor) {
    const body = raw || {}, page = body.page || {}, slots = (Array.isArray(body.slots) ? body.slots : []).map(slot);
    if (!slots.length || slots.length > 100) throw new Error('template pack needs 1 to 100 slots');
    if (new Set(slots.map(x => x.id)).size !== slots.length) throw new Error('template slot ids must be unique');
    return { schema: PACK_SCHEMA, id: U.cleanId(body.id, 'pack id'), name: String(body.name || body.id || '').trim().slice(0, 160), version: String(body.version || '1.0.0').slice(0, 40), basePackId: body.basePackId ? U.cleanId(body.basePackId, 'base pack id') : null, page: { width: Math.max(200, Math.min(10000, Number(page.width) || 1200)), height: Math.max(200, Math.min(10000, Number(page.height) || 1600)), margin: Math.max(0, Math.min(1000, Number(page.margin) || 48)) }, lockedShell: body.lockedShell === true, slots, createdAt: body.createdAt || U.now(), updatedAt: U.now(), actor: String(actor || 'local-user').slice(0, 120) };
  }
  function resolveFrom(packs, id, stack) {
    const trail = stack || [], pack = packs.find(x => x.id === id);
    if (!pack) throw new Error('template pack not found');
    if (trail.includes(id) || trail.length >= 5) throw new Error('template inheritance cycle or depth limit exceeded');
    if (!pack.basePackId) return U.clone(pack);
    const base = resolveFrom(packs, pack.basePackId, trail.concat(id)), byId = new Map(base.slots.map(x => [x.id, x]));
    for (const child of pack.slots) {
      const inherited = byId.get(child.id);
      if (inherited && inherited.locked && JSON.stringify(child) !== JSON.stringify(inherited)) throw new Error('locked inherited slot cannot be overridden: ' + child.id);
      if (!inherited || !inherited.locked) byId.set(child.id, child);
    }
    return Object.assign({}, pack, { page: Object.assign({}, base.page, pack.page), lockedShell: base.lockedShell || pack.lockedShell, slots: Array.from(byId.values()), inheritance: (base.inheritance || [base.id]).concat(pack.id) });
  }
  function savePack(input, actor) {
    const state = read(), pack = normalizePack(input, actor), existing = state.packs.find(x => x.id === pack.id);
    if (pack.basePackId === pack.id) throw new Error('template cannot inherit itself');
    if (pack.basePackId && !state.packs.some(x => x.id === pack.basePackId)) throw new Error('base template pack not found');
    if (existing) pack.createdAt = existing.createdAt;
    const testPacks = state.packs.filter(x => x.id !== pack.id).concat(pack); resolveFrom(testPacks, pack.id, []);
    state.packs = testPacks; write(state); audit({ type: existing ? 'pack-updated' : 'pack-created', id: pack.id, actor: pack.actor }); return U.clone(pack);
  }
  function render(input) {
    const body = input || {}, state = read(), pack = resolveFrom(state.packs, U.cleanId(body.packId, 'pack id'), []), values = body.values && typeof body.values === 'object' ? body.values : {}, mode = body.mode === 'ai-proposal' ? 'ai-proposal' : 'explicit-fill', fields = {}, warnings = [];
    for (const item of pack.slots) {
      const supplied = Object.prototype.hasOwnProperty.call(values, item.id), value = supplied ? values[item.id] : item.default;
      if (item.locked && supplied && JSON.stringify(value) !== JSON.stringify(item.default)) warnings.push({ slot: item.id, code: 'LOCKED', message: 'Locked shell value was preserved.' });
      const finalValue = item.locked ? item.default : value, text = typeof finalValue === 'string' ? finalValue : JSON.stringify(finalValue);
      if (item.required && !String(text || '').trim()) warnings.push({ slot: item.id, code: 'REQUIRED', message: 'Required slot is empty.' });
      if (text.length > item.maxChars) warnings.push({ slot: item.id, code: 'OVERFLOW', message: text.length + ' characters exceed the ' + item.maxChars + ' character slot.' });
      if (item.type === 'choice' && text && !item.choices.includes(String(finalValue))) warnings.push({ slot: item.id, code: 'CHOICE', message: 'Value is not one of the declared choices.' });
      fields[item.id] = finalValue;
    }
    if (pack.page.margin < 12) warnings.push({ slot: null, code: 'MARGIN', message: 'Page margin is below the 12-unit safety threshold.' });
    const result = { schema: 'axm.template-render-preview/v1', id: U.uid('template-preview'), packId: pack.id, packVersion: pack.version, inheritance: pack.inheritance || [pack.id], mode, fields, page: pack.page, warnings, pass: warnings.every(x => !['REQUIRED','OVERFLOW','CHOICE'].includes(x.code)), applied: mode === 'explicit-fill', reviewRequired: mode === 'ai-proposal', generatedAt: U.now(), truth: { aiFillIsProposalOnly: mode === 'ai-proposal', lockedShellPreserved: true, automaticExport: false } };
    result.digest = U.sha256(JSON.stringify(result)); audit({ type: 'render-preview', id: result.id, packId: pack.id, mode, pass: result.pass, digest: result.digest }); return result;
  }
  function exportPack(id, actor) {
    const pack = resolveFrom(read().packs, U.cleanId(id, 'pack id'), []), name = pack.id + '-' + pack.version.replace(/[^a-z0-9.-]/gi, '-') + '.template-pack.json', file = path.join(exportDir, name);
    U.atomicJson(file, Object.assign({}, pack, { exportedAt: U.now(), exportedBy: String(actor || 'local-user').slice(0, 120) })); audit({ type: 'pack-exported', id: pack.id, file: path.relative(options.root, file).replace(/\\/g, '/') }); return { file: path.relative(options.root, file).replace(/\\/g, '/'), url: '/exports/template-packs/' + encodeURIComponent(name), sha256: U.fileSha256(file), bytes: require('fs').statSync(file).size };
  }
  function status() { const state = read(); return { schema: SCHEMA, packs: state.packs.map(x => ({ id: x.id, name: x.name, version: x.version, basePackId: x.basePackId, slots: x.slots.length, lockedShell: x.lockedShell })), packCount: state.packs.length, inheritanceDepthLimit: 5, aiFillAutomatic: false }; }
  return { status, savePack, render, exportPack, resolve: id => resolveFrom(read().packs, id, []), stateFile, auditFile };
}

module.exports = { SCHEMA, PACK_SCHEMA, create };
