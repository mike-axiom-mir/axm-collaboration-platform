'use strict';

(async function () {
  const list = document.getElementById('capability-list');
  const counts = { available: 0, degraded: 0, unavailable: 0, unknown: 0 };
  try {
    let response = await fetch('./phase0/capability-inventory.json', { cache: 'no-store' });
    if (location.port === '8903') {
      try { response = await fetch('./api/capabilities', { cache: 'no-store' }); } catch (error) {}
    }
    const inventory = await response.json();
    list.replaceChildren();
    for (const capability of inventory.capabilities) {
      counts[capability.status] = (counts[capability.status] || 0) + 1;
      const row = document.createElement('div');
      row.className = 'capability ' + capability.status;
      const dot = document.createElement('i');
      const name = document.createElement('strong');
      name.textContent = capability.id;
      const status = document.createElement('span');
      status.textContent = capability.status;
      row.title = capability.evidence || (capability.constraints || []).join('; ');
      row.append(dot, name, status);
      list.append(row);
    }
    document.getElementById('available-count').textContent = counts.available;
    document.getElementById('degraded-count').textContent = counts.degraded;
    document.getElementById('blocked-count').textContent = counts.unavailable + counts.unknown;
  } catch (error) {
    list.innerHTML = '<p class="loading">Capability inventory could not be read: ' + String(error.message || error) + '</p>';
  }

  const jobs = document.getElementById('job-list');
  try {
    const response = await fetch('./api/jobs', { cache: 'no-store' });
    if (!response.ok) throw new Error('dedicated server not active');
    const values = await response.json();
    jobs.replaceChildren();
    if (!values.length) jobs.innerHTML = '<p class="loading">No Phase 1 smoke job has been prepared yet.</p>';
    for (const value of values) {
      const row = document.createElement('div');
      row.className = 'job';
      const copy = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = value.job_id;
      const detail = document.createElement('p');
      detail.textContent = (value.status || 'UNKNOWN') + ' · canonical delivery remains receipt-gated';
      copy.append(title, detail);
      const link = document.createElement('a');
      link.href = value.smoke_url;
      link.textContent = 'Run smoke';
      row.append(copy, link);
      jobs.append(row);
    }
  } catch (error) {
    jobs.innerHTML = '<p class="loading">Run <code>node tools/modern-asset-forge/server.js</code> to expose prepared smoke jobs.</p>';
  }
}());
