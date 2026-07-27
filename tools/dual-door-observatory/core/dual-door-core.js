'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const SCHEMA = 'axm.dual-door-map/v1';
const REVIEW_REQUEST_SCHEMA = 'axm.door-review-request/v1';
const DEFAULT_TTL_MS = 2 * 60 * 60 * 1000;

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

function cleanStrings(value) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value
    .filter(item => typeof item === 'string' && item.trim())
    .map(item => item.trim())))
    .sort((left, right) => left.localeCompare(right));
}

function readRegularJson(file) {
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('not a regular non-symlink JSON file');
  const bytes = fs.readFileSync(file);
  return {
    value: JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, '')),
    sha256: sha256(bytes),
    bytes: bytes.length
  };
}

function inspectDoor(moduleRoot, declared) {
  if (typeof declared !== 'string' || !declared.trim()) {
    return { declared: false, path: null, state: 'NOT_DECLARED', bytes: null };
  }
  const clean = declared.trim();
  if (clean.includes('\0')) {
    return { declared: true, path: clean, state: 'UNSAFE_PATH', bytes: null };
  }
  const absolute = path.resolve(moduleRoot, clean);
  if (!absolute.startsWith(moduleRoot + path.sep)) {
    return { declared: true, path: clean, state: 'UNSAFE_PATH', bytes: null };
  }
  if (!fs.existsSync(absolute)) {
    return { declared: true, path: clean, state: 'MISSING', bytes: null };
  }
  const stat = fs.lstatSync(absolute);
  if (stat.isSymbolicLink()) {
    return { declared: true, path: clean, state: 'SYMLINK_REFUSED', bytes: null };
  }
  if (!stat.isFile()) {
    return { declared: true, path: clean, state: 'NOT_REGULAR_FILE', bytes: null };
  }
  return { declared: true, path: clean, state: 'PRESENT', bytes: stat.size };
}

function inspectActions(value) {
  if (Array.isArray(value)) {
    const actions = cleanStrings(value).map(id => ({
      id,
      declarationShape: 'STRING_ID',
      descriptionDeclared: false,
      effectDeclared: false,
      inputSchemaDeclared: false
    }));
    return { shape: 'STRING_ARRAY', actions };
  }
  if (value && typeof value === 'object') {
    const actions = Object.keys(value).sort().map(id => {
      const declaration = value[id] && typeof value[id] === 'object' ? value[id] : {};
      return {
        id,
        declarationShape: 'OBJECT_DECLARATION',
        descriptionDeclared: typeof declaration.description === 'string' && Boolean(declaration.description.trim()),
        effectDeclared: typeof declaration.effect === 'string' && Boolean(declaration.effect.trim()),
        inputSchemaDeclared: Boolean(declaration.inputSchema && typeof declaration.inputSchema === 'object')
      };
    });
    return { shape: 'OBJECT_MAP', actions };
  }
  if (value === undefined) return { shape: 'NOT_DECLARED', actions: [] };
  return { shape: 'UNSUPPORTED_SHAPE', actions: [] };
}

