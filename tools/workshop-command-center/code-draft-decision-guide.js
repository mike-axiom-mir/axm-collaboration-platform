(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AXMCodeDraftDecisionGuide = api;
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var EXPLANATION_SCHEMA = 'axm.code-draft-plain-explanation/v1';

  function text(value) { return String(value == null ? '' : value).trim(); }
  function repairClass(item) { return text(item && item.sourceRef).split(':').pop(); }
  function moduleId(item) { return text(item && item.action && item.action.moduleId) || text(item && item.title) || 'this tool'; }

  function explanation(item) {
    var stored = item && item.action && item.action.reviewExplanation;
    if (stored && stored.schema === EXPLANATION_SCHEMA && stored.change && stored.risk && stored.proof && stored.recommendation) return stored;
    var repair = repairClass(item), moduleName = moduleId(item);
    if (repair === 'declare-empty-manifest-permissions-field') return {
      schema:EXPLANATION_SCHEMA,
      repairClass:repair,
      change:'Add an empty permissions list to ' + moduleName + "'s manifest. No executable code is changed.",
      benefit:'This replaces a missing field with an explicit claim that the tool requests no special permissions.',
      risk:'An empty list would be misleading if the tool actually needs a permission. This one-field check does not prove the whole tool is ready.',
      proof:'The clone made an isolated candidate and kept the real Workshop source unchanged.',
      recommendation:'Wait for the exact-copy technical check before making a human decision.',
      automaticApply:false
    };
    if (repair === 'declare-contracted-manifest-permissions') return {
      schema:EXPLANATION_SCHEMA,
      repairClass:repair,
      change:'Copy permissions already named by ' + moduleName + "'s contract into its manifest. No executable code is changed.",
      benefit:'The visible manifest would stop hiding permissions that the contract already declares.',
      risk:'Permission declarations affect trust. The contract and real behavior must agree before this is safe to keep.',
      proof:'The clone made an isolated candidate and kept the real Workshop source unchanged.',
      recommendation:'Wait for the exact-copy technical check before making a human decision.',
      automaticApply:false
    };
    return {
      schema:EXPLANATION_SCHEMA,
      repairClass:repair,
      change:'AXM cannot yet explain this technical change safely in normal language.',
      benefit:'Unknown until the exact candidate is inspected.',
      risk:'Unknown. An unexplained technical draft cannot receive informed human approval.',
      proof:'The candidate is preserved and the Workshop source is unchanged, but correctness is not proven.',
      recommendation:'Do not vote until a technical steward explains this exact candidate.',
      automaticApply:false
    };
  }

  function technicalReview(item) {
    var digest = text(item && item.artifactDigest).toLowerCase();
    return ((item && item.votes) || []).find(function (vote) {
      return vote && vote.actorKind === 'machine' && text(vote.artifactDigest).toLowerCase() === digest && text(vote.note).length >= 20;
    }) || null;
  }

  function holdReason(item, plain) {
    var technical = technicalReview(item), note = text(technical && technical.note).toLowerCase();
    if (plain.repairClass === 'declare-empty-manifest-permissions-field' && note.indexOf('contract file is not declared') >= 0) {
      return 'AXM cannot prove that this tool truly needs zero permissions because the tool has no declared contract to check against.';
    }
    if (plain.repairClass === 'declare-empty-manifest-permissions-field') {
      return 'AXM could not prove that an empty permissions list is truthful for this exact tool.';
    }
    if (plain.repairClass === 'declare-contracted-manifest-permissions') {
      return 'AXM found that the contract, manifest, or observed module behavior still does not agree.';
    }
    return 'The machine check found a blocker in this exact copy. It must be repaired or replaced before a human decision would help.';
  }

  function guide(item) {
    var plain = explanation(item), technical = technicalReview(item);
    var base = {
      schema:'axm.code-draft-human-decision-guide/v1',
      explanation:plain,
      technicalReview:technical,
      automaticApply:false,
      installsCode:false,
      changesWorkshopSource:false
    };
    if (!technical) return Object.assign(base, {
      phase:'CHECK_FIRST', tone:'waiting', badge:'WAITING ON AXM',
      headline:'No decision is needed from you yet.',
      why:'AXM must check this exact candidate against its receipt and module contract first.',
      recommendation:'WAIT - DO NOT VOTE YET',
      decisionPrompt:'The technical steward owns the next step.',
      humanDecision:false,
      openExplanation:false
    });
    if (technical.verdict !== 'APPROVE') return Object.assign(base, {
      phase:'REPAIR', tone:'repair', badge:'PARKED FOR REPAIR',
      headline:'This copy failed its technical check.',
      why:holdReason(item, plain),
      recommendation:'LEAVE THIS COPY FOR REPAIR',
      decisionPrompt:'You do not need to judge or vote on this copy.',
      humanDecision:false,
      openExplanation:false
    });
    return Object.assign(base, {
      phase:'READY', tone:'ready', badge:'READY FOR MIKE',
      headline:'AXM checked the code. You only decide whether the fix is worth keeping.',
      why:plain.benefit + ' The exact-copy technical check passed.',
      recommendation:'AXM RECOMMENDS KEEPING THIS CANDIDATE FOR REVIEW',
      decisionPrompt:'Keep this verified candidate for later installation, or discard this exact copy. Your choice still installs nothing.',
      humanDecision:true,
      openExplanation:true
    });
  }

  return Object.freeze({ EXPLANATION_SCHEMA:EXPLANATION_SCHEMA, explanation:explanation, technicalReview:technicalReview, guide:guide });
}));
