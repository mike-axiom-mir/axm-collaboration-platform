const position = (e) => e?.position || { x: e?.x ?? 0, y: e?.y ?? 0 };
const partyColour = (party) => party === 'party_b' ? '#e98aff' : '#59e0b8';

export class EntityRenderer {
  constructor() { this.assets = {}; }
  setAssets(assets) { this.assets = assets || {}; }
  drawMap(ctx, map, debug = false, hideMissionZones = false) {
    const { layers, palette, world } = map;
    ctx.fillStyle = palette.ground; ctx.fillRect(0, 0, world.width, world.height);
    ['ground', 'roads', 'sidewalks'].forEach((layerName) => (layers[layerName] || []).forEach((item) => this.drawMapItem(ctx, item, palette)));
    (layers.details_below || []).forEach((item) => this.drawMapItem(ctx, item, palette));
    (layers.buildings || []).forEach((item) => this.drawBuilding(ctx, item, palette));
    (layers.details_above || []).forEach((item) => this.drawMapItem(ctx, item, palette));
    if (!hideMissionZones) this.drawMissionZones(ctx, layers.mission_zones || []);
    if (debug) { ctx.strokeStyle = '#ff5b6d99'; ctx.lineWidth = 1; (layers.collision || []).forEach((c) => ctx.strokeRect(c.x, c.y, c.w, c.h)); }
  }
  drawMapItem(ctx, item, palette) {
    if (item.type === 'rect') { ctx.fillStyle = palette[item.material] || '#6d7c72'; ctx.fillRect(item.x, item.y, item.w, item.h); }
    if (item.type === 'circle') {
      if (item.material === 'tree' && this.assets.tree) { const size = item.r * 2.25; ctx.drawImage(this.assets.tree, item.x - size / 2, item.y - size / 2, size, size); }
      else { ctx.fillStyle = item.material === 'tree' ? '#174d2d' : '#72877c'; ctx.beginPath(); ctx.arc(item.x, item.y, item.r, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#5ba16e'; ctx.stroke(); }
    }
    if (item.type === 'crosswalk') {
      ctx.fillStyle = '#d9d8c88e'; for (let i = 0; i < 7; i++) { ctx.fillRect(item.x + 8 + i * 25, item.y + 72, 13, 40); ctx.fillRect(item.x + 72, item.y + 8 + i * 25, 40, 13); }
    }
  }
  drawBuilding(ctx, b, palette) {
    if (b.type === 'walkable_building' || b.walkable === true) {
      const wall = 12;
      const entrance = b.entrance || { x: b.x + b.w / 2 - 24, w: 48 };
      ctx.fillStyle = '#121a18aa'; ctx.fillRect(b.x + 7, b.y + 9, b.w, b.h);
      ctx.fillStyle = palette.baseFloor || '#34554d'; ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = palette.baseWall || '#75c8ae';
      ctx.fillRect(b.x, b.y, wall, b.h); ctx.fillRect(b.x + b.w - wall, b.y, wall, b.h);
      if (entrance.side === 'south') {
        ctx.fillRect(b.x, b.y, b.w, wall);
        ctx.fillRect(b.x, b.y + b.h - wall, Math.max(0, entrance.x - b.x), wall);
        ctx.fillRect(entrance.x + entrance.w, b.y + b.h - wall, Math.max(0, b.x + b.w - entrance.x - entrance.w), wall);
        ctx.fillStyle = '#9bf0d555'; ctx.fillRect(entrance.x, b.y + b.h - wall - 3, entrance.w, wall + 6);
      } else {
        ctx.fillRect(b.x, b.y + b.h - wall, b.w, wall);
        ctx.fillRect(b.x, b.y, Math.max(0, entrance.x - b.x), wall);
        ctx.fillRect(entrance.x + entrance.w, b.y, Math.max(0, b.x + b.w - entrance.x - entrance.w), wall);
        ctx.fillStyle = '#9bf0d555'; ctx.fillRect(entrance.x, b.y - 3, entrance.w, wall + 6);
      }
      ctx.fillStyle = '#eafff8'; ctx.font = '900 10px system-ui'; ctx.textAlign = 'center'; ctx.fillText(b.name || b.id, b.x + b.w / 2, b.y + 31);
      ctx.fillStyle = '#aee9d7'; ctx.font = '700 7px system-ui'; ctx.fillText('BASE REGEN · 10 HP/S', b.x + b.w / 2, b.y + 44);
      return;
    }
    ctx.fillStyle = '#121a18aa'; ctx.fillRect(b.x + 7, b.y + 9, b.w, b.h);
    ctx.fillStyle = palette.building; ctx.fillRect(b.x, b.y, b.w, b.h); ctx.fillStyle = palette.buildingRoof; ctx.fillRect(b.x + 7, b.y + 7, b.w - 14, b.h - 14);
    ctx.fillStyle = '#281e22'; ctx.fillRect(b.x + b.w / 2 - 18, b.y + b.h - 13, 36, 13);
    ctx.fillStyle = '#fff9'; ctx.font = '700 9px system-ui'; ctx.textAlign = 'center'; ctx.fillText(b.name || b.id, b.x + b.w / 2, b.y + 21);
  }
  drawMissionZones(ctx, zones) {
    const now = performance.now() / 500;
    zones.forEach((z) => {
      const pickup = z.kind === 'pickup', board = z.kind === 'mission_board';
      ctx.fillStyle = board ? '#9b74ef33' : pickup ? '#ffcf5a22' : '#59e0b822';
      ctx.fillRect(z.x, z.y, z.w, z.h);
      ctx.strokeStyle = board ? '#c9afff' : pickup ? '#ffcf5a' : '#59e0b8';
      ctx.lineWidth = 2 + Math.sin(now); ctx.strokeRect(z.x + 2, z.y + 2, z.w - 4, z.h - 4);
      ctx.fillStyle = ctx.strokeStyle; ctx.font = '800 9px system-ui'; ctx.textAlign = 'center';
      ctx.fillText(board ? 'MISSION BOARD' : pickup ? 'PACKAGE DEPOT' : 'DELIVERY', z.x + z.w / 2, z.y + z.h / 2 + 3);
    });
  }
  drawTerritory(ctx, territory) {
    if (!territory?.enabled) return;
    const pulse = 1 + Math.sin(performance.now() / 260) * .08;
    Object.entries(territory.commandPosts || {}).forEach(([partyId, post]) => {
      const colour = partyColour(partyId);
      ctx.fillStyle = `${colour}22`; ctx.beginPath(); ctx.arc(post.x, post.y, post.radius, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = colour; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(post.x, post.y, post.radius * pulse, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#07110edd'; ctx.fillRect(post.x - 42, post.y - 13, 84, 26);
      ctx.fillStyle = colour; ctx.font = '900 8px system-ui'; ctx.textAlign = 'center'; ctx.fillText(`${partyId === 'party_a' ? 'A' : 'B'} COMMAND`, post.x, post.y - 2);
      ctx.fillStyle = '#fff'; ctx.font = '700 6px system-ui'; ctx.fillText('ACTION · HIRE CREW', post.x, post.y + 8);
    });
    (territory.zones || []).forEach((zone) => {
      const ownerColour = zone.ownerPartyId ? partyColour(zone.ownerPartyId) : '#e8dca6';
      const captureColour = zone.capturingPartyId ? partyColour(zone.capturingPartyId) : ownerColour;
      ctx.fillStyle = zone.contested ? '#ff765f2e' : `${ownerColour}20`;
      ctx.beginPath(); ctx.arc(zone.x, zone.y, zone.radius, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = ownerColour; ctx.lineWidth = zone.contested ? 4 : 2; ctx.beginPath(); ctx.arc(zone.x, zone.y, zone.radius, 0, Math.PI * 2); ctx.stroke();
      const progress = Math.min(1, Math.abs(Number(zone.progress) || 0) / 100);
      if (progress > 0) {
        ctx.strokeStyle = captureColour; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(zone.x, zone.y, zone.radius - 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress); ctx.stroke();
      }
      ctx.fillStyle = '#07110edc'; ctx.fillRect(zone.x - 47, zone.y - 12, 94, 24);
      ctx.fillStyle = ownerColour; ctx.font = '900 8px system-ui'; ctx.textAlign = 'center'; ctx.fillText((zone.label || zone.id).toUpperCase(), zone.x, zone.y - 1);
      const a = Number(zone.presence?.party_a) || 0, b = Number(zone.presence?.party_b) || 0;
      ctx.fillStyle = '#fff'; ctx.font = '700 6px system-ui'; ctx.fillText(zone.contested ? `CONTESTED · A ${a} / B ${b}` : zone.ownerPartyId ? `${zone.ownerPartyId === 'party_a' ? 'PARTY A' : 'PARTY B'} CONTROL` : `CAPTURE · A ${a} / B ${b}`, zone.x, zone.y + 8);
    });
  }
  drawVehicles(ctx, vehicles) {
    (vehicles || []).forEach((v) => {
      const p = position(v); ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(v.rotation || 0);
      ctx.fillStyle = '#07110e88'; ctx.fillRect(-22, -13, 44, 26);
      const sprite = v.style === 'amber' ? this.assets.vehicleAmber : this.assets.vehicleTeal;
      if (v.destroyed) {
        ctx.fillStyle = '#392f2d'; ctx.fillRect(-20, -11, 40, 22);
        ctx.strokeStyle = '#ff765f'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-16,-8); ctx.lineTo(16,8); ctx.moveTo(16,-8); ctx.lineTo(-16,8); ctx.stroke();
      } else if (sprite) ctx.drawImage(sprite, -22, -11, 44, 22);
      else { ctx.fillStyle = v.style === 'amber' ? '#e6a83f' : '#2aa889'; ctx.fillRect(-20, -11, 40, 22); ctx.fillStyle = '#bce5e0'; ctx.fillRect(-8, -8, 14, 16); }
      const count = (v.passengerActorIds?.length || 0) + (v.driverActorId ? 1 : 0);
      if (count) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, -18, 8, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#07110e'; ctx.font = '800 9px system-ui'; ctx.textAlign = 'center'; ctx.fillText(String(count), 0, -15); }
      ctx.fillStyle = '#251d1c'; ctx.fillRect(-20, 15, 40, 4); ctx.fillStyle = v.health <= 15 ? '#ff765f' : '#8de36f'; ctx.fillRect(-20, 15, 40 * Math.max(0, v.health || 0) / Math.max(1, v.maxHealth || 50), 4);
      ctx.restore();
    });
  }
  drawPackages(ctx, mission) { (mission?.packages || []).filter((p) => !p.delivered && !p.carrierActorId).forEach((pkg) => { const p = position(pkg); if (this.assets.package) ctx.drawImage(this.assets.package, p.x - 10, p.y - 10, 20, 20); else { ctx.fillStyle = '#ffcd70'; ctx.fillRect(p.x - 7, p.y - 7, 14, 14); ctx.strokeStyle = '#6e4e18'; ctx.strokeRect(p.x - 7, p.y - 7, 14, 14); } }); }
  drawNpcs(ctx, npcs) {
    (npcs || []).forEach((npc, index) => {
      const p = position(npc);
      if (npc.alive === false) {
        ctx.fillStyle = npc.hostile ? '#7b384155' : '#d4c9a344'; ctx.beginPath(); ctx.ellipse(p.x, p.y + 4, 9, 4, 0, 0, Math.PI * 2); ctx.fill();
        return;
      }
      const sprite = index % 2 ? this.assets.npc2 : this.assets.npc1;
      if (sprite) { const frame = this.frameFor(npc); ctx.drawImage(sprite, frame.sx, frame.sy, 16, 16, p.x - 11, p.y - 13, 22, 22); }
      else { ctx.fillStyle = npc.state === 'flee' ? '#ffd46b' : '#d4c9a3'; ctx.beginPath(); ctx.arc(p.x, p.y, 7, 0, Math.PI * 2); ctx.fill(); }
      if (npc.hostile) {
        const crew = npc.kind === 'crew';
        const colour = crew ? partyColour(npc.partyId) : npc.kind === 'cop' ? '#74a9ff' : '#ff765f';
        ctx.strokeStyle = colour; ctx.lineWidth = npc.state === 'windup' ? 3 : 2; ctx.beginPath(); ctx.arc(p.x, p.y + 1, npc.role === 'blocker' ? 13 : 11, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = '#241719'; ctx.fillRect(p.x - 12, p.y - 19, 24, 3); ctx.fillStyle = colour; ctx.fillRect(p.x - 12, p.y - 19, 24 * npc.health / Math.max(1, npc.maxHealth), 3);
        const factionLabel = crew ? `${npc.partyId === 'party_a' ? 'A' : 'B'} CREW` : npc.kind === 'cop' ? 'JUSTICE' : 'RIVAL';
        ctx.fillStyle = colour; ctx.font = '900 7px system-ui'; ctx.textAlign = 'center'; ctx.fillText(`${factionLabel} · ${npc.role.toUpperCase()}`, p.x, p.y - 23);
        if (npc.state === 'windup') { ctx.fillStyle = '#ffe29b'; ctx.fillText('!', p.x + 12, p.y - 8); }
      } else {
        ctx.fillStyle = '#ffffff99'; ctx.font = '6px system-ui'; ctx.textAlign = 'center'; ctx.fillText(`${npc.health}/${npc.maxHealth}`, p.x, p.y - 14);
      }
    });
  }
  drawMissionObjective(ctx, mission) {
    if (!mission?.relay) return;
    const p = position(mission.relay), ratio = mission.relay.health / Math.max(1, mission.relay.maxHealth);
    ctx.fillStyle = '#163f36'; ctx.fillRect(p.x - 13, p.y - 18, 26, 36); ctx.strokeStyle = '#59e0b8'; ctx.lineWidth = 3; ctx.strokeRect(p.x - 13, p.y - 18, 26, 36);
    ctx.fillStyle = '#07110e'; ctx.fillRect(p.x - 22, p.y - 29, 44, 5); ctx.fillStyle = ratio < .35 ? '#ff765f' : '#59e0b8'; ctx.fillRect(p.x - 22, p.y - 29, 44 * Math.max(0, ratio), 5);
    ctx.fillStyle = '#fff'; ctx.font = '900 8px system-ui'; ctx.textAlign = 'center'; ctx.fillText(`RELAY ${mission.relay.health}/${mission.relay.maxHealth}`, p.x, p.y - 34);
  }
  drawPlayers(ctx, actors) { (actors || []).forEach((actor) => { if (actor.alive === false) return; const p = position(actor), colour = partyColour(actor.partyId); ctx.save(); ctx.translate(p.x, p.y); if (actor.currentVehicleId) { const offsetX = (((actor.slot || 1) - 1) % 4 - 1.5) * 10; ctx.strokeStyle = actor.tether?.returnToParty ? '#ff7683' : colour; ctx.lineWidth = actor.tether?.returnToParty ? 3 : 2; ctx.beginPath(); ctx.arc(0, 0, 23, 0, Math.PI * 2); ctx.stroke(); ctx.fillStyle = colour; ctx.beginPath(); ctx.arc(offsetX, -20, 6, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#07110e'; ctx.font = '900 7px system-ui'; ctx.textAlign = 'center'; ctx.fillText(`${actor.slot ?? '?'}`, offsetX, -18); ctx.restore(); return; } ctx.fillStyle = colour; ctx.globalAlpha = .48; ctx.beginPath(); ctx.arc(0, 4, 13, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; const sprite = this.assets[`player${Math.max(1, Math.min(4, actor.slot || 1))}`]; if (sprite) { const frame = this.frameFor(actor); ctx.drawImage(sprite, frame.sx, frame.sy, 16, 16, -12, -15, 24, 24); } else { ctx.fillStyle = colour; ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill(); } ctx.strokeStyle = actor.tether?.returnToParty ? '#ff7683' : '#ecfff9'; ctx.lineWidth = actor.tether?.returnToParty ? 3 : 1.2; ctx.beginPath(); ctx.arc(0, 4, 13, 0, Math.PI * 2); ctx.stroke(); if (actor.carryingPackageId) { if (this.assets.package) ctx.drawImage(this.assets.package, -7, -23, 14, 14); else { ctx.fillStyle = '#ffcd70'; ctx.fillRect(-5, -17, 10, 9); } } ctx.restore(); ctx.font = '800 8px system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = '#06100d'; ctx.beginPath(); ctx.arc(p.x + 10, p.y - 9, 7, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = colour; ctx.fillText(`${actor.slot ?? '?'}`, p.x + 10, p.y - 6); ctx.fillStyle = '#fff'; ctx.fillText((actor.displayName || actor.seatId || actor.id).slice(0, 12), p.x, p.y - 20); if (actor.tether?.returnToParty) { ctx.fillStyle = '#ff8894'; ctx.font = '900 7px system-ui'; ctx.fillText(actor.tether?.movementBlocked ? 'MOVE BACK' : 'RETURN', p.x, p.y + 24); } }); }
  drawProjectiles(ctx, projectiles) { (projectiles || []).forEach((shot) => { const p = position(shot); ctx.fillStyle = shot.hostile ? (shot.ownerFaction === 'district-justice' ? '#74a9ff' : '#ff765f') : partyColour(shot.partyId || shot.ownerPartyId); ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 8; ctx.beginPath(); ctx.arc(p.x, p.y, shot.hostile ? 4 : 3, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0; }); }
  drawTetherWarnings(ctx, actors) { (actors || []).filter((actor) => actor.alive !== false && ['soft','warning','hard'].includes(actor.tether?.level)).forEach((actor) => { const p = position(actor); const allies = (actors || []).filter((other) => other.alive !== false && other.id !== actor.id && other.partyId === actor.partyId); if (!allies.length) return; const centre = allies.reduce((sum, ally) => { const ap = position(ally); return { x: sum.x + ap.x / allies.length, y: sum.y + ap.y / allies.length }; }, { x: 0, y: 0 }); const angle = Math.atan2(centre.y - p.y, centre.x - p.x); const colour = actor.tether.level === 'soft' ? '#ffcd70' : '#ff7683'; ctx.save(); ctx.translate(p.x, p.y); ctx.strokeStyle = colour; ctx.lineWidth = actor.tether.level === 'hard' ? 3 : 2; ctx.beginPath(); ctx.arc(0, 0, actor.currentVehicleId ? 28 : 18, 0, Math.PI * 2); ctx.stroke(); ctx.rotate(angle); ctx.fillStyle = colour; ctx.beginPath(); ctx.moveTo(26, 0); ctx.lineTo(17, -5); ctx.lineTo(17, 5); ctx.closePath(); ctx.fill(); ctx.restore(); ctx.fillStyle = colour; ctx.font = '900 7px system-ui'; ctx.textAlign = 'center'; ctx.fillText(actor.tether.level === 'soft' ? 'STAY CLOSE' : actor.tether.movementBlocked ? 'MOVE BACK' : 'RETURN', p.x, p.y + (actor.currentVehicleId ? 35 : 29)); }); }
  drawEffects(ctx, effects) { (effects || []).forEach((effect) => { const p = position(effect); const kind = effect.kind || effect.type; const blocked = kind === 'friendly-fire-blocked' || kind === 'shield-spark' || kind === 'grace-spark'; const dryFire = kind === 'dry-fire'; const explosion = kind === 'vehicle-explosion'; const territory = kind === 'zone-captured' || kind === 'reinforcement-arrival'; ctx.strokeStyle = territory ? partyColour(effect.partyId) : blocked ? '#76dfff' : dryFire ? '#ffcd70' : '#ff7e72'; ctx.lineWidth = explosion ? 5 : territory ? 4 : 2; ctx.beginPath(); ctx.arc(p.x, p.y, explosion ? 32 : territory ? 24 : blocked ? 12 : dryFire ? 5 : 7, 0, Math.PI * 2); ctx.stroke(); }); }
  frameFor(entity) { const f = entity.facing || entity.velocity || { x: 0, y: 1 }; const ax = Math.abs(f.x || 0), ay = Math.abs(f.y || 0); let col = 1; if (ax > ay) col = f.x >= 0 ? 3 : 0; else col = f.y < 0 ? 2 : 1; const moving = Math.hypot(entity.velocity?.x || 0, entity.velocity?.y || 0) > 2; const row = moving ? Math.floor(performance.now() / 180) % 3 : 1; return { sx: col * 16, sy: row * 16 }; }
}
