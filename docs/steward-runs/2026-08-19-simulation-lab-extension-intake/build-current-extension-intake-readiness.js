#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Intake = require('../../../shared/simulation-lab-extension-intake/simulation-lab-extension-intake');

const workshop = path.resolve(__dirname, '../../..');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(workshop, relativePath), 'utf8'));
}

function writeJson(name, value) {
  fs.writeFileSync(path.join(__dirname, name), JSON.stringify(value, null, 2) + '\n');
}

function digestFile(relativePath) {
  return Intake.sha256(fs.readFileSync(path.join(workshop, relativePath)));
}

const contractPaths = {
  'portable-baseline-capsule': 'shared/portable-baseline-capsule/module.contract.json',
  'baseline-simulation-lab': 'shared/baseline-simulation-lab/module.contract.json',
  'grounded-growth-challenger-lab': 'shared/grounded-growth-challenger-lab/module.contract.json'
};

const contracts = Object.fromEntries(
  Object.entries(contractPaths).map(([id, relativePath]) => [id, readJson(relativePath)])
);

const hostProfile = Intake.buildHostProfile({
  profileId: 'axm-current-simulation-lab-host',
  generatedAt: '2026-08-19T13:50:00.000Z',
  contracts
});

const mappingDefinitions = {
  SOFTWARE_REPOSITORY: {
    candidateCapability: 'simulation.extension.translate.software',
    hostCapability: 'simulation.baseline.software.bind-git-dirty'
  },
  MIRROR_STATE: {
    candidateCapability: 'simulation.extension.translate.mirror',
    hostCapability: 'simulation.baseline.mirror.separate-realms'
  },
  SPECIALIST_MASK: {
    candidateCapability: 'simulation.extension.translate.specialist',
    hostCapability: 'simulation.baseline.specialist.bind-host-mask-ceiling'
  }
};

const exampleExtension = Intake.normalizeExtensionDeclaration({
  schema: Intake.EXTENSION_SCHEMA,
  version: Intake.VERSION,
  extensionId: 'platform-baseline-adapter-extension',
  candidate: {
    moduleId: 'platform-baseline-adapter',
    version: 'v0.1-experimental'
  },
  relation: 'ADAPTER',
  hostProfileDigest: hostProfile.profileDigest,
  subjectKinds: Intake.SUBJECT_KINDS.slice(),
  mappings: Intake.SUBJECT_KINDS.map((subjectKind) => ({
    subjectKind,
    candidateCapability: mappingDefinitions[subjectKind].candidateCapability,
    hostModuleId: 'portable-baseline-capsule',
    hostCapability: mappingDefinitions[subjectKind].hostCapability,
    inputSchema: 'axm.portable-baseline-capsule/v1',
    outputSchema: 'axm.baseline-simulation-lab-run/v1',
    unsupportedFieldPolicy: 'DIGEST_BOUND_REFERENCE',
    nativeSchemaIdentityClaimed: false
  })),
  boundaries: {
    truthRulesChanged: false,
    rootReplacement: false,
    originalSourceMutation: false,
    candidateCodeExecuted: false,
    installed: false,
    promoted: false,
    canonChanged: false,
    permissionsRequested: []
  }
});

const requirements = {
  requirements: [
    {
      id: 'protected-host-identity',
      capabilities: ['simulation.extension.host-profile-native-verify'],
      required: true
    },
    {
      id: 'inert-extension-intake',
      capabilities: [
        'simulation.extension.branch-package-native-verify',
        'simulation.extension.root-identity-collision-refuse',
        'simulation.extension.truth-rule-preservation',
        'simulation.extension.subject-mapping-verify',
        'simulation.extension.permission-expansion-refuse'
      ],
      required: true
    },
    {
      id: 'evidence-and-authority-boundary',
      capabilities: [
        'simulation.extension.evaluation-requirements-route',
        'simulation.extension.human-value-separate',
        'simulation.extension.adoption.none'
      ],
      required: true
    },
    {
      id: 'current-frontier-restraint',
      capabilities: ['simulation.extension.current-zero-candidate'],
      required: true
    },
    {
      id: 'experimental-candidate-received',
      capabilities: ['simulation.extension.candidate-package.received'],
      required: false
    },
    {
      id: 'candidate-runtime-evidence',
      capabilities: ['simulation.extension.candidate-runtime.verified'],
      required: false
    },
    {
      id: 'live-human-value-evidence',
      capabilities: ['growth.human-evidence.live'],
      required: false
    }
  ]
};

