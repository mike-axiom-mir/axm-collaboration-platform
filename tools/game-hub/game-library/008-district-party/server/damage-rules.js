'use strict';

const { mergeCombatRules } = require('../shared/party-rules');

function evaluateDamagePermission(attacker, target, damageEvent = {}, suppliedRules = {}) {
  const rules = mergeCombatRules(suppliedRules);
  if (!target) return { allowed: false, reason: 'missing-target', knockbackMultiplier: 0 };

  const isEnvironment = damageEvent.environment === true || damageEvent.channel === 'environmentDamage';
  if (isEnvironment) {
    return rules.environmentDamage
      ? { allowed: true, reason: 'environment-enabled', knockbackMultiplier: 1 }
      : { allowed: false, reason: 'environment-disabled', knockbackMultiplier: 0 };
  }

  if (!attacker) return { allowed: false, reason: 'missing-attacker', knockbackMultiplier: 0 };
  if (!rules.enabled) return { allowed: false, reason: 'combat-disabled', knockbackMultiplier: 0 };
  if (damageEvent.safeZone === true || damageEvent.attackerSafeZone === true || damageEvent.targetSafeZone === true) {
    return { allowed: false, reason: 'safe-zone', knockbackMultiplier: 0 };
  }

  const channelName = damageEvent.channel || 'projectileDamage';
  const channel = rules.channels[channelName] || null;
  if (!channel || channel.implemented !== true) {
    return { allowed: false, reason: channel ? 'channel-not-implemented' : 'unknown-damage-channel', knockbackMultiplier: 0 };
  }

  if (attacker.id === target.id) {
    return rules.selfDamage
      ? { allowed: true, reason: 'self-damage-enabled', knockbackMultiplier: 1 }
      : { allowed: false, reason: 'self-damage-disabled', knockbackMultiplier: 0 };
  }

  const attackerParty = attacker.partyId || null;
  const targetParty = target.partyId || null;

  if (attackerParty && targetParty && attackerParty === targetParty) {
    // The per-party host toggle is the authoritative same-party permission.
    // Channel metadata describes safe defaults/capability; it cannot silently
    // override a host explicitly enabling Party A or Party B friendly fire.
    const enabled = rules.partyFriendlyFire[attackerParty] === true;
    if (enabled) return { allowed: true, reason: 'same-party-enabled', knockbackMultiplier: 1 };
    const knockback = rules.channels.allyKnockback;
    return {
      allowed: false,
      reason: 'same-party-blocked',
      knockbackMultiplier: knockback.enabled ? Number(knockback.multiplier) || 0 : 0,
    };
  }

  if (attackerParty && targetParty && attackerParty !== targetParty) {
    const enabled = rules.crossPartyDamage === true;
    return enabled
      ? { allowed: true, reason: 'cross-party-enabled', knockbackMultiplier: 1 }
      : { allowed: false, reason: 'cross-party-blocked', knockbackMultiplier: 0 };
  }

  return rules.neutralDamage
    ? { allowed: true, reason: 'neutral-damage-enabled', knockbackMultiplier: 1 }
    : { allowed: false, reason: 'neutral-damage-disabled', knockbackMultiplier: 0 };
}

function canDamage(attacker, target, damageEvent, combatRules) {
  return evaluateDamagePermission(attacker, target, damageEvent, combatRules).allowed;
}

module.exports = { canDamage, evaluateDamagePermission };
