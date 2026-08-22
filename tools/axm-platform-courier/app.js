'use strict';

const byId = id => document.getElementById(id);
let snapshot = null;

async function call(route, options) {
  const response = await fetch(route, options);
  const body = await response.json();
  if (!response.ok || !body.ok) throw new Error(body.error || 'Platform Connect request failed');
  return body.result;
}

function feedback(message, error) {
  const node = byId('feedback');
  node.textContent = message || '';
  node.classList.toggle('error', !!error);
}

function setBusy(busy) {
  ['refreshButton','saveButton','grantButton','revokeButton'].forEach(id => { byId(id).disabled = busy; });
}

function renderConnections(items) {
  const root = byId('connections');
  root.replaceChildren();
  if (!items.length) {
    const empty = document.createElement('p'); empty.className = 'empty'; empty.textContent = 'No courier requests recorded yet.'; root.appendChild(empty); return;
  }
  items.slice(0, 8).forEach(item => {
    const card = document.createElement('article'); card.className = 'connection';
    const title = document.createElement('strong'); title.textContent = item.label || item.provider;
    const route = document.createElement('small'); route.textContent = (item.provider || 'unknown') + ' · ' + (item.surface || 'shared-folder');
    const action = document.createElement('small'); action.textContent = (item.actionCount || 0) + ' actions · last ' + (item.lastAction || 'unknown');
    const seen = document.createElement('small'); seen.textContent = item.lastSeenAt ? new Date(item.lastSeenAt).toLocaleString() : 'No timestamp';
    card.append(title, route, action, seen); root.appendChild(card);
  });
}

function render(data) {
  snapshot = data;
  const status = data.status;
  const settings = data.settings;
  const live = byId('liveState');
  live.className = 'live ' + (status.ready ? 'ready' : 'off');
  live.querySelector('strong').textContent = status.ready ? 'Ready' : (status.serviceRunning ? 'Paused' : 'Offline');

  const select = byId('providerProfile');
  select.replaceChildren();
  data.providerProfiles.forEach(profile => {
    const option = document.createElement('option'); option.value = profile.id; option.textContent = profile.label + (profile.maturity === 'LIVE_PROVEN' ? ' · verified' : ' · compatible'); select.appendChild(option);
  });
  select.value = settings.providerProfile;
  byId('enabled').checked = settings.enabled;
  byId('allowRead').checked = settings.allowRead;
  byId('allowHands').checked = settings.allowHandInvocation;
  byId('allowPreviews').checked = settings.allowSafePreviews;
  byId('allowHeartbeat').checked = settings.allowHeartbeatStatus;
  byId('allowHolodeck').checked = settings.allowHolodeck;
  byId('receiptRetention').value = settings.receiptRetention;
  byId('mailboxPath').textContent = status.inbox;
  updateProviderSummary();

  const consent = status.consent;
  const state = byId('consentState');
  const dot = byId('consentDot').parentElement;
  dot.className = 'consent-state ' + (consent.granted ? 'granted' : 'revoked');
  state.textContent = consent.granted ? 'Access granted' : 'Access revoked';
  byId('consentDetail').textContent = consent.granted ? 'Granted locally to ' + (consent.subject || settings.providerProfile) + (consent.expiresAt ? ' until ' + new Date(consent.expiresAt).toLocaleString() : ' with no automatic expiry.') : 'No platform can use AXM through this courier until exact scopes are granted.';
  const scopes = byId('scopeList'); scopes.replaceChildren();
  (consent.scopes || []).forEach(value => { const node = document.createElement('span'); node.className = 'scope'; node.textContent = value; scopes.appendChild(node); });
  renderConnections(data.connections || []);
}

function updateProviderSummary() {
  if (!snapshot) return;
  const profile = snapshot.providerProfiles.find(item => item.id === byId('providerProfile').value);
  byId('providerSummary').textContent = profile ? profile.summary : 'Provider-neutral shared-folder contract.';
}

function settingsDraft() {
  return { enabled:byId('enabled').checked, providerProfile:byId('providerProfile').value, allowRead:byId('allowRead').checked, allowHandInvocation:byId('allowHands').checked, allowSafePreviews:byId('allowPreviews').checked, allowHeartbeatStatus:byId('allowHeartbeat').checked, allowHolodeck:byId('allowHolodeck').checked, receiptRetention:Number(byId('receiptRetention').value) };
}

async function refresh(message) {
  try { setBusy(true); render(await call('/api/platform-connect')); feedback(message || 'Status refreshed.'); }
  catch (error) { feedback(error.message, true); }
  finally { setBusy(false); }
}

async function mutate(route, header, confirmation, payload, success) {
  try {
    setBusy(true); feedback('Applying local change…');
    const result = await call(route, { method:'POST', headers:{ 'content-type':'application/json', 'x-axm-platform-connect':header, 'x-axm-actor':'platform-connect-settings-ui' }, body:JSON.stringify(Object.assign({ confirmation }, payload || {})) });
    render(result); feedback(success);
  } catch (error) { feedback(error.message, true); }
  finally { setBusy(false); }
}

byId('providerProfile').addEventListener('change', updateProviderSummary);
byId('refreshButton').addEventListener('click', () => refresh());
byId('saveButton').addEventListener('click', () => mutate('/api/platform-connect/settings', 'save-exact-settings', 'SAVE PLATFORM CONNECT SETTINGS', { settings:settingsDraft() }, 'Platform Connect settings saved locally.'));
byId('grantButton').addEventListener('click', () => {
  const draft = settingsDraft();
  const scopes = [];
  if (draft.allowRead) scopes.push('platform.read');
  if (draft.allowHandInvocation) scopes.push('platform.hands.invoke');
  mutate('/api/platform-connect/consent', 'grant-exact-scopes', 'GRANT AXM PLATFORM ACCESS', { scopes, subject:draft.providerProfile }, 'Exact selected scopes granted locally.');
});
byId('revokeButton').addEventListener('click', () => mutate('/api/platform-connect/revoke', 'revoke-platform-access', 'REVOKE AXM PLATFORM ACCESS', {}, 'Platform access revoked immediately.'));

refresh('Platform Connect loaded.');
