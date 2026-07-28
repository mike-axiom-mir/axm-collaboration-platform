const root = document.documentElement;

const safeStorage = {
  get(key) {
    try { return window.localStorage.getItem(key); } catch { return null; }
  },
  set(key, value) {
    try { window.localStorage.setItem(key, value); } catch { /* local mode may deny storage */ }
  },
  remove(key) {
    try { window.localStorage.removeItem(key); } catch { /* no-op */ }
  },
};

const controls = {
  theme: document.querySelector('#theme-select'),
  density: document.querySelector('#density-select'),
  effects: document.querySelector('#effects-select'),
  motion: document.querySelector('#motion-select'),
};

for (const [key, control] of Object.entries(controls)) {
  const stored = safeStorage.get(`axm-skin-${key}`);
  if (stored && [...control.options].some((option) => option.value === stored)) {
    control.value = stored;
    root.dataset[key] = stored;
  } else if (key === 'motion' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    control.value = 'reduced';
    root.dataset.motion = 'reduced';
  }
  control.addEventListener('change', () => {
    root.dataset[key] = control.value;
    safeStorage.set(`axm-skin-${key}`, control.value);
    runDiagnostics();
  });
}

const dialog = document.querySelector('#organ-dialog');
document.querySelector('#open-dialog').addEventListener('click', () => dialog.showModal());
document.querySelector('#close-dialog').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });

function activateTab(tab) {
  const group = tab.closest('[role="tablist"]');
  for (const peer of group.querySelectorAll('[role="tab"]')) {
    const selected = peer === tab;
    peer.setAttribute('aria-selected', String(selected));
    peer.tabIndex = selected ? 0 : -1;
    const panel = document.getElementById(peer.getAttribute('aria-controls'));
    if (panel) panel.hidden = !selected;
  }
  tab.focus();
}

for (const tablist of document.querySelectorAll('[role="tablist"]')) {
  const tabs = [...tablist.querySelectorAll('[role="tab"]')];
  tabs.forEach((tab, index) => {
    tab.tabIndex = tab.getAttribute('aria-selected') === 'true' ? 0 : -1;
    tab.addEventListener('click', () => activateTab(tab));
    tab.addEventListener('keydown', (event) => {
      const keys = ['ArrowRight', 'ArrowLeft', 'Home', 'End'];
      if (!keys.includes(event.key)) return;
      event.preventDefault();
      let next = index;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = tabs.length - 1;
      activateTab(tabs[next]);
    });
  });
}

for (const progress of document.querySelectorAll('.axm-progress[data-progress]')) {
  const value = Math.max(0, Math.min(100, Number(progress.dataset.progress) || 0));
  progress.style.setProperty('--axm-progress', `${value}%`);
}

const lab = {
  accent: document.querySelector('#lab-accent'),
  accentAlt: document.querySelector('#lab-accent-alt'),
  blur: document.querySelector('#lab-blur'),
  glow: document.querySelector('#lab-glow'),
  radius: document.querySelector('#lab-radius'),
  padding: document.querySelector('#lab-padding'),
};

const defaultLab = {
  accent: '#70f2ff',
  accentAlt: '#bda1ff',
  blur: '16',
  glow: '24',
  radius: '7',
  padding: '20',
};

const labTokenMap = {
  accent: '--axm-sem-accent',
  accentAlt: '--axm-sem-accent-alt',
  blur: '--axm-effect-blur',
  glow: '--axm-effect-edge-glow',
  radius: '--axm-control-radius',
  padding: '--axm-card-padding',
  onAccent: '--axm-sem-on-accent',
};

function bestOnAccent(hex) {
  const normalized = hex.replace('#', '');
  const background = { r: Number.parseInt(normalized.slice(0, 2), 16), g: Number.parseInt(normalized.slice(2, 4), 16), b: Number.parseInt(normalized.slice(4, 6), 16), a: 1 };
  const dark = { r: 3, g: 6, b: 9, a: 1 };
  const light = { r: 255, g: 255, b: 255, a: 1 };
  return contrastRatio(dark, background) >= contrastRatio(light, background) ? '#030609' : '#ffffff';
}

