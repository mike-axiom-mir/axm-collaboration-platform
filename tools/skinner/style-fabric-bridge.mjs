import {
  applyPreskin,
  blendPreskins,
  compileStyleIntent,
  listPreskins,
  readSkinPackFile,
  validateSkinPack
} from "../../shared/style-fabric/src/index.mjs";

export const STYLE_FABRIC_VERSION = "0.5.0";

const clone = (value) => structuredClone(value);
const clamp = (value, low, high) => Math.min(high, Math.max(low, Number(value)));

function asHex(core, value, fallback) {
  const rgb = core.parseColor(value) || core.parseColor(fallback);
  return `#${rgb.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function mixHex(core, first, second, amount) {
  const a = core.parseColor(first);
  const b = core.parseColor(second);
  const mix = clamp(amount, 0, 1);
  return asHex(
    core,
    `rgb(${a.map((channel, index) => Math.round(channel + (b[index] - channel) * mix)).join(",")})`,
    first
  );
}

function readableAgainst(core, preferred, backgrounds, minimum) {
  const source = asHex(core, preferred, "#f7f8ff");
  const candidates = [source, "#ffffff", "#000000"];
  for (const target of ["#ffffff", "#000000"]) {
    for (let step = 1; step <= 20; step++) candidates.push(mixHex(core, source, target, step / 20));
  }
  return candidates.find((candidate) =>
    backgrounds.every((background) => core.contrast(candidate, background) >= minimum)
  ) || source;
}

function material(pack, id) {
  return pack?.materials?.[id] || {};
}

function presentationTokens(pack, core, current) {
  const colors = pack?.tokens?.color || {};
  const resolved = core.resolve(current).tokens;
  const surface = asHex(core, colors.surface || material(pack, "ui.panel").baseColor, resolved["--panel"]);
  const background = asHex(core, colors.background || material(pack, "world.base").baseColor, resolved["--space"]);
  const primary = asHex(core, colors.primary, resolved["--cy"]);
  const secondary = asHex(core, colors.secondary, resolved["--blue"]);
  const accent = asHex(core, colors.accent, resolved["--purple"]);
  const text = readableAgainst(core, colors.text, [surface, background], 4.5);

  return {
    "--space": background,
    "--ink": asHex(core, material(pack, "world.sky").secondaryColor, background),
    "--panel": surface,
    "--panel-2": asHex(core, material(pack, "ui.menu").baseColor, mixHex(core, surface, background, 0.45)),
    "--line": mixHex(core, surface, text, 0.18),
    "--edge": mixHex(core, surface, primary, 0.28),
    "--text": text,
    "--muted": readableAgainst(core, colors.mutedText, [surface], 3),
    "--muted-2": mixHex(core, readableAgainst(core, colors.mutedText, [surface], 3), background, 0.42),
    "--cy": readableAgainst(core, primary, [surface], 3),
    "--cy-dim": mixHex(core, primary, background, 0.46),
    "--blue": secondary,
    "--gold": readableAgainst(core, colors.objective || accent, [surface], 4.5),
    "--red": readableAgainst(core, colors.danger || accent, [surface], 4.5),
    "--green": readableAgainst(core, colors.success || primary, [surface], 3),
    "--purple": accent
  };
}

function visualHints(pack, core, current) {
  const intent = pack?.provenance?.sourceIntent || {};
  const geometry = pack?.tokens?.geometry || intent.geometry || {};
  const materialIntent = intent.material || {};
  const accessibility = pack?.accessibility || intent.accessibility || {};
  const present = core.resolve(current).visuals;
  const intensity = clamp(intent.intensity ?? 0.7, 0, 1);
  const glow = clamp(materialIntent.glowIntensity ?? material(pack, "fx.primary").glowIntensity ?? 0.5, 0, 1);
  const roundness = clamp(geometry.cornerRoundness ?? 0.6, 0, 1);
  const detail = clamp(geometry.detailDensity ?? 0.5, 0, 1);
  const translucency = clamp(materialIntent.translucency ?? material(pack, "ui.panel").translucency ?? 0, 0, 0.9);
  const metallic = clamp(materialIntent.metallic ?? material(pack, "ui.panel").metallic ?? 0, 0, 1);
  const roughness = clamp(materialIntent.roughness ?? material(pack, "ui.panel").roughness ?? 0.5, 0, 1);

  let materialName = "crystal";
  if (translucency > 0.5) materialName = "clear";
  else if (metallic > 0.72) materialName = "mirror";
  else if (roughness > 0.72) materialName = "velvet";

  return {
    enabled: Boolean(present.enabled),
    intensity: Number((0.45 + intensity * 1.2).toFixed(2)),
    atmosphereStrength: Number((0.5 + intensity * 0.9).toFixed(2)),
    glowStrength: Number((glow * 2).toFixed(2)),
    luminosity: intensity > 0.78 ? "radiant" : intensity < 0.34 ? "dim" : "balanced",
    density: detail > 0.7 ? "compact" : detail < 0.34 ? "airy" : "comfortable",
    shape: roundness > 0.7 ? "soft" : roundness < 0.34 ? "sharp" : "sculpted",
    material: materialName,
    contrast: accessibility.minimumTextContrast >= 7 || accessibility.highContrast ? "high" : present.contrast,
    motion: accessibility.reducedMotion || pack?.accessibility?.reducedMotionSafe ? "reduced" : present.motion
  };
}

export function compilePresetPack(primaryId, secondaryId = null, blend = 0.5) {
  const base = {
    seed: `axm-skinner:${primaryId}:${secondaryId || "none"}:${Number(blend).toFixed(2)}`,
    scope: ["global", "character.player"],
    sharing: {
      license: "LicenseRef-All-Rights-Reserved",
      remixAllowed: false,
      attribution: "Skinner user"
    }
  };
  const intent = secondaryId
    ? blendPreskins(base, primaryId, secondaryId, clamp(blend, 0, 1))
    : applyPreskin(base, primaryId);
  return compileStyleIntent(intent);
}

export function mapFabricPackToSkin(pack, core, currentSkin) {
  const validation = validateSkinPack(pack);
  if (!validation.ok) {
    return {
      ok: false,
      stage: "style-fabric-validation",
      errors: validation.errors.map((entry) => entry.message || `${entry.path || "$"}: ${entry.code || "invalid"}`)
    };
  }

  const candidate = clone(currentSkin);
  candidate.name = String(pack.metadata?.name || "Style Fabric skin").slice(0, 80);
  candidate.tokens = { ...(candidate.tokens || {}), ...presentationTokens(pack, core, candidate) };

  const geometry = pack?.tokens?.geometry || pack?.provenance?.sourceIntent?.geometry || {};
  if (Number.isFinite(Number(geometry.cornerRoundness))) {
    candidate.tokens["--radius"] = String(Math.round(clamp(geometry.cornerRoundness, 0, 1) * 28));
    candidate.tokens["--radius-s"] = String(Math.round(clamp(geometry.cornerRoundness, 0, 1) * 22));
  }
  candidate.visuals = { ...(candidate.visuals || {}), ...visualHints(pack, core, candidate) };

  let gate = core.accept(candidate, null);
  const safetyFallbackTokens = [];
  const previous = core.resolve(currentSkin).tokens;
  for (let pass = 0; !gate.ok && gate.stage === "readability" && pass < 4; pass++) {
    for (const failure of gate.failures || []) {
      const match = failure.pair.match(/^(--[\w-]+) on (--[\w-]+)$/);
      if (!match) continue;
      for (const token of [match[1], match[2]]) {
        candidate.tokens[token] = previous[token];
        if (!safetyFallbackTokens.includes(token)) safetyFallbackTokens.push(token);
      }
    }
    gate = core.accept(candidate, null);
  }

  if (!gate.ok) return { ok: false, stage: gate.stage, errors: gate.errors || ["Skinner gate refused the mapped pack."] };

  const mappedTokens = Object.keys(presentationTokens(pack, core, candidate)).concat(["--radius", "--radius-s"])
    .filter((token, index, values) => token in candidate.tokens && values.indexOf(token) === index);
  return {
    ok: true,
    skin: candidate,
    gate,
    receipt: {
      schema: "axm.style-fabric-bridge/v1",
      version: STYLE_FABRIC_VERSION,
      packId: pack.id,
      packName: pack.metadata?.name || pack.id,
      integrity: pack.integrity?.contentSha256 || null,
      preset: clone(pack.provenance?.preset || null),
      mappedAt: new Date().toISOString(),
      mappedTokens,
      visualHints: Object.keys(visualHints(pack, core, candidate)),
      safetyFallbackTokens,
      ignoredEmbeddedAssets: Object.keys(pack.assets || {}),
      authorityWrites: 0,
      status: "STAGED_FOR_SKINNER"
    }
  };
}

function optionFor(preset) {
  const option = document.createElement("option");
  option.value = preset.id;
  option.textContent = preset.name;
  option.dataset.family = preset.family;
  return option;
}

function startSkinnerIntegration() {
  const hook = window.AXMSkinnerStyleFabric;
  const core = window.AXMSkin;
  if (!hook || !core) return;

  const byId = (id) => document.getElementById(id);
  const primary = byId("fabricPrimary");
  const secondary = byId("fabricSecondary");
  const amount = byId("fabricAmount");
  const amountOut = byId("fabricAmountOut");
  const status = byId("fabricStatus");
  const name = byId("fabricName");
  const swatches = byId("fabricSwatches");
  const receipt = byId("fabricReceipt");
  const file = byId("fabricPackFile");
  let currentPack = null;

  const presets = listPreskins();
  const groups = new Map();
  for (const preset of presets) {
    if (!groups.has(preset.family)) {
      const group = document.createElement("optgroup");
      group.label = preset.family;
      groups.set(preset.family, group);
      primary.append(group);
    }
    groups.get(preset.family).append(optionFor(preset));
    secondary.append(optionFor(preset));
  }
  primary.value = "axm-balanced";

  function setStatus(kind, text) {
    status.className = `visual-status${kind ? ` ${kind}` : ""}`;
    status.textContent = text;
  }

  function showPack(pack, source) {
    currentPack = pack;
    const colors = pack.tokens?.color || {};
    name.textContent = `${pack.metadata?.name || pack.id} · ${source}`;
    swatches.replaceChildren();
    for (const color of [colors.background, colors.surface, colors.primary, colors.secondary, colors.accent, colors.text]) {
      if (!color) continue;
      const chip = document.createElement("span");
      chip.className = "fabric-swatch";
      chip.style.background = color;
      chip.title = color;
      swatches.append(chip);
    }
    setStatus("on", "ready");
  }

  function compileSelection() {
    try {
      const second = secondary.value || null;
      amount.disabled = !second;
      amountOut.value = `${Math.round(Number(amount.value) * 100)}%`;
      showPack(compilePresetPack(primary.value, second, Number(amount.value)), second ? "fused preskins" : "built-in preskin");
      receipt.textContent = "Validated Style Fabric presentation data is ready to stage.";
    } catch (error) {
      setStatus("bad", "compile failed");
      receipt.textContent = error.message;
    }
  }

  for (const input of [primary, secondary, amount]) input.addEventListener("input", compileSelection);

  byId("fabricApply").addEventListener("click", () => {
    if (!currentPack) return;
    const mapped = mapFabricPackToSkin(currentPack, core, hook.currentSkin());
    if (!mapped.ok) {
      setStatus("bad", "refused");
      receipt.textContent = `${mapped.stage}: ${(mapped.errors || []).join(" · ")}`;
      return;
    }
    const applied = hook.applyMapped(mapped);
    if (!applied.ok) {
      setStatus("bad", "refused");
      receipt.textContent = `${applied.stage}: ${(applied.errors || []).join(" · ")}`;
      return;
    }
    setStatus("on", "staged");
    receipt.textContent = `${mapped.receipt.packName} mapped to ${mapped.receipt.mappedTokens.length} Skinner controls; ${mapped.receipt.ignoredEmbeddedAssets.length} embedded asset(s) intentionally left outside the vault. Select Apply to hub to commit.`;
  });

  byId("fabricImport").addEventListener("click", () => file.click());
  file.addEventListener("change", async () => {
    const selected = file.files?.[0];
    if (!selected) return;
    setStatus("", "validating");
    const result = await readSkinPackFile(selected);
    file.value = "";
    if (!result.ok) {
      setStatus("bad", "import refused");
      const errors = result.validation?.errors || result.errors || [];
      receipt.textContent = errors.map((entry) => entry.message || entry.code || String(entry)).join(" · ");
      return;
    }
    showPack(result.pack, result.status === "INTEGRITY_VERIFIED" ? "integrity verified" : "valid unsigned import");
    receipt.textContent = "Imported pack is validated and ready to stage; embedded assets remain isolated from the Hub vault.";
  });

  compileSelection();
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", startSkinnerIntegration, { once: true });
  else startSkinnerIntegration();
}
