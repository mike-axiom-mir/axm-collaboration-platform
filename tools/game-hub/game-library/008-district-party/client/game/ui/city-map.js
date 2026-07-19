const PARTY_COLOURS = Object.freeze({ party_a: '#59e0b8', party_b: '#e98aff' });
const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const partyColour = (partyId) => PARTY_COLOURS[partyId] || '#e8dca6';
const centreOf = (entry = {}) => ({
  x: Number(entry.x || 0) + Number(entry.w || entry.width || 0) / 2,
  y: Number(entry.y || 0) + Number(entry.h || entry.height || 0) / 2,
});

export function normalizeMapMode(mode) {
  if (mode === false || mode === 'hidden') return 'hidden';
  return mode === 'full' ? 'full' : 'minimap';
}

export function mapViewportLayout(viewport, map, requestedMode = 'minimap') {
  const mode = normalizeMapMode(requestedMode);
  const viewportWidth = Math.max(1, Number(viewport?.width) || 1);
  const viewportHeight = Math.max(1, Number(viewport?.height) || 1);
  const worldWidth = Math.max(1, Number(map?.world?.width) || 1);
  const worldHeight = Math.max(1, Number(map?.world?.height) || 1);
  const aspect = worldWidth / worldHeight;
  let width;
  let height;
  let x;
  let y;

  if (mode === 'full') {
    const sideMargin = clamp(viewportWidth * 0.045, 24, 84);
    const topMargin = clamp(viewportHeight * 0.07, 38, 74);
    const bottomMargin = clamp(viewportHeight * 0.1, 72, 108);
    const availableWidth = Math.max(1, viewportWidth - sideMargin * 2);
    const availableHeight = Math.max(1, viewportHeight - topMargin - bottomMargin);
    width = Math.min(availableWidth, availableHeight * aspect);
    height = width / aspect;
    x = (viewportWidth - width) / 2;
    y = topMargin + (availableHeight - height) / 2;
  } else {
    width = clamp(viewportWidth * 0.205, viewportWidth < 520 ? 138 : 184, 286);
    if (viewportHeight < 620) width = Math.min(width, 216);
    height = width / aspect;
    x = (viewportWidth - width) / 2;
    y = Math.max(8, viewportHeight - height - 62);
  }

  return {
    mode,
    x,
    y,
    width,
    height,
    scaleX: width / worldWidth,
    scaleY: height / worldHeight,
  };
}

export function collectCityMapMarkers(map, world = {}, partyId = 'party_a') {
  const markers = [];
  const layers = map?.layers || {};
  const visibleActors = (world.actors || []).filter((actor) => actor.alive !== false && (partyId === 'all' || actor.partyId === partyId));
  const visibleActorIds = new Set(visibleActors.map((actor) => actor.id));
  const routeMissionActive = world.mission?.status === 'active' && Boolean(world.mission?.layout);
  for (const zone of layers.base_zones || []) {
    markers.push({ id: zone.id, kind: 'base', label: zone.name || 'Party House', ...centreOf(zone) });
  }
  for (const zone of layers.interior_zones || []) {
    markers.push({ id: zone.id, kind: 'venue', label: zone.name || 'Open venue', ...centreOf(zone) });
  }
  for (const terminal of layers.save_terminals || []) {
    markers.push({ id: terminal.id, kind: 'save_terminal', label: terminal.name || 'Group Save', ...centreOf(terminal) });
  }
  for (const zone of layers.mission_zones || []) {
    if (!['pickup', 'delivery', 'mission_board'].includes(zone.kind)) continue;
    if (routeMissionActive && ['pickup', 'delivery'].includes(zone.kind)) continue;
    markers.push({ id: zone.id, kind: zone.kind, label: zone.name || zone.kind.replaceAll('_', ' '), ...centreOf(zone) });
  }
  if (routeMissionActive && world.mission.pickupZone) {
    markers.push({ id: world.mission.pickupZone.id, kind: 'pickup', label: world.mission.pickupZone.label || 'Active dispatch', ...centreOf(world.mission.pickupZone) });
  }
  if (routeMissionActive) {
    for (const zone of world.mission.deliveryZones || []) {
      markers.push({ id: zone.id, kind: 'delivery', label: zone.label || zone.id, ...centreOf(zone) });
    }
  }
  for (const zone of world.territory?.zones || []) {
    markers.push({
      id: zone.id,
      kind: 'territory',
      label: zone.name || zone.id,
      x: Number(zone.x) || 0,
      y: Number(zone.y) || 0,
      ownerPartyId: zone.ownerPartyId || null,
      contested: zone.contested === true,
    });
  }
  for (const vehicle of world.vehicles || []) {
    const occupantIds = [vehicle.driverActorId, ...(vehicle.passengerActorIds || [])].filter(Boolean);
    const occupiedOnlyByHiddenActors = partyId !== 'all' && occupantIds.length > 0 && !occupantIds.some((actorId) => visibleActorIds.has(actorId));
    const reservedForHiddenParty = partyId !== 'all' && vehicle.partyOwnerId && vehicle.partyOwnerId !== partyId;
    if (occupiedOnlyByHiddenActors || reservedForHiddenParty) continue;
    const position = vehicle.position || vehicle;
    markers.push({ id: vehicle.id, kind: 'vehicle', label: vehicle.id, x: Number(position.x) || 0, y: Number(position.y) || 0 });
  }
  for (const actor of visibleActors) {
    markers.push({
      id: actor.id,
      kind: 'actor',
      label: actor.displayName || `P${actor.slot || '?'}`,
      shortLabel: `P${actor.slot || '?'}`,
      slot: actor.slot,
      partyId: actor.partyId,
      x: Number(actor.position?.x) || 0,
      y: Number(actor.position?.y) || 0,
    });
  }
  return markers;
}

