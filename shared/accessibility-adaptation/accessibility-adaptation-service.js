'use strict';

const fs = require('fs');
const path = require('path');

const SCHEMA = 'axm.accessibility-adaptation-service/v1';
const PROFILE_MODULES = {
  textScale: 'axm.access.text-scale-controller',
  contrast: 'axm.access.contrast-theme-selector',
  spacing: 'axm.access.reading-width-spacing-controller',
  density: 'axm.access.visual-density-reducer',
  focus: 'axm.access.focus-visibility-enhancer',
  language: 'axm.access.plain-language-view'
};
const FEATURED = [
  'axm.access.full-keyboard-route',
  'axm.access.logical-focus-order',
  'axm.access.text-scale-controller',
  'axm.access.contrast-theme-selector',
  'axm.access.plain-language-view',
  'axm.access.error-identification-repair',
  'axm.access.prerecorded-caption-workflow',
  'axm.access.accessibility-proof-packet'
];

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
}

function clean(value, limit) {
  return String(value == null ? '' : value).trim().slice(0, limit || 300);
}

function boundedChoice(value, choices, fallback) {
  const normalized = clean(value, 40).toLowerCase();
  return choices.includes(normalized) ? normalized : fallback;
}

function tokenize(value) {
  const aliases = {
    vision: ['visual', 'contrast', 'colour', 'font', 'magnification', 'reflow'],
    keyboard: ['keyboard', 'focus', 'skip', 'landmark'],
    cognitive: ['cognitive', 'plain', 'stepwise', 'memory', 'error', 'distraction'],
    hearing: ['caption', 'transcript', 'audio', 'sound', 'haptic'],
    media: ['caption', 'transcript', 'audio', 'media', 'description'],
    motor: ['switch', 'voice', 'gaze', 'gamepad', 'one-handed', 'dwell'],
    screenreader: ['screen reader', 'aria', 'semantic', 'live region'],
    authoring: ['authoring', 'template', 'alt text', 'caption'],
    evidence: ['evidence', 'proof', 'receipt', 'test', 'conformance']
  };
  const raw = clean(value, 600).toLowerCase().replace(/screen[ -]reader/g, 'screenreader');
  const tokens = raw.split(/[^a-z0-9]+/).filter(token => token.length > 2).slice(0, 40);
  return Array.from(new Set(tokens.flatMap(token => [token].concat(aliases[token] || []))));
}

