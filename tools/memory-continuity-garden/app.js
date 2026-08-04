'use strict';

const state = { catalog: null };
const $ = id => document.getElementById(id);
const escapeHtml = value => String(value).replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));

function metric(value, label) {
  return `<div class="metric"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></div>`;
}

function render() {
  const term = $('search').value.trim().toLowerCase();
  const risk = $('risk').value;
  const posture = $('posture').value;
  const rows = state.catalog.candidates.filter(row => {
    const haystack = [row.stable_id,row.name,row.category,row.purpose,row.posture].join(' ').toLowerCase();
    return (!term || haystack.includes(term)) && (!risk || row.risk === risk) && (!posture || row.posture === posture);
  });
  $('status').textContent = `${rows.length} of ${state.catalog.counts.candidates} reference contracts visible`;
  $('catalog').innerHTML = rows.map(row => `
    <button class="card" data-id="${escapeHtml(row.stable_id)}">
      <span class="number">${String(row.number).padStart(3,'0')} / ${escapeHtml(row.stable_id)}</span>
      <h2>${escapeHtml(row.name)}</h2>
      <p>${escapeHtml(row.purpose)}</p>
      <div class="badges"><span class="badge ${row.risk}">${row.risk}</span><span class="badge ${row.integration_status}">${row.integration_status.replaceAll('_',' ')}</span></div>
    </button>`).join('');
  document.querySelectorAll('.card').forEach(card => card.addEventListener('click', () => show(card.dataset.id)));
}

function show(id) {
  const row = state.catalog.candidates.find(item => item.stable_id === id);
  $('detailBody').innerHTML = `
    <p class="eyebrow">REFERENCE CONTRACT ${String(row.number).padStart(3,'0')}</p>
    <h2>${escapeHtml(row.name)}</h2>
    <p>${escapeHtml(row.purpose)}</p>
    <div class="detail-grid">
      ${[['Stable ID',row.stable_id],['Risk',row.risk],['Posture',row.posture],['Authority',row.authority],['Operation',row.operation_kind],['Integration',row.integration_status]].map(([label,value]) => `<div class="detail-field"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join('')}
    </div>
    <h3>Owner route</h3><p>${escapeHtml(row.target)}</p>
    <h3>Honest boundary</h3><p class="boundary">This is a sealed, reviewable reference contract. It is not an executable semantic memory implementation and receives no authority by being present in AXM.</p>`;
  $('detail').showModal();
}

async function boot() {
  const response = await fetch('catalog.json', {cache:'no-store'});
  if (!response.ok) throw new Error(`catalog ${response.status}`);
  state.catalog = await response.json();
  $('metrics').innerHTML = [
    metric(state.catalog.counts.candidates,'unique candidates'),
    metric(state.catalog.counts.reference_available,'available for review'),
    metric(state.catalog.counts.governance_holds,'governance holds'),
    metric(state.catalog.counts.semantic_executables,'semantic executables')
  ].join('');
  Object.keys(state.catalog.posture_distribution).forEach(value => $('posture').insertAdjacentHTML('beforeend', `<option>${escapeHtml(value)}</option>`));
  ['search','risk','posture'].forEach(id => $(id).addEventListener(id === 'search' ? 'input' : 'change', render));
  $('close').addEventListener('click', () => $('detail').close());
  render();
}

boot().catch(error => { $('status').textContent = `Catalog unavailable: ${error.message}`; });
