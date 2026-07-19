(function () {
  'use strict';
  var Core = window.AXMMarketplaceDeploymentCore;
  if (!Core) throw new Error('Marketplace & Deployment core is unavailable');
  var STORE = 'axm.marketplace-deployment.project.v1';
  var MODE_COPY = {
    home: ['DISTRIBUTION MAP', 'Prepare reach without pretending it happened.', 'One parent for listings, rights, reviews, packages, deployment plans, galleries and update channels above the real Publish & Library foundation.'],
    catalog: ['LOCAL CATALOG', 'Name the candidate before asking the world to find it.', 'Listings start as drafts. Access policy, audience, version and source remain explicit.'],
    rights: ['RIGHTS & LICENSING', 'Reach begins with permission, provenance and dependencies.', 'This inspectable gate identifies missing evidence; it is not legal advice or an automatic license decision.'],
    plugins: ['PLUGINS & EXTENSIONS', 'Package capability without silently installing it.', 'Compatibility, entry point and permissions remain visible in a proposal-only distribution record.'],
    deploy: ['DEPLOYMENT PLANS', 'A target needs requirements, checks and rollback.', 'Plans never execute, upload, bind a port or store credentials. They make the later governed action inspectable.'],
    gallery: ['PUBLIC GALLERY DRAFTS', 'Prepare discoverability without claiming publication.', 'Cards remain local previews or public proposals until a separately approved adapter publishes them.'],
    updates: ['UPDATE CHANNELS', 'Stable is earned; rollback is required.', 'Channels hold versioned draft records. Automatic installation remains structurally off.'],
    reviews: ['REVIEW SEATS', 'Keep both perspective and reasoning.', 'Human and machine reviews remain attributed. Popularity, grades and one optimizer score grant no authority.'],
    publish: ['PUBLISH FOUNDATION', 'Use the real artifact and package body underneath.', 'Publish & Library remains independently executable and owns output, packaging, backups and release manifests.']
  };
  var project = loadProject();
  var activeMode = Core.MODES.some(function (m) { return m.id === project.settings.mode; }) ? project.settings.mode : 'home';
  var latestPlan = project.deploymentPlans.slice(-1)[0] || null;

  function $(id) { return document.getElementById(id); }
  function esc(value) { return String(value == null ? '' : value).replace(/[&<>'"]/g, function (c) { return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' })[c]; }); }
  function loadProject() { try { return Core.normalize(JSON.parse(localStorage.getItem(STORE) || 'null')); } catch (error) { return Core.createProject(); } }
  function toast(message, bad) { var node = $('toast'); node.textContent = message; node.style.borderColor = bad ? '#7a3744' : '#3d6680'; node.classList.add('show'); clearTimeout(toast.timer); toast.timer = setTimeout(function () { node.classList.remove('show'); }, 2800); }
  function persist(message) {
    project.updatedAt = new Date().toISOString();
    localStorage.setItem(STORE, JSON.stringify(project));
    $('saveState').textContent = 'Saved ' + new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
    if (window.AXMHub) AXMHub.save({ project: project, summary: Core.summary(project) });
    renderAll();
    if (message) toast(message);
  }
  function download(name, value) {
    var blob = new Blob([JSON.stringify(value, null, 2)], { type:'application/json' });
    var url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = name; link.click();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }
  function optionText(listing) { return listing.name + ' ' + listing.version + ' - ' + listing.state; }
  function listingById(id) { return Core.findListing(project, id); }
  function latestRights(id) { return project.rightsReviews.filter(function (r) { return r.listingId === id; }).slice(-1)[0] || null; }
  function fillSelect(id, items, valueFn, labelFn, emptyLabel) {
    var select = $(id), current = select.value; select.innerHTML = '';
    if (!items.length) { var empty = document.createElement('option'); empty.value = ''; empty.textContent = emptyLabel || 'No listing yet'; select.appendChild(empty); return; }
    items.forEach(function (item) { var option = document.createElement('option'); option.value = valueFn(item); option.textContent = labelFn(item); select.appendChild(option); });
    if (items.some(function (item) { return valueFn(item) === current; })) select.value = current;
  }
  function stateClass(state) { return /READY|PASS|UPVOTE/.test(state) ? 'ready' : /BLOCK|REPAIR|HOLD/.test(state) ? 'blocked' : 'held'; }
  function renderNav() {
    var nav = $('modeNav'); nav.innerHTML = '';
    Core.MODES.forEach(function (mode, index) { var button = document.createElement('button'); button.className = 'mode-button' + (mode.id === activeMode ? ' active' : ''); button.type = 'button'; button.innerHTML = '<i>' + String(index).padStart(2, '0') + '</i><span>' + esc(mode.label) + '</span>'; button.onclick = function () { selectMode(mode.id); }; nav.appendChild(button); });
  }
  function selectMode(mode) {
    if (!Core.MODES.some(function (m) { return m.id === mode; })) return;
    activeMode = mode; project.settings.mode = mode; localStorage.setItem(STORE, JSON.stringify(project));
    Core.MODES.forEach(function (m) { $(m.id + 'Panel').hidden = m.id !== mode; });
    var copy = MODE_COPY[mode]; $('modeKicker').textContent = copy[0]; $('modeTitle').textContent = copy[1]; $('modeDescription').textContent = copy[2];
    if (mode === 'publish') {
      var frame = $('publishFrame'); if (!frame.src) frame.src = frame.dataset.src;
      checkFoundation();
    }
    renderNav();
  }
  function renderMetrics() {
    var summary = Core.summary(project);
    $('metricListings').textContent = summary.listings; $('metricReady').textContent = summary.ready; $('metricPlans').textContent = summary.plans; $('metricReceipts').textContent = summary.receipts;
    $('homeListingCount').textContent = summary.listings; $('catalogCount').textContent = summary.listings; $('pluginCount').textContent = project.pluginPackages.length; $('deploymentCount').textContent = project.deploymentPlans.length; $('galleryCount').textContent = project.galleryEntries.length; $('updateCount').textContent = summary.updates; $('reviewCount').textContent = project.reviews.length;
    $('governanceState').textContent = project.governance.toUpperCase(); $('toggleGovernance').textContent = project.governance === 'dual' ? 'Switch to solo mode' : 'Switch to dual mode';
    $('footerStatus').textContent = summary.ready + ' ready - ' + summary.held + ' held - ' + project.governance + ' review';
  }
  function listingRecord(listing) {
    var readiness = Core.listingReadiness(project, listing.id);
    return '<article class="record"><header><div><span>' + esc(listing.kind.toUpperCase()) + ' - ' + esc(listing.accessPolicy.toUpperCase()) + '</span><b>' + esc(listing.name) + ' ' + esc(listing.version) + '</b></div><i class="status ' + stateClass(listing.state) + '">' + esc(listing.state) + '</i></header><p>' + esc(listing.summary) + '</p><small>' + esc(listing.audience) + '</small><small>Rights: ' + esc(listing.rightsState) + ' - local gate: ' + esc(readiness.state) + '</small></article>';
  }
  function renderListings() {
    var reversed = project.listings.slice().reverse();
    $('catalogListings').innerHTML = reversed.length ? reversed.map(listingRecord).join('') : '<div class="empty">No listings yet.</div>';
    $('homeListings').innerHTML = reversed.length ? reversed.slice(0, 5).map(listingRecord).join('') : '<div class="empty">No product, tool, game or package has been listed.</div>';
    var allIds = ['rightsListing','deployListing','galleryListing','updateListing','reviewListing'];
    allIds.forEach(function (id) { fillSelect(id, project.listings, function (x) { return x.id; }, optionText, 'No listing yet'); });
    fillSelect('pluginListing', project.listings.filter(function (x) { return x.kind === 'plugin' || x.kind === 'extension'; }), function (x) { return x.id; }, optionText, 'No plugin or extension listing');
    renderRightsCurrent();
  }
  function renderRightsCurrent() {
    var id = $('rightsListing').value, review = latestRights(id), readiness = id ? Core.listingReadiness(project, id) : null;
    $('markReviewReady').disabled = !readiness || !readiness.ready || (listingById(id) && listingById(id).state === 'READY_FOR_EXPORT');
    if (!review) { $('rightsVerdict').textContent = 'UNREVIEWED'; $('rightsResult').className = 'empty'; $('rightsResult').textContent = id ? 'No rights review has been recorded for this listing.' : 'Choose a listing and preserve the evidence behind its distribution rights.'; return; }
    $('rightsVerdict').textContent = review.verdict;
    $('rightsResult').className = 'truth-box';
    $('rightsResult').innerHTML = '<b>' + esc(review.license) + '</b><p>' + (review.findings.length ? review.findings.map(esc).join('<br>') : 'License, provenance, dependencies and rights confirmation are present.') + '</p><small>Local finding only - legal authority: NONE</small>' + (readiness ? '<p>Export gate: ' + esc(readiness.state) + '<br>' + esc(readiness.reasons.join(' ')) + '</p>' : '');
  }
  function renderPlugins() {
    $('pluginProposals').innerHTML = project.pluginPackages.length ? project.pluginPackages.slice().reverse().map(function (p) { var listing = listingById(p.listingId); return '<article class="record"><header><div><span>' + esc(p.state) + '</span><b>' + esc(listing ? listing.name : p.name) + '</b></div><i class="status ' + stateClass(p.state) + '">' + esc(p.version) + '</i></header><p>Entry: ' + esc(p.entry || 'missing') + '</p><small>' + esc(p.compatibility || p.findings.join(' ')) + '</small><small>Install authority: NONE</small></article>'; }).join('') : '<div class="empty">No plugin package proposals.</div>';
  }
  function renderDeployments() {
    $('deploymentHistory').innerHTML = project.deploymentPlans.length ? project.deploymentPlans.slice().reverse().map(function (p) { var listing = listingById(p.listingId); return '<article class="record"><span>' + esc(p.target.toUpperCase()) + '</span><b>' + esc(listing ? listing.name : p.listingId) + '</b><small>' + esc(p.state) + ' - network action: NONE</small></article>'; }).join('') : '<div class="empty">No deployment plans.</div>';
    latestPlan = project.deploymentPlans.slice(-1)[0] || null;
    $('deploymentVerdict').textContent = latestPlan ? latestPlan.state : 'NOT BUILT'; $('deploymentPlan').textContent = latestPlan ? JSON.stringify(latestPlan, null, 2) : 'A plan is data, not a live deployment.'; $('downloadPlan').disabled = !latestPlan;
  }
  function renderGallery() {
    $('galleryGrid').innerHTML = project.galleryEntries.length ? project.galleryEntries.slice().reverse().map(function (entry) { var listing = listingById(entry.listingId); return '<article class="gallery-card"><span>' + esc(entry.visibility.toUpperCase()) + ' - DRAFT</span><h4>' + esc(listing ? listing.name : entry.listingId) + '</h4><p>' + esc(entry.caption) + '</p><small>' + esc(entry.mediaRef || 'No media reference') + '<br>No external publication occurred.</small></article>'; }).join('') : '<div class="empty">No gallery drafts.</div>';
  }
  function renderUpdates() {
    $('updateChannels').innerHTML = project.updateChannels.map(function (channel) { return '<section class="channel"><h4>' + esc(channel.id) + '</h4><p class="panel-copy">' + esc(channel.description) + '</p>' + (channel.releases.length ? channel.releases.slice().reverse().map(function (u) { var listing = listingById(u.listingId); return '<article class="record"><span>DRAFT ' + esc(u.version) + '</span><b>' + esc(listing ? listing.name : u.listingId) + '</b><small>Rollback ' + esc(u.rollbackVersion) + '<br>Auto-install off</small></article>'; }).join('') : '<div class="empty">No releases.</div>') + '</section>'; }).join('');
  }
  function renderReviews() {
    $('reviewLedger').innerHTML = project.reviews.length ? project.reviews.slice().reverse().map(function (review) { var listing = listingById(review.listingId); return '<article class="record"><header><div><span>' + esc(review.seatKind.toUpperCase()) + ' - ' + esc(review.scope.toUpperCase()) + '</span><b>' + esc(review.reviewer) + ' on ' + esc(listing ? listing.name : review.listingId) + '</b></div><i class="status ' + stateClass(review.verdict) + '">' + esc(review.verdict) + '</i></header><p>' + esc(review.note) + '</p><small>Perspective stays attributed.</small></article>'; }).join('') : '<div class="empty">No reviews recorded.</div>';
  }
  function renderAll() { renderMetrics(); renderListings(); renderPlugins(); renderDeployments(); renderGallery(); renderUpdates(); renderReviews(); selectMode(activeMode); }
  async function checkFoundation() {
    $('foundationState').textContent = 'CHECKING'; $('foundationState').className = 'status held';
    try {
      var results = await Promise.all([
        fetch('/api/health').then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('runtime')); }),
        fetch('/api/tools').then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('registry')); }),
        fetch('/api/workshop-packages').then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('packages')); })
      ]);
      var tools = results[1].tools || [], packages = results[2].packages || [];
      var required = ['publish-library','workshop-packager','launcher-card-installer'];
      var missing = required.filter(function (id) { return !tools.some(function (t) { return t.id === id; }); });
      var ready = missing.length === 0 && !results[2].active;
      $('foundationState').textContent = ready ? 'READY' : 'DEGRADED'; $('foundationState').className = 'status ' + (ready ? 'ready' : 'blocked');
      $('foundationFacts').innerHTML = '<div class="fact"><span>Local runtime</span><b>READY</b></div><div class="fact"><span>Required child routes</span><b>' + (missing.length ? esc(missing.join(', ')) : '3 / 3') + '</b></div><div class="fact"><span>Verified packages</span><b>' + packages.length + '</b></div><div class="fact"><span>Package job</span><b>' + (results[2].active ? 'BUSY' : 'IDLE') + '</b></div>';
      $('publishState').textContent = ready ? 'READY' : 'DEGRADED'; $('publishState').className = 'status ' + (ready ? 'ready' : 'blocked'); $('publishDetail').textContent = ready ? 'Artifact, package and launcher proposal routes answered locally.' : 'A local foundation route is missing or busy.';
    } catch (error) {
      $('foundationState').textContent = 'OFFLINE'; $('foundationState').className = 'status blocked'; $('foundationFacts').innerHTML = '<div class="empty">Local Hub APIs did not answer. Draft data still works offline.</div>';
      $('publishState').textContent = 'OFFLINE'; $('publishState').className = 'status blocked'; $('publishDetail').textContent = 'The parent remains usable for drafts; real packaging is unavailable.';
    }
  }
  function bind() {
    document.querySelectorAll('[data-mode-jump]').forEach(function (button) { button.onclick = function () { selectMode(button.dataset.modeJump); }; });
    $('toggleGovernance').onclick = function () { project.governance = project.governance === 'dual' ? 'solo' : 'dual'; project.receipts.push({ id:'receipt-' + Date.now().toString(36), type:'governance.changed', statement:'Review governance changed to ' + project.governance, actor:'local-steward', evidence:['No listing state changed automatically'], at:new Date().toISOString() }); persist('Governance changed to ' + project.governance); };
    $('checkFoundation').onclick = checkFoundation;
    $('addListing').onclick = function () { var result = Core.addListing(project, { name:$('listingName').value, version:$('listingVersion').value, kind:$('listingKind').value, accessPolicy:$('listingAccess').value, audience:$('listingAudience').value, sourceRoute:$('listingSource').value, summary:$('listingSummary').value }, 'local-steward'); if (!result.ok) return toast(result.error, true); ['listingName','listingVersion','listingSource','listingSummary'].forEach(function (id) { $(id).value = ''; }); persist('Draft listing created - still local'); };
    $('rightsListing').onchange = renderRightsCurrent;
    $('runRightsGate').onclick = function () { var result = Core.reviewRights(project, { listingId:$('rightsListing').value, license:$('rightsLicense').value, provenance:$('rightsProvenance').value, dependencies:$('rightsDependencies').value, rightsConfirmed:$('rightsConfirmed').checked }, 'local-steward'); if (!result.ok) return toast(result.error, true); persist('Rights gate recorded: ' + result.review.verdict); };
    $('markReviewReady').onclick = function () { var result = Core.markReviewReady(project, $('rightsListing').value, 'local-steward'); if (!result.ok) return toast(result.error, true); persist('Listing ready for explicit export - not published'); };
    $('buildPlugin').onclick = function () { var result = Core.createPluginPackage(project, { listingId:$('pluginListing').value, entry:$('pluginEntry').value, compatibility:$('pluginCompatibility').value, permissions:$('pluginPermissions').value }, 'local-steward'); if (!result.ok) return toast(result.error, true); persist('Plugin distribution proposal recorded: ' + result.proposal.state); };
    $('buildDeployment').onclick = function () { var result = Core.createDeploymentPlan(project, { listingId:$('deployListing').value, target:$('deployTarget').value, requirements:$('deployRequirements').value, rollback:$('deployRollback').value }, 'local-steward'); if (!result.ok) return toast(result.error, true); latestPlan = result.plan; persist('Deployment plan recorded: ' + result.plan.state); };
    $('downloadPlan').onclick = function () { if (latestPlan) download('AXM_DEPLOYMENT_PLAN_' + latestPlan.id + '.json', latestPlan); };
    $('addGallery').onclick = function () { var result = Core.addGalleryEntry(project, { listingId:$('galleryListing').value, caption:$('galleryCaption').value, mediaRef:$('galleryMedia').value, visibility:$('galleryVisibility').value }, 'local-steward'); if (!result.ok) return toast(result.error, true); persist('Gallery draft preserved - not published'); };
    $('addUpdate').onclick = function () { var result = Core.addUpdate(project, { listingId:$('updateListing').value, channel:$('updateChannel').value, version:$('updateVersion').value, changelog:$('updateChangelog').value, rollbackVersion:$('updateRollback').value }, 'local-steward'); if (!result.ok) return toast(result.error, true); persist('Update channel draft added - auto-install off'); };
    $('addReview').onclick = function () { var result = Core.addReview(project, { listingId:$('reviewListing').value, reviewer:$('reviewerName').value, seatKind:$('reviewSeat').value, scope:$('reviewScope').value, verdict:$('reviewVerdict').value, note:$('reviewNote').value }); if (!result.ok) return toast(result.error, true); $('reviewNote').value = ''; persist('Attributed review recorded'); };
    $('exportProject').onclick = function () { download('AXM_MARKETPLACE_DEPLOYMENT_' + project.id + '.json', project); toast('Project export prepared locally'); };
    $('newProject').onclick = function () { if (!window.confirm('Start a fresh Marketplace & Deployment project? Export first if this project matters.')) return; project = Core.createProject(); latestPlan = null; persist('Fresh distribution project created'); selectMode('home'); };
    $('importProject').onchange = function (event) { var file = event.target.files && event.target.files[0]; if (!file) return; var reader = new FileReader(); reader.onload = function () { try { var parsed = JSON.parse(reader.result); if (!parsed || parsed.schema !== Core.FORMAT) throw new Error('format'); project = Core.normalize(parsed); activeMode = project.settings.mode; persist('Marketplace & Deployment project imported'); } catch (error) { toast('Import refused: wrong or unreadable project format', true); } }; reader.readAsText(file); event.target.value = ''; };
  }
  function initOptions() {
    Core.LISTING_KINDS.forEach(function (value) { $('listingKind').insertAdjacentHTML('beforeend','<option value="' + esc(value) + '">' + esc(value) + '</option>'); });
    Core.ACCESS_POLICIES.forEach(function (value) { $('listingAccess').insertAdjacentHTML('beforeend','<option value="' + esc(value) + '">' + esc(value) + '</option>'); });
    Core.LICENSES.forEach(function (value) { $('rightsLicense').insertAdjacentHTML('beforeend','<option value="' + esc(value) + '">' + esc(value) + '</option>'); });
    Core.TARGETS.forEach(function (value) { $('deployTarget').insertAdjacentHTML('beforeend','<option value="' + esc(value) + '">' + esc(value) + '</option>'); });
    Core.CHANNELS.forEach(function (value) { $('updateChannel').insertAdjacentHTML('beforeend','<option value="' + esc(value) + '">' + esc(value) + '</option>'); });
  }
  async function init() {
    initOptions(); bind(); renderAll(); await checkFoundation();
    if (window.AXMHub) { AXMHub.ready({ version:'v0.1', capabilities:['catalog','rights-review','reviews','plugin-proposals','deployment-plans','gallery-drafts','update-channels','publish-parent'] }); AXMHub.verifyPass(); }
    toast('Marketplace & Deployment ready - local drafts only');
  }
  init();
})();
