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
  function current() { return json('/api/profile').then(function (r) { return r.profile; }); }
  function key(v) { return String(v == null ? '' : v).trim().toLowerCase(); }
  function resolve(profile, candidates) {
    var members = profile.members || [], out = [];
    (Array.isArray(candidates) ? candidates : []).forEach(function (candidate) {
      var raw = typeof candidate === 'string' ? { id: candidate, name: candidate } : (candidate || {});
      var id = key(raw.id), name = key(raw.name);
      var found = members.find(function (m) { return key(m.id) === id || (name && key(m.name) === name); });
      if (found && out.indexOf(found.id) < 0) out.push(found.id);
    });
    if (!out.length) {
      var human = members.find(function (m) { return m.kind === 'human'; });
      if (human) out.push(human.id);
    }
    return out;
  }
  function record(input) {
    input = input || {};
    return current().then(function (profile) {
      if (!profile.enabled) return { ok: true, ignored: true, reason: 'opted-out' };
      var participants = Array.isArray(input.participants) && input.participants.length ? input.participants : resolve(profile, input.candidates);
      if (!participants.length) return { ok: true, ignored: true, reason: 'no-profile-member' };
      var payload = Object.assign({}, input, { participants: participants });
      delete payload.candidates;
      if (!payload.actorId) payload.actorId = participants[0];
      return json('/api/profile/event', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-axm-profile-event': 'signed-local-receipt' },
        body: JSON.stringify(payload)
      });
    });
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
  root.AXMProfile = { current: current, resolve: resolve, record: record, recordCodeTask: recordCodeTask };
})(typeof globalThis !== 'undefined' ? globalThis : this);
