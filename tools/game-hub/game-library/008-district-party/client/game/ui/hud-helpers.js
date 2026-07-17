export function ammoDisplay(summary) {
  if (summary?.unlimited === true || summary?.mode === 'provisional-unlimited') return '∞';
  if (summary?.mode === 'inventory') return `${whole(summary.loaded, 0)}/${whole(summary.total, 0)}`;
  return '—';
}

export function relativeSlot(actor = {}) {
  const parsed = Number(actor.slot ?? String(actor.seatId || '').match(/\d+/)?.[0]);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 8) return null;
  return ((parsed - 1) % 4) + 1;
}

export function groupActorsByCorner(actors = []) {
  const groups = new Map();
  actors.forEach((actor) => {
    const quarter = relativeSlot(actor);
    if (quarter === null) return;
    if (!groups.has(quarter)) groups.set(quarter, []);
    groups.get(quarter).push(actor);
  });
  return groups;
}

export function waitingPlayerLabel(partyId, quarter) {
  if (!Number.isInteger(quarter) || quarter < 1 || quarter > 4) return 'PLAYER';
  if (partyId === 'party_b') return `P${quarter + 4}`;
  if (partyId === 'all') return `P${quarter}/P${quarter + 4}`;
  return `P${quarter}`;
}

function whole(value, fallback) {
  return Number.isFinite(Number(value)) ? Math.max(0, Math.round(Number(value))) : fallback;
}
