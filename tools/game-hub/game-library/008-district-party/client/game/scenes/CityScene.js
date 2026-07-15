import { PartyCamera } from '../rendering/party-camera.js';
import { EntityRenderer } from '../rendering/entity-renderer.js';
import { drawAmbient } from '../rendering/effects.js';
import { Hud } from '../ui/hud.js';
import { drawOffscreenIndicators } from '../ui/indicators.js';
import { InventoryOverlay } from '../ui/inventory-overlay.js';

export class CityScene {
  constructor(canvas, options) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d', { alpha: false }); this.options = options;
    this.renderer = new EntityRenderer(); this.hud = new Hud(options.partyId); this.inventoryOverlay = new InventoryOverlay('inventory-overlays', options.partyId); this.state = null; this.map = null; this.camera = null;
    this.debug = false; this.renderFps = 0; this.payloadSize = 0; this.lastFrame = performance.now(); this.frames = 0; this.fpsAt = performance.now(); this.pollFailures = 0; this.running = true;
    addEventListener('resize', () => this.resize()); addEventListener('keydown', (e) => { if (e.code === 'KeyD') { this.debug = !this.debug; document.getElementById('debug').classList.toggle('hidden', !this.debug); } });
  }
  async start() {
    this.map = await fetch('/data/map.json', { cache: 'no-store' }).then((r) => { if (!r.ok) throw new Error('Static city map failed to load'); return r.json(); });
    this.renderer.setAssets(await this.loadAssets());
    this.camera = new PartyCamera(this.map.world.width, this.map.world.height); this.resize(); await this.poll(); this.pollTimer = setInterval(() => this.poll(), 66); requestAnimationFrame((t) => this.render(t));
  }
  async loadAssets() {
    const paths = { player1:'/assets/selected/characters/player_01_urban.png',player2:'/assets/selected/characters/player_02_urban.png',player3:'/assets/selected/characters/player_03_urban.png',player4:'/assets/selected/characters/player_04_urban.png',npc1:'/assets/selected/characters/npc_01_urban.png',npc2:'/assets/selected/characters/npc_02_urban.png',vehicleTeal:'/assets/selected/vehicles/urban_car_green_wide_a.png',vehicleAmber:'/assets/selected/vehicles/urban_car_yellow_wide_a.png',package:'/assets/selected/props/package_box.png',tree:'/assets/selected/props/tree_green_small.png'};
    const entries = await Promise.all(Object.entries(paths).map(async ([key, src]) => { try { const image = new Image(); image.src = src; await image.decode(); return [key, image]; } catch { return [key, null]; } }));
    return Object.fromEntries(entries.filter(([, image]) => image));
  }
  resize() { const dpr = Math.min(devicePixelRatio || 1, 2); this.canvas.width = Math.round(innerWidth * dpr); this.canvas.height = Math.round(innerHeight * dpr); this.canvas.style.width = `${innerWidth}px`; this.canvas.style.height = `${innerHeight}px`; this.ctx.setTransform(dpr,0,0,dpr,0,0); this.viewport = { width: innerWidth, height: innerHeight, dpr }; }
  async poll() {
    if (!this.running || this.polling) return; this.polling = true;
    try {
      const p = new URLSearchParams({ roomCode: this.options.room, sessionId: this.options.sessionId, view: 'party', party: this.options.partyId });
      const response = await fetch(`/api/state?${p}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`State HTTP ${response.status}`);
      const text = await response.text(); this.payloadSize = new TextEncoder().encode(text).length; const data = JSON.parse(text);
      if (data.ok === false || data.status === 'ended') throw new Error(data.error || 'Session ended');
      this.state = data; this.inventoryOverlay.update(data.world || data); this.pollFailures = 0; document.getElementById('connection-banner').classList.add('hidden');
    } catch (e) {
      this.pollFailures++; document.getElementById('connection-banner').classList.remove('hidden'); document.getElementById('connection-banner').textContent = this.pollFailures > 4 ? 'Local session ended or unavailable · persistent screen will recover' : 'Reconnecting to local authoritative host…';
    } finally { this.polling = false; }
  }
  render(now) {
    if (!this.running) return; const dt = Math.min(.1, (now - this.lastFrame) / 1000); this.lastFrame = now; this.frames++;
    if (now - this.fpsAt >= 1000) { this.renderFps = Math.round(this.frames * 1000 / (now - this.fpsAt)); this.frames = 0; this.fpsAt = now; }
    const ctx = this.ctx, viewport = this.viewport; ctx.setTransform(viewport.dpr,0,0,viewport.dpr,0,0); ctx.imageSmoothingEnabled = false; ctx.fillStyle = '#07110e'; ctx.fillRect(0,0,viewport.width,viewport.height);
    if (this.map && this.state) {
      const world = this.state.world || this.state; this.camera.update(world.actors || [], world.vehicles || [], this.options.partyId, viewport, dt, world.mission?.relay || null);
      this.camera.begin(ctx, viewport); this.renderer.drawMap(ctx, this.map, this.debug, world.territory?.enabled === true); drawAmbient(ctx, this.map); this.renderer.drawTerritory(ctx, world.territory); this.renderer.drawPackages(ctx, world.mission); this.renderer.drawMissionObjective(ctx, world.mission); this.renderer.drawVehicles(ctx, world.vehicles); this.renderer.drawNpcs(ctx, world.npcs); this.renderer.drawPlayers(ctx, world.actors); this.renderer.drawTetherWarnings(ctx, world.actors); this.renderer.drawProjectiles(ctx, world.projectiles); this.renderer.drawEffects(ctx, world.effects); this.camera.end(ctx);
      drawOffscreenIndicators(ctx, this.camera, viewport, world.actors || [], this.options.partyId); this.hud.update(world, this.state);
      const partyActors = (world.actors || []).filter((actor) => this.options.partyId === 'all' || actor.partyId === this.options.partyId); const hardTether = partyActors.some((actor) => actor.tether?.level === 'hard' || actor.tether?.movementBlocked); const warningTether = hardTether || partyActors.some((actor) => actor.tether?.level === 'warning' || actor.tether?.returnToParty); const warning = document.getElementById('tether-warning'); warning.classList.toggle('hidden', !warningTether); warning.textContent = hardTether ? 'HARD RANGE · OUTWARD MOVEMENT BLOCKED' : 'RETURN TO PARTY';
      const partyInBase = partyActors.some((actor) => actor.regeneration?.insideBase === true); document.getElementById('base-regen').classList.toggle('hidden', !partyInBase);
      if (this.debug) document.getElementById('debug').textContent = [`Server tick: ${this.state.tick ?? '—'}`,`Render FPS: ${this.renderFps}`,`Connected controllers: ${world.metrics?.connectedControllers ?? '—'}`,`Active actors: ${(world.actors || []).length}`,`Civilians: ${world.metrics?.civilianCount ?? '—'}`,`Rivals: ${world.metrics?.rivalCount ?? '—'}`,`Justice units: ${world.metrics?.justiceCount ?? '—'}`,`Projectiles: ${(world.projectiles || []).length}`,`Vehicles: ${(world.vehicles || []).length}`,`Party camera zoom: ${this.camera.zoom.toFixed(2)}`,`State payload: ${this.payloadSize} bytes`,`Party view: ${this.options.partyId}`].join('\n');
    }
    requestAnimationFrame((t) => this.render(t));
  }
}
