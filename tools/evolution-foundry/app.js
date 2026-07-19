(function () {
  'use strict';
  function read(key) { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch (error) { return null; } }
  function text(id, value) { document.getElementById(id).textContent = value; }
  async function render() {
    var world = read('axm.governed-evolution-lab.v1');
    var assets = read('axm.asset-fabric.v1');
    text('worldGeneration', world ? world.generation : 0);
    text('worldHeartbeat', world && world.heartbeat && world.heartbeat.active ? 'REQUESTING' : 'IDLE');
    text('worldResult', world && world.lastReceipt ? (world.lastReceipt.inherited ? 'INHERITED' : 'HELD') : 'No receipt');
    text('assetCandidates', assets && assets.candidates ? assets.candidates.length : 0);
    text('assetVocabulary', assets && assets.vocabulary ? assets.vocabulary.length : 0);
    text('assetHeartbeat', assets && assets.heartbeat && assets.heartbeat.active ? 'REQUESTING' : 'IDLE');
    try {
      var response = await fetch('/api/body-pulse');
      var payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'Body Pulse unavailable');
      var status = payload.status;
      text('bodyMode', status.mode);
      text('bodyPressure', status.body.pressure);
      text('bodyGoals', status.goals.filter(function (goal) { return goal.status === 'OPEN' || goal.status === 'RUNNING'; }).length);
    } catch (error) {
      text('bodyMode', 'OFFLINE');
      text('bodyPressure', 'UNKNOWN');
      text('bodyGoals', '—');
    }
    try {
      var directionResponse = await fetch('/api/workshop-direction');
      var directionPayload = await directionResponse.json();
      if (!directionResponse.ok || !directionPayload.ok) throw new Error(directionPayload.error || 'Direction unavailable');
      text('directionOpen', directionPayload.status.counts.open);
      text('directionHands', directionPayload.status.counts.handRequests);
    } catch (error) {
      text('directionOpen', 'OFFLINE');
      text('directionHands', '—');
    }
  }
  document.getElementById('refresh').onclick = render;
  render();
})();
