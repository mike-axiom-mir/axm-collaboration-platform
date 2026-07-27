export const ACTION_PACKET_SCHEMA = 'axm.repairbuddy.warning-action/v1';

export const DESTINATIONS = Object.freeze({
  'module-contract-workbench': {
    moduleId: 'module-contract-workbench',
    artifactKind: 'axm.module-lifecycle-repair-request/v1',
    route: '/tools/module-contract-workbench/'
  },
  'browser-lan-hardware-qa-lab': {
    moduleId: 'browser-lan-hardware-qa-lab',
    artifactKind: 'axm.qa-evidence-request/v1',
    route: '/tools/browser-lan-hardware-qa-lab/'
  },
  'automated-playtester-scenario-agent': {
    moduleId: 'automated-playtester-scenario-agent',
    artifactKind: 'axm.playtest-evidence-request/v1',
    route: '/tools/automated-playtester-scenario-agent/'
  },
  'platform-ai-plus-human-review': {
    moduleId: 'ai-team',
    artifactKind: 'axm.ai-repair-design-request/v1',
    route: '/tools/ai-team/'
  }
});

function destinationFor(item) {
  const destination = DESTINATIONS[item?.repair?.owner];
  if (!destination) throw new Error('warning owner has no declared action destination');
  const query = new URLSearchParams({ warning: item.id, subject: item.subject.id });
  if (destination.moduleId === 'module-contract-workbench') query.set('module', item.subject.id);
  return { ...destination, route: destination.route + '?' + query.toString() };
}

function humanActions(item) {
  if (item.classification === 'EVIDENCE_REQUIRED') return [
    'Run the named real interaction or device journey.',
    'Review the receipt and confirm that it covers this exact warning and subject.',
    'Allow a source-state change only after the evidence passes the original verifier.'
  ];
  if (item.classification === 'REPLAYABLE') return [
    'Review the frozen recipe preview and its exact preconditions.',
    'Explicitly authorize apply only when the preview matches the intended module.',
    'Review the post-apply verifier receipt and any rollback result.'
  ];
  return [
    'Review the proposed design against the module’s actual behavior and boundaries.',
    'Approve only a scoped patch or governed staging candidate.',
    'Keep the warning open until the original verifier passes.'
  ];
}

function aiActions(item) {
  if (item.classification === 'EVIDENCE_REQUIRED') return [
    'Inspect the declared journey and evidence contract.',
    'Prepare a bounded test plan or run only the destination module’s permitted local journey.',
    'Return observed evidence, failures, and remaining unknowns without changing pending to verified.'
  ];
  if (item.classification === 'REPLAYABLE') return [
    'Inspect the exact recipe and observed verifier failures.',
    'Produce a preview and wait for explicit human apply authority.',
    'Run the named verifier after apply and preserve rollback truth.'
  ];
  return [
    'Inspect only the named surface and its directly relevant contract or implementation.',
    'Propose the smallest compatible repair with explicit assumptions and tradeoffs.',
    'Run the named verifier and return unresolved uncertainty separately from completed work.'
  ];
}

