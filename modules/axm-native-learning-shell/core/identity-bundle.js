'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const WorkshopRoot = require('../../../config/workshop-root');

const MIRROR_ROOT = path.resolve(__dirname, '..', '..', '..');

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

function digest(value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(typeof value === 'string' ? value : stable(value), 'utf8');
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function readJson(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (_) { return fallback; }
}

function source(file, root) {
  const bytes = fs.readFileSync(file);
  return {
    path: path.relative(root, file).replace(/\\/g, '/'),
    sha256: digest(bytes),
    bytes: bytes.length
  };
}

function skillManifests(root) {
  const base = path.join(root, 'skills');
  if (!fs.existsSync(base)) return [];
  return fs.readdirSync(base, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => path.join(base, entry.name, 'skill.json'))
    .filter(file => fs.existsSync(file))
    .map(file => ({ manifest: readJson(file, {}), source: source(file, root) }));
}

function curriculumSources(root) {
  const base = path.join(root, 'curricula');
  if (!fs.existsSync(base)) return [];
  return fs.readdirSync(base)
    .filter(name => /\.(md|txt|json)$/i.test(name))
    .sort()
    .map(name => {
      const file = path.join(base, name);
      const content = fs.readFileSync(file, 'utf8');
      return { id: name.replace(/\.[^.]+$/, '').toLowerCase(), content, source: source(file, root) };
    });
}

function reasoningProfiles(workshopRoot) {
  const file = path.join(workshopRoot, 'tools', 'reasoning-shell', 'profiles.json');
  const raw = readJson(file, { profiles: {} });
  return {
    profiles: Object.entries(raw.profiles || {}).map(([id, profile]) => Object.assign({ id }, profile)),
    source: fs.existsSync(file) ? source(file, workshopRoot) : null
  };
}

function workshopIdentity(workshopRoot) {
  const file = path.join(workshopRoot, 'tools', 'agent-command-center', 'identity-bindings', 'mirror.identity.json');
  return { binding: readJson(file, null), source: fs.existsSync(file) ? source(file, workshopRoot) : null };
}

function workshopWisdom(workshopRoot) {
  const file = path.join(workshopRoot, 'tools', 'agent-command-center', 'identity-registry.js');
  if (!fs.existsSync(file)) return { memories: [], context: null, source: null, boundary: 'Workshop identity registry unavailable.' };
  try {
    delete require.cache[require.resolve(file)];
    const registry = require(file);
    return {
      memories: registry.memories('mirror', { includeShared: true }),
      context: registry.context('mirror', { recent: 30 }),
      source: source(file, workshopRoot),
      boundary: 'This server-side view contains the registry defaults and explicitly shared seed wisdom. Browser-local additions require an explicit export adapter and are not silently imported.'
    };
  } catch (error) {
    return { memories: [], context: null, source: source(file, workshopRoot), boundary: `Registry held: ${String(error.message || error).slice(0, 300)}` };
  }
}

function optedInMirrorProfile(workshopRoot) {
  const file = path.join(workshopRoot, 'state', 'shared-profile', 'profile.json');
  const profile = readJson(file, null);
  if (!profile || profile.enabled !== true || !profile.consent || profile.consent.state !== 'OPTED_IN') {
    return { linked: false, member: null, achievements: [], source: fs.existsSync(file) ? source(file, workshopRoot) : null, boundary: 'Optional profile is not opted in.' };
  }
  const member = (profile.members || []).find(item => item.id === 'mirror') || null;
  const achievements = (((profile.achievements || {}).records) || []).filter(record =>
    (record.unlockedFor || []).some(item => item.memberId === 'mirror')
  ).map(record => record.id);
  return {
    linked: !!member,
    member,
    achievements,
    source: source(file, workshopRoot),
    boundary: 'Only Mirror\'s opted-in member card and unlock ids are exposed. Other members, events and private profile material are excluded.'
  };
}

function specialistCatalog(workshopRoot) {
  const file = path.join(workshopRoot, 'shared', 'specialists', 'axm-specialist-library.js');
  if (!fs.existsSync(file)) return { masks: [], source: null };
  try {
    delete require.cache[require.resolve(file)];
    const library = require(file);
    return {
      masks: library.catalog().map(mask => ({ id: mask.id, title: mask.title, category: mask.category, status: mask.status, purpose: mask.purpose, identityEffect: mask.identityEffect, memoryEffect: mask.memoryEffect })),
      source: source(file, workshopRoot)
    };
  } catch (error) {
    return { masks: [], source: source(file, workshopRoot), held: String(error.message || error).slice(0, 300) };
  }
}

function promptPacks(workshopRoot) {
  const base = path.join(workshopRoot, 'tools', 'agent-tool-forge', 'prompt-packs');
  if (!fs.existsSync(base)) return [];
  return fs.readdirSync(base).filter(name => name.endsWith('.json')).sort().map(name => {
    const file = path.join(base, name);
    const prompt = readJson(file, null);
    return prompt ? { id: prompt.id || name.replace(/\.json$/, ''), title: prompt.title || name, purpose: prompt.purpose || '', text: prompt.text || '', status: prompt.status || 'local', source: source(file, workshopRoot) } : null;
  }).filter(Boolean);
}

function build(options = {}) {
  const mirrorRoot = path.resolve(options.mirrorRoot || MIRROR_ROOT);
  const workshopRoot = WorkshopRoot.resolve({ workshopRoot: options.workshopRoot, config: options.config, configRoot: MIRROR_ROOT });
  const rootsFile = path.join(mirrorRoot, 'roots', 'AXM_ROOTS_v1.json');
  const statusFile = path.join(mirrorRoot, 'STATUS.json');
  const bomFile = path.join(mirrorRoot, 'MODEL_BOM.json');
  const policyFile = path.join(mirrorRoot, 'training', 'TRAINING_POLICY.json');
  const bundle = {
    schema: 'axm.mirror.identity-bundle/v1',
    identity: 'axm.machine.mirror/seed-0',
    displayName: 'Mirror',
    createdAt: new Date().toISOString(),
    roots: readJson(rootsFile, {}),
    status: readJson(statusFile, {}),
    modelBillOfMaterials: readJson(bomFile, {}),
    trainingPolicy: readJson(policyFile, {}),
    workshopIdentity: workshopIdentity(workshopRoot),
    wisdom: workshopWisdom(workshopRoot),
    profile: optedInMirrorProfile(workshopRoot),
    skills: skillManifests(mirrorRoot),
    curricula: curriculumSources(mirrorRoot),
    reasoning: reasoningProfiles(workshopRoot),
    specialists: specialistCatalog(workshopRoot),
    promptPacks: promptPacks(workshopRoot),
    authority: {
      bundleGrantsPermissions: false,
      wisdomAutoPromotes: false,
      profileAffectsTraining: false,
      specialistMasksGrantTools: false,
      promptPacksAutoInvoke: false
    },
    boundaries: [
      'Identity, wisdom, profile, skill, prompt and specialist sources remain separate typed inputs.',
      'The bundle is read-only context and does not grant tool, file, network, canon or runtime authority.',
      'Optional profile statistics are visible metadata and are excluded from learning text.',
      'Private browser-local wisdom is not imported without an explicit export and review path.',
      'Human-readable prompts render method; they are not hidden decision authority.'
    ],
    sources: [rootsFile, statusFile, bomFile, policyFile].filter(file => fs.existsSync(file)).map(file => source(file, mirrorRoot))
  };
  bundle.bundleDigest = digest(Object.assign({}, bundle, { createdAt: null, bundleDigest: undefined }));
  return bundle;
}

module.exports = { build, digest, stable };
