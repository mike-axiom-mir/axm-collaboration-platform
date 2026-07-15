export function drawOffscreenIndicators(ctx, camera, viewport, actors, partyId) {
  const margin = 26;
  (actors || []).filter((a) => a.alive !== false && (partyId === 'all' || a.partyId === partyId)).forEach((actor) => {
    const p = actor.position || actor, screen = camera.worldToScreen(p, viewport);
    if (screen.x >= margin && screen.x <= viewport.width - margin && screen.y >= margin && screen.y <= viewport.height - margin) return;
    const cx = viewport.width / 2, cy = viewport.height / 2, angle = Math.atan2(screen.y - cy, screen.x - cx);
    const x = Math.max(margin, Math.min(viewport.width - margin, screen.x)); const y = Math.max(margin, Math.min(viewport.height - margin, screen.y));
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.fillStyle = actor.partyId === 'party_b' ? '#e98aff' : '#59e0b8'; ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-7, -6); ctx.lineTo(-7, 6); ctx.closePath(); ctx.fill(); ctx.restore();
  });
}