function create(options) {
  const root = path.resolve(options && options.root || path.join(__dirname, '..', '..'));
  const intakeRoot = path.resolve(options && options.intakeRoot || path.join(root, 'intakes', 'accessibility-adaptive-interfaces-100-v1'));
  const modulesRoot = path.join(intakeRoot, 'modules');

  function modules() {
    const index = readJson(path.join(intakeRoot, 'PACKET_INDEX.json'));
    return index.packets.map(entry => {
      const moduleRoot = path.join(intakeRoot, entry.path);
      const packet = readJson(path.join(moduleRoot, 'module.packet.json'));
      const contract = readJson(path.join(moduleRoot, 'contract.summary.json'));
      const tests = readJson(path.join(moduleRoot, 'tests.summary.json'));
      const disposition = clean(packet.latest_contracts && packet.latest_contracts.run101d && packet.latest_contracts.run101d.preserved_deep31_disposition, 100);
      return {
        id: packet.module_id,
        seed: Number(packet.seed_number),
        title: clean(packet.title, 180),
        familyNumber: Number(packet.family_number),
        family: clean(packet.family, 240),
        purpose: clean(packet.purpose, 700),
        package: clean(packet.package, 100),
        riskClass: clean(contract.trust && contract.trust.risk_class, 100),
        disposition,
        adapterOrEvidenceBound: disposition === 'PRESERVE_ADAPTER_OR_REAL_EVIDENCE_BOUND',
        activation: packet.activation_default,
        realEvidence: tests.real_evidence,
        realAccessibilityEffect: packet.real_accessibility_effect,
        packetUrl: '/intakes/accessibility-adaptive-interfaces-100-v1/' + entry.path.replace(/\\/g, '/') + '/module.packet.json',
        contractUrl: '/intakes/accessibility-adaptive-interfaces-100-v1/' + entry.path.replace(/\\/g, '/') + '/contract.summary.json'
      };
    }).sort((left, right) => left.seed - right.seed);
  }

  function catalog() {
    const rows = modules();
    return {
      ok: true,
      schema: 'axm.accessibility-adaptation-catalog/v1',
      status: 'TEST_HOLD',
      canon: false,
      authority: 'NONE',
      moduleCount: rows.length,
      familyCount: new Set(rows.map(row => row.family)).size,
      packageCount: new Set(rows.map(row => row.package)).size,
      adapterOrEvidenceBoundCount: rows.filter(row => row.adapterOrEvidenceBound).length,
      previewPreferenceCount: Object.keys(PROFILE_MODULES).length,
      modules: rows,
      truth: {
        allPacketsDisabled: rows.every(row => row.activation === 'DISABLED'),
        realUserOrDeviceEvidenceRun: false,
        conformanceProven: false,
        automaticApply: false,
        previewScope: 'TOOL_LOCAL_BROWSER_ONLY'
      }
    };
  }

  function profile(input) {
    const value = input && typeof input === 'object' ? input : {};
    const scale = Math.round(Number(value.textScale));
    return {
      textScale: Number.isFinite(scale) ? Math.max(90, Math.min(160, scale)) : 110,
      contrast: boundedChoice(value.contrast, ['standard', 'high'], 'standard'),
      spacing: boundedChoice(value.spacing, ['standard', 'relaxed'], 'standard'),
      density: boundedChoice(value.density, ['standard', 'reduced'], 'standard'),
      focus: boundedChoice(value.focus, ['standard', 'enhanced'], 'enhanced'),
      language: boundedChoice(value.language, ['standard', 'plain'], 'standard')
    };
  }

  function recommend(input) {
    const request = input && typeof input === 'object' ? input : {};
    const goals = (Array.isArray(request.goals) ? request.goals : [request.goals]).filter(Boolean).slice(0, 12).map(goal => clean(goal, 80));
    const tokens = tokenize(goals.join(' '));
    const explicit = new Set((Array.isArray(request.moduleIds) ? request.moduleIds : []).map(id => clean(id, 160)).slice(0, 20));
    const rows = modules().map(row => {
      const haystack = (row.id + ' ' + row.title + ' ' + row.family + ' ' + row.purpose).toLowerCase();
      let score = explicit.has(row.id) ? 100 : 0;
      tokens.forEach(token => {
        if (row.id.includes(token)) score += 8;
        if (row.title.toLowerCase().includes(token)) score += 6;
        if (haystack.includes(token)) score += 2;
      });
      if (!tokens.length && FEATURED.includes(row.id)) score += 4;
      return Object.assign({ score }, row);
    }).filter(row => row.score > 0)
      .sort((left, right) => right.score - left.score || left.seed - right.seed)
      .slice(0, 16);
    return { goals, tokens, modules: rows };
  }

  function plan(input) {
    const request = input && typeof input === 'object' ? input : {};
    const selectedProfile = profile(request.profile);
    const requestedModuleIds = Array.isArray(request.moduleIds) ? request.moduleIds : [];
    const explicitProfileModules = Object.keys(PROFILE_MODULES).filter(key => {
      if (key === 'textScale') return selectedProfile.textScale !== 110;
      const defaults = { contrast: 'standard', spacing: 'standard', density: 'standard', focus: 'enhanced', language: 'standard' };
      return selectedProfile[key] !== defaults[key];
    }).map(key => PROFILE_MODULES[key]);
    const recommendation = recommend({ goals: request.goals, moduleIds: requestedModuleIds.concat(explicitProfileModules) });
    return {
      ok: true,
      schema: 'axm.accessibility-adaptation-plan/v1',
      status: 'TEST_HOLD',
      canon: false,
      authority: 'NONE',
      automaticApply: false,
      scope: 'TOOL_LOCAL_BROWSER_ONLY',
      profile: selectedProfile,
      recommendedModules: recommendation.modules,
      goals: recommendation.goals,
      limits: [
        'No diagnosis or inferred disability profile',
        'No global AXM mutation',
        'No real user, device, assistive-technology, field, production, or conformance proof'
      ]
    };
  }

  return { catalog, modules, plan, profile, recommend, schema: SCHEMA };
}

module.exports = { create, SCHEMA, PROFILE_MODULES };
