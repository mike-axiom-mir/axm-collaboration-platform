'use strict';

const API = '/services/discord-bridge';
const actor = { id: 'mike-local-owner', kind: 'human', name: 'Mike' };
let current = null;

const $ = id => document.getElementById(id);
async function request(path, options) {
  const response = await fetch(API + path, Object.assign({ headers: { 'content-type': 'application/json' } }, options || {}));
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.ok === false) throw new Error(body.error || 'Local Discord Bridge request failed');
  return body;
}
function notice(message, error) {
  const box = $('notice'); box.hidden = false; box.textContent = message; box.className = 'notice' + (error ? ' error' : '');
  clearTimeout(notice.timer); notice.timer = setTimeout(() => { box.hidden = true; }, 7000);
}
function truth(label, value, state) { return '<div class="truth ' + state + '"><b>' + label + '</b><span>' + value + '</span></div>'; }
function escape(value) { return String(value == null ? '' : value).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }

function render(data) {
  current = data;
  const s = data.settings, r = data.runtime;
  $('applicationId').value = s.applicationId || '';
  $('guildId').value = s.guildId || '';
  $('channelId').value = s.channelId || '';
  $('enabled').checked = s.enabled;
  $('commandsEnabled').checked = s.commandsEnabled;
  $('feedPostingEnabled').checked = s.feedPostingEnabled;
  $('lessonIntakeEnabled').checked = s.lessonIntakeEnabled;
  $('installLink').href = data.installUrl || '#';
  $('installLink').textContent = data.installUrl ? 'Install AXM app in Discord ↗' : 'Enter Application ID first';
  $('installLink').classList.toggle('disabled', !data.installUrl);
  $('connectionText').textContent = r.connected ? 'READY as ' + (r.bot && r.bot.username || 'AXM bot') : (r.state + (r.lastError ? ' · ' + r.lastError : ''));
  $('truthGrid').innerHTML = [
    truth('Package default', 'OFF', 'good'),
    truth('Bot token', data.botTokenConfigured ? 'stored locally' : 'not stored', data.botTokenConfigured ? 'good' : 'warn'),
    truth('Gateway', r.state, r.connected ? 'good' : 'warn'),
    truth('Ordinary chat', 'not readable', 'good'),
    truth('Slash commands', s.commandsEnabled ? 'opted in' : 'off', s.commandsEnabled ? 'good' : 'warn'),
    truth('Receipt feed', s.feedPostingEnabled ? 'opted in' : 'off', s.feedPostingEnabled ? 'good' : 'warn'),
    truth('Training', 'never automatic', 'good'),
    truth('Proposals', data.proposalCount + ' waiting/recorded', 'warn')
  ].join('');
  $('pause').disabled = s.paused && !r.connected;
}
async function refresh() { try { render(await request('/v1/status')); } catch (error) { notice(error.message + '. Start AXM with START_AXM_FULL.bat so the optional sidecar is available.', true); } }
async function saveSettings(patch) {
  const body = await request('/v1/settings', { method: 'POST', body: JSON.stringify({ settings: patch, actor }) });
  await refresh(); return body;
}

$('settingsForm').addEventListener('submit', async event => {
  event.preventDefault();
  try { await saveSettings({ applicationId: $('applicationId').value, guildId: $('guildId').value, channelId: $('channelId').value }); notice('Discord routing IDs saved locally.'); }
  catch (error) { notice(error.message, true); }
});
$('tokenForm').addEventListener('submit', async event => {
  event.preventDefault();
  try {
    await request('/v1/token', { method: 'POST', body: JSON.stringify({ token: $('botToken').value, actor }) });
    $('botToken').value = ''; await refresh(); notice('Bot token stored locally. It will never be shown back in the browser.');
  } catch (error) { notice(error.message, true); }
});
$('saveLanes').addEventListener('click', async () => {
  try { await saveSettings({ enabled: $('enabled').checked, commandsEnabled: $('commandsEnabled').checked, feedPostingEnabled: $('feedPostingEnabled').checked, lessonIntakeEnabled: $('lessonIntakeEnabled').checked }); notice('Permission lanes saved. The connector is still paused until you connect.'); }
  catch (error) { notice(error.message, true); }
});
$('connect').addEventListener('click', async () => {
  try {
    await saveSettings({ enabled: $('enabled').checked, commandsEnabled: $('commandsEnabled').checked, feedPostingEnabled: $('feedPostingEnabled').checked, lessonIntakeEnabled: $('lessonIntakeEnabled').checked, paused: false });
    await request('/v1/control', { method: 'POST', body: JSON.stringify({ action: 'connect', actor }) });
    await refresh(); notice('Discord Bridge connected by explicit human action.');
  } catch (error) { await refresh(); notice(error.message, true); }
});
$('disconnect').addEventListener('click', async () => { try { await request('/v1/control', { method: 'POST', body: JSON.stringify({ action: 'disconnect', actor }) }); await refresh(); notice('Discord disconnected. Settings remain saved.'); } catch (error) { notice(error.message, true); } });
$('pause').addEventListener('click', async () => { try { await request('/v1/control', { method: 'POST', body: JSON.stringify({ action: 'pause', actor }) }); await refresh(); notice('All outbound Discord activity is paused.'); } catch (error) { notice(error.message, true); } });
$('refresh').addEventListener('click', refresh);
$('loadProposals').addEventListener('click', async () => {
  try {
    const data = await request('/v1/proposals');
    $('proposals').innerHTML = data.proposals.length ? data.proposals.map(item => '<article class="proposal"><p>' + escape(item.body) + '</p><small>' + escape(item.author.displayName) + ' · ' + escape(item.createdAt) + ' · ' + escape(item.state) + '<br>Not trained · Not executed</small></article>').join('') : '<div class="empty">No Discord proposals yet.</div>';
  } catch (error) { notice(error.message, true); }
});
$('loadWidget').addEventListener('click', () => {
  const frame = $('discordWidget');
  frame.src = frame.dataset.src;
  frame.hidden = false;
  $('widgetGate').hidden = true;
  notice('Public Discord community window loaded. The controlled bot bridge remains a separate lane.');
});

refresh();
