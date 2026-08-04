(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory(require('node:crypto'));
  else root.AXMModularSeed = factory(null);
}(typeof globalThis !== 'undefined' ? globalThis : this, function (nodeCrypto) {
  'use strict';

  var SCHEMA = 'axm.modular-growth-seed/v1';
  var VERSION = '1.0.0';
  var DEPTHS = ['starter', 'growing', 'deep'];
  var KINDS = {
    'organ-system': 'a platform organ family',
    'tool-family': 'a family of bounded tools',
    'game-system': 'a modular game-building organism',
    'knowledge-system': 'a research and knowledge organism',
    'interface-system': 'a human-machine interaction organism',
    'mixed-system': 'a cross-domain modular organism'
  };
  var TRACKS = [
    {
      id: 'core', title: 'Nucleus', icon: 'NUC',
      purpose: 'Define the smallest domain model, invariant vocabulary and exact family contract.',
      owns: 'domain invariants and shared vocabulary',
      accepts: 'bounded intent and declared constraints',
      emits: 'versioned family contract and invariant registry'
    },
    {
      id: 'interface', title: 'Interface Hand', icon: 'HND',
      purpose: 'Give human and machine users an explicit, reversible way to direct the system.',
      owns: 'interaction contract and user-controlled commands',
      accepts: 'typed intent and exact state snapshot',
      emits: 'bounded command proposal and visible receipt'
    },
    {
      id: 'evidence', title: 'Evidence Sensor', icon: 'SNS',
      purpose: 'Turn important claims into observable checks, counterevidence and durable receipts.',
      owns: 'claim-to-evidence routing and disconfirming tests',
      accepts: 'named claim and candidate artifact',
      emits: 'PASS, FAIL, HELD or UNKNOWN evidence receipt'
    },
    {
      id: 'safety', title: 'Boundary Gate', icon: 'GTE',
      purpose: 'Keep authority, consent, rollback and failure states explicit as the family grows.',
      owns: 'authority boundary and recovery contract',
      accepts: 'candidate action plus exact actor and digest',
      emits: 'allow, hold or refuse decision with reason'
    },
    {
      id: 'exchange', title: 'Exchange Bridge', icon: 'BRG',
      purpose: 'Move portable artifacts between the platform and AXM without copying hidden state.',
      owns: 'portable handoff schema and translation-loss record',
      accepts: 'declared artifact envelope',
      emits: 'portable candidate package and intake receipt'
    },
    {
      id: 'evolution', title: 'Evolution Memory', icon: 'EVO',
      purpose: 'Preserve lineage, version differences and lessons without silently replacing ancestors.',
      owns: 'lineage graph, version comparison and retained alternatives',
      accepts: 'parent digest, child candidate and review evidence',
      emits: 'versioned lineage record and next-growth questions'
    }
  ];
  var REFUSALS = [
    'automatic-promotion',
    'automatic-publication',
    'automatic-installation',
    'seed-as-runtime-proof',
    'untested-claim-as-capability',
    'silent-parent-replacement',
    'undeclared-network-access',
    'private-path-retention'
  ];

  function text(value, fallback) {
    var normalized = String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
    return normalized || fallback || '';
  }
  function lines(value) {
    var source = Array.isArray(value) ? value : String(value == null ? '' : value).split(/[\r\n,;]+/);
    var seen = {};
    return source.map(function (item) { return text(item); }).filter(function (item) {
      var key = item.toLowerCase();
      if (!item || seen[key]) return false;
      seen[key] = true;
      return true;
    });
  }
  function clamp(value, minimum, maximum, fallback) {
    var number = Number(value);
    if (!Number.isFinite(number)) number = fallback;
    return Math.max(minimum, Math.min(maximum, Math.round(number)));
  }
  function slug(value) {
    return text(value, 'untitled-seed').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'untitled-seed';
  }
  function stable(value) {
    if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
    if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(function (key) { return JSON.stringify(key) + ':' + stable(value[key]); }).join(',') + '}';
    return JSON.stringify(value);
  }
  function fingerprint(value) {
    var source = typeof value === 'string' ? value : stable(value);
    var hash = 2166136261;
    for (var index = 0; index < source.length; index += 1) {
      hash ^= source.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return ('00000000' + (hash >>> 0).toString(16)).slice(-8);
  }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function selectedTracks(input) {
    var requested = lines(input.tracks).map(function (item) { return item.toLowerCase(); });
    var filtered = TRACKS.filter(function (track) { return requested.indexOf(track.id) !== -1; });
    return filtered.length ? filtered : TRACKS.slice();
  }
  function depthWork(depth) {
    if (depth === 'deep') return {
      files: ['manifest.json', 'module.contract.json', 'README.md', 'schemas/', 'fixtures/', 'selftest.js', 'implementation/'],
      minimumChecks: 8,
      expectation: 'Implement contracts, fixtures, failure recovery, schema validation and evidence-producing tests.'
    };
    if (depth === 'growing') return {
      files: ['manifest.json', 'module.contract.json', 'README.md', 'fixtures/', 'selftest.js', 'implementation/'],
      minimumChecks: 5,
      expectation: 'Implement the bounded core, one adapter seam, fixtures and executable disconfirming tests.'
    };
    return {
      files: ['manifest.json', 'module.contract.json', 'README.md', 'selftest.js', 'implementation/'],
      minimumChecks: 3,
      expectation: 'Build the smallest executable contract proof with honest held states for missing substrates.'
    };
  }
  function normalize(input) {
    input = input || {};
    var depth = DEPTHS.indexOf(input.depth) !== -1 ? input.depth : 'growing';
    var kind = Object.prototype.hasOwnProperty.call(KINDS, input.kind) ? input.kind : 'organ-system';
    var parentDigest = text(input.parentDigest).toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(parentDigest)) parentDigest = null;
    return {
      title: text(input.title, 'Untitled modular organism'),
      subject: text(input.subject, 'A bounded capability family'),
      goal: text(input.goal, 'Grow a useful modular family while preserving exact contracts, evidence gaps and human review.'),
      targetPlatform: text(input.targetPlatform, 'AI platform workspace'),
      kind: kind,
      depth: depth,
      seedCount: clamp(input.seedCount, 1, 12, 6),
      suggestedRuns: clamp(input.suggestedRuns, 1, 20, 5),
      maxChildrenPerSeed: clamp(input.maxChildrenPerSeed, 1, 4, 2),
      constraints: lines(input.constraints),
      existingCapabilities: lines(input.existingCapabilities),
      tracks: selectedTracks(input).map(function (track) { return track.id; }),
      parentDigest: parentDigest,
      createdAt: text(input.createdAt, new Date(0).toISOString()),
      operator: text(input.operator, 'Mike')
    };
  }
  function moduleSeed(intent, familySlug, track, index, cycle) {
    var identifier = familySlug + '-' + track.id + '-' + (index + 1);
    var work = depthWork(intent.depth);
    return {
      schema: 'axm.modular-growth-seed.module/v1',
      id: identifier,
      title: intent.title + ' / ' + track.title + (cycle ? ' ' + (cycle + 1) : ''),
      status: 'SEED',
      evidenceStatus: 'UNTESTED',
      authority: 'NONE',
      lane: track.id,
      kind: intent.kind,
      purpose: track.purpose + ' Apply it specifically to ' + intent.subject + '.',
      owns: track.owns,
      contract: {
        accepts: ['axm.seed-intent/' + familySlug + '/v1', 'axm.modular-growth-context/v1'],
        emits: ['axm.seed-candidate/' + identifier + '/v1', 'axm.seed-evidence/' + identifier + '/v1'],
        permissions: [],
        refuses: REFUSALS.slice()
      },
      growthQuestion: 'What is the smallest independently testable ' + track.title.toLowerCase() + ' that advances “' + intent.goal + '” without duplicating existing capability?',
      work: work,
      disconfirmingTests: [
        'Reject an input that does not match the declared accepts contract.',
        'Demonstrate that a claimed output is not marked PASS without an executable evidence receipt.',
        'Demonstrate that the module can be removed or held without corrupting sibling seed modules.'
      ],
      duplicateCheckAgainst: intent.existingCapabilities.slice(),
      growthHints: [
        'Keep this seed independently understandable and versioned.',
        'Prefer a new bounded module only when an existing exact capability cannot satisfy the contract.',
        'Return missing substrate, hand, evidence or contract needs as typed gaps rather than invented completion.'
      ]
    };
  }
  function semanticView(packet) {
    var copy = clone(packet);
    if (copy.provenance) delete copy.provenance.createdAt;
    if (copy.integrity) copy.integrity.semanticDigest = null;
    return copy;
  }
  function compile(input) {
    var intent = normalize(input);
    var tracks = TRACKS.filter(function (track) { return intent.tracks.indexOf(track.id) !== -1; });
    var identityMaterial = clone(intent);
    delete identityMaterial.createdAt;
    var familySlug = slug(intent.title);
    var identity = fingerprint(identityMaterial);
    var modules = [];
    for (var index = 0; index < intent.seedCount; index += 1) {
      var track = tracks[index % tracks.length];
      modules.push(moduleSeed(intent, familySlug, track, index, Math.floor(index / tracks.length)));
    }
    return {
      schema: SCHEMA,
      version: VERSION,
      seedId: 'seed-' + familySlug + '-' + identity,
      title: intent.title,
      subject: intent.subject,
      goal: intent.goal,
      kind: intent.kind,
      organismDescription: KINDS[intent.kind],
      targetPlatform: intent.targetPlatform,
      maturity: 'SEED',
      truth: {
        installedCapability: false,
        executedEvidence: false,
        automaticGrowth: false,
        automaticIntake: false,
        automaticPromotion: false
      },
      provenance: {
        createdBy: 'AXM Modular Seed Foundry',
        operator: intent.operator,
        createdAt: intent.createdAt,
        parentSemanticDigest: intent.parentDigest,
        lineageRule: 'Children append lineage. They never overwrite or impersonate the parent seed.'
      },
      familyContract: {
        intent: 'Grow ' + KINDS[intent.kind] + ' for ' + intent.subject + '.',
        constraints: intent.constraints,
        knownExistingCapabilities: intent.existingCapabilities,
        sharedInput: 'axm.seed-intent/' + familySlug + '/v1',
        candidateEnvelope: 'axm.modular-piece-package/v1'
      },
      growthBudget: {
        suggestedHumanInitiatedRuns: intent.suggestedRuns,
        maximumChildCandidatesPerSeedPerRun: intent.maxChildrenPerSeed,
        maximumCandidatesPerRun: intent.seedCount * intent.maxChildrenPerSeed,
        automaticRun: false,
        note: 'This is a ceiling, not a target or promise. Each run starts only after an explicit user request.'
      },
      modules: modules,
      growthProtocol: {
        instruction: 'Grow useful child candidates from these exact seeds while preserving modular identity, typed contracts, evidence status and authority boundaries.',
        steps: [
          'Read the complete seed pack and preserve every seed ID and parent digest.',
          'Check the supplied existing capabilities before proposing a new child; mark exact duplicates SKIP.',
          'For each useful child, create a separate folder with manifest, module contract, README, implementation and executable selftest.',
          'Keep model reasoning and design claims separate from executed evidence. Use PASS, FAIL, HELD or UNKNOWN honestly.',
          'Return a machine-readable intake index plus one portable ZIP or folder. Do not install, merge, publish or promote it.',
          'Stop at the per-run candidate ceiling and wait for the next explicit human request.'
        ],
        selectionRule: 'Prefer orthogonal capability, explicit ownership and a testable handoff over code volume.',
        duplicateRule: 'Useful later becomes PARK; exact duplicate becomes SKIP; uncertain overlap becomes REVIEW.',
        completionRule: 'A platform run is complete when every returned candidate has a unique ID, exact contract, source, selftest and evidence status.'
      },
      intake: {
        target: 'modular-intake-gate',
        expectedSchema: 'axm.modular-piece-package/v1',
        dispositionChoices: ['USE_NOW', 'PARK', 'SKIP', 'REVIEW'],
        humanReviewRequired: true,
        installAuthority: false,
        promotionAuthority: false
      },
      integrity: {
        algorithm: 'SHA-256',
        semanticDigest: null,
        excludes: ['provenance.createdAt', 'integrity.semanticDigest']
      }
    };
  }
  function semanticMaterial(packet) { return stable(semanticView(packet)); }
  function nodeDigest(packet) {
    if (!nodeCrypto) throw new Error('Node SHA-256 is unavailable in this runtime.');
    return nodeCrypto.createHash('sha256').update(semanticMaterial(packet), 'utf8').digest('hex');
  }
  function attachDigest(packet, digest) {
    var copy = clone(packet);
    var normalized = text(digest).toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(normalized)) throw new Error('A complete SHA-256 digest is required.');
    copy.integrity.semanticDigest = normalized;
    return copy;
  }
  function validate(packet) {
    var errors = [];
    if (!packet || packet.schema !== SCHEMA) errors.push('schema must be ' + SCHEMA);
    if (!packet || packet.maturity !== 'SEED') errors.push('maturity must remain SEED');
    if (!packet || !Array.isArray(packet.modules) || packet.modules.length < 1 || packet.modules.length > 12) errors.push('modules must contain 1–12 seeds');
    var ids = {};
    (packet && packet.modules || []).forEach(function (item) {
      if (!/^[a-z0-9][a-z0-9-]{2,79}$/.test(item.id || '')) errors.push('invalid module id: ' + (item.id || '(missing)'));
      if (ids[item.id]) errors.push('duplicate module id: ' + item.id);
      ids[item.id] = true;
      if (item.status !== 'SEED' || item.evidenceStatus !== 'UNTESTED' || item.authority !== 'NONE') errors.push(item.id + ' overclaims seed maturity or authority');
      if (!item.contract || !Array.isArray(item.contract.permissions) || item.contract.permissions.length) errors.push(item.id + ' must request no permissions');
      if (!item.work || !Array.isArray(item.work.files) || !item.work.files.includes('selftest.js')) errors.push(item.id + ' lacks an executable selftest requirement');
    });
    if (!packet || !packet.truth || packet.truth.automaticGrowth !== false || packet.truth.automaticIntake !== false || packet.truth.automaticPromotion !== false) errors.push('automatic authority boundaries are missing');
    if (!packet || !packet.growthBudget || packet.growthBudget.automaticRun !== false || packet.growthBudget.maximumCandidatesPerRun > 48) errors.push('growth budget is missing or unbounded');
    if (!packet || !packet.intake || packet.intake.humanReviewRequired !== true || packet.intake.installAuthority !== false || packet.intake.promotionAuthority !== false) errors.push('intake boundaries are missing');
    if (packet && packet.integrity && packet.integrity.semanticDigest && !/^[a-f0-9]{64}$/.test(packet.integrity.semanticDigest)) errors.push('semantic digest is invalid');
    return { pass: errors.length === 0, errors: errors };
  }
  function platformBrief(packet) {
    var validation = validate(packet);
    if (!validation.pass) throw new Error('Cannot compose a brief from an invalid seed: ' + validation.errors.join('; '));
    var digest = packet.integrity.semanticDigest || 'PENDING-SHA256';
    var linesOut = [
      '# AXM Modular Growth Seed — ' + packet.title,
      '',
      'Seed ID: `' + packet.seedId + '`  ',
      'Semantic digest: `' + digest + '`  ',
      'Maturity: **SEED / UNTESTED / NO AUTHORITY**',
      '',
      '## Platform assignment',
      '',
      'Grow this seed pack into useful, independent modular candidates for **' + packet.goal + '**.',
      'Work one explicitly requested run at a time. Return no more than **' + packet.growthBudget.maximumCandidatesPerRun + '** candidates in this run, and fewer is better when the modules would overlap.',
      '',
      'Required behavior:',
      '',
      '1. Preserve every seed ID, the parent digest and the supplied authority boundaries.',
      '2. Check known capabilities before creating anything. Use `SKIP` for exact duplicates, `PARK` for useful-later work, and `REVIEW` for uncertain overlap.',
      '3. Give each useful candidate its own folder, unique ID, manifest, module contract, README, implementation and executable selftest.',
      '4. Mark claims `PASS`, `FAIL`, `HELD` or `UNKNOWN` from evidence. Never treat model reasoning as executed proof.',
      '5. Return a portable ZIP or folder plus a machine-readable intake index. Do not install, merge, publish or promote it.',
      '',
      '## Machine-readable seed pack',
      '',
      '```json',
      JSON.stringify(packet, null, 2),
      '```',
      ''
    ];
    return linesOut.join('\n');
  }

  return {
    SCHEMA: SCHEMA,
    VERSION: VERSION,
    KINDS: clone(KINDS),
    TRACKS: clone(TRACKS),
    normalize: normalize,
    compile: compile,
    semanticMaterial: semanticMaterial,
    nodeDigest: nodeDigest,
    attachDigest: attachDigest,
    validate: validate,
    platformBrief: platformBrief,
    stable: stable,
    fingerprint: fingerprint
  };
}));