function scanWorkshop(rootInput, options = {}) {
  const root = path.resolve(rootInput || process.cwd());
  const toolsRoot = path.join(root, 'tools');
  const toolsStat = fs.lstatSync(toolsRoot);
  if (!toolsStat.isDirectory() || toolsStat.isSymbolicLink()) {
    throw new Error('tools root must be a regular non-symlink directory');
  }

  const modules = [];
  const sourceFiles = [];
  const skippedSymlinks = [];
  const readIssues = [];
  const entries = fs.readdirSync(toolsRoot, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name));

  for (const entry of entries) {
    if (entry.name.startsWith('_')) continue;
    if (entry.isSymbolicLink()) {
      skippedSymlinks.push('tools/' + entry.name);
      continue;
    }
    if (!entry.isDirectory()) continue;
    const moduleRoot = path.join(toolsRoot, entry.name);
    const manifestPath = path.join(moduleRoot, 'manifest.json');
    if (!fs.existsSync(manifestPath)) continue;

    let loaded;
    try {
      loaded = readRegularJson(manifestPath);
    } catch (error) {
      readIssues.push({
        path: 'tools/' + entry.name + '/manifest.json',
        code: 'MANIFEST_READ_FAILED',
        message: String(error && error.message || error).slice(0, 240)
      });
      continue;
    }
    sourceFiles.push({
      path: 'tools/' + entry.name + '/manifest.json',
      sha256: loaded.sha256,
      bytes: loaded.bytes
    });
    const manifest = loaded.value;
    const moduleId = typeof manifest.id === 'string' && manifest.id.trim() ? manifest.id.trim() : entry.name;
    const human = inspectDoor(moduleRoot, manifest.entry);
    const machineDeclaration = manifest.machine && typeof manifest.machine === 'object' && !Array.isArray(manifest.machine)
      ? manifest.machine
      : null;
    let machine;
    if (!machineDeclaration) {
      machine = {
        declared: false,
        optionalAbsence: true,
        entry: { declared: false, path: null, state: 'NOT_DECLARED_OPTIONAL', bytes: null },
        status: null,
        apiVersion: null,
        effect: null,
        actionShape: 'NOT_DECLARED',
        actions: [],
        forbidden: []
      };
    } else {
      const machineEntry = inspectDoor(moduleRoot, machineDeclaration.entry);
      if (!machineEntry.declared) machineEntry.state = 'DECLARATION_INCOMPLETE';
      const actionInspection = inspectActions(machineDeclaration.actions);
      machine = {
        declared: true,
        optionalAbsence: false,
        entry: machineEntry,
        status: typeof machineDeclaration.status === 'string' ? machineDeclaration.status : null,
        apiVersion: typeof machineDeclaration.apiVersion === 'string' ? machineDeclaration.apiVersion : null,
        effect: typeof machineDeclaration.effect === 'string' ? machineDeclaration.effect : null,
        actionShape: actionInspection.shape,
        actions: actionInspection.actions,
        forbidden: cleanStrings(machineDeclaration.forbidden)
      };
    }
    modules.push({
      id: moduleId,
      folder: entry.name,
      version: typeof manifest.version === 'string' ? manifest.version : 'UNKNOWN',
      status: typeof manifest.status === 'string' ? manifest.status : 'UNKNOWN',
      manifestSha256: loaded.sha256,
      human: Object.assign({}, human, {
        kind: 'HUMAN_WORKSPACE_ENTRY',
        loadedOrRendered: false
      }),
      machine: Object.assign({}, machine, {
        kind: 'MACHINE_ACTION_ENTRY',
        codeLoaded: false,
        actionsExecuted: false
      })
    });
  }

  modules.sort((left, right) => left.id.localeCompare(right.id));
  sourceFiles.sort((left, right) => left.path.localeCompare(right.path));
  skippedSymlinks.sort();
  const measuredAt = options.now || new Date().toISOString();
  const ttlMs = Number.isFinite(options.ttlMs) && options.ttlMs > 0 ? Math.floor(options.ttlMs) : DEFAULT_TTL_MS;
  const fingerprintMaterial = { sourceFiles, skippedSymlinks, readIssues, modules };
  return {
    schema: SCHEMA,
    version: 'v0.2',
    measuredAt,
    freshnessTtlMs: ttlMs,
    source: {
      label: path.basename(root),
      fingerprint: sha256(Buffer.from(stableJson(fingerprintMaterial))),
      filesRead: sourceFiles.length,
      symlinksFollowed: false,
      skippedSymlinks
    },
    summary: {
      modules: modules.length,
      humanDoorsDeclared: modules.filter(module => module.human.declared).length,
      humanDoorsPresent: modules.filter(module => module.human.state === 'PRESENT').length,
      humanDoorIssues: modules.filter(module => module.human.state !== 'PRESENT').length,
      machineDoorsDeclared: modules.filter(module => module.machine.declared).length,
      machineDoorsPresent: modules.filter(module => module.machine.entry.state === 'PRESENT').length,
      machineDoorsOptionalNotDeclared: modules.filter(module => module.machine.entry.state === 'NOT_DECLARED_OPTIONAL').length,
      machineDoorIssues: modules.filter(module => module.machine.declared && module.machine.entry.state !== 'PRESENT').length,
      machineActionDeclarations: modules.reduce((total, module) => total + module.machine.actions.length, 0),
      machineActionStringArrays: modules.filter(module => module.machine.actionShape === 'STRING_ARRAY').length,
      machineActionObjectMaps: modules.filter(module => module.machine.actionShape === 'OBJECT_MAP').length,
      readIssues: readIssues.length
    },
    modules,
    readIssues,
    scopeBoundary: 'Manifest-declared human and machine entry paths and machine action declaration shapes are inspected. Entry code is not loaded, UI is not rendered, and actions are not executed. A missing optional machine declaration is not classified as a defect.',
    preservedOwners: {
      humanRouting: 'Hub and Capability Index',
      machineExecution: 'Machine Host',
      actionSemantics: 'declaring module owner',
      readiness: 'Technical Glasses',
      permissions: 'declared action and permission owners'
    },
    truth: {
      entryCodeLoaded: false,
      humanDoorRendered: false,
      machineActionExecuted: false,
      routeProven: false,
      actionSemanticsProven: false,
      actionParityRequired: false,
      readinessProven: false,
      permissionGranted: false,
      sourceMutationPerformed: false,
      installerStagingPerformed: false,
      installationPerformed: false,
      promotionPerformed: false,
      canonChanged: false
    }
  };
}