function project(layout, point) {
  return { x: layout.x + point.x * layout.scaleX, y: layout.y + point.y * layout.scaleY };
}

function drawNetwork(ctx, layout, map, cityArt, full) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(layout.x, layout.y, layout.width, layout.height);
  ctx.clip();
  ctx.strokeStyle = full ? '#bad8cc20' : '#bad8cc14';
  ctx.lineWidth = 1;
  for (let column = 1; column < Number(map.chunking?.columns || 0); column += 1) {
    const lineX = layout.x + column * Number(map.chunking?.chunkSize || 1024) * layout.scaleX;
    ctx.beginPath(); ctx.moveTo(lineX, layout.y); ctx.lineTo(lineX, layout.y + layout.height); ctx.stroke();
  }
  for (let row = 1; row < Number(map.chunking?.rows || 0); row += 1) {
    const lineY = layout.y + row * Number(map.chunking?.chunkSize || 1024) * layout.scaleY;
    ctx.beginPath(); ctx.moveTo(layout.x, lineY); ctx.lineTo(layout.x + layout.width, lineY); ctx.stroke();
  }
  for (const water of cityArt?.overview?.waterways || []) {
    ctx.strokeStyle = full ? '#62c9e2d6' : '#62bfd4aa';
    ctx.lineWidth = Math.max(full ? 3 : 2, Number(water.width) || 3);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.beginPath();
    (water.points || []).forEach((point, index) => {
      const p = project(layout, { x: point[0], y: point[1] });
      if (!index) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();
  }
  for (const route of cityArt?.overview?.arterials || []) {
    ctx.strokeStyle = route.kind === 'ring' ? (full ? '#f1de9cc7' : '#e2d59b7a') : (full ? '#d4ded9a0' : '#b8c3be68');
    ctx.lineWidth = route.kind === 'ring' ? (full ? 3.2 : 1.8) : (full ? 2.2 : 1.2);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.beginPath();
    (route.points || []).forEach((point, index) => {
      const p = project(layout, { x: point[0], y: point[1] });
      if (!index) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    });
    if (route.closed) ctx.closePath();
    ctx.stroke();
  }
  ctx.restore();
}

function drawDistrictsAndLandmarks(ctx, layout, cityArt, full) {
  for (const landmark of cityArt?.landmarks || []) {
    const point = project(layout, landmark);
    ctx.fillStyle = landmark.accent || '#ffcd70';
    ctx.globalAlpha = 0.9;
    const size = full ? 6 : 3.2;
    ctx.fillRect(point.x - size / 2, point.y - size / 2, size, size);
  }
  ctx.globalAlpha = 1;
  if (!full) return;
  ctx.textAlign = 'center';
  for (const district of cityArt?.districts || []) {
    const point = project(layout, district);
    const labelY = point.y + (Number(district.labelOffsetY) || -72) * layout.scaleY;
    ctx.fillStyle = '#06100dcc';
    const label = String(district.label || district.id || '').toUpperCase();
    ctx.font = '900 10px system-ui';
    const textWidth = ctx.measureText(label).width;
    ctx.fillRect(point.x - textWidth / 2 - 5, labelY - 12, textWidth + 10, 17);
    ctx.fillStyle = district.accent || '#d9fff2';
    ctx.fillText(label, point.x, labelY);
  }
}

function drawMarker(ctx, layout, marker, full) {
  const point = project(layout, marker);
  if (marker.kind === 'territory') {
    ctx.fillStyle = marker.ownerPartyId ? partyColour(marker.ownerPartyId) : '#e8dca6';
    ctx.globalAlpha = marker.contested ? 1 : 0.72;
    ctx.beginPath(); ctx.arc(point.x, point.y, marker.contested ? (full ? 7 : 4) : (full ? 5 : 3), 0, Math.PI * 2); ctx.fill();
    if (marker.contested) { ctx.strokeStyle = '#ff9b66'; ctx.lineWidth = 2; ctx.stroke(); }
    ctx.globalAlpha = 1;
    return;
  }
  if (marker.kind === 'actor') {
    ctx.fillStyle = partyColour(marker.partyId);
    ctx.beginPath(); ctx.arc(point.x, point.y, full ? 7 : 3.6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = full ? 2 : 1; ctx.stroke();
    if (full) {
      ctx.fillStyle = '#f7fffc'; ctx.font = '900 10px system-ui'; ctx.textAlign = 'left';
      ctx.fillText(marker.shortLabel, point.x + 10, point.y + 4);
    }
    return;
  }
  if (marker.kind === 'vehicle') {
    if (!full) return;
    ctx.fillStyle = '#a9bbc4';
    ctx.fillRect(point.x - 3, point.y - 2, 7, 4);
    return;
  }
  const size = full ? 8 : 4;
  if (marker.kind === 'base') {
    ctx.fillStyle = '#59e0b8';
    ctx.beginPath(); ctx.moveTo(point.x, point.y - size); ctx.lineTo(point.x + size, point.y); ctx.lineTo(point.x, point.y + size); ctx.lineTo(point.x - size, point.y); ctx.closePath(); ctx.fill();
  } else if (marker.kind === 'venue') {
    ctx.fillStyle = '#ffd27e'; ctx.fillRect(point.x - size / 2, point.y - size / 2, size, size);
    ctx.strokeStyle = '#fff2cb'; ctx.lineWidth = 1; ctx.strokeRect(point.x - size / 2, point.y - size / 2, size, size);
  } else if (marker.kind === 'save_terminal') {
    ctx.fillStyle = '#8fe9ff'; ctx.fillRect(point.x - size / 2, point.y - size / 2, size, size);
    ctx.strokeStyle = '#e2faff'; ctx.lineWidth = 1; ctx.strokeRect(point.x - size / 2, point.y - size / 2, size, size);
  } else if (marker.kind === 'pickup' || marker.kind === 'mission_board') {
    ctx.fillStyle = '#ffcf5a'; ctx.fillRect(point.x - size / 2, point.y - size / 2, size, size);
  } else if (marker.kind === 'delivery') {
    ctx.fillStyle = '#7cf0ca';
    ctx.beginPath(); ctx.arc(point.x, point.y, size / 2, 0, Math.PI * 2); ctx.fill();
  }
}

function drawCameraBounds(ctx, layout, camera, viewport) {
  if (!camera?.visibleBounds) return;
  const bounds = camera.visibleBounds(viewport);
  const leftTop = project(layout, { x: bounds.left, y: bounds.top });
  ctx.strokeStyle = '#ffffffbb';
  ctx.lineWidth = layout.mode === 'full' ? 2 : 1;
  ctx.strokeRect(
    leftTop.x,
    leftTop.y,
    Math.max(2, (bounds.right - bounds.left) * layout.scaleX),
    Math.max(2, (bounds.bottom - bounds.top) * layout.scaleY),
  );
}

function drawFullLegend(ctx, viewport, layout, partyId) {
  const y = Math.min(viewport.height - 46, layout.y + layout.height + 27);
  ctx.font = '800 10px system-ui'; ctx.textAlign = 'center';
  const pieces = [
    ['◆', '#59e0b8', 'PARTY HOUSE'],
    ['■', '#ffd27e', 'OPEN VENUE'],
    ['■', '#8fe9ff', 'GROUP SAVE'],
    ['■', '#ffcf5a', 'MISSION'],
    ['●', '#7cf0ca', 'DELIVERY'],
    ['●', partyColour(partyId === 'all' ? 'party_a' : partyId), partyId === 'all' ? 'PARTY PLAYERS' : 'YOUR PARTY'],
  ];
  const spacing = Math.min(126, Math.max(88, (viewport.width - 24) / pieces.length));
  const totalWidth = pieces.length * spacing;
  let x = viewport.width / 2 - totalWidth / 2 + spacing / 2;
  ctx.font = `800 ${viewport.width < 720 ? 8 : 10}px system-ui`;
  for (const [glyph, colour, label] of pieces) {
    ctx.fillStyle = colour; ctx.fillText(glyph, x - spacing * 0.34, y);
    ctx.fillStyle = '#c4d8d1'; ctx.fillText(label, x + spacing * 0.08, y);
    x += spacing;
  }
}

export function drawCityMap(ctx, viewport, map, world, camera, partyId, requestedMode = 'minimap', cityArt = null) {
  const mode = normalizeMapMode(requestedMode);
  if (mode === 'hidden' || !map?.world || !ctx) return;
  const layout = mapViewportLayout(viewport, map, mode);
  const full = mode === 'full';
  const markers = collectCityMapMarkers(map, world, partyId);
  ctx.save();
  if (full) {
    ctx.fillStyle = '#020906ee'; ctx.fillRect(0, 0, viewport.width, viewport.height);
  }
  ctx.fillStyle = '#07110ef2';
  ctx.fillRect(layout.x - (full ? 12 : 6), layout.y - (full ? 12 : 20), layout.width + (full ? 24 : 12), layout.height + (full ? 24 : 26));
  ctx.fillStyle = map.palette?.ground || '#233a35'; ctx.fillRect(layout.x, layout.y, layout.width, layout.height);
  ctx.strokeStyle = full ? '#b8e7d5dd' : '#b8e7d5aa'; ctx.lineWidth = full ? 2 : 1; ctx.strokeRect(layout.x, layout.y, layout.width, layout.height);
  if (full) {
    ctx.fillStyle = '#d9fff2'; ctx.font = '900 20px system-ui'; ctx.textAlign = 'center';
    ctx.fillText('TILBURG CITY MAP', viewport.width / 2, 30);
    ctx.fillStyle = '#86a99d'; ctx.font = '800 10px system-ui';
    ctx.fillText('SHARED PARTY VIEW · LIVE HOST POSITIONS · M OR MAP BUTTON TO CLOSE', viewport.width / 2, 48);
  } else {
    ctx.fillStyle = '#d9fff2'; ctx.font = '900 8px system-ui'; ctx.textAlign = 'center';
    ctx.fillText('TILBURG · M / MAP FOR FULL VIEW', layout.x + layout.width / 2, layout.y - 7);
  }
  drawNetwork(ctx, layout, map, cityArt, full);
  drawDistrictsAndLandmarks(ctx, layout, cityArt, full);
  for (const marker of markers) drawMarker(ctx, layout, marker, full);
  drawCameraBounds(ctx, layout, camera, viewport);
  ctx.fillStyle = '#d9fff2'; ctx.font = `900 ${full ? 11 : 8}px system-ui`; ctx.textAlign = 'center';
  ctx.fillText('N', layout.x + layout.width - (full ? 17 : 10), layout.y + (full ? 19 : 12));
  ctx.beginPath();
  ctx.moveTo(layout.x + layout.width - (full ? 17 : 10), layout.y + (full ? 25 : 17));
  ctx.lineTo(layout.x + layout.width - (full ? 21 : 13), layout.y + (full ? 32 : 22));
  ctx.lineTo(layout.x + layout.width - (full ? 13 : 7), layout.y + (full ? 32 : 22));
  ctx.closePath(); ctx.fill();
  if (full) drawFullLegend(ctx, viewport, layout, partyId);
  ctx.restore();
}
