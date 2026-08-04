(function () {
  'use strict';

  var Review = window.AXMDirectionReview;
  var currentPlan = null;
  var currentReview = null;
  var directions = [];
  var reviews = [];
  var repairRequest = null;
  var noticeTimer = null;
  var lastBatchTechnicalSummary = '';
  var $ = function (id) { return document.getElementById(id); };

  function esc(value) { return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) { return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[character]; }); }
  function signed(value, digits) { var number = Number(value || 0), fixed = number.toFixed(digits == null ? 0 : digits); return (number > 0 ? '+' : '') + fixed; }
  function friendlyStatus(value) { return { OPEN:'IN PROGRESS', PAUSED:'ON HOLD', DONE:'FINISHED', CANCELLED:'CANCELLED', REPAIR:'REPAIR', REJECTED:'DOWN', PENDING:'WAITING FOR VOTES', APPROVED:'APPROVED', HOLD:'HOLD', SUPERSEDED:'REPLACED' }[value] || String(value || 'UNKNOWN').replace(/_/g, ' '); }
  function notice(message, bad) {
    var node = $('notice');
    node.textContent = message; node.className = 'notice show' + (bad ? ' error' : '');
    if (noticeTimer) clearTimeout(noticeTimer);
    noticeTimer = setTimeout(function () { node.className = 'notice'; }, 4200);
  }
  async function api(url, options) {
    var response = await fetch(url, options || {}), text = await response.text(), payload;
    try { payload = JSON.parse(text || '{}'); } catch (_) { throw new Error('The Workshop returned unreadable data.'); }
    if (!response.ok || payload.ok === false) throw new Error(payload.error || ('Request failed: ' + response.status));
    return payload;
  }
  function operationResult(payload) { return payload && Object.prototype.hasOwnProperty.call(payload, 'result') ? payload.result : payload; }
  function metricValue(value, format) {
    var number = Number(value);
    if (!Number.isFinite(number)) return 'UNKNOWN';
    if (format === 'bytes') {
      var units = ['B','KB','MB','GB','TB'], index = 0, amount = number;
      while (amount >= 1024 && index < units.length - 1) { amount /= 1024; index++; }
      return amount.toLocaleString(undefined, { maximumFractionDigits:index ? 1 : 0 }) + ' ' + units[index];
    }
    return number.toLocaleString();
  }
  function renderDeck(growth, body) {
    var current = growth && growth.current;
    document.querySelectorAll('[data-growth-key]').forEach(function (node) {
      node.textContent = current ? metricValue(current[node.dataset.growthKey], node.dataset.format) : 'UNKNOWN';
    });
    document.querySelectorAll('[data-delta-key]').forEach(function (node) {
      var delta = growth && growth.deltaFromPrevious, key = node.dataset.deltaKey;
      node.textContent = delta && Number.isFinite(Number(delta[key])) ? signed(delta[key], 0) + ' since saved snapshot' : 'no comparable snapshot';
    });
    $('deckObserved').textContent = current && current.measuredAt ? new Date(current.measuredAt).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }) : 'UNKNOWN';
    $('mirrorDeckState').textContent = body ? ('Body mode ' + String(body.mode || 'UNKNOWN') + ' · ' + (body.leases || []).length + ' active lease(s). Mirror identity is not inferred.') : 'Signal unavailable. Unknown is not offline.';
  }
  function post(url, body, headerName, headerValue) {
    var headers = { 'content-type':'application/json' };
    if (headerName) headers[headerName] = headerValue;
    return api(url, { method:'POST', headers:headers, body:JSON.stringify(body || {}) });
  }
  function input() {
    var description = $('description').value.trim(), actorName = $('actorName').value.trim() || 'Local steward';
    var result = {
      title: description.split(/[.!?\n]/)[0].slice(0, 180), description:description,
      quality:$('quality').value, priority:Number($('priority').value), maxPulsesPerRoute:Number($('pulses').value), reviewSeats:Number($('reviewSeats').value),
      actor:{ id:actorName.toLowerCase().replace(/[^a-z0-9._-]+/g, '-') || 'local-steward', name:actorName, kind:'human' }
    };
    if (repairRequest) { result.requestId = repairRequest.requestId; result.createdAt = repairRequest.createdAt; }
    return result;
  }

  function routeState(route) {
    if (route.execution.mode === 'BODY_PULSE') return ['ready', 'BOUNDED HAND'];
    if (route.execution.mode === 'UNAVAILABLE') return ['missing', 'MISSING'];
    return ['', 'YOU / HAND'];
  }
  function renderPlan(plan) {
    currentPlan = plan;
    var assessment = Review.judge(plan), suggested = assessment.suggestedVerdict;
    $('planPanel').classList.remove('hidden');
    $('planVerdict').textContent = plan.verdict.replace(/_/g, ' ');
    $('planSummary').textContent = plan.summary + ' Nothing has been saved, voted, or started yet.';
    $('routeCount').textContent = plan.routes.length + ' PLAN PART' + (plan.routes.length === 1 ? '' : 'S');
    $('missingCount').textContent = plan.handRequests.length + ' MISSING / OPERATOR';
    $('judgeScore').textContent = assessment.score;
    $('judgeVerdict').textContent = assessment.label;
    $('judgeReason').textContent = assessment.reasons.join(' ');
    $('judgeRing').style.borderColor = suggested === 'UP' ? 'var(--green)' : suggested === 'DOWN' ? 'var(--red)' : 'var(--gold)';
    $('criteria').innerHTML = assessment.criteria.map(function (item) {
      return '<article class="criterion"><header><b>' + esc(item.label) + '</b><strong>' + item.score + '</strong></header><p>' + esc(item.evidence) + '</p><div class="meter"><i style="width:' + item.score + '%"></i></div></article>';
    }).join('');
    $('routes').innerHTML = plan.routes.map(function (route) {
      var state = routeState(route);
      return '<article class="route-card"><header><div><span class="eyebrow">' + esc(route.capability) + '</span><h4>' + esc(route.moduleName) + '</h4></div><span class="route-state ' + state[0] + '">' + state[1] + '</span></header><p>' + esc(route.action) + '</p><div class="exam-chips">' + route.qualityExams.map(function (exam) { return '<span>' + esc(exam) + '</span>'; }).join('') + '</div>' + (route.route ? '<a href="' + esc(route.route) + '">OPEN ROOM →</a>' : '') + '</article>';
    }).join('');
    $('missingSection').style.display = plan.handRequests.length ? '' : 'none';
    $('missingHands').innerHTML = plan.handRequests.map(function (hand) {
      return '<article class="missing-card"><span class="eyebrow">' + esc(hand.kind) + '</span><h4>' + esc(hand.title) + '</h4><p>' + esc(hand.reason) + '</p><a href="../' + esc(hand.suggestedBuilder) + '/index.html">OPEN SUGGESTED BUILDER →</a></article>';
    }).join('');
    $('commit').disabled = false;
    $('planPanel').scrollIntoView({ behavior:'smooth', block:'start' });
  }

  function renderVote(direction) {
    var steward = direction && direction.stewardReview;
    if (!steward) { $('votePanel').classList.add('hidden'); currentReview = null; return; }
    currentReview = { direction:direction, steward:steward, item:steward.reviewItem };
    $('votePanel').classList.remove('hidden');
    $('planDigest').textContent = steward.artifact.digest;
    var votes = steward.reviewItem.votes || [], own = votes.find(function (vote) { return String(vote.actor).toLowerCase() === String($('actorName').value).trim().toLowerCase(); });
    $('voteState').textContent = own ? ('Your ' + own.verdict + ' vote is recorded · ' + votes.length + '/' + steward.reviewItem.requiredSeats + ' independent vote(s).') : ('Your seat is waiting · ' + votes.length + '/' + steward.reviewItem.requiredSeats + ' independent vote(s) recorded.');
  }

  function statusClass(status) { return status === 'PAUSED' ? 'paused' : ['DONE','CANCELLED'].indexOf(status) >= 0 ? 'closed' : ''; }
  function renderDirections(status) {
    directions = status.directions || [];
    $('directionCounts').innerHTML = '<span>' + status.counts.open + ' IN PROGRESS</span><span>' + status.counts.paused + ' ON HOLD</span><span>' + status.counts.archived + ' CLOSED</span><span>' + status.counts.handRequests + ' MISSING PIECES</span>';
    $('directions').innerHTML = directions.map(function (direction) {
      var id = esc(direction.request.requestId), buttons = '';
      if (direction.status === 'OPEN') buttons += '<button data-life="PAUSED" data-id="' + id + '">PAUSE</button>';
      if (direction.status === 'PAUSED') buttons += '<button data-life="OPEN" data-id="' + id + '">CONTINUE</button>';
      if (['DONE','CANCELLED'].indexOf(direction.status) < 0) buttons += '<button data-life="DONE" data-id="' + id + '">MARK FINISHED</button><button data-life="CANCELLED" data-id="' + id + '">CANCEL</button>';
      buttons += '<button data-reopen="' + id + '">USE AS NEW PLAN</button>';
      if (direction.stewardReview) buttons += '<button data-review="' + id + '">OPEN VOTE</button>';
      var review = direction.stewardReview && direction.stewardReview.reviewItem;
      return '<article class="direction-card"><header><div><span class="eyebrow">' + esc(direction.request.quality) + ' · ' + direction.routes.length + ' PARTS</span><h3>' + esc(direction.request.title) + '</h3></div><span class="status-chip ' + statusClass(direction.status) + '">' + esc(friendlyStatus(direction.status)) + '</span></header><p>' + esc(direction.summary) + '</p>' + (review ? '<p class="review-line"><span>REVIEW ' + esc(friendlyStatus(review.state)) + '</span><span>' + review.votes.length + '/' + review.requiredSeats + ' VOTES</span></p>' : '<p class="review-line">LEGACY PLAN · RECOMPILE FOR DIGEST REVIEW</p>') + '<div class="direction-actions">' + buttons + '</div></article>';
    }).join('') || '<p class="empty">No saved plans yet.</p>';
  }

  function renderNeeds(needs) {
    if (!needs || !needs.summary) {
      $('openNeedCount').textContent = '—';
      $('openNeedHealth').textContent = 'Owner unavailable';
      $('reviewCandidateCount').textContent = '—';
      $('reviewCandidateHealth').textContent = 'Evidence unavailable';
      return;
    }
    $('openNeedCount').textContent = needs.summary.open;
    $('openNeedHealth').textContent = needs.summary.satisfied + ' accepted explicitly';
    var readiness = needs.readiness || { state:'UNAVAILABLE', reviewCandidates:[] };
    if (readiness.state === 'CURRENT') {
      $('reviewCandidateCount').textContent = readiness.reviewCandidates.length;
      $('reviewCandidateHealth').textContent = 'Waiting for Mike · not promoted';
    } else {
      $('reviewCandidateCount').textContent = '—';
      $('reviewCandidateHealth').textContent = 'Evidence ' + String(readiness.state || 'UNAVAILABLE').toLowerCase();
    }
  }

  function renderSystem(body, glasses, cognitive, needs) {
    if (body) {
      $('bodyMode').textContent = body.mode || 'UNKNOWN';
      $('bodyPressure').textContent = (body.body && body.body.pressure || 'UNKNOWN') + ' pressure · ' + (body.leases || []).length + ' lease(s)';
    }
    if (glasses && glasses.counts) {
      $('moduleCount').textContent = glasses.counts.modules;
      $('moduleHealth').textContent = glasses.counts.broken + ' broken · ' + glasses.counts.critical + ' critical';
      $('contractCount').textContent = glasses.counts.contractsPassing + '/' + glasses.counts.contractsDeclared;
      $('contractHealth').textContent = glasses.counts.high + ' high issue(s)';
    }
    if (cognitive) {
      $('evidenceCount').textContent = cognitive.counts && cognitive.counts.records != null ? cognitive.counts.records : '0';
      $('evidenceHealth').textContent = (cognitive.counts && cognitive.counts.active || 0) + ' active record(s)';
      var counts = cognitive.counts || {};
      $('evidenceTechnical').textContent = (cognitive.providers || []).length + ' declared providers · ' + (counts.records || 0) + ' total ledger records · ' + (counts.observations || 0) + ' run observation(s) · ' + (counts.profiles || 0) + ' machine profile(s) · ' + (counts.rateSchedules || 0) + ' rate schedule(s) · automatic capture OFF · no ranking authority.';
    }
    renderNeeds(needs);
    var healthy = glasses && glasses.counts && glasses.counts.critical === 0 && glasses.counts.high === 0;
    $('coreStatus').textContent = healthy ? 'SYSTEM CLEAR' : glasses ? 'CHECK ISSUES' : 'PARTIAL SIGNAL';
    $('topState').textContent = healthy ? 'LOCAL SYSTEM READY' : 'REVIEW SYSTEM STATE';
    $('topState').parentElement.className = 'top-state ' + (healthy ? 'ready' : 'warn');
    $('lastRefresh').textContent = 'CHECKED ' + new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
  }

  function renderOutput(growth, directionStatus) {
    if (!growth || !growth.current || !growth.current.activity) return;
    var current = growth.current, activity = current.activity, hour = activity.lastHour || {}, touched = Number(hour.files || 0), velocity = growth.velocity || {};
    var coverage = velocity.coverage || {}, resumedBlind = velocity.ready && coverage.state === 'RESUMED_AFTER_GAP' && !coverage.hasMeasuredChange && !(activity.latest || []).some(function (item) { return Date.parse(item.modifiedAt) > Date.parse(velocity.baselineAt); });
    var done = (directionStatus && directionStatus.recentEvents || []).filter(function (event) { return event.kind === 'direction-status' && event.status === 'DONE' && Date.parse(event.at) >= Date.now() - 3600000; }).length;
    $('codeHour').textContent = resumedBlind ? 'RESUMED' : velocity.ready ? signed(velocity.codeLinesPerHour, 0) : 'WARMING UP';
    $('assetHour').textContent = resumedBlind ? '—' : velocity.ready ? signed(velocity.assetFilesPerHour, 1) : '—';
    $('testHour').textContent = resumedBlind ? '—' : velocity.ready ? signed(velocity.testLinesPerHour, 0) : '—';
    $('doneHour').textContent = done;
    $('outputSignal').textContent = resumedBlind ? 'MEASUREMENT RESUMED' : velocity.ready && velocity.codeLinesDelta ? 'CODE GROWING' : touched ? 'METER SAMPLING' : 'QUIET HOUR';
    $('outputHeadline').textContent = resumedBlind ? 'Recent work predates the live line baseline.' : velocity.ready ? (signed(velocity.codeLinesPerHour, 0) + ' net code lines per hour.') : 'Code-line baseline started. The next sample reveals the real pace.';
    $('outputMeaning').textContent = Number(current.codeLines || 0).toLocaleString() + ' code lines · ' + Number(current.testLines || 0).toLocaleString() + ' test lines · ' + Number(current.assetFiles || 0).toLocaleString() + ' asset outputs currently in Workshop source.';
    $('outputPace').textContent = done ? (done + ' direction' + (done === 1 ? '' : 's') + ' was explicitly marked finished in the same hour.') : 'Net lines rise when code is added and fall when it is removed. Finished stays separate until a direction is explicitly marked finished.';
    var hourly = growth.hourlyVelocity || [], max = Math.max.apply(null, hourly.map(function (bucket) { return Math.abs(Number(bucket.codeLines || 0)); }).concat([1])), peak = hourly.reduce(function (best, bucket) { return Number(bucket.codeLines || 0) > Number(best.codeLines || 0) ? bucket : best; }, { codeLines:0, startedAt:null });
    $('outputBars').innerHTML = hourly.map(function (bucket) { var amount = Number(bucket.codeLines || 0), height = bucket.measured ? Math.max(3, Math.round(Math.abs(amount) / max * 100)) : 2, label = new Date(bucket.startedAt).toLocaleTimeString([], { hour:'2-digit' }); return '<i class="' + (amount < 0 ? 'negative' : '') + '" style="height:' + height + '%" title="' + signed(amount, 0) + ' net code lines measured around ' + esc(label) + '"><span>' + esc(label) + '</span></i>'; }).join('');
    $('peakHour').textContent = peak.startedAt ? ('PEAK ' + new Date(peak.startedAt).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }) + ' · ' + signed(peak.codeLines, 0) + ' LINES') : 'PEAK —';
    var rate = growth.rateFromPrevious, delta = growth.deltaFromPrevious || {};
    $('sinceSnapshot').textContent = resumedBlind ? ('Sampling resumed at ' + new Date(velocity.baselineAt).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }) + ' after a ' + Math.max(1, Math.round(Number(coverage.gapBeforeBaselineMinutes || 0) / 60)) + '-hour coverage gap.') : velocity.ready ? (signed(velocity.codeLinesDelta, 0) + ' net code lines since ' + new Date(velocity.baselineAt).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }) + ' · sampled locally every 15 minutes') : (rate && rate.codeLinesPerHour != null ? (signed(delta.codeLines, 0) + ' net code lines · ' + signed(rate.codeLinesPerHour, 1) + '/hour since the last growth snapshot') : 'The first aggregate line-count sample is stored; no fake historical rate is invented.');
    $('outputTruth').textContent = resumedBlind ? 'The files below are real recent activity, but net additions before the baseline are unknown rather than zero.' : 'Only aggregate counts are stored · deletions reduce the rate · source contents are never retained · this is not typing speed.';
    $('latestOutput').innerHTML = (activity.latest || []).slice(0,5).map(function (item) { return '<span><b>' + esc(item.kind.toUpperCase()) + '</b>' + esc(item.file.split('/').slice(-2).join('/')) + '<small>' + new Date(item.modifiedAt).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }) + '</small></span>'; }).join('') || '<span>No file activity in the last 24 hours.</span>';
  }

  function ownerRoute(control) {
    var routes = { 'cognitive-resource-meter':'../cognitive-resource-meter/index.html', 'cognitive-evidence-explorer':'../cognitive-evidence-explorer/index.html', 'cognitive-calibration-lab':'../cognitive-calibration-lab/index.html', 'human-attention-ledger':'../human-attention-ledger/index.html', 'sustainability-metrology-lab':'../sustainability-metrology-lab/index.html', 'mirror-intake-monitor':'../mirror-intake-monitor/index.html', 'workshop-direction':'../workshop-direction/index.html' };
    return routes[control.moduleId] || ('../' + control.moduleId + '/index.html');
  }
  function renderControls(catalog) {
    var controls = catalog && catalog.controls || [];
    $('controlCatalog').innerHTML = controls.map(function (control) {
      var action = control.method === 'NAVIGATE' ? '<a href="' + esc(control.endpoint) + '">OPEN</a>' : control.method === 'GET' ? '<button data-safe-get="' + esc(control.endpoint) + '">RUN SAFE READ</button>' : '<a href="' + esc(ownerRoute(control)) + '">OPEN OWNER ROOM</a>';
      return '<article class="control ' + (control.mutation ? 'mutation' : '') + '"><header><h4>' + esc(control.label) + '</h4><code>' + esc(control.method) + '</code></header><p>' + esc(control.help || (control.mutation ? 'Requires an explicit structured request in its specialist room.' : 'Read or navigate without automatic action.')) + '</p>' + action + '</article>';
    }).join('') || '<p>No command catalog available.</p>';
  }

  function directionForReview(item) { return directions.find(function (direction) { return direction.request.requestId === (item.action && item.action.directionId); }); }
  function codeDraftExplanation(item) {
    return AXMCodeDraftDecisionGuide.explanation(item);
  }
  function technicalCodeDraftReview(item) {
    return AXMCodeDraftDecisionGuide.technicalReview(item);
  }
  function renderCodeDraftReviews() {
    var closed = ['SUPERSEDED','REJECTED','REPAIR','CANCELLED','EXPIRED'];
    var drafts = reviews.filter(function (item) { return item.kind === 'code-improvement-draft' && closed.indexOf(item.state) < 0; });
    var retired = reviews.filter(function (item) { return item.kind === 'code-improvement-draft' && item.state === 'SUPERSEDED' && item.technicalRefusal && item.technicalRefusal.schema === 'axm.code-draft-technical-refusal/v1'; });
    var unchecked = drafts.filter(function (item) { return !technicalCodeDraftReview(item); });
    var ready = drafts.filter(function (item) { var technical = technicalCodeDraftReview(item); return technical && technical.verdict === 'APPROVE'; });
    var repair = drafts.filter(function (item) { var technical = technicalCodeDraftReview(item); return technical && technical.verdict === 'HOLD'; });
    drafts.sort(function (left, right) {
      function rank(item) { var technical = technicalCodeDraftReview(item); return technical && technical.verdict === 'APPROVE' ? 0 : !technical ? 1 : 2; }
      return rank(left) - rank(right) || String(left.createdAt || '').localeCompare(String(right.createdAt || ''));
    });
    $('codeDraftReviewCount').textContent = drafts.length + ' ACTIVE';
    $('codeDraftReadyCount').textContent = ready.length + ' READY FOR MIKE';
    $('codeDraftRepairCount').textContent = repair.length + ' NEED REPAIR';
    $('codeDraftRetiredCount').textContent = retired.length + ' ARCHIVED';
    var batchButton = $('checkAllCodeDrafts');
    batchButton.disabled = unchecked.length === 0;
    batchButton.textContent = unchecked.length ? ('CHECK NEXT ' + Math.min(unchecked.length, 25) + ' SAFELY') : 'ALL TECHNICAL CHECKS DONE';
    $('batchTechnicalStatus').textContent = lastBatchTechnicalSummary || (unchecked.length ? (unchecked.length + ' exact candidate' + (unchecked.length === 1 ? '' : 's') + ' still need a technical reason before Mike can choose.') : ('Every active exact candidate has a technical reason. ' + retired.length + ' stale or invalid exact cop' + (retired.length === 1 ? 'y is' : 'ies are') + ' archived with evidence.'));
    function renderDraftCard(item) {
      var moduleId = item.action && item.action.moduleId || item.title;
      var actor = $('actorName').value.trim() || 'Local steward';
      var own = (item.votes || []).find(function (vote) { return String(vote.actor).toLowerCase() === actor.toLowerCase(); });
      var guide = AXMCodeDraftDecisionGuide.guide(item), explanation = guide.explanation, technical = guide.technicalReview, technicalChecked = !!technical;
      var canHumanChoose = guide.humanDecision, needsRepair = guide.phase === 'REPAIR';
      var decisionSummary = '<section class="human-decision-summary ' + esc(guide.tone) + '"><span>' + esc(guide.badge) + '</span><h4>' + esc(guide.headline) + '</h4><p>' + esc(guide.why) + '</p><b>' + esc(guide.recommendation) + '</b><small>' + esc(guide.decisionPrompt) + '</small></section>';
      var technicalStatus = technicalChecked
        ? '<details class="technical-review ' + (technical.verdict === 'APPROVE' ? 'ready' : 'held') + '"><summary>TECHNICAL EVIDENCE: ' + esc(technical.verdict === 'APPROVE' ? 'CHECK PASSED' : 'BLOCKER FOUND') + '</summary><span>' + esc(technical.note) + '</span><small>' + (technical.verdict === 'HOLD' ? 'A KEEP decision cannot override this HOLD. A changed candidate is required.' : 'This is one review seat only. Nothing was applied.') + '</small></details>'
        : '<div class="technical-review waiting"><b>TECHNICAL CHECK NEEDED FIRST</b><span>Mike is not being asked to judge code. AXM can verify the exact receipt, candidate hash, unchanged source and remaining contract errors without changing the patch.</span><button type="button" data-code-draft-check>RUN SAFE TECHNICAL CHECK</button><small>Reads the candidate and records one machine APPROVE or HOLD. Never installs, applies, merges or publishes.</small></div>';
      var understanding = canHumanChoose
        ? '<label class="draft-understanding"><input type="checkbox" data-code-draft-understood><span>I read the plain explanation and the technical steward\'s reason for this exact copy.</span></label>'
        : '<div class="draft-understanding locked"><span>' + (needsRepair ? 'No decision is needed from Mike. This exact copy must be repaired or replaced first.' : 'Mike\'s choice unlocks only after the technical steward approves this exact copy.') + '</span></div>';
      var decisionControls = canHumanChoose
        ? '<div class="draft-vote-box"><input data-code-draft-note maxlength="1000" placeholder="Optional: add your own reason"><button class="up" data-code-draft-vote="APPROVE" disabled>YES - KEEP FOR LATER</button><button class="down" data-code-draft-vote="REJECT" disabled>NO - DISCARD THIS COPY</button><small>' + (own ? ('Your ' + esc(own.verdict) + ' review is recorded') : 'Read the open explanation, tick the box, then choose') + '</small></div>'
        : '<div class="draft-repair-box"><b>' + (needsRepair ? 'NEEDS REPAIR · NOT YOUR VOTE' : 'WAITING FOR TECHNICAL CHECK') + '</b><span>' + (needsRepair ? 'The machine found a concrete blocker. Heartbeat or a steward must return a changed candidate before your decision can help.' : 'Nothing is being asked of Mike until the exact copy is checked.') + '</span></div>';
      return '<article class="code-draft-review ' + (canHumanChoose ? 'ready-for-mike' : needsRepair ? 'needs-repair' : 'needs-check') + '" data-code-draft-id="' + esc(item.id) + '" data-code-draft-digest="' + esc(item.artifactDigest) + '">' +
        '<header class="draft-card-head"><div><span class="eyebrow">' + esc(friendlyStatus(item.state)) + ' · ' + (item.votes || []).length + '/' + item.requiredSeats + ' REVIEWS</span><h3>' + esc(moduleId) + '</h3></div><code title="Exact candidate digest">' + esc(item.artifactDigest.slice(0,16)) + '…</code></header>' +
        '<p class="draft-boundary">Your choice never installs this. Two approvals only mark this exact candidate reviewed.</p>' + decisionSummary + technicalStatus +
        '<details class="draft-explanation"' + (guide.openExplanation ? ' open' : '') + '><summary>' + (canHumanChoose ? 'WHY AXM RECOMMENDS THIS' : needsRepair ? 'WHY THIS COPY IS PARKED' : 'ABOUT THIS PROPOSED CHANGE') + '</summary><div class="explanation-grid">' +
          '<section><b>WHAT WOULD CHANGE</b><p>' + esc(explanation.change) + '</p></section>' +
          '<section><b>WHY IT MAY HELP</b><p>' + esc(explanation.benefit) + '</p></section>' +
          '<section class="risk"><b>WHAT COULD GO WRONG</b><p>' + esc(explanation.risk) + '</p></section>' +
          '<section><b>WHAT WAS ACTUALLY PROVEN</b><p>' + esc(explanation.proof) + '</p></section>' +
        '</div><div class="draft-recommendation"><b>YOUR ACTUAL DECISION</b><span>' + esc(guide.decisionPrompt) + '</span></div>' + understanding + '</details>' + decisionControls +
        '<footer>Review before ' + esc(item.expiresAt ? new Date(item.expiresAt).toLocaleString() : 'the seven-day retention boundary') + ' · evidence remains after expiry</footer></article>';
    }
    var readyHtml = ready.map(renderDraftCard).join('');
    var uncheckedHtml = unchecked.map(renderDraftCard).join('');
    var repairHtml = repair.map(renderDraftCard).join('');
    $('codeDraftReviews').innerHTML = readyHtml + uncheckedHtml + (repair.length ? '<details class="parked-draft-group"><summary><span>' + repair.length + ' PARKED FOR REPAIR</span><b>No decision needed from Mike</b><small>Open only if you want the technical history.</small></summary><div class="parked-draft-list">' + repairHtml + '</div></details>' : '') || '<p class="empty">No heartbeat code drafts are waiting. Queued evidence does not require you to be online when it is created.</p>';
  }
  function renderDecisionPool() {
    var pool = reviews.filter(function (item) {
      if (item.kind !== 'workshop-direction' || item.state === 'SUPERSEDED') return false;
      return ['HOLD','REJECTED','REPAIR','CANCELLED'].indexOf(item.state) >= 0 || (item.votes || []).some(function (vote) { return ['HOLD','REJECT'].indexOf(vote.verdict) >= 0; });
    });
    $('decisionPool').innerHTML = pool.map(function (item) {
      var discussion = (item.discussion || []).slice(-6).map(function (message) { return '<blockquote><b>' + esc(message.actor) + '</b> · ' + esc(message.body) + '</blockquote>'; }).join('');
      var voteReasons = (item.votes || []).filter(function (vote) { return vote.verdict !== 'APPROVE'; }).map(function (vote) { return '<blockquote><b>' + esc(vote.actor) + ' · ' + esc(vote.verdict) + '</b> · ' + esc(vote.note || 'No note supplied.') + '</blockquote>'; }).join('');
      return '<article class="decision-card ' + (item.state === 'REJECTED' ? 'rejected' : '') + '" data-pool-id="' + esc(item.id) + '"><header><div><span class="eyebrow">' + esc(friendlyStatus(item.state)) + ' · ' + (item.votes || []).length + '/' + item.requiredSeats + ' VOTES</span><h3>' + esc(item.title) + '</h3></div><code>' + esc(item.artifactDigest.slice(0,16)) + '…</code></header><p>' + esc(item.summary) + '</p><div class="discussion-log">' + voteReasons + discussion + '</div><div class="decision-form"><input data-pool-note placeholder="Add a reason or discussion note"><button data-pool-action="discuss">DISCUSS</button><button data-pool-action="repair">SEND TO REPAIR</button><button data-pool-action="cancel" class="cancel">CANCEL COMPLETELY</button></div></article>';
    }).join('') || '<p class="empty">No held or rejected direction reviews.</p>';
  }

  async function refreshPlans() {
    var payload = await api('/api/workshop-direction');
    renderDirections(payload.status);
    return payload.status;
  }
  async function refreshReviews() {
    var payload = operationResult(await api('/api/reviews'));
    reviews = payload.items || [];
    renderCodeDraftReviews();
    renderDecisionPool();
    return payload;
  }
  async function refreshAll() {
    $('refreshAll').disabled = true; $('topState').textContent = 'SCANNING LOCAL SYSTEM';
    // The local server is intentionally single-process. Load human decisions before
    // heavyweight Workshop scans so a truthful queue never waits behind inventory work.
    var priorityResults = await Promise.allSettled([refreshReviews()]);
    var results = await Promise.allSettled([api('/api/body-pulse'), api('/api/workshop/technical-glasses'), api('/api/cognitive-resource-meter'), api('/api/workshop-growth'), api('/api/cognitive-resource-meter/command-center-controls'), api('/api/workshop-needs'), refreshPlans()]);
    var body = results[0].status === 'fulfilled' ? results[0].value.status : null;
    var glasses = results[1].status === 'fulfilled' ? results[1].value : null;
    var cognitive = results[2].status === 'fulfilled' ? operationResult(results[2].value) : null;
    var growth = results[3].status === 'fulfilled' ? results[3].value : null;
    var controls = results[4].status === 'fulfilled' ? operationResult(results[4].value) : null;
    var needs = results[5].status === 'fulfilled' ? operationResult(results[5].value) : null;
    var directionStatus = results[6].status === 'fulfilled' ? results[6].value : null;
    renderSystem(body, glasses, cognitive, needs); renderDeck(growth, body); renderOutput(growth, directionStatus); renderControls(controls); renderDecisionPool();
    $('refreshAll').disabled = false;
    var failures = priorityResults.concat(results).filter(function (result) { return result.status === 'rejected'; });
    if (failures.length) notice(failures.length + ' local status source(s) could not be read. Unknown is shown instead.', true);
  }

  $('priority').oninput = function () { $('priorityValue').textContent = this.value; };
  $('deckCommandForm').onsubmit = function (event) {
    event.preventDefault();
    var command = $('deckCommand').value.trim();
    if (!command) return notice('Tell AXM what you want to make or fix first.', true);
    $('description').value = command;
    $('commandForm').requestSubmit();
  };
  $('commandForm').onsubmit = async function (event) {
    event.preventDefault();
    if (!Review) return notice('Direction review engine is unavailable.', true);
    try {
      var payload = await post('/api/workshop-direction/compile', input(), 'x-axm-direction', 'explicit-compile');
      renderPlan(payload.plan);
    } catch (error) { notice(error.message, true); }
  };
  $('clear').onclick = function () { currentPlan = null; currentReview = null; repairRequest = null; $('description').value = ''; $('planPanel').classList.add('hidden'); $('votePanel').classList.add('hidden'); notice('Command input cleared. Saved plans were not changed.'); };
  $('commit').onclick = async function () {
    if (!currentPlan) return;
    $('commit').disabled = true;
    try {
      var payload = await post('/api/workshop-direction/commit', currentPlan.request, 'x-axm-direction', 'explicit-commit');
      currentPlan = payload.plan; repairRequest = null; renderDirections(payload.status); renderVote(payload.plan); await refreshReviews();
      notice('Plan saved. Exact-digest review queued for ' + payload.plan.stewardReview.reviewItem.requiredSeats + ' independent seat(s). Body Pulse was not started.');
      $('votePanel').scrollIntoView({ behavior:'smooth', block:'center' });
    } catch (error) { notice(error.message, true); $('commit').disabled = false; }
  };
  document.querySelectorAll('[data-vote]').forEach(function (button) {
    button.onclick = async function () {
      if (!currentReview) return notice('Open a reviewed saved plan first.', true);
      var note = $('voteNote').value.trim(); if (!note) return notice('Add a short reason before recording your vote.', true);
      try {
        var payload = operationResult(await post('/api/reviews/vote', { id:currentReview.item.id, artifactDigest:currentReview.steward.artifact.digest, actor:$('actorName').value.trim() || 'Local steward', actorKind:'human', verdict:button.dataset.vote, note:note, confirmation:'REVIEW EXACT DIGEST' }, 'x-axm-review', 'exact-digest-vote'));
        currentReview.item = payload; $('voteState').textContent = 'Your ' + payload.votes[payload.votes.length - 1].verdict + ' vote is recorded · state ' + friendlyStatus(payload.state) + '.';
        await refreshPlans(); await refreshReviews(); notice('Your exact-digest vote was recorded. No action was applied automatically.');
      } catch (error) { notice(error.message, true); }
    };
  });
  $('directions').onclick = async function (event) {
    var life = event.target.closest('[data-life]'), reopen = event.target.closest('[data-reopen]'), reviewButton = event.target.closest('[data-review]');
    if (life) {
      try { var status = (await post('/api/workshop-direction/status', { directionId:life.dataset.id, status:life.dataset.life, actorId:$('actorName').value.trim() || 'local-steward' }, 'x-axm-direction', 'explicit-status')).status; renderDirections(status); notice('Plan is now ' + friendlyStatus(life.dataset.life) + '.'); } catch (error) { notice(error.message, true); }
    }
    if (reopen) { var direction = directions.find(function (item) { return item.request.requestId === reopen.dataset.reopen; }); if (direction) beginRepair(direction, false); }
    if (reviewButton) { var selected = directions.find(function (item) { return item.request.requestId === reviewButton.dataset.review; }); if (selected) { renderVote(selected); $('votePanel').scrollIntoView({ behavior:'smooth', block:'center' }); } }
  };
  function beginRepair(direction, markedRepair) {
    repairRequest = direction.request;
    $('description').value = direction.request.description;
    $('quality').value = direction.request.quality;
    $('priority').value = direction.request.priority; $('priorityValue').textContent = direction.request.priority;
    $('pulses').value = direction.request.maxPulsesPerRoute;
    $('reviewSeats').value = direction.request.reviewSeats || 2;
    $('description').focus(); $('mission').scrollIntoView({ behavior:'smooth', block:'start' });
    notice(markedRepair ? 'Direction returned for repair. Change the plan before saving; the new digest gets a fresh vote.' : 'Direction copied into the command input. Show the plan before saving.');
  }
  $('decisionPool').onclick = async function (event) {
    var action = event.target.closest('[data-pool-action]'); if (!action) return;
    var card = action.closest('[data-pool-id]'), item = reviews.find(function (entry) { return entry.id === card.dataset.poolId; }), note = card.querySelector('[data-pool-note]').value.trim();
    if (!item) return;
    if (!note) return notice('Add a reason before discussing, repairing, or cancelling.', true);
    try {
      if (action.dataset.poolAction === 'discuss') {
        await post('/api/reviews/discuss', { id:item.id, actor:$('actorName').value.trim() || 'Local steward', actorKind:'human', body:note }, 'x-axm-review', 'explicit-discussion');
        notice('Discussion note added to the exact review item.');
      } else {
        var outcome = action.dataset.poolAction === 'repair' ? 'REPAIR' : 'CANCELLED';
        if (outcome === 'CANCELLED' && !window.confirm('Cancel this direction completely? Its evidence stays in the review history.')) return;
        await post('/api/reviews/route', { id:item.id, outcome:outcome, actor:$('actorName').value.trim() || 'Local steward', actorKind:'human', reason:note, confirmation:'ROUTE REVIEW ITEM' }, 'x-axm-review', 'explicit-decision-pool-route');
        var direction = directionForReview(item);
        if (direction) {
          await post('/api/workshop-direction/status', { directionId:direction.request.requestId, status:outcome === 'REPAIR' ? 'PAUSED' : 'CANCELLED', actorId:$('actorName').value.trim() || 'local-steward' }, 'x-axm-direction', 'explicit-status');
          if (outcome === 'REPAIR') beginRepair(direction, true);
        }
        notice(outcome === 'REPAIR' ? 'Direction moved to repair. A changed digest is required to reopen review.' : 'Direction cancelled. Evidence remains in history.');
      }
      await refreshPlans(); await refreshReviews();
    } catch (error) { notice(error.message, true); }
  };
  $('codeDraftReviews').onclick = async function (event) {
    var checkButton = event.target.closest('[data-code-draft-check]');
    if (checkButton) {
      var checkCard = checkButton.closest('[data-code-draft-id]');
      try {
        checkButton.disabled = true; checkButton.textContent = 'CHECKING EXACT COPY…';
        var checked = operationResult(await post('/api/reviews/technical-check', { id:checkCard.dataset.codeDraftId, artifactDigest:checkCard.dataset.codeDraftDigest, confirmation:'RUN READ-ONLY TECHNICAL CHECK' }, 'x-axm-review', 'deterministic-technical-check'));
        await refreshReviews();
        notice('Technical check recorded ' + checked.assessment.verdict + ' for the exact candidate. No patch was applied.');
      } catch (error) { notice(error.message, true); }
      return;
    }
    var button = event.target.closest('[data-code-draft-vote]'); if (!button) return;
    var card = button.closest('[data-code-draft-id]'), actor = $('actorName').value.trim() || 'Local steward';
    var item = reviews.find(function (entry) { return entry.id === card.dataset.codeDraftId; });
    var understood = card.querySelector('[data-code-draft-understood]');
    var technical = item && technicalCodeDraftReview(item);
    if (!technical) return notice('Mike\'s choice stays locked until a machine steward checks and explains this exact candidate.', true);
    if (technical.verdict !== 'APPROVE') return notice('This exact copy needs repair. There is no useful vote for Mike to cast yet.', true);
    if (!understood || !understood.checked) return notice('Open the plain explanation and tick that you read it before choosing.', true);
    var note = card.querySelector('[data-code-draft-note]').value.trim() || (actor + ' reviewed the plain explanation and technical steward reason, then chose ' + button.dataset.codeDraftVote.toLowerCase() + '.');
    try {
      button.disabled = true;
      await post('/api/reviews/vote', { id:card.dataset.codeDraftId, artifactDigest:card.dataset.codeDraftDigest, actor:actor, actorKind:'human', verdict:button.dataset.codeDraftVote, note:note, informedExplanation:true, confirmation:'REVIEW EXACT DIGEST' }, 'x-axm-review', 'exact-digest-vote');
      await refreshReviews();
      notice(actor + ' recorded an informed exact-copy ' + button.dataset.codeDraftVote + ' review. No patch was applied.');
    } catch (error) { notice(error.message, true); } finally { button.disabled = false; }
  };
  $('checkAllCodeDrafts').onclick = async function () {
    var button = $('checkAllCodeDrafts');
    try {
      button.disabled = true; button.textContent = 'CHECKING BOUNDED QUEUE…';
      var batch = operationResult(await post('/api/reviews/technical-check-pending', { confirmation:'RUN BOUNDED READ-ONLY TECHNICAL CHECKS' }, 'x-axm-review', 'deterministic-technical-check-batch'));
      lastBatchTechnicalSummary = batch.checked + ' checked · ' + batch.approved + ' safe to consider · ' + batch.held + ' held for repair · ' + batch.retired + ' stale/invalid copies archived · ' + batch.refused + ' transient refusals · ' + batch.remainingUnchecked + ' still unchecked. No patch was applied.';
      await refreshReviews();
      notice(lastBatchTechnicalSummary, batch.refused > 0);
    } catch (error) {
      lastBatchTechnicalSummary = 'Batch stopped safely: ' + error.message;
      $('batchTechnicalStatus').textContent = lastBatchTechnicalSummary;
      notice(lastBatchTechnicalSummary, true);
    } finally {
      renderCodeDraftReviews();
    }
  };
  $('codeDraftReviews').onchange = function (event) {
    var checkbox = event.target.closest('[data-code-draft-understood]'); if (!checkbox) return;
    var card = checkbox.closest('[data-code-draft-id]');
    card.querySelectorAll('[data-code-draft-vote]').forEach(function (button) { button.disabled = !checkbox.checked; });
  };
  $('controlCatalog').onclick = async function (event) {
    var button = event.target.closest('[data-safe-get]'); if (!button) return;
    try { $('controlOutput').textContent = JSON.stringify(operationResult(await api(button.dataset.safeGet)), null, 2); } catch (error) { $('controlOutput').textContent = 'READ FAILED: ' + error.message; }
  };
  $('refreshAll').onclick = refreshAll;
  $('refreshPlans').onclick = function () { refreshPlans().then(function () { notice('Saved plans refreshed. Nothing was saved or changed.'); }).catch(function (error) { notice(error.message, true); }); };
  $('refreshPool').onclick = function () { Promise.all([refreshPlans(), refreshReviews()]).then(function () { notice('Plans needing a decision refreshed. Nothing was saved or changed.'); }).catch(function (error) { notice(error.message, true); }); };

  refreshAll();
  if (window.parent !== window) window.parent.postMessage({ type:'hub:ready', moduleId:'workshop-command-center' }, '*');
})();