function freshness(observation, options = {}) {
  const nowMs = Date.parse(options.now || new Date().toISOString());
  const observedMs = Date.parse(observation && observation.measuredAt);
  const ttlMs = Number(observation && observation.freshnessTtlMs);
  if (!Number.isFinite(nowMs) || !Number.isFinite(observedMs) || !Number.isFinite(ttlMs) || ttlMs <= 0) {
    return { status: 'UNTIMED', ageMs: null, remainingMs: null };
  }
  const ageMs = Math.max(0, nowMs - observedMs);
  return {
    status: ageMs <= ttlMs ? 'LIVE' : 'STALE',
    ageMs,
    remainingMs: Math.max(0, ttlMs - ageMs)
  };
}

function createDoorReviewRequest(map, moduleIdInput, doorKindInput, options = {}) {
  if (!map || map.schema !== SCHEMA) {
    throw new Error('door review request requires an ' + SCHEMA + ' source map');
  }
  const moduleId = typeof moduleIdInput === 'string' ? moduleIdInput.trim() : '';
  const doorKind = typeof doorKindInput === 'string' ? doorKindInput.trim().toUpperCase() : '';
  if (!moduleId || !doorKind) throw new Error('door review request requires one exact module id and door kind');
  if (!['HUMAN', 'MACHINE'].includes(doorKind)) {
    throw new Error('door kind must be HUMAN or MACHINE');
  }
  const moduleRecord = Array.isArray(map.modules) && map.modules.find(item => item.id === moduleId);
  if (!moduleRecord) throw new Error('module is not present in source map: ' + moduleId);

  const actionId = typeof options.actionId === 'string' ? options.actionId.trim() : '';
  let selectedDoor;
  let selectedAction = null;
  let executionOwner;
  let checkIds;
  if (doorKind === 'HUMAN') {
    if (actionId) throw new Error('human door review cannot select a machine action');
    if (!moduleRecord.human || moduleRecord.human.state !== 'PRESENT') {
      throw new Error('selected human door is not PRESENT');
    }
    selectedDoor = {
      kind: 'HUMAN',
      path: moduleRecord.human.path,
      observedState: moduleRecord.human.state,
      bytes: moduleRecord.human.bytes
    };
    executionOwner = 'BROWSER_LAN_HARDWARE_QA_LAB_OR_HUB_OWNER';
    checkIds = [
      'CHECK_SOURCE_FINGERPRINT_AND_ENTRY_PRESENCE',
      'OPEN_ONLY_SELECTED_HUMAN_ROUTE',
      'CAPTURE_RENDER_CONSOLE_AND_INTERACTION_OBSERVATION',
      'RECORD_VISUAL_JUDGMENT_SEPARATELY'
    ];
  } else {
    if (!moduleRecord.machine || !moduleRecord.machine.entry || moduleRecord.machine.entry.state !== 'PRESENT') {
      throw new Error('selected machine door is not PRESENT');
    }
    if (!actionId) throw new Error('machine door review requires one exact declared action id');
    const action = Array.isArray(moduleRecord.machine.actions)
      && moduleRecord.machine.actions.find(item => item.id === actionId);
    if (!action) throw new Error('machine action is not declared for selected module: ' + actionId);
    selectedDoor = {
      kind: 'MACHINE',
      path: moduleRecord.machine.entry.path,
      observedState: moduleRecord.machine.entry.state,
      bytes: moduleRecord.machine.entry.bytes,
      status: moduleRecord.machine.status,
      apiVersion: moduleRecord.machine.apiVersion,
      effect: moduleRecord.machine.effect,
      actionShape: moduleRecord.machine.actionShape
    };
    selectedAction = {
      id: action.id,
      declarationShape: action.declarationShape,
      descriptionDeclared: action.descriptionDeclared,
      effectDeclared: action.effectDeclared,
      inputSchemaDeclared: action.inputSchemaDeclared
    };
    executionOwner = 'MACHINE_HOST_AND_DECLARING_MODULE_OWNER';
    checkIds = [
      'CHECK_SOURCE_FINGERPRINT_AND_ENTRY_PRESENCE',
      'CHECK_MACHINE_HOST_GATE_AND_ACTION_DECLARATION',
      'INVOKE_ONLY_SELECTED_ACTION_WITH_SEPARATELY_APPROVED_FIXTURE',
      'CAPTURE_RESULT_AND_SIDE_EFFECT_RECEIPT'
    ];
  }

  const checks = checkIds.map(id => ({
    id,
    state: 'REQUEST_NOT_RUN',
    executionAuthority: executionOwner,
    observation: null,
    decision: null
  }));
  const generatedAt = options.now || new Date().toISOString();
  const fingerprintMaterial = {
    schema: REVIEW_REQUEST_SCHEMA,
    selectedModule: {
      id: moduleRecord.id,
      folder: moduleRecord.folder,
      version: moduleRecord.version,
      status: moduleRecord.status
    },
    selectedDoor,
    selectedAction,
    sourceFingerprint: map.source && map.source.fingerprint,
    checks
  };
  return {
    schema: REVIEW_REQUEST_SCHEMA,
    version: 'v0.2',
    generatedAt,
    fingerprint: sha256(Buffer.from(stableJson(fingerprintMaterial))),
    selectedModule: fingerprintMaterial.selectedModule,
    selectedDoor,
    selectedAction,
    sourceObservation: {
      schema: map.schema,
      measuredAt: map.measuredAt,
      freshnessTtlMs: map.freshnessTtlMs,
      fingerprint: map.source && map.source.fingerprint,
      freshnessAtRequest: freshness(map, { now: generatedAt })
    },
    executionEnvelope: {
      commandIncluded: false,
      argumentsIncluded: false,
      environmentValuesIncluded: false,
      fixtureInputIncluded: false,
      networkAccessRequested: false,
      sourceWriteAccessRequested: false,
      sideEffectsUnknownUntilOwnerReview: true
    },
    summary: {
      doorsSelected: 1,
      actionsSelected: selectedAction ? 1 : 0,
      checksRequested: checks.length,
      checksRun: 0
    },
    checks,
    scopeBoundary: 'This request names one already-observed human door or one machine door plus an exactly declared action. It supplies no command, arguments, environment values, or fixture and cannot open, render, or execute itself.',
    truth: {
      requestOnly: true,
      entryCodeLoaded: false,
      humanDoorRendered: false,
      machineActionExecuted: false,
      routeProven: false,
      actionSemanticsProven: false,
      visualQualityProven: false,
      passingProven: false,
      readinessProven: false,
      permissionGranted: false,
      sideEffectsProvenAbsent: false,
      sourceMutationPerformed: false,
      installerStagingPerformed: false,
      installationPerformed: false,
      promotionPerformed: false,
      canonChanged: false
    }
  };
}

module.exports = {
  SCHEMA,
  REVIEW_REQUEST_SCHEMA,
  DEFAULT_TTL_MS,
  cleanStrings,
  inspectDoor,
  inspectActions,
  scanWorkshop,
  freshness,
  createDoorReviewRequest
};
