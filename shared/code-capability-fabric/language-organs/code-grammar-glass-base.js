'use strict';

const crypto = require('crypto');

const GRAMMAR_FAMILY = 'CODE';
const UNIVERSAL_ATOM_TYPES = Object.freeze([
  'STATE',
  'CONDITION',
  'TRANSFORMATION',
  'CONTROL_FLOW',
  'TYPE',
  'INTERFACE',
  'EFFECT',
  'DEPENDENCY',
  'VERIFICATION',
  'FAILURE',
  'REPRESENTATION'
]);
const CONNECTION_CLASSES = Object.freeze([
  'TYPED_COMPATIBILITY',
  'ANALOGY',
  'CONTRAST',
  'REPULSION',
  'BOUNDARY',
  'UNRESOLVED_NEIGHBOURHOOD'
]);
const INFLUENCE_CARRY_CLASSES = Object.freeze([
  'ATTRACTIVE_PULL',
  'ANALOGICAL_PULL',
  'CONTRAST_DEFLECTION',
  'REPULSIVE_PUSH',
  'BOUNDARY_TENSION',
  'UNCERTAINTY_DRIFT'
]);
const MIRROR_LENSES = Object.freeze([
  'STRUCTURAL_SEAM',
  'VERIFICATION_FIRST',
  'FAILURE_AND_BOUNDARY',
  'DEPENDENCY_INTERFACE',
  'STATE_EFFECT',
  'POLYGLOT_CONTRAST'
]);
const FUTURE_GRAMMAR_FAMILIES = Object.freeze([
  'ANIMATION_MOTION',
  'VISUAL_COMPOSITION_MATERIALS',
  'UI_INTERACTION',
  'PHYSICS_SIMULATION',
  'SOUND_RHYTHM',
  'NARRATIVE_WORLDS',
  'DATA_SPATIAL_STRUCTURES'
]);
const LEDGER_EVENT_TYPES = Object.freeze([
  'DAY_START_CAPTURED',
  'CONDITION_REVISION_APPENDED',
  'CYCLE_OBSERVATION_APPENDED',
  'FORMATION_FAILED',
  'FORMATION_CONTRADICTORY',
  'DRAFT_STAR_CAPTURED',
  'FULL_SAVE_REFERENCE_APPENDED',
  'REPLAY_OBSERVATION_APPENDED'
]);
const RAW_PRIVATE_OR_SOURCE_FIELDS = new Set([
  'chainOfThought',
  'rawChainOfThought',
  'hiddenChainOfThought',
  'privateChainOfThought',
  'internalActivations',
  'hiddenState',
  'logits',
  'rawPrompt',
  'rawResponse',
  'rawSource',
  'sourceCode',
  'sourceBody',
  'body',
  'bytes'
]);
const AUTHORITY = Object.freeze({
  sourceWorkspaceRead: false,
  sourceWorkspaceMutation: false,
  cycleMutationByMirror: false,
  candidateExecution: false,
  compilation: false,
  toolExecution: false,
  network: false,
  install: false,
  admission: false,
  selection: false,
  deployment: false,
  promotion: false,
  merge: false,
  canon: false
});
const DEFAULT_CONDITIONS = Object.freeze({
  attractionWeight: 0.72,
  contrastWeight: 0.58,
  repulsionWeight: 0.34,
  collisionThreshold: 0.16,
  grammarFamilyWeight: 1,
  verificationInfluence: 0.56,
  uncertaintyInfluence: 0.64,
  crossGrammarInfluenceWeight: 0.86,
  influenceCarryDecay: 0.62,
  influenceCarryLimitPpm: 2200,
  rotationRatePpm: 1300,
  phaseOffsetPpm: 0,
  mirrorLens: 'STRUCTURAL_SEAM',
  interactionsPerTick: 36,
  scheduledAtomBudget: 192,
  orbitBandCount: UNIVERSAL_ATOM_TYPES.length
});
const TYPE_FEATURE_MAP = Object.freeze({
  STATE: Object.freeze([
    ['grammar.mutationModel', profile => [profile.grammar.mutationModel]],
    ['grammar.scopeModel', profile => [profile.grammar.scopeModel]]
  ]),
  CONDITION: Object.freeze([
    ['analysis.requiredQuestionsBeforeRewrite', profile => profile.analysis.requiredQuestionsBeforeRewrite],
    ['grammar.controlModel', profile => [profile.grammar.controlModel]]
  ]),
  TRANSFORMATION: Object.freeze([
    ['grammar.constructs', profile => profile.grammar.constructs],
    ['rewritePolicy.highRiskTransforms', profile => profile.rewritePolicy.highRiskTransforms]
  ]),
  CONTROL_FLOW: Object.freeze([
    ['grammar.controlModel', profile => [profile.grammar.controlModel]],
    ['grammar.constructs', profile => profile.grammar.constructs]
  ]),
  TYPE: Object.freeze([
    ['grammar.typeModel', profile => [profile.grammar.typeModel]],
    ['grammar.paradigm', profile => [profile.grammar.paradigm]]
  ]),
  INTERFACE: Object.freeze([
    ['grammar.compilationOrDocumentUnit', profile => [profile.grammar.compilationOrDocumentUnit]],
    ['grammar.dependencyForms', profile => profile.grammar.dependencyForms]
  ]),
  EFFECT: Object.freeze([
    ['grammar.effectModel', profile => [profile.grammar.effectModel]],
    ['grammar.mutationModel', profile => [profile.grammar.mutationModel]]
  ]),
  DEPENDENCY: Object.freeze([
    ['grammar.dependencyForms', profile => profile.grammar.dependencyForms],
    ['analysis.dependencyAnchors', profile => profile.analysis.dependencyAnchors]
  ]),
  VERIFICATION: Object.freeze([
    ['verification.focus', profile => profile.verification.focus],
    ['analysis.requiredQuestionsBeforeRewrite', profile => profile.analysis.requiredQuestionsBeforeRewrite]
  ]),
  FAILURE: Object.freeze([
    ['analysis.semanticHazards', profile => profile.analysis.semanticHazards],
    ['rewritePolicy.highRiskTransforms', profile => profile.rewritePolicy.highRiskTransforms]
  ]),
  REPRESENTATION: Object.freeze([
    ['grammar.paradigm', profile => [profile.grammar.paradigm]],
    ['grammar.compilationOrDocumentUnit', profile => [profile.grammar.compilationOrDocumentUnit]],
    ['grammar.dialectsOrVariants', profile => profile.grammar.dialectsOrVariants],
    ['grammar.constructs', profile => profile.grammar.constructs]
  ])
});

