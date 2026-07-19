const position = (e) => e?.position || { x: e?.x ?? 0, y: e?.y ?? 0 };
const partyColour = (party) => party === 'party_b' ? '#e98aff' : '#59e0b8';
const hashString = (value) => {
  let hash = 2166136261;
  for (const character of String(value || '')) { hash ^= character.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  return hash >>> 0;
};
const rectSize = (item) => ({ width: Number(item.w ?? item.width) || 0, height: Number(item.h ?? item.height) || 0 });

export class EntityRenderer {
  constructor() { this.assets = {}; this.cityArt = null; }
  setAssets(assets) { this.assets = assets || {}; }
  setCityArt(cityArt) { this.cityArt = cityArt || null; }
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
    const seed = hashString(chunk.id || `${chunk.column}:${chunk.row}`);
    for (let y = 16; y < height; y += 48) {
      for (let x = 16; x < width; x += 48) {
        const value = hashString(`${seed}:${originX + x}:${originY + y}`);
        ctx.fillStyle = value % 3 ? '#2a443b55' : '#172f2955';
        ctx.fillRect(x + (value % 11), y + ((value >>> 5) % 11), value % 5 === 0 ? 3 : 2, 2);
      }
    }
    ctx.strokeStyle = '#4d6b6022'; ctx.lineWidth = 1;
    for (let x = 64 - (originX % 64); x < width; x += 64) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke(); }
    for (let y = 64 - (originY % 64); y < height; y += 64) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }
  }
  drawLayerSet(ctx, layers, palette, debug = false) {
    (layers.ground || []).forEach((item) => this.drawPark(ctx, item, palette));
    (layers.details_below || []).forEach((item) => this.drawMapItem(ctx, item, palette));
    (layers.sidewalks || []).forEach((item) => this.drawSidewalk(ctx, item, palette));
    (layers.roads || []).forEach((item) => this.drawRoad(ctx, item, palette));
    const buildings = layers.buildings || [];
    const sourceMass = buildings.filter((item) => item.id?.startsWith('tile-buildings-'));
    if (sourceMass.length) this.drawBuildingMass(ctx, sourceMass, palette);
    buildings.filter((item) => !item.id?.startsWith('tile-buildings-')).forEach((item) => this.drawBuilding(ctx, item, palette));
    (layers.details_above || []).forEach((item) => item.material === 'rail' ? this.drawRail(ctx, item, palette) : this.drawMapItem(ctx, item, palette));
    if (debug) {
      ctx.strokeStyle = '#ff5b6d99'; ctx.lineWidth = 1;
      (layers.collision || []).forEach((item) => this.strokeShape(ctx, item));
    }
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
  drawPark(ctx, item, palette) {
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
    if (item.type !== 'rect') return this.drawBasicShape(ctx, item, palette.sidewalk || '#a8a79b');
    const { width, height } = rectSize(item);
    ctx.fillStyle = palette.sidewalk || '#a8a79b'; ctx.fillRect(item.x, item.y, width, height);
    ctx.strokeStyle = '#dad8c844'; ctx.lineWidth = 1; ctx.strokeRect(item.x + .5, item.y + .5, Math.max(0, width - 1), Math.max(0, height - 1));
    ctx.strokeStyle = '#777c7940';
    if (width >= 48 && height <= 48) {
      for (let x = Math.ceil(item.x / 16) * 16; x < item.x + width; x += 16) { ctx.beginPath(); ctx.moveTo(x, item.y); ctx.lineTo(x, item.y + height); ctx.stroke(); }
    } else if (height >= 48 && width <= 48) {
      for (let y = Math.ceil(item.y / 16) * 16; y < item.y + height; y += 16) { ctx.beginPath(); ctx.moveTo(item.x, y); ctx.lineTo(item.x + width, y); ctx.stroke(); }
    }
  }
  drawRoad(ctx, item, palette) {
    if (item.type !== 'rect') return this.drawBasicShape(ctx, item, palette.road || '#303942');
    const { width, height } = rectSize(item);
    ctx.fillStyle = palette.road || '#303942'; ctx.fillRect(item.x, item.y, width, height);
    ctx.strokeStyle = palette.roadEdge || '#66737b'; ctx.globalAlpha = .38; ctx.lineWidth = 1;
    ctx.strokeRect(item.x + .5, item.y + .5, Math.max(0, width - 1), Math.max(0, height - 1)); ctx.globalAlpha = 1;
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
    this.buildingMassPath(ctx, items, 5, 7); ctx.fillStyle = '#07110e88'; ctx.fill();
    this.buildingMassPath(ctx, items); ctx.fillStyle = palette.building || '#6e5960'; ctx.fill();
    const left = Math.min(...items.map((item) => item.x));
    const top = Math.min(...items.map((item) => item.y));
    const right = Math.max(...items.map((item) => item.x + rectSize(item).width));
    const bottom = Math.max(...items.map((item) => item.y + rectSize(item).height));
    ctx.save(); this.buildingMassPath(ctx, items); ctx.clip();
    ctx.fillStyle = `${palette.buildingRoof || '#9f7880'}66`; ctx.fillRect(left, top, right - left, bottom - top);
    const roofTints = ['#efb0a213', '#7f91ac13', '#e2c48212', '#5d465314'];
    for (let y = Math.floor(top / 32) * 32; y < bottom; y += 32) {
      for (let x = Math.floor(left / 32) * 32; x < right; x += 32) {
        ctx.fillStyle = roofTints[hashString(`${x}:${y}`) % roofTints.length]; ctx.fillRect(x + 1, y + 1, 30, 30);
      }
    }
    ctx.strokeStyle = '#e6b6ad26'; ctx.lineWidth = 1;
    for (let x = Math.ceil(left / 32) * 32; x < right; x += 32) { ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bottom); ctx.stroke(); }
    for (let y = Math.ceil(top / 32) * 32; y < bottom; y += 32) { ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(right, y); ctx.stroke(); }
    ctx.restore();
    for (const item of items) {
      const { width, height } = rectSize(item);
      if (width < 64 || height < 48 || hashString(item.id) % 5) continue;
      const unitX = item.x + 10 + (hashString(`${item.id}:unit-x`) % Math.max(1, width - 28));
      const unitY = item.y + 10 + (hashString(`${item.id}:unit-y`) % Math.max(1, height - 24));
      ctx.fillStyle = '#403b3e'; ctx.fillRect(unitX, unitY, 16, 10); ctx.fillStyle = '#b9c6bd66'; ctx.fillRect(unitX + 2, unitY + 2, 12, 2);
    }
  }
  drawBuilding(ctx, b, palette) {
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
    ctx.drawImage(sprite, x - width / 2, y - height, width, height);
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
    ctx.save(); ctx.globalAlpha = .72;
    if (landmark.type === 'station') {
      ctx.fillStyle = '#182521cc'; ctx.fillRect(x - width / 2, y - height / 2, width, height);
      ctx.fillStyle = '#8fb4ae66'; for (let row = -1; row <= 1; row += 1) ctx.fillRect(x - width / 2 + 12, y + row * 22 - 4, width - 24, 8);
      ctx.strokeStyle = accent; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - width / 2 + 18, y - height / 2 + 12); ctx.lineTo(x + width / 2 - 18, y - height / 2 + 12); ctx.stroke();
    } else if (landmark.type === 'harbour') {
      ctx.fillStyle = '#bb986b66'; ctx.fillRect(x - width / 2, y - height / 2, width, 24);
      ctx.strokeStyle = '#edcf9f77'; ctx.lineWidth = 2;
      for (let px = x - width / 2 + 8; px < x + width / 2; px += 16) { ctx.beginPath(); ctx.moveTo(px, y - height / 2); ctx.lineTo(px, y - height / 2 + 24); ctx.stroke(); }
      for (const offset of [-width * .28, 0, width * .28]) { ctx.fillStyle = '#59472f'; ctx.fillRect(x + offset - 3, y - height / 2 + 20, 6, height * .62); }
    } else if (landmark.type === 'arena') {
      ctx.fillStyle = `${accent}1e`; ctx.beginPath(); ctx.ellipse(x, y, width / 2, height / 2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = accent; ctx.lineWidth = 4; for (const inset of [0, 12]) { ctx.beginPath(); ctx.ellipse(x, y, width / 2 - inset, height / 2 - inset, 0, 0, Math.PI * 2); ctx.stroke(); }
      ctx.fillStyle = '#19231f99'; ctx.fillRect(x - width * .24, y - 8, width * .48, 16);
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
      }
    } else if (landmark.type === 'plaza') {
      ctx.fillStyle = '#c7bfa452'; ctx.fillRect(x - width / 2, y - height / 2, width, height);
      ctx.strokeStyle = '#eee4c744'; ctx.lineWidth = 1;
      for (let px = x - width / 2; px <= x + width / 2; px += 20) { ctx.beginPath(); ctx.moveTo(px, y - height / 2); ctx.lineTo(px, y + height / 2); ctx.stroke(); }
      for (let py = y - height / 2; py <= y + height / 2; py += 20) { ctx.beginPath(); ctx.moveTo(x - width / 2, py); ctx.lineTo(x + width / 2, py); ctx.stroke(); }
      ctx.strokeStyle = accent; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, 18, 0, Math.PI * 2); ctx.stroke();
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
  drawSaveTerminal(ctx, saveComputer) {
    const terminal = saveComputer?.terminal;
    if (!saveComputer?.available || !terminal) return;
    const x = Number(terminal.x) || 0, y = Number(terminal.y) || 0;
    const width = Number(terminal.width) || 56, height = Number(terminal.height) || 42;
    const pulse = .72 + Math.sin(performance.now() / 260) * .22;
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
      const count = (v.passengerActorIds?.length || 0) + (v.driverActorId ? 1 : 0);
      if (count) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, -18, 8, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#07110e'; ctx.font = '800 9px system-ui'; ctx.textAlign = 'center'; ctx.fillText(String(count), 0, -15); }
      ctx.fillStyle = '#251d1c'; ctx.fillRect(-20, 15, 40, 4); ctx.fillStyle = v.health <= 15 ? '#ff765f' : '#8de36f'; ctx.fillRect(-20, 15, 40 * Math.max(0, v.health || 0) / Math.max(1, v.maxHealth || 50), 4);
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
      if (modernSprite) ctx.drawImage(modernSprite, -21, -24, 42, 42);
      else if (legacySprite) { const frame = this.frameFor(actor); ctx.drawImage(legacySprite, frame.sx, frame.sy, 16, 16, -12, -15, 24, 24); }
      else { ctx.fillStyle = colour; ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill(); }
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
  drawProjectiles(ctx, projectiles) { (projectiles || []).forEach((shot) => { const p = position(shot); ctx.fillStyle = shot.hostile ? (shot.ownerFaction === 'district-justice' ? '#74a9ff' : '#ff765f') : partyColour(shot.partyId || shot.ownerPartyId); ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 8; ctx.beginPath(); ctx.arc(p.x, p.y, shot.hostile ? 4 : 3, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0; }); }
  drawTetherWarnings(ctx, actors) { (actors || []).filter((actor) => actor.alive !== false && ['soft','warning','hard'].includes(actor.tether?.level)).forEach((actor) => { const p = position(actor); const allies = (actors || []).filter((other) => other.alive !== false && other.id !== actor.id && other.partyId === actor.partyId); if (!allies.length) return; const centre = allies.reduce((sum, ally) => { const ap = position(ally); return { x: sum.x + ap.x / allies.length, y: sum.y + ap.y / allies.length }; }, { x: 0, y: 0 }); const angle = Math.atan2(centre.y - p.y, centre.x - p.x); const colour = actor.tether.level === 'soft' ? '#ffcd70' : '#ff7683'; ctx.save(); ctx.translate(p.x, p.y); ctx.strokeStyle = colour; ctx.lineWidth = actor.tether.level === 'hard' ? 3 : 2; ctx.beginPath(); ctx.arc(0, 0, actor.currentVehicleId ? 28 : 18, 0, Math.PI * 2); ctx.stroke(); ctx.rotate(angle); ctx.fillStyle = colour; ctx.beginPath(); ctx.moveTo(26, 0); ctx.lineTo(17, -5); ctx.lineTo(17, 5); ctx.closePath(); ctx.fill(); ctx.restore(); ctx.fillStyle = colour; ctx.font = '900 7px system-ui'; ctx.textAlign = 'center'; ctx.fillText(actor.tether.level === 'soft' ? 'STAY CLOSE' : actor.tether.movementBlocked ? 'MOVE BACK' : 'RETURN', p.x, p.y + (actor.currentVehicleId ? 35 : 29)); }); }
  drawEffects(ctx, effects) { (effects || []).forEach((effect) => { const p = position(effect); const kind = effect.kind || effect.type; const blocked = kind === 'friendly-fire-blocked' || kind === 'shield-spark' || kind === 'grace-spark'; const dryFire = kind === 'dry-fire'; const explosion = kind === 'vehicle-explosion'; const territory = kind === 'zone-captured' || kind === 'reinforcement-arrival'; ctx.strokeStyle = territory ? partyColour(effect.partyId) : blocked ? '#76dfff' : dryFire ? '#ffcd70' : '#ff7e72'; ctx.lineWidth = explosion ? 5 : territory ? 4 : 2; ctx.beginPath(); ctx.arc(p.x, p.y, explosion ? 32 : territory ? 24 : blocked ? 12 : dryFire ? 5 : 7, 0, Math.PI * 2); ctx.stroke(); }); }
  frameFor(entity) { const f = entity.facing || entity.velocity || { x: 0, y: 1 }; const ax = Math.abs(f.x || 0), ay = Math.abs(f.y || 0); let col = 1; if (ax > ay) col = f.x >= 0 ? 3 : 0; else col = f.y < 0 ? 2 : 1; const moving = Math.hypot(entity.velocity?.x || 0, entity.velocity?.y || 0) > 2; const row = moving ? Math.floor(performance.now() / 180) % 3 : 1; return { sx: col * 16, sy: row * 16 }; }
}
