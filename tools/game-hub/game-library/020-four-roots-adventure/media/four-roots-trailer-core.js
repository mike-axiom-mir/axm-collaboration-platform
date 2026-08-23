'use strict';

const Film = require('../../../../../shared/asset-hands/choice-first-film-core');
const Engine = require('../runtime/game-engine');
const Replay = require('../runtime/deterministic-journey');

const WIDTH = 640;
const HEIGHT = 360;
const PHASES = 8;
const COLORS = Object.freeze({ bg: '#03070d', panel: '#0b1724', ink: '#f3f7ff', muted: '#9dacbd', line: '#294057', cyan: '#58e6ff', gold: '#ffcc66', green: '#8df0a8', violet: '#d8a8ff', coral: '#ff8f70', wall: '#263b4a', ground: '#102b39', water: '#0d3a51' });
const LAYOUT = Object.freeze({ mapX: 20, mapY: 69, tile: 18, tileInner: 16, panelX: 310, panelY: 57, panelWidth: 312, panelHeight: 221 });

function rgba(hex) { const value = String(hex).replace('#', ''); return [0, 2, 4, 6].map((offset) => parseInt(value.slice(offset, offset + 2) || 'ff', 16)); }
function canvas(colour) { const out = new Uint8Array(WIDTH * HEIGHT * 4), bytes = rgba(colour); for (let index = 0; index < out.length; index += 4) out.set(bytes, index); return out; }
function rect(target, x, y, width, height, colour) { const bytes = rgba(colour); for (let py = Math.max(0, Math.round(y)); py < Math.min(HEIGHT, Math.round(y + height)); py += 1) for (let px = Math.max(0, Math.round(x)); px < Math.min(WIDTH, Math.round(x + width)); px += 1) target.set(bytes, (py * WIDTH + px) * 4); }
function line(target, x0, y0, x1, y1, colour, thickness) { x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1); const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1, dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1; let error = dx + dy; while (true) { rect(target, x0 - Math.floor(thickness / 2), y0 - Math.floor(thickness / 2), thickness, thickness, colour); if (x0 === x1 && y0 === y1) break; const twice = error * 2; if (twice >= dy) { error += dy; x0 += sx; } if (twice <= dx) { error += dx; y0 += sy; } } }
function circle(target, cx, cy, radius, colour) { const r = Math.round(radius); for (let y = -r; y <= r; y += 1) { const span = Math.floor(Math.sqrt(r * r - y * y)); rect(target, cx - span, cy + y, span * 2 + 1, 1, colour); } }
function outline(target, x, y, width, height, colour, thickness) { rect(target, x, y, width, thickness, colour); rect(target, x, y + height - thickness, width, thickness, colour); rect(target, x, y, thickness, height, colour); rect(target, x + width - thickness, y, thickness, height, colour); }
function safeText(value) { return String(value || '').normalize('NFKD').replace(/[^A-Za-z0-9 .,:;!?+\-\/'()]/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase(); }
function drawText(target, value, x, y, scale, colour, background) { const safe = safeText(value); if (safe) Film.drawText(target, safe, Math.round(x), Math.round(y), scale, colour, background === undefined ? null : background); }
function fittedScale(value, maxWidth, preferred) { const safe = safeText(value); let scale = preferred; while (scale > 1 && Film.textWidth(safe, scale) > maxWidth) scale -= 1; return scale; }
function centered(target, value, y, preferred, colour, background) { const safe = safeText(value), scale = fittedScale(safe, WIDTH - 36, preferred); drawText(target, safe, (WIDTH - Film.textWidth(safe, scale)) / 2, y, scale, colour, background); }
function wrap(value, maxChars, maxLines) { const words = safeText(value).split(' ').filter(Boolean), lines = []; let current = ''; for (const word of words) { const next = current ? current + ' ' + word : word; if (next.length > maxChars && current) { lines.push(current); current = word; } else current = next; if (lines.length === maxLines) break; } if (lines.length < maxLines && current) lines.push(current); return lines.slice(0, maxLines); }
function starfield(target, phase) { for (let index = 0; index < 38; index += 1) { const x = (index * 83 + phase * 7) % WIDTH, y = (index * 47 + (index % 3) * 61) % HEIGHT, size = (index + phase) % 7 === 0 ? 2 : 1; rect(target, x, y, size, size, index % 4 === 0 ? COLORS.cyan : COLORS.line); } }
function base(sceneIndex, phase, accent) { const target = canvas(COLORS.bg); starfield(target, phase); rect(target, 0, 0, WIDTH, 8, accent); rect(target, 0, 322, WIDTH, 38, '#07111c'); drawText(target, 'AXM WORKSHOP TEST', 18, 334, 2, COLORS.muted); drawText(target, 'PUBLIC RELEASE HOLD', 396, 334, 2, COLORS.muted); rect(target, 0, 318, Math.round(((sceneIndex * PHASES + phase + 1) / (6 * PHASES)) * WIDTH), 4, accent); return target; }
function opening(scene, phase) {
  const target = base(0, phase, scene.accent), pulse = phase * 3;
  circle(target, 320, 151, 76 + pulse / 3, '#0d2634'); circle(target, 320, 151, 53 + pulse / 4, '#123849');
  outline(target, 274 - pulse / 2, 93 - pulse / 2, 92 + pulse, 116 + pulse, scene.accent, 3); rect(target, 315, 94 - pulse / 2, 10, 114 + pulse, COLORS.bg);
  centered(target, 'FOUR ROOTS', 30, 5, COLORS.ink, COLORS.bg); centered(target, 'ADVENTURE', 229, 5, scene.accent, COLORS.bg);
  centered(target, 'DETERMINISTIC GAMEPLAY REPLAY', 273, 2, COLORS.green, COLORS.bg); centered(target, 'LOCAL ONLY  NO AI  NO INTERNET', 294, 1, COLORS.muted, COLORS.bg);
  return target;
}
function actorColour(kind) { if (kind === 'keeper') return COLORS.violet; if (kind === 'relic' || kind === 'mechanism' || kind === 'witness') return COLORS.green; if (kind === 'portal' || kind === 'gate') return COLORS.gold; return COLORS.cyan; }
function actorGlyph(actor) { const value = safeText(actor.glyph); return value && /^[A-Z0-9]$/.test(value) ? value : safeText(actor.kind).slice(0, 1) || 'A'; }
function tileCenter(x, y) { return { x: LAYOUT.mapX + x * LAYOUT.tile + Math.floor(LAYOUT.tileInner / 2), y: LAYOUT.mapY + y * LAYOUT.tile + Math.floor(LAYOUT.tileInner / 2) }; }
function playerCenter(state) { return tileCenter(state.x, state.y); }
function renderWorldMap(target, view, state, previousState) {
  const zone = view.zone;
  outline(target, LAYOUT.mapX - 5, LAYOUT.mapY - 5, 280, 208, zone.accent, 2);
  zone.map.forEach((row, y) => Array.from(row).forEach((terrain, x) => {
    const colour = terrain === '#' ? COLORS.wall : terrain === '~' ? COLORS.water : COLORS.ground;
    rect(target, LAYOUT.mapX + x * LAYOUT.tile, LAYOUT.mapY + y * LAYOUT.tile, LAYOUT.tileInner, LAYOUT.tileInner, colour);
    if (terrain === '.') rect(target, LAYOUT.mapX + x * LAYOUT.tile + 7, LAYOUT.mapY + y * LAYOUT.tile + 7, 2, 2, '#173849');
  }));
  if (previousState && previousState.zoneId === state.zoneId && (previousState.x !== state.x || previousState.y !== state.y)) {
    const from = playerCenter(previousState), to = playerCenter(state); line(target, from.x, from.y, to.x, to.y, COLORS.cyan, 2); circle(target, from.x, from.y, 3, COLORS.muted);
  }
  for (const actor of zone.actors) {
    const point = tileCenter(actor.x, actor.y), colour = actorColour(actor.kind);
    rect(target, point.x - 6, point.y - 6, 12, 12, colour); outline(target, point.x - 7, point.y - 7, 14, 14, actor.id === state.lastActorId ? COLORS.ink : COLORS.bg, 1);
    drawText(target, actorGlyph(actor), point.x - 3, point.y - 4, 1, COLORS.bg);
  }
  const player = playerCenter(state); circle(target, player.x, player.y, 8, COLORS.ink); circle(target, player.x, player.y, 6, zone.accent); circle(target, player.x, player.y - 1, 2, COLORS.ink);
}
function drawProgressPanel(target, scene, view, state, checkpoint) {
  const x = LAYOUT.panelX, y = LAYOUT.panelY, width = LAYOUT.panelWidth;
  rect(target, x, y, width, LAYOUT.panelHeight, COLORS.panel); outline(target, x, y, width, LAYOUT.panelHeight, scene.accent, 2);
  drawText(target, view.zone.name, x + 12, y + 12, fittedScale(view.zone.name, width - 24, 3), COLORS.ink, COLORS.panel);
  drawText(target, 'DETERMINISTIC REPLAY / STATE ' + checkpoint.actionIndex, x + 12, y + 39, 1, COLORS.muted, COLORS.panel);
  const rootColours = [COLORS.cyan, COLORS.gold, COLORS.green, COLORS.violet];
  view.progress.roots.forEach((root, index) => {
    const cx = x + 26 + index * 70, cy = y + 72; circle(target, cx, cy, 10, root.acquired ? rootColours[index] : COLORS.line); outline(target, cx - 11, cy - 11, 22, 22, rootColours[index], 1); drawText(target, String(index + 1), cx - 3, cy - 4, 1, root.acquired ? COLORS.bg : COLORS.muted);
  });
  const questCount = view.progress.quests.filter((quest) => quest.complete).length;
  drawText(target, questCount + ' / 6 QUESTS', x + 13, y + 101, 2, COLORS.gold, COLORS.panel);
  drawText(target, view.progress.inventory.length + ' / 10 DISCOVERIES', x + 13, y + 126, 2, COLORS.green, COLORS.panel);
  drawText(target, view.progress.moves + ' MOVES', x + 13, y + 151, 2, COLORS.cyan, COLORS.panel);
  wrap(view.message, 47, 3).forEach((lineValue, index) => drawText(target, lineValue, x + 13, y + 180 + index * 11, 1, index === 0 ? COLORS.ink : COLORS.muted, COLORS.panel));
  if (state.completed) { rect(target, x + width - 92, y + 145, 77, 22, COLORS.green); drawText(target, 'COMPLETE', x + width - 84, y + 152, 1, COLORS.bg); }
}
function gameplay(scene, phase, context) {
  const checkpointId = scene.visual.checkpointIds[phase], checkpoint = context.replay.checkpoints.find((entry) => entry.id === checkpointId);
  const state = context.phaseStates.get(scene.index + ':' + phase), previousState = context.phaseStates.get(scene.index + ':' + Math.max(0, phase - 1));
  if (!checkpoint || !state || Replay.hashValue(state) !== checkpoint.stateDigest || state.zoneId !== checkpoint.zoneId || state.x !== checkpoint.x || state.y !== checkpoint.y) throw new Error('gameplay frame checkpoint lineage drift');
  const view = Engine.publicSnapshot(context.content, state, { mode: 'TEST', contentBound: true, reload: 'RESUME', restart: 'RESUME', resetAvailable: true });
  const target = base(scene.index, phase, view.zone.accent);
  drawText(target, scene.headline, 20, 20, fittedScale(scene.headline, 420, 3), COLORS.ink, COLORS.bg);
  drawText(target, 'RECONSTRUCTED FROM EXACT TEST ENGINE STATE', 358, 23, 1, COLORS.green, COLORS.bg);
  renderWorldMap(target, view, state, previousState);
  drawProgressPanel(target, scene, view, state, checkpoint);
  centered(target, scene.subline, 288, 2, scene.accent, COLORS.bg);
  drawText(target, 'NOT SCREEN CAPTURE / NOT LIVE PLAYER INPUT', 186, 306, 1, COLORS.muted, COLORS.bg);
  return { frame: target, lineage: { checkpointId, actionIndex: checkpoint.actionIndex, stateDigest: checkpoint.stateDigest, zoneId: checkpoint.zoneId, x: checkpoint.x, y: checkpoint.y, completed: checkpoint.completed } };
}

function renderScene(scene, phase, context) {
  if (!scene || !Number.isInteger(phase) || phase < 0 || phase >= PHASES) throw new Error('trailer scene phase is invalid');
  if (scene.index === 0) return { frame: opening(scene, phase), lineage: null };
  if (!context || !context.content || !context.replay || !context.phaseStates) throw new Error('gameplay replay context is required');
  return gameplay(scene, phase, context);
}
function build(plan, content, replayBuild) {
  if (!plan || !Array.isArray(plan.scenes) || plan.scenes.length !== 6 || !replayBuild || !replayBuild.record || !replayBuild.phaseStates) throw new Error('exact gameplay trailer plan and replay build are required');
  const replayFileBytes = Buffer.from(JSON.stringify(replayBuild.record, null, 2) + '\n', 'utf8');
  if (plan.replayRef.sha256 !== Replay.hashBytes(replayFileBytes) || plan.replayRef.byteLength !== replayFileBytes.length) throw new Error('gameplay replay byte reference drift');
  const context = { content, replay: replayBuild.record, phaseStates: replayBuild.phaseStates };
  const uniqueFrames = [], frameLineage = [];
  for (const scene of plan.scenes) for (let phase = 0; phase < PHASES; phase += 1) {
    const rendered = renderScene(scene, phase, context), uniqueFrameIndex = uniqueFrames.length;
    uniqueFrames.push(rendered.frame);
    frameLineage.push({ uniqueFrameIndex, sceneIndex: scene.index, phase, kind: rendered.lineage ? 'gameplay-replay' : 'title-card', ...(rendered.lineage || { checkpointId: null, actionIndex: null, stateDigest: null, zoneId: null, x: null, y: null, completed: false }) });
  }
  const sequence = [];
  for (let frame = 0; frame < 360; frame += 1) { const scene = Math.floor(frame / 60), local = frame % 60, phase = Math.min(7, Math.floor(local * 8 / 60)); sequence.push(scene * 8 + phase); }
  const vtt = 'WEBVTT\n\n' + plan.captions.map((cue) => String(cue.index + 1) + '\n' + cue.start + ' --> ' + cue.end + '\n' + cue.text + '\n').join('\n');
  return {
    uniqueFrames, sequence, vtt,
    record: {
      schema: 'axm.game-trailer-sparse-sequence/v2', status: 'TEST', planDigest: plan.planDigest,
      replayRef: { id: replayBuild.record.id, schema: replayBuild.record.schema, sha256: replayBuild.record.replayDigest, byteLength: replayBuild.recordBytes },
      width: WIDTH, height: HEIGHT, frameRate: { numerator: 12, denominator: 1 }, durationSeconds: 30, uniqueFrames: 48, samples: 360,
      frameLineage, sequence,
      truth: { gameplayFrames: 40, titleFrames: 8, reconstructedFromExactEngineStates: true, browserCapture: false, livePlayerInput: false },
      authority: 'NONE'
    }
  };
}
function pixel(frame, x, y) { const offset = (Math.round(y) * WIDTH + Math.round(x)) * 4; return Array.from(frame.slice(offset, offset + 4)); }

module.exports = { WIDTH, HEIGHT, PHASES, COLORS, LAYOUT, rgba, playerCenter, renderScene, build, pixel };