function canon(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canon).join(',')}]`;
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canon(value[key])}`).join(',')}}`;
}

function hash(value) {
  return crypto.createHash('sha256').update(typeof value === 'string' ? value : canon(value)).digest('hex');
}

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function clean(value, fallback = '') {
  const normalized = String(value == null ? '' : value).trim();
  return normalized || fallback;
}

function cleanId(value, fallback = '') {
  const normalized = clean(value, fallback)
    .replace(/[^a-zA-Z0-9._:-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || fallback;
}

function strings(value, max = 128) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(item => clean(item)).filter(Boolean))].slice(0, max);
}

function digestCurrent(record, digestField) {
  if (!record || !record[digestField]) return false;
  const core = { ...record };
  const expected = core[digestField];
  delete core[digestField];
  return hash(core) === expected;
}

function containsRawPrivateOrSource(value, path = '$') {
  if (!value || typeof value !== 'object') return null;
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const found = containsRawPrivateOrSource(value[index], `${path}[${index}]`);
      if (found) return found;
    }
    return null;
  }
  for (const [key, child] of Object.entries(value)) {
    if (RAW_PRIVATE_OR_SOURCE_FIELDS.has(key)) return `${path}.${key}`;
    const found = containsRawPrivateOrSource(child, `${path}.${key}`);
    if (found) return found;
  }
  return null;
}

function normalizeToken(value) {
  return clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9_+.#-]+/g, ' ')
    .split(/\s+/)
    .filter(token => token.length >= 2);
}

function featureTokens(values) {
  return [...new Set(strings(values, 256).flatMap(normalizeToken))].sort();
}

function profileCore(profile) {
  const core = { ...profile };
  delete core.profileSha256;
  return core;
}

function validateProfile(profile, snapshotEntry, organ) {
  if (!profile || profile.schema !== 'axm.code.language-grammar-profile.v1' || profile.version !== '1.0.0') {
    throw new Error(`GRAMMAR_GLASS_PROFILE_SCHEMA_INVALID:${profile && profile.languageId || 'UNKNOWN'}`);
  }
  if (!profile.profileSha256 || hash(profileCore(profile)) !== profile.profileSha256) {
    throw new Error(`GRAMMAR_GLASS_PROFILE_DIGEST_INVALID:${profile.languageId}`);
  }
  if (!snapshotEntry || snapshotEntry.profileSha256 !== profile.profileSha256) {
    throw new Error(`GRAMMAR_GLASS_PROFILE_SNAPSHOT_BINDING_MISMATCH:${profile.languageId}`);
  }
  if (!organ || organ.organId !== profile.organId || organ.sha256 !== profile.organDigest) {
    throw new Error(`GRAMMAR_GLASS_ORGAN_BINDING_MISMATCH:${profile.languageId}`);
  }
  if (!profile.grammar || !Array.isArray(profile.grammar.constructs) || !profile.grammar.constructs.length) {
    throw new Error(`GRAMMAR_GLASS_PROFILE_STRUCTURAL_KNOWLEDGE_REQUIRED:${profile.languageId}`);
  }
  if (!profile.analysis || !Array.isArray(profile.analysis.semanticHazards) || !profile.analysis.semanticHazards.length) {
    throw new Error(`GRAMMAR_GLASS_PROFILE_HAZARDS_REQUIRED:${profile.languageId}`);
  }
  if (!profile.verification || profile.verification.authority !== 'NONE' || profile.verification.runtimeCorrectnessClaimed !== false) {
    throw new Error(`GRAMMAR_GLASS_PROFILE_TRUTH_BOUNDARY_INVALID:${profile.languageId}`);
  }
}

function normalizeProfile(profile) {
  return deepFreeze({
    schema: profile.schema,
    version: profile.version,
    knowledgeVersion: clean(profile.knowledgeVersion),
    priority: Number(profile.priority),
    organId: clean(profile.organId),
    languageId: clean(profile.languageId),
    displayName: clean(profile.displayName, profile.languageId),
    family: clean(profile.family, 'unknown'),
    kind: clean(profile.kind, 'unknown'),
    organDigest: clean(profile.organDigest),
    profileSha256: clean(profile.profileSha256),
    grammar: {
      paradigm: clean(profile.grammar.paradigm, 'UNDECLARED'),
      compilationOrDocumentUnit: clean(profile.grammar.compilationOrDocumentUnit, 'UNDECLARED'),
      dialectsOrVariants: strings(profile.grammar.dialectsOrVariants),
      constructs: strings(profile.grammar.constructs),
      dependencyForms: strings(profile.grammar.dependencyForms),
      scopeModel: clean(profile.grammar.scopeModel, 'UNDECLARED'),
      typeModel: clean(profile.grammar.typeModel, 'UNDECLARED'),
      mutationModel: clean(profile.grammar.mutationModel, 'UNDECLARED'),
      controlModel: clean(profile.grammar.controlModel, 'UNDECLARED'),
      effectModel: clean(profile.grammar.effectModel, 'UNDECLARED')
    },
    analysis: {
      symbolInventory: strings(profile.analysis.symbolInventory),
      dependencyAnchors: strings(profile.analysis.dependencyAnchors),
      semanticHazards: strings(profile.analysis.semanticHazards),
      requiredQuestionsBeforeRewrite: strings(profile.analysis.requiredQuestionsBeforeRewrite)
    },
    rewritePolicy: {
      blindTextRewrite: clean(profile.rewritePolicy && profile.rewritePolicy.blindTextRewrite),
      unknownGrammarNode: clean(profile.rewritePolicy && profile.rewritePolicy.unknownGrammarNode),
      parseErrors: clean(profile.rewritePolicy && profile.rewritePolicy.parseErrors),
      highRiskTransforms: strings(profile.rewritePolicy && profile.rewritePolicy.highRiskTransforms),
      capabilityIsNotAuthority: profile.rewritePolicy && profile.rewritePolicy.capabilityIsNotAuthority === true
    },
    verification: {
      focus: strings(profile.verification.focus),
      syntaxPassIsNotSemanticCorrectness: profile.verification.syntaxPassIsNotSemanticCorrectness === true,
      fixturePassIsNotArbitraryProgramProof: profile.verification.fixturePassIsNotArbitraryProgramProof === true,
      runtimeCorrectnessClaimed: false,
      authority: 'NONE'
    }
  });
}

function loadGrammarSource({ grammarRegistry = null, organRegistry = null, bindingMode = null } = {}) {
  const profilesApi = grammarRegistry || require('./grammar-profile-registry.js');
  const organsApi = organRegistry || require('./registry.js');
  if (!profilesApi || typeof profilesApi.all !== 'function' || typeof profilesApi.snapshot !== 'function') {
    throw new Error('GRAMMAR_GLASS_GRAMMAR_PROFILE_REGISTRY_REQUIRED');
  }
  if (!organsApi || typeof organsApi.all !== 'function' || typeof organsApi.snapshot !== 'function') {
    throw new Error('GRAMMAR_GLASS_ORGAN_REGISTRY_REQUIRED');
  }
  const rawProfiles = profilesApi.all();
  const rawOrgans = organsApi.all();
  const profileSnapshot = profilesApi.snapshot();
  const organSnapshot = organsApi.snapshot();
  if (!Array.isArray(rawProfiles) || !rawProfiles.length || !Array.isArray(rawOrgans) || !rawOrgans.length) {
    throw new Error('GRAMMAR_GLASS_EMPTY_REGISTRY_REFUSED');
  }
  if (profileSnapshot.schema !== 'axm.code.language-grammar-profile-snapshot.v1' || profileSnapshot.profileCount !== rawProfiles.length) {
    throw new Error('GRAMMAR_GLASS_PROFILE_SNAPSHOT_INVALID');
  }
  if (!digestCurrent(profileSnapshot, 'snapshotSha256')) {
    throw new Error('GRAMMAR_GLASS_PROFILE_SNAPSHOT_DIGEST_INVALID');
  }
  if (organSnapshot.schema !== 'axm.code.language-organ-snapshot.v1' || organSnapshot.organCount !== rawOrgans.length) {
    throw new Error('GRAMMAR_GLASS_ORGAN_SNAPSHOT_INVALID');
  }
  if (!digestCurrent(organSnapshot, 'snapshotSha256')) {
    throw new Error('GRAMMAR_GLASS_ORGAN_SNAPSHOT_DIGEST_INVALID');
  }
  if (rawProfiles.length !== rawOrgans.length) {
    throw new Error(`GRAMMAR_GLASS_REGISTRY_COUNT_MISMATCH:${rawProfiles.length}:${rawOrgans.length}`);
  }
  const entryByLanguage = new Map(profileSnapshot.entries.map(entry => [entry.languageId, entry]));
  const organByLanguage = new Map(rawOrgans.map(organ => [organ.languageId, organ]));
  const profiles = rawProfiles
    .map(profile => {
      validateProfile(profile, entryByLanguage.get(profile.languageId), organByLanguage.get(profile.languageId));
      return normalizeProfile(profile);
    })
    .sort((a, b) => a.priority - b.priority || a.languageId.localeCompare(b.languageId));
  if (new Set(profiles.map(profile => profile.languageId)).size !== profiles.length ||
      new Set(profiles.map(profile => profile.profileSha256)).size !== profiles.length) {
    throw new Error('GRAMMAR_GLASS_DUPLICATE_PROFILE_IDENTITY_REFUSED');
  }
  const declaredBinding = bindingMode || (grammarRegistry || organRegistry ? 'INJECTED_REGISTRY' : 'LIVE_REPOSITORY_GRAMMAR_REGISTRY');
  const sourceCore = {
    schema: 'axm.code.grammar-glass-source.v1',
    version: '1.0.0',
    result: 'GRAMMAR_GLASS_SOURCE_READY',
    grammarFamily: GRAMMAR_FAMILY,
    bindingMode: declaredBinding,
    profileCount: profiles.length,
    organCount: rawOrgans.length,
    profileSnapshotSha256: profileSnapshot.snapshotSha256,
    organRegistrySnapshotSha256: organSnapshot.snapshotSha256,
    profiles,
    truth: {
      usesRegistryProfilesNotFictionalLanguageList: true,
      profilesAreStructuralMetadataNotAllWorldCode: true,
      profileSnapshotIsImmutableInput: true,
      registryCoverageIsNotRuntimeCorrectness: true,
      multipleProfilesAreNotIndependentEvidenceOfOneClaim: true
    },
    authority: AUTHORITY
  };
  return deepFreeze({ ...sourceCore, sourceSha256: hash(sourceCore) });
}

function valuesForAtom(profile, atomType) {
  const mappings = TYPE_FEATURE_MAP[atomType];
  const refs = [];
  const values = [];
  for (const [ref, getter] of mappings) {
    const items = strings(getter(profile), 256);
    if (!items.length) continue;
    refs.push(ref);
    values.push(...items);
  }
  return {
    refs: [...new Set(refs)].sort(),
    values: [...new Set(values)].sort()
  };
}

function createAtomCatalog(source) {
  if (!source || source.schema !== 'axm.code.grammar-glass-source.v1' || !digestCurrent(source, 'sourceSha256')) {
    throw new Error('GRAMMAR_GLASS_VALID_SOURCE_REQUIRED');
  }
  const atoms = [];
  for (const profile of source.profiles) {
    for (const atomType of UNIVERSAL_ATOM_TYPES) {
      const features = valuesForAtom(profile, atomType);
      const structuralFeatureDigest = hash({ refs: features.refs, values: features.values });
      const atomCore = {
        schema: 'axm.code.grammar-structural-atom.v1',
        version: '1.0.0',
        grammarFamily: GRAMMAR_FAMILY,
        atomId: `atom:${profile.languageId}:${atomType.toLowerCase().replace(/_/g, '-')}`,
        atomType,
        languageId: profile.languageId,
        displayName: profile.displayName,
        grammarFamilyId: profile.family,
        grammarKind: profile.kind,
        organId: profile.organId,
        organDigest: profile.organDigest,
        sourceProfileDigest: profile.profileSha256,
        sourceProfileSnapshotDigest: source.profileSnapshotSha256,
        sourceOrganRegistrySnapshotDigest: source.organRegistrySnapshotSha256,
        structuralFeatureRefs: features.refs,
        structuralFeatureValues: features.values,
        structuralFeatureDigest,
        featureTokens: featureTokens(features.values),
        provenance: {
          sourceSchema: profile.schema,
          knowledgeVersion: profile.knowledgeVersion,
          priority: profile.priority,
          sourceDigest: source.sourceSha256,
          derivationRule: `UNIVERSAL_ATOM_MAP:${atomType}:v1`
        },
        compatibilityClaims: {
          comparisonBasis: 'ATOM_TYPE_PLUS_DECLARED_STRUCTURAL_FEATURE_TOKENS',
          equivalentToOtherLanguages: false,
          typedCompatibilityMayBeTested: true,
          analogyMayBeObserved: true,
          contrastAndRepulsionRemainVisible: true,
          unknownRelationRemainsUnresolved: true
        },
        unresolved: {
          status: 'RELATION_UNRESOLVED_UNTIL_PAIR_EVALUATED',
          reasons: ['no cross-language semantic equivalence is presumed']
        },
        truth: {
          atomIsMetadataProjection: true,
          atomIsNotSourceCode: true,
          atomIsNotExecutable: true,
          atomDoesNotProveEquivalence: true
        },
        authority: AUTHORITY
      };
      atoms.push(deepFreeze({ ...atomCore, atomSha256: hash(atomCore) }));
    }
  }
  const catalogCore = {
    schema: 'axm.code.grammar-structural-atom-catalog.v1',
    version: '1.0.0',
    result: 'UNIVERSAL_STRUCTURAL_ATOMS_READY',
    grammarFamily: GRAMMAR_FAMILY,
    sourceSha256: source.sourceSha256,
    profileSnapshotSha256: source.profileSnapshotSha256,
    profileCount: source.profileCount,
    atomTypes: UNIVERSAL_ATOM_TYPES,
    atomCount: atoms.length,
    atoms,
    truth: {
      everyAvailableProfileParticipates: new Set(atoms.map(atom => atom.languageId)).size === source.profileCount,
      allAtomsMayEnterSharedField: true,
      unlikeStructuresAreNotDeclaredEquivalent: true,
      incompatibilityCanInfluenceFormation: true
    },
    authority: AUTHORITY
  };
  return deepFreeze({ ...catalogCore, catalogSha256: hash(catalogCore) });
}

function boundedNumber(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

function normalizeConditions(values = {}) {
  const mirrorLens = MIRROR_LENSES.includes(String(values.mirrorLens || DEFAULT_CONDITIONS.mirrorLens).toUpperCase())
    ? String(values.mirrorLens || DEFAULT_CONDITIONS.mirrorLens).toUpperCase()
    : DEFAULT_CONDITIONS.mirrorLens;
  return deepFreeze({
    attractionWeight: boundedNumber(values.attractionWeight, DEFAULT_CONDITIONS.attractionWeight, 0, 1),
    contrastWeight: boundedNumber(values.contrastWeight, DEFAULT_CONDITIONS.contrastWeight, 0, 1),
    repulsionWeight: boundedNumber(values.repulsionWeight, DEFAULT_CONDITIONS.repulsionWeight, 0, 1),
    collisionThreshold: boundedNumber(values.collisionThreshold, DEFAULT_CONDITIONS.collisionThreshold, 0.001, 0.5),
    grammarFamilyWeight: boundedNumber(values.grammarFamilyWeight, DEFAULT_CONDITIONS.grammarFamilyWeight, 0, 2),
    verificationInfluence: boundedNumber(values.verificationInfluence, DEFAULT_CONDITIONS.verificationInfluence, 0, 1),
    uncertaintyInfluence: boundedNumber(values.uncertaintyInfluence, DEFAULT_CONDITIONS.uncertaintyInfluence, 0, 1),
    crossGrammarInfluenceWeight: boundedNumber(values.crossGrammarInfluenceWeight, DEFAULT_CONDITIONS.crossGrammarInfluenceWeight, 0, 2),
    influenceCarryDecay: boundedNumber(values.influenceCarryDecay, DEFAULT_CONDITIONS.influenceCarryDecay, 0, 1),
    influenceCarryLimitPpm: Math.round(boundedNumber(values.influenceCarryLimitPpm, DEFAULT_CONDITIONS.influenceCarryLimitPpm, 0, 10000)),
    rotationRatePpm: Math.round(boundedNumber(values.rotationRatePpm, DEFAULT_CONDITIONS.rotationRatePpm, -25000, 25000)),
    phaseOffsetPpm: Math.round(boundedNumber(values.phaseOffsetPpm, DEFAULT_CONDITIONS.phaseOffsetPpm, 0, 999999)),
    mirrorLens,
    interactionsPerTick: Math.round(boundedNumber(values.interactionsPerTick, DEFAULT_CONDITIONS.interactionsPerTick, 1, 512)),
    scheduledAtomBudget: Math.round(boundedNumber(values.scheduledAtomBudget, DEFAULT_CONDITIONS.scheduledAtomBudget, 2, 4096)),
    orbitBandCount: UNIVERSAL_ATOM_TYPES.length
  });
}

function createConditionRevision({ previous = null, values = {}, reason = 'INITIAL_CONDITIONS' } = {}) {
  if (previous && (!previous.conditionSha256 || !digestCurrent(previous, 'conditionSha256'))) {
    throw new Error('GRAMMAR_GLASS_PREVIOUS_CONDITION_REVISION_INVALID');
  }
  const conditions = normalizeConditions(previous ? { ...previous.conditions, ...values } : values);
  const core = {
    schema: 'axm.code.grammar-glass-condition-revision.v1',
    version: '1.0.0',
    result: 'GRAMMAR_GLASS_CONDITION_REVISION_READY',
    revision: previous ? previous.revision + 1 : 1,
    parentConditionSha256: previous ? previous.conditionSha256 : null,
    reason: clean(reason, previous ? 'CONDITION_CHANGE' : 'INITIAL_CONDITIONS'),
    conditions,
    truth: {
      revisionIsImmutable: true,
      oldConditionsRemainAddressable: true,
      conditionChangeDoesNotRewritePriorStars: true,
      pressureMayScheduleWorkButNotReduceReasoningOrVerificationQuality: true
    },
    authority: 'NONE'
  };
  return deepFreeze({ ...core, conditionSha256: hash(core) });
}

function drawRootSeed() {
  const rootSeed = crypto.randomBytes(32).toString('hex');
  const receiptCore = {
    schema: 'axm.code.grammar-glass-entropy-receipt.v1',
    sourceClass: 'OS_CRYPTOGRAPHIC_ENTROPY',
    bytesDrawn: 32,
    rootSeed,
    unknownBeforeDraw: true,
    timestampUsedAsEntropy: false,
    rngProvesNovelty: false
  };
  return deepFreeze({ ...receiptCore, entropyReceiptSha256: hash(receiptCore) });
}

function normalizeRootSeed(rootSeed) {
  const value = clean(rootSeed).toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(value)) throw new Error('GRAMMAR_GLASS_ROOT_SEED_MUST_BE_32_BYTE_HEX');
  return value;
}

function deriveSeed(rootSeed, namespace, index = 0) {
  return crypto
    .createHmac('sha256', Buffer.from(normalizeRootSeed(rootSeed), 'hex'))
    .update(`${clean(namespace, 'default')}\u0000${Number(index)}`)
    .digest('hex');
}

function unitFromSeed(seed, label = '') {
  const digest = hash(`${seed}\u0000${label}`);
  const integer = Number.parseInt(digest.slice(0, 13), 16);
  return integer / 0x10000000000000;
}

function integerFromSeed(seed, label, maxExclusive) {
  if (!Number.isSafeInteger(maxExclusive) || maxExclusive < 1) return 0;
  return Math.floor(unitFromSeed(seed, label) * maxExclusive) % maxExclusive;
}

function createDayStart({
  source,
  catalog,
  conditionRevision,
  dayId,
  rootSeed = null,
  entropyReceipt = null,
  startingStateRefs = []
} = {}) {
  if (!source || !digestCurrent(source, 'sourceSha256') || !catalog || !digestCurrent(catalog, 'catalogSha256')) {
    throw new Error('GRAMMAR_GLASS_VALID_SOURCE_AND_CATALOG_REQUIRED');
  }
  if (!conditionRevision || !digestCurrent(conditionRevision, 'conditionSha256')) {
    throw new Error('GRAMMAR_GLASS_VALID_CONDITION_REVISION_REQUIRED');
  }
  let seed = rootSeed;
  let receipt = entropyReceipt;
  if (!seed) {
    receipt = drawRootSeed();
    seed = receipt.rootSeed;
  } else {
    seed = normalizeRootSeed(seed);
    if (!receipt) {
      const receiptCore = {
        schema: 'axm.code.grammar-glass-entropy-receipt.v1',
        sourceClass: 'CALLER_RECORDED_OR_SELFTEST_SEED',
        bytesDrawn: 0,
        rootSeed: seed,
        unknownBeforeDraw: false,
        timestampUsedAsEntropy: false,
        rngProvesNovelty: false
      };
      receipt = { ...receiptCore, entropyReceiptSha256: hash(receiptCore) };
    }
  }
  const dayKey = cleanId(dayId, 'UNSPECIFIED-DAY');
  const core = {
    schema: 'axm.code.grammar-glass-day-start.v1',
    version: '1.0.0',
    result: 'GRAMMAR_GLASS_DAY_START_CAPTURED',
    dayId: dayKey,
    grammarFamily: GRAMMAR_FAMILY,
    sourceSha256: source.sourceSha256,
    catalogSha256: catalog.catalogSha256,
    profileSnapshotSha256: source.profileSnapshotSha256,
    organRegistrySnapshotSha256: source.organRegistrySnapshotSha256,
    profileCount: source.profileCount,
    atomCount: catalog.atomCount,
    rootSeed: seed,
    entropyReceipt: receipt,
    conditionSha256: conditionRevision.conditionSha256,
    startingStateRefs: strings(startingStateRefs, 128).sort(),
    truth: {
      rootSeedRecordedForReplay: true,
      futureStepsUseDerivedSubSeeds: true,
      timestampAloneWasNotRandomness: true,
      rngDoesNotProveNovelty: true,
      startingStateIsImmutable: true
    },
    authority: AUTHORITY
  };
  return deepFreeze({ ...core, dayStartSha256: hash(core) });
}

function atomBand(atom) {
  const index = UNIVERSAL_ATOM_TYPES.indexOf(atom.atomType);
  return index < 0 ? 0 : index;
}

module.exports = Object.freeze({
  GRAMMAR_FAMILY,
  UNIVERSAL_ATOM_TYPES,
  CONNECTION_CLASSES,
  INFLUENCE_CARRY_CLASSES,
  MIRROR_LENSES,
  FUTURE_GRAMMAR_FAMILIES,
  LEDGER_EVENT_TYPES,
  RAW_PRIVATE_OR_SOURCE_FIELDS,
  AUTHORITY,
  DEFAULT_CONDITIONS,
  TYPE_FEATURE_MAP,
  canon,
  hash,
  deepFreeze,
  clean,
  cleanId,
  strings,
  digestCurrent,
  containsRawPrivateOrSource,
  normalizeToken,
  featureTokens,
  profileCore,
  validateProfile,
  normalizeProfile,
  loadGrammarSource,
  valuesForAtom,
  createAtomCatalog,
  boundedNumber,
  normalizeConditions,
  createConditionRevision,
  drawRootSeed,
  normalizeRootSeed,
  deriveSeed,
  unitFromSeed,
  integerFromSeed,
  createDayStart,
  atomBand
});
