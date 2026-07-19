(function (root) {
  'use strict';
  function json(url, options) {
    return fetch(url, Object.assign({ cache: 'no-store' }, options || {})).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (body) {
        if (!response.ok) throw new Error(body.error || ('profile HTTP ' + response.status));
        return body;
      });
    });
  }
  function announce(name, detail) {
    if (!root.dispatchEvent || typeof root.CustomEvent !== 'function') return;
    root.dispatchEvent(new root.CustomEvent(name, { detail: detail || {} }));
  }
  function current() { return json('/api/profile').then(function (r) { return r.profile; }); }
  function health() { return json('/api/profile/health').then(function (r) { return r.health; }); }
  function key(v) { return String(v == null ? '' : v).trim().toLowerCase(); }
  function resolve(profile, candidates) {
    var members = profile.members || [], out = [];
    (Array.isArray(candidates) ? candidates : []).forEach(function (candidate) {
      var raw = typeof candidate === 'string' ? { id: candidate, name: candidate } : (candidate || {});
      var id = key(raw.id), name = key(raw.name);
      var found = members.find(function (m) { return key(m.id) === id || (name && key(m.name) === name); });
      if (found && out.indexOf(found.id) < 0) out.push(found.id);
    });
    return out;
  }
  function optIn(input) {
    return json('/api/profile/opt-in', {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-axm-profile': 'local-opt-in' }, body: JSON.stringify(input || {})
    }).then(function (result) { announce('axm:profile-changed', result); return result; });
  }
  function optOut(decidedBy) {
    return json('/api/profile/opt-out', {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-axm-profile': 'local-opt-out' }, body: JSON.stringify({ decidedBy: decidedBy || 'local-human' })
    }).then(function (result) { announce('axm:profile-changed', result); return result; });
  }
  function syncMembers(members) {
    return json('/api/profile/members', {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-axm-profile': 'sync-local-members' }, body: JSON.stringify({ members: Array.isArray(members) ? members : [] })
    }).then(function (result) { announce('axm:profile-changed', result); return result; });
  }
  function record(input) {
    input = input || {};
    var hasCandidates = Array.isArray(input.candidates) && input.candidates.length;
    var route = hasCandidates ? '/api/profile/receipt' : '/api/profile/event';
    var receipt = hasCandidates ? 'local-module-receipt' : 'signed-local-receipt';
    return json(route, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-axm-profile-event': receipt },
        body: JSON.stringify(input)
      }).then(function (result) { announce('axm:profile-receipt', result); return result; });
  }
  function recordCodeTask(input) {
    input = input || {};
    var actor = String(input.actorId || '').trim(), count = Math.floor(Number(input.count)), mood = String(input.codeMood || '').trim();
    if (!actor) return Promise.reject(new Error('code task actor is required'));
    if (!Number.isFinite(count) || count < 1) return Promise.reject(new Error('exact positive code character count is required'));
    if (['infrastructure', 'entertainment', 'software'].indexOf(mood) < 0) return Promise.reject(new Error('code task purpose is required'));
    var files = (Array.isArray(input.files) ? input.files : []).map(String).filter(Boolean).slice(0, 100);
    var taskId = String(input.taskId || '').trim(), evidence = String(input.evidence || '').trim();
    if (!taskId) return Promise.reject(new Error('stable code task id is required'));
    if (!evidence && files.length) evidence = 'Reviewed task files: ' + files.join(', ');
    if (!evidence) return Promise.reject(new Error('review evidence or task files are required'));
    return record({ type: 'code-characters', codeMood: mood, count: count, dedupeKey: 'code-task:' + actor + ':' + taskId, participants: [actor], actorId: actor, evidence: evidence, source: String(input.source || 'AXM code task receipt'), meta: { codeMood: mood, taskId: taskId, files: files } });
  }
  root.AXMProfile = {
    current: current, health: health, resolve: resolve, optIn: optIn, optOut: optOut,
    syncMembers: syncMembers, record: record, recordCodeTask: recordCodeTask
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
