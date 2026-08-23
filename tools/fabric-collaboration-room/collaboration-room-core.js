(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AXMCollaborationRoom = api;
}(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  var DIGEST = /^sha256:[a-f0-9]{64}$/;
  var DECISIONS = ['HOLD', 'ASK_REPAIR', 'PREPARE_SANDBOX_TRIAL'];
  var OUTPUT_KEYS = [
    'schema', 'status', 'decision', 'goal', 'candidateDigest', 'note',
    'consentTier', 'reviewSeat', 'authority', 'effect', 'authenticated',
    'installed', 'integrated', 'promoted', 'canonChanged', 'nextGate'
  ];

  var COLLABORATORS = [
    {
      id: 'mike', name: 'Mike', glyph: 'M', kind: 'HUMAN MERGE GATE', tone: 'gold',
      state: 'HUMAN DECISION', evidence: 'Local human seat is displayed; identity authentication is not performed here.',
      role: 'Sets the goal, may hold or reject, and remains the final Workshop merge gate.',
      can: ['state direction', 'preserve dissent', 'request a bounded next step'],
      cannot: ['click a root HOLD into PASS', 'make an unauthenticated draft authoritative']
    },
    {
      id: 'fabric', name: 'Fabric', glyph: 'F', kind: 'DETERMINISTIC PLANNER', tone: 'cyan',
      state: 'V1.2 DECLARED', evidence: 'The installed v1.2 contract is represented; this page does not execute it.',
      role: 'Coordinates exact blueprints, capability metadata, consent scope and evidence into inert plans.',
      can: ['plan exact bounded routes', 'preserve lineage and uncertainty', 'emit typed gaps'],
      cannot: ['authenticate Mike', 'write or execute a candidate', 'install or promote itself']
    },
    {
      id: 'atlas', name: 'Code Atlas', glyph: 'A', kind: 'RECIPE FOUNDRY', tone: 'violet',
      state: '1,000 DECLARED RECIPES', evidence: 'Catalog size and reference-only seam are declared from the reviewed Fabric lineage.',
      role: 'Offers searchable, byte-bound recipe metadata as reference context.',
      can: ['expose exact identities', 'show eligibility and holds', 'bind installed lineage'],
      cannot: ['choose semantic fitness', 'grant source-reuse rights', 'execute a recipe']
    },
    {
      id: 'ai', name: 'AI Challenger', glyph: 'AI', kind: 'OPTIONAL PROVIDER', tone: 'pink',
      state: 'OFF BY DEFAULT', evidence: 'No provider call or live host observation occurs in this room.',
      role: 'May later offer a separately identified alternative when a human explicitly enables an exact provider.',
      can: ['broaden alternatives when authorized', 'remain visibly attributed'],
      cannot: ['silently rank itself first', 'inherit permissions', 'act as a review seat']
    },
    {
      id: 'mirror', name: 'Mirror', glyph: 'MR', kind: 'OBSERVATION BODY', tone: 'blue',
      state: 'CONTRACT VISIBLE · LIVE UNKNOWN', evidence: 'Mirror contracts exist; live presence or observation is not proven by this page.',
      role: 'Represents a separately consented observation and comparison body.',
      can: ['show declared read-only seams', 'carry exact revision evidence'],
      cannot: ['observe without consent', 'mutate the Workshop', 'claim a live connection here']
    },
    {
      id: 'evidence', name: 'Evidence', glyph: 'E', kind: 'VERIFICATION DESK', tone: 'green',
      state: 'DECLARED VERIFIER', evidence: 'Evidence Desk is linked as the native proof router; no check runs in this room.',
      role: 'Keeps PASS, FAIL, UNKNOWN and the proof surface separate.',
      can: ['route claims to fitting evidence', 'keep unknowns visible'],
      cannot: ['turn integrity into truth', 'replace runtime or human judgment']
    },
    {
      id: 'nursery', name: 'Nursery', glyph: 'N', kind: 'DETACHED CANDIDATES', tone: 'amber',
      state: 'INSTALL DOOR LOCKED', evidence: 'The candidate boundary is visualized; no candidate is created or inspected here.',
      role: 'Holds separate experimental candidates before any exact review or installation decision.',
      can: ['keep candidate bytes detached', 'preserve alternatives'],
      cannot: ['self-install', 'overwrite source', 'change CANON']
    }
  ];

  var SCENARIOS = {
    plan: {
      id: 'plan', label: 'PLAN A CHANGE', state: 'PLANNABLE',
      summary: 'Mike supplies a goal. Fabric may consult exact Atlas metadata and route evidence, but implementation remains not started.',
      active: ['mike', 'fabric', 'atlas', 'evidence'],
      flow: ['Human goal', 'Exact blueprint', 'Reference-only recipes', 'Inert plan'],
      nextGate: 'AUTHENTICATED HUMAN DECISION'
    },
    trial: {
      id: 'trial', label: 'TRY A CANDIDATE', state: 'CONTRACT GAP',
      summary: 'A detached candidate trial needs an exact candidate digest, authenticated consent and a separately authorized disposable executor.',
      active: ['mike', 'fabric', 'ai', 'nursery', 'evidence'],
      flow: ['Exact candidate', 'Human scope', 'Disposable sandbox', 'Runtime evidence'],
      nextGate: 'AUTHENTICATED DECISION + EXECUTOR AUTHORIZATION'
    },
    install: {
      id: 'install', label: 'INSTALL OR INTEGRATE', state: 'LOCKED',
      summary: 'Evidence may support a review, but four-root PASS and Mike-controlled exact integration remain separate from creation.',
      active: ['mike', 'mirror', 'evidence', 'nursery'],
      flow: ['Reviewed bytes', 'Four roots', 'Mike decision', 'Separate integration'],
      nextGate: 'REVIEW INBOX · EXACT DIGEST'
    }
  };

  function fail(message) { throw new Error(message); }
  function own(value, key) { return Object.prototype.hasOwnProperty.call(value, key); }
  function exactKeys(value, keys, label) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail(label + ' must be an object');
    var actual = Object.keys(value).sort();
    var expected = keys.slice().sort();
    if (JSON.stringify(actual) !== JSON.stringify(expected)) fail(label + ' fields are not exact');
  }
  function text(value, label, minimum, maximum) {
    if (typeof value !== 'string') fail(label + ' must be text');
    if (/[\u0000-\u001f\u007f]/.test(value)) fail(label + ' is outside its text boundary');
    var normalized = value.trim().replace(/\s+/g, ' ');
    if (normalized.length < minimum || normalized.length > maximum) {
      fail(label + ' is outside its text boundary');
    }
    return normalized;
  }
  function nullableDigest(value) {
    if (value === null || value === '') return null;
    if (typeof value !== 'string' || !DIGEST.test(value)) fail('candidateDigest must be an exact sha256 digest');
    return value;
  }
  function scenario(id) {
    if (!own(SCENARIOS, id)) fail('scenario is unsupported');
    return JSON.parse(JSON.stringify(SCENARIOS[id]));
  }
  function collaborators() { return JSON.parse(JSON.stringify(COLLABORATORS)); }

  function buildDecisionDraft(input) {
    exactKeys(input, ['goal', 'decision', 'candidateDigest', 'note', 'acknowledgement'], 'decision input');
    var goal = text(input.goal, 'goal', 1, 280);
    var note = input.note === '' ? '' : text(input.note, 'note', 1, 600);
    var decision = input.decision;
    if (DECISIONS.indexOf(decision) < 0) fail('decision is unsupported');
    if (typeof input.acknowledgement !== 'boolean') fail('acknowledgement must be boolean');
    var candidateDigest = nullableDigest(input.candidateDigest);
    if (decision === 'PREPARE_SANDBOX_TRIAL' && !candidateDigest) fail('sandbox trial preparation requires an exact candidate digest');
    if (decision === 'PREPARE_SANDBOX_TRIAL' && input.acknowledgement !== true) {
      fail('sandbox trial preparation requires the visible draft-only acknowledgement');
    }
    var route = {
      HOLD: ['TIER_0_INSPECT', 'PROPOSAL_OR_EVIDENCE_MUST_CHANGE'],
      ASK_REPAIR: ['TIER_1_REPAIR_REQUEST', 'NEW_BOUNDED_REPAIR_REQUEST_REQUIRED'],
      PREPARE_SANDBOX_TRIAL: ['TIER_2_SANDBOX_TRIAL', 'AUTHENTICATED_HUMAN_DECISION_REQUIRED']
    }[decision];
    return {
      schema: 'axm.collaboration-decision-draft/v1',
      status: 'UNAUTHENTICATED_DRAFT',
      decision: decision,
      goal: goal,
      candidateDigest: candidateDigest,
      note: note,
      consentTier: route[0],
      reviewSeat: 'LOCAL_HUMAN_INPUT_UNVERIFIED',
      authority: 'NONE',
      effect: 'NONE',
      authenticated: false,
      installed: false,
      integrated: false,
      promoted: false,
      canonChanged: false,
      nextGate: route[1]
    };
  }

  function validateDecisionDraft(value) {
    exactKeys(value, OUTPUT_KEYS, 'decision draft');
    var rebuilt = buildDecisionDraft({
      goal: value.goal,
      decision: value.decision,
      candidateDigest: value.candidateDigest,
      note: value.note,
      acknowledgement: value.decision === 'PREPARE_SANDBOX_TRIAL'
    });
    if (JSON.stringify(value) !== JSON.stringify(rebuilt)) fail('decision draft truth or ordering drifted');
    return true;
  }

  return {
    COLLABORATORS: collaborators(),
    SCENARIOS: JSON.parse(JSON.stringify(SCENARIOS)),
    collaborators: collaborators,
    scenario: scenario,
    buildDecisionDraft: buildDecisionDraft,
    validateDecisionDraft: validateDecisionDraft
  };
}));
