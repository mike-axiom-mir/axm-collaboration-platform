(function () {
  'use strict';
  var state = document.getElementById('state'), detail = document.getElementById('detail');
  var feedState = document.getElementById('feedState'), feedDetail = document.getElementById('feedDetail'), feedToggle = document.getElementById('feedToggle');
  var feedEnabled = false;
  function showFeed(data) {
    feedEnabled = data.enabled === true;
    feedState.textContent = feedEnabled ? 'OPTED IN' : 'OPTED OUT';
    feedState.className = feedEnabled ? 'ready' : '';
    feedDetail.textContent = (data.lessons && data.lessons.approved || 0) + ' reviewed action lesson(s). New receipts are ' + (feedEnabled ? 'eligible for private learning.' : 'not collected.');
    feedToggle.textContent = feedEnabled ? 'Pause lesson feed' : 'Opt in locally';
    feedToggle.disabled = false;
  }
  function checkFeed() {
    feedState.textContent = 'CHECKING'; feedDetail.textContent = 'Checking Mirror\'s local preference.'; feedToggle.disabled = true;
    fetch('/services/mirror-native/axm/v1/learning/action-feed/status', { cache: 'no-store' }).then(function(response){ if(!response.ok) throw Error('HTTP '+response.status); return response.json(); }).then(showFeed).catch(function(){ feedState.textContent='UNAVAILABLE'; feedDetail.textContent='Mirror runtime is not available yet.'; });
  }
  function changeFeed() {
    feedToggle.disabled = true;
    fetch('/services/mirror-native/axm/v1/learning/action-feed/settings', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({ enabled:!feedEnabled, actor:{ actor_id:'mike', actor_kind:'human', display_name:'Mike' } }) }).then(function(response){ if(!response.ok) return response.json().then(function(body){ throw Error(body.error||('HTTP '+response.status)); }); return response.json(); }).then(showFeed).catch(function(error){ feedState.textContent='HELD'; feedDetail.textContent=error.message; feedToggle.disabled=false; });
  }
  function check() {
    state.textContent = 'CHECKING'; state.className = ''; detail.textContent = 'Looking for the local Forge on port 8801.';
    fetch('/services/ai-learning-forge/api/health', { cache: 'no-store' }).then(function (response) { if (!response.ok) throw Error('HTTP ' + response.status); return response.json(); }).then(function (data) {
      state.textContent = data.ok ? 'READY' : 'HELD'; state.className = data.ok ? 'ready' : '';
      detail.textContent = data.ok ? 'Portable curricula are local and the attributed Forge door is ready.' : 'The Forge answered but is held.';
    }).catch(function () { state.textContent = 'OFFLINE'; detail.textContent = 'Use START_AXM_FULL.bat to start the optional local school.'; });
  }
  document.getElementById('retry').onclick = check;
  feedToggle.onclick = changeFeed;
  function init(){ check(); checkFeed(); }
  if (window.AXMHub) { AXMHub.onInit(init); AXMHub.ready({ id: 'mirror-learning-shell', name: 'AI Learning Forge', version: 'v0.3-action-lessons', hubApiVersion: '1.0', permissions: [], savesState: false, handlesShutdown: false }); } else init();
}());