const before = {
  capabilities: [
    {
      id: 'branch-return.authority-preservation',
      status: 'available',
      constraints: ['The existing return gate emits inert digest-bound packages and never executes candidate code.']
    },
    {
      id: 'simulation.baseline.current-roots',
      status: 'available',
      constraints: ['Portable identity, invariant run envelope and challenger evaluation already exist as separate TEST roots.']
    },
    {
      id: 'simulation.extension.candidate-package.received',
      status: 'degraded',
      constraints: ['No Platform or other branch candidate package has been supplied.']
    },
    {
      id: 'simulation.extension.candidate-runtime.verified',
      status: 'degraded',
      constraints: ['No candidate exists, so isolated runtime evaluation is NOT_RUN.']
    },
    {
      id: 'growth.human-evidence.live',
      status: 'degraded',
      constraints: ['No person has judged a future candidate useful in a voluntary live trial.']
    }
  ]
};

const after = {
  capabilities: [
    ...before.capabilities,
    {
      id: 'simulation.extension.host-profile-native-verify',
      status: 'available',
      constraints: ['The exact three TEST root contracts are embedded and digest-bound in a natively rebuildable host profile.']
    },
    {
      id: 'simulation.extension.branch-package-native-verify',
      status: 'available',
      constraints: ['Assessment reuses the Branch Module Return Gate verifier without extracting or executing candidate bytes.']
    },
    {
      id: 'simulation.extension.root-identity-collision-refuse',
      status: 'available',
      constraints: ['A candidate cannot reuse any protected root module id.']
    },
    {
      id: 'simulation.extension.truth-rule-preservation',
      status: 'available',
      constraints: ['Adapters may translate but cannot replace roots, discard unsupported fields or change invariant truth rules.']
    },
    {
      id: 'simulation.extension.subject-mapping-verify',
      status: 'available',
      constraints: ['Every declared software, Mirror or specialist subject must map exact candidate handoffs to a provided host capability.']
    },
    {
      id: 'simulation.extension.permission-expansion-refuse',
      status: 'available',
      constraints: ['Candidate manifest, contract, return declaration and extension declaration must all retain zero permissions.']
    },
    {
      id: 'simulation.extension.evaluation-requirements-route',
      status: 'available',
      constraints: ['A static pass emits claim-specific NOT_RUN requirements; it does not manufacture runtime proof.']
    },
    {
      id: 'simulation.extension.human-value-separate',
      status: 'available',
      constraints: ['Human comprehension and value remain routed to explicit voluntary human judgment.']
    },
    {
      id: 'simulation.extension.adoption.none',
      status: 'available',
      constraints: ['Static readiness grants no execution, install, adoption, graft, merge, CANON or Foundation authority.']
    },
    {
      id: 'simulation.extension.current-zero-candidate',
      status: 'available',
      constraints: ['The readiness receipt records zero candidate packages, assessments, plans and evaluations.']
    }
  ]
};

const readiness = {
  schema: 'axm.simulation-lab-extension-intake-readiness/v1',
  version: Intake.VERSION,
  generatedAt: '2026-08-19T13:50:00.000Z',
  status: 'TEST',
  state: 'INTAKE_READY_AWAITING_EXPERIMENTAL_BRANCH',
  current: {
    protectedRootCount: hostProfile.roots.length,
    supportedSubjectKindCount: hostProfile.subjectKinds.length,
    candidatePackageCount: 0,
    assessmentCount: 0,
    evaluationPlanCount: 0,
    evaluationCount: 0,
    liveHumanOutcomes: 0
  },
  bindings: {
    hostProfileDigest: hostProfile.profileDigest,
    exampleDeclarationDigest: Intake.sha256(exampleExtension),
    intakeCoreDigest: digestFile('shared/simulation-lab-extension-intake/simulation-lab-extension-intake.js'),
    returnGateCoreDigest: digestFile('tools/branch-module-return-gate/return-gate-core.js'),
    rootContractFiles: Object.entries(contractPaths).map(([id, relativePath]) => ({
      id,
      fileDigest: digestFile(relativePath)
    }))
  },
  truth: {
    hostProfileReady: true,
    extensionIntakeReady: true,
    candidatePackagePresent: false,
    candidateAssessed: false,
    runtimeEvaluated: false,
    humanBenefitEstablished: false,
    sharedGrowthClaimed: false,
    broadLearningClaimed: false,
    modelWeightTrainingClaimed: false,
    candidateCodeExecuted: false,
    canonicalStateTouched: false,
    automaticExecution: false,
    automaticWrite: false,
    automaticInstall: false,
    automaticPermissionGrant: false,
    automaticPromotion: false,
    automaticMerge: false,
    automaticCanon: false,
    foundationMutation: false
  },
  currentBestAction: 'WAIT_FOR_EXPLICIT_CANDIDATE',
  nextGate: 'EXPLICIT_CANDIDATE_PACKAGE_THEN_STATIC_ASSESSMENT',
  receiptDigest: null
};

