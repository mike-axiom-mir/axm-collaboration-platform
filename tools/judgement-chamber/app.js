(function () {
  'use strict';
  var Core = window.AXMJudgementCore;
  var reviews = [], current = null, currentPlan = null, dimensions = Core.emptyDimensions();
  var $ = function (id) { return document.getElementById(id); };
  function esc(value) { return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) { return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]; }); }
  function pretty(value) { return JSON.stringify(value, null, 2); }
  function unwrap(payload) { return payload && payload.result !== undefined ? payload.result : payload; }
  async function api(url, options) {
    var response = await fetch(url, options || {}), text = await response.text(), payload;
    try { payload = text ? JSON.parse(text) : {}; } catch (_) { throw new Error('The local service returned unreadable data.'); }
    if (!response.ok || payload.ok === false) throw new Error(payload.error || ('HTTP ' + response.status));
    return unwrap(payload);
  }
  function post(url, body, header, value) { return api(url, { method:'POST', headers:{ 'content-type':'application/json', [header]:value }, body:JSON.stringify(body) }); }
  function notice(message, bad) { var box = $('notice'); box.textContent = message; box.className = 'notice show' + (bad ? ' bad' : ''); clearTimeout(notice.timer); notice.timer = setTimeout(function () { box.className = 'notice'; }, 5200); }
  function subjectFromForm() { return { kind:$('kind').value, title:$('title').value.trim(), description:$('description').value.trim(), sourceRef:$('source').value.trim(), effect:$('effect').value.trim(), primaryEvidence:$('evidence').value.trim() }; }
  function fillSubject(subject) { var s = subject || {}; $('kind').value = s.kind || 'other'; $('title').value = s.title || ''; $('description').value = s.description || ''; $('source').value = s.sourceRef || ''; $('effect').value = s.effect || ''; $('evidence').value = s.primaryEvidence || ''; renderDraftSubject(); }
  function renderDraftSubject() { if (current) return; var s = subjectFromForm(); $('subjectKind').textContent = (s.kind || 'NEW SUBJECT').replace(/-/g,' ').toUpperCase(); $('subjectTitle').textContent = s.title || 'Name the item before judging it'; $('subjectDescription').textContent = s.description || 'A goal, asset, code change, world rule, curriculum, route, research claim, or anything else can enter through the same exact-subject seam.'; $('subjectSource').textContent = s.sourceRef || 'Not declared'; $('subjectEffect').textContent = s.effect || 'Not declared'; $('subjectDigest').textContent = 'Not sealed'; $('subjectState').textContent = 'DRAFT'; updateCompleteness(); }
  function renderCorners() {
    Core.DIMENSIONS.forEach(function (item, index) {
      var host = document.querySelector('[data-dimension="' + item.id + '"]'), row = dimensions[item.id] || {};
      host.innerHTML = '<div class="corner-head"><div><span class="corner-tag">CORNER ' + String(index + 1).padStart(2,'0') + ' / ' + esc(item.short) + '</span><h2>' + esc(item.title) + '</h2></div><b class="corner-index">' + (index + 1) + '</b></div><p>' + esc(item.prompt) + '</p><label><span>JUDGEMENT DEPTH</span><select data-field="rating"><option value="0">Not judged</option><option value="1">1 · serious concern</option><option value="2">2 · weak</option><option value="3">3 · workable</option><option value="4">4 · strong</option><option value="5">5 · exceptional</option></select></label><label><span>FINDING</span><textarea data-field="finding" maxlength="1000" placeholder="What does this corner see?"></textarea></label><label><span>EVIDENCE OR NAMED GAP</span><input data-field="evidence" maxlength="500" placeholder="Proof, observation, receipt, or missing proof"></label>';
      host.querySelector('[data-field="rating"]').value = String(row.rating || 0);
      host.querySelector('[data-field="finding"]').value = row.finding || '';
      host.querySelector('[data-field="evidence"]').value = row.evidence || '';
      host.querySelectorAll('[data-field]').forEach(function (input) { input.oninput = function () { dimensions[item.id][input.dataset.field] = input.dataset.field === 'rating' ? Number(input.value) : input.value; updateCompleteness(); }; });
    });
    updateCompleteness();
  }
  function updateCompleteness() {
    document.querySelectorAll('.corner').forEach(function (host) { var row = dimensions[host.dataset.dimension] || {}; host.classList.toggle('complete', Number(row.rating) > 0 && String(row.finding || '').trim() && String(row.evidence || '').trim()); });
    var check = Core.completeness(dimensions), subject = subjectFromForm(), subjectReady = !!(subject.title && subject.description && subject.effect && subject.primaryEvidence);
    $('submitReview').disabled = !!current || !check.ready || !subjectReady;
    $('completeness').textContent = current ? 'This exact item is sealed. Load it as a changed draft to edit.' : !subjectReady ? 'Finish the subject, effect, and primary evidence.' : check.ready ? 'All four corners are ready to seal.' : check.missing.length + ' judgement field(s) remain.';
  }
  async function sha256(text) { var bytes = new TextEncoder().encode(text), digest = await crypto.subtle.digest('SHA-256', bytes); return Array.from(new Uint8Array(digest)).map(function (b) { return b.toString(16).padStart(2,'0'); }).join(''); }
  function reviewSubject(item) { return item && item.action && item.action.artifact && item.action.artifact.subject ? item.action.artifact.subject : { kind:item && item.kind || 'review-item', title:item && item.title || 'Unknown item', description:item && item.summary || 'No plain-language description supplied.', sourceRef:item && item.sourceRef || '', effect:item && item.action ? 'See declared action below.' : 'No automatic action is declared.', primaryEvidence:'Exact digest and source reference are available; detailed evidence was not supplied through this Chamber.' }; }
  function reviewDimensions(item) { return item && item.action && item.action.artifact && item.action.artifact.dimensions ? item.action.artifact.dimensions : Core.emptyDimensions(); }
  function renderSelected() {
    if (!current) { renderDraftSubject(); renderFlow(null); return; }
    var s = reviewSubject(current); $('subjectKind').textContent = String(s.kind || current.kind).replace(/-/g,' ').toUpperCase(); $('subjectTitle').textContent = s.title || current.title; $('subjectDescription').textContent = s.description || current.summary; $('subjectSource').textContent = s.sourceRef || current.sourceRef || 'Not declared'; $('subjectEffect').textContent = s.effect || 'See declared action'; $('subjectDigest').textContent = current.artifactDigest; $('subjectState').textContent = current.state;
    dimensions = reviewDimensions(current); renderCorners(); renderFlow(current); renderVoteStates(); renderReviewDetail(); updateCompleteness();
  }
  function renderFlow(item) { var flow = Core.flowState(item), box = $('flowVerdict'); box.className = 'flow-verdict ' + flow.key; box.innerHTML = '<b>' + esc(flow.title) + '</b><span>' + esc(flow.detail) + '</span>'; var actionable = !!item && ['PENDING','HOLD','REJECTED','REPAIR'].indexOf(item.state) >= 0; $('addDiscussion').disabled = !actionable; $('routeRepair').disabled = !item || ['PENDING','HOLD','REJECTED'].indexOf(item.state) < 0; $('cancelReview').disabled = !item || ['PENDING','HOLD','REJECTED','REPAIR'].indexOf(item.state) < 0; $('reviseReview').disabled = !item; }
  function renderVoteStates() {
    ['human','machine'].forEach(function (kind) { var votes = current ? current.votes.filter(function (vote) { return String(vote.actorKind).toLowerCase() === kind; }) : [], vote = votes[votes.length - 1]; $(kind + 'Vote').textContent = vote ? vote.actor + ' · ' + vote.verdict + ' · ' + vote.note : 'No ' + kind + ' vote on this exact digest.'; });
    document.querySelectorAll('[data-verdict]').forEach(function (button) { button.disabled = !current || ['SUPERSEDED','REJECTED','REPAIR','CANCELLED'].indexOf(current.state) >= 0; });
  }
  function renderReviewDetail() {
    if (!current) return;
    var votes = current.votes.map(function (v) { return '<div class="vote-record"><b>' + esc(v.actor) + ' · ' + esc(v.actorKind) + ' · ' + esc(v.verdict) + '</b><p>' + esc(v.note) + '</p></div>'; }).join('') || '<p class="empty">No vote recorded.</p>';
    $('reviewDetail').innerHTML = '<span class="state-pill">' + esc(current.state) + '</span><h2>' + esc(current.title) + '</h2><p>' + esc(current.summary) + '</p><p><b>Source:</b> ' + esc(current.sourceRef || 'not declared') + '</p><p><b>Exact digest:</b><br><code>' + esc(current.artifactDigest) + '</code></p><details><summary>Declared action / artifact</summary><pre>' + esc(pretty(current.action)) + '</pre></details><h3>Independent vote record</h3>' + votes;
  }
  function renderLibrary() {
    $('libraryCount').textContent = reviews.length + ' ITEMS';
    $('reviewList').innerHTML = reviews.map(function (item) { return '<button class="review-card' + (current && current.id === item.id ? ' selected' : '') + '" data-review="' + esc(item.id) + '"><span>' + esc(item.state) + ' · ' + esc(item.kind) + '</span><b>' + esc(item.title) + '</b><small>' + item.votes.length + '/' + item.requiredSeats + ' seat(s) · ' + esc(item.sourceRef || 'no source') + '</small></button>'; }).join('') || '<p class="empty">No review items yet.</p>';
    document.querySelectorAll('[data-review]').forEach(function (button) { button.onclick = function () { selectReview(button.dataset.review); }; });
    var middle = reviews.filter(Core.reviewNeedsMiddle); $('middleCount').textContent = middle.length + ' IN MIDDLE'; $('repairQueue').innerHTML = middle.map(function (item) { return '<div class="mini-item" data-middle="' + esc(item.id) + '"><b>' + esc(item.title) + '</b><small>' + esc(item.state) + ' · ' + esc((item.votes[item.votes.length - 1] || {}).note || 'Reason is in the exact record') + '</small></div>'; }).join('') || '<p class="empty">No split decisions.</p>'; document.querySelectorAll('[data-middle]').forEach(function (row) { row.onclick = function () { selectReview(row.dataset.middle); }; });
  }
  function selectReview(id) { current = reviews.find(function (item) { return item.id === id; }) || null; renderLibrary(); renderSelected(); if (current) history.replaceState(null,'','?review=' + encodeURIComponent(current.id)); }
  async function refreshReviews(preferred) { var payload = await api('/api/reviews'); reviews = payload.items || []; var queryId = new URLSearchParams(location.search).get('review'), id = preferred || queryId || (current && current.id); current = reviews.find(function (item) { return item.id === id; }) || current || reviews.find(function (item) { return ['PENDING','HOLD','REJECTED','REPAIR'].indexOf(item.state) >= 0; }) || reviews[0] || null; renderLibrary(); renderSelected(); }
  async function submitReview() {
    var subject = subjectFromForm(), check = Core.completeness(dimensions); if (!check.ready) return notice('Finish all four judgement corners first.', true);
    var artifact = Core.deepArtifact(subject, dimensions), digest = await sha256(Core.canonical(artifact));
    var item = await post('/api/reviews', { kind:'deep-judgement', title:subject.title, sourceRef:subject.sourceRef || ('judgement-chamber:' + subject.kind + ':' + subject.title.toLowerCase().replace(/[^a-z0-9]+/g,'-').slice(0,80)), artifactDigest:digest, summary:subject.description.slice(0,1200) + ' Effect: ' + subject.effect.slice(0,500), requiredSeats:'dual', action:{ type:'dual-perspective-judgement', automaticApply:false, promotionAuthority:false, artifact:artifact } }, 'x-axm-review', 'explicit-submit');
    await refreshReviews(item.id); notice('Exact item sealed. Human and machine seats can now judge the same digest.');
  }
  async function vote(button) {
    if (!current) return notice('Select or seal an exact item first.', true); var kind = button.dataset.seat, actor = $(kind + 'Actor').value.trim(), note = $(kind + 'Note').value.trim(); if (!actor || !note) return notice('Every seat needs its own identity and reason.', true);
    var item = await post('/api/reviews/vote', { id:current.id, artifactDigest:current.artifactDigest, actor:actor, actorKind:kind, verdict:button.dataset.verdict, note:note, confirmation:'REVIEW EXACT DIGEST' }, 'x-axm-review', 'exact-digest-vote'); await refreshReviews(item.id); notice(actor + ' recorded ' + button.dataset.verdict + ' against the exact digest.');
  }
  async function discussion(action) {
    if (!current) return notice('Select an item first.', true); var body = $('discussion').value.trim(), actor = $('humanActor').value.trim() || 'Local steward'; if (!body) return notice('Write the repair reason first.', true);
    if (action === 'note') await post('/api/reviews/discuss', { id:current.id, actor:actor, actorKind:'human', body:body }, 'x-axm-review', 'explicit-discussion');
    else await post('/api/reviews/route', { id:current.id, outcome:action === 'repair' ? 'REPAIR' : 'CANCELLED', actor:actor, actorKind:'human', reason:body, confirmation:'ROUTE REVIEW ITEM' }, 'x-axm-review', 'explicit-decision-pool-route');
    $('discussion').value = ''; await refreshReviews(current.id); notice(action === 'note' ? 'Discussion note attached.' : action === 'repair' ? 'Item routed to repair. A changed digest will need fresh votes.' : 'Item closed without promotion.');
  }
  function revise() { if (!current) return; var selected = current, subject = reviewSubject(selected); dimensions = reviewDimensions(selected) || Core.emptyDimensions(); current = null; fillSubject(subject); renderCorners(); renderLibrary(); renderFlow(null); $('subjectComposer').open = true; history.replaceState(null,'',location.pathname); notice('Loaded as a draft. Change the subject or a corner so the repaired item receives a new digest.'); }
  function directionInput() { var description = $('goalDescription').value.trim(); return { title:description.split(/[.!?\n]/)[0].slice(0,180), description:description, quality:$('goalQuality').value, priority:Number($('goalPriority').value), maxPulsesPerRoute:Number($('goalPulses').value), reviewSeats:2, actor:{ id:($('humanActor').value || 'mike').toLowerCase().replace(/[^a-z0-9._-]+/g,'-'), name:$('humanActor').value || 'Mike', kind:'human' } }; }
  async function previewGoal(event) { event.preventDefault(); var payload = await post('/api/workshop-direction/compile', directionInput(), 'x-axm-direction', 'explicit-compile'); currentPlan = payload.plan; $('goalPreview').innerHTML = '<b>' + esc(currentPlan.verdict.replace(/_/g,' ')) + '</b> · ' + esc(currentPlan.summary) + '<br>' + currentPlan.routes.length + ' route(s), ' + currentPlan.handRequests.length + ' missing hand(s). Nothing saved or started.'; $('saveGoal').disabled = false; notice('Extra goal previewed. Review it before saving.'); }
  async function saveGoal() { if (!currentPlan) return; var payload = await post('/api/workshop-direction/commit', currentPlan.request, 'x-axm-direction', 'explicit-commit'); $('goalPreview').innerHTML = '<b>SAVED FOR REVIEW</b> · ' + esc(payload.plan.summary) + '<br>Existing Workshop Direction remains the owning queue.'; $('saveGoal').disabled = true; currentPlan = null; await refreshReviews(); notice('Goal saved through the existing Direction service and exact review gate.'); }
  function bind() {
    Core.DIMENSIONS.forEach(function () {}); renderCorners(); document.querySelectorAll('#subjectForm input,#subjectForm textarea,#subjectForm select').forEach(function (input) { input.oninput = renderDraftSubject; });
    $('submitReview').onclick = function () { submitReview().catch(function (e) { notice(e.message, true); }); }; document.querySelectorAll('[data-verdict]').forEach(function (button) { button.onclick = function () { vote(button).catch(function (e) { notice(e.message, true); }); }; });
    $('addDiscussion').onclick = function () { discussion('note').catch(function (e) { notice(e.message, true); }); }; $('routeRepair').onclick = function () { discussion('repair').catch(function (e) { notice(e.message, true); }); }; $('cancelReview').onclick = function () { if (confirm('Close this exact review without promotion? Its reasons stay in history.')) discussion('cancel').catch(function (e) { notice(e.message, true); }); }; $('reviseReview').onclick = revise;
    $('goalForm').onsubmit = function (event) { previewGoal(event).catch(function (e) { notice(e.message, true); }); }; $('saveGoal').onclick = function () { saveGoal().catch(function (e) { notice(e.message, true); }); };
  }
  bind(); renderDraftSubject(); refreshReviews().catch(function (error) { notice(error.message, true); $('libraryCount').textContent = 'SERVICE OFFLINE'; });
})();
