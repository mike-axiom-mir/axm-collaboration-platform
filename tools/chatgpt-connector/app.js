(function () {
  'use strict';

  var Core = window.ChatGPTConnectorCore;
  var STORE = 'axm.chatgpt-connector.v1';
  var selectedFile = null;
  var selectedDataUrl = '';
  var selectedImageWidth = 0;
  var selectedImageHeight = 0;
  var currentPrompt = '';
  var currentStatus = {};
  var gameHubReady = false;
  var savedTargetGame = '';

  function $(id) { return document.getElementById(id); }
  function yesNo(value) { return value === true ? 'YES' : value === false ? 'NO' : 'UNKNOWN'; }
  function size(bytes) {
    return bytes < 1024 ? bytes + ' B' : bytes < 1048576 ? (bytes / 1024).toFixed(1) + ' KiB' : (bytes / 1048576).toFixed(2) + ' MiB';
  }
  function draft() {
    return {
      name: $('assetName').value,
      targetGame: $('targetGame').value,
      brief: $('visualBrief').value,
      width: $('assetWidth').value,
      height: $('assetHeight').value,
      style: $('assetStyle').value,
      transparent: $('transparentBackground').checked,
      hardEdges: $('hardEdges').checked
    };
  }
  function saveDraft() {
    try { localStorage.setItem(STORE, JSON.stringify(draft())); } catch (error) {}
  }
  function loadDraft() {
    try {
      var data = JSON.parse(localStorage.getItem(STORE) || 'null');
      if (!data) return;
      $('assetName').value = data.name || '';
      savedTargetGame = data.targetGame || '';
      $('visualBrief').value = data.brief || '';
      $('assetWidth').value = Core.dimension(data.width || 1024);
      $('assetHeight').value = Core.dimension(data.height || 1024);
      if (data.style) $('assetStyle').value = data.style;
      $('transparentBackground').checked = data.transparent !== false;
      $('hardEdges').checked = data.hardEdges !== false;
    } catch (error) {}
  }
  function updatePrompt() {
    saveDraft();
    try {
      currentPrompt = Core.buildPrompt(draft());
      $('promptOutput').value = currentPrompt;
      $('copyPrompt').disabled = false;
    } catch (error) {
      currentPrompt = '';
      $('promptOutput').value = '';
      $('copyPrompt').disabled = true;
    }
    $('promptCount').textContent = currentPrompt.length + ' chars';
    if (selectedFile) renderFileMeta();
    updateStageButton();
  }
  function updateStageButton() {
    $('stageAsset').disabled = !(gameHubReady && selectedDataUrl && selectedImageWidth && selectedImageHeight && currentPrompt && $('assetName').value.trim() && $('targetGame').value);
  }
  function renderStatus(payload) {
    currentStatus = payload && (payload.status || payload) || {};
    var seat = Core.codingSeat(currentStatus);
    var proved = Core.tunnelProven(currentStatus);
    var hasSeatStatus = !!(currentStatus.codingSeat || currentStatus.codex || currentStatus.schema);
    var appOpen = currentStatus.chatApp && typeof currentStatus.chatApp.appOpen === 'boolean' ? currentStatus.chatApp.appOpen : null;
    $('codexLabel').textContent = hasSeatStatus ? seat.label : 'STATUS UNAVAILABLE';
    $('codexDetail').textContent = !hasSeatStatus ? 'The bounded local status endpoint did not return a coding-seat result.' : seat.authenticated ? (seat.authMode === 'chatgpt' ? 'Codex sign-in was verified as ChatGPT.' : 'Codex sign-in was verified; the authentication method was not reported.') : seat.installed ? 'Codex was found, but sign-in was not verified.' : 'No usable local Codex seat was proved.';
    $('codexChip').textContent = !hasSeatStatus ? 'UNKNOWN' : seat.authenticated && seat.accessible ? 'READY' : seat.installed ? 'CHECK SIGN-IN' : 'OFFLINE';
    $('codexChip').className = 'status-chip ' + (hasSeatStatus && seat.authenticated && seat.accessible ? 'ready' : hasSeatStatus ? 'offline' : 'checking');
    $('factInstalled').textContent = hasSeatStatus ? yesNo(seat.installed) : 'UNKNOWN';
    $('factAccessible').textContent = hasSeatStatus ? yesNo(seat.accessible) : 'UNKNOWN';
    $('factAuth').textContent = !hasSeatStatus ? 'UNKNOWN' : seat.authenticated ? (seat.authMode ? seat.authMode.toUpperCase() : 'VERIFIED · MODE UNREPORTED') : 'UNPROVEN';
    $('factChatApp').textContent = yesNo(appOpen);
    $('platformState').textContent = proved ? 'MCP TUNNEL PROVED' : 'MANUAL HANDOFF';
    $('platformState').style.color = proved ? 'var(--green)' : 'var(--gold)';
    $('platformLamp').className = 'lamp ' + (proved ? 'connected' : 'manual');
    $('handoffChip').textContent = proved ? 'PLATFORM CONNECTED' : 'MANUAL HANDOFF';
    $('handoffChip').className = 'status-chip ' + (proved ? 'ready' : 'manual');
    $('statusLine').textContent = 'Last checked ' + new Date().toLocaleTimeString() + ' · process presence is never promoted to platform connectivity.';
  }
  async function refreshStatus() {
    $('refreshStatus').disabled = true;
    $('statusLine').textContent = 'Checking the bounded local status endpoint…';
    try {
      var response = await fetch('/api/chatgpt-connector/status', { cache: 'no-store' });
      var data = await response.json();
      if (!response.ok || data.ok === false) throw new Error(data.error || ('HTTP ' + response.status));
      renderStatus(data);
    } catch (error) {
      renderStatus({});
      $('statusLine').textContent = 'Status endpoint unavailable · ' + error.message;
    } finally { $('refreshStatus').disabled = false; }
  }
  async function loadGames() {
    var select = $('targetGame');
    try {
      var response = await fetch('/game-api/games', { cache: 'no-store' });
      var data = await response.json();
      if (!response.ok || data.ok === false) throw new Error(data.error || ('HTTP ' + response.status));
      var games = Array.isArray(data.games) ? data.games : [];
      if (!games.length) throw new Error('no installed games reported');
      select.innerHTML = '';
      var placeholder = document.createElement('option');
      placeholder.value = ''; placeholder.textContent = 'Select an installed game'; select.appendChild(placeholder);
      games.forEach(function (game) {
        var id = Core.clean(game.game_id || game.id || '', 120);
        var name = Core.clean(game.title || game.name || id, 120);
        if (!id) return;
        var option = document.createElement('option');
        option.value = id; option.textContent = name + ' · ' + id; select.appendChild(option);
      });
      select.disabled = false;
      if (savedTargetGame && Array.from(select.options).some(function (option) { return option.value === savedTargetGame; })) select.value = savedTargetGame;
      gameHubReady = true;
      $('gameHubState').textContent = games.length + ' installed games available.';
      $('gameHubState').className = 'field-state';
    } catch (error) {
      gameHubReady = false;
      select.innerHTML = '<option value="">Game Hub offline</option>';
      select.disabled = true;
      $('gameHubState').textContent = 'Game Hub unavailable · staging is disabled.';
      $('gameHubState').className = 'field-state offline';
    }
    updatePrompt();
  }
  async function copyPrompt() {
    if (!currentPrompt) return;
    try {
      await navigator.clipboard.writeText(currentPrompt);
      $('copyPrompt').textContent = 'Copied';
      setTimeout(function () { $('copyPrompt').textContent = 'Copy prompt'; }, 1400);
    } catch (error) {
      $('promptOutput').focus(); $('promptOutput').select();
      $('stageState').textContent = 'Clipboard permission was unavailable. The prompt is selected for manual copy.';
    }
  }
  function decodeImage(dataUrl) {
    return new Promise(function (resolve, reject) {
      var image = new Image();
      image.onload = function () {
        if (!image.naturalWidth || !image.naturalHeight) return reject(new Error('decoded image has no dimensions'));
        resolve({ width: image.naturalWidth, height: image.naturalHeight });
      };
      image.onerror = function () { reject(new Error('browser could not decode the PNG structure')); };
      image.src = dataUrl;
    });
  }
  function renderFileMeta() {
    if (!selectedFile || !selectedImageWidth || !selectedImageHeight) return;
    var requestedWidth = Core.dimension($('assetWidth').value);
    var requestedHeight = Core.dimension($('assetHeight').value);
    var mismatch = requestedWidth !== selectedImageWidth || requestedHeight !== selectedImageHeight;
    $('fileMeta').textContent = selectedFile.name + ' · ' + size(selectedFile.size) + ' · actual ' + selectedImageWidth + '×' + selectedImageHeight + ' · requested ' + requestedWidth + '×' + requestedHeight + (mismatch ? ' · DIMENSIONS DIFFER' : ' · dimensions match');
  }
  function readFile(file) {
    selectedFile = null; selectedDataUrl = ''; selectedImageWidth = 0; selectedImageHeight = 0; updateStageButton();
    $('stageState').className = 'stage-state';
    $('postStageActions').hidden = true;
    $('stageAsset').hidden = false;
    if (!file) return;
    if (file.size > Core.MAX_PNG_BYTES) return fileError('PNG is larger than the 6 MiB handoff limit.');
    var bytesReader = new FileReader();
    bytesReader.onload = function () {
      var bytes = new Uint8Array(bytesReader.result);
      if (!Core.isPngBytes(bytes)) return fileError('File refused: it is not a real PNG.');
      var dataReader = new FileReader();
      dataReader.onload = async function () {
        try {
          var decoded = await decodeImage(dataReader.result);
          selectedFile = file;
          selectedDataUrl = dataReader.result;
          selectedImageWidth = decoded.width;
          selectedImageHeight = decoded.height;
          $('assetPreview').src = selectedDataUrl;
          $('assetPreview').hidden = false;
          $('dropCopy').hidden = true;
          renderFileMeta();
          $('stageState').textContent = 'Browser-decoded PNG ready to stage as a proposal. It is not installed.';
          updateStageButton();
        } catch (error) { fileError('File refused: ' + error.message + '.'); }
      };
      dataReader.readAsDataURL(file);
    };
    bytesReader.readAsArrayBuffer(file);
  }
  function fileError(message) {
    selectedFile = null; selectedDataUrl = ''; selectedImageWidth = 0; selectedImageHeight = 0;
    $('assetPreview').hidden = true;
    $('assetPreview').removeAttribute('src');
    $('dropCopy').hidden = false;
    $('fileMeta').textContent = 'No valid image selected.';
    $('stageState').textContent = message;
    $('stageState').className = 'stage-state error';
    updateStageButton();
  }
  function resetAsset() {
    selectedFile = null; selectedDataUrl = ''; selectedImageWidth = 0; selectedImageHeight = 0;
    $('assetFile').value = '';
    $('assetPreview').hidden = true;
    $('assetPreview').removeAttribute('src');
    $('dropCopy').hidden = false;
    $('fileMeta').textContent = 'No image selected. Nothing has been staged.';
    $('assetName').value = '';
    $('visualBrief').value = '';
    $('postStageActions').hidden = true;
    $('stageAsset').hidden = false;
    $('stageState').className = 'stage-state';
    $('stageState').textContent = 'Ready for another proposal. Game Hub review is always required.';
    updatePrompt();
    $('assetName').focus();
  }
  async function stageAsset() {
    $('stageAsset').disabled = true;
    $('stageState').className = 'stage-state';
    $('stageState').textContent = 'Staging proposal…';
    try {
      var packet = Core.buildPacket({
        name: $('assetName').value,
        targetGameId: $('targetGame').value,
        fileName: selectedFile && selectedFile.name,
        prompt: currentPrompt,
        dataUrl: selectedDataUrl,
        requestedDimensions: Core.dimension($('assetWidth').value) + 'x' + Core.dimension($('assetHeight').value),
        actualDimensions: selectedImageWidth + 'x' + selectedImageHeight,
        tunnelProven: Core.tunnelProven(currentStatus)
      });
      var response = await fetch('/game-api/assets/handoff', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(packet) });
      var data = await response.json().catch(function () { return {}; });
      if (!response.ok || !data.ok) throw new Error(data.error || ('HTTP ' + response.status));
      $('stageState').textContent = 'Proposal staged as ' + data.handoff.id + '. Open Game Hub to review and accept it.';
      $('stageState').className = 'stage-state success';
      $('stageAsset').hidden = true;
      $('postStageActions').hidden = false;
      if (window.AXMHub) AXMHub.log('ChatGPT Connector staged proposal ' + data.handoff.id + ' for ' + packet.target_game_id);
    } catch (error) {
      $('stageState').textContent = 'Proposal was not staged: ' + error.message;
      $('stageState').className = 'stage-state error';
      updateStageButton();
    }
  }

  $('promptForm').addEventListener('input', updatePrompt);
  $('copyPrompt').onclick = copyPrompt;
  $('refreshStatus').onclick = refreshStatus;
  $('stageAsset').onclick = stageAsset;
  $('resetAsset').onclick = resetAsset;
  $('dropZone').onclick = function () { $('assetFile').click(); };
  $('dropZone').onkeydown = function (event) { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); $('assetFile').click(); } };
  $('assetFile').onchange = function () { readFile(this.files && this.files[0]); };
  ['dragenter', 'dragover'].forEach(function (name) { $('dropZone').addEventListener(name, function (event) { event.preventDefault(); $('dropZone').classList.add('drag'); }); });
  ['dragleave', 'drop'].forEach(function (name) { $('dropZone').addEventListener(name, function (event) { event.preventDefault(); $('dropZone').classList.remove('drag'); }); });
  $('dropZone').addEventListener('drop', function (event) { readFile(event.dataTransfer.files && event.dataTransfer.files[0]); });

  loadDraft(); loadGames(); refreshStatus();
  if (window.AXMHub) {
    AXMHub.onInit(function () { AXMHub.log('ChatGPT Connector ready · manual visual handoff unless tunnel proved'); });
    AXMHub.ready({ id: 'chatgpt-connector', name: 'ChatGPT Connector', version: 'v0.1', hubApiVersion: '1.0', permissions: [], savesState: false, handlesShutdown: false });
  }
}());
