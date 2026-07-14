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
  root.AXMProfile = { current: current, resolve: resolve, record: record };
})(typeof globalThis !== 'undefined' ? globalThis : this);