function labValues() {
  return {
    accent: lab.accent.value,
    accentAlt: lab.accentAlt.value,
    blur: `${lab.blur.value}px`,
    glow: `${(Number(lab.glow.value) / 10).toFixed(1)}rem`,
    radius: `${(Number(lab.radius.value) / 10).toFixed(1)}rem`,
    padding: `${(Number(lab.padding.value) / 16).toFixed(2)}rem`,
    onAccent: bestOnAccent(lab.accent.value),
  };
}

function updateLab() {
  const values = labValues();
  for (const [key, token] of Object.entries(labTokenMap)) root.style.setProperty(token, values[key]);
  document.querySelector('#lab-blur-output').textContent = values.blur;
  document.querySelector('#lab-glow-output').textContent = values.glow;
  document.querySelector('#lab-radius-output').textContent = values.radius;
  document.querySelector('#lab-padding-output').textContent = values.padding;

  const lines = [
    '/* TEST-HOLD-REVIEW — generated locally; canonical source unchanged */',
    '[data-token-candidate="theme-lab-v0-2"] {',
    ...Object.entries(labTokenMap).map(([key, token]) => `  ${token}: ${values[key]};`),
    '}',
  ];
  document.querySelector('#lab-output').textContent = lines.join('\n');
  runDiagnostics();
}

for (const [key, input] of Object.entries(lab)) {
  const stored = safeStorage.get(`axm-lab-${key}`);
  if (stored !== null) input.value = stored;
  input.addEventListener('input', () => {
    safeStorage.set(`axm-lab-${key}`, input.value);
    updateLab();
  });
}

for (const button of document.querySelectorAll('.preview-width')) {
  button.addEventListener('click', () => {
    document.querySelector('#workbench-preview').style.setProperty('--axm-workbench-preview-width', button.dataset.width);
    for (const peer of document.querySelectorAll('.preview-width')) peer.setAttribute('aria-pressed', String(peer === button));
    window.requestAnimationFrame(runDiagnostics);
  });
}

document.querySelector('#reset-lab').addEventListener('click', () => {
  for (const [key, value] of Object.entries(defaultLab)) {
    lab[key].value = value;
    safeStorage.remove(`axm-lab-${key}`);
    root.style.removeProperty(labTokenMap[key]);
  }
  updateLab();
  document.querySelector('#export-status').textContent = 'Theme Laboratory restored to the v0.2 defaults.';
});

function packetPayload() {
  const values = labValues();
  const overrides = {};
  for (const [key, token] of Object.entries(labTokenMap)) overrides[token] = values[key];
  return {
    schema_version: '1.0',
    status: 'TEST-HOLD-REVIEW',
    name: 'theme-lab-candidate',
    purpose: 'Locally tuned AXM Skin Fabric candidate requiring visual, accessibility and performance review.',
    author: 'Mike — Axiom/Mir',
    source: 'AXM CSS Skin Fabric Theme Laboratory v0.2.0',
    generated_at: new Date().toISOString(),
    theme_context: root.dataset.theme,
    overrides,
    qa_snapshot: collectDiagnostics(),
    rollback_pointer: 'pack-v0.2.0-default-tokens',
    canonical_write: false,
  };
}

function downloadText(filename, text, type = 'application/json') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

document.querySelector('#export-packet').addEventListener('click', () => {
  downloadText('AXM_THEME_LAB_TEST_HOLD_REVIEW.json', `${JSON.stringify(packetPayload(), null, 2)}\n`);
  document.querySelector('#export-status').textContent = 'Review packet exported. Canonical CSS remains unchanged.';
});

document.querySelector('#copy-css').addEventListener('click', async () => {
  const css = document.querySelector('#lab-output').textContent;
  try {
    await navigator.clipboard.writeText(css);
    document.querySelector('#export-status').textContent = 'Candidate CSS copied to the clipboard.';
  } catch {
    document.querySelector('#lab-output').focus();
    document.querySelector('#export-status').textContent = 'Clipboard access was blocked; the CSS preview is focused for manual copy.';
  }
});

