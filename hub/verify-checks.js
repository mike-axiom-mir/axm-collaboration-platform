/* ============================================================
   AXM Hub — verify-checks.js
   The USER-check evaluator. Pure + IO-injected so the exact same
   logic runs in verify-plus.js (Node, fs) and in the Verifier
   module (browser, preview) and in hub-selftest.js (fake io).
   These are the checks YOU own. The core floor lives in verify.js
   and is never evaluated here — it can't be deleted from a config.
   ============================================================ */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') root.AXMChecks = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* kinds a starter can add without touching code */
  const KINDS = {
    'file-exists':    { label: 'File exists',        fields: ['path'] },
    'file-contains':  { label: 'File contains text', fields: ['path', 'needle'] },
    'json-has-field': { label: 'JSON has field',     fields: ['path', 'field'] },
    'manifest-present': { label: 'Module has a manifest', fields: ['folder'] }
  };

  /* the locked core groups, for display only (mirrors verify.js sections) */
  const CORE_GROUPS = [
    'Spine integrity (axm-foundation.js unforked)',
    'Manifest contract (required fields, legal status, uses declared)',
    'DOM order + no hardcoded asset paths',
    'Namespace contracts present',
    'Template index honesty',
    'Registry + settings contracts unforked',
    'Shell branch discipline',
    'Trust files present (charter, seams, core roots)',
    'Game Night seam contracts (phone, QR, reload, disconnect, overlays)',
    'Shared game engine lifecycle seams (seat consent, launch rollback, crash recovery)',
    'Declared module contracts',
    'Lifecycle seam gap inventory (reload, disconnect, cleanup)'
  ];

  function getField(obj, dotted) {
    return String(dotted).split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
  }

  /* io = { read(path) -> string|null }.  exists = read !== null. */
  function evalCheck(c, io) {
    const label = c.label || (KINDS[c.kind] ? KINDS[c.kind].label : c.kind);
    try {
      if (c.kind === 'file-exists')
        return { id: c.id, label, ok: io.read(c.path) !== null, detail: c.path };
      if (c.kind === 'file-contains') {
        const t = io.read(c.path);
        return { id: c.id, label, ok: t !== null && t.indexOf(c.needle) >= 0, detail: c.path + ' ⊇ "' + c.needle + '"' };
      }
      if (c.kind === 'json-has-field') {
        const t = io.read(c.path); if (t === null) return { id: c.id, label, ok: false, detail: c.path + ' missing' };
        let j; try { j = JSON.parse(t); } catch (e) { return { id: c.id, label, ok: false, detail: c.path + ' not JSON' }; }
        return { id: c.id, label, ok: getField(j, c.field) !== undefined, detail: c.path + ' . ' + c.field };
      }
      if (c.kind === 'manifest-present')
        return { id: c.id, label, ok: io.read('tools/' + c.folder + '/manifest.json') !== null, detail: 'tools/' + c.folder };
      return { id: c.id, label, ok: false, detail: 'unknown kind: ' + c.kind };
    } catch (e) { return { id: c.id, label, ok: false, detail: 'error: ' + e.message }; }
  }

  function runUserChecks(config, io) {
    return ((config && config.userChecks) || []).map(c => evalCheck(c, io));
  }

  /* RETIREMENT — the honest way to turn a core check off as tech changes.
     A retirement needs a reason (no reason = ignored). It NEVER deletes a
     line: the matched FAIL/warn is reclassified to RETIRED and printed with
     its provenance, and only then excluded from the effective fail count.
     Returns the annotated text, the recomputed effective fail count, and
     exactly which lines each retirement touched (so a bad match is visible). */
  function applyRetirements(coreText, retirements) {
    const active = (retirements || []).filter(r => r && r.match && r.reason && String(r.reason).trim());
    const ignored = (retirements || []).filter(r => r && r.match && !(r.reason && String(r.reason).trim()));
    const hits = active.map(r => ({ match: r.match, reason: r.reason, by: r.by || 'user', at: r.at || '', review: r.review || '', lines: [] }));
    const lines = coreText.split('\n').map(line => {
      const trimmed = line.replace(/^\s+/, '');
      const kind = trimmed.slice(0, 4);
      if (kind !== 'FAIL' && kind !== 'warn') return line;
      for (const h of hits) {
        if (line.indexOf(h.match) >= 0) {
          h.lines.push(trimmed);
          return line.replace(/(FAIL|warn)/, 'RETD') + '   · RETIRED(' + h.by + (h.at ? ' ' + h.at : '') + '): ' + h.reason + (h.review ? ' [review: ' + h.review + ']' : '');
        }
      }
      return line;
    });
    /* effective fails = FAIL lines that were NOT retired */
    let effectiveFails = 0;
    lines.forEach(l => { if (l.replace(/^\s+/, '').slice(0, 4) === 'FAIL') effectiveFails++; });
    return { text: lines.join('\n'), effectiveFails, hits, ignored };
  }

  /* stamp an acknowledgement onto a matching core WARN line (non-hidden:
     the warn still prints, just annotated — never removed, never a pass) */
  function annotateWarns(coreText, acks) {
    let t = coreText;
    ((acks) || []).forEach(a => {
      const lines = t.split('\n').map(L =>
        (L.indexOf('warn') >= 0 || L.toLowerCase().indexOf(a.match.toLowerCase()) >= 0) && L.indexOf(a.match) >= 0
          ? L + '   · ACK(' + (a.by || 'user') + '): ' + a.reason : L);
      t = lines.join('\n');
    });
    return t;
  }

  return { KINDS, CORE_GROUPS, evalCheck, runUserChecks, applyRetirements, annotateWarns };
});
