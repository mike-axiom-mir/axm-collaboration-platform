'use strict';

const token = document.querySelector('meta[name="axm-learning-shell-token"]').content;
const stages = ['context', 'analysis', 'reasoning', 'seam', 'lesson', 'training', 'judgement'];
const labels = { context: 'Context', analysis: 'Analysis', reasoning: 'Reasoning', seam: 'Seam Review', lesson: 'Lesson', training: 'Training', judgement: 'Judgement' };
let catalog = null;
let session = null;

const $ = id => document.getElementById(id);
async function api(route, options = {}) {
  const response = await fetch(route, Object.assign({}, options, { headers: Object.assign({ authorization: `Bearer ${token}`, 'content-type': 'application/json' }, options.headers || {}) }));
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

function option(select, value, text) { const el = document.createElement('option'); el.value = value; el.textContent = text; select.appendChild(el); }
function metric(label, value) { return `<div class="metric"><b>${String(value)}</b><span>${label}</span></div>`; }

function formPayload() {
  const modules = {};
  stages.forEach(stage => { modules[stage] = stage === 'context' || $(`module-${stage}`).checked; });
  return {
    lessonId: $('lesson').value,
    reasoningProfile: $('profile').value,
    specialistMask: $('specialist').value || null,
    promptPack: $('prompt').value || null,
    modules,
    autoAdmitVerifiedLesson: true,
    tuning: {
      vocabSize: Number($('vocabSize').value), order: Number($('order').value),
      smoothingAlpha: Number($('smoothingAlpha').value)
    }
  };
}

function renderFoundation(bundle) {
  const cards = [
    ['Identity', bundle.identity.split('/').pop()],
    ['Roots', (bundle.roots.roots || []).length],
    ['Wisdom', bundle.wisdom.memories.length],
    ['Skills', bundle.skills.length],
    ['Specialists', bundle.specialists.masks.length],
    ['Profile', bundle.profile.linked ? 'OPTED IN' : 'NOT LINKED']
  ];
  $('identityGrid').innerHTML = cards.map(([label, value]) => `<div class="identity-card"><i>${label}</i><b>${value}</b><small>read-only linked input</small></div>`).join('');
}

function renderPipeline() {
  $('pipeline').innerHTML = stages.map(stage => {
    const done = session && session.completedStages.includes(stage);
    const skipped = done && session.summaries[stage] && session.summaries[stage].state === 'SKIPPED_BY_SESSION_CONFIGURATION';
    const hold = session && session.status === 'HOLD' && session.currentStage === stage;
    const active = session && session.nextStage === stage && !hold;
    const cls = skipped ? 'skipped' : hold ? 'hold' : done ? 'complete' : active ? 'active' : '';
    const detail = !session ? 'waiting' : hold ? 'held for repair' : skipped ? 'disabled' : done ? 'receipt ready' : active ? 'next' : 'waiting';
    return `<button class="stage ${cls}" data-stage="${stage}" ${done || hold ? '' : 'disabled'}><b>${labels[stage]}</b><small>${detail}</small></button>`;
  }).join('');
  document.querySelectorAll('.stage[data-stage]').forEach(button => button.addEventListener('click', () => inspect(button.dataset.stage)));
}

function renderSession() {
  renderPipeline();
  if (!session) return;
  $('sessionTitle').textContent = `${session.id} · ${session.status}`;
  $('nextStep').disabled = session.status === 'COMPLETE';
  $('runAll').disabled = session.status === 'COMPLETE';
  const last = session.currentStage && session.summaries[session.currentStage] || {};
  $('summary').className = 'summary';
  $('summary').innerHTML = `<div class="summary-grid">${metric('status', session.status)}${metric('next stage', session.nextStage || 'finished')}${metric('receipts', session.completedStages.length)}${metric('events', session.eventCount)}</div><p>${last.reason || last.verdict || last.state || 'Ready for the next bounded stage.'}</p>`;
}

async function inspect(stage) {
  if (!session || !session.artifacts[stage]) return;
  try {
    const data = await api(`/api/sessions/${encodeURIComponent(session.id)}/artifact/${encodeURIComponent(stage)}`);
    $('artifactTitle').textContent = `${labels[stage]} artifact`;
    $('artifactHash').textContent = session.artifacts[stage].sha256;
    $('artifact').textContent = JSON.stringify(data.artifact, null, 2);
  } catch (error) { $('artifact').textContent = error.message; }
}

async function createSession() {
  try {
    const data = await api('/api/sessions', { method: 'POST', body: JSON.stringify(formPayload()) });
    session = data.session;
    renderSession();
  } catch (error) { $('summary').textContent = error.message; }
}

async function run(route) {
  if (!session) return;
  $('nextStep').disabled = true; $('runAll').disabled = true;
  $('summary').textContent = route === 'run' ? 'Running the bounded route…' : 'Running one stage…';
  try {
    const payload = formPayload();
    const data = await api(`/api/sessions/${encodeURIComponent(session.id)}/${route}`, { method: 'POST', body: JSON.stringify({ tuning: payload.tuning, modules: payload.modules, selection: { reasoningProfile: payload.reasoningProfile, specialistMask: payload.specialistMask, promptPack: payload.promptPack } }) });
    session = data.session;
    renderSession();
    if (session.currentStage && session.artifacts[session.currentStage]) inspect(session.currentStage);
  } catch (error) { $('summary').textContent = error.message; renderSession(); }
}

async function init() {
  try {
    const health = await fetch('/api/health').then(response => response.json());
    $('health').textContent = health.ok ? 'LOCAL · READY' : 'HELD'; $('health').classList.toggle('ok', !!health.ok);
    const data = await api('/api/catalog'); catalog = data;
    renderFoundation(data.bundle);
    data.lessons.forEach(item => option($('lesson'), item.id, `${item.module} · ${item.goal}`));
    data.bundle.reasoning.profiles.forEach(item => option($('profile'), item.id, `${item.name}${item.placeholder ? ' · placeholder' : ''}`));
    data.bundle.specialists.masks.forEach(item => option($('specialist'), item.id, `${item.title} · ${item.category}`));
    data.bundle.promptPacks.forEach(item => option($('prompt'), item.id, item.title));
    $('profile').value = 'small-local-model';
    $('moduleSwitches').innerHTML = stages.map(stage => `<label class="switch"><input id="module-${stage}" type="checkbox" ${stage === 'context' ? 'checked disabled' : 'checked'}><span>${labels[stage]}</span></label>`).join('');
    renderPipeline();
  } catch (error) { $('health').textContent = 'HELD'; $('summary').textContent = error.message; }
}

$('newSession').addEventListener('click', createSession);
$('nextStep').addEventListener('click', () => run('step'));
$('runAll').addEventListener('click', () => run('run'));
init();
