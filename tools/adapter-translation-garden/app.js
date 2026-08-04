'use strict';

const search = document.getElementById('search');
const status = document.getElementById('status');
const catalog = document.getElementById('catalog');
const count = document.getElementById('result-count');
const empty = document.getElementById('empty');
let modules = [];

function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[character]);
}

function render() {
  const query = search.value.trim().toLowerCase();
  const wanted = status.value;
  const visible = modules.filter(module => {
    const haystack = [module.module_id, module.name, module.authority_mode, ...(module.hard_dependencies || [])].join(' ').toLowerCase();
    return (wanted === 'all' || module.status === wanted) && (!query || haystack.includes(query));
  });
  count.textContent = visible.length + (visible.length === 1 ? ' organ' : ' organs');
  empty.hidden = visible.length > 0;
  catalog.innerHTML = visible.map(module => {
    const shadow = module.status === 'SHADOW_ONLY';
    const dependencies = (module.hard_dependencies || []).length;
    return `<article class="organ${shadow ? ' shadow' : ''}">
      <div class="organ-head"><span class="number">${String(module.module_number).padStart(3, '0')}</span><span class="state">${shadow ? 'SHADOW LOCK' : 'WORKING'}</span></div>
      <h3>${escapeHtml(module.name)}</h3>
      <p>${escapeHtml(module.module_id)}</p>
      <div class="meta"><span>${escapeHtml(module.authority_mode)}</span><span>${dependencies} ${dependencies === 1 ? 'dependency' : 'dependencies'}</span><span>OFF BY DEFAULT</span></div>
    </article>`;
  }).join('');
}

fetch('runtime/LOCAL_INTAKE_INDEX.json', { cache: 'no-store' })
  .then(response => {
    if (!response.ok) throw new Error('catalog HTTP ' + response.status);
    return response.json();
  })
  .then(value => {
    modules = value.modules || [];
    render();
  })
  .catch(error => {
    count.textContent = 'Catalog unavailable';
    catalog.innerHTML = `<article class="organ shadow"><h3>Could not read the local catalog</h3><p>${escapeHtml(error.message)}</p></article>`;
  });

search.addEventListener('input', render);
status.addEventListener('change', render);
