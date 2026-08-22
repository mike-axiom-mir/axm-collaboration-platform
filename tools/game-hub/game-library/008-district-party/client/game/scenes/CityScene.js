import { PartyCamera } from '../rendering/party-camera.js';
import { EntityRenderer } from '../rendering/entity-renderer.js';
import { MapChunkLoader } from '../rendering/map-chunk-loader.js';
import { drawAmbient } from '../rendering/effects.js';
import { Hud } from '../ui/hud.js';
import { drawOffscreenIndicators } from '../ui/indicators.js';
import { InventoryOverlay } from '../ui/inventory-overlay.js';
import { drawCityMap } from '../ui/city-map.js';
import { DistrictDepthStage } from '../rendering/district-depth-stage.js';

export class CityScene {
  constructor(canvas, options) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d', { alpha: false }); this.options = options;
    this.renderer = new EntityRenderer(); this.hud = new Hud(options.partyId); this.inventoryOverlay = new InventoryOverlay('inventory-overlays', options.partyId); this.state = null; this.map = null; this.cityArt = null; this.camera = null; this.chunkLoader = null; this.depthStage = null;
    this.debug = false; this.mapMode = 'minimap'; this.remoteMapToggleSequence = null; this.renderFps = 0; this.payloadSize = 0; this.lastFrame = performance.now(); this.frames = 0; this.fpsAt = performance.now(); this.pollFailures = 0; this.running = true;
    this.sessionMenuOpen = false; this.sessionMenuSurface = null; this.sessionMenuSurfaceAria = null; this.sessionMenuPreviousFocus = null;
    this.mapButton = document.getElementById('map-toggle');
    this.sessionMenu = document.getElementById('session-menu');
    this.sessionMenuReturn = document.getElementById('session-menu-return');
    this.mapButton?.addEventListener('click', () => this.toggleMap());
    this.sessionMenuReturn?.addEventListener('click', () => this.closeSessionMenu());
    this.setMapMode('minimap');
    addEventListener('resize', () => this.resize());
    addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && !e.repeat) {
        if (this.sessionMenuOpen) this.closeSessionMenu();
        else if (this.mapMode === 'full') this.setMapMode('minimap');
        else {
          const surface = this.blockingSurface();
          if (!surface) return;
          this.openSessionMenu(surface);
        }
        e.preventDefault();
        return;
      }
      if (this.sessionMenuOpen) return;
      if (e.code === 'KeyD') { this.debug = !this.debug; document.getElementById('debug').classList.toggle('hidden', !this.debug); }
      if (e.code === 'KeyM' && !e.repeat) { e.preventDefault(); this.toggleMap(); }
    });
  }
  blockingSurface() {
    const candidates = [
      ['save-computer', 'GROUP SAVE COMPUTER', 'The authoritative group save computer remains in place. Escape did not save, load, or confirm anything.'],
      ['results', 'RESULTS', 'The authoritative result remains in place. Escape did not continue, replay, restart, or end the session.'],
      ['mission-menu', 'MISSION BOARD', 'The server-authoritative mission board remains in place. Escape did not select, start, or cancel a mission.'],
      ['city-venue-menu', 'CITY VENUE', 'The authoritative venue menu remains in place. Escape did not buy, play, tune, or leave anything.'],
    ];
    for (const [id, label, copy] of candidates) {
      const element = document.getElementById(id);
      if (element && !element.classList.contains('hidden')) return { id, label, copy, element };
    }
    const inventory = document.getElementById('inventory-overlays');
    if (inventory?.childElementCount) return { id: 'inventory-overlays', label: 'PLAYER INVENTORY', copy: 'The authoritative player inventory remains in place. Escape did not move, equip, or use an item.', element: inventory };
    return null;
  }
  setSessionMenuSurface(surface) {
    if (this.sessionMenuSurface?.element) {
      if (this.sessionMenuSurfaceAria === null) this.sessionMenuSurface.element.removeAttribute('aria-hidden');
      else this.sessionMenuSurface.element.setAttribute('aria-hidden', this.sessionMenuSurfaceAria);
    }
    this.sessionMenuSurface = surface;
    this.sessionMenuSurfaceAria = surface?.element?.getAttribute('aria-hidden') ?? null;
    if (surface?.element) surface.element.setAttribute('aria-hidden', 'true');
    if (!surface) return;
    document.getElementById('session-menu-copy').textContent = surface.copy;
    this.sessionMenuReturn.textContent = `RETURN TO ${surface.label}`;
  }
  openSessionMenu(surface = this.blockingSurface()) {
    if (!surface || this.sessionMenuOpen) return false;
    this.sessionMenuOpen = true;
    this.sessionMenuPreviousFocus = document.activeElement;
    this.setSessionMenuSurface(surface);
    this.sessionMenu.classList.remove('hidden');
    document.body.classList.add('session-menu-open');
    setTimeout(() => this.sessionMenuReturn?.focus(), 0);
    return true;
  }
  closeSessionMenu({ restoreFocus = true } = {}) {
    if (!this.sessionMenuOpen) return false;
    this.sessionMenuOpen = false;
    this.sessionMenu.classList.add('hidden');
    document.body.classList.remove('session-menu-open');
    this.setSessionMenuSurface(null);
    if (restoreFocus && this.sessionMenuPreviousFocus?.isConnected && this.sessionMenuPreviousFocus !== document.body) this.sessionMenuPreviousFocus.focus();
    this.sessionMenuPreviousFocus = null;
    return true;
  }
  syncSessionMenu() {
    if (!this.sessionMenuOpen) return;
    const surface = this.blockingSurface();
    if (!surface) { this.closeSessionMenu({ restoreFocus: false }); return; }
    if (surface.id !== this.sessionMenuSurface?.id) this.setSessionMenuSurface(surface);
  }
  setMapMode(mode) {
    this.mapMode = mode === 'full' ? 'full' : 'minimap';
    document.body.classList.toggle('map-open', this.mapMode === 'full');
    if (this.mapButton) {
      this.mapButton.setAttribute('aria-expanded', String(this.mapMode === 'full'));
      const label = this.mapButton.querySelector('strong');
      if (label) label.textContent = this.mapMode === 'full' ? 'CLOSE MAP' : 'FULL MAP';
    }
  }
  toggleMap() { this.setMapMode(this.mapMode === 'full' ? 'minimap' : 'full'); }
  applyRemoteMapToggle(world) {
    const sequence = Number(world?.presentation?.mapToggleSequence);
    if (!Number.isSafeInteger(sequence) || sequence < 0) return;
    if (this.remoteMapToggleSequence === null || sequence < this.remoteMapToggleSequence) {
      this.remoteMapToggleSequence = sequence;
      return;
    }
    const delta = sequence - this.remoteMapToggleSequence;
    this.remoteMapToggleSequence = sequence;
    if (delta > 0 && delta % 2 === 1) this.toggleMap();
  }
  async start() {
    const worldParams = new URLSearchParams({ roomCode: this.options.room, sessionId: this.options.sessionId });
    const staticWorld = await fetch(`/api/world?${worldParams}`, { cache: 'no-store' })
      .then((response) => { if (!response.ok) throw new Error('Authoritative map contract failed to load'); return response.json(); });
    const mapUrl = staticWorld.mapUrl || '/data/map.json';
    const cityArtUrl = staticWorld.cityArtUrl || '/data/city-art.json';
    const cityArtRequest = cityArtUrl === '/data/city-art.json'
      ? fetch('/data/city-art.json', { cache: 'no-store' })
      : fetch(cityArtUrl, { cache: 'no-store' });
    [this.map, this.cityArt] = await Promise.all([
      fetch(mapUrl, { cache: 'no-store' }).then((r) => { if (!r.ok) throw new Error('Static city map failed to load'); return r.json(); }),
      cityArtRequest.then((r) => r.ok ? r.json() : null).catch(() => null),
    ]);
    this.mapSelection = { id: staticWorld.mapId, name: staticWorld.mapName, mapUrl, cityArtUrl };
    if (this.cityArt?.palette) this.map.palette = { ...this.map.palette, ...this.cityArt.palette };
    this.renderer.setAssets(await this.loadAssets()); this.renderer.setCityArt(this.cityArt); this.chunkLoader = new MapChunkLoader(this.map);
    try { this.depthStage = new DistrictDepthStage(document.getElementById('city-depth-canvas')); }
    catch (error) { document.body.classList.add('depth-stage-unavailable'); console.warn(`Low-poly city depth stage unavailable: ${error.message}`); }
    this.camera = new PartyCamera(this.map.world.width, this.map.world.height); this.resize(); await this.poll(); this.pollTimer = setInterval(() => this.poll(), 66); requestAnimationFrame((t) => this.render(t));
  }
  async loadAssets() {
    const paths = {
      player1: '/assets/selected/characters/player_01_urban.png',
      player2: '/assets/selected/characters/player_02_urban.png',
      player3: '/assets/selected/characters/player_03_urban.png',
      player4: '/assets/selected/characters/player_04_urban.png',
      modernPlayer1: '/assets/selected/characters/axm_generated/player_01_axm.png',
      modernPlayer2: '/assets/selected/characters/axm_generated/player_02_axm.png',
      modernPlayer3: '/assets/selected/characters/axm_generated/player_03_axm.png',
      modernPlayer4: '/assets/selected/characters/axm_generated/player_04_axm.png',
      npc1: '/assets/selected/characters/npc_01_urban.png',
      npc2: '/assets/selected/characters/npc_02_urban.png',
      resident1: '/assets/selected/characters/axm_generated/resident_old_man.png',
      resident2: '/assets/selected/characters/axm_generated/resident_man_backpack.png',
      resident3: '/assets/selected/characters/axm_generated/resident_woman_backpack-v2.png',
      resident4: '/assets/selected/characters/axm_generated/resident_woman_tote.png',
      vehicleTeal: '/assets/selected/vehicles/urban_car_green_wide_a.png',
      vehicleAmber: '/assets/selected/vehicles/urban_car_yellow_wide_a.png',
      sedanSilver: '/assets/selected/vehicles/axm_generated/sedan_silver.png',
      sportRed: '/assets/selected/vehicles/axm_generated/sport_red.png',
      shopkeeperNeutral: '/assets/selected/shopkeepers/axm_generated/shopkeeper_neutral.png',
      shopkeeperAxm: '/assets/selected/shopkeepers/axm_generated/shopkeeper_axm.png',
      buildingCafe: '/assets/selected/buildings/axm_generated/corner_cafe.png',
      buildingCornerShop: '/assets/selected/buildings/axm_generated/corner_shop_house.png',
      buildingApartment: '/assets/selected/buildings/axm_generated/apartment_blue_doors.png',
      buildingRow: '/assets/selected/buildings/axm_generated/row_houses.png',
      package: '/assets/selected/props/package_box.png',
      packageDuffel: '/assets/selected/interactables/axm_generated/parcel_duffel_black.png',
      packageBriefcase: '/assets/selected/interactables/axm_generated/parcel_briefcase_black.png',
      packageBox: '/assets/selected/interactables/axm_generated/parcel_box_taped.png',
      packageCrateWood: '/assets/selected/interactables/axm_generated/parcel_crate_wood.png',
      packageCratePlastic: '/assets/selected/interactables/axm_generated/parcel_crate_plastic.png',
      propSafe: '/assets/selected/interactables/axm_generated/safe_floor_black.png',
      propVending: '/assets/selected/interactables/axm_generated/vending_red.png',
      propAtm: '/assets/selected/interactables/axm_generated/atm_black.png',
      propBarrel: '/assets/selected/interactables/axm_generated/barrel_rust.png',
      propPallet: '/assets/selected/interactables/axm_generated/pallet_wood.png',
      propDumpster: '/assets/selected/interactables/axm_generated/dumpster_green.png',
      propBench: '/assets/selected/interactables/axm_generated/bench_wood.png',
      propBollard: '/assets/selected/interactables/axm_generated/bollard_black.png',
      propTrashCan: '/assets/selected/interactables/axm_generated/trash_can_green.png',
      tree: '/assets/selected/props/tree_green_small.png',
    };
    const entries = await Promise.all(Object.entries(paths).map(async ([key, src]) => { try { const image = new Image(); image.src = src; await image.decode(); return [key, image]; } catch { return [key, null]; } }));
    return Object.fromEntries(entries.filter(([, image]) => image));
  }
  resize() { const dpr = Math.min(devicePixelRatio || 1, 2); this.canvas.width = Math.round(innerWidth * dpr); this.canvas.height = Math.round(innerHeight * dpr); this.canvas.style.width = `${innerWidth}px`; this.canvas.style.height = `${innerHeight}px`; this.ctx.setTransform(dpr,0,0,dpr,0,0); this.viewport = { width: innerWidth, height: innerHeight, dpr }; this.depthStage?.resize(this.viewport); }
  async poll() {
    if (!this.running || this.polling) return; this.polling = true;
    try {
      const p = new URLSearchParams({ roomCode: this.options.room, sessionId: this.options.sessionId, view: 'party', party: this.options.partyId });
      const response = await fetch(`/api/state?${p}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`State HTTP ${response.status}`);
      const text = await response.text(); this.payloadSize = new TextEncoder().encode(text).length; const data = JSON.parse(text);
      if (data.ok === false || data.status === 'ended') throw new Error(data.error || 'Session ended');
      this.state = data; const world = data.world || data; this.applyRemoteMapToggle(world); this.inventoryOverlay.update(world); this.pollFailures = 0; document.getElementById('connection-banner').classList.add('hidden');
    } catch (e) {
      this.pollFailures++; document.getElementById('connection-banner').classList.remove('hidden'); document.getElementById('connection-banner').textContent = this.pollFailures > 4 ? 'Local session ended or unavailable · persistent screen will recover' : 'Reconnecting to local authoritative host…';
    } finally { this.polling = false; }
  }
  render(now) {
    if (!this.running) return; const dt = Math.min(.1, (now - this.lastFrame) / 1000); this.lastFrame = now; this.frames++;
    if (now - this.fpsAt >= 1000) { this.renderFps = Math.round(this.frames * 1000 / (now - this.fpsAt)); this.frames = 0; this.fpsAt = now; }
    const ctx = this.ctx, viewport = this.viewport; ctx.setTransform(viewport.dpr,0,0,viewport.dpr,0,0); ctx.imageSmoothingEnabled = false; ctx.fillStyle = '#07110e'; ctx.fillRect(0,0,viewport.width,viewport.height);
    if (this.map && this.state) {
      const world = this.state.world || this.state; this.camera.update(world.actors || [], world.vehicles || [], this.options.partyId, viewport, dt, world.mission?.relay || null); const visibleBounds = this.camera.visibleBounds(viewport, 64); this.chunkLoader?.update(visibleBounds); const visibleChunks = this.chunkLoader?.visibleChunks(visibleBounds) || []; this.depthStage?.render({ world, camera: this.camera, viewport, chunks: visibleChunks, partyId: this.options.partyId, now });
      this.camera.begin(ctx, viewport); this.renderer.drawMapBackground(ctx, this.map); if (this.chunkLoader?.enabled) { this.chunkLoader.visibleChunks(visibleBounds).forEach((chunk) => this.renderer.drawMapChunk(ctx, chunk, this.map.palette, this.debug)); this.renderer.drawGameplayMapLayers(ctx, this.map, this.debug, world.territory?.enabled === true); } else this.renderer.drawMap(ctx, this.map, this.debug, world.territory?.enabled === true); this.renderer.drawCityArt(ctx, this.cityArt); this.renderer.drawCityAtmosphere(ctx, this.map, world.cityLife, this.cityArt); drawAmbient(ctx, this.map); this.renderer.drawTerritory(ctx, world.territory); this.renderer.drawPackages(ctx, world.mission); this.renderer.drawMissionObjective(ctx, world.mission); this.renderer.drawSaveTerminal(ctx, world.groupSaveComputer); this.renderer.drawCityLife(ctx, world.cityLife, world.actors); this.renderer.drawCombatDrops(ctx, world.gearDrops); this.renderer.drawVehicles(ctx, world.vehicles); this.renderer.drawNpcs(ctx, world.npcs); this.renderer.drawPlayers(ctx, world.actors); this.renderer.drawTetherWarnings(ctx, world.actors); this.renderer.drawProjectiles(ctx, world.projectiles); this.renderer.drawEffects(ctx, world.effects); this.camera.end(ctx);
      drawOffscreenIndicators(ctx, this.camera, viewport, world.actors || [], this.options.partyId); drawCityMap(ctx, viewport, this.map, world, this.camera, this.options.partyId, this.mapMode, this.cityArt); this.hud.update(world, this.state); this.syncSessionMenu();
      const partyActors = (world.actors || []).filter((actor) => this.options.partyId === 'all' || actor.partyId === this.options.partyId); const hardTether = partyActors.some((actor) => actor.tether?.level === 'hard' || actor.tether?.movementBlocked); const warningTether = hardTether || partyActors.some((actor) => actor.tether?.level === 'warning' || actor.tether?.returnToParty); const warning = document.getElementById('tether-warning'); warning.classList.toggle('hidden', !warningTether); warning.textContent = hardTether ? 'HARD RANGE · OUTWARD MOVEMENT BLOCKED' : 'RETURN TO PARTY';
      const partyInBase = partyActors.some((actor) => actor.regeneration?.insideBase === true); document.getElementById('base-regen').classList.toggle('hidden', !partyInBase);
      if (this.debug) { const chunks = this.chunkLoader?.diagnostics() || {}; document.getElementById('debug').textContent = [`Server tick: ${this.state.tick ?? '—'}`,`Render FPS: ${this.renderFps}`,`Connected controllers: ${world.metrics?.connectedControllers ?? '—'}`,`Active actors: ${(world.actors || []).length}`,`Civilians: ${world.metrics?.civilianCount ?? '—'}`,`Rivals: ${world.metrics?.rivalCount ?? '—'}`,`Justice units: ${world.metrics?.justiceCount ?? '—'}`,`Projectiles: ${(world.projectiles || []).length}`,`Vehicles: ${(world.vehicles || []).length}`,`Party camera zoom: ${this.camera.zoom.toFixed(2)}`,`Map chunks: ${chunks.loaded ?? 0} loaded · ${chunks.loading ?? 0} loading · ${chunks.wanted ?? 0} nearby`,`State payload: ${this.payloadSize} bytes`,`Party view: ${this.options.partyId}`].join('\n'); }
    }
    requestAnimationFrame((t) => this.render(t));
  }
}
