(function () {
  'use strict';
  var Client = window.AXMDirectionClient;
  var currentPlan = null;
  var $ = function (id) { return document.getElementById(id); };
  function esc(value) { return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) { return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[character]; }); }
  function friendlyStatus(value) { return { OPEN:'IN PROGRESS', PAUSED:'ON HOLD', DONE:'FINISHED', CANCELLED:'CANCELLED' }[value] || String(value || '').replace(/_/g,' '); }
  function input() {
    var description = $('description').value.trim();
    return { title:description.split(/[.!?\n]/)[0].slice(0,180), description:description, quality:$('quality').value, priority:Number($('priority').value), maxPulsesPerRoute:Number($('pulses').value), actor:{ id:$('actorName').value.trim().toLowerCase().replace(/[^a-z0-9._-]+/g,'-') || 'local-requester', name:$('actorName').value.trim() || 'Local requester', kind:$('actorKind').value } };
  }
  function stateClass(route) { return route.execution.mode === 'BODY_PULSE' ? 'auto' : route.execution.mode === 'INTERACTIVE' ? 'wait' : 'held'; }
  function renderPlan(plan) {
    currentPlan = plan;
    $('preview').classList.remove('hidden');
    $('verdict').textContent = plan.verdict.replace(/_/g,' ');
    $('summary').textContent = plan.summary + ' Nothing has been saved or started yet.';
    $('routeCount').textContent = plan.routes.length + ' plan part(s)';
    $('handCount').textContent = plan.handRequests.length + ' thing(s) AXM still needs';
    $('routes').innerHTML = plan.routes.map(function (route) {
      var link = route.route ? '<a href="' + esc(route.route) + '">Open ' + esc(route.moduleName) + ' →</a>' : '';
      var queue = route.queue ? '<p><b>When saved:</b> ' + esc(route.queue.state) + ' · ' + esc(route.queue.note) + '</p>' : '';
      return '<article class="route"><div class="routeHead"><div><span class="eyebrow">' + esc(route.capability) + '</span><h4>' + esc(route.moduleName) + '</h4></div><b class="state ' + stateClass(route) + '">' + esc(route.status) + '</b></div><p>' + esc(route.action) + '</p>' + queue + '<div class="examList">' + route.qualityExams.map(function (exam) { return '<span>' + esc(exam) + '</span>'; }).join('') + '</div>' + link + '</article>';
    }).join('');
    $('handSection').style.display = plan.handRequests.length ? '' : 'none';
    $('hands').innerHTML = plan.handRequests.map(function (hand) { return '<article class="hand"><span class="eyebrow">' + esc(hand.kind) + '</span><h4>' + esc(hand.title) + '</h4><p>' + esc(hand.reason) + '</p><b>' + esc(hand.desiredContract) + '</b><br><a href="../' + esc(hand.suggestedBuilder) + '/index.html">Open suggested hand builder →</a></article>'; }).join('');
    $('commit').disabled = false;
  }
  function renderStatus(status) {
    $('bodyMode').textContent = status.bodyPulse.mode;
    $('bodyPressure').textContent = status.bodyPulse.pressure + ' pressure · ' + status.bodyPulse.activeLeases + ' active lease(s)';
    $('counts').innerHTML = '<span>' + status.counts.open + ' in progress</span><span>' + status.counts.paused + ' on hold</span><span>' + status.counts.archived + ' finished or cancelled</span><span>' + status.counts.handRequests + ' missing pieces</span>';
    $('directions').innerHTML = status.directions.map(function (direction) {
      var buttons = direction.status === 'PAUSED' ? '<button data-direction-status="OPEN" data-id="' + esc(direction.request.requestId) + '">Continue</button>' : direction.status === 'OPEN' ? '<button data-direction-status="PAUSED" data-id="' + esc(direction.request.requestId) + '">Pause</button>' : '';
      if (['DONE','CANCELLED'].indexOf(direction.status) < 0) buttons += '<button data-direction-status="DONE" data-id="' + esc(direction.request.requestId) + '">Mark finished</button><button data-direction-status="CANCELLED" data-id="' + esc(direction.request.requestId) + '" class="secondary">Cancel plan</button>';
      return '<article class="direction"><div class="directionHead"><div><span class="eyebrow">' + esc(direction.request.actor.kind) + ' · ' + esc(direction.request.actor.name) + '</span><h3>' + esc(direction.request.title) + '</h3></div><b class="state ' + (direction.status === 'OPEN' ? 'auto' : direction.status === 'PAUSED' ? 'wait' : 'held') + '">' + esc(friendlyStatus(direction.status)) + '</b></div><p>' + esc(direction.summary) + '</p><div class="directionMeta"><span>Quality <b>' + esc(direction.request.quality) + '</b></span><span>Priority <b>' + direction.request.priority + '</b></span><span>Plan parts <b>' + direction.routes.length + '</b></span><span>Missing pieces <b>' + direction.handRequests.length + '</b></span></div><div class="directionActions">' + buttons + '</div><details><summary>Technical details</summary><div class="examList">' + direction.routes.map(function (route) { return '<span>' + esc(route.moduleId) + ' · ' + esc(route.status) + '</span>'; }).join('') + '</div></details></article>';
    }).join('') || '<p>No saved plans yet.</p>';
    document.querySelectorAll('[data-direction-status]').forEach(function (button) { button.onclick = async function () { try { renderStatus((await Client.setStatus(button.dataset.id, button.dataset.directionStatus, $('actorName').value || 'local-steward')).status); } catch (error) { showError(error); } }; });
  }
  function showError(error) { $('summary').innerHTML = '<span class="error">' + esc(error.message) + '</span>'; $('preview').classList.remove('hidden'); }
  async function refresh() { try { renderStatus((await Client.status()).status); } catch (error) { $('bodyPressure').textContent = error.message; } }
  $('directionForm').onsubmit = async function (event) { event.preventDefault(); try { renderPlan((await Client.compile(input())).plan); } catch (error) { showError(error); } };
  $('commit').onclick = async function () { if (!currentPlan) return; $('commit').disabled = true; try { var result = await Client.commit(currentPlan.request); renderPlan(result.plan); renderStatus(result.status); } catch (error) { showError(error); $('commit').disabled = false; } };
  $('clear').onclick = function () { currentPlan = null; $('preview').classList.add('hidden'); };
  $('refresh').onclick = refresh;
  refresh();
})();
