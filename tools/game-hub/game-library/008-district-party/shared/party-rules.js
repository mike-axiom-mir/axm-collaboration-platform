'use strict';

const DEFAULT_COMBAT_RULES = Object.freeze({
  enabled: true,
  crossPartyDamage: true,
  selfDamage: false,
  partyFriendlyFire: Object.freeze({ party_a: false, party_b: false }),
  neutralDamage: true,
  environmentDamage: true,
  channels: Object.freeze({
    projectileDamage: Object.freeze({ sameParty: false, crossParty: true, implemented: true }),
    meleeDamage: Object.freeze({ sameParty: false, crossParty: true, implemented: true }),
    explosionDamage: Object.freeze({ sameParty: false, crossParty: true, implemented: false }),
    vehicleImpactDamage: Object.freeze({ sameParty: false, crossParty: true, implemented: false }),
    allyKnockback: Object.freeze({ enabled: true, multiplier: 0.25 }),
  }),
});

function mergeCombatRules(overrides = {}) {
  const friendly = overrides.partyFriendlyFire || {};
  const channels = overrides.channels || {};
  const allyKnockback = overrides.allyKnockback || channels.allyKnockback || {};
  return {
    enabled: typeof overrides.enabled === 'boolean' ? overrides.enabled : DEFAULT_COMBAT_RULES.enabled,
    crossPartyDamage: typeof overrides.crossPartyDamage === 'boolean'
      ? overrides.crossPartyDamage
      : DEFAULT_COMBAT_RULES.crossPartyDamage,
    selfDamage: typeof overrides.selfDamage === 'boolean' ? overrides.selfDamage : DEFAULT_COMBAT_RULES.selfDamage,
    partyFriendlyFire: {
      party_a: typeof friendly.party_a === 'boolean' ? friendly.party_a : DEFAULT_COMBAT_RULES.partyFriendlyFire.party_a,
      party_b: typeof friendly.party_b === 'boolean' ? friendly.party_b : DEFAULT_COMBAT_RULES.partyFriendlyFire.party_b,
    },
    neutralDamage: typeof overrides.neutralDamage === 'boolean' ? overrides.neutralDamage : DEFAULT_COMBAT_RULES.neutralDamage,
    environmentDamage: typeof overrides.environmentDamage === 'boolean'
      ? overrides.environmentDamage
      : DEFAULT_COMBAT_RULES.environmentDamage,
    channels: {
      projectileDamage: {
        ...DEFAULT_COMBAT_RULES.channels.projectileDamage,
        ...(channels.projectileDamage || {}),
      },
      meleeDamage: {
        ...DEFAULT_COMBAT_RULES.channels.meleeDamage,
        ...(channels.meleeDamage || {}),
      },
      explosionDamage: {
        ...DEFAULT_COMBAT_RULES.channels.explosionDamage,
        ...(channels.explosionDamage || {}),
      },
      vehicleImpactDamage: {
        ...DEFAULT_COMBAT_RULES.channels.vehicleImpactDamage,
        ...(channels.vehicleImpactDamage || {}),
      },
      allyKnockback: {
        ...DEFAULT_COMBAT_RULES.channels.allyKnockback,
        ...allyKnockback,
      },
    },
  };
}

module.exports = { DEFAULT_COMBAT_RULES, mergeCombatRules };
