(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') root.AXMReasoningShell = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const FORMAT = 1;
  const CONDITIONS = new Set(['shell-on', 'shell-off']);

  function requireSession(input) {
    const session = input && input.session ? input.session : input;
    if (!session || session.format !== FORMAT || !CONDITIONS.has(session.condition) ||
        !Array.isArray(session.steps) || !Array.isArray(session.checkpoints) || !Array.isArray(session.routes)) {
      throw new Error('not a Reasoning Shell format:1 session export');
    }
    if (session.routes.some(route => !validRoute(route))) throw new Error('session contains an invalid rejection route');
    return session;
  }

  function validRoute(route) {
    return !!route && Array.isArray(route.rejected) && route.rejected.length > 0 &&
      route.rejected.every(item => item && typeof item.rejection_reason === 'string' && item.rejection_reason.trim().length > 0);
  }

  function createSession(profileId, condition, task, startedTs) {
    if (!CONDITIONS.has(condition)) throw new Error('condition must be shell-on or shell-off');
    if (!String(task || '').trim()) throw new Error('task is required');
    return {
      format: FORMAT,
      profileId: String(profileId || ''),
      condition,
      task: String(task).trim(),
      steps: [],
      checkpoints: [],
      routes: [],
      startedTs: Number(startedTs || Date.now())
    };
  }

  function buildStepPrompt(session, profile) {
    const current = requireSession(session);
    const completed = current.steps.length
      ? current.steps.map((step, index) => (index + 1) + '. ' + step.summary).join(' | ')
      : 'none';
    if (current.condition === 'shell-off') {
      return [
        'TASK: ' + current.task,
        'COMPLETED STEPS SO FAR: ' + completed,
        'Now do ONLY the next single step.',
        'End with exactly: CLAIM: <one sentence> | PROOF: source/test/observation/none | UNCERTAINTY: low/medium/high'
      ].join('\n');
    }
    if (!profile || !String(profile.systemFrame || '').trim() || !String(profile.stepRule || '').trim() || !Array.isArray(profile.proofLabels)) {
      throw new Error('selected shell profile is incomplete');
    }
    return [
      profile.systemFrame,
      'TASK: ' + current.task,
      'COMPLETED STEPS SO FAR: ' + completed,
      current.repairContext ? 'REPAIR CONTEXT (your last step was judged wrong): ' + current.repairContext : '',
      'Now do ONLY the next single step. ' + profile.stepRule,
      'End with exactly: CLAIM: <one sentence> | PROOF: ' + profile.proofLabels.join('/') + ' | UNCERTAINTY: low/medium/high'
    ].filter(Boolean).join('\n');
  }

  function makeCheckpoint(text, step, verdict, ts) {
    if (!['ok', 'rejected'].includes(verdict)) throw new Error('checkpoint verdict is unsupported');
    const value = String(text || '');
    const claim = (value.match(/CLAIM:\s*([^|]+)/) || [])[1] || '(unlabeled - profile rule violated, noted)';
    const proof = (value.match(/PROOF:\s*([^|]+)/) || [])[1] || 'unlabeled';
    const uncertainty = (value.match(/UNCERTAINTY:\s*(\w+)/) || [])[1] || 'unlabeled';
    return {
      step: Number(step),
      claim: claim.trim(),
      proofLabel: proof.trim(),
      uncertainty: uncertainty.trim(),
      verdict,
      ts: Number(ts || Date.now())
    };
  }

  function makeRepairRoute(text, step, reason) {
    const route = {
      step: Number(step),
      chosen: 'repair',
      rejected: [{ alt: String(text || '').slice(0, 120), rejection_reason: String(reason || '').trim() }]
    };
    if (!validRoute(route)) throw new Error('rejection_reason may not be empty');
    return route;
  }

  function buildAfterAction(session) {
    const current = requireSession(session);
    const repairs = current.routes.map(route => route.rejected[0].rejection_reason);
    const afterAction = {
      format: FORMAT,
      sessionSummary: current.steps.length + ' accepted steps, ' + current.routes.length + ' repairs, profile ' + current.profileId,
      fakeDoneSuspected: current.checkpoints.some(checkpoint => String(checkpoint.proofLabel || '').includes('unlabeled')),
      contextLossSuspected: current.routes.length > 2,
      repairs,
      tweakProposal: null
    };
    if (repairs.length) {
      afterAction.tweakProposal = {
        format: FORMAT,
        profileId: current.profileId,
        status: 'proposal',
        suggestedChange: 'Add to stepRule: avoid the repaired failure patterns (' + repairs.slice(0, 2).join('; ') + ')',
        evidence: repairs.length + ' repair route(s) this session'
      };
    }
    return afterAction;
  }

  function sessionMetrics(input) {
    const session = requireSession(input);
    return {
      condition: session.condition,
      accepted: session.steps.length,
      repairs: session.routes.length,
      unlabeled: session.checkpoints.filter(checkpoint => !checkpoint.proofLabel || checkpoint.proofLabel === 'unlabeled').length,
      checkpoints: session.checkpoints.length
    };
  }

  function compareExports(shellOnExport, shellOffExport) {
    const on = sessionMetrics(shellOnExport);
    const off = sessionMetrics(shellOffExport);
    if (on.condition !== 'shell-on' || off.condition !== 'shell-off') {
      throw new Error('first export must be shell-on and second export must be shell-off');
    }
    return 'Recorded comparison only - shell-on: ' + on.accepted + ' accepted, ' + on.repairs + ' repairs, ' + on.unlabeled + '/' + on.checkpoints + ' unlabeled proofs; '
      + 'shell-off: ' + off.accepted + ' accepted, ' + off.repairs + ' repairs, ' + off.unlabeled + '/' + off.checkpoints + ' unlabeled proofs.';
  }

  return {
    FORMAT,
    validRoute,
    createSession,
    buildStepPrompt,
    makeCheckpoint,
    makeRepairRoute,
    buildAfterAction,
    sessionMetrics,
    compareExports
  };
});
