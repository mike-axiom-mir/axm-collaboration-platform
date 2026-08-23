'use strict';
(function () {
  var Foundry = window.AXMCapabilityRecipeFoundry;
  var Zip = window.AXMZipStore;
  var $ = function (id) { return document.getElementById(id); };
  var state = { intent: null, result: null };

  function notice(text, tone) {
    $('intent-state').textContent = text;
    $('intent-state').className = 'notice' + (tone ? ' ' + tone : '');
  }
  function parseEditor() {
    try { return JSON.parse($('intent-json').value); }
    catch (error) { notice('INVALID JSON · ' + error.message, 'bad'); return null; }
  }
  function resetOutput(intent) {
    $('capability-kind').textContent = intent.recipe.capabilityKind;
    $('recipe-id').textContent = '—';
    $('builder-id').textContent = '—';
    $('file-count').textContent = '0 files';
    $('proposal-digest').textContent = 'No digest';
    $('packet-digest').textContent = 'No digest';
  }
  function loadPilot() {
    state.intent = Foundry.example();
    state.result = null;
    $('intent-json').value = JSON.stringify(state.intent, null, 2);
    resetOutput(state.intent);
    $('packet-result').hidden = true;
    $('output-status').textContent = 'NOT BUILT';
    $('output-status').className = 'chip hold';
    $('holds').className = 'holds';
    $('holds').replaceChildren(document.createElement('li'));
    $('holds').firstChild.textContent = 'Pilot loaded. Validate its exact sealed digest and source bindings.';
    notice('SEALED PILOT · ' + state.intent.intentDigest, 'hold');
  }
  function loadSkillPilot() {
    state.intent = Foundry.exampleSkill();
    state.result = null;
    $('intent-json').value = JSON.stringify(state.intent, null, 2);
    resetOutput(state.intent);
    $('packet-result').hidden = true;
    $('output-status').textContent = 'NOT BUILT';
    $('output-status').className = 'chip hold';
    $('holds').className = 'holds';
    $('holds').replaceChildren(document.createElement('li'));
    $('holds').firstChild.textContent = 'Portable SKILL pilot loaded. Validate its exact sealed digest and modular contract.';
    notice('SEALED SKILL PILOT · ' + state.intent.intentDigest, 'hold');
  }
  function loadAdapterPilot() {
    state.intent = Foundry.exampleAdapter();
    state.result = null;
    $('intent-json').value = JSON.stringify(state.intent, null, 2);
    resetOutput(state.intent);
    $('packet-result').hidden = true;
    $('output-status').textContent = 'NOT BUILT';
    $('output-status').className = 'chip hold';
    $('holds').className = 'holds';
    $('holds').replaceChildren(document.createElement('li'));
    $('holds').firstChild.textContent = 'Object adapter pilot loaded. Structural mapping proof does not claim domain semantic equivalence.';
    notice('SEALED ADAPTER PILOT · ' + state.intent.intentDigest, 'hold');
  }
  function reseal() {
    var parsed = parseEditor();
    if (!parsed) return;
    state.intent = Foundry.sealIntent(parsed);
    state.result = null;
    $('intent-json').value = JSON.stringify(state.intent, null, 2);
    $('packet-result').hidden = true;
    notice('RESEALED EXPLICITLY · inspect the new digest, then validate and route.', 'hold');
  }
  function renderPlan(plan) {
    var list = $('holds');
    list.replaceChildren();
    if (plan.status === 'READY') {
      list.className = 'holds good';
      var ready = document.createElement('li');
      ready.textContent = 'READY · exact specification, verification plan, and modular kind bound · inactive proposal only · 8 review files';
      list.append(ready);
      $('output-status').textContent = 'READY';
      $('output-status').className = 'chip good';
      return;
    }
    list.className = 'holds';
    (plan.holds || []).forEach(function (entry) {
      var li = document.createElement('li');
      var nested = entry.details && entry.details[0] && entry.details[0].code;
      li.textContent = entry.code + (nested ? ' · ' + nested : '') + ' · ' + entry.message;
      list.append(li);
    });
    $('output-status').textContent = 'HELD';
    $('output-status').className = 'chip hold';
  }
  function route() {
    var parsed = parseEditor();
    if (!parsed) return;
    state.intent = parsed;
    var plan = Foundry.plan(parsed);
    renderPlan(plan);
    if (plan.status !== 'READY') {
      state.result = null;
      $('packet-result').hidden = true;
      notice('HELD · the closed authoring contract or exact source binding failed.', 'bad');
      return;
    }
    state.result = Foundry.forge(parsed);
    var result = state.result;
    $('capability-kind').textContent = result.packet.target.capabilityKind;
    $('recipe-id').textContent = result.packet.target.recipeId;
    $('builder-id').textContent = result.packet.target.builderId;
    $('file-count').textContent = result.packet.files.length + ' files';
    $('proposal-digest').textContent = result.packet.proposalRef.digest;
    $('packet-digest').textContent = result.packet.packetDigest;
    var fileList = $('file-list');
    fileList.replaceChildren();
    result.packet.files.forEach(function (row) {
      var item = document.createElement('li');
      var name = document.createElement('span');
      var size = document.createElement('code');
      name.textContent = row.path;
      size.textContent = row.bytes + ' B';
      item.append(name, size);
      fileList.append(item);
    });
    $('packet-result').hidden = false;
    $('output-status').textContent = 'INACTIVE';
    $('output-status').className = 'chip good';
    notice('COMPLETE · deterministic packet assembled · builder source and tests remain unexecuted.', 'good');
    if (window.AXMHub) window.AXMHub.log('Capability Recipe Foundry assembled one inactive review packet', 'info');
  }
  function download() {
    if (!state.result) return;
    var files = Object.assign({}, state.result.files, {
      'packet.json': JSON.stringify(state.result.packet, null, 2) + '\n',
      'foundry-receipt.json': JSON.stringify(state.result.receipt, null, 2) + '\n'
    });
    var bytes = Zip.build(files, state.result.packet.id);
    var blob = new Blob([bytes], { type: 'application/zip' });
    var url = URL.createObjectURL(blob);
    var anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = state.result.packet.id + '-' + state.result.packet.packetDigest.slice(7, 19) + '-INACTIVE.zip';
    anchor.click();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }
  function start() {
    if (!Foundry || !Zip) throw new Error('Capability Recipe Foundry dependencies are unavailable.');
    $('load-pilot').addEventListener('click', loadPilot);
    $('load-skill-pilot').addEventListener('click', loadSkillPilot);
    $('load-adapter-pilot').addEventListener('click', loadAdapterPilot);
    $('reseal').addEventListener('click', reseal);
    $('route').addEventListener('click', route);
    $('download').addEventListener('click', download);
    $('intent-json').addEventListener('input', function () {
      state.result = null;
      $('packet-result').hidden = true;
      notice('CHANGED · the old intent digest is now expected to fail until you explicitly reseal.', 'hold');
    });
    loadPilot();
    if (window.AXMHub) window.AXMHub.ready({ id: 'capability-recipe-foundry', name: 'Capability Recipe Foundry', version: 'v0.1', hubApiVersion: '1.0', permissions: [], savesState: false });
  }
  try { start(); }
  catch (error) {
    console.error(error);
    notice('BROKEN · ' + error.message, 'bad');
    if (window.AXMHub) window.AXMHub.error(error.message);
  }
}());
