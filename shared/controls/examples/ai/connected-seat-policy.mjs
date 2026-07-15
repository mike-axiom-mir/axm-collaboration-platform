import { ConnectedAiSeatClient } from '../../src/ai/connected-ai-client.mjs';

export function simpleVisibleTargetPolicy(observation) {
  const self = observation.self?.position || { x: 0, y: 0 };
  const target = (observation.visible?.actors || []).find((actor) => (
    actor.id !== observation.self?.id && actor.partyId !== observation.partyId
  ));
  if (!target?.position) return { moveX: 0, moveY: 0, action: false, fire: false };
  const dx = target.position.x - self.x;
  const dy = target.position.y - self.y;
  const length = Math.max(1, Math.hypot(dx, dy));
  return {
    moveX: 0,
    moveY: 0,
    aimX: dx / length,
    aimY: dy / length,
    aimActive: true,
    fire: length < 300,
  };
}

export function createExampleConnectedSeat(binding, baseUrl) {
  return new ConnectedAiSeatClient({
    identity: binding,
    baseUrl,
    observationUrl: binding.observationEndpoint,
    inputUrl: binding.inputEndpoint,
    policy: simpleVisibleTargetPolicy,
    intervalMs: 100,
  });
}

// The returned client is intentionally not started here. The real Workshop owns
// adapter selection, lifecycle, pause/disconnect behavior, and the reasoning source.

