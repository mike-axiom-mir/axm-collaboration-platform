(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.AXMDiscoveryReviewPacks = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var PROFILE_NAMES = [
    'EMPIRICAL',
    'COMPUTATIONAL',
    'SOFTWARE',
    'DOCUMENTARY',
    'DESIGN',
    'NORMATIVE',
    'MIXED'
  ];

  var PROFILE_ALIASES = {
    HISTORICAL: 'DOCUMENTARY',
    USABILITY: 'DESIGN',
    ETHICAL: 'NORMATIVE',
    HYBRID: 'MIXED'
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function cleanText(value, fallback) {
    if (typeof value !== 'string') return fallback || '';
    value = value.trim();
    return value || fallback || '';
  }

  function normalizeProfile(value) {
    var profile = cleanText(value, '').toUpperCase().replace(/[\s-]+/g, '_');
    profile = PROFILE_ALIASES[profile] || profile;
    return PROFILE_NAMES.indexOf(profile) >= 0 ? profile : null;
  }

  function role(
    id,
    title,
    humanEquivalent,
    jurisdiction,
    methods,
    evidence,
    fearedFailure,
    artifact,
    forbiddenOverreach,
    vetoes
  ) {
    return {
      id: id,
      title: title,
      humanEquivalent: humanEquivalent,
      jurisdiction: jurisdiction,
      methods: methods,
      evidence: evidence,
      fearedFailure: fearedFailure,
      artifact: artifact,
      forbiddenOverreach: forbiddenOverreach,
      vetoes: vetoes
    };
  }

  function addRoleContracts(roles, contracts) {
    return roles.map(function (candidate) {
      var contract = contracts[candidate.id] || {};
      candidate.handoffTo = Array.isArray(contract.handoffTo) ? contract.handoffTo.slice() : [];
      candidate.abstentionConditions = Array.isArray(contract.abstentionConditions) ? contract.abstentionConditions.slice() : [];
      return candidate;
    });
  }

  function control(id, title, requirement, blocksInterpretation) {
    return {
      id: id,
      title: title,
      requirement: requirement,
      blocksInterpretation: blocksInterpretation !== false
    };
  }

  var EVIDENCE_PROFILE_CONTROLS = {
    EMPIRICAL: [
      control('empirical-baseline', 'Baseline or control', 'Declare a baseline, comparison group, or explicit reason a control is impossible.'),
      control('empirical-measurement', 'Measurement contract', 'Declare variables, instruments, units, resolution, calibration state, and collection procedure.'),
      control('empirical-repetition', 'Repeat observations', 'Use repeated observations where meaningful and preserve variation rather than only an average.'),
      control('empirical-uncertainty', 'Uncertainty budget', 'Record sampling, instrument, environmental, and interpretation uncertainty.'),
      control('empirical-raw', 'Raw observation retention', 'Preserve raw observations and distinguish them from processed or interpreted results.')
    ],
    COMPUTATIONAL: [
      control('computational-reference', 'Reference expectation', 'Declare an analytical result, trusted benchmark, limiting case, or bounded expectation.'),
      control('computational-convergence', 'Resolution or convergence study', 'Vary timestep, resolution, iteration count, or equivalent numerical control when relevant.'),
      control('computational-replay', 'Deterministic replay', 'Record code, configuration, input, seed, command, and output required to replay the result.'),
      control('computational-dimensions', 'Units and dimensions', 'Check dimensional, scale, and representation consistency.'),
      control('computational-sensitivity', 'Parameter sensitivity', 'Test whether the conclusion survives plausible parameter and tolerance variation.')
    ],
    SOFTWARE: [
      control('software-requirement', 'Requirement-to-test trace', 'Link every readiness claim to an explicit requirement and executed check.'),
      control('software-regression', 'Regression protection', 'Preserve executed regression results and make failures visible.'),
      control('software-boundary', 'Boundary and adversarial cases', 'Exercise invalid inputs, edge conditions, permission boundaries, and misleading success states.'),
      control('software-environment', 'Reproducible environment', 'Record dependencies, configuration, commands, state ownership, and relevant versions.'),
      control('software-user-impact', 'User-facing constraints', 'Check accessibility, failure recovery, data handling, and declared security boundaries where relevant.')
    ],
    DOCUMENTARY: [
      control('documentary-provenance', 'Source provenance', 'Record title, author or organization, date, location, source type, and exact supported claim.'),
      control('documentary-primary', 'Primary-source preference', 'Use primary material where available and label secondary or reference material honestly.'),
      control('documentary-triangulation', 'Independent triangulation', 'Compare materially distinct sources and preserve conflicts rather than averaging them away.'),
      control('documentary-context', 'Quotation and context', 'Check quotation accuracy, surrounding context, translation, and omitted qualifications.'),
      control('documentary-version', 'Date and version fit', 'Confirm that a source applies to the relevant time, jurisdiction, edition, or system version.')
    ],
    DESIGN: [
      control('design-task', 'Real task or need', 'Define the user, context, task, and pain being addressed without substituting market demand for need.'),
      control('design-alternative', 'Alternative comparison', 'Compare the proposal with doing nothing and with simpler non-product alternatives.'),
      control('design-usability', 'Observable use', 'Test representative tasks or interactions and preserve confusion, abandonment, and workarounds.'),
      control('design-access', 'Access and exclusion', 'Examine accessibility, same-gate access, hidden dependencies, and who may be excluded.'),
      control('design-reversible', 'Reversible prototype', 'Prefer a bounded prototype that can fail cheaply without creating lock-in.')
    ],
    NORMATIVE: [
      control('normative-premises', 'Explicit premises', 'State value premises, definitions, affected rights, and the decision boundary.'),
      control('normative-counterexample', 'Counterexample pressure', 'Search for cases that expose inconsistency, overbreadth, or unequal application.'),
      control('normative-stakeholders', 'Stakeholder contradiction', 'Include materially affected perspectives and preserve unresolved value conflicts.'),
      control('normative-harms', 'Harms and power', 'Map foreseeable harms, gatekeeping, dependency, reversibility, and power asymmetry.'),
      control('normative-scope', 'Scoped conclusion', 'Separate factual support from value judgment and avoid presenting consensus as proof.')
    ],
    MIXED: [
      control('mixed-declaration', 'Evidence-mode declaration', 'Label which evidence profile supports each material claim.'),
      control('mixed-trace', 'Cross-profile trace', 'Trace observations, computation, sources, design findings, and value judgments separately.'),
      control('mixed-conflict', 'Cross-profile contradiction', 'Preserve conflicts between evidence modes and state which question each can answer.'),
      control('mixed-weakest-link', 'Weakest-link check', 'Do not let strength in one evidence mode conceal a blocking weakness in another.'),
      control('mixed-limit', 'Integrated limitations', 'State the combined conclusion no more strongly than its least-supported required component.')
    ]
  };

  var CLAIM_LANGUAGE = {
    allowed: [
      'OBSERVED',
      'MEASURED_IN_HARNESS',
      'SOURCE_SUPPORTED',
      'ASSUMPTION',
      'HYPOTHESIS',
      'DISPROVEN',
      'REPAIRED',
      'PARTIAL',
      'TEST_HOLD',
      'BLOCKED',
      'EXPERIMENTAL',
      'NEEDS_EXTERNAL_REVIEW',
      'INDEPENDENTLY_UNVALIDATED'
    ],
    forbiddenStandalone: [
      'DONE',
      'COMPLETE',
      'VERIFIED',
      'PHYSICALLY_ACCURATE',
      'PRODUCTION_READY',
      'SAFE_FOR_ROBOTICS',
      'VALIDATED'
    ],
    selfAssessment: {
      values: ['LOW', 'MEDIUM', 'HIGH'],
      status: 'NON_EVIDENCE',
      requires: ['basis', 'whatWouldChangeIt']
    }
  };

  var GENERAL_LAB_ROLES = [
    role(
      'G1',
      'Scope and Requirements Steward',
      'Systems analyst, research requirements lead, or inquiry owner.',
      ['current question and boundary', 'intended use', 'definitions', 'requirements', 'interfaces', 'claim scope', 'traceability'],
      ['requirements decomposition', 'scope control', 'interface analysis', 'definition audit', 'trace mapping'],
      ['explicit question', 'declared inputs and outputs', 'stable terminology', 'requirement-to-check links'],
      'An impressive local result that no longer answers the intended question.',
      'Scope statement, requirements map, exclusions, and trace update.',
      ['choosing a domain conclusion', 'declaring validity outside the stated boundary'],
      ['Silent scope drift.', 'Inconsistent definitions.', 'Untraceable requirement changes.']
    ),
    role(
      'G2',
      'Subject-Matter Specialist',
      'A qualified practitioner, researcher, craft expert, or deeply informed stakeholder in the chosen subject.',
      ['domain concepts', 'mechanisms or causal structure', 'field-specific assumptions', 'relevant precedent', 'domain limits'],
      ['first-principles analysis', 'field-standard comparison', 'limiting-case reasoning', 'mechanism inspection'],
      ['declared domain assumptions', 'field-appropriate references or observations', 'bounded expectations', 'terminology consistent with the field'],
      'A polished inquiry built on a false or oversimplified understanding of the subject.',
      'Domain model, assumptions register, relevant precedent, and field-specific questions.',
      ['certifying implementation correctness', 'claiming evidence outside domain jurisdiction'],
      ['Material domain contradiction.', 'Undeclared field assumption.', 'Mechanism conflicts with established boundary conditions without evidence.']
    ),
    role(
      'G3',
      'Inquiry and Experiment Designer',
      'Experimental scientist, benchmark designer, investigator, or evaluation-method specialist.',
      ['hypotheses', 'controls', 'comparison structure', 'metrics', 'thresholds', 'test order', 'disconfirming observations'],
      ['controlled comparison', 'predeclaration', 'factor isolation', 'information-gain selection', 'counterfactual design'],
      ['competing explanations', 'explicit control or justified absence', 'locked metrics', 'failure conditions', 'raw observations required'],
      'A test that can produce an attractive result but cannot distinguish competing explanations.',
      'Inquiry plan, predeclaration, comparison matrix, and metric lock.',
      ['changing success thresholds after seeing results', 'selecting only tests that confirm the preferred candidate'],
      ['No discriminating observation.', 'No usable control or comparison.', 'Post-hoc threshold rewriting.']
    ),
    role(
      'G4',
      'Verification and Validation Reviewer',
      'Verification engineer, validation researcher, audit specialist, or field-appropriate quality reviewer.',
      ['implementation or argument verification', 'requirement-based checks', 'reference comparison', 'validation boundary', 'claim wording'],
      ['requirement-to-check matrix', 'independent calculation or comparison', 'regression review', 'defect classification', 'boundary declaration'],
      ['saved check output', 'trusted comparison where available', 'traceable review notes', 'explicit limitations'],
      'Words such as verified, valid, accurate, or safe exceeding the available evidence.',
      'Verification matrix, validation boundary, unresolved defect list, and readiness-language review.',
      ['turning internal agreement into external validation', 'certifying outside reviewer competence'],
      ['Unsupported verification language.', 'Claimed checks without preserved output.', 'Blocking defect hidden from the conclusion.']
    ),
    role(
      'G5',
      'Uncertainty and Limitations Analyst',
      'Uncertainty analyst, sensitivity specialist, metrologist, limitations reviewer, or methodological statistician.',
      ['measurement or source uncertainty', 'parameter sensitivity', 'precision', 'tolerances', 'generalization limits', 'unknowns'],
      ['sensitivity analysis', 'uncertainty budget', 'assumption variation', 'precision audit', 'robustness check'],
      ['plausible ranges', 'repeat observations where relevant', 'precision limits', 'sensitivity ranking', 'source of tolerances'],
      'A conclusion that exists only under one arbitrary assumption or reports false precision.',
      'Uncertainty register, sensitivity note, limitations boundary, and precision warning.',
      ['treating model confidence as statistical evidence', 'inventing numerical precision for qualitative evidence'],
      ['Conclusion collapses under plausible variation.', 'Reported precision exceeds evidential support.']
    ),
    role(
      'G6',
      'Failure and Adversarial Reviewer',
      'Failure analyst, red-team tester, reliability specialist, or critical counterexample hunter.',
      ['edge cases', 'stress cases', 'invalid assumptions', 'misleading success', 'minimal failure reproduction', 'failure classification'],
      ['boundary-value attack', 'fault-tree reasoning', 'counterexample search', 'minimal reproduction', 'strongest-claim challenge'],
      ['preserved failing case', 'exact reproduction path', 'before-and-after comparison', 'unrepaired failure record'],
      'A broken idea being made to look sound through filtering, deleted evidence, or weakened thresholds.',
      'Failure reproduction or counterexample, adversarial check, and failure record.',
      ['repairing before preserving the failure', 'deleting inconvenient evidence'],
      ['Failure suppression.', 'Hidden threshold change.', 'Failure claim without a reproducible or traceable basis.']
    ),
    role(
      'G7',
      'Implementation and Artifact Engineer',
      'Research software engineer, prototype builder, technical author, or artifact specialist appropriate to the subject.',
      ['bounded implementation', 'interfaces', 'deterministic or repeatable procedure', 'dependency control', 'configuration', 'maintainability'],
      ['minimal modular design', 'explicit state ownership', 'versioned configuration', 'repeatable procedure', 'change isolation'],
      ['exact procedure or commands', 'environment or material record', 'change record', 'artifact map', 'executed output when applicable'],
      'An interesting result that nobody can reproduce, inspect, or separate from hidden state.',
      'Bounded prototype or artifact, procedure, environment record, and change log.',
      ['expanding architecture beyond the current inquiry', 'weakening evidence to improve presentation'],
      ['Undocumented manual state.', 'Irreproducible procedure.', 'Unclear artifact ownership.']
    ),
    role(
      'G8',
      'Data, Configuration, and Provenance Steward',
      'Research data manager, archivist, configuration manager, or provenance steward.',
      ['raw versus processed evidence', 'append-only history', 'lineage', 'metadata', 'naming', 'recovery', 'retention of failures'],
      ['provenance capture', 'immutable raw retention', 'manifest generation', 'state snapshot', 'recovery verification'],
      ['exact input', 'exact method or version', 'exact configuration', 'exact output location', 'time and cycle reference'],
      'A finding whose origin, transformations, or decision history cannot be reconstructed.',
      'Provenance ledger, manifest, state snapshot, recovery packet, and raw-evidence index.',
      ['interpreting the subject beyond recording exact context', 'silently rewriting history'],
      ['Broken lineage.', 'Overwritten raw evidence.', 'Resume state requires guessing.']
    ),
    role(
      'G9',
      'Internal Evidence and Source Critic',
      'Internal research critic, source reviewer, or claim-evidence auditor.',
      ['source-to-claim mapping', 'unsupported assumptions', 'circular evidence', 'quotation accuracy', 'claim status', 'observation-versus-interpretation'],
      ['claim decomposition', 'evidence tracing', 'source comparison', 'circularity check', 'scope check'],
      ['citation or raw-evidence reference', 'exact claim wording', 'assumption label', 'uncertainty label'],
      'Confidence, repetition, or apparent consensus being mistaken for support.',
      'INTERNAL CRITIQUE — NOT INDEPENDENT REVIEW: claim-evidence matrix, unsupported-claim list, conflicts, and interpretation boundary.',
      ['declaring an independent audit', 'treating its own judgment as external evidence'],
      ['A major conclusion lacks traceable support.']
    ),
    role(
      'G10',
      'Downstream, Ethics, and Access Representative',
      'Downstream user, affected stakeholder, safety representative, accessibility reviewer, or ethics and impact specialist.',
      ['intended and foreseeable use', 'affected people', 'accessibility', 'same-gate access', 'dependency and lock-in', 'misuse', 'reversibility'],
      ['stakeholder analysis', 'use-context review', 'harm and power mapping', 'access audit', 'transfer-risk analysis'],
      ['explicit user and non-user groups', 'access path', 'declared exclusions', 'failure consequences', 'dependency map'],
      'A locally attractive result that transfers cost, risk, exclusion, or hidden control downstream.',
      'Impact map, access review, blocked-capability note, and downstream requirements.',
      ['declaring domain truth', 'claiming universal stakeholder representation', 'claiming safety without external evidence'],
      ['May block a readiness or fairness claim when affected users, access logic, or material harms are ignored.']
    ),
    role(
      'G11',
      'Stance Integrity Observer',
      'Experimental-process observer for multi-role or multi-review reasoning.',
      ['role uniqueness', 'role leakage', 'duplicate reasoning', 'order effects', 'abstention quality', 'generic-assistant convergence', 'useful work versus roleplay'],
      ['compare methods and artifacts', 'track unique contributions', 'track near-duplicates', 'log boundary violations', 'measure order effects'],
      ['all role artifacts', 'role order', 'relevance decisions', 'unique findings', 'duplicate signals', 'review context metadata'],
      'Many role labels hiding one generic line of reasoning.',
      'Provisional stance-integrity record, divergence table, leakage report, and blinded-review index.',
      ['choosing the winning subject conclusion', 'declaring final success or independence'],
      ['No subject-truth veto.', 'May mark the stance comparison uninterpretable.']
    )
  ];

  GENERAL_LAB_ROLES = addRoleContracts(GENERAL_LAB_ROLES, {
    G1: {
      handoffTo: ['G2', 'G3', 'G4'],
      abstentionConditions: ['Abstain when no current question, boundary, requirement, interface, or claim-scope decision exists.']
    },
    G2: {
      handoffTo: ['G3', 'G4', 'G5', 'G6'],
      abstentionConditions: ['Abstain when the current question is outside the role holder\'s declared subject competence or contains no material domain claim.']
    },
    G3: {
      handoffTo: ['G4', 'G5', 'G7', 'G8'],
      abstentionConditions: ['Abstain when there is not yet a testable, comparable, or otherwise discriminating question to design around.']
    },
    G4: {
      handoffTo: ['G1', 'G8', 'G9'],
      abstentionConditions: ['Abstain when no artifact, implementation, argument, check result, or validation claim exists to inspect.']
    },
    G5: {
      handoffTo: ['G3', 'G4', 'G9'],
      abstentionConditions: ['Abstain when the current work contains no variable assumption, measurement, parameter, tolerance, or generalization claim to assess.']
    },
    G6: {
      handoffTo: ['RELEVANT_DOMAIN_ROLE', 'G4', 'G7', 'G8'],
      abstentionConditions: ['Abstain when no concrete claim, artifact, proposed success, boundary, or failure surface exists to attack.']
    },
    G7: {
      handoffTo: ['G4', 'G6', 'G8'],
      abstentionConditions: ['Abstain when the current inquiry requires no implementation, prototype, procedure, or inspectable artifact.']
    },
    G8: {
      handoffTo: ['ALL_ROLES', 'EXTERNAL_REVIEWER'],
      abstentionConditions: ['Abstain when no evidence, data, configuration, artifact, output, or recovery state is created or changed.']
    },
    G9: {
      handoffTo: ['G1', 'G4', 'EXTERNAL_REVIEWER'],
      abstentionConditions: ['Abstain when no material claim, source, observation, measurement, or evidence link exists to critique.']
    },
    G10: {
      handoffTo: ['G1', 'G2', 'G3', 'G7'],
      abstentionConditions: ['Abstain only when the work is a bounded internal abstraction with no current downstream use, access, affected stakeholder, or readiness claim.']
    },
    G11: {
      handoffTo: ['EXTERNAL_REVIEWER'],
      abstentionConditions: ['Abstain when fewer than two role artifacts, no role order, or insufficient cycle context exists for a meaningful stance comparison.']
    }
  });

  var PHYSICS_ROLES = [
    role(
      'R1',
      'Systems and Research Requirements Engineer',
      'Systems engineer or research requirements engineer.',
      ['current research boundary', 'intended use', 'definitions', 'requirements', 'interfaces', 'traceability', 'exact claim scope'],
      ['requirements decomposition', 'interface analysis', 'traceability mapping', 'scope control', 'contradiction detection'],
      ['explicit current question', 'declared inputs and outputs', 'requirement-to-test links', 'stable terminology'],
      'A technically impressive local result that no longer answers the intended question.',
      'Scope statement, requirements map, interface contract, and trace update.',
      ['selecting equations', 'selecting a solver', 'declaring physical validity'],
      ['Silent scope drift.', 'Inconsistent definitions.', 'Untraceable requirement changes.']
    ),
    role(
      'R2',
      'Applied Mechanics / Theoretical Physics Specialist',
      'Applied mechanician or theoretical or computational physicist.',
      ['conceptual physical model', 'equations of motion', 'units and dimensions', 'conservation expectations', 'physical assumptions', 'model-versus-reality boundary'],
      ['first-principles derivation', 'dimensional analysis', 'conservation analysis', 'limiting-case analysis'],
      ['equations', 'declared assumptions', 'units', 'analytical or bounded expectations'],
      'A numerically stable implementation of the wrong physical model.',
      'Conceptual model, derivation or governing relations, assumptions register, and conservation expectations.',
      ['certifying code correctness', 'selecting implementation merely for convenience'],
      ['Dimensional inconsistency.', 'Undeclared physical assumption.', 'Implementation contradicts the stated conceptual model.']
    ),
    role(
      'R3',
      'Numerical Analyst / Scientific Computing Specialist',
      'Numerical analyst or scientific computing researcher.',
      ['discretization', 'integration', 'timestep behavior', 'convergence', 'iterative behavior', 'truncation and round-off error', 'conditioning', 'numerical stability'],
      ['convergence study', 'timestep sweep', 'error decomposition', 'sensitivity to iteration count', 'stability analysis'],
      ['repeated runs', 'error curves', 'timestep comparison', 'reference or analytical result', 'explicit tolerances'],
      'Apparent stability caused by damping, clamping, coarse measurement, or a narrow parameter range.',
      'Numerical-method note, convergence table, timestep sweep, and error or stability report.',
      ['claiming the physical model represents reality'],
      ['Numerical claims without convergence or timestep evidence.', 'Hidden stabilizing hacks.']
    ),
    role(
      'R4',
      'Computational Geometry / Collision Detection Engineer',
      'Computational geometry engineer or collision detection engineer.',
      ['shape representation', 'broad phase', 'narrow phase', 'geometric tolerances', 'contact candidates', 'continuous collision', 'tunnelling', 'degeneracies'],
      ['geometric predicates', 'bounding-volume analysis', 'degeneracy tests', 'tolerance analysis', 'contact-candidate inspection'],
      ['geometric truth cases', 'edge contacts', 'near-parallel or near-zero separations', 'high-speed cases', 'repeatable contact data'],
      'Incorrect contact geometry feeding a solver that then appears physically wrong.',
      'Collision-query specification, geometric test set, and contact-candidate report.',
      ['selecting impulses', 'selecting friction response', 'modifying geometry to hide solver defects'],
      ['Geometrically inconsistent contact.', 'Undeclared tolerance dependence.', 'Tunnelling ignored without a scope label.']
    ),
    role(
      'R5',
      'Multibody Dynamics / Contact Mechanics Engineer',
      'Multibody dynamics engineer or contact mechanics engineer.',
      ['normal response', 'impulses', 'constraints', 'friction', 'restitution', 'penetration correction', 'stacking', 'resting contact', 'future joints'],
      ['constraint formulation', 'impulse analysis', 'contact-force reasoning', 'friction model comparison', 'solver behavior analysis'],
      ['contact impulses or forces', 'penetration measurements', 'residual velocities', 'stack behavior', 'energy or momentum behavior', 'stress scenes'],
      'A solver that hides instability through correction or violates constraints under load.',
      'Response model, solver specification, constraint test set, and known-limitation note.',
      ['altering geometric truth merely to make response easier'],
      ['Constraint inconsistency.', 'Hidden energy injection.', 'Failure concealed by correction.']
    ),
    role(
      'R6',
      'Experimental Design and Benchmark Scientist',
      'Experimental scientist or benchmark designer.',
      ['research hypothesis', 'controls', 'permanent canaries', 'parameter matrices', 'preregistered thresholds', 'experiment order', 'required raw observations'],
      ['controlled comparison', 'predeclaration', 'factor isolation', 'parameter sweep', 'repeat design', 'information-gain selection'],
      ['explicit control', 'locked metrics', 'declared variables', 'repeated trials where relevant', 'failure conditions'],
      'Interpreting a result from a test that cannot distinguish competing explanations.',
      'Experiment plan, predeclaration, benchmark matrix, and metric lock.',
      ['silently changing success thresholds after observing results'],
      ['No control.', 'No discriminating measurement.', 'Post-hoc threshold rewriting.']
    ),
    role(
      'R7',
      'Verification and Validation Engineer',
      'Simulation V&V engineer or software verification engineer.',
      ['implementation verification', 'solution verification', 'requirement-based testing', 'regression evidence', 'validation boundaries', 'exact claim scope'],
      ['requirement-to-test matrix', 'code verification', 'analytical comparison', 'regression analysis', 'defect classification', 'validation-boundary declaration'],
      ['executed command output', 'saved test results', 'analytical or trusted benchmark comparison', 'regression history', 'explicit limitations'],
      'Words such as verified, stable, valid, or safe exceeding the evidence.',
      'Verification matrix, validation boundary, regression report, and defect report.',
      ['treating internal simulator agreement as real-world validation'],
      ['Unsupported verification language.', 'Claimed tests without saved output.', 'Failed regression hidden from the report.']
    ),
    role(
      'R8',
      'Uncertainty, Sensitivity, and Metrology Analyst',
      'Uncertainty quantification analyst, sensitivity analyst, or metrology specialist.',
      ['numerical uncertainty', 'parameter uncertainty', 'measurement uncertainty', 'sensitivity', 'tolerance selection', 'significant digits', 'units and scaling'],
      ['sensitivity sweep', 'uncertainty budget', 'tolerance rationale', 'scale analysis', 'robustness check'],
      ['parameter ranges', 'repeated measurements', 'precision limits', 'sensitivity ranking', 'tolerance source'],
      'A conclusion that exists only at one arbitrary parameter value or reports false precision.',
      'Uncertainty register, sensitivity table, tolerance rationale, and precision warning.',
      ['treating model self-confidence as statistical evidence'],
      ['Conclusions collapse under plausible variation.', 'Significant digits exceed measurement support.']
    ),
    role(
      'R9',
      'Failure Analysis / Adversarial Test Engineer',
      'Failure analyst, adversarial test engineer, or reliability test engineer.',
      ['edge cases', 'stress cases', 'fault injection', 'invalid inputs', 'misleading success', 'minimal failure reproduction', 'failure classification'],
      ['boundary-value attack', 'fault-tree reasoning', 'stress testing', 'minimal reproduction', 'hypothesis challenge'],
      ['preserved failing input', 'exact command', 'raw output', 'smallest reproduction', 'before-and-after comparison'],
      'A broken system being made to look stable through filtering, clamping, deleted logs, or changed thresholds.',
      'Failure reproduction, adversarial test, fault tree, and failure record.',
      ['repairing before preserving the failure', 'deleting inconvenient evidence'],
      ['Failure suppression.', 'Hidden threshold change.', 'Unreproducible defect claim.']
    ),
    role(
      'R10',
      'Robotics Systems and Controls Representative',
      'Robotics systems engineer, controls representative, or downstream technical customer.',
      ['future joints', 'motors', 'actuators', 'sensor-state needs', 'contact-force access', 'deterministic stepping', 'latency', 'closed-loop implications', 'observability and controllability requirements'],
      ['downstream requirement analysis', 'interface review', 'state-variable review', 'control-loop thought experiment', 'transfer-risk mapping'],
      ['explicit state representation', 'timing behavior', 'available forces and contacts', 'deterministic replay', 'declared omissions'],
      'A locally useful physics design that blocks later control, sensors, joints, or reproducibility.',
      'Robotics-transfer requirements, blocked-capability map, and future-interface note.',
      ['claiming safety or real-hardware suitability'],
      ['No veto over current physics truth.', 'May block a claim of robotics readiness.']
    ),
    role(
      'R11',
      'Research Software Engineer / Scientific Software Architect',
      'Research software engineer or scientific software architect.',
      ['modular implementation', 'interfaces', 'deterministic execution', 'dependency control', 'environment capture', 'test runners', 'configuration', 'maintainability', 'reproducible commands'],
      ['minimal modular design', 'explicit state ownership', 'versioned configuration', 'automated test execution', 'dependency locking', 'change isolation'],
      ['runnable commands', 'environment record', 'code diff', 'deterministic seed', 'test output', 'file map'],
      'A scientifically interesting result that nobody can reproduce or inspect.',
      'Executable harness, architecture record, environment file, test runner, and change log.',
      ['optimizing architecture while weakening evidence', 'modifying production or private AXM files'],
      ['Undocumented manual state.', 'Irreproducible environment.', 'Unclear state ownership.']
    ),
    role(
      'R12',
      'Research Data, Configuration, and Provenance Steward',
      'Research data manager, configuration manager, or provenance steward.',
      ['raw versus processed data', 'append-only history', 'code, configuration, and data lineage', 'metadata', 'file naming', 'manifests', 'recovery', 'retention of failures and disproven hypotheses'],
      ['provenance capture', 'immutable raw storage', 'manifest generation', 'state snapshot', 'recovery verification'],
      ['exact input', 'exact code version', 'exact configuration', 'exact command', 'exact output location', 'timestamp and cycle'],
      'A result whose origin cannot be reconstructed.',
      'Provenance ledger, manifest, state snapshot, recovery packet, and raw-data index.',
      ['interpreting physical meaning beyond recording exact context'],
      ['Broken lineage.', 'Overwritten raw evidence.', 'Resume state requires guessing.']
    ),
    role(
      'R13',
      'Internal Evidence and Source Critic',
      'Internal research critic or claim-evidence reviewer.',
      ['source-to-claim mapping', 'unsupported assumptions', 'circular evidence', 'quotation accuracy', 'claim status', 'observed-versus-interpreted separation'],
      ['claim decomposition', 'evidence tracing', 'source comparison', 'circularity check', 'scope check'],
      ['citation or raw measurement path', 'exact claim wording', 'assumption label', 'uncertainty label'],
      'Confidence, repetition, or consensus being mistaken for support.',
      'INTERNAL CRITIQUE — NOT INDEPENDENT REVIEW: claim-evidence matrix, unsupported-claim list, source conflicts, and interpretation boundary.',
      ['declaring independent audit', 'treating its own judgment as external evidence'],
      ['A major conclusion lacks traceable support.']
    ),
    role(
      'R14',
      'Stance Integrity Observer',
      'Experimental-process observer for the reasoning benchmark.',
      ['role uniqueness', 'role leakage', 'duplicate reasoning', 'order effects', 'abstention quality', 'generic-assistant convergence', 'useful evidence versus roleplay', 'stance decay across cycles'],
      ['compare methods, artifacts, assumptions, proposals, and wording', 'track unique contributions', 'track near-duplicates', 'log role-boundary violations', 'measure order effects', 'identify collapse signals'],
      ['all role artifacts', 'role order', 'cycle count', 'unique findings', 'duplicate phrasing', 'external-review preparation'],
      'Ten labels hiding one generic line of reasoning.',
      'Stance-integrity record, divergence table, role-leakage report, collapse warning, and blinded-evaluation package index.',
      ['choosing the winning physics model', 'declaring final success of the experiment'],
      ['No physics veto.', 'May mark the run stance comparison as uninterpretable.']
    )
  ];

  PHYSICS_ROLES = addRoleContracts(PHYSICS_ROLES, {
    R1: {
      handoffTo: ['R2', 'R3', 'R4', 'R5', 'R6', 'R7'],
      abstentionConditions: ['Abstain only when no current frontier, scope, requirement, definition, interface, or traceability question exists; reactivate when a frontier is framed.']
    },
    R2: {
      handoffTo: ['R3', 'R4', 'R5', 'R6'],
      abstentionConditions: ['Abstain when the current cycle does not concern a physical model, governing relation, unit, conservation expectation, or physical assumption.']
    },
    R3: {
      handoffTo: ['R6', 'R7', 'R8', 'R11'],
      abstentionConditions: ['Abstain when the current cycle contains no numerical approximation, discretization, integration, iteration, convergence, conditioning, or stability question.']
    },
    R4: {
      handoffTo: ['R5', 'R6', 'R9'],
      abstentionConditions: ['Abstain when the current cycle contains no shape representation, collision query, geometric tolerance, contact candidate, tunnelling, or degeneracy question.']
    },
    R5: {
      handoffTo: ['R3', 'R6', 'R9', 'R10'],
      abstentionConditions: ['Abstain when the current cycle contains no contact response, constraint, impulse, friction, restitution, stacking, resting-contact, or joint question.']
    },
    R6: {
      handoffTo: ['R7', 'R8', 'R11', 'R12'],
      abstentionConditions: ['Abstain when no hypothesis, competing explanation, benchmark, control, parameter choice, metric, or discriminating experiment is currently being selected.']
    },
    R7: {
      handoffTo: ['R1', 'R12', 'R13'],
      abstentionConditions: ['Abstain when there is no implementation, executed check, requirement claim, regression result, benchmark comparison, or validation-boundary claim to review.']
    },
    R8: {
      handoffTo: ['R6', 'R7', 'R13'],
      abstentionConditions: ['Abstain when the current cycle contains no parameter range, measurement, numerical result, tolerance, sensitivity, uncertainty, precision, unit, or scale claim.']
    },
    R9: {
      handoffTo: ['RELEVANT_DOMAIN_ROLE', 'R7', 'R11', 'R12'],
      abstentionConditions: ['Abstain when no concrete claim, implementation, input boundary, apparent success, failure surface, or preserved result exists to challenge.']
    },
    R10: {
      handoffTo: ['R1', 'R2', 'R5', 'R11'],
      abstentionConditions: ['Abstain when the current cycle makes no robotics, controls, sensors, joints, timing, deterministic-stepping, observability, controllability, or downstream-readiness claim.']
    },
    R11: {
      handoffTo: ['R7', 'R9', 'R12'],
      abstentionConditions: ['Abstain when the current experiment requires no code, harness, configuration, dependency, command, environment, interface, or software change.']
    },
    R12: {
      handoffTo: ['ALL_ROLES', 'EXTERNAL_REVIEWER'],
      abstentionConditions: ['Abstain when no input, code or configuration state, command, output, raw data, manifest, heartbeat, or recovery information is created or changed.']
    },
    R13: {
      handoffTo: ['R1', 'R7', 'EXTERNAL_REVIEWER'],
      abstentionConditions: ['Abstain when no material claim, source, assumption, measurement, quotation, or claim-evidence link exists to critique.']
    },
    R14: {
      handoffTo: ['EXTERNAL_REVIEWER'],
      abstentionConditions: ['Abstain when role order, relevance decisions, role artifacts, or cycle context are insufficient to compare methods, leakage, duplication, order effects, or stance decay.']
    }
  });

  var PHYSICS_CANARIES = [
    control('physics-stationary', 'Stationary state', 'A body with zero velocity and no applied force remains stationary within a declared numerical tolerance.'),
    control('physics-constant-velocity', 'Constant velocity', 'With no net force, velocity remains constant and position follows the declared discrete update.'),
    control('physics-free-fall', 'Free fall', 'For initial vertical velocity 0 m/s, gravity 9.81 m/s^2, and elapsed time 1 s, compare the harness with 4.905 m continuous displacement and the declared discrete expectation.'),
    control('physics-momentum', 'Momentum', 'Use a simple isolated one-dimensional collision or impulse case with an analytically known momentum expectation.'),
    control('physics-deterministic-replay', 'Deterministic replay', 'Identical code, configuration, inputs, and seed produce identical machine-readable output.'),
    control('physics-units', 'Units and dimensions', 'Check dimensional consistency of current equations, inputs, and reported outputs.')
  ];

  var GENERAL_PACK = {
    schema: 'axm.discovery-lab.role-pack/0.1',
    id: 'general-lab',
    version: '0.1.0',
    title: 'AXM General Evidence Lab',
    status: 'EXPERIMENTAL',
    description: 'Subject-neutral professional pressure testing. Roles are work contracts, not personalities, and abstention is valid.',
    defaultSubject: 'the chosen subject',
    defaultEvidenceProfile: 'MIXED',
    evidenceProfiles: clone(PROFILE_NAMES),
    relevanceValues: ['YES', 'PARTIAL', 'NO'],
    sharedContextWarning: 'Multiple roles performed by one model or one shared context are not independent review.',
    claimLanguage: clone(CLAIM_LANGUAGE),
    sequencing: {
      scopeFirst: ['G1'],
      predeclarationBeforeImplementation: true,
      evidenceCriticAfterArtifacts: ['G9'],
      observerLast: ['G11'],
      rotateEligibleRoles: true
    },
    roles: GENERAL_LAB_ROLES
  };

  var PHYSICS_PACK = {
    schema: 'axm.discovery-lab.role-pack/0.1',
    id: 'physics-stance-forge',
    version: '0.3.0',
    title: 'AXM Physics Stance Forge',
    status: 'HEAVY_EXPERIMENT',
    description: 'The full fourteen-role physics pressure pack distilled from AXM Physics Stance Forge v0.3. Physics is the pressure surface, not an automatically validated product.',
    defaultSubject: 'physics research and executable simulation',
    defaultEvidenceProfile: 'COMPUTATIONAL',
    evidenceProfiles: ['COMPUTATIONAL', 'EMPIRICAL', 'SOFTWARE', 'MIXED'],
    relevanceValues: ['YES', 'PARTIAL', 'NO'],
    sharedContextWarning: 'The roles share one model, one tool environment, and accumulated context unless executor metadata proves otherwise. Do not label them independent.',
    claimLanguage: clone(CLAIM_LANGUAGE),
    sequencing: {
      scopeFirst: ['R1'],
      implementationAfterPredeclaration: ['R11'],
      evidenceCriticAfterArtifacts: ['R13'],
      observerLast: ['R14'],
      rotateEligibleRoles: true
    },
    permanentControls: PHYSICS_CANARIES,
    roles: PHYSICS_ROLES
  };

  var PACKS = {
    'general-lab': GENERAL_PACK,
    'physics-stance-forge': PHYSICS_PACK
  };

  var PACK_ALIASES = {
    general: 'general-lab',
    'subject-neutral': 'general-lab',
    'general-lab-v1': 'general-lab',
    physics: 'physics-stance-forge',
    'physics-v0.3': 'physics-stance-forge',
    'physics-stance-forge-v0.3': 'physics-stance-forge'
  };

  function getEvidenceControls(evidenceProfile) {
    var profile = normalizeProfile(evidenceProfile);
    return profile ? clone(EVIDENCE_PROFILE_CONTROLS[profile]) : null;
  }

  function getPack(id, subject, evidenceProfile) {
    var requestedId = cleanText(id, 'general-lab').toLowerCase();
    var canonicalId = PACK_ALIASES[requestedId] || requestedId;
    var source = PACKS[canonicalId];
    if (!source) return null;

    var pack = clone(source);
    pack.subject = cleanText(subject, pack.defaultSubject);

    var requestedProfile = normalizeProfile(evidenceProfile);
    var profile = requestedProfile || pack.defaultEvidenceProfile;
    if (pack.evidenceProfiles.indexOf(profile) < 0) {
      pack.profileWarning = 'Evidence profile ' + profile + ' is not declared compatible with ' + pack.id + '; using ' + pack.defaultEvidenceProfile + '.';
      profile = pack.defaultEvidenceProfile;
    }
    pack.evidenceProfile = profile;
    pack.controls = getEvidenceControls(profile);

    if (pack.id === 'general-lab') {
      for (var i = 0; i < pack.roles.length; i += 1) {
        if (pack.roles[i].id === 'G2') {
          pack.roles[i].humanEquivalent = 'A qualified practitioner, researcher, craft expert, or deeply informed stakeholder in ' + pack.subject + '.';
          break;
        }
      }
    }

    return pack;
  }

  function listPacks() {
    return Object.keys(PACKS).map(function (id) {
      var pack = PACKS[id];
      return {
        id: pack.id,
        version: pack.version,
        title: pack.title,
        status: pack.status,
        description: pack.description,
        defaultEvidenceProfile: pack.defaultEvidenceProfile,
        evidenceProfiles: clone(pack.evidenceProfiles),
        roleCount: pack.roles.length
      };
    });
  }

  function validatePack(pack) {
    var errors = [];
    var warnings = [];
    var roleFields = [
      'id',
      'title',
      'humanEquivalent',
      'jurisdiction',
      'methods',
      'evidence',
      'fearedFailure',
      'artifact',
      'handoffTo',
      'abstentionConditions',
      'forbiddenOverreach',
      'vetoes'
    ];

    if (!pack || typeof pack !== 'object' || Array.isArray(pack)) {
      return { ok: false, errors: ['Pack must be an object.'], warnings: [] };
    }
    ['schema', 'id', 'version', 'title', 'status'].forEach(function (field) {
      if (!cleanText(pack[field], '')) errors.push('Pack field ' + field + ' is required.');
    });
    if (!Array.isArray(pack.evidenceProfiles) || !pack.evidenceProfiles.length) {
      errors.push('Pack evidenceProfiles must be a non-empty array.');
    } else {
      pack.evidenceProfiles.forEach(function (profile) {
        if (!normalizeProfile(profile)) errors.push('Unknown evidence profile: ' + profile + '.');
      });
    }
    if (pack.evidenceProfile) {
      var selectedProfile = normalizeProfile(pack.evidenceProfile);
      if (!selectedProfile) errors.push('Pack evidenceProfile is unknown: ' + pack.evidenceProfile + '.');
      else if (Array.isArray(pack.evidenceProfiles) && pack.evidenceProfiles.indexOf(selectedProfile) < 0) {
        errors.push('Selected evidence profile ' + selectedProfile + ' is not declared compatible with the pack.');
      }
    }

    if (!pack.claimLanguage || typeof pack.claimLanguage !== 'object' || Array.isArray(pack.claimLanguage)) {
      errors.push('Pack claimLanguage must be an object.');
    } else {
      ['allowed', 'forbiddenStandalone'].forEach(function (field) {
        var values = pack.claimLanguage[field];
        if (!Array.isArray(values) || !values.length) {
          errors.push('Pack claimLanguage.' + field + ' must be a non-empty array.');
        } else if (values.some(function (item) { return !cleanText(item, ''); })) {
          errors.push('Pack claimLanguage.' + field + ' contains an empty or non-text item.');
        }
      });
      if (Array.isArray(pack.claimLanguage.allowed) && Array.isArray(pack.claimLanguage.forbiddenStandalone)) {
        pack.claimLanguage.allowed.forEach(function (label) {
          if (pack.claimLanguage.forbiddenStandalone.indexOf(label) >= 0) errors.push('Claim label appears as both allowed and forbidden: ' + label + '.');
        });
      }
      if (!pack.claimLanguage.selfAssessment || !Array.isArray(pack.claimLanguage.selfAssessment.values) || !pack.claimLanguage.selfAssessment.values.length) {
        warnings.push('Pack claimLanguage does not define self-assessment values.');
      } else if (pack.claimLanguage.selfAssessment.status !== 'NON_EVIDENCE') {
        errors.push('Model self-assessment must be labelled NON_EVIDENCE.');
      }
    }

    var controls = [];
    if (!Array.isArray(pack.controls) || !pack.controls.length) {
      errors.push('Pack controls must be a non-empty array selected from an evidence profile.');
    } else {
      controls = controls.concat(pack.controls);
    }
    if ('permanentControls' in pack) {
      if (!Array.isArray(pack.permanentControls) || !pack.permanentControls.length) errors.push('Pack permanentControls must be a non-empty array when present.');
      else controls = controls.concat(pack.permanentControls);
    }
    var controlIds = {};
    controls.forEach(function (candidate, index) {
      var prefix = 'Control at index ' + index;
      if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
        errors.push(prefix + ' must be an object.');
        return;
      }
      ['id', 'title', 'requirement'].forEach(function (field) {
        if (!cleanText(candidate[field], '')) errors.push(prefix + ' requires non-empty ' + field + '.');
      });
      if (typeof candidate.blocksInterpretation !== 'boolean') errors.push(prefix + ' requires boolean blocksInterpretation.');
      if (cleanText(candidate.id, '')) {
        if (controlIds[candidate.id]) errors.push('Duplicate control id: ' + candidate.id + '.');
        controlIds[candidate.id] = true;
      }
    });

    if (!Array.isArray(pack.roles) || !pack.roles.length) {
      errors.push('Pack roles must be a non-empty array.');
      return { ok: false, errors: errors, warnings: warnings };
    }

    var roleIds = {};
    pack.roles.forEach(function (candidate, index) {
      var prefix = 'Role at index ' + index;
      if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
        errors.push(prefix + ' must be an object.');
        return;
      }
      roleFields.forEach(function (field) {
        if (!(field in candidate)) errors.push(prefix + ' is missing ' + field + '.');
      });
      if (!cleanText(candidate.id, '')) {
        errors.push(prefix + ' requires a non-empty id.');
      } else if (roleIds[candidate.id]) {
        errors.push('Duplicate role id: ' + candidate.id + '.');
      } else {
        roleIds[candidate.id] = true;
        prefix = 'Role ' + candidate.id;
      }
      ['title', 'humanEquivalent', 'fearedFailure', 'artifact'].forEach(function (field) {
        if (!cleanText(candidate[field], '')) errors.push(prefix + ' requires non-empty ' + field + '.');
      });
      ['jurisdiction', 'methods', 'evidence', 'handoffTo', 'abstentionConditions', 'forbiddenOverreach', 'vetoes'].forEach(function (field) {
        if (!Array.isArray(candidate[field]) || !candidate[field].length) {
          errors.push(prefix + ' requires a non-empty ' + field + ' array.');
        } else if (candidate[field].some(function (item) { return !cleanText(item, ''); })) {
          errors.push(prefix + ' contains an empty or non-text ' + field + ' item.');
        }
      });
    });

    if (pack.sequencing && typeof pack.sequencing === 'object') {
      Object.keys(pack.sequencing).forEach(function (key) {
        var value = pack.sequencing[key];
        if (!Array.isArray(value)) return;
        value.forEach(function (roleId) {
          if (!roleIds[roleId]) errors.push('Sequencing field ' + key + ' references unknown role ' + roleId + '.');
        });
      });
    }

    if (!pack.sharedContextWarning) {
      warnings.push('Pack does not declare a shared-context or independence warning.');
    }
    if (!pack.claimLanguage) {
      warnings.push('Pack does not declare claim-language boundaries.');
    }

    return { ok: errors.length === 0, errors: errors, warnings: warnings };
  }

  return {
    PROFILE_NAMES: clone(PROFILE_NAMES),
    EVIDENCE_PROFILE_CONTROLS: clone(EVIDENCE_PROFILE_CONTROLS),
    CLAIM_LANGUAGE: clone(CLAIM_LANGUAGE),
    getEvidenceControls: getEvidenceControls,
    getPack: getPack,
    listPacks: listPacks,
    validatePack: validatePack
  };
});