const commandSearch = document.querySelector('#command-search');
commandSearch.addEventListener('input', () => {
  const query = commandSearch.value.trim().toLowerCase();
  for (const item of document.querySelectorAll('#command-list .axm-command__item')) {
    item.hidden = Boolean(query) && !item.dataset.commandText.includes(query);
  }
});

function parseRgb(input) {
  const match = input.match(/rgba?\(([^)]+)\)/i);
  if (!match) return null;
  const parts = match[1].replaceAll(',', ' ').split(/\s+/).filter(Boolean).map(Number);
  if (parts.length < 3 || parts.some((value, index) => index < 3 && Number.isNaN(value))) return null;
  return { r: parts[0], g: parts[1], b: parts[2], a: Number.isFinite(parts[3]) ? parts[3] : 1 };
}

function composite(foreground, background) {
  const alpha = foreground.a + background.a * (1 - foreground.a);
  if (alpha === 0) return { r: 0, g: 0, b: 0, a: 0 };
  return {
    r: (foreground.r * foreground.a + background.r * background.a * (1 - foreground.a)) / alpha,
    g: (foreground.g * foreground.a + background.g * background.a * (1 - foreground.a)) / alpha,
    b: (foreground.b * foreground.a + background.b * background.a * (1 - foreground.a)) / alpha,
    a: alpha,
  };
}

