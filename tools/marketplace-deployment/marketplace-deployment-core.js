(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AXMMarketplaceDeploymentCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var FORMAT = 'axm.marketplace-deployment.project/v1';
  var MODES = [
    { id: 'home', label: 'Distribution map' },
    { id: 'catalog', label: 'Catalog' },
    { id: 'rights', label: 'Rights & licensing' },
    { id: 'plugins', label: 'Plugins & extensions' },
    { id: 'deploy', label: 'Deployment plans' },
    { id: 'gallery', label: 'Public gallery drafts' },
    { id: 'updates', label: 'Update channels' },
    { id: 'reviews', label: 'Review seats' },
    { id: 'publish', label: 'Publish foundation' }
  ];
  var LISTING_KINDS = ['application', 'game', 'plugin', 'extension', 'asset-pack', 'course', 'service', 'other'];
  var ACCESS_POLICIES = ['free-open', 'free-personal', 'donation', 'paid-proposal', 'private'];
  var LICENSES = ['UNDECLARED', 'MIT', 'Apache-2.0', 'BSD-3-Clause', 'GPL-3.0', 'AGPL-3.0', 'CC0-1.0', 'CC-BY-4.0', 'CC-BY-SA-4.0', 'Proprietary', 'Custom'];
  var TARGETS = ['download-archive', 'local-network', 'static-host', 'self-host'];
  var CHANNELS = ['stable', 'beta', 'experimental'];

  function now() { return new Date().toISOString(); }
  function uid(prefix) { return prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8); }
  function text(value, max) { return String(value == null ? '' : value).trim().slice(0, max || 500); }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function array(value) { return Array.isArray(value) ? value : []; }
  function enumValue(value, allowed, fallback) { return allowed.indexOf(value) >= 0 ? value : fallback; }
  function receipt(project, type, statement, actor, evidence) {
    var item = { id: uid('receipt'), type: text(type, 80), statement: text(statement, 500), actor: text(actor || 'local-steward', 80), evidence: array(evidence).map(function (x) { return text(x, 300); }).filter(Boolean).slice(0, 20), at: now() };
    project.receipts.push(item);
    return item;
  }
  function baseChannels() {
    return CHANNELS.map(function (id) { return { id: id, releases: [], automaticInstall: false, description: id === 'stable' ? 'Reviewed releases only.' : id === 'beta' ? 'Early reviewed candidates.' : 'Explicitly experimental packages.' }; });
  }
  function records(value) {
    return array(value).filter(function (item) { return item && typeof item === 'object' && !Array.isArray(item); });
  }
  function rightsFindings(license, provenance, dependencies, rightsConfirmed) {
    var findings = [];
    if (license === 'UNDECLARED') findings.push('License is undeclared.');
    if (!provenance) findings.push('Provenance is missing.');
    if (!dependencies) findings.push('Dependency and third-party disclosure is missing.');
    if (!rightsConfirmed) findings.push('Distribution rights were not explicitly confirmed.');
    return findings;
  }
  function deploymentSteps(target) {
    return [
      'Create a verified package through Publish & Library.',
      'Re-run hashes, secret scan, rights manifest and dependency inventory.',
      target === 'local-network' ? 'Bind the reviewed service to the chosen private LAN interface only.' : target === 'self-host' ? 'Provision the user-owned host without embedding credentials in the package.' : target === 'static-host' ? 'Upload only the reviewed static output through a separately approved host adapter.' : 'Deliver the reviewed archive without executing it.',
      'Run health, route and restore checks against the deployed candidate.',
      'Keep the previous verified package available for rollback.',
      'Human confirms whether the live/public transition may occur.'
    ];
  }
  function createProject(input) {
    input = input || {};
    return {
      schema: FORMAT,
      id: text(input.id, 80) || uid('distribution'),
      title: text(input.title, 120) || 'Marketplace & Deployment',
      governance: enumValue(input.governance, ['solo', 'dual'], 'dual'),
      createdAt: now(), updatedAt: now(), settings: { mode: 'home' },
      listings: [], rightsReviews: [], pluginPackages: [], deploymentPlans: [], galleryEntries: [], updateChannels: baseChannels(), reviews: [], receipts: []
    };
  }
  function normalize(input) {
    if (!input || input.schema !== FORMAT) return createProject();
    var project = createProject({ id: input.id, title: input.title, governance: input.governance });
    project.createdAt = text(input.createdAt, 40) || project.createdAt;
    project.updatedAt = text(input.updatedAt, 40) || project.updatedAt;
    project.settings.mode = MODES.some(function (m) { return m.id === (input.settings && input.settings.mode); }) ? input.settings.mode : 'home';
    project.listings = records(input.listings).map(function (listing) {
      return {
        id: text(listing.id, 120) || uid('listing'), name: text(listing.name, 120), version: text(listing.version, 40),
        kind: enumValue(listing.kind, LISTING_KINDS, 'other'), accessPolicy: enumValue(listing.accessPolicy, ACCESS_POLICIES, 'free-open'),
        audience: text(listing.audience, 160) || 'Any intelligence able to use the declared format', summary: text(listing.summary, 800),
        sourceRoute: text(listing.sourceRoute, 300), state: 'DRAFT', createdAt: text(listing.createdAt, 40) || now(),
        updatedAt: text(listing.updatedAt, 40) || now(), rightsState: 'UNREVIEWED'
      };
    }).filter(function (listing) { return listing.name && listing.version && listing.summary; });
    project.rightsReviews = records(input.rightsReviews).filter(function (review) { return findListing(project, review.listingId); }).map(function (review) {
      var license = enumValue(review.license, LICENSES, 'UNDECLARED');
      var provenance = text(review.provenance, 1600), dependencies = text(review.dependencies, 1600), rightsConfirmed = review.rightsConfirmed === true;
      var findings = rightsFindings(license, provenance, dependencies, rightsConfirmed);
      return {
        id: text(review.id, 120) || uid('rights'), listingId: text(review.listingId, 120), license: license,
        provenance: provenance, dependencies: dependencies, rightsConfirmed: rightsConfirmed,
        verdict: findings.length ? 'HOLD_REPAIR' : 'PASS_FOR_REVIEW', findings: findings,
        legalAuthority: 'NONE', at: text(review.at, 40) || now(), actor: text(review.actor || 'local-steward', 80)
      };
    });
    project.reviews = records(input.reviews).filter(function (review) { return findListing(project, review.listingId) && text(review.reviewer, 100) && text(review.note, 1200); }).map(function (review) {
      return {
        id: text(review.id, 120) || uid('review'), listingId: text(review.listingId, 120), reviewer: text(review.reviewer, 100),
        seatKind: enumValue(review.seatKind, ['human', 'machine'], 'human'), scope: enumValue(review.scope, ['technical', 'experience', 'both'], 'both'),
        verdict: enumValue(review.verdict, ['UPVOTE', 'HOLD', 'REPAIR'], 'HOLD'), note: text(review.note, 1200), at: text(review.at, 40) || now()
      };
    });
    project.listings.forEach(function (listing) {
      var rights = latestRights(project, listing.id);
      listing.rightsState = rights ? rights.verdict : 'UNREVIEWED';
      listing.state = listingReadiness(project, listing.id).ready ? 'READY_FOR_EXPORT' : 'DRAFT';
    });
    project.pluginPackages = records(input.pluginPackages).filter(function (proposal) { return findListing(project, proposal.listingId); }).map(function (proposal) {
      var listing = findListing(project, proposal.listingId), entry = text(proposal.entry, 260), compatibility = text(proposal.compatibility, 800), permissions = text(proposal.permissions, 800), findings = [];
      if (['plugin', 'extension'].indexOf(listing.kind) < 0) findings.push('Listing kind is not plugin or extension.');
      if (!entry) findings.push('Package entry is missing.');
      if (!compatibility) findings.push('Host compatibility is undeclared.');
      if (!permissions) findings.push('Permission surface is undeclared.');
      return {
        schema: 'axm.plugin-distribution-proposal/v1', id: text(proposal.id, 120) || uid('plugin-package'), listingId: listing.id,
        name: listing.name, version: listing.version, entry: entry, compatibility: compatibility, permissions: permissions,
        state: findings.length ? 'HOLD_REPAIR' : 'PROPOSAL_READY', findings: findings, installAuthority: 'NONE', at: text(proposal.at, 40) || now()
      };
    });
    project.deploymentPlans = records(input.deploymentPlans).filter(function (plan) { return findListing(project, plan.listingId); }).map(function (plan) {
      var listing = findListing(project, plan.listingId), target = enumValue(plan.target, TARGETS, 'download-archive');
      var requirements = text(plan.requirements, 1400), rollback = text(plan.rollback, 1000), readiness = listingReadiness(project, listing.id), blockers = [];
      if (listing.state !== 'READY_FOR_EXPORT' || !readiness.ready) blockers = readiness.reasons.length ? readiness.reasons.slice() : ['Listing has not passed the export gate.'];
      if (!requirements) blockers.push('Runtime/hosting requirements are missing.');
      if (!rollback) blockers.push('Rollback procedure is missing.');
      return {
        schema: 'axm.deployment-plan/v1', id: text(plan.id, 120) || uid('deploy'), listingId: listing.id, target: target,
        requirements: requirements, rollback: rollback, state: blockers.length ? 'HOLD_REPAIR' : 'PROPOSAL_READY',
        blockers: blockers, steps: deploymentSteps(target), executionAuthority: 'NONE', networkAction: 'NONE', at: text(plan.at, 40) || now()
      };
    });
    project.galleryEntries = records(input.galleryEntries).filter(function (entry) { return findListing(project, entry.listingId) && text(entry.caption, 700); }).map(function (entry) {
      return {
        id: text(entry.id, 120) || uid('gallery'), listingId: text(entry.listingId, 120), caption: text(entry.caption, 700),
        mediaRef: text(entry.mediaRef, 300), visibility: enumValue(entry.visibility, ['private-preview', 'public-proposal'], 'private-preview'),
        state: 'DRAFT', at: text(entry.at, 40) || now()
      };
    });
    project.updateChannels = baseChannels();
    records(input.updateChannels).forEach(function (sourceChannel) {
      if (CHANNELS.indexOf(sourceChannel.id) < 0) return;
      var targetChannel = project.updateChannels.find(function (channel) { return channel.id === sourceChannel.id; });
      targetChannel.releases = records(sourceChannel.releases).filter(function (update) { return findListing(project, update.listingId); }).map(function (update) {
        return {
          id: text(update.id, 120) || uid('update'), listingId: text(update.listingId, 120), version: text(update.version, 40),
          changelog: text(update.changelog, 1400), rollbackVersion: text(update.rollbackVersion, 40), state: 'DRAFT',
          automaticInstall: false, at: text(update.at, 40) || now()
        };
      }).filter(function (update) { return update.version && update.changelog && update.rollbackVersion; });
    });
    project.receipts = clone(records(input.receipts));
    return project;
  }
  function findListing(project, id) { return project.listings.find(function (item) { return item.id === id; }) || null; }
  function addListing(project, input, actor) {
    input = input || {};
    var name = text(input.name, 120), version = text(input.version, 40), summary = text(input.summary, 800);
    if (!name || !version || !summary) return { ok: false, error: 'Name, version and summary are required.' };
    var listing = {
      id: uid('listing'), name: name, version: version,
      kind: enumValue(input.kind, LISTING_KINDS, 'other'),
      accessPolicy: enumValue(input.accessPolicy, ACCESS_POLICIES, 'free-open'),
      audience: text(input.audience, 160) || 'Any intelligence able to use the declared format',
      summary: summary, sourceRoute: text(input.sourceRoute, 300),
      state: 'DRAFT', createdAt: now(), updatedAt: now(), rightsState: 'UNREVIEWED'
    };
    project.listings.push(listing);
    receipt(project, 'listing.created', 'Draft listing created for ' + name + ' ' + version, actor, ['No publication or upload occurred']);
    project.updatedAt = now();
    return { ok: true, listing: clone(listing) };
  }
  function latestRights(project, listingId) {
    return project.rightsReviews.filter(function (r) { return r.listingId === listingId; }).slice(-1)[0] || null;
  }
  function reviewRights(project, input, actor) {
    input = input || {};
    var listing = findListing(project, input.listingId);
    if (!listing) return { ok: false, error: 'Choose a real listing.' };
    var license = enumValue(input.license, LICENSES, 'UNDECLARED');
    var provenance = text(input.provenance, 1600), dependencies = text(input.dependencies, 1600), rightsConfirmed = input.rightsConfirmed === true;
    var findings = rightsFindings(license, provenance, dependencies, rightsConfirmed);
    var review = {
      id: uid('rights'), listingId: listing.id, license: license, provenance: provenance,
      dependencies: dependencies, rightsConfirmed: rightsConfirmed,
      verdict: findings.length ? 'HOLD_REPAIR' : 'PASS_FOR_REVIEW', findings: findings,
      legalAuthority: 'NONE', at: now(), actor: text(actor || 'local-steward', 80)
    };
    project.rightsReviews.push(review);
    listing.rightsState = review.verdict;
    listing.updatedAt = now();
    receipt(project, 'rights.reviewed', listing.name + ' rights gate: ' + review.verdict, actor, findings.length ? findings : [license + ' declared', 'Provenance and dependencies recorded']);
    project.updatedAt = now();
    return { ok: true, review: clone(review) };
  }
  function addReview(project, input) {
    input = input || {};
    var listing = findListing(project, input.listingId);
    if (!listing) return { ok: false, error: 'Choose a real listing.' };
    var reviewer = text(input.reviewer, 100), note = text(input.note, 1200);
    if (!reviewer || !note) return { ok: false, error: 'Reviewer identity and reasoning are required.' };
    var review = {
      id: uid('review'), listingId: listing.id, reviewer: reviewer,
      seatKind: enumValue(input.seatKind, ['human', 'machine'], 'human'),
      scope: enumValue(input.scope, ['technical', 'experience', 'both'], 'both'),
      verdict: enumValue(input.verdict, ['UPVOTE', 'HOLD', 'REPAIR'], 'HOLD'),
      note: note, at: now()
    };
    project.reviews.push(review);
    receipt(project, 'review.recorded', reviewer + ' recorded ' + review.verdict + ' for ' + listing.name, reviewer, [review.scope + ' perspective', note]);
    project.updatedAt = now();
    return { ok: true, review: clone(review) };
  }
  function listingReadiness(project, listingId) {
    var listing = findListing(project, listingId);
    if (!listing) return { ready: false, state: 'MISSING', reasons: ['Listing not found.'] };
    var rights = latestRights(project, listing.id);
    var reviews = project.reviews.filter(function (r) { return r.listingId === listing.id; });
    var active = project.governance === 'dual' ? ['human', 'machine'].map(function (seatKind) {
      return reviews.filter(function (review) { return review.seatKind === seatKind; }).slice(-1)[0] || null;
    }).filter(Boolean) : reviews.slice(-1);
    var positive = active.filter(function (r) { return r.verdict === 'UPVOTE'; });
    var reasons = [];
    if (!rights || rights.verdict !== 'PASS_FOR_REVIEW') reasons.push('Rights and dependency gate has not passed.');
    if (project.governance === 'dual') {
      if (!positive.some(function (r) { return r.seatKind === 'human'; })) reasons.push('Human review seat has not upvoted.');
      if (!positive.some(function (r) { return r.seatKind === 'machine'; })) reasons.push('Machine review seat has not upvoted.');
    } else if (!positive.length) reasons.push('No steward review has upvoted.');
    if (active.some(function (r) { return r.verdict === 'HOLD' || r.verdict === 'REPAIR'; })) reasons.push('An active hold or repair review remains open.');
    return { ready: reasons.length === 0, state: reasons.length ? 'HOLD_REPAIR' : 'READY_FOR_EXPORT', reasons: reasons, rights: rights ? rights.verdict : 'UNREVIEWED', governance: project.governance, reviews: reviews.length, activeReviews: active.length };
  }
  function markReviewReady(project, listingId, actor) {
    var listing = findListing(project, listingId), ready = listingReadiness(project, listingId);
    if (!listing) return { ok: false, error: 'Listing not found.' };
    if (!ready.ready) return { ok: false, error: ready.reasons.join(' ') };
    listing.state = 'READY_FOR_EXPORT'; listing.updatedAt = now();
    receipt(project, 'listing.review-ready', listing.name + ' passed the local export gate', actor, ['Still not uploaded or publicly published']);
    project.updatedAt = now();
    return { ok: true, listing: clone(listing), readiness: ready };
  }
  function createPluginPackage(project, input, actor) {
    input = input || {};
    var listing = findListing(project, input.listingId);
    if (!listing) return { ok: false, error: 'Choose a real listing.' };
    var entry = text(input.entry, 260), compatibility = text(input.compatibility, 800), permissions = text(input.permissions, 800);
    var findings = [];
    if (['plugin', 'extension'].indexOf(listing.kind) < 0) findings.push('Listing kind is not plugin or extension.');
    if (!entry) findings.push('Package entry is missing.');
    if (!compatibility) findings.push('Host compatibility is undeclared.');
    if (!permissions) findings.push('Permission surface is undeclared.');
    var proposal = {
      schema: 'axm.plugin-distribution-proposal/v1', id: uid('plugin-package'), listingId: listing.id,
      name: listing.name, version: listing.version, entry: entry, compatibility: compatibility,
      permissions: permissions, state: findings.length ? 'HOLD_REPAIR' : 'PROPOSAL_READY',
      findings: findings, installAuthority: 'NONE', at: now()
    };
    project.pluginPackages.push(proposal);
    receipt(project, 'plugin.proposed', listing.name + ' plugin package: ' + proposal.state, actor, findings.length ? findings : ['Compatibility and permissions declared', 'No installation occurred']);
    project.updatedAt = now();
    return { ok: true, proposal: clone(proposal) };
  }
  function createDeploymentPlan(project, input, actor) {
    input = input || {};
    var listing = findListing(project, input.listingId);
    if (!listing) return { ok: false, error: 'Choose a real listing.' };
    var target = enumValue(input.target, TARGETS, 'download-archive');
    var requirements = text(input.requirements, 1400), rollback = text(input.rollback, 1000);
    var readiness = listingReadiness(project, listing.id), blockers = [];
    if (listing.state !== 'READY_FOR_EXPORT' || !readiness.ready) blockers = readiness.reasons.length ? readiness.reasons.slice() : ['Listing has not passed the export gate.'];
    if (!requirements) blockers.push('Runtime/hosting requirements are missing.');
    if (!rollback) blockers.push('Rollback procedure is missing.');
    var steps = deploymentSteps(target);
    var plan = {
      schema: 'axm.deployment-plan/v1', id: uid('deploy'), listingId: listing.id, target: target,
      requirements: requirements, rollback: rollback, state: blockers.length ? 'HOLD_REPAIR' : 'PROPOSAL_READY',
      blockers: blockers, steps: steps, executionAuthority: 'NONE', networkAction: 'NONE', at: now()
    };
    project.deploymentPlans.push(plan);
    receipt(project, 'deployment.planned', listing.name + ' to ' + target + ': ' + plan.state, actor, blockers.length ? blockers : ['Plan only', 'No network action occurred']);
    project.updatedAt = now();
    return { ok: true, plan: clone(plan) };
  }
  function addGalleryEntry(project, input, actor) {
    input = input || {};
    var listing = findListing(project, input.listingId), caption = text(input.caption, 700);
    if (!listing || !caption) return { ok: false, error: 'Choose a listing and write a caption.' };
    var item = { id: uid('gallery'), listingId: listing.id, caption: caption, mediaRef: text(input.mediaRef, 300), visibility: enumValue(input.visibility, ['private-preview', 'public-proposal'], 'private-preview'), state: 'DRAFT', at: now() };
    project.galleryEntries.push(item);
    receipt(project, 'gallery.drafted', 'Gallery draft created for ' + listing.name, actor, [item.visibility, 'No external publication occurred']);
    project.updatedAt = now();
    return { ok: true, entry: clone(item) };
  }
  function addUpdate(project, input, actor) {
    input = input || {};
    var listing = findListing(project, input.listingId), channelId = enumValue(input.channel, CHANNELS, 'experimental');
    var version = text(input.version, 40), changelog = text(input.changelog, 1400), rollbackVersion = text(input.rollbackVersion, 40);
    if (!listing || !version || !changelog || !rollbackVersion) return { ok: false, error: 'Listing, version, changelog and rollback version are required.' };
    var update = { id: uid('update'), listingId: listing.id, version: version, changelog: changelog, rollbackVersion: rollbackVersion, state: 'DRAFT', automaticInstall: false, at: now() };
    var channel = project.updateChannels.find(function (c) { return c.id === channelId; });
    channel.releases.push(update);
    receipt(project, 'update.drafted', listing.name + ' ' + version + ' added to ' + channelId + ' draft channel', actor, ['Automatic installation remains off', 'Rollback ' + rollbackVersion]);
    project.updatedAt = now();
    return { ok: true, update: clone(update), channel: channelId };
  }
  function summary(project) {
    project = normalize(project);
    return {
      listings: project.listings.length,
      ready: project.listings.filter(function (l) { return l.state === 'READY_FOR_EXPORT'; }).length,
      held: project.listings.filter(function (l) { return listingReadiness(project, l.id).state === 'HOLD_REPAIR'; }).length,
      plans: project.deploymentPlans.length,
      gallery: project.galleryEntries.length,
      updates: project.updateChannels.reduce(function (n, c) { return n + c.releases.length; }, 0),
      receipts: project.receipts.length,
      governance: project.governance
    };
  }
  return {
    FORMAT: FORMAT, MODES: MODES, LISTING_KINDS: LISTING_KINDS, ACCESS_POLICIES: ACCESS_POLICIES,
    LICENSES: LICENSES, TARGETS: TARGETS, CHANNELS: CHANNELS,
    createProject: createProject, normalize: normalize, findListing: findListing, addListing: addListing,
    reviewRights: reviewRights, addReview: addReview, listingReadiness: listingReadiness,
    markReviewReady: markReviewReady, createPluginPackage: createPluginPackage,
    createDeploymentPlan: createDeploymentPlan, addGalleryEntry: addGalleryEntry,
    addUpdate: addUpdate, summary: summary, clone: clone
  };
});
