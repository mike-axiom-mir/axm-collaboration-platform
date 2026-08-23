'use strict';

const Digest = require('./digest');

const DISPLAY_LIST_SCHEMA = 'axm.web.display-list/v1';
const FONT_MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const COLORS = Object.freeze({
  background: '#07101f',
  chrome: '#0e1930',
  panel: '#111f39',
  card: '#142642',
  border: '#294264',
  text: '#f4f7ff',
  muted: '#9fb1cc',
  accent: '#72e1c2',
  accentBlue: '#79b8ff',
  held: '#f3bd63',
  danger: '#ff8e9b'
});

function elideMiddle(value, maxCharacters) {
  const text = String(value);
  if (text.length <= maxCharacters) return text;
  const remaining = Math.max(2, maxCharacters - 3);
  const left = Math.ceil(remaining * 0.6);
  const right = remaining - left;
  return text.slice(0, left) + '...' + text.slice(text.length - right);
}

function buildDisplayList(layout) {
  if (!layout || layout.schema !== 'axm.web.structure-layout/v1') throw new TypeError('structure layout schema mismatch');
  const commands = [];
  function command(kind, values) {
    commands.push(Object.assign({ commandId: 'cmd-' + String(commands.length + 1).padStart(5, '0'), kind }, values));
  }
  function rect(x, y, width, height, fill, stroke, radius) {
    command('rect', { x, y, width, height, fill, stroke: stroke || null, strokeWidth: stroke ? 1 : 0, radius: radius || 0 });
  }
  function text(value, x, y, size, fill, weight) {
    command('text', {
      text: String(value), x, y, fill, fontFamily: FONT_MONO,
      fontSize: size, fontWeight: weight || 400, letterSpacing: 0
    });
  }
  function line(x1, y1, x2, y2, stroke, strokeWidth) {
    command('line', { x1, y1, x2, y2, stroke, strokeWidth: strokeWidth || 1 });
  }

  rect(0, 0, layout.canvas.width, layout.canvas.height, COLORS.background);
  rect(0, 0, layout.canvas.width, 74, COLORS.chrome);
  rect(24, 21, 12, 12, COLORS.danger, null, 6);
  rect(44, 21, 12, 12, COLORS.held, null, 6);
  rect(64, 21, 12, 12, COLORS.accent, null, 6);
  text(layout.chrome.product, 94, 33, 15, COLORS.text, 700);
  text('EXPERIMENTAL / OFFLINE', layout.canvas.width - 246, 33, 12, COLORS.accent, 700);

  rect(32, 91, layout.canvas.width - 64, 48, COLORS.panel, COLORS.border, 10);
  text('LOCAL', 48, 120, 11, COLORS.accent, 700);
  text(elideMiddle(layout.chrome.locator, Math.max(20, Math.floor((layout.canvas.width - 140) / 8))), 108, 120, 13, COLORS.text, 400);

  text(elideMiddle(layout.chrome.title, Math.max(18, Math.floor((layout.canvas.width - 64) / 15))), 32, 174, 25, COLORS.text, 700);
  text('AXM STRUCTURE VIEW', 32, 198, 11, COLORS.accent, 700);
  text(layout.canvas.width < 900 ? 'SITE / NAV / SCRIPT / NETWORK HELD' : 'SITE VIEW HELD  /  NAVIGATION HELD  /  PAGE CODE INERT', 190, 198, 11, COLORS.held, 700);

  const accentFor = {
    heading: COLORS.accent,
    paragraph: COLORS.accentBlue,
    link: '#b5a2ff',
    media: '#ff9dc8',
    list: '#8bd98b',
    table: '#f5cf72',
    form: '#ffab7a',
    'plain-text': COLORS.muted
  };

  layout.items.forEach(function (item) {
    const box = item.box;
    const accent = accentFor[item.kind] || COLORS.muted;
    rect(box.x, box.y, box.width, box.height, COLORS.card, COLORS.border, 12);
    rect(box.x, box.y, 5, box.height, accent, null, 3);
    text(item.label.toUpperCase() + (item.nodeRef ? '  /  ' + item.nodeRef : ''), box.x + 22, box.y + 28, 11, accent, 700);
    line(box.x + 22, box.y + 39, box.x + box.width - 22, box.y + 39, COLORS.border, 1);
    let cursorY = box.y + 66;
    const mainSize = item.kind === 'heading' ? 19 : 15;
    item.textLines.forEach(function (row) {
      text(row, box.x + 22, cursorY, mainSize, COLORS.text, item.kind === 'heading' ? 700 : 400);
      cursorY += 24;
    });
    cursorY += 5;
    item.metaLines.forEach(function (row) {
      text(row, box.x + 22, cursorY, 11, COLORS.muted, 400);
      cursorY += 18;
    });
  });

  if (layout.items.length === 0) {
    rect(32, 216, layout.canvas.width - 64, 92, COLORS.card, COLORS.border, 12);
    text('NO SEMANTIC BLOCKS EXTRACTED', 54, 252, 13, COLORS.held, 700);
    text('The original source remains digest-bound and unchanged.', 54, 280, 13, COLORS.muted, 400);
  }

  const material = {
    schema: DISPLAY_LIST_SCHEMA,
    version: 1,
    rendererProfile: 'axm.structure-display-list/v1',
    sourceDigest: layout.sourceDigest,
    pageModelDigest: layout.pageModelDigest,
    layoutDigest: layout.layoutDigest,
    width: layout.canvas.width,
    height: layout.canvas.height,
    colors: COLORS,
    commands,
    commandCount: commands.length,
    activeContent: false,
    externalResources: false
  };
  return Object.assign({}, material, { displayListDigest: Digest.canonicalDigest(material) });
}

module.exports = { DISPLAY_LIST_SCHEMA, FONT_MONO, COLORS, elideMiddle, buildDisplayList };