export function buildWarningActionPacket(item, options = {}) {
  if (!item || !item.id || !item.subject?.id || !item.repair?.owner) throw new Error('complete warning item required');
  const destination = destinationFor(item);
  return {
    schema: ACTION_PACKET_SCHEMA,
    id: 'action-' + item.id,
    state: 'REVIEW_REQUIRED',
    artifactKind: destination.artifactKind,
    createdAt: options.createdAt || new Date().toISOString(),
    source: {
      moduleId: 'repairbuddy',
      warningId: item.id,
      warningSource: item.source,
      surface: item.surface,
      code: item.code,
      message: item.message
    },
    destination: {
      moduleId: destination.moduleId,
      route: destination.route,
      acceptedAs: destination.artifactKind
    },
    orientation: {
      purpose: 'Resolve one verifier warning without weakening or bypassing its source check.',
      subject: { ...item.subject },
      currentState: 'OPEN',
      classification: item.classification,
      knownEvidence: [item.source, item.surface].filter(Boolean),
      uncertainty: item.classification === 'EVIDENCE_REQUIRED'
        ? ['The required real interaction or device evidence is not yet accepted.']
        : item.classification === 'REPLAYABLE'
          ? ['The frozen recipe still requires exact preconditions and human apply authority.']
          : ['The correct semantic repair cannot be inferred safely from the warning alone.'],
      permittedUpdateScope: [item.surface].filter(Boolean),
      stopOrEscalateWhen: [
        'The required change exceeds the named surface or destination module authority.',
        'The observed implementation contradicts the warning packet.',
        'The source verifier cannot prove the requested completion.'
      ]
    },
    seats: {
      human: {
        authority: 'decision-owner',
        actions: humanActions(item),
        approvalRequiredFor: ['apply', 'stage', 'mark-verified', 'permission-change']
      },
      ai: {
        authority: 'bounded-proposal-and-verification',
        actions: aiActions(item),
        refuses: [
          'suppress-or-retire-the-source-warning',
          'invent-evidence-or-completion',
          'expand-scope-or-permissions',
          'automatic-apply-or-open',
          'rewrite-unrelated-modules'
        ]
      }
    },
    action: {
      next: item.repair.next,
      verifier: item.repair.verifyCommand,
      recipeId: item.repair.recipeId || null
    },
    truth: {
      warningStillOpen: true,
      artifactDataCopied: false,
      automaticOpen: false,
      automaticApply: false,
      verifierSuppressed: false,
      humanApprovalInferred: false
    }
  };
}

export function validateWarningActionPacket(packet) {
  const errors = [];
  if (!packet || packet.schema !== ACTION_PACKET_SCHEMA) errors.push('action packet schema required');
  if (!packet?.id || packet.state !== 'REVIEW_REQUIRED') errors.push('review-required packet identity required');
  if (!packet?.source?.warningId || !packet?.source?.surface) errors.push('warning source and surface required');
  if (!packet?.destination?.moduleId || !packet?.destination?.acceptedAs || !packet?.destination?.route) errors.push('declared destination required');
  if (!packet?.orientation?.purpose || !Array.isArray(packet?.orientation?.permittedUpdateScope)) errors.push('orientation scope required');
  if (!Array.isArray(packet?.seats?.human?.actions) || !Array.isArray(packet?.seats?.ai?.actions)) errors.push('human and AI seats required');
  if (!packet?.action?.verifier) errors.push('source verifier required');
  if (!packet?.truth || packet.truth.warningStillOpen !== true || packet.truth.automaticOpen !== false || packet.truth.automaticApply !== false || packet.truth.verifierSuppressed !== false || packet.truth.humanApprovalInferred !== false) errors.push('truth boundary required');
  return { pass: errors.length === 0, errors };
}

export function humanChecklist(packet) {
  const checked = validateWarningActionPacket(packet);
  if (!checked.pass) throw new Error(checked.errors.join('; '));
  return [
    'RepairBuddy human checklist',
    'Warning: ' + packet.source.warningId + ' · ' + packet.source.code,
    'Subject: ' + packet.orientation.subject.id,
    'Destination: ' + packet.destination.moduleId,
    '',
    ...packet.seats.human.actions.map((action, index) => (index + 1) + '. ' + action),
    '',
    'Verify: ' + packet.action.verifier,
    'The warning remains open until that verifier passes.'
  ].join('\n');
}

export function aiPrompt(packet) {
  const checked = validateWarningActionPacket(packet);
  if (!checked.pass) throw new Error(checked.errors.join('; '));
  return [
    'AXM bounded warning action packet',
    '',
    'Work only within the packet’s permittedUpdateScope. Preserve human authority and the original verifier. Do not treat a plan, mock, missing device test, or self-attestation as completion.',
    '',
    'Return: (1) observations, (2) proposed or implemented bounded change, (3) verifier evidence, (4) unresolved uncertainty, and (5) any authority or capability still missing.',
    '',
    JSON.stringify(packet, null, 2)
  ].join('\n');
}
