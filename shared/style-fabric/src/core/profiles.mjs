import { clone, clamp } from "./stable.mjs";

export const PERFORMANCE_PROFILES = Object.freeze({
  legacy: Object.freeze({
    id: "legacy",
    name: "Legacy / battery saver",
    caps: Object.freeze({
      glowIntensity: 0.22,
      glowRadius: 12,
      emissiveStrength: 0.55,
      clearcoat: 0.15,
      iridescence: 0,
      translucency: 0.25,
      pulseSpeed: 0,
      shimmerSpeed: 0,
      patternStrength: 0.3
    })
  }),
  balanced: Object.freeze({
    id: "balanced",
    name: "Balanced",
    caps: Object.freeze({
      glowIntensity: 0.68,
      glowRadius: 32,
      emissiveStrength: 1.3,
      clearcoat: 0.75,
      iridescence: 0.65,
      translucency: 0.7,
      pulseSpeed: 1.4,
      shimmerSpeed: 1.2,
      patternStrength: 0.78
    })
  }),
  showcase: Object.freeze({
    id: "showcase",
    name: "Showcase",
    caps: Object.freeze({
      glowIntensity: 1,
      glowRadius: 64,
      emissiveStrength: 2,
      clearcoat: 1,
      iridescence: 1,
      translucency: 1,
      pulseSpeed: 4,
      shimmerSpeed: 4,
      patternStrength: 1
    })
  }),
  "reduced-motion": Object.freeze({
    id: "reduced-motion",
    name: "Reduced motion",
    caps: Object.freeze({
      glowIntensity: 0.72,
      glowRadius: 32,
      emissiveStrength: 1.3,
      clearcoat: 0.8,
      iridescence: 0.7,
      translucency: 0.75,
      pulseSpeed: 0,
      shimmerSpeed: 0,
      patternStrength: 0.8
    })
  })
});

export function listPerformanceProfiles() {
  return clone(Object.values(PERFORMANCE_PROFILES));
}

export function applyPerformanceProfile(pack, profileId = "balanced") {
  const profile = PERFORMANCE_PROFILES[profileId];
  if (!profile) throw new Error(`Unknown performance profile: ${profileId}`);
  const output = clone(pack);
  const changes = [];
  for (const [materialId, material] of Object.entries(output.materials ?? {})) {
    for (const property of [
      "glowIntensity",
      "glowRadius",
      "emissiveStrength",
      "clearcoat",
      "iridescence",
      "translucency",
      "pulseSpeed",
      "shimmerSpeed"
    ]) {
      if (!Number.isFinite(material[property])) continue;
      const next = clamp(material[property], 0, profile.caps[property]);
      if (next !== material[property]) {
        changes.push({
          material: materialId,
          property,
          requested: material[property],
          applied: next
        });
        material[property] = next;
      }
    }
    if (Number.isFinite(material.pattern?.strength)) {
      const next = clamp(material.pattern.strength, 0, profile.caps.patternStrength);
      if (next !== material.pattern.strength) {
        changes.push({
          material: materialId,
          property: "pattern.strength",
          requested: material.pattern.strength,
          applied: next
        });
        material.pattern.strength = next;
      }
    }
  }
  if (output.tokens?.motion) {
    for (const [property, capName] of [
      ["pulseSpeed", "pulseSpeed"],
      ["shimmerSpeed", "shimmerSpeed"]
    ]) {
      if (!Number.isFinite(output.tokens.motion[property])) continue;
      const next = clamp(output.tokens.motion[property], 0, profile.caps[capName]);
      if (next !== output.tokens.motion[property]) {
        changes.push({
          material: "tokens.motion",
          property,
          requested: output.tokens.motion[property],
          applied: next
        });
        output.tokens.motion[property] = next;
      }
    }
  }
  output.integrity = null;
  output.provenance = {
    ...(output.provenance ?? {}),
    performanceProfile: profile.id,
    performanceProfileChanges: changes.length
  };
  output.accessibility = {
    ...(output.accessibility ?? {}),
    reducedMotionSafe:
      output.accessibility?.reducedMotionSafe || profile.id === "reduced-motion"
  };
  return {
    pack: output,
    receipt: {
      type: "axm.performance-profile-receipt",
      version: "1.0",
      profile: profile.id,
      changes
    }
  };
}