const readinessPayload = JSON.parse(JSON.stringify(readiness));
delete readinessPayload.receiptDigest;
readiness.receiptDigest = Intake.sha256(readinessPayload);

const platformBrief = `# Platform branch build brief — simulation-lab extension\n\nStatus: \`EXPERIMENTAL INPUT REQUEST\`\n\nBuild one dependency-free adapter or specialist extension for the existing AXM\nsimulation lab. Do not build a replacement baseline root. The current protected\nhost profile is bound as:\n\n\`\`\`text\n${hostProfile.profileDigest}\n\`\`\`\n\nThe returned folder must contain exactly the files it declares, including:\n\n- \`axm-branch-return.json\`\n- \`axm-simulation-lab-extension.json\`\n- \`manifest.json\` with status \`EXPERIMENTAL\`\n- \`module.contract.json\` with status \`EXPERIMENTAL\`\n- one dependency-free entry file\n- one self-test\n\nUse a new module id distinct from \`portable-baseline-capsule\`,\n\`baseline-simulation-lab\`, and \`grounded-growth-challenger-lab\`. Declare\nrelation \`ADAPTER\`, or \`SPECIALIST_EXTENSION\` only when the sole subject is\n\`SPECIALIST_MASK\`. Map one or more of \`SOFTWARE_REPOSITORY\`,\n\`MIRROR_STATE\`, and \`SPECIALIST_MASK\` through exact contract handoffs.\nPreserve unsupported source fields by \`DIGEST_BOUND_REFERENCE\`; never claim\nthat translated data has the native source schema identity.\n\nRequired boundary state:\n\n\`\`\`json\n${JSON.stringify(exampleExtension.boundaries, null, 2)}\n\`\`\`\n\nThe candidate must require no network, external package, package manager, native\ncomponent, host command, absolute path, branch runtime, or permissions. It must\nremain \`installed: false\` and \`promoted: false\`. Static intake will not run\nthe candidate and cannot approve execution, adoption, merge, CANON, Foundation\nmutation, model training, or human value. A static pass only makes a later,\nexplicitly authorized challenger-evaluation plan possible.\n\n\`PLATFORM_EXTENSION_EXAMPLE.json\` is declaration-shape guidance only. It is\nnot a received candidate, package, assessment, installation, or endorsement.\n`;

writeJson('CURRENT_SIMULATION_LAB_HOST_PROFILE.json', hostProfile);
writeJson('PLATFORM_EXTENSION_EXAMPLE.json', exampleExtension);
writeJson('CAPABILITY_REQUIREMENTS.json', requirements);
writeJson('CAPABILITY_INVENTORY_BEFORE.json', before);
writeJson('CAPABILITY_INVENTORY_AFTER.json', after);
writeJson('CURRENT_EXTENSION_INTAKE_READINESS.json', readiness);
fs.writeFileSync(path.join(__dirname, 'PLATFORM_BRANCH_BUILD_BRIEF.md'), platformBrief);

console.log('PASS current simulation-lab extension intake readiness built');
console.log('roots=' + hostProfile.roots.length + ' subjects=' + hostProfile.subjectKinds.length);
console.log('candidatePackages=0 assessments=0 plans=0 evaluations=0');
