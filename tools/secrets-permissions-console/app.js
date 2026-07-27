(function () {
  'use strict';

  var O = AXMOps;
  var notice = document.getElementById('notice');
  var moduleSelect = document.getElementById('module');
  var permissionSelect = document.getElementById('permission');
  var grantButton = document.getElementById('grant');
  var grantConfirm = document.getElementById('grantConfirm');
  var reason = document.getElementById('reason');
  var revokeConfirm = document.getElementById('revokeConfirm');
  var revokeButton = document.getElementById('revokeSecret');
  var params = new URLSearchParams(location.search);
  var requestedModule = params.get('module') || '';
  var requestedPermission = params.get('permission') || '';
  var catalog = [];
  var permissionData = null;
  var vaultData = null;
  var revokeTargetId = null;
  var deepLinkApplied = false;

  function iso(id) {
    var value = document.getElementById(id).value;
    return value ? new Date(value).toISOString() : null;
  }

  function badge(label, tone) {
    return '<span class="badge ' + (tone || '') + '">' + O.esc(label) + '</span>';
  }

  function tone(state) {
    if (state === 'ALLOWED' || state === 'ACTIVE') return 'ok';
    if (state === 'UNDECIDED') return 'warn';
    return 'bad';
  }

  function selectedModule() {
    return catalog.find(function (item) { return item.moduleId === moduleSelect.value; }) || null;
  }

  function selectedPermissionState() {
    var item = selectedModule();
    return item && item.permissionStates.find(function (state) { return state.permission === permissionSelect.value; }) || null;
  }

  function syncGrantButton() {
    grantButton.disabled = !(moduleSelect.value && permissionSelect.value && reason.value.trim() && grantConfirm.value === 'SET MODULE PERMISSION');
  }

  function syncRevokeButton() {
    revokeButton.disabled = !(revokeTargetId && vaultData && vaultData.unlocked && revokeConfirm.value === 'REVOKE SECRET');
  }

  function permissionOptions(preferred) {
    var item = selectedModule();
    var prior = preferred || permissionSelect.value;
    permissionSelect.innerHTML = (item ? item.permissionStates : []).map(function (state) {
      return '<option value="' + O.esc(state.permission) + '">' + O.esc(state.permission) + ' · ' + O.esc(state.state) + '</option>';
    }).join('');
    if (item && item.permissions.includes(prior)) permissionSelect.value = prior;
    renderPermissionContext();
    syncGrantButton();
  }

  function renderPermissionContext() {
    var item = selectedModule();
    var state = selectedPermissionState();
    var target = document.getElementById('permissionContext');
    if (!item || !state) {
      target.innerHTML = '<p class="muted">This module declares no grantable permission.</p>';
      return;
    }
    var dependencies = item.dependencies.length
      ? item.dependencies.map(function (dependency) { var overlap = item.permissions.includes(dependency); return '<span class="dependency-chip' + (overlap ? ' overlaps' : '') + '">' + O.esc(dependency) + (overlap ? ' · separately declared permission' : '') + '</span>'; }).join('')
      : '<span class="muted">None declared.</span>';
    target.innerHTML =
      '<div class="context-title"><div><span class="section-kicker">' + O.esc(item.moduleId) + '</span><h3>' + O.esc(item.name) + '</h3></div>' + badge(state.state, tone(state.state)) + '</div>' +
      '<dl class="state-facts"><div><dt>Permission</dt><dd><code>' + O.esc(state.permission) + '</code></dd></div><div><dt>Effective now</dt><dd>' + (state.effective ? 'YES' : 'NO · DEFAULT DENY') + '</dd></div><div><dt>Reason</dt><dd>' + O.esc(state.reason || 'No decision recorded.') + '</dd></div><div><dt>Expiry</dt><dd>' + O.esc(state.expiresAt ? O.date(state.expiresAt) : 'No expiry') + '</dd></div></dl>' +
      '<div class="dependency-box"><strong>Dependencies · context only</strong><p>A dependency entry grants nothing by itself. An identical permission may be separately declared above.</p><div class="chip-row">' + dependencies + '</div></div>';
  }

  function renderPermissions(data) {
    permissionData = data;
    catalog = data.catalog || [];
    var summary = data.summary || {};
    document.getElementById('permissionFacts').innerHTML =
      '<span>' + (summary.declaredPermissions || 0) + ' declared</span><span>' + (summary.allowed || 0) + ' allowed</span><span>' + (summary.denied || 0) + ' denied</span><span>' + (summary.expired || 0) + ' expired</span><span>default ' + O.esc(data.defaultDecision || 'DENY') + '</span>';

    var previousModule = moduleSelect.value;
    var previousPermission = permissionSelect.value;
    var grantable = catalog.filter(function (item) { return item.permissions.length; });
    moduleSelect.innerHTML = grantable.map(function (item) { return '<option value="' + O.esc(item.moduleId) + '">' + O.esc(item.name) + ' · ' + O.esc(item.moduleId) + '</option>'; }).join('');

    var focus = document.getElementById('permissionFocus');
    if (!deepLinkApplied && requestedModule) {
      var requested = grantable.find(function (item) { return item.moduleId === requestedModule; });
      if (requested && (!requestedPermission || requested.permissions.includes(requestedPermission))) {
        moduleSelect.value = requestedModule;
        previousPermission = requestedPermission;
        focus.className = 'focus-note';
        focus.textContent = 'Requested permission review: ' + requestedModule + (requestedPermission ? ' · ' + requestedPermission : '') + '. This link selects context only; it does not grant anything.';
      } else {
        focus.className = 'focus-note bad';
        focus.textContent = 'Requested permission is not declared by that module. No grant action is available for it.';
      }
      deepLinkApplied = true;
    } else if (grantable.some(function (item) { return item.moduleId === previousModule; })) {
      moduleSelect.value = previousModule;
    }
    permissionOptions(previousPermission);

    document.getElementById('grants').innerHTML = (data.grants || []).map(function (grant) {
      return '<article class="ledger-card"><div class="ledger-card-title"><div><strong>' + O.esc(grant.moduleId) + '</strong><code>' + O.esc(grant.permission) + '</code></div>' + badge(grant.state, tone(grant.state)) + '</div><p>' + O.esc(grant.reason || 'No reason recorded.') + '</p><div class="card-meta"><span>By ' + O.esc(grant.grantedBy || 'unknown') + '</span><span>' + O.esc(O.date(grant.grantedAt)) + '</span><span>' + (grant.expiresAt ? 'Expires ' + O.esc(O.date(grant.expiresAt)) : 'No expiry') + '</span></div></article>';
    }).join('') || '<article class="empty-card">No decisions recorded. Every declared permission is denied by default.</article>';
  }

  function setRevokeTarget(id) {
    revokeTargetId = id || null;
    revokeConfirm.value = '';
    var record = vaultData && vaultData.records.find(function (item) { return item.id === revokeTargetId; });
    document.getElementById('revokeTarget').textContent = record ? 'Selected: ' + record.label + ' · ' + record.id + '. Revocation removes the encrypted value.' : 'No secret selected.';
    syncRevokeButton();
  }

  function renderVault(vault) {
    vaultData = vault;
    document.getElementById('vaultFacts').innerHTML =
      '<span>' + (vault.initialized ? 'INITIALIZED' : 'NOT INITIALIZED') + '</span><span>' + (vault.unlocked ? 'UNLOCKED' : 'LOCKED') + '</span><span>' + vault.records.length + ' secret(s)</span>' + (vault.unlockedUntil ? '<span>locks ' + O.esc(O.date(vault.unlockedUntil)) + '</span>' : '');
    document.getElementById('initialize').disabled = vault.initialized;
    document.getElementById('unlock').disabled = !vault.initialized || vault.unlocked;
    document.getElementById('lock').disabled = !vault.unlocked;
    document.getElementById('store').disabled = !vault.unlocked;

    document.getElementById('secrets').innerHTML = vault.records.map(function (record) {
      var canRevoke = record.state !== 'REVOKED';
      return '<article class="ledger-card secret-card"><div class="ledger-card-title"><div><strong>' + O.esc(record.label) + '</strong><code>' + O.esc(record.id) + '</code></div>' + badge(record.state, tone(record.state)) + '</div><dl class="compact-facts"><div><dt>Scopes</dt><dd>' + O.esc(record.scopes.join(', ')) + '</dd></div><div><dt>Fingerprint</dt><dd><code>' + O.esc(record.fingerprint) + '</code></dd></div><div><dt>Expiry</dt><dd>' + O.esc(record.expiresAt ? O.date(record.expiresAt) : 'No expiry') + '</dd></div></dl>' + (canRevoke ? '<button class="secondary prepare-revoke" data-id="' + O.esc(record.id) + '">Prepare revoke</button>' : '') + '</article>';
    }).join('') || '<article class="empty-card">No secret metadata. Stored values will never appear here.</article>';

    document.querySelectorAll('.prepare-revoke').forEach(function (button) {
      button.onclick = function () { setRevokeTarget(this.dataset.id); document.getElementById('revokeTarget').scrollIntoView({ block: 'center' }); };
    });
    if (revokeTargetId && !vault.records.some(function (item) { return item.id === revokeTargetId && item.state !== 'REVOKED'; })) setRevokeTarget(null);
    else syncRevokeButton();
  }

  function load() {
    return Promise.all([O.get('/api/secrets'), O.get('/api/permissions')]).then(function (all) {
      renderVault(all[0]);
      renderPermissions(all[1]);
    }).catch(function (error) { O.notice(notice, error.message, 'bad'); });
  }

  moduleSelect.onchange = function () { permissionOptions(''); };
  permissionSelect.onchange = function () { renderPermissionContext(); syncGrantButton(); };
  reason.oninput = syncGrantButton;
  grantConfirm.oninput = syncGrantButton;
  revokeConfirm.oninput = syncRevokeButton;
  document.getElementById('refresh').onclick = load;

  document.getElementById('initialize').onclick = function () {
    var field = document.getElementById('passphrase');
    var passphrase = field.value;
    field.value = '';
    O.post('/api/secrets/initialize', { passphrase: passphrase }, { 'x-axm-secrets': 'explicit-initialize' }).then(function () {
      O.notice(notice, 'Encrypted vault initialized and temporarily unlocked.', 'ok'); return load();
    }).catch(function (error) { O.notice(notice, error.message, 'bad'); });
  };

  document.getElementById('unlock').onclick = function () {
    var field = document.getElementById('passphrase');
    var passphrase = field.value;
    field.value = '';
    O.post('/api/secrets/unlock', { passphrase: passphrase }, { 'x-axm-secrets': 'explicit-unlock' }).then(function () {
      O.notice(notice, 'Vault unlocked for 15 minutes.', 'ok'); return load();
    }).catch(function (error) { O.notice(notice, error.message, 'bad'); });
  };

  document.getElementById('lock').onclick = function () {
    O.post('/api/secrets/lock', {}, { 'x-axm-secrets': 'explicit-lock' }).then(function () {
      O.notice(notice, 'Vault key cleared from memory.', 'ok'); return load();
    }).catch(function (error) { O.notice(notice, error.message, 'bad'); });
  };

  document.getElementById('store').onclick = function () {
    var valueField = document.getElementById('secretValue');
    var value = valueField.value;
    valueField.value = '';
    O.post('/api/secrets/upsert', {
      id: document.getElementById('secretId').value,
      label: document.getElementById('secretLabel').value,
      value: value,
      scopes: document.getElementById('scopes').value.split(',').map(function (scope) { return scope.trim(); }).filter(Boolean),
      expiresAt: iso('secretExpiry')
    }, { 'x-axm-secrets': 'explicit-store' }).then(function (record) {
      O.notice(notice, record.id + ' encrypted. Browser received metadata only.', 'ok'); return load();
    }).catch(function (error) { O.notice(notice, error.message, 'bad'); });
  };

  grantButton.onclick = function () {
    O.post('/api/permissions/decision', {
      moduleId: moduleSelect.value,
      permission: permissionSelect.value,
      allowed: document.getElementById('allowed').value === 'true',
      reason: reason.value,
      expiresAt: iso('grantExpiry'),
      confirmation: grantConfirm.value
    }, { 'x-axm-permission': 'explicit-decision' }).then(function (decision) {
      O.notice(notice, (decision.allowed ? 'Allowed ' : 'Denied ') + decision.permission + ' for ' + decision.moduleId + '.', 'ok');
      reason.value = '';
      grantConfirm.value = '';
      return load();
    }).catch(function (error) { O.notice(notice, error.message, 'bad'); });
  };

  revokeButton.onclick = function () {
    O.post('/api/secrets/revoke', { id: revokeTargetId, confirmation: revokeConfirm.value }, { 'x-axm-secrets': 'explicit-revoke' }).then(function () {
      O.notice(notice, 'Secret revoked; its encrypted value is no longer available.', 'ok');
      setRevokeTarget(null);
      return load();
    }).catch(function (error) { O.notice(notice, error.message, 'bad'); });
  };

  load();
}());
