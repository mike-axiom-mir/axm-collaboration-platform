(function () {
  'use strict';
  var O = AXMOps, notice = document.getElementById('notice');
  function load() {
    O.get('/api/media-render').then(function (state) {
      document.getElementById('facts').innerHTML = '<span>' + state.jobs.length + ' jobs</span><span>' + state.active + ' active</span><span>limit ' + state.concurrencyLimit + '</span><span>required dependencies ' + state.requiredThirdPartyDependencies.length + '</span><span>auto publish ' + state.automaticPublish + '</span>';
      var optional = state.optionalAdapters[0];
      document.getElementById('engine').textContent = optional.available ? optional.version + ' (optional format adapter)' : 'Optional FFmpeg adapter unavailable; native WAV render and transcode remain available.';
      document.getElementById('out').textContent = O.pretty(state.jobs.slice(0, 12));
    }).catch(function (error) { O.notice(notice, error.message, 'bad'); });
  }
  document.getElementById('render').onclick = function () {
    var sequence;
    try { sequence = JSON.parse(document.getElementById('sequence').value); }
    catch (_) { return O.notice(notice, 'Sequence must be valid JSON.', 'bad'); }
    O.post('/api/media-render/start', { action: 'tone-sequence', sequence: sequence }, { 'x-axm-media': 'explicit-render' }).then(function (job) {
      document.getElementById('jobId').value = job.id; O.notice(notice, 'Render queued: ' + job.id, 'ok'); setTimeout(load, 350);
    }).catch(function (error) { O.notice(notice, error.message, 'bad'); });
  };
  document.getElementById('transcode').onclick = function () {
    var request = { action: 'transcode', source: document.getElementById('source').value, format: 'wav', sampleRate: Number(document.getElementById('sampleRate').value), channels: Number(document.getElementById('channels').value) };
    O.post('/api/media-render/start', request, { 'x-axm-media': 'explicit-render' }).then(function (job) {
      document.getElementById('jobId').value = job.id; O.notice(notice, 'Native WAV transcode queued: ' + job.id, 'ok'); setTimeout(load, 350);
    }).catch(function (error) { O.notice(notice, error.message, 'bad'); });
  };
  document.getElementById('cancel').onclick = function () {
    O.post('/api/media-render/cancel', { id: document.getElementById('jobId').value }, { 'x-axm-media': 'explicit-cancel' }).then(function () { O.notice(notice, 'Cancellation recorded.', 'ok'); load(); }).catch(function (error) { O.notice(notice, error.message, 'bad'); });
  };
  document.getElementById('refresh').onclick = load; load();
})();