function luminance(color) {
  const channels = [color.r, color.g, color.b].map((value) => {
    const channel = value / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(foreground, background) {
  const l1 = luminance(foreground);
  const l2 = luminance(background);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

function computedPair(foregroundToken, backgroundToken) {
  const sample = document.createElement('span');
  sample.hidden = true;
  sample.style.color = `var(${foregroundToken})`;
  sample.style.backgroundColor = `var(${backgroundToken})`;
  document.body.append(sample);
  const style = getComputedStyle(sample);
  let foreground = parseRgb(style.color);
  let background = parseRgb(style.backgroundColor);
  sample.remove();
  if (!foreground || !background) return null;
  const canvasSample = document.createElement('span');
  canvasSample.hidden = true;
  canvasSample.style.backgroundColor = 'var(--axm-sem-canvas)';
  document.body.append(canvasSample);
  const canvas = parseRgb(getComputedStyle(canvasSample).backgroundColor) || { r: 0, g: 0, b: 0, a: 1 };
  canvasSample.remove();
  background = background.a < 1 ? composite(background, canvas) : background;
  foreground = foreground.a < 1 ? composite(foreground, background) : foreground;
  return contrastRatio(foreground, background);
}

const featureChecks = [
  ['Cascade layers', () => CSS.supports('selector(:where(*))') && 'CSSLayerBlockRule' in window],
  ['Container queries', () => CSS.supports('container-type: inline-size')],
  ['OKLCH / color-mix', () => CSS.supports('color: color-mix(in oklab, red, blue)')],
  ['Backdrop filter', () => CSS.supports('backdrop-filter: blur(2px)')],
  ['Native dialog', () => 'HTMLDialogElement' in window],
  ['Typed custom properties', () => 'registerProperty' in CSS],
];

const contrastPairs = [
  ['Text / canvas', '--axm-sem-text', '--axm-sem-canvas', 4.5],
  ['Text / surface', '--axm-sem-text', '--axm-sem-surface', 4.5],
  ['Muted / surface', '--axm-sem-text-muted', '--axm-sem-surface', 4.5],
  ['On accent / accent', '--axm-sem-on-accent', '--axm-sem-accent', 4.5],
  ['Focus / canvas', '--axm-sem-focus', '--axm-sem-canvas', 3],
];

function collectDiagnostics() {
  const targetCandidates = [...document.querySelectorAll('button, a, input, select, textarea, summary, [tabindex]')]
    .filter((node) => node.getClientRects().length > 0 && !node.closest('dialog:not([open])'));
  const undersized = targetCandidates.filter((node) => {
    const box = node.getBoundingClientRect();
    return box.width < 24 || box.height < 24;
  });
  const ids = [...document.querySelectorAll('[id]')].map((node) => node.id);
  const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
  const unsupported = featureChecks.filter(([, test]) => !test());
  const contrastFailures = contrastPairs.filter(([, fg, bg, threshold]) => {
    const ratio = computedPair(fg, bg);
    return ratio === null || ratio < threshold;
  });
  return {
    targets_checked: targetCandidates.length,
    targets_below_24px: undersized.length,
    duplicate_ids: new Set(duplicateIds).size,
    unsupported_enhancements: unsupported.map(([name]) => name),
    contrast_failures: contrastFailures.map(([name]) => name),
    theme: root.dataset.theme,
    effects: root.dataset.effects,
    viewport: { width: window.innerWidth, height: window.innerHeight },
  };
}

function metric(label, value, status = 'info') {
  const item = document.createElement('div');
  item.className = 'gallery-metric';
  const badge = document.createElement('span');
  badge.className = `axm-badge axm-badge--${status}`;
  badge.textContent = label;
  const strong = document.createElement('strong');
  strong.textContent = value;
  item.append(badge, strong);
  return item;
}

function renderFeatureResults() {
  const container = document.querySelector('#feature-results');
  container.replaceChildren(...featureChecks.map(([name, test]) => {
    const supported = test();
    const row = document.createElement('div');
    row.className = 'gallery-feature';
    const label = document.createElement('span');
    label.textContent = name;
    const badge = document.createElement('span');
    badge.className = `axm-badge axm-badge--${supported ? 'success' : 'warning'}`;
    badge.textContent = supported ? 'Native' : 'Fallback';
    row.append(label, badge);
    return row;
  }));
}

function renderContrastResults() {
  const container = document.querySelector('#contrast-results');
  container.replaceChildren(...contrastPairs.map(([name, fg, bg, threshold]) => {
    const ratio = computedPair(fg, bg);
    const pass = ratio !== null && ratio >= threshold;
    const card = document.createElement('article');
    card.className = 'gallery-contrast-card';
    card.style.color = `var(${fg})`;
    card.style.backgroundColor = `var(${bg})`;
    const label = document.createElement('span');
    label.className = `axm-badge axm-badge--${pass ? 'success' : 'danger'}`;
    label.textContent = pass ? 'Pass' : 'Review';
    const value = document.createElement('strong');
    value.textContent = ratio === null ? 'Unknown' : `${ratio.toFixed(2)}:1`;
    const title = document.createElement('p');
    title.textContent = `${name} · target ${threshold}:1`;
    card.append(label, value, title);
    return card;
  }));
}

function runDiagnostics() {
  const data = collectDiagnostics();
  const components = document.querySelectorAll('.axm-button, .axm-card, .axm-panel, .axm-field, .axm-tabs, .axm-toolbar, .axm-nav, .axm-badge, .axm-state, .axm-dialog, .axm-progress, .axm-notice, .axm-table, .axm-command, .axm-skeleton, .axm-inspector').length;
  const materials = new Set([...document.querySelectorAll('[class*="axm-material--"]')].flatMap((node) => [...node.classList].filter((name) => name.startsWith('axm-material--')))).size;
  const pass = data.targets_below_24px === 0 && data.duplicate_ids === 0 && data.contrast_failures.length === 0;
  document.querySelector('#diagnostic-metrics').replaceChildren(
    metric('Component instances', components),
    metric('Material recipes shown', materials),
    metric('Targets below 24px', data.targets_below_24px, data.targets_below_24px ? 'danger' : 'success'),
    metric('Duplicate IDs', data.duplicate_ids, data.duplicate_ids ? 'danger' : 'success'),
    metric('Contrast pairs needing review', data.contrast_failures.length, data.contrast_failures.length ? 'danger' : 'success'),
    metric('Fallbacks active', data.unsupported_enhancements.length, data.unsupported_enhancements.length ? 'warning' : 'success'),
  );
  document.querySelector('#diagnostic-summary').textContent = pass
    ? 'Basic target, structure and semantic contrast checks passed in this viewport.'
    : 'One or more target, structure or contrast checks require review.';
  renderFeatureResults();
  renderContrastResults();
}

document.querySelector('#rerun-diagnostics').addEventListener('click', runDiagnostics);
let resizeFrame = null;
window.addEventListener('resize', () => {
  if (resizeFrame) cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(runDiagnostics);
});

updateLab();
runDiagnostics();
