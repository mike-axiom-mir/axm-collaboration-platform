export class PartyCamera {
  constructor(worldWidth = 1024, worldHeight = 1024) {
    this.worldWidth = worldWidth; this.worldHeight = worldHeight;
    this.x = worldWidth / 2; this.y = worldHeight / 2; this.zoom = 1;
    this.targetX = this.x; this.targetY = this.y; this.targetZoom = 1;
    this.minZoom = .55; this.maxZoom = 2.4; this.margin = 190;
    this.separated = [];
  }
  positionOf(entity) { return entity?.position || { x: entity?.x ?? 0, y: entity?.y ?? 0 }; }
  update(actors, vehicles, partyId, viewport, dt = 1 / 60, missionAnchor = null) {
    const vehicleById = new Map((vehicles || []).map((v) => [v.id, v]));
    const focal = (actors || []).filter((a) => a.alive !== false && (partyId === 'all' || a.partyId === partyId)).map((actor) => {
      const vehicle = actor.currentVehicleId && vehicleById.get(actor.currentVehicleId);
      return this.positionOf(vehicle || actor);
    });
    if (missionAnchor && focal.length && missionAnchor.includeInCamera) focal.push(missionAnchor);
    if (!focal.length) return;
    const center = focal.reduce((sum, p) => ({ x: sum.x + p.x / focal.length, y: sum.y + p.y / focal.length }), { x: 0, y: 0 });
    const xs = focal.map((p) => p.x), ys = focal.map((p) => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const width = Math.max(80, maxX - minX), height = Math.max(80, maxY - minY);
    let desired = Math.min(viewport.width / (width + this.margin), viewport.height / (height + this.margin));
    const maxDistance = Math.max(0, ...focal.map((p) => Math.hypot(p.x - center.x, p.y - center.y)));
    if (maxDistance > 300) desired *= .9;
    this.targetX = Math.max(0, Math.min(this.worldWidth, center.x)); this.targetY = Math.max(0, Math.min(this.worldHeight, center.y));
    this.targetZoom = Math.max(this.minZoom, Math.min(this.maxZoom, desired));
    const moveBlend = 1 - Math.pow(.0015, dt), zoomBlend = 1 - Math.pow(.025, dt);
    this.x += (this.targetX - this.x) * moveBlend; this.y += (this.targetY - this.y) * moveBlend;
    this.zoom += (this.targetZoom - this.zoom) * zoomBlend;
    this.separated = focal.map((p, index) => ({ ...p, index, distance: Math.hypot(p.x - center.x, p.y - center.y) })).filter((p) => p.distance > 300);
  }
  begin(ctx, viewport) { ctx.save(); ctx.translate(viewport.width / 2, viewport.height / 2); ctx.scale(this.zoom, this.zoom); ctx.translate(-this.x, -this.y); }
  end(ctx) { ctx.restore(); }
  worldToScreen(p, viewport) { return { x: (p.x - this.x) * this.zoom + viewport.width / 2, y: (p.y - this.y) * this.zoom + viewport.height / 2 }; }
}
