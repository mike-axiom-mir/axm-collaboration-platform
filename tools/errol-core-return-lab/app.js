(function () {
  'use strict';
  var Core = window.AXMErrolCoreReturnLab;
  var Examples = window.AXMErrolCoreReturnExamples;

  function byId(id) { return document.getElementById(id); }
  function show(target, value, state) {
    target.textContent = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    target.dataset.state = state || 'ready';
  }
  function parse(id) { return JSON.parse(byId(id).value); }
  function error(target, value) { show(target, { error: String(value && value.message || value) }, 'error'); }

  function loadOrientationExample() {
    byId('modelInput').value = JSON.stringify(Examples.MODEL, null, 2);
    byId('frameInput').value = JSON.stringify(Examples.FRAME, null, 2);
    show(byId('orientationOutput'), 'Ready to create a reversible projection.', 'idle');
  }

  function loadTriadExample() {
    byId('triadInput').value = JSON.stringify(Examples.TRIAD, null, 2);
    show(byId('triadOutput'), 'Ready to evaluate externally supplied measurements.', 'idle');
  }

  byId('loadOrientation').addEventListener('click', loadOrientationExample);
  byId('projectModel').addEventListener('click', async function () {
    var output = byId('orientationOutput');
    show(output, 'Projecting…', 'busy');
    try {
      var frameInput = parse('frameInput');
      var frame = await Core.createAttentionFrame(frameInput);
      var projection = await Core.projectModel({
        model: parse('modelInput'),
        attention_frame: frame,
        created_at: frameInput.created_at
      });
      show(output, projection, projection.focus_complete ? 'pass' : 'hold');
    } catch (err) { error(output, err); }
  });

  byId('loadTriad').addEventListener('click', loadTriadExample);
  byId('evaluateTriad').addEventListener('click', async function () {
    var output = byId('triadOutput');
    show(output, 'Evaluating…', 'busy');
    try {
      var result = await Core.evaluateTriad(parse('triadInput'));
      show(output, result, result.passes_minimum_gate ? 'pass' : 'hold');
    } catch (err) { error(output, err); }
  });

  loadOrientationExample();
  loadTriadExample();
})();
