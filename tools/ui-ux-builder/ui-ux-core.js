(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AXMUIUXCore = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var FORMAT = 'axm.uiux-workspace/v1';
  var PROPOSAL = 'axm.uiux-proposal/v1';
  var MAX_FLOW = 7;
  var PRESETS = {
    'calm-night': { accent: '#46d7e7', background: '#07101b', surface: '#111d2d', text: '#edf6ff', muted: '#9badc1', radius: 16, density: 'comfortable', navigation: 'left', textScale: 100 },
    'warm-workshop': { accent: '#f2b865', background: '#130f0b', surface: '#211a14', text: '#fff4e6', muted: '#c0a98d', radius: 13, density: 'comfortable', navigation: 'left', textScale: 102 },
    'clear-day': { accent: '#086d7a', background: '#f3f7fa', surface: '#ffffff', text: '#172231', muted: '#58697b', radius: 14, density: 'comfortable', navigation: 'left', textScale: 100 },
    'soft-violet': { accent: '#ad91ff', background: '#0d0b18', surface: '#19162a', text: '#f2efff', muted: '#aaa2c1', radius: 20, density: 'comfortable', navigation: 'left', textScale: 104 }
  };

  function now() { return new Date().toISOString(); }
  function id(prefix) { return (prefix || 'ux') + '_' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-5); }
  function clean(value, max) { return String(value == null ? '' : value).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max || 500); }
  function bool(value, fallback) { return typeof value === 'boolean' ? value : fallback; }
  function number(value, min, max, fallback) { var n = Number(value); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback; }
  function color(value, fallback) { var v = String(value || '').trim(); return /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : fallback; }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }

  function baseWorkspace() {
    return {
      format: FORMAT,
      id: id('uiux'),
      name: 'Untitled human experience',
      target: 'A screen or workflow',
      audience: '',
      primaryJob: '',
      frustration: '',
      principles: { clarity: true, control: true, feedback: true, forgiveness: true, accessibility: true, speed: false },
      flow: ['Arrive', 'Understand the choices', 'Do the main job', 'See what happened'],
      theme: clone(PRESETS['calm-night']),
      preset: 'calm-night',
      device: 'desktop',
      humanVerdict: 'pending',
      humanNote: '',
      createdAt: now(),
      updatedAt: now()
    };
  }

  function hubStarter() {
    var w = baseWorkspace();
    w.name = 'AXM Hub · human-first pass';
    w.target = 'AXM Hub home and module navigation';
    w.audience = 'A curious person who is not a developer';
    w.primaryJob = 'Choose what they want to do and enter the right workspace without learning the system plumbing.';
    w.frustration = 'Too many modules, technical labels, and status details compete for attention before the person knows where to begin.';
    w.principles.speed = true;
    w.flow = ['Open AXM', 'See four plain-language choices', 'Choose Create, Build, Play, or AI Team', 'Open one workspace', 'Always see status and a way back'];
    return w;
  }

  function normalize(raw) {
    if (!raw || raw.format !== FORMAT) throw new Error('This is not an AXM UI/UX workspace.');
    var base = baseWorkspace();
    var theme = raw.theme || {};
    var preset = PRESETS[raw.preset] ? raw.preset : 'calm-night';
    var p = PRESETS[preset];
    var flow = Array.isArray(raw.flow) ? raw.flow.map(function (step) { return clean(step, 100); }).filter(Boolean).slice(0, MAX_FLOW) : base.flow;
    var out = {
      format: FORMAT,
      id: clean(raw.id, 100) || id('uiux'),
      name: clean(raw.name, 120) || base.name,
      target: clean(raw.target, 180) || base.target,
      audience: clean(raw.audience, 500),
      primaryJob: clean(raw.primaryJob, 1200),
      frustration: clean(raw.frustration, 1200),
      principles: {},
      flow: flow.length ? flow : base.flow,
      theme: {
        accent: color(theme.accent, p.accent), background: color(theme.background, p.background), surface: color(theme.surface, p.surface),
        text: color(theme.text, p.text), muted: color(theme.muted, p.muted), radius: number(theme.radius, 0, 28, p.radius),
        density: ['compact', 'comfortable', 'spacious'].indexOf(theme.density) >= 0 ? theme.density : p.density,
        navigation: ['left', 'top', 'rail'].indexOf(theme.navigation) >= 0 ? theme.navigation : p.navigation,
        textScale: number(theme.textScale, 90, 120, p.textScale)
      },
      preset: preset,
      device: ['desktop', 'tablet', 'phone'].indexOf(raw.device) >= 0 ? raw.device : 'desktop',
      humanVerdict: ['pending', 'yes', 'not-yet'].indexOf(raw.humanVerdict) >= 0 ? raw.humanVerdict : 'pending',
      humanNote: clean(raw.humanNote, 2000),
      createdAt: clean(raw.createdAt, 40) || now(), updatedAt: clean(raw.updatedAt, 40) || now()
    };
    Object.keys(base.principles).forEach(function (key) { out.principles[key] = bool(raw.principles && raw.principles[key], base.principles[key]); });
    return out;
  }

  function hexRgb(hex) { var n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function luminance(hex) {
    var rgb = hexRgb(hex).map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  }
  function contrast(a, b) { var x = luminance(a), y = luminance(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
  function check(id, label, ok, message, severity) { return { id: id, label: label, ok: !!ok, message: message, severity: severity || 'fail' }; }

  function audit(workspace) {
    var w = normalize(workspace);
    var checks = [
      check('audience', 'A real person is named', w.audience.length >= 12, 'Say who uses this, in ordinary language.'),
      check('job', 'One main job is clear', w.primaryJob.length >= 20, 'Describe what the person must accomplish.'),
      check('flow', 'The journey stays understandable', w.flow.length >= 3 && w.flow.length <= MAX_FLOW, 'Use 3 to 7 meaningful steps.'),
      check('control', 'The person stays in control', w.principles.control, 'Keep pause, back, cancel, or stop visible.'),
      check('feedback', 'Actions answer back', w.principles.feedback, 'Show whether an action worked, failed, or is waiting.'),
      check('forgiveness', 'Mistakes are recoverable', w.principles.forgiveness, 'Keep undo, reset, or a safe way back.'),
      check('text-contrast', 'Main text is readable', contrast(w.theme.text, w.theme.background) >= 4.5, 'Text/background contrast must be at least 4.5:1.'),
      check('muted-contrast', 'Secondary text remains readable', contrast(w.theme.muted, w.theme.background) >= 3, 'Muted text/background contrast must be at least 3:1.'),
      check('text-size', 'Text is not squeezed', w.theme.textScale >= 96, 'Use at least 96% text scale.', 'warn'),
      check('friction', 'Known frustration is recorded', w.frustration.length >= 12, 'Naming the current pain helps avoid rebuilding it.', 'warn')
    ];
    var failed = checks.filter(function (c) { return !c.ok && c.severity === 'fail'; }).length;
    var warnings = checks.filter(function (c) { return !c.ok && c.severity === 'warn'; }).length;
    return { checks: checks, failed: failed, warnings: warnings, passed: checks.filter(function (c) { return c.ok; }).length, gatePassed: failed === 0, humanApproved: w.humanVerdict === 'yes', reviewReady: failed === 0 && w.humanVerdict === 'yes' };
  }

  function cssVariables(w) {
    return {
      '--ux-accent': w.theme.accent, '--ux-background': w.theme.background, '--ux-surface': w.theme.surface,
      '--ux-text': w.theme.text, '--ux-muted': w.theme.muted, '--ux-radius': w.theme.radius + 'px', '--ux-text-scale': w.theme.textScale + '%'
    };
  }

  function proposal(workspace) {
    var w = normalize(workspace); var report = audit(w);
    return {
      schema: PROPOSAL,
      source: 'ui-ux-builder',
      generatedAt: now(),
      status: report.reviewReady ? 'REVIEW READY' : 'DRAFT',
      target: w.target,
      human: { audience: w.audience, primaryJob: w.primaryJob, frustration: w.frustration, principles: clone(w.principles), verdict: w.humanVerdict, note: w.humanNote },
      journey: w.flow.slice(),
      design: { preset: w.preset, theme: clone(w.theme), cssVariables: cssVariables(w) },
      implementationGuide: [
        'Keep the primary choice visible before module-level detail.',
        'Use the journey order as the screen hierarchy and keyboard order.',
        'Keep AI status and pause controls visible but visually secondary to the human task.',
        'Apply only after human review and before/after screenshots plus automated checks.'
      ],
      audit: report,
      effect: 'proposal-only',
      applied: false
    };
  }

  function applyPreset(workspace, name) {
    if (!PRESETS[name]) throw new Error('Unknown visual preset.');
    var w = normalize(workspace); w.preset = name; w.theme = clone(PRESETS[name]); w.updatedAt = now(); return w;
  }

  return { FORMAT: FORMAT, PROPOSAL: PROPOSAL, MAX_FLOW: MAX_FLOW, PRESETS: clone(PRESETS), now: now, clean: clean, color: color, baseWorkspace: baseWorkspace, hubStarter: hubStarter, normalize: normalize, contrast: contrast, audit: audit, proposal: proposal, applyPreset: applyPreset, cssVariables: cssVariables };
}));
