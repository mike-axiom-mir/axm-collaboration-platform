export function missionSummary(mission = {}) {
  const individual = Object.values(mission.individual || {}).map((entry) => ({
    actorId: entry.actorId,
    displayName: entry.displayName || entry.actorId,
    deliveries: entry.deliveries || 0,
    collections: entry.collections || 0,
    vehicleAssisted: entry.vehicleAssistedDeliveries || 0,
    fastestDeliveryTicks: entry.fastestDeliveryTicks ?? null,
  })).sort((a, b) => b.deliveries - a.deliveries || (a.fastestDeliveryTicks ?? Infinity) - (b.fastestDeliveryTicks ?? Infinity));
  return {
    score: mission.partyScore ?? mission.score ?? 0,
    deliveries: mission.deliveries ?? mission.deliveredCount ?? 0,
    fastestDeliveryTicks: mission.fastestDeliveryTicks ?? null,
    vehicleAssisted: individual.reduce((sum, entry) => sum + entry.vehicleAssisted, 0),
    collections: individual.reduce((sum, entry) => sum + entry.collections, 0),
    droppedPackages: mission.droppedPackages ?? 0,
    wavesCompleted: mission.wavesCompleted ?? mission.result?.wavesCompleted ?? 0,
    relayHealth: mission.relay?.health ?? mission.result?.relayHealth ?? null,
    rewardCents: mission.result?.rewardCents ?? 0,
    personalRewardCents: mission.result?.personalRewardCents ?? 0,
    partyContributionCents: mission.result?.partyContributionCents ?? 0,
    rewardSplit: mission.result?.rewardSplit || { personalPercent: 40, partyPercent: 60 },
    partyFundTotals: mission.result?.partyFundTotals || {},
    success: mission.result?.success !== false,
    reason: mission.result?.reason || null,
    individual,
  };
}
