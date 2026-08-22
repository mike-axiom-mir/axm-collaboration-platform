const position = (e) => e?.position || { x: e?.x ?? 0, y: e?.y ?? 0 };
const partyColour = (party) => party === 'party_b' ? '#e98aff' : '#59e0b8';
const hashString = (value) => {
  let hash = 2166136261;
  for (const character of String(value || '')) { hash ^= character.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  return hash >>> 0;
};
const rectSize = (item) => ({ width: Number(item.w ?? item.width) || 0, height: Number(item.h ?? item.height) || 0 });
const tuningPaint = (id) => ({
  factory: ['#c7d0d4', '#f2fbff'],
  'mint-circuit': ['#39d7ad', '#d8fff3'],
  'magenta-night': ['#d86bff', '#ffd9ff'],
  'amber-rally': ['#f0aa3c', '#fff0b5'],
  redline: ['#ff5664', '#ffd6d9'],
  'teal-wave': ['#35b9c6', '#ccfbff'],
}[id] || ['#c7d0d4', '#f2fbff']);

export class EntityRenderer {
  constructor() { this.assets = {}; this.cityArt = null; this.presentationClock = () => performance.now(); }
  setAssets(assets) { this.assets = assets || {}; }
  setCityArt(cityArt) { this.cityArt = cityArt || null; }
  setPresentationClock(clock) { this.presentationClock = typeof clock === 'function' ? clock : (() => performance.now()); }
  drawMap(ctx, map, debug = false, hideMissionZones = false) {
    const { layers, palette, world } = map;
    ctx.fillStyle = palette.ground; ctx.fillRect(0, 0, world.width, world.height);
    this.drawLayerSet(ctx, layers, palette, debug);
    if (!hideMissionZones) this.drawMissionZones(ctx, layers.mission_zones || []);
  }
  drawMapBackground(ctx, map) {
    ctx.fillStyle = map.palette.ground;
    ctx.fillRect(0, 0, map.world.width, map.world.height);
  }
  drawMapChunk(ctx, chunk, palette, debug = false) {
    const width = Number(chunk.bounds?.width) || 1024;
    const height = Number(chunk.bounds?.height) || 1024;
    if (!chunk.__axmSurface) {
      const surface = typeof OffscreenCanvas === 'function'
        ? new OffscreenCanvas(width, height)
        : Object.assign(document.createElement('canvas'), { width, height });
      const surfaceContext = surface.getContext('2d', { alpha: true });
      surfaceContext.imageSmoothingEnabled = false;
      this.drawChunkFoundation(surfaceContext, chunk, palette);
      surfaceContext.save();
      surfaceContext.translate(-(Number(chunk.bounds?.x) || 0), -(Number(chunk.bounds?.y) || 0));
      this.drawLayerSet(surfaceContext, chunk.layers || {}, palette, false);
      surfaceContext.restore();
      chunk.__axmSurface = surface;
    }
    ctx.drawImage(chunk.__axmSurface, Number(chunk.bounds?.x) || 0, Number(chunk.bounds?.y) || 0);
    if (debug) {
      ctx.strokeStyle = '#ff5b6d99'; ctx.lineWidth = 1;
      (chunk.layers?.collision || []).forEach((item) => this.strokeShape(ctx, item));
    }
  }
  drawGameplayMapLayers(ctx, map, debug = false, hideMissionZones = false) {
    this.drawLayerSet(ctx, map.layers || {}, map.palette, debug);
    if (!hideMissionZones) this.drawMissionZones(ctx, map.layers?.mission_zones || []);
  }
  drawChunkFoundation(ctx, chunk, palette) {
    const width = Number(chunk.bounds?.width) || 1024;
    const height = Number(chunk.bounds?.height) || 1024;
    const originX = Number(chunk.bounds?.x) || 0;
    const originY = Number(chunk.bounds?.y) || 0;
    ctx.fillStyle = palette.ground || '#203730'; ctx.fillRect(0, 0, width, height);
    const groundLight = ctx.createLinearGradient(0, 0, width, height);
    groundLight.addColorStop(0, '#9bd8bf0b'); groundLight.addColorStop(.5, '#07110e00'); groundLight.addColorStop(1, '#0207061f');
    ctx.fillStyle = groundLight; ctx.fillRect(0, 0, width, height);
    const seed = hashString(chunk.id || `${chunk.column}:${chunk.row}`);
    for (let y = 16; y < height; y += 48) {
      for (let x = 16; x < width; x += 48) {
        const value = hashString(`${seed}:${originX + x}:${originY + y}`);
        ctx.fillStyle = value % 3 ? '#2a443b55' : '#172f2955';
        ctx.fillRect(x + (value % 11), y + ((value >>> 5) % 11), value % 5 === 0 ? 3 : 2, 2);
      }
    }
    ctx.strokeStyle = '#4d6b6010'; ctx.lineWidth = 1;
    for (let x = 64 - (originX % 64); x < width; x += 64) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke(); }
    for (let y = 64 - (originY % 64); y < height; y += 64) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }
  }
  drawLayerSet(ctx, layers, palette, debug = false) {
    this.drawSourceLayer(ctx, layers.ground || [], palette, 'park', (item) => this.drawPark(ctx, item, palette));
    this.drawSourceLayer(ctx, layers.details_below || [], palette, null, (item) => this.drawMapItem(ctx, item, palette));
    const buildings = layers.buildings || [];
    const sourceMass = buildings.filter((item) => item.id?.startsWith('tile-buildings-'));
    if (sourceMass.length) this.drawBuildingMass(ctx, sourceMass, palette);
    buildings.filter((item) => !item.id?.startsWith('tile-buildings-')).forEach((item) => this.drawBuilding(ctx, item, palette));
    // BGT layers overlap at tile edges. Public ways are authoritative open space,
    // so paint them above roof mass instead of letting buildings visually bury
    // collision-safe streets.
    this.drawSourceLayer(ctx, layers.sidewalks || [], palette, 'sidewalk', (item) => this.drawSidewalk(ctx, item, palette));
    this.drawSourceLayer(ctx, layers.roads || [], palette, 'road', (item) => this.drawRoad(ctx, item, palette));
    this.drawSourceLayer(ctx, layers.details_above || [], palette, null, (item) => item.material === 'rail' ? this.drawRail(ctx, item, palette) : this.drawMapItem(ctx, item, palette));
    if (debug) {
      ctx.strokeStyle = '#ff5b6d99'; ctx.lineWidth = 1;
      (layers.collision || []).forEach((item) => this.strokeShape(ctx, item));
    }
  }
  drawSourceLayer(ctx, items, palette, defaultMaterial, drawCustom) {
    const groups = new Map();
    for (const item of items) {
      const isSourceTile = item.type === 'rect' && item.id?.startsWith('tile-');
      if (!isSourceTile) { drawCustom(item); continue; }
      const material = item.material || defaultMaterial || 'ground';
      if (!groups.has(material)) groups.set(material, []);
      groups.get(material).push(item);
    }
    for (const [material, sourceItems] of groups) this.drawSourceTileSurface(ctx, sourceItems, palette, material);
  }
  sourceTileCells(items, tileSize = 16) {
    const cells = new Map();
    for (const item of items) {
      const { width, height } = rectSize(item);
      const columns = Math.max(1, Math.round(width / tileSize));
      const rows = Math.max(1, Math.round(height / tileSize));
      for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < columns; column += 1) {
          const x = item.x + column * tileSize, y = item.y + row * tileSize;
          cells.set(`${x}:${y}`, { x, y });
        }
      }
    }
    return cells;
  }
  sourceTilePath(ctx, items) {
    ctx.beginPath();
    for (const item of items) { const { width, height } = rectSize(item); ctx.rect(item.x, item.y, width, height); }
  }
  sourceCellPath(ctx, cells, offsetX = 0, offsetY = 0, tileSize = 16) {
    ctx.beginPath();
    for (const { x, y } of cells) ctx.rect(x + offsetX, y + offsetY, tileSize, tileSize);
  }
  sourceTileComponents(cells, tileSize = 16) {
    const remaining = new Set(cells.keys());
    const components = [];
    for (const firstKey of remaining) {
      if (!remaining.delete(firstKey)) continue;
      const component = [];
      const queue = [firstKey];
      for (let cursor = 0; cursor < queue.length; cursor += 1) {
        const key = queue[cursor], cell = cells.get(key);
        if (!cell) continue;
        component.push(cell);
        for (const neighbour of [`${cell.x}:${cell.y - tileSize}`, `${cell.x + tileSize}:${cell.y}`, `${cell.x}:${cell.y + tileSize}`, `${cell.x - tileSize}:${cell.y}`]) {
          if (remaining.delete(neighbour)) queue.push(neighbour);
        }
      }
      components.push(component);
    }
    return components;
  }
  sourceCellBounds(cells, tileSize = 16) {
    const left = Math.min(...cells.map((cell) => cell.x));
    const top = Math.min(...cells.map((cell) => cell.y));
    const right = Math.max(...cells.map((cell) => cell.x + tileSize));
    const bottom = Math.max(...cells.map((cell) => cell.y + tileSize));
    return { left, top, right, bottom, width: right - left, height: bottom - top };
  }
  sourceRunLength(cells, x, y, dx, dy, tileSize = 16, limit = 12) {
    let length = 0;
    for (let step = 1; step <= limit; step += 1) {
      if (!cells.has(`${x + dx * tileSize * step}:${y + dy * tileSize * step}`)) break;
      length += 1;
    }
    return length;
  }
  strokeSourceTileBoundary(ctx, cells, colour, lineWidth = 1, alpha = 1, tileSize = 16) {
    ctx.save(); ctx.strokeStyle = colour; ctx.lineWidth = lineWidth; ctx.globalAlpha = alpha; ctx.beginPath();
    for (const { x, y } of cells.values()) {
      if (!cells.has(`${x}:${y - tileSize}`)) { ctx.moveTo(x, y); ctx.lineTo(x + tileSize, y); }
      if (!cells.has(`${x + tileSize}:${y}`)) { ctx.moveTo(x + tileSize, y); ctx.lineTo(x + tileSize, y + tileSize); }
      if (!cells.has(`${x}:${y + tileSize}`)) { ctx.moveTo(x + tileSize, y + tileSize); ctx.lineTo(x, y + tileSize); }
      if (!cells.has(`${x - tileSize}:${y}`)) { ctx.moveTo(x, y + tileSize); ctx.lineTo(x, y); }
    }
    ctx.stroke(); ctx.restore();
  }
  drawSourceTileSurface(ctx, items, palette, material) {
    if (!items.length) return;
    const cells = this.sourceTileCells(items);
    const fill = palette[material] || ({ road: '#253038', sidewalk: '#697069', park: '#2f7044', water: '#2a708e', rail: '#909792' }[material] || '#52645c');
    ctx.save();
    this.sourceTilePath(ctx, items);
    ctx.fillStyle = fill;
    if (material === 'sidewalk') ctx.globalAlpha = .97;
    ctx.fill();
    ctx.restore();

    if (material === 'road') this.drawSourceRoadDetails(ctx, items, cells, palette);
    else if (material === 'sidewalk') this.drawSourceSidewalkDetails(ctx, items, cells);
    else if (material === 'park') this.drawSourceParkDetails(ctx, items, cells);
    else if (material === 'water') this.drawSourceWaterDetails(ctx, items, cells);
    else if (material === 'rail') this.drawSourceRailDetails(ctx, items);

    const boundary = {
      road: [palette.roadEdge || '#d7d0b7', 2.4, .9],
      sidewalk: ['#eee7cc', 1.4, .62],
      park: ['#75a66d', 1.2, .42],
      water: ['#9adce6', 1.8, .72],
      rail: [palette.rail || '#a0a6a1', 1.8, .72],
    }[material];
    if (material === 'road') this.strokeSourceTileBoundary(ctx, cells, '#121a1bcc', 5, .72);
    if (boundary) this.strokeSourceTileBoundary(ctx, cells, boundary[0], boundary[1], boundary[2]);
  }
  drawSourceRoadDetails(ctx, items, cells, palette) {
    const marking = this.cityArt?.presentation?.roadMarking || '#f4df9b';
    ctx.save(); this.sourceTilePath(ctx, items); ctx.clip();
    ctx.strokeStyle = marking; ctx.globalAlpha = .76; ctx.lineWidth = 1.5; ctx.setLineDash([10, 10]);
    for (const { x, y } of cells.values()) {
      const left = this.sourceRunLength(cells, x, y, -1, 0), right = this.sourceRunLength(cells, x, y, 1, 0);
      const up = this.sourceRunLength(cells, x, y, 0, -1), down = this.sourceRunLength(cells, x, y, 0, 1);
      const horizontalLength = left + right + 1, horizontalThickness = up + down + 1;
      const verticalLength = up + down + 1, verticalThickness = left + right + 1;
      const horizontalCentre = up === down || down === up + 1;
      const verticalCentre = left === right || right === left + 1;
      const horizontal = horizontalLength >= 6 && horizontalThickness >= 2 && horizontalThickness <= 5 && horizontalCentre;
      const vertical = verticalLength >= 6 && verticalThickness >= 2 && verticalThickness <= 5 && verticalCentre;
      if (horizontal) {
        ctx.lineDashOffset = -(x % 20); ctx.beginPath(); ctx.moveTo(x, y + 8); ctx.lineTo(x + 16, y + 8); ctx.stroke();
      }
      if (vertical) {
        ctx.lineDashOffset = -(y % 20); ctx.beginPath(); ctx.moveTo(x + 8, y); ctx.lineTo(x + 8, y + 16); ctx.stroke();
      }
    }
    ctx.setLineDash([]);
    for (const { x, y } of cells.values()) {
      const seed = hashString(`road-furniture:${x}:${y}`);
      if (seed % 173 === 0) {
        ctx.fillStyle = '#151b1dcc'; ctx.beginPath(); ctx.arc(x + 8, y + 8, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#7f8b8c99'; ctx.lineWidth = .7; ctx.stroke();
      } else if (seed % 131 === 0) {
        ctx.strokeStyle = '#aebcb72e'; ctx.lineWidth = .8; ctx.beginPath();
        ctx.moveTo(x + 2, y + 11); ctx.lineTo(x + 7, y + 8); ctx.lineTo(x + 14, y + 10); ctx.stroke();
      } else if (seed % 17 === 0) {
        ctx.fillStyle = seed % 2 ? '#aab5b21c' : '#07101224'; ctx.fillRect(x + 3 + seed % 8, y + 5 + (seed >>> 4) % 6, 3, 1);
      }
    }
    ctx.restore();
  }
  drawSourceSidewalkDetails(ctx, items, cells) {
    const bounds = this.sourceCellBounds([...cells.values()]);
    ctx.save(); this.sourceTilePath(ctx, items); ctx.clip();
    ctx.strokeStyle = this.cityArt?.presentation?.sidewalkJoint || '#5f625b'; ctx.globalAlpha = .22; ctx.lineWidth = .7;
    for (let x = Math.ceil(bounds.left / 16) * 16; x <= bounds.right; x += 16) { ctx.beginPath(); ctx.moveTo(x, bounds.top); ctx.lineTo(x, bounds.bottom); ctx.stroke(); }
    for (let y = Math.ceil(bounds.top / 16) * 16; y <= bounds.bottom; y += 16) { ctx.beginPath(); ctx.moveTo(bounds.left, y); ctx.lineTo(bounds.right, y); ctx.stroke(); }
    for (const { x, y } of cells.values()) {
      const seed = hashString(`street-prop:${x}:${y}`);
      if (seed % 211 !== 0) continue;
      ctx.globalAlpha = .94; ctx.fillStyle = '#29302f'; ctx.fillRect(x + 7, y + 5, 2, 8);
      ctx.fillStyle = '#f5d778'; ctx.fillRect(x + 6, y + 3, 4, 3);
      ctx.fillStyle = '#10171599'; ctx.fillRect(x + 5, y + 13, 6, 2);
      ctx.globalAlpha = .18; ctx.fillStyle = '#ffe599'; ctx.beginPath(); ctx.arc(x + 8, y + 5, 7, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
  drawSourceParkDetails(ctx, items, cells) {
    ctx.save(); this.sourceTilePath(ctx, items); ctx.clip();
    for (const { x, y } of cells.values()) {
      const seed = hashString(`park-canopy:${x}:${y}`);
      if (seed % 41 === 0) {
        const cx = x + 5 + seed % 7, cy = y + 6 + (seed >>> 5) % 6;
        ctx.fillStyle = '#39291ccc'; ctx.fillRect(cx - 1, cy + 2, 2, 6);
        ctx.fillStyle = seed % 3 ? '#4f914b' : '#6ba14f'; ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#9ac06b66'; ctx.beginPath(); ctx.arc(cx - 2, cy - 2, 2.2, 0, Math.PI * 2); ctx.fill();
      } else if (seed % 9 === 0) {
        ctx.fillStyle = seed % 2 ? '#9bc16b2e' : '#14362238'; ctx.fillRect(x + 4 + seed % 7, y + 4 + (seed >>> 4) % 7, 2, 2);
      }
    }
    ctx.restore();
  }
  drawSourceWaterDetails(ctx, items, cells) {
    ctx.save(); this.sourceTilePath(ctx, items); ctx.clip(); ctx.strokeStyle = '#b9edf2'; ctx.globalAlpha = .34; ctx.lineWidth = 1;
    for (const { x, y } of cells.values()) {
      const seed = hashString(`water-line:${x}:${y}`);
      if (seed % 3) continue;
      const start = x + 2 + seed % 5; ctx.beginPath(); ctx.moveTo(start, y + 8); ctx.lineTo(Math.min(x + 15, start + 8), y + 8); ctx.stroke();
    }
    ctx.restore();
  }
  drawSourceRailDetails(ctx, items) {
    ctx.save(); this.sourceTilePath(ctx, items); ctx.clip();
    for (const item of items) {
      const { width, height } = rectSize(item), horizontal = width >= height;
      ctx.strokeStyle = '#d2d2c8'; ctx.globalAlpha = .72; ctx.lineWidth = 1.4;
      if (horizontal) {
        for (const y of [item.y + height * .34, item.y + height * .66]) { ctx.beginPath(); ctx.moveTo(item.x, y); ctx.lineTo(item.x + width, y); ctx.stroke(); }
        ctx.strokeStyle = '#272e2d'; for (let x = Math.ceil(item.x / 10) * 10; x < item.x + width; x += 10) { ctx.beginPath(); ctx.moveTo(x, item.y + 2); ctx.lineTo(x, item.y + height - 2); ctx.stroke(); }
      } else {
        for (const x of [item.x + width * .34, item.x + width * .66]) { ctx.beginPath(); ctx.moveTo(x, item.y); ctx.lineTo(x, item.y + height); ctx.stroke(); }
        ctx.strokeStyle = '#272e2d'; for (let y = Math.ceil(item.y / 10) * 10; y < item.y + height; y += 10) { ctx.beginPath(); ctx.moveTo(item.x + 2, y); ctx.lineTo(item.x + width - 2, y); ctx.stroke(); }
      }
    }
    ctx.restore();
  }
  tracePoints(ctx, points, close = true) {
    if (!Array.isArray(points) || points.length < 2) return false;
    ctx.beginPath();
    points.forEach((point, index) => {
      const x = Array.isArray(point) ? point[0] : point.x;
      const y = Array.isArray(point) ? point[1] : point.y;
      if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    if (close) ctx.closePath();
    return true;
  }
  strokeShape(ctx, item) {
    if (item.type === 'polygon' && this.tracePoints(ctx, item.points)) ctx.stroke();
    else ctx.strokeRect(item.x, item.y, item.w ?? item.width, item.h ?? item.height);
  }
  drawMapItem(ctx, item, palette) {
    if (item.material === 'road_marking') return item.type === 'authored_crosswalk'
      ? this.drawAuthoredCrosswalk(ctx, item)
      : this.drawAuthoredRoadMarking(ctx, item, palette);
    if (item.material === 'authored_tree') return this.drawAuthoredTree(ctx, item);
    if (item.material === 'street_lamp') return this.drawAuthoredStreetLamp(ctx, item);
    if (['park_path', 'parking', 'parking_bay', 'plaza_detail', 'station_platform'].includes(item.material)) {
      return this.drawAuthoredSurface(ctx, item, palette);
    }
    if (item.material === 'road') return this.drawRoad(ctx, item, palette);
    if (item.material === 'sidewalk') return this.drawSidewalk(ctx, item, palette);
    if (item.material === 'park') return this.drawPark(ctx, item, palette);
    if (item.material === 'water') return this.drawWater(ctx, item, palette);
    if (item.material === 'rail') return this.drawRail(ctx, item, palette);
    if (item.type === 'rect') { ctx.fillStyle = palette[item.material] || '#6d7c72'; ctx.fillRect(item.x, item.y, item.w, item.h); }
    if (item.type === 'polygon' && this.tracePoints(ctx, item.points)) {
      ctx.fillStyle = palette[item.material] || '#6d7c72'; ctx.fill();
      if (item.material === 'water') { ctx.strokeStyle = '#65a9bd88'; ctx.lineWidth = 1; ctx.stroke(); }
    }
    if (item.type === 'polyline' && this.tracePoints(ctx, item.points, false)) {
      ctx.strokeStyle = palette[item.material] || '#8e928d';
      ctx.lineWidth = Number(item.lineWidth) || 3;
      ctx.stroke();
    }
    if (item.type === 'circle') {
      if (item.material === 'tree' && this.assets.tree) { const size = item.r * 2.25; ctx.drawImage(this.assets.tree, item.x - size / 2, item.y - size / 2, size, size); }
      else { ctx.fillStyle = item.material === 'tree' ? '#174d2d' : '#72877c'; ctx.beginPath(); ctx.arc(item.x, item.y, item.r, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#5ba16e'; ctx.stroke(); }
    }
    if (item.type === 'crosswalk') {
      ctx.fillStyle = '#d9d8c88e'; for (let i = 0; i < 7; i++) { ctx.fillRect(item.x + 8 + i * 25, item.y + 72, 13, 40); ctx.fillRect(item.x + 72, item.y + 8 + i * 25, 40, 13); }
    }
  }
  authoredRect(item) {
    return item.sourceRect || item;
  }
  drawAuthoredSurface(ctx, item, palette) {
    const rect = this.authoredRect(item), { width, height } = rectSize(rect);
    if (item.material === 'parking') {
      ctx.fillStyle = palette.parking || '#34383a'; ctx.fillRect(rect.x, rect.y, width, height);
      ctx.fillStyle = '#11171928';
      for (let y = Math.ceil(rect.y / 24) * 24; y < rect.y + height; y += 24) {
        const offset = hashString(`${item.sourceId}:${y}`) % 28;
        for (let x = rect.x + offset; x < rect.x + width; x += 54) ctx.fillRect(x, y, 9, 2);
      }
      return;
    }
    if (item.material === 'parking_bay') {
      ctx.save(); ctx.strokeStyle = palette.parking_bay || '#e7dfbd'; ctx.globalAlpha = .72; ctx.lineWidth = 2;
      ctx.strokeRect(rect.x + 1, rect.y + 1, Math.max(0, width - 2), Math.max(0, height - 2));
      const horizontal = width >= height;
      ctx.beginPath();
      if (horizontal) { ctx.moveTo(rect.x + width / 2, rect.y); ctx.lineTo(rect.x + width / 2, rect.y + height); }
      else { ctx.moveTo(rect.x, rect.y + height / 2); ctx.lineTo(rect.x + width, rect.y + height / 2); }
      ctx.stroke(); ctx.restore(); return;
    }
    if (item.material === 'park_path') {
      ctx.fillStyle = palette.park_path || '#b6a980'; ctx.fillRect(rect.x, rect.y, width, height);
      ctx.strokeStyle = '#f0e4bd55'; ctx.lineWidth = 1;
      if (width >= height) {
        ctx.beginPath(); ctx.moveTo(rect.x, rect.y + 3); ctx.lineTo(rect.x + width, rect.y + 3); ctx.stroke();
      } else {
        ctx.beginPath(); ctx.moveTo(rect.x + 3, rect.y); ctx.lineTo(rect.x + 3, rect.y + height); ctx.stroke();
      }
      return;
    }
    if (item.material === 'station_platform') {
      ctx.fillStyle = palette.station_platform || '#807c71'; ctx.fillRect(rect.x, rect.y, width, height);
      ctx.fillStyle = '#e9d96d';
      if (width >= height) ctx.fillRect(rect.x, rect.y + height - 5, width, 3);
      else ctx.fillRect(rect.x + width - 5, rect.y, 3, height);
      ctx.fillStyle = '#1d2323aa';
      for (let x = Math.ceil(rect.x / 72) * 72; x < rect.x + width; x += 72) ctx.fillRect(x, rect.y + 7, 36, Math.max(2, height - 14));
      return;
    }
    ctx.fillStyle = palette.plaza_detail || '#b9ad91'; ctx.globalAlpha = .82; ctx.fillRect(rect.x, rect.y, width, height); ctx.globalAlpha = 1;
    ctx.strokeStyle = '#f5ead033'; ctx.lineWidth = 1;
    for (let x = Math.ceil(rect.x / 24) * 24; x < rect.x + width; x += 24) { ctx.beginPath(); ctx.moveTo(x, rect.y); ctx.lineTo(x, rect.y + height); ctx.stroke(); }
    for (let y = Math.ceil(rect.y / 24) * 24; y < rect.y + height; y += 24) { ctx.beginPath(); ctx.moveTo(rect.x, y); ctx.lineTo(rect.x + width, y); ctx.stroke(); }
  }
  drawAuthoredTree(ctx, item) {
    const seed = hashString(item.id), radius = Number(item.r) || 12;
    ctx.save();
    ctx.fillStyle = '#07100d55'; ctx.beginPath(); ctx.ellipse(item.x + radius * .32, item.y + radius * .5, radius * 1.05, radius * .62, -.22, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#4a3322'; ctx.fillRect(item.x - 2, item.y + radius * .1, 4, radius * .9);
    ctx.fillStyle = seed % 3 === 0 ? '#5e9147' : seed % 3 === 1 ? '#477b3f' : '#6f9a4d';
    ctx.beginPath(); ctx.arc(item.x, item.y, radius, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#9bc46a77'; ctx.beginPath(); ctx.arc(item.x - radius * .32, item.y - radius * .35, radius * .38, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#284d31aa'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(item.x, item.y, radius, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
  drawAuthoredStreetLamp(ctx, item) {
    ctx.save();
    const glow = ctx.createRadialGradient(item.x, item.y - 4, 1, item.x, item.y - 4, 13);
    glow.addColorStop(0, '#ffe9a277'); glow.addColorStop(1, '#ffe9a200');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(item.x, item.y - 4, 13, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#202726'; ctx.fillRect(item.x - 1.5, item.y - 2, 3, 12);
    ctx.fillStyle = '#f4d77b'; ctx.fillRect(item.x - 3, item.y - 6, 6, 5);
    ctx.strokeStyle = '#101615'; ctx.lineWidth = 1; ctx.strokeRect(item.x - 3, item.y - 6, 6, 5);
    ctx.fillStyle = '#111817aa'; ctx.fillRect(item.x - 5, item.y + 9, 10, 3);
    ctx.restore();
  }
  drawAuthoredPark(ctx, item, palette) {
    const rect = this.authoredRect(item), { width, height } = rectSize(rect);
    ctx.fillStyle = palette.park || '#3f7543'; ctx.fillRect(rect.x, rect.y, width, height);
    const gradient = ctx.createLinearGradient(rect.x, rect.y, rect.x + width, rect.y + height);
    gradient.addColorStop(0, '#7ba65a24'); gradient.addColorStop(1, '#163b2933');
    ctx.fillStyle = gradient; ctx.fillRect(rect.x, rect.y, width, height);
    ctx.fillStyle = '#b4d07b30';
    for (let y = Math.ceil(rect.y / 32) * 32; y < rect.y + height; y += 32) {
      for (let x = Math.ceil(rect.x / 32) * 32; x < rect.x + width; x += 32) if (hashString(`${item.sourceId}:${x}:${y}`) % 4 === 0) ctx.fillRect(x, y, 3, 3);
    }
  }
  drawAuthoredSidewalk(ctx, item, palette) {
    const rect = this.authoredRect(item), { width, height } = rectSize(rect);
    ctx.fillStyle = palette.sidewalk || '#aaa38f'; ctx.fillRect(rect.x, rect.y, width, height);
    ctx.strokeStyle = this.cityArt?.presentation?.sidewalkJoint || '#77756b'; ctx.globalAlpha = .24; ctx.lineWidth = .7;
    for (let x = Math.ceil(rect.x / 20) * 20; x < rect.x + width; x += 20) { ctx.beginPath(); ctx.moveTo(x, rect.y); ctx.lineTo(x, rect.y + height); ctx.stroke(); }
    for (let y = Math.ceil(rect.y / 20) * 20; y < rect.y + height; y += 20) { ctx.beginPath(); ctx.moveTo(rect.x, y); ctx.lineTo(rect.x + width, y); ctx.stroke(); }
    ctx.globalAlpha = 1;
  }
  drawAuthoredRoad(ctx, item, palette) {
    const rect = this.authoredRect(item), { width, height } = rectSize(rect), vertical = item.direction === 'vertical';
    ctx.fillStyle = palette.road || '#252a2c'; ctx.fillRect(rect.x, rect.y, width, height);
    ctx.strokeStyle = '#121718'; ctx.lineWidth = 5; ctx.beginPath();
    if (vertical) {
      ctx.moveTo(rect.x, rect.y); ctx.lineTo(rect.x, rect.y + height); ctx.moveTo(rect.x + width, rect.y); ctx.lineTo(rect.x + width, rect.y + height);
    } else {
      ctx.moveTo(rect.x, rect.y); ctx.lineTo(rect.x + width, rect.y); ctx.moveTo(rect.x, rect.y + height); ctx.lineTo(rect.x + width, rect.y + height);
    }
    ctx.stroke(); ctx.strokeStyle = palette.roadEdge || '#a39d87'; ctx.globalAlpha = .78; ctx.lineWidth = 1.5; ctx.stroke(); ctx.globalAlpha = 1;
    ctx.fillStyle = '#d6d0bd12';
    const seed = hashString(item.sourceId);
    for (let offset = 24 + seed % 13; offset < (vertical ? height : width); offset += 83 + seed % 29) {
      if (vertical) ctx.fillRect(rect.x + width * .25 + seed % 7, rect.y + offset, 2, 18);
      else ctx.fillRect(rect.x + offset, rect.y + height * .25 + seed % 7, 18, 2);
    }
  }
  drawAuthoredRoadMarking(ctx, item, palette) {
    const rect = this.authoredRect(item), { width, height } = rectSize(rect), vertical = item.direction === 'vertical';
    const major = ['arterial', 'boulevard', 'civic'].includes(item.roadClass);
    ctx.save(); ctx.strokeStyle = this.cityArt?.presentation?.roadMarking || '#f1df9d'; ctx.lineWidth = major ? 2.2 : 1.5; ctx.globalAlpha = .82; ctx.setLineDash(major ? [18, 12] : [12, 12]);
    const positions = major ? [-.2, .2] : [0];
    for (const ratio of positions) {
      ctx.beginPath();
      if (vertical) {
        const x = rect.x + width * (.5 + ratio); ctx.lineDashOffset = -(rect.y % 30); ctx.moveTo(x, rect.y); ctx.lineTo(x, rect.y + height);
      } else {
        const y = rect.y + height * (.5 + ratio); ctx.lineDashOffset = -(rect.x % 30); ctx.moveTo(rect.x, y); ctx.lineTo(rect.x + width, y);
      }
      ctx.stroke();
    }
    if (item.roadClass === 'civic') {
      ctx.setLineDash([]); ctx.strokeStyle = '#f4f1df'; ctx.globalAlpha = .66; ctx.lineWidth = 1.5; ctx.beginPath();
      if (vertical) { for (const x of [rect.x + 11, rect.x + width - 11]) { ctx.moveTo(x, rect.y); ctx.lineTo(x, rect.y + height); } }
      else { for (const y of [rect.y + 11, rect.y + height - 11]) { ctx.moveTo(rect.x, y); ctx.lineTo(rect.x + width, y); } }
      ctx.stroke();
    }
    ctx.restore();
  }
  drawAuthoredCrosswalk(ctx, item) {
    const rect = this.authoredRect(item), { width, height } = rectSize(rect), stripe = 7, gap = 6;
    ctx.save(); ctx.fillStyle = '#eee9d5'; ctx.globalAlpha = .78;
    for (let x = rect.x + 8; x < rect.x + width - 6; x += stripe + gap) {
      ctx.fillRect(x, rect.y + 6, stripe, 13); ctx.fillRect(x, rect.y + height - 19, stripe, 13);
    }
    for (let y = rect.y + 8; y < rect.y + height - 6; y += stripe + gap) {
      ctx.fillRect(rect.x + 6, y, 13, stripe); ctx.fillRect(rect.x + width - 19, y, 13, stripe);
    }
    ctx.restore();
  }
  drawPark(ctx, item, palette) {
    if (item.authored === true) return this.drawAuthoredPark(ctx, item, palette);
    if (item.type !== 'rect') return this.drawBasicShape(ctx, item, palette.park || '#39754c');
    const { width, height } = rectSize(item);
    ctx.fillStyle = palette.park || '#39754c'; ctx.fillRect(item.x, item.y, width, height);
    const area = width * height;
    if (area < 1024) return;
    const seed = hashString(item.id);
    ctx.fillStyle = '#79a85b35';
    const marks = Math.min(10, Math.max(1, Math.floor(area / 2400)));
    for (let index = 0; index < marks; index += 1) {
      const x = item.x + 5 + (hashString(`${seed}:x:${index}`) % Math.max(1, width - 10));
      const y = item.y + 5 + (hashString(`${seed}:y:${index}`) % Math.max(1, height - 10));
      ctx.fillRect(x, y, 2, 2);
    }
    if (area >= 4096 && this.assets.tree && seed % 4 === 0) {
      const count = Math.min(3, Math.max(1, Math.floor(area / 12000)));
      for (let index = 0; index < count; index += 1) {
        const x = item.x + 12 + (hashString(`${seed}:tree-x:${index}`) % Math.max(1, width - 24));
        const y = item.y + 13 + (hashString(`${seed}:tree-y:${index}`) % Math.max(1, height - 26));
        ctx.drawImage(this.assets.tree, x - 8, y - 10, 16, 20);
      }
    }
  }
  drawSidewalk(ctx, item, palette) {
    if (item.authored === true) return this.drawAuthoredSidewalk(ctx, item, palette);
    if (item.type !== 'rect') return this.drawBasicShape(ctx, item, palette.sidewalk || '#a8a79b');
    const { width, height } = rectSize(item);
    ctx.fillStyle = palette.sidewalk || '#a8a79b'; ctx.fillRect(item.x, item.y, width, height);
    const sourceTile = item.id?.startsWith('tile-sidewalks-');
    if (!sourceTile) {
      ctx.strokeStyle = '#dad8c844'; ctx.lineWidth = 1; ctx.strokeRect(item.x + .5, item.y + .5, Math.max(0, width - 1), Math.max(0, height - 1));
    }
    ctx.strokeStyle = '#777c7940';
    if (width >= 48 && height <= 48) {
      for (let x = Math.ceil(item.x / 16) * 16; x < item.x + width; x += 16) { ctx.beginPath(); ctx.moveTo(x, item.y); ctx.lineTo(x, item.y + height); ctx.stroke(); }
    } else if (height >= 48 && width <= 48) {
      for (let y = Math.ceil(item.y / 16) * 16; y < item.y + height; y += 16) { ctx.beginPath(); ctx.moveTo(item.x, y); ctx.lineTo(item.x + width, y); ctx.stroke(); }
    }
  }
  drawRoad(ctx, item, palette) {
    if (item.authored === true) return this.drawAuthoredRoad(ctx, item, palette);
    if (item.type !== 'rect') return this.drawBasicShape(ctx, item, palette.road || '#303942');
    const { width, height } = rectSize(item);
    ctx.fillStyle = palette.road || '#303942'; ctx.fillRect(item.x, item.y, width, height);
    const sourceTile = item.id?.startsWith('tile-roads-');
    if (!sourceTile) {
      ctx.strokeStyle = palette.roadEdge || '#66737b'; ctx.globalAlpha = .38; ctx.lineWidth = 1;
      ctx.strokeRect(item.x + .5, item.y + .5, Math.max(0, width - 1), Math.max(0, height - 1)); ctx.globalAlpha = 1;
    }
    const horizontal = width >= 96 && height >= 28 && height <= 80 && width > height * 2;
    const vertical = height >= 96 && width >= 28 && width <= 80 && height > width * 2;
    if (!horizontal && !vertical) return;
    ctx.save(); ctx.strokeStyle = '#eadca783'; ctx.lineWidth = 2; ctx.setLineDash([14, 14]);
    if (horizontal) {
      ctx.lineDashOffset = -(item.x % 28); ctx.beginPath(); ctx.moveTo(item.x, item.y + height / 2); ctx.lineTo(item.x + width, item.y + height / 2); ctx.stroke();
    } else {
      ctx.lineDashOffset = -(item.y % 28); ctx.beginPath(); ctx.moveTo(item.x + width / 2, item.y); ctx.lineTo(item.x + width / 2, item.y + height); ctx.stroke();
    }
    ctx.restore();
  }
  drawWater(ctx, item, palette) {
    if (item.type !== 'rect') return this.drawBasicShape(ctx, item, palette.water || '#3e7890', '#7bc6d4');
    const { width, height } = rectSize(item);
    ctx.fillStyle = palette.water || '#3e7890'; ctx.fillRect(item.x, item.y, width, height);
    ctx.strokeStyle = '#7fd0dc69'; ctx.lineWidth = 1;
    for (let y = Math.ceil((item.y + 4) / 12) * 12; y < item.y + height; y += 12) {
      const offset = hashString(`${item.id}:${y}`) % 14;
      for (let x = item.x + offset; x < item.x + width; x += 38) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(Math.min(item.x + width, x + 18), y); ctx.stroke(); }
    }
  }
  drawRail(ctx, item, palette) {
    if (item.type !== 'rect') return this.drawBasicShape(ctx, item, palette.rail || '#868b87');
    const { width, height } = rectSize(item);
    ctx.fillStyle = '#555c5a'; ctx.fillRect(item.x, item.y, width, height);
    const horizontal = width >= height;
    ctx.strokeStyle = palette.rail || '#a2aaa5'; ctx.lineWidth = 2;
    if (horizontal) {
      const a = item.y + height * .32, b = item.y + height * .68;
      [a, b].forEach((y) => { ctx.beginPath(); ctx.moveTo(item.x, y); ctx.lineTo(item.x + width, y); ctx.stroke(); });
      ctx.strokeStyle = '#2b312f'; ctx.lineWidth = 2;
      for (let x = Math.ceil(item.x / 12) * 12; x < item.x + width; x += 12) { ctx.beginPath(); ctx.moveTo(x, item.y + 2); ctx.lineTo(x, item.y + height - 2); ctx.stroke(); }
    } else {
      const a = item.x + width * .32, b = item.x + width * .68;
      [a, b].forEach((x) => { ctx.beginPath(); ctx.moveTo(x, item.y); ctx.lineTo(x, item.y + height); ctx.stroke(); });
      ctx.strokeStyle = '#2b312f'; ctx.lineWidth = 2;
      for (let y = Math.ceil(item.y / 12) * 12; y < item.y + height; y += 12) { ctx.beginPath(); ctx.moveTo(item.x + 2, y); ctx.lineTo(item.x + width - 2, y); ctx.stroke(); }
    }
  }
  drawBasicShape(ctx, item, fill, stroke = null) {
    if (item.type === 'polygon' && this.tracePoints(ctx, item.points)) { ctx.fillStyle = fill; ctx.fill(); if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); } return; }
    if (item.type === 'polyline' && this.tracePoints(ctx, item.points, false)) { ctx.strokeStyle = stroke || fill; ctx.lineWidth = Number(item.lineWidth) || 3; ctx.stroke(); return; }
    const { width, height } = rectSize(item); ctx.fillStyle = fill; ctx.fillRect(item.x, item.y, width, height);
  }
  buildingMassPath(ctx, items, offsetX = 0, offsetY = 0) {
    ctx.beginPath();
    for (const item of items) { const { width, height } = rectSize(item); ctx.rect(item.x + offsetX, item.y + offsetY, width, height); }
  }
  drawBuildingMass(ctx, items, palette) {
    if (!items.length) return;
    const cells = this.sourceTileCells(items);
    const components = this.sourceTileComponents(cells);
    const roofPalette = this.cityArt?.presentation?.roofPalette || [palette.buildingRoof || '#b86b59', '#9e594d', '#bd765f', '#7b7273', '#c18a63', '#80504b'];
    this.buildingMassPath(ctx, items, 6, 9); ctx.fillStyle = '#020504d1'; ctx.fill();
    for (const component of components) {
      const bounds = this.sourceCellBounds(component);
      const seed = hashString(`roof-component:${bounds.left}:${bounds.top}:${component.length}`);
      const colour = roofPalette[seed % roofPalette.length];
      const componentMap = new Map(component.map((cell) => [`${cell.x}:${cell.y}`, cell]));

      // A dark southern extrusion turns the coarse BGT roof mask into a readable
      // building volume without changing its collision or source footprint.
      this.sourceCellPath(ctx, component, 0, 4); ctx.fillStyle = '#21191acc'; ctx.fill();
      this.sourceCellPath(ctx, component); ctx.fillStyle = colour; ctx.fill();
      ctx.save(); this.sourceCellPath(ctx, component); ctx.clip();
      const roofLight = ctx.createLinearGradient(bounds.left, bounds.top, bounds.right, bounds.bottom);
      roofLight.addColorStop(0, '#fff2d52b'); roofLight.addColorStop(.45, '#ffffff00'); roofLight.addColorStop(1, '#170f142e');
      ctx.fillStyle = roofLight; ctx.fillRect(bounds.left, bounds.top, bounds.width, bounds.height);
      ctx.strokeStyle = '#fff1da13'; ctx.lineWidth = .7;
      const seamSpan = 32 + seed % 17;
      for (let x = bounds.left + seamSpan; x < bounds.right; x += seamSpan) { ctx.beginPath(); ctx.moveTo(x, bounds.top); ctx.lineTo(x, bounds.bottom); ctx.stroke(); }
      for (let y = bounds.top + seamSpan; y < bounds.bottom; y += seamSpan) { ctx.beginPath(); ctx.moveTo(bounds.left, y); ctx.lineTo(bounds.right, y); ctx.stroke(); }
      ctx.restore();

      this.strokeSourceTileBoundary(ctx, componentMap, '#160f13e6', 4.2, .82);
      this.strokeSourceTileBoundary(ctx, componentMap, '#ffe2c2', 1.15, .7);

      // Lit edge windows and service doors make long anonymous roof strips read
      // as streets of individual occupied buildings.
      for (const cell of component) {
        const windowSeed = hashString(`${seed}:facade:${cell.x}:${cell.y}`);
        if (!componentMap.has(`${cell.x}:${cell.y + 16}`)) {
          ctx.fillStyle = '#2b1e20'; ctx.fillRect(cell.x + 1, cell.y + 13, 14, 3);
          if (windowSeed % 3) { ctx.fillStyle = windowSeed % 5 ? '#ffd982c7' : '#8fe9ffc2'; ctx.fillRect(cell.x + 4, cell.y + 13, 5, 2); }
          if (windowSeed % 11 === 0) { ctx.fillStyle = '#171214'; ctx.fillRect(cell.x + 10, cell.y + 10, 4, 6); }
        }
        if (!componentMap.has(`${cell.x + 16}:${cell.y}`)) {
          ctx.fillStyle = '#1d1719b8'; ctx.fillRect(cell.x + 13, cell.y + 2, 3, 13);
          if (windowSeed % 4 === 0) { ctx.fillStyle = '#ffd98299'; ctx.fillRect(cell.x + 14, cell.y + 5, 2, 5); }
        }
      }

      if (component.length < 2) continue;
      ctx.save(); this.sourceCellPath(ctx, component); ctx.clip();
      ctx.strokeStyle = seed % 3 === 0 ? '#f5d1b5' : '#422c2c'; ctx.globalAlpha = .38; ctx.lineWidth = 1.1; ctx.beginPath();
      if (bounds.width >= bounds.height) { const ridgeY = Math.floor((bounds.top + bounds.bottom) / 2) + .5; ctx.moveTo(bounds.left + 3, ridgeY); ctx.lineTo(bounds.right - 3, ridgeY); }
      else { const ridgeX = Math.floor((bounds.left + bounds.right) / 2) + .5; ctx.moveTo(ridgeX, bounds.top + 3); ctx.lineTo(ridgeX, bounds.bottom - 3); }
      ctx.stroke();
      if (component.length >= 4 && seed % 3 !== 1) {
        const unitCell = component[(seed >>> 4) % component.length];
        ctx.globalAlpha = .92; ctx.fillStyle = '#293031'; ctx.fillRect(unitCell.x + 4, unitCell.y + 5, 8, 6);
        ctx.fillStyle = '#9fb1ad'; ctx.fillRect(unitCell.x + 5, unitCell.y + 6, 6, 1.5);
      }
      if (component.length >= 7 && seed % 5 === 0) {
        const glassCell = component[(seed >>> 9) % component.length];
        ctx.fillStyle = '#8fc2c4aa'; ctx.fillRect(glassCell.x + 4, glassCell.y + 4, 8, 5);
        ctx.strokeStyle = '#e4f4e9aa'; ctx.lineWidth = .7; ctx.strokeRect(glassCell.x + 4.5, glassCell.y + 4.5, 7, 4);
      }
      if (component.length >= 10 && seed % 4 === 0) {
        const panelCell = component[(seed >>> 12) % component.length];
        ctx.fillStyle = '#142b33cc'; ctx.fillRect(panelCell.x + 2, panelCell.y + 3, 12, 8);
        ctx.strokeStyle = '#72c9df99'; ctx.lineWidth = .7; ctx.strokeRect(panelCell.x + 2.5, panelCell.y + 3.5, 11, 7);
        ctx.beginPath(); ctx.moveTo(panelCell.x + 8, panelCell.y + 4); ctx.lineTo(panelCell.x + 8, panelCell.y + 10); ctx.stroke();
      }
      ctx.restore();
    }
  }
  drawAuthoredBuilding(ctx, item, palette) {
    const building = this.authoredRect(item), { width, height } = rectSize(building);
    if (width < 8 || height < 8) return;
    const sourceId = item.sourceId || item.id, seed = hashString(sourceId);
    const style = item.roofStyle || 'terrace';
    const roofPalette = this.cityArt?.presentation?.roofPalette || [palette.buildingRoof || '#bd6955'];
    const roof = roofPalette[(Number(item.roofTone) || seed) % roofPalette.length];
    const facade = style.includes('industrial') || ['warehouse', 'sawtooth'].includes(style) ? '#5e5650' : palette.building || '#765049';
    const inset = Math.max(6, Math.min(13, Math.floor(Math.min(width, height) * .08)));
    ctx.save();
    ctx.fillStyle = '#06100dc2'; ctx.fillRect(building.x + 9, building.y + 11, width, height);
    ctx.fillStyle = facade; ctx.fillRect(building.x, building.y, width, height);
    ctx.strokeStyle = '#201a1bd9'; ctx.lineWidth = 3; ctx.strokeRect(building.x + 1.5, building.y + 1.5, width - 3, height - 3);
    const facadeLight = ctx.createLinearGradient(building.x, building.y, building.x + width, building.y + height);
    facadeLight.addColorStop(0, '#fff3db22'); facadeLight.addColorStop(.48, '#ffffff00'); facadeLight.addColorStop(1, '#120c102d');
    ctx.fillStyle = facadeLight; ctx.fillRect(building.x + 3, building.y + 3, width - 6, height - 6);

    const roofX = building.x + inset, roofY = building.y + inset;
    const roofWidth = Math.max(2, width - inset * 2), roofHeight = Math.max(2, height - inset * 2);
    if (style === 'arena') {
      ctx.fillStyle = '#373d3d'; ctx.beginPath(); ctx.ellipse(building.x + width / 2, building.y + height / 2, roofWidth / 2, roofHeight / 2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = roof; ctx.lineWidth = 7; ctx.beginPath(); ctx.ellipse(building.x + width / 2, building.y + height / 2, Math.max(8, roofWidth / 2 - 6), Math.max(8, roofHeight / 2 - 6), 0, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#1b2523'; ctx.beginPath(); ctx.ellipse(building.x + width / 2, building.y + height / 2, roofWidth * .26, roofHeight * .22, 0, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = roof; ctx.fillRect(roofX, roofY, roofWidth, roofHeight);
      ctx.strokeStyle = '#f2c6a866'; ctx.lineWidth = 1.2; ctx.strokeRect(roofX + .5, roofY + .5, roofWidth - 1, roofHeight - 1);
    }

    if (style === 'sawtooth') {
      ctx.fillStyle = '#f3dbc452';
      const horizontal = roofWidth >= roofHeight;
      const span = horizontal ? roofWidth : roofHeight;
      for (let offset = 12; offset < span - 8; offset += 24) {
        ctx.beginPath();
        if (horizontal) {
          ctx.moveTo(roofX + offset - 8, roofY + roofHeight); ctx.lineTo(roofX + offset, roofY + 5); ctx.lineTo(roofX + offset + 8, roofY + roofHeight);
        } else {
          ctx.moveTo(roofX + roofWidth, roofY + offset - 8); ctx.lineTo(roofX + 5, roofY + offset); ctx.lineTo(roofX + roofWidth, roofY + offset + 8);
        }
        ctx.closePath(); ctx.fill();
      }
    } else if (['row-house', 'terrace', 'shop-row'].includes(style)) {
      const horizontal = roofWidth >= roofHeight;
      const divisions = Math.max(2, Math.min(8, Math.floor((horizontal ? roofWidth : roofHeight) / 58)));
      ctx.strokeStyle = '#3b29298c'; ctx.lineWidth = 2;
      for (let index = 1; index < divisions; index += 1) {
        ctx.beginPath();
        if (horizontal) {
          const x = roofX + roofWidth * index / divisions; ctx.moveTo(x, roofY); ctx.lineTo(x, roofY + roofHeight);
        } else {
          const y = roofY + roofHeight * index / divisions; ctx.moveTo(roofX, y); ctx.lineTo(roofX + roofWidth, y);
        }
        ctx.stroke();
      }
      ctx.strokeStyle = '#ffe0c35c'; ctx.lineWidth = 1.2; ctx.beginPath();
      if (horizontal) { ctx.moveTo(roofX + 4, roofY + roofHeight / 2); ctx.lineTo(roofX + roofWidth - 4, roofY + roofHeight / 2); }
      else { ctx.moveTo(roofX + roofWidth / 2, roofY + 4); ctx.lineTo(roofX + roofWidth / 2, roofY + roofHeight - 4); }
      ctx.stroke();
    } else if (['glass-office', 'campus', 'office', 'civic-slab'].includes(style)) {
      ctx.fillStyle = '#82b8bd66';
      for (let x = roofX + 10; x < roofX + roofWidth - 8; x += 22) ctx.fillRect(x, roofY + 8, 12, Math.max(8, roofHeight - 16));
      ctx.strokeStyle = '#dff5ec55'; ctx.lineWidth = 1;
      for (let y = roofY + 16; y < roofY + roofHeight - 8; y += 22) { ctx.beginPath(); ctx.moveTo(roofX + 5, y); ctx.lineTo(roofX + roofWidth - 5, y); ctx.stroke(); }
    } else if (style === 'station') {
      const bands = Math.max(3, Math.floor(roofHeight / 28));
      for (let index = 0; index < bands; index += 1) {
        ctx.fillStyle = index % 2 ? '#95c3c3aa' : '#263536aa';
        ctx.fillRect(roofX + 14, roofY + 8 + index * (roofHeight - 16) / bands, roofWidth - 28, Math.max(5, (roofHeight - 16) / bands - 5));
      }
    } else if (style === 'market-hall') {
      ctx.strokeStyle = '#f2d794aa'; ctx.lineWidth = 3;
      for (let x = roofX + 18; x < roofX + roofWidth; x += 36) { ctx.beginPath(); ctx.moveTo(x, roofY + 5); ctx.lineTo(x, roofY + roofHeight - 5); ctx.stroke(); }
    }

    if (style !== 'arena' && Math.min(roofWidth, roofHeight) > 38) {
      const unitCount = Math.min(4, Math.max(1, Math.floor(roofWidth * roofHeight / 18000)));
      for (let index = 0; index < unitCount; index += 1) {
        const unitWidth = 15 + hashString(`${sourceId}:unit-w:${index}`) % 18;
        const unitHeight = 10 + hashString(`${sourceId}:unit-h:${index}`) % 13;
        const x = roofX + 8 + hashString(`${sourceId}:unit-x:${index}`) % Math.max(1, Math.floor(roofWidth - unitWidth - 16));
        const y = roofY + 8 + hashString(`${sourceId}:unit-y:${index}`) % Math.max(1, Math.floor(roofHeight - unitHeight - 16));
        ctx.fillStyle = '#283130'; ctx.fillRect(x, y, unitWidth, unitHeight);
        ctx.fillStyle = '#9aaba6'; ctx.fillRect(x + 2, y + 2, unitWidth - 4, 2);
      }
    }

    ctx.fillStyle = '#f0d8c069';
    const windows = Math.max(1, Math.min(8, Math.floor(width / 42)));
    for (let index = 0; index < windows; index += 1) {
      const x = building.x + 14 + index * Math.max(22, (width - 28) / windows);
      if (x + 8 < building.x + width) ctx.fillRect(x, building.y + height - 7, 8, 4);
    }
    if (height >= 46 && width >= 54) {
      const frontageY = building.y + height - 15;
      ctx.fillStyle = '#20191bd9'; ctx.fillRect(building.x + 5, frontageY, width - 10, 12);
      const bays = Math.max(1, Math.min(7, Math.floor(width / 52)));
      for (let index = 0; index < bays; index += 1) {
        const bayX = building.x + 10 + index * (width - 20) / bays;
        const bayWidth = Math.max(12, (width - 20) / bays - 6);
        ctx.fillStyle = (seed + index) % 3 ? '#ffd987a8' : '#86e6ffc2'; ctx.fillRect(bayX, frontageY + 2, bayWidth, 5);
        ctx.fillStyle = '#100d0f'; ctx.fillRect(bayX + bayWidth * .42, frontageY + 7, Math.max(4, bayWidth * .18), 5);
      }
      ctx.fillStyle = roof; ctx.fillRect(building.x + 4, frontageY - 2, width - 8, 3);
    }
    ctx.restore();
  }
  drawBuilding(ctx, b, palette) {
    if (b.authored === true) return this.drawAuthoredBuilding(ctx, b, palette);
    if (b.type === 'walkable_building' || b.walkable === true) {
      const wall = 12;
      const entrance = b.entrance || { x: b.x + b.w / 2 - 24, w: 48 };
      const floorColour = palette[b.floorMaterial] || palette.baseFloor || '#34554d';
      const wallColour = palette[b.wallMaterial] || palette.baseWall || '#75c8ae';
      const accentColour = palette[b.accentMaterial] || '#9bf0d5';
      const isEmptyVenue = b.interiorKind === 'future_venue_shell';
      ctx.fillStyle = '#121a18aa'; ctx.fillRect(b.x + 7, b.y + 9, b.w, b.h);
      ctx.fillStyle = floorColour; ctx.fillRect(b.x, b.y, b.w, b.h);
      if (isEmptyVenue) {
        ctx.save();
        ctx.strokeStyle = `${accentColour}1f`; ctx.lineWidth = 1;
        for (let x = b.x + wall + 32; x < b.x + b.w - wall; x += 32) { ctx.beginPath(); ctx.moveTo(x, b.y + wall); ctx.lineTo(x, b.y + b.h - wall); ctx.stroke(); }
        for (let y = b.y + wall + 32; y < b.y + b.h - wall; y += 32) { ctx.beginPath(); ctx.moveTo(b.x + wall, y); ctx.lineTo(b.x + b.w - wall, y); ctx.stroke(); }
        ctx.strokeStyle = `${accentColour}38`; ctx.lineWidth = 2;
        ctx.strokeRect(b.x + wall + 20, b.y + wall + 58, Math.max(0, b.w - wall * 2 - 40), Math.max(0, b.h - wall * 2 - 78));
        ctx.restore();
      }
      ctx.fillStyle = wallColour;
      ctx.fillRect(b.x, b.y, wall, b.h); ctx.fillRect(b.x + b.w - wall, b.y, wall, b.h);
      if (entrance.side === 'south') {
        ctx.fillRect(b.x, b.y, b.w, wall);
        ctx.fillRect(b.x, b.y + b.h - wall, Math.max(0, entrance.x - b.x), wall);
        ctx.fillRect(entrance.x + entrance.w, b.y + b.h - wall, Math.max(0, b.x + b.w - entrance.x - entrance.w), wall);
        ctx.fillStyle = `${accentColour}55`; ctx.fillRect(entrance.x, b.y + b.h - wall - 3, entrance.w, wall + 6);
      } else {
        ctx.fillRect(b.x, b.y + b.h - wall, b.w, wall);
        ctx.fillRect(b.x, b.y, Math.max(0, entrance.x - b.x), wall);
        ctx.fillRect(entrance.x + entrance.w, b.y, Math.max(0, b.x + b.w - entrance.x - entrance.w), wall);
        ctx.fillStyle = `${accentColour}55`; ctx.fillRect(entrance.x, b.y - 3, entrance.w, wall + 6);
      }
      ctx.fillStyle = '#eafff8'; ctx.font = '900 10px system-ui'; ctx.textAlign = 'center'; ctx.fillText(b.name || b.id, b.x + b.w / 2, b.y + 31);
      ctx.fillStyle = isEmptyVenue ? accentColour : '#aee9d7'; ctx.font = '700 7px system-ui';
      ctx.fillText(b.subtitle || 'BASE REGEN · 10 HP/S', b.x + b.w / 2, b.y + 44);
      return;
    }
    if (b.type === 'polygon' && this.tracePoints(ctx, b.points)) {
      ctx.fillStyle = '#121a18aa'; ctx.save(); ctx.translate(3, 4); ctx.fill(); ctx.restore();
      this.tracePoints(ctx, b.points); ctx.fillStyle = palette.building; ctx.fill();
      this.tracePoints(ctx, b.points); ctx.strokeStyle = palette.buildingRoof || '#9f7880'; ctx.lineWidth = 2; ctx.stroke();
      return;
    }
    ctx.fillStyle = '#121a18aa'; ctx.fillRect(b.x + 7, b.y + 9, b.w, b.h);
    ctx.fillStyle = palette.building; ctx.fillRect(b.x, b.y, b.w, b.h); ctx.fillStyle = palette.buildingRoof; ctx.fillRect(b.x + 7, b.y + 7, b.w - 14, b.h - 14);
    ctx.fillStyle = '#281e22'; ctx.fillRect(b.x + b.w / 2 - 18, b.y + b.h - 13, 36, 13);
    ctx.fillStyle = '#fff9'; ctx.font = '700 9px system-ui'; ctx.textAlign = 'center'; ctx.fillText(b.name || b.id, b.x + b.w / 2, b.y + 21);
  }
  drawCityArt(ctx, cityArt = this.cityArt) {
    if (!cityArt) return;
    for (const building of cityArt.buildingOverlays || []) this.drawBuildingOverlay(ctx, building);
    for (const detail of cityArt.streetDetails || []) this.drawStreetDetail(ctx, detail);
    for (const landmark of cityArt.landmarks || []) this.drawLandmarkMotif(ctx, landmark);
    const landmarkDistricts = new Set((cityArt.landmarks || []).map((landmark) => landmark.districtId).filter(Boolean));
    for (const district of cityArt.districts || []) this.drawDistrictSeal(ctx, district, !landmarkDistricts.has(district.id));
    for (const prop of cityArt.propOverlays || []) this.drawPropOverlay(ctx, prop);
    for (const character of cityArt.staticCharacters || []) this.drawStaticCharacter(ctx, character);
  }
  drawBuildingOverlay(ctx, building) {
    const sprite = this.assets[building.asset];
    if (!sprite) return;
    const x = Number(building.x) || 0, y = Number(building.y) || 0;
    const width = Number(building.width) || 220, height = Number(building.height) || 220;
    ctx.save();
    ctx.globalAlpha = Math.max(.1, Math.min(1, Number(building.opacity) || 1));
    const footprint = building.footprint;
    if (footprint) {
      ctx.fillStyle = '#020504b5'; ctx.fillRect(footprint.x + 8, footprint.y + 10, footprint.w, footprint.h);
      ctx.fillStyle = '#443b35'; ctx.fillRect(footprint.x - 3, footprint.y - 3, footprint.w + 6, footprint.h + 6);
      ctx.strokeStyle = `${building.accent || '#ffcf70'}66`; ctx.lineWidth = 2; ctx.strokeRect(footprint.x - 2, footprint.y - 2, footprint.w + 4, footprint.h + 4);
    }
    if (building.approach) {
      const approach = building.approach;
      const accent = building.accent || '#ffcf70';
      ctx.fillStyle = `${accent}14`; ctx.beginPath(); ctx.arc(approach.x, approach.y, 34, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `${accent}32`; ctx.beginPath(); ctx.arc(approach.x, approach.y, 17, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#d8d0b69c'; ctx.fillRect(approach.x - 16, approach.y - 9, 32, 18);
      ctx.strokeStyle = building.accent || '#ffcf70'; ctx.lineWidth = 2; ctx.strokeRect(approach.x - 15, approach.y - 8, 30, 16);
    }
    ctx.drawImage(sprite, x - width / 2, y - height, width, height);
    ctx.strokeStyle = `${building.accent || '#ffcf70'}88`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x - width * .34, y - 4); ctx.lineTo(x + width * .34, y - 4); ctx.stroke();
    if (building.label) {
      const label = String(building.label).toUpperCase();
      const labelWidth = Math.max(92, label.length * 6 + 20);
      ctx.globalAlpha = .94; ctx.fillStyle = '#06100de6'; ctx.fillRect(x - labelWidth / 2, y + 5, labelWidth, 20);
      ctx.strokeStyle = building.accent || '#ffcf70'; ctx.lineWidth = 1; ctx.strokeRect(x - labelWidth / 2 + .5, y + 5.5, labelWidth - 1, 19);
      ctx.fillStyle = building.accent || '#ffcf70'; ctx.font = '900 8px system-ui'; ctx.textAlign = 'center'; ctx.fillText(label, x, y + 18);
    }
    ctx.restore();
  }
  drawStaticCharacter(ctx, character) {
    const sprite = this.assets[character.asset];
    if (!sprite) return;
    const x = Number(character.x) || 0, y = Number(character.y) || 0;
    const size = Number(character.size) || 42;
    const accent = character.accent || '#59e0b8';
    ctx.save();
    ctx.fillStyle = `${accent}33`; ctx.beginPath(); ctx.ellipse(x, y + 5, size * .29, size * .14, 0, 0, Math.PI * 2); ctx.fill();
    ctx.drawImage(sprite, x - size / 2, y - size * .58, size, size);
    ctx.strokeStyle = accent; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y + 2, size * .31, 0, Math.PI * 2); ctx.stroke();
    const label = String(character.label || character.id || 'SHOPKEEPER').toUpperCase();
    const labelWidth = Math.max(92, label.length * 5.4 + 18);
    ctx.fillStyle = '#06100de6'; ctx.fillRect(x - labelWidth / 2, y - size * .68 - 14, labelWidth, character.subtitle ? 24 : 15);
    ctx.fillStyle = accent; ctx.font = '900 7px system-ui'; ctx.textAlign = 'center'; ctx.fillText(label, x, y - size * .68 - 4);
    if (character.subtitle) { ctx.fillStyle = '#dceae5aa'; ctx.font = '700 5px system-ui'; ctx.fillText(String(character.subtitle).toUpperCase(), x, y - size * .68 + 4); }
    ctx.restore();
  }
  drawPropOverlay(ctx, prop) {
    const sprite = this.assets[prop.asset];
    if (!sprite) return;
    const x = Number(prop.x) || 0, y = Number(prop.y) || 0;
    const width = Math.max(4, Number(prop.width) || 28), height = Math.max(4, Number(prop.height) || 28);
    const status = String(prop.interaction || 'visual-only');
    const accent = prop.accent || '#ffcd70';
    ctx.save();
    ctx.globalAlpha = Math.max(.1, Math.min(1, Number(prop.opacity) || 1));
    ctx.fillStyle = '#06100d66'; ctx.beginPath(); ctx.ellipse(x, y + 2, width * .33, Math.max(3, height * .09), 0, 0, Math.PI * 2); ctx.fill();
    ctx.drawImage(sprite, x - width / 2, y - height, width, height);
    if (status === 'reserved' && prop.label) {
      const label = `${String(prop.label).toUpperCase()} · RESERVED`;
      const labelWidth = Math.max(74, label.length * 4.7 + 12);
      ctx.globalAlpha = .9; ctx.fillStyle = '#06100de6'; ctx.fillRect(x - labelWidth / 2, y + 5, labelWidth, 14);
      ctx.strokeStyle = accent; ctx.lineWidth = 1; ctx.strokeRect(x - labelWidth / 2 + .5, y + 5.5, labelWidth - 1, 13);
      ctx.fillStyle = accent; ctx.font = '900 6px system-ui'; ctx.textAlign = 'center'; ctx.fillText(label, x, y + 15);
    }
    ctx.restore();
  }
  drawStreetDetail(ctx, detail) {
    const x = Number(detail.x) || 0, y = Number(detail.y) || 0;
    const width = Number(detail.width) || 84, height = Number(detail.height) || 30;
    const accent = detail.accent || '#eee8d4';
    ctx.save(); ctx.translate(x, y); ctx.rotate(Number(detail.rotation) || 0); ctx.globalAlpha = .7;
    if (detail.type === 'crosswalk') {
      const stripes = Math.max(5, Math.floor(width / 12));
      ctx.fillStyle = accent;
      for (let index = 0; index < stripes; index += 1) { const stripeWidth = width / stripes * .52; ctx.fillRect(-width / 2 + index * width / stripes, -height / 2, stripeWidth, height); }
    } else if (detail.type === 'wayfinder') {
      ctx.strokeStyle = accent; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-width / 2, 0); ctx.lineTo(width / 3, 0); ctx.stroke();
      ctx.fillStyle = accent; ctx.beginPath(); ctx.moveTo(width / 2, 0); ctx.lineTo(width / 4, -height / 2); ctx.lineTo(width / 4, height / 2); ctx.closePath(); ctx.fill();
      if (detail.label) { ctx.fillStyle = '#06100dd9'; ctx.fillRect(-width / 2, height / 2 + 5, width, 16); ctx.fillStyle = accent; ctx.font = '900 7px system-ui'; ctx.textAlign = 'center'; ctx.fillText(String(detail.label).toUpperCase(), 0, height / 2 + 16); }
    }
    ctx.restore();
  }
  drawDistrictSeal(ctx, district, showLabel = true) {
    const accent = district.accent || '#8fe6c8';
    const radius = Number(district.radius) || 34;
    const y = district.y + (Number(district.labelOffsetY) || 0);
    ctx.save(); ctx.globalAlpha = .82;
    ctx.fillStyle = `${accent}13`; ctx.beginPath(); ctx.arc(district.x, district.y, radius, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = `${accent}66`; ctx.lineWidth = 2; ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.arc(district.x, district.y, radius - 5, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    if (!showLabel) { ctx.restore(); return; }
    const label = String(district.label || district.id || 'DISTRICT').toUpperCase();
    const width = Math.max(76, label.length * 6 + 18);
    ctx.fillStyle = '#081410d9'; ctx.fillRect(district.x - width / 2, y + radius + 7, width, district.subtitle ? 27 : 18);
    ctx.strokeStyle = `${accent}8c`; ctx.lineWidth = 1; ctx.strokeRect(district.x - width / 2 + .5, y + radius + 7.5, width - 1, district.subtitle ? 26 : 17);
    ctx.fillStyle = accent; ctx.font = '900 8px system-ui'; ctx.textAlign = 'center'; ctx.fillText(label, district.x, y + radius + 19);
    if (district.subtitle) { ctx.fillStyle = '#d8e8e2aa'; ctx.font = '700 5px system-ui'; ctx.fillText(String(district.subtitle).toUpperCase(), district.x, y + radius + 27); }
    ctx.restore();
  }
  drawLandmarkMotif(ctx, landmark) {
    const x = Number(landmark.x) || 0, y = Number(landmark.y) || 0;
    const width = Number(landmark.w) || 180, height = Number(landmark.h) || 100;
    const accent = landmark.accent || '#ffcd70';
    const clock = this.presentationClock(), phase = clock / 420 + hashString(landmark.id) % 9;
    ctx.save(); ctx.globalAlpha = .92;
    ctx.fillStyle = '#0205048f'; ctx.beginPath(); ctx.ellipse(x + 8, y + height * .24, width * .46, height * .34, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = `${accent}0c`; ctx.beginPath(); ctx.ellipse(x, y, width * .62, height * .76, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = `${accent}22`; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x, y, width * .55, height * .66, 0, 0, Math.PI * 2); ctx.stroke();
    if (landmark.type === 'station') {
      ctx.fillStyle = '#182521cc'; ctx.fillRect(x - width / 2, y - height / 2, width, height);
      ctx.fillStyle = '#8fb4ae66'; for (let row = -1; row <= 1; row += 1) ctx.fillRect(x - width / 2 + 12, y + row * 22 - 4, width - 24, 8);
      ctx.strokeStyle = accent; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - width / 2 + 18, y - height / 2 + 12); ctx.lineTo(x + width / 2 - 18, y - height / 2 + 12); ctx.stroke();
      const trainX = x - width * .4 + ((clock / 18) % Math.max(1, width * .8));
      ctx.fillStyle = '#e9fffa'; ctx.fillRect(trainX - 10, y - 5, 20, 10); ctx.fillStyle = accent; ctx.fillRect(trainX - 7, y - 2, 4, 4); ctx.fillRect(trainX + 3, y - 2, 4, 4);
    } else if (landmark.type === 'harbour') {
      ctx.fillStyle = '#bb986b66'; ctx.fillRect(x - width / 2, y - height / 2, width, 24);
      ctx.strokeStyle = '#edcf9f77'; ctx.lineWidth = 2;
      for (let px = x - width / 2 + 8; px < x + width / 2; px += 16) { ctx.beginPath(); ctx.moveTo(px, y - height / 2); ctx.lineTo(px, y - height / 2 + 24); ctx.stroke(); }
      for (const offset of [-width * .28, 0, width * .28]) { ctx.fillStyle = '#59472f'; ctx.fillRect(x + offset - 3, y - height / 2 + 20, 6, height * .62); }
      ctx.strokeStyle = '#a9efff99'; ctx.lineWidth = 2;
      for (let wave = 0; wave < 4; wave += 1) { const waveY = y + 8 + wave * 11; ctx.beginPath(); ctx.moveTo(x - width * .42 + Math.sin(phase + wave) * 8, waveY); ctx.lineTo(x + width * .42, waveY); ctx.stroke(); }
    } else if (landmark.type === 'arena') {
      ctx.fillStyle = `${accent}1e`; ctx.beginPath(); ctx.ellipse(x, y, width / 2, height / 2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = accent; ctx.lineWidth = 4; for (const inset of [0, 12]) { ctx.beginPath(); ctx.ellipse(x, y, width / 2 - inset, height / 2 - inset, 0, 0, Math.PI * 2); ctx.stroke(); }
      ctx.fillStyle = '#19231f99'; ctx.fillRect(x - width * .24, y - 8, width * .48, 16);
      ctx.strokeStyle = '#fff4'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, 23, phase, phase + Math.PI * 1.2); ctx.stroke();
    } else if (landmark.type === 'park') {
      ctx.fillStyle = `${accent}18`; ctx.beginPath(); ctx.arc(x, y, Math.min(width, height) / 2, 0, Math.PI * 2); ctx.fill();
      for (let index = 0; index < 9; index += 1) {
        const angle = index * 2.399, distance = 18 + (index % 3) * 15;
        const treeX = x + Math.cos(angle) * distance, treeY = y + Math.sin(angle) * distance;
        if (this.assets.tree) ctx.drawImage(this.assets.tree, treeX - 8, treeY - 9, 16, 18);
        else { ctx.fillStyle = '#174d2d'; ctx.beginPath(); ctx.arc(treeX, treeY, 6, 0, Math.PI * 2); ctx.fill(); }
      }
    } else if (landmark.type === 'market') {
      const stalls = Math.max(3, Math.floor(width / 42));
      for (let index = 0; index < stalls; index += 1) {
        const stallX = x - width / 2 + index * width / stalls;
        ctx.fillStyle = index % 2 ? `${accent}99` : '#f2e3bc99'; ctx.fillRect(stallX + 4, y - height / 2, width / stalls - 8, 16);
        ctx.fillStyle = '#342c2a99'; ctx.fillRect(stallX + 7, y - height / 2 + 16, width / stalls - 14, height - 22);
        ctx.fillStyle = '#fff1a8'; ctx.globalAlpha = .62 + Math.sin(phase + index) * .24; ctx.beginPath(); ctx.arc(stallX + width / stalls / 2, y - height / 2 + 19, 2.4, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = .92;
      }
    } else if (landmark.type === 'plaza') {
      ctx.fillStyle = '#c7bfa452'; ctx.fillRect(x - width / 2, y - height / 2, width, height);
      ctx.strokeStyle = '#eee4c744'; ctx.lineWidth = 1;
      for (let px = x - width / 2; px <= x + width / 2; px += 20) { ctx.beginPath(); ctx.moveTo(px, y - height / 2); ctx.lineTo(px, y + height / 2); ctx.stroke(); }
      for (let py = y - height / 2; py <= y + height / 2; py += 20) { ctx.beginPath(); ctx.moveTo(x - width / 2, py); ctx.lineTo(x + width / 2, py); ctx.stroke(); }
      ctx.strokeStyle = accent; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, 18 + Math.sin(phase) * 3, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#b9f4ffb8'; ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#e8ffffaa'; ctx.lineWidth = 1.5; for (let jet = 0; jet < 4; jet += 1) { const angle = phase + jet * Math.PI / 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(angle) * 15, y + Math.sin(angle) * 10); ctx.stroke(); }
    } else {
      ctx.fillStyle = `${accent}24`; ctx.fillRect(x - width / 2, y - height / 2, width, height);
      ctx.strokeStyle = `${accent}88`; ctx.strokeRect(x - width / 2, y - height / 2, width, height);
    }
    const label = String(landmark.label || landmark.id || '').toUpperCase();
    const labelWidth = Math.max(96, label.length * 6 + 22);
    ctx.globalAlpha = .92; ctx.fillStyle = '#06100ddd'; ctx.fillRect(x - labelWidth / 2, y + height / 2 + 7, labelWidth, landmark.subtitle ? 28 : 19);
    ctx.strokeStyle = `${accent}aa`; ctx.lineWidth = 1; ctx.strokeRect(x - labelWidth / 2 + .5, y + height / 2 + 7.5, labelWidth - 1, landmark.subtitle ? 27 : 18);
    ctx.fillStyle = accent; ctx.font = '900 9px system-ui'; ctx.textAlign = 'center'; ctx.fillText(label, x, y + height / 2 + 20);
    if (landmark.subtitle) { ctx.fillStyle = '#dbeae5aa'; ctx.font = '700 5px system-ui'; ctx.fillText(String(landmark.subtitle).toUpperCase(), x, y + height / 2 + 28); }
    ctx.restore();
  }
  drawMissionZones(ctx, zones) {
    const now = this.presentationClock() / 500;
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
    const pulse = 1 + Math.sin(this.presentationClock() / 260) * .08;
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
  drawSaveTerminal(ctx, saveComputer) {
    const terminal = saveComputer?.terminal;
    if (!saveComputer?.available || !terminal) return;
    const x = Number(terminal.x) || 0, y = Number(terminal.y) || 0;
    const width = Number(terminal.width) || 56, height = Number(terminal.height) || 42;
    const pulse = .72 + Math.sin(this.presentationClock() / 260) * .22;
    ctx.save();
    ctx.fillStyle = '#07110eb8'; ctx.fillRect(x - 3, y - 3, width + 6, height + 6);
    ctx.fillStyle = '#223c38'; ctx.fillRect(x, y, width, height);
    ctx.fillStyle = saveComputer.open ? '#d7fff2' : '#59e0b8'; ctx.globalAlpha = pulse;
    ctx.fillRect(x + 7, y + 6, width - 14, Math.max(11, height - 20));
    ctx.globalAlpha = 1; ctx.strokeStyle = saveComputer.open ? '#ffffff' : '#59e0b8'; ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, width - 2, height - 2);
    ctx.fillStyle = '#07110e'; ctx.fillRect(x + width / 2 - 10, y + height - 10, 20, 4);
    ctx.fillStyle = '#d9fff2'; ctx.font = '900 7px system-ui'; ctx.textAlign = 'center';
    ctx.fillText(saveComputer.open ? 'GROUP SAVE · OPEN' : 'GROUP SAVE · ACTION', x + width / 2, y - 8);
    ctx.restore();
  }
  drawCityAtmosphere(ctx, map, cityLife, cityArt = this.cityArt) {
    if (!map?.world || !cityLife?.clock) return;
    const hour = Number(cityLife.clock.hour) || 0;
    const night = hour >= 20 || hour < 6;
    const evening = hour >= 17 && hour < 20;
    const morning = hour >= 6 && hour < 9;
    const tint = night ? '#071529' : evening ? '#c85d37' : morning ? '#ffd37b' : null;
    if (!tint) return;
    ctx.save();
    ctx.globalAlpha = night ? .24 : evening ? .1 : .055;
    ctx.fillStyle = tint; ctx.fillRect(0, 0, map.world.width, map.world.height);
    ctx.globalAlpha = 1;
    if (night || evening) {
      ctx.globalCompositeOperation = 'screen';
      const lights = [
        ...(cityArt?.landmarks || []).map((entry) => ({ ...entry, radius: Math.max(46, Math.min(110, Number(entry.w) || 80)) })),
        ...(cityLife.venues || []).map((entry) => ({ ...position(entry), accent: entry.accent, radius: 74 })),
        ...(cityArt?.buildingOverlays || []).map((entry) => ({ ...(entry.approach || entry), accent: entry.accent, radius: 54 })),
      ];
      for (const light of lights) {
        const radius = Number(light.radius) || 64;
        const accent = light.accent || '#ffd987';
        ctx.fillStyle = `${accent}0d`; ctx.beginPath(); ctx.arc(light.x, light.y, radius, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = `${accent}24`; ctx.beginPath(); ctx.arc(light.x, light.y, radius * .42, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
  }
  drawAdventureTrail(ctx, actor, target, accent) {
    const a = position(actor), b = position(target);
    const dx = b.x - a.x, dy = b.y - a.y, distance = Math.hypot(dx, dy);
    if (!actor?.alive || distance < 70 || distance > 1200) return;
    const nx = dx / distance, ny = dy / distance, px = -ny, py = nx;
    const motion = (this.presentationClock() / 18) % 74;
    ctx.save(); ctx.globalAlpha = .76; ctx.strokeStyle = `${accent}66`; ctx.lineWidth = 2; ctx.setLineDash([7, 12]); ctx.lineDashOffset = -motion;
    ctx.beginPath(); ctx.moveTo(a.x + nx * 28, a.y + ny * 28); ctx.lineTo(b.x - nx * 42, b.y - ny * 42); ctx.stroke(); ctx.setLineDash([]);
    for (let along = 86 + motion; along < distance - 44; along += 74) {
      const x = a.x + nx * along, y = a.y + ny * along;
      ctx.fillStyle = '#07110ecc'; ctx.beginPath(); ctx.moveTo(x + nx * 9, y + ny * 9); ctx.lineTo(x - nx * 6 + px * 5, y - ny * 6 + py * 5); ctx.lineTo(x - nx * 6 - px * 5, y - ny * 6 - py * 5); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = accent; ctx.lineWidth = 2; ctx.stroke();
    }
    ctx.restore();
  }
  drawVenueIcon(ctx, kind, accent, x = 0, y = 0) {
    ctx.save(); ctx.strokeStyle = accent; ctx.fillStyle = accent; ctx.lineWidth = 2;
    if (kind === 'armory') {
      ctx.beginPath(); ctx.moveTo(x - 10, y - 8); ctx.lineTo(x + 10, y + 8); ctx.moveTo(x + 10, y - 8); ctx.lineTo(x - 10, y + 8); ctx.stroke();
      ctx.fillRect(x - 12, y - 2, 5, 4); ctx.fillRect(x + 7, y - 2, 5, 4);
    } else if (kind === 'casino') {
      ctx.beginPath(); ctx.moveTo(x, y - 10); ctx.lineTo(x + 10, y); ctx.lineTo(x, y + 10); ctx.lineTo(x - 10, y); ctx.closePath(); ctx.stroke(); ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
    } else if (kind === 'garage' || kind === 'chop-shop') {
      ctx.strokeRect(x - 12, y - 6, 24, 12);
      ctx.beginPath(); ctx.arc(x - 7, y + 7, 4, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(x + 7, y + 7, 4, 0, Math.PI * 2); ctx.stroke();
      if (kind === 'chop-shop') { ctx.beginPath(); ctx.moveTo(x - 9, y - 11); ctx.lineTo(x + 9, y + 11); ctx.stroke(); }
    } else {
      ctx.strokeRect(x - 10, y - 11, 20, 22); for (let lineY = y - 6; lineY <= y + 6; lineY += 6) { ctx.beginPath(); ctx.moveTo(x - 6, lineY); ctx.lineTo(x + 6, lineY); ctx.stroke(); }
    }
    ctx.restore();
  }
  drawVenueFacade(ctx, venue, pulse) {
    const p = position(venue), accent = venue.accent || '#59e0b8', kind = String(venue.kind || 'venue');
    const width = kind === 'casino' ? 82 : 72, height = 48;
    ctx.save();
    ctx.fillStyle = '#020504ad'; ctx.fillRect(p.x - width / 2 + 7, p.y - height / 2 + 9, width, height);
    const facade = ctx.createLinearGradient(p.x - width / 2, p.y - height / 2, p.x + width / 2, p.y + height / 2);
    facade.addColorStop(0, '#253532'); facade.addColorStop(1, '#0a1412');
    ctx.fillStyle = facade; ctx.fillRect(p.x - width / 2, p.y - height / 2, width, height);
    ctx.strokeStyle = '#020504'; ctx.lineWidth = 4; ctx.strokeRect(p.x - width / 2, p.y - height / 2, width, height);
    ctx.fillStyle = accent; ctx.fillRect(p.x - width / 2 - 3, p.y - height / 2 - 5, width + 6, 8);
    ctx.fillStyle = `${accent}6e`; ctx.fillRect(p.x - width / 2 + 7, p.y - height / 2 + 9, width - 14, 14);
    ctx.strokeStyle = `${accent}c7`; ctx.lineWidth = 1;
    for (let x = p.x - width / 2 + 13; x < p.x + width / 2 - 7; x += 13) { ctx.beginPath(); ctx.moveTo(x, p.y - height / 2 + 10); ctx.lineTo(x, p.y - height / 2 + 22); ctx.stroke(); }
    ctx.fillStyle = '#07110e'; ctx.fillRect(p.x - 13, p.y + 1, 26, 23);
    ctx.fillStyle = `${accent}${Math.round((.55 + pulse * .3) * 255).toString(16).padStart(2, '0')}`; ctx.fillRect(p.x - 9, p.y + 5, 18, 19);
    this.drawVenueIcon(ctx, kind, accent, p.x, p.y - 3);
    ctx.fillStyle = `${accent}12`; ctx.beginPath(); ctx.arc(p.x, p.y + 24, 35, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = `${accent}2b`; ctx.beginPath(); ctx.arc(p.x, p.y + 24, 19, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = accent; ctx.globalAlpha = .7 + pulse * .3; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(p.x, p.y + 23, 22 + pulse * 5, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
    const label = String(venue.label || venue.id).toUpperCase(), labelWidth = Math.max(width + 16, label.length * 6 + 20);
    ctx.fillStyle = '#06100ef0'; ctx.fillRect(p.x - labelWidth / 2, p.y - height / 2 - 27, labelWidth, 18);
    ctx.strokeStyle = accent; ctx.lineWidth = 1; ctx.strokeRect(p.x - labelWidth / 2 + .5, p.y - height / 2 - 26.5, labelWidth - 1, 17);
    ctx.fillStyle = accent; ctx.font = '900 8px system-ui'; ctx.textAlign = 'center'; ctx.fillText(label, p.x, p.y - height / 2 - 15);
    ctx.fillStyle = '#effff9'; ctx.font = '900 6px system-ui'; ctx.fillText('ACTION TO ENTER', p.x, p.y + height / 2 + 14);
    ctx.restore();
    return true;
  }
  drawCityLife(ctx, cityLife, actors = []) {
    if (!cityLife?.enabled) return;
    const pulse = .72 + Math.sin(this.presentationClock() / 220) * .22;
    for (const actor of actors || []) {
      const contract = cityLife.contracts?.[actor.partyId];
      const target = contract?.status === 'active' ? contract.checkpoints?.[contract.stepIndex] : cityLife.activity?.available ? cityLife.activity : null;
      if (target) this.drawAdventureTrail(ctx, actor, target, contract?.partyId === 'party_b' ? '#e98aff' : contract ? '#75efff' : '#ffd27e');
    }
    for (const venue of cityLife.venues || []) {
      const p = position(venue);
      if (this.drawVenueFacade(ctx, venue, pulse)) continue;
      ctx.save();
      ctx.globalAlpha = .24 + pulse * .16;
      ctx.fillStyle = venue.accent || '#59e0b8';
      ctx.beginPath(); ctx.arc(p.x, p.y, 36, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = venue.accent || '#59e0b8'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(p.x, p.y, 28, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#07110e'; ctx.fillRect(p.x - 18, p.y - 13, 36, 26);
      ctx.fillStyle = venue.accent || '#59e0b8'; ctx.fillRect(p.x - 13, p.y - 8, 26, 16);
      ctx.fillStyle = '#effff9'; ctx.font = '900 8px system-ui'; ctx.textAlign = 'center';
      ctx.fillText(`${String(venue.kind || 'venue').toUpperCase()} · ACTION TO ENTER`, p.x, p.y - 42);
      ctx.font = '900 10px system-ui'; ctx.fillText(venue.label || venue.id, p.x, p.y - 55);
      ctx.restore();
    }
    const activity = cityLife.activity;
    if (activity?.available) {
      const p = position(activity);
      ctx.save(); ctx.globalAlpha = pulse; ctx.strokeStyle = '#ffd27e'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(p.x, p.y, 22 + pulse * 8, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#ffd27e'; ctx.beginPath(); ctx.arc(p.x, p.y, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff4cf'; ctx.font = '900 9px system-ui'; ctx.textAlign = 'center';
      ctx.fillText(`${activity.label} · OPTIONAL`, p.x, p.y - 34); ctx.restore();
    }
    for (const contract of Object.values(cityLife.contracts || {}).filter((entry) => entry?.status === 'active')) {
      const target = contract.checkpoints?.[contract.stepIndex];
      if (!target) continue;
      const p = position(target);
      const accent = contract.partyId === 'party_b' ? '#e98aff' : '#75efff';
      const clearing = contract.phase === 'clear';
      ctx.save();
      ctx.globalAlpha = .2 + pulse * .2;
      ctx.fillStyle = clearing ? '#ff766f' : accent;
      ctx.beginPath(); ctx.arc(p.x, p.y, 42, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = clearing ? '#ffb0a8' : accent; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(p.x, p.y, 29 + pulse * 7, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#07110e'; ctx.fillRect(p.x - 16, p.y - 10, 32, 20);
      ctx.fillStyle = clearing ? '#ff766f' : accent; ctx.fillRect(p.x - 11, p.y - 6, 22, 12);
      ctx.fillStyle = '#effff9'; ctx.font = '900 9px system-ui'; ctx.textAlign = 'center';
      ctx.fillText(`${contract.label} - ${contract.stepIndex + 1}/${contract.checkpoints.length}`, p.x, p.y - 48);
      ctx.font = '800 8px system-ui'; ctx.fillText(clearing ? 'CLEAR THE RIVALS' : target.label, p.x, p.y - 36);
      ctx.restore();
    }
    const roadblock = cityLife.roadblock;
    if (roadblock?.active) {
      ctx.save();
      for (const barrier of roadblock.barriers || []) {
        ctx.fillStyle = '#18110d'; ctx.fillRect(barrier.x - 3, barrier.y - 3, barrier.width + 6, barrier.height + 6);
        ctx.fillStyle = '#ffb24a'; ctx.fillRect(barrier.x, barrier.y, barrier.width, barrier.height);
        ctx.strokeStyle = '#fff0c9'; ctx.lineWidth = 4;
        for (let x = barrier.x + 6; x < barrier.x + barrier.width; x += 16) {
          ctx.beginPath(); ctx.moveTo(x, barrier.y + barrier.height); ctx.lineTo(x + 10, barrier.y); ctx.stroke();
        }
      }
      const p = position(roadblock);
      ctx.fillStyle = '#fff0c9'; ctx.font = '900 9px system-ui'; ctx.textAlign = 'center';
      ctx.fillText(roadblock.label || 'PARTY ROADBLOCK', p.x, p.y - 20);
      ctx.restore();
    }
  }
  drawVehicles(ctx, vehicles) {
    (vehicles || []).forEach((v) => {
      const p = position(v); ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(v.rotation || 0);
      ctx.fillStyle = '#07110e88'; ctx.beginPath(); ctx.ellipse(0, 2, 27, 13, 0, 0, Math.PI * 2); ctx.fill();
      const modernSprite = v.kind === 'district-runner' ? this.assets.sportRed : this.assets.sedanSilver;
      const legacySprite = v.style === 'amber' ? this.assets.vehicleAmber : this.assets.vehicleTeal;
      const sprite = modernSprite || legacySprite;
      if (v.destroyed) {
        ctx.fillStyle = '#392f2d'; ctx.fillRect(-20, -11, 40, 22);
        ctx.strokeStyle = '#ff765f'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-16,-8); ctx.lineTo(16,8); ctx.moveTo(16,-8); ctx.lineTo(-16,8); ctx.stroke();
      } else if (sprite) ctx.drawImage(sprite, -26, -13, 52, 26);
      else { ctx.fillStyle = v.style === 'amber' ? '#e6a83f' : '#2aa889'; ctx.fillRect(-20, -11, 40, 22); ctx.fillStyle = '#bce5e0'; ctx.fillRect(-8, -8, 14, 16); }
      if (!v.destroyed && (v.tuning?.revision || 0) > 0) {
        const [paint, accent] = tuningPaint(v.tuning.paintId);
        const kit = v.tuning.bodyKitId || 'stock';
        ctx.strokeStyle = paint; ctx.lineWidth = kit === 'wide' ? 5 : 3; ctx.strokeRect(-23, -11, 46, 22);
        ctx.fillStyle = paint; ctx.fillRect(-17, -3, 34, 6);
        ctx.fillStyle = accent; ctx.fillRect(-14, -1, 28, 2);
        if (kit === 'street' || kit === 'wide') { ctx.fillStyle = paint; ctx.fillRect(-27, -13, 5, 26); ctx.fillRect(22, -13, 5, 26); }
        if (kit === 'rally') { ctx.fillStyle = accent; ctx.fillRect(-18, -14, 5, 4); ctx.fillRect(13, -14, 5, 4); ctx.fillRect(-5, -13, 10, 26); }
      }
      if (!v.destroyed && v.vehicleClass === 'gang-car') {
        ctx.strokeStyle = '#59e0b8'; ctx.lineWidth = 3; ctx.strokeRect(-24, -12, 48, 24);
        ctx.fillStyle = '#59e0b8'; ctx.fillRect(-4, -13, 8, 26);
      } else if (!v.destroyed && v.vehicleClass === 'traffic') {
        ctx.fillStyle = v.style === 'red' ? '#ff5f62aa' : v.style === 'amber' ? '#ffb24aaa' : '#65cce0aa';
        ctx.fillRect(-13, -12, 26, 4);
      }
      if (!v.destroyed && v.ambientDriver) {
        ctx.fillStyle = '#d9fff2'; ctx.beginPath(); ctx.arc(2, 0, 4, 0, Math.PI * 2); ctx.fill();
      }
      const count = (v.passengerActorIds?.length || 0) + (v.driverActorId ? 1 : 0);
      if (count) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, -18, 8, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#07110e'; ctx.font = '800 9px system-ui'; ctx.textAlign = 'center'; ctx.fillText(String(count), 0, -15); }
      ctx.fillStyle = '#251d1c'; ctx.fillRect(-20, 15, 40, 4); ctx.fillStyle = v.health <= 15 ? '#ff765f' : '#8de36f'; ctx.fillRect(-20, 15, 40 * Math.max(0, v.health || 0) / Math.max(1, v.maxHealth || 50), 4);
      if (v.traffic?.active) { ctx.fillStyle = '#d9fff2'; ctx.font = '900 7px system-ui'; ctx.textAlign = 'center'; ctx.fillText('TRAFFIC · TAKE', 0, -22); }
      if (v.vehicleClass === 'gang-car') { ctx.fillStyle = '#9fffe2'; ctx.font = '900 7px system-ui'; ctx.textAlign = 'center'; ctx.fillText('ARMORED GANG CAR', 0, -22); }
      if ((v.tuning?.revision || 0) > 0) { ctx.fillStyle = tuningPaint(v.tuning.paintId)[1]; ctx.font = '900 7px system-ui'; ctx.textAlign = 'center'; ctx.fillText(`TUNED E${v.tuning.engineTier || 0} T${v.tuning.tireTier || 0} B${v.tuning.brakeTier || 0} - ${String(v.tuning.presetId || 'balanced').toUpperCase()}`, 0, -31); }
      ctx.restore();
    });
  }
  packageSprite(pkg) {
    const courier = [this.assets.packageBox, this.assets.packageDuffel, this.assets.packageBriefcase, this.assets.packageCrateWood, this.assets.packageCratePlastic].filter(Boolean);
    const supply = [this.assets.packageCrateWood, this.assets.packageCratePlastic, this.assets.packageBox].filter(Boolean);
    const variants = pkg?.kind === 'supply' ? supply : courier;
    return variants.length ? variants[hashString(pkg?.id) % variants.length] : this.assets.package;
  }
  drawPackages(ctx, mission) {
    (mission?.packages || []).filter((pkg) => !pkg.delivered && !pkg.carrierActorId).forEach((pkg) => {
      const p = position(pkg), sprite = this.packageSprite(pkg);
      ctx.save(); ctx.fillStyle = '#ffcd7040'; ctx.beginPath(); ctx.arc(p.x, p.y, 14, 0, Math.PI * 2); ctx.fill();
      if (sprite) ctx.drawImage(sprite, p.x - 13, p.y - 12, 26, 22);
      else { ctx.fillStyle = '#ffcd70'; ctx.fillRect(p.x - 7, p.y - 7, 14, 14); ctx.strokeStyle = '#6e4e18'; ctx.strokeRect(p.x - 7, p.y - 7, 14, 14); }
      ctx.restore();
    });
  }
  drawCombatDrops(ctx, drops) {
    const clock = this.presentationClock();
    (drops || []).forEach((drop, index) => {
      const p = position(drop), bob = Math.sin(clock / 170 + index) * 3, pulse = .5 + Math.sin(clock / 120 + index) * .5;
      ctx.save(); ctx.translate(p.x, p.y + bob); ctx.rotate(clock / 650 + index);
      ctx.globalAlpha = .16 + pulse * .12; ctx.fillStyle = drop.accent || '#ffda79';
      ctx.beginPath(); ctx.arc(0, 0, 19 + pulse * 5, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
      ctx.fillStyle = '#07110e'; ctx.strokeStyle = drop.accent || '#ffda79'; ctx.lineWidth = 3;
      if (drop.visualStyle === 'shield') { ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(10, -6); ctx.lineTo(8, 8); ctx.lineTo(0, 13); ctx.lineTo(-8, 8); ctx.lineTo(-10, -6); ctx.closePath(); ctx.fill(); ctx.stroke(); }
      else if (drop.visualStyle === 'tech') { ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(10, 0); ctx.lineTo(0, 12); ctx.lineTo(-10, 0); ctx.closePath(); ctx.fill(); ctx.stroke(); }
      else { ctx.fillRect(-9, -8, 18, 16); ctx.strokeRect(-9, -8, 18, 16); ctx.fillStyle = drop.accent || '#ffda79'; ctx.fillRect(-3, -11, 6, 22); }
      ctx.restore();
      ctx.fillStyle = drop.accent || '#ffda79'; ctx.font = '900 7px system-ui'; ctx.textAlign = 'center';
      ctx.fillText(`ACTION - ${drop.label || 'GEAR DROP'}`, p.x, p.y - 24 + bob);
    });
  }
  drawNpcs(ctx, npcs) {
    (npcs || []).forEach((npc) => {
      const p = position(npc);
      if (npc.alive === false) {
        ctx.fillStyle = npc.hostile ? '#7b384155' : '#d4c9a344'; ctx.beginPath(); ctx.ellipse(p.x, p.y + 4, 9, 4, 0, 0, Math.PI * 2); ctx.fill();
        return;
      }
      const identity = hashString(npc.id);
      const modernResident = npc.hostile ? null : this.assets[`resident${identity % 4 + 1}`];
      const legacySprite = identity % 2 ? this.assets.npc2 : this.assets.npc1;
      if (modernResident) ctx.drawImage(modernResident, p.x - 20, p.y - 23, 40, 40);
      else if (legacySprite) { const frame = this.frameFor(npc); ctx.drawImage(legacySprite, frame.sx, frame.sy, 16, 16, p.x - 11, p.y - 13, 22, 22); }
      else { ctx.fillStyle = npc.state === 'flee' ? '#ffd46b' : '#d4c9a3'; ctx.beginPath(); ctx.arc(p.x, p.y, 7, 0, Math.PI * 2); ctx.fill(); }
      if (!npc.hostile && npc.cityLifeResident && npc.dailySchedule) {
        const roleColour = npc.roleColour || '#d4c9a3';
        ctx.strokeStyle = roleColour; ctx.lineWidth = npc.state === 'working' ? 3 : 2;
        ctx.beginPath(); ctx.arc(p.x, p.y + 1, 12, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = '#07110edb'; ctx.fillRect(p.x - 24, p.y - 38, 48, 10);
        ctx.fillStyle = roleColour; ctx.font = '900 6px system-ui'; ctx.textAlign = 'center';
        ctx.fillText(`${npc.displayName || npc.id} - ${npc.roleLabel || 'CITIZEN'}`, p.x, p.y - 31);
        ctx.fillStyle = roleColour; ctx.fillRect(p.x + 10, p.y - 9, 16, 10);
        ctx.fillStyle = '#07110e'; ctx.font = '900 5px system-ui';
        ctx.fillText(npc.roleBadge || 'CIV', p.x + 18, p.y - 2);
        ctx.fillStyle = '#eafff8d9'; ctx.font = '800 5.5px system-ui';
        ctx.fillText(npc.routine?.action || 'CITY ROUTINE', p.x, p.y + 20);
      }
      if (npc.hostile) {
        const crew = npc.kind === 'crew';
        const colour = crew ? partyColour(npc.partyId) : npc.kind === 'cop' ? '#74a9ff' : npc.roleColour || '#ff765f';
        const rolePulse = .5 + Math.sin(this.presentationClock() / 120 + identity) * .5;
        ctx.strokeStyle = colour; ctx.lineWidth = npc.state === 'windup' ? 3 : 2; ctx.beginPath(); ctx.arc(p.x, p.y + 1, npc.role === 'blocker' ? 13 : 11, 0, Math.PI * 2); ctx.stroke();
        if (npc.role === 'rusher') { ctx.fillStyle = colour; ctx.beginPath(); ctx.moveTo(p.x, p.y - 15); ctx.lineTo(p.x + 6, p.y - 8); ctx.lineTo(p.x, p.y - 10); ctx.lineTo(p.x - 6, p.y - 8); ctx.closePath(); ctx.fill(); }
        else if (npc.role === 'skirmisher') { ctx.strokeStyle = colour; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, 16 + rolePulse * 3, -.6, .6); ctx.stroke(); ctx.beginPath(); ctx.arc(p.x, p.y, 16 + rolePulse * 3, Math.PI - .6, Math.PI + .6); ctx.stroke(); }
        else if (npc.role === 'blocker') { ctx.strokeStyle = colour; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(p.x, p.y + 1, 17, -1.15, 1.15); ctx.stroke(); }
        else if (npc.role === 'sapper') { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(this.presentationClock() / 400); ctx.strokeStyle = colour; ctx.lineWidth = 2; ctx.strokeRect(-10, -10, 20, 20); ctx.restore(); }
        ctx.fillStyle = '#241719'; ctx.fillRect(p.x - 12, p.y - 19, 24, 3); ctx.fillStyle = colour; ctx.fillRect(p.x - 12, p.y - 19, 24 * npc.health / Math.max(1, npc.maxHealth), 3);
        const factionLabel = crew ? `${npc.partyId === 'party_a' ? 'A' : 'B'} CREW` : npc.kind === 'cop' ? 'JUSTICE' : 'RIVAL';
        ctx.fillStyle = colour; ctx.font = '900 7px system-ui'; ctx.textAlign = 'center'; ctx.fillText(`${factionLabel} · ${(npc.roleLabel || npc.role).toUpperCase()}`, p.x, p.y - 23);
        if (npc.telegraph?.targetPosition) {
          const target = npc.telegraph.targetPosition;
          ctx.save(); ctx.strokeStyle = colour; ctx.globalAlpha = .45 + rolePulse * .35; ctx.lineWidth = npc.telegraph.kind === 'slam' ? 4 : 2; ctx.setLineDash(npc.telegraph.kind === 'charge' ? [10, 5] : [4, 4]);
          if (npc.telegraph.kind === 'slam') { ctx.beginPath(); ctx.arc(p.x, p.y, 30 + rolePulse * 8, 0, Math.PI * 2); ctx.stroke(); }
          else { ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(target.x, target.y); ctx.stroke(); ctx.beginPath(); ctx.arc(target.x, target.y, npc.telegraph.kind === 'slow-orb' ? 17 : 8, 0, Math.PI * 2); ctx.stroke(); }
          ctx.setLineDash([]); ctx.restore();
        }
        if (npc.state === 'windup') { ctx.fillStyle = '#ffe29b'; ctx.fillText('!', p.x + 12, p.y - 8); }
      } else {
        if (!npc.cityLifeResident || npc.health < npc.maxHealth) {
          ctx.fillStyle = '#ffffff99'; ctx.font = '6px system-ui'; ctx.textAlign = 'center'; ctx.fillText(`${npc.health}/${npc.maxHealth}`, p.x, p.y - 14);
        }
      }
    });
  }
  drawMissionObjective(ctx, mission) {
    if (!mission) return;
    ctx.save();
    if (mission.pickupZone && mission.status === 'active') {
      const zone = mission.pickupZone;
      const width = Number(zone.width ?? zone.w) || 0, height = Number(zone.height ?? zone.h) || 0;
      ctx.fillStyle = '#ffcd701d'; ctx.fillRect(zone.x, zone.y, width, height);
      ctx.strokeStyle = '#ffcd70'; ctx.lineWidth = 2; ctx.setLineDash([8, 6]); ctx.strokeRect(zone.x, zone.y, width, height); ctx.setLineDash([]);
      ctx.fillStyle = '#ffecbd'; ctx.font = '900 8px system-ui'; ctx.textAlign = 'center'; ctx.fillText('ACTIVE DISPATCH', zone.x + width / 2, zone.y - 8);
    }
    for (const zone of mission.deliveryZones || []) {
      const width = Number(zone.width ?? zone.w) || 0, height = Number(zone.height ?? zone.h) || 0;
      ctx.fillStyle = '#59e0b81c'; ctx.fillRect(zone.x, zone.y, width, height);
      ctx.strokeStyle = '#59e0b8'; ctx.lineWidth = 3; ctx.setLineDash([10, 5]); ctx.strokeRect(zone.x, zone.y, width, height); ctx.setLineDash([]);
      ctx.fillStyle = '#d9fff2'; ctx.font = '900 8px system-ui'; ctx.textAlign = 'center'; ctx.fillText(`DROP · ${String(zone.label || zone.id).toUpperCase()}`, zone.x + width / 2, zone.y - 8);
    }
    ctx.restore();
    if (!mission.relay) return;
    const p = position(mission.relay), ratio = mission.relay.health / Math.max(1, mission.relay.maxHealth);
    ctx.fillStyle = '#163f36'; ctx.fillRect(p.x - 13, p.y - 18, 26, 36); ctx.strokeStyle = '#59e0b8'; ctx.lineWidth = 3; ctx.strokeRect(p.x - 13, p.y - 18, 26, 36);
    ctx.fillStyle = '#07110e'; ctx.fillRect(p.x - 22, p.y - 29, 44, 5); ctx.fillStyle = ratio < .35 ? '#ff765f' : '#59e0b8'; ctx.fillRect(p.x - 22, p.y - 29, 44 * Math.max(0, ratio), 5);
    ctx.fillStyle = '#fff'; ctx.font = '900 8px system-ui'; ctx.textAlign = 'center'; ctx.fillText(`RELAY ${mission.relay.health}/${mission.relay.maxHealth}`, p.x, p.y - 34);
  }
  drawPlayers(ctx, actors) {
    (actors || []).forEach((actor) => {
      if (actor.alive === false) return;
      const p = position(actor), colour = partyColour(actor.partyId);
      ctx.save(); ctx.translate(p.x, p.y);
      if (actor.currentVehicleId) {
        const offsetX = (((actor.slot || 1) - 1) % 4 - 1.5) * 10;
        ctx.strokeStyle = actor.tether?.returnToParty ? '#ff7683' : colour; ctx.lineWidth = actor.tether?.returnToParty ? 3 : 2;
        ctx.beginPath(); ctx.arc(0, 0, 23, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = colour; ctx.beginPath(); ctx.arc(offsetX, -20, 6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#07110e'; ctx.font = '900 7px system-ui'; ctx.textAlign = 'center'; ctx.fillText(`${actor.slot ?? '?'}`, offsetX, -18);
        ctx.restore(); return;
      }
      ctx.fillStyle = colour; ctx.globalAlpha = .48; ctx.beginPath(); ctx.arc(0, 4, 14, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
      const identity = ((Math.max(1, Number(actor.slot) || 1) - 1) % 4) + 1;
      const modernSprite = this.assets[`modernPlayer${identity}`];
      const legacySprite = this.assets[`player${identity}`];
      if (legacySprite) { const frame = this.frameFor(actor); ctx.drawImage(legacySprite, frame.sx, frame.sy, 16, 16, -12, -15, 24, 24); }
      else if (modernSprite) ctx.drawImage(modernSprite, -21, -24, 42, 42);
      else { ctx.fillStyle = colour; ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill(); }
      const gear = actor.gearSummary || {}, body = gear.body, shoes = gear.shoes, weapon = gear.weapon || {};
      const facing = actor.facing || { x: 1, y: 0 }, angle = Math.atan2(facing.y || 0, facing.x || 1);
      const gearPulse = .5 + Math.sin(this.presentationClock() / 115 + identity) * .5;
      if (shoes && Math.hypot(actor.velocity?.x || 0, actor.velocity?.y || 0) > 2) {
        ctx.save(); ctx.rotate(angle); ctx.globalAlpha = .35 + gearPulse * .35; ctx.fillStyle = shoes.primary || '#6de8ff';
        ctx.beginPath(); ctx.moveTo(-11, -7); ctx.lineTo(-22 - gearPulse * 5, -4); ctx.lineTo(-11, -1); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-11, 2); ctx.lineTo(-22 - gearPulse * 5, 5); ctx.lineTo(-11, 8); ctx.closePath(); ctx.fill(); ctx.restore();
      }
      if (body) {
        ctx.strokeStyle = body.primary || '#59e0b8'; ctx.fillStyle = `${body.primary || '#59e0b8'}55`; ctx.lineWidth = body.visualStyle === 'plate' ? 4 : 2;
        if (body.visualStyle === 'plate') { ctx.fillRect(-10, -10, 20, 17); ctx.strokeRect(-10, -10, 20, 17); }
        else { ctx.beginPath(); ctx.arc(0, -1, 12 + gearPulse * 2, -.15, Math.PI + .15); ctx.fill(); ctx.stroke(); }
      }
      ctx.save(); ctx.rotate(angle); ctx.translate(9, 0); ctx.fillStyle = weapon.primary || colour; ctx.strokeStyle = weapon.accent || '#e8fff7'; ctx.lineWidth = 1.5;
      if (weapon.visualStyle === 'scatter') { ctx.fillRect(0, -5, 17, 10); ctx.strokeRect(0, -5, 17, 10); ctx.fillStyle = weapon.accent || '#fff0c7'; ctx.fillRect(14, -7, 5, 14); }
      else if (weapon.visualStyle === 'arc') { ctx.beginPath(); ctx.moveTo(0, -3); ctx.lineTo(20, -2); ctx.lineTo(24, 0); ctx.lineTo(20, 2); ctx.lineTo(0, 3); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = weapon.accent || '#f1edff'; ctx.fillRect(7, -1, 10 + gearPulse * 4, 2); }
      else { ctx.fillRect(0, -3, weapon.visualStyle === 'repeater' ? 17 : 12, 6); ctx.strokeRect(0, -3, weapon.visualStyle === 'repeater' ? 17 : 12, 6); if (weapon.visualStyle === 'repeater') { ctx.fillStyle = weapon.accent || '#e8fff7'; ctx.fillRect(5, -1, 9 + gearPulse * 2, 2); } }
      ctx.restore();
      ctx.strokeStyle = actor.tether?.returnToParty ? '#ff7683' : '#ecfff9'; ctx.lineWidth = actor.tether?.returnToParty ? 3 : 1.2;
      ctx.beginPath(); ctx.arc(0, 4, 14, 0, Math.PI * 2); ctx.stroke();
      if (actor.carryingPackageId) {
        const carriedSprite = this.packageSprite({ id: actor.carryingPackageId, kind: 'courier' });
        if (carriedSprite) ctx.drawImage(carriedSprite, -8, -27, 16, 14);
        else { ctx.fillStyle = '#ffcd70'; ctx.fillRect(-5, -19, 10, 9); }
      }
      ctx.restore();
      ctx.font = '800 8px system-ui'; ctx.textAlign = 'center';
      ctx.fillStyle = '#06100d'; ctx.beginPath(); ctx.arc(p.x + 11, p.y - 10, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = colour; ctx.fillText(`${actor.slot ?? '?'}`, p.x + 11, p.y - 7);
      ctx.fillStyle = '#fff'; ctx.fillText((actor.displayName || actor.seatId || actor.id).slice(0, 12), p.x, p.y - 22);
      if (actor.tether?.returnToParty) { ctx.fillStyle = '#ff8894'; ctx.font = '900 7px system-ui'; ctx.fillText(actor.tether?.movementBlocked ? 'MOVE BACK' : 'RETURN', p.x, p.y + 25); }
    });
  }
  drawProjectiles(ctx, projectiles) {
    (projectiles || []).forEach((shot, index) => {
      const p = position(shot), speed = Math.hypot(shot.velocity?.x || 0, shot.velocity?.y || 0) || 1;
      const direction = { x: (shot.velocity?.x || 0) / speed, y: (shot.velocity?.y || 0) / speed };
      const colour = shot.visualColor || (shot.hostile ? (shot.ownerFaction === 'district-justice' ? '#74a9ff' : '#ff765f') : partyColour(shot.partyId || shot.ownerPartyId));
      const pulse = .5 + Math.sin(this.presentationClock() / 70 + index) * .5;
      ctx.save(); ctx.strokeStyle = colour; ctx.globalAlpha = .35 + pulse * .3; ctx.lineWidth = shot.visualStyle === 'arc' ? 3 : 2;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - direction.x * (shot.visualStyle === 'arc' ? 20 : 11), p.y - direction.y * (shot.visualStyle === 'arc' ? 20 : 11)); ctx.stroke(); ctx.globalAlpha = 1;
      ctx.fillStyle = colour; ctx.shadowColor = colour; ctx.shadowBlur = shot.visualStyle === 'sapper-orb' ? 14 : 8;
      if (shot.visualStyle === 'sapper-orb') { ctx.translate(p.x, p.y); ctx.rotate(this.presentationClock() / 180); ctx.fillRect(-5, -5, 10, 10); ctx.strokeStyle = shot.visualAccent || '#efe8ff'; ctx.strokeRect(-8, -8, 16, 16); }
      else { ctx.beginPath(); ctx.arc(p.x, p.y, shot.radius || (shot.hostile ? 4 : 3), 0, Math.PI * 2); ctx.fill(); if (shot.visualStyle === 'scatter') { ctx.strokeStyle = shot.visualAccent || '#fff0c7'; ctx.stroke(); } }
      ctx.restore();
    });
  }
  drawTetherWarnings(ctx, actors) { (actors || []).filter((actor) => actor.alive !== false && ['soft','warning','hard'].includes(actor.tether?.level)).forEach((actor) => { const p = position(actor); const allies = (actors || []).filter((other) => other.alive !== false && other.id !== actor.id && other.partyId === actor.partyId); if (!allies.length) return; const centre = allies.reduce((sum, ally) => { const ap = position(ally); return { x: sum.x + ap.x / allies.length, y: sum.y + ap.y / allies.length }; }, { x: 0, y: 0 }); const angle = Math.atan2(centre.y - p.y, centre.x - p.x); const colour = actor.tether.level === 'soft' ? '#ffcd70' : '#ff7683'; ctx.save(); ctx.translate(p.x, p.y); ctx.strokeStyle = colour; ctx.lineWidth = actor.tether.level === 'hard' ? 3 : 2; ctx.beginPath(); ctx.arc(0, 0, actor.currentVehicleId ? 28 : 18, 0, Math.PI * 2); ctx.stroke(); ctx.rotate(angle); ctx.fillStyle = colour; ctx.beginPath(); ctx.moveTo(26, 0); ctx.lineTo(17, -5); ctx.lineTo(17, 5); ctx.closePath(); ctx.fill(); ctx.restore(); ctx.fillStyle = colour; ctx.font = '900 7px system-ui'; ctx.textAlign = 'center'; ctx.fillText(actor.tether.level === 'soft' ? 'STAY CLOSE' : actor.tether.movementBlocked ? 'MOVE BACK' : 'RETURN', p.x, p.y + (actor.currentVehicleId ? 35 : 29)); }); }
  drawEffects(ctx, effects) {
    (effects || []).forEach((effect, index) => {
      const p = position(effect), kind = effect.kind || effect.type, pulse = .5 + Math.sin(this.presentationClock() / 85 + index) * .5;
      const blocked = ['friendly-fire-blocked', 'shield-spark', 'grace-spark', 'blocker-shield'].includes(kind);
      const dryFire = kind === 'dry-fire', explosion = kind === 'vehicle-explosion';
      const territory = kind === 'zone-captured' || kind === 'reinforcement-arrival' || kind === 'combat-drill-complete';
      const slam = kind === 'blocker-slam', loot = kind === 'gear-collected', charge = kind === 'rusher-charge';
      ctx.save(); ctx.strokeStyle = effect.colour || (territory || loot ? partyColour(effect.partyId) : blocked ? '#76dfff' : dryFire ? '#ffcd70' : charge ? '#ff6f62' : '#ff7e72');
      ctx.lineWidth = explosion ? 5 : territory ? 4 : slam ? 4 : 2; ctx.globalAlpha = .55 + pulse * .4;
      ctx.beginPath(); ctx.arc(p.x, p.y, explosion ? 32 : territory ? 24 + pulse * 9 : slam ? 18 + pulse * 22 : blocked ? 12 : loot ? 10 + pulse * 12 : dryFire ? 5 : 7 + pulse * 4, 0, Math.PI * 2); ctx.stroke();
      if (kind === 'muzzle') { ctx.fillStyle = ctx.strokeStyle; ctx.beginPath(); for (let ray = 0; ray < 8; ray += 1) { const a = ray / 8 * Math.PI * 2; ctx.moveTo(p.x + Math.cos(a) * 3, p.y + Math.sin(a) * 3); ctx.lineTo(p.x + Math.cos(a) * (8 + pulse * 5), p.y + Math.sin(a) * (8 + pulse * 5)); } ctx.stroke(); }
      ctx.restore();
    });
  }
  frameFor(entity) { const f = entity.facing || entity.velocity || { x: 0, y: 1 }; const ax = Math.abs(f.x || 0), ay = Math.abs(f.y || 0); let col = 1; if (ax > ay) col = f.x >= 0 ? 3 : 0; else col = f.y < 0 ? 2 : 1; const moving = Math.hypot(entity.velocity?.x || 0, entity.velocity?.y || 0) > 2; const row = moving ? Math.floor(this.presentationClock() / 180) % 3 : 1; return { sx: col * 16, sy: row * 16 }; }
}
