export function drawAmbient(ctx, map) {
  const t = performance.now() * .0002;
  ctx.save(); ctx.globalAlpha = .12; ctx.fillStyle = '#d5fff2';
  for (let i = 0; i < 18; i++) { const x = (i * 191 + t * 90) % map.world.width; const y = (i * 317 + Math.sin(t + i) * 18 + 1024) % map.world.height; ctx.fillRect(x, y, 1, 1); }
  ctx.restore();
}
