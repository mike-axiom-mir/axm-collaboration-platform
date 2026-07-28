import { readdir, readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import process from "node:process";
import {
  PRESKINS,
  SKIN_MOLDS,
  applyPerformanceProfile,
  applyPreskin,
  assessGameAdapterConformance,
  assessMoldCompatibility,
  blendPreskins,
  calculateSkinIntegrity,
  compileStyleIntent,
  composeSkinStack,
  createGameContractFromMold,
  generateStyleIntent,
  gameSurfaceCoverage,
  resolveSkinForGame,
  stableStringify,
  validateGameSkinContract,
  validateSkinPack,
  verifySkinIntegrity
} from "../src/index.mjs";

const root = new URL("../", import.meta.url);
const failures = [];
const checks = [];

function record(ok, name, detail = "") {
  checks.push({ ok, name, detail });
  if (!ok) failures.push({ name, detail });
}

async function walk(path) {
  const entries = await readdir(path, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const target = join(path, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(target)));
    else files.push(target);
  }
  return files;
}

async function json(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function main() {
  const rootPath = new URL("../", import.meta.url).pathname;
  const files = await walk(rootPath);
  const jsonFiles = files.filter((file) => extname(file) === ".json");
  for (const file of jsonFiles) {
    try {
      await json(file);
      record(true, "JSON_PARSE", file.replace(rootPath, ""));
    } catch (error) {
      record(false, "JSON_PARSE", `${file}: ${error.message}`);
    }
  }

  const intent = await json(new URL("../examples/intents/neon-paper-luxe.intent.json", import.meta.url));
  const contract = await json(
    new URL("../examples/contracts/orb-arena.game-skin-contract.json", import.meta.url)
  );
  const preskinCatalog = await json(new URL("../preskin-catalog.json", import.meta.url));
  const moldKitCatalog = await json(new URL("../mold-kit-catalog.json", import.meta.url));
  const first = compileStyleIntent(intent);
  const second = compileStyleIntent(intent);
  record(
    stableStringify(first) === stableStringify(second),
    "DETERMINISTIC_RECIPE",
    "Same intent and seed produce byte-identical canonical JSON."
  );

  record(
    SKIN_MOLDS.length === 16 && new Set(SKIN_MOLDS.map((mold) => mold.id)).size === 16,
    "SEMANTIC_MOLD_CATALOG",
    `${SKIN_MOLDS.length} unique game molds`
  );

  const generatedContracts = SKIN_MOLDS.map((mold) =>
    createGameContractFromMold({
      moldId: mold.id,
      gameId: `verify.${mold.id}`,
      gameVersion: "0.5.0"
    })
  );
  record(
    generatedContracts.every((entry) => validateGameSkinContract(entry).ok),
    "MOLD_CONTRACTS_VALID",
    `${generatedContracts.filter((entry) => validateGameSkinContract(entry).ok).length}/${generatedContracts.length} valid`
  );

  const generatedFirst = generateStyleIntent({
    seed: "verify-mold-maker",
    name: "Verifier Growth",
    moldId: "full-presentation",
    mood: "wonder",
    complexity: 0.73
  });
  const generatedSecond = generateStyleIntent({
    seed: "verify-mold-maker",
    name: "Verifier Growth",
    moldId: "full-presentation",
    mood: "wonder",
    complexity: 0.73
  });
  record(
    stableStringify(generatedFirst) === stableStringify(generatedSecond),
    "MOLD_MAKER_DETERMINISTIC",
    "Same seed, mold, mood, and complexity produce identical intent."
  );

  const builtMoldKits = await Promise.all(
    moldKitCatalog.kits.map(async (entry) => {
      const pack = await json(join(rootPath, entry.file));
      return {
        validation: validateSkinPack(pack),
        integrity: await verifySkinIntegrity(pack)
      };
    })
  );
  record(
    moldKitCatalog.count === 20 &&
      builtMoldKits.every((entry) => entry.validation.ok && entry.integrity.ok),
    "MOLD_KITS_VALID",
    `${builtMoldKits.filter((entry) => entry.validation.ok && entry.integrity.ok).length}/${moldKitCatalog.count} valid and verified`
  );

  const preskinBase = {
    seed: "verify-fusion",
    scope: ["global"],
    sharing: { attribution: "Verifier" }
  };
  const layered = composeSkinStack([
    {
      id: "world",
      scope: "world",
      pack: compileStyleIntent(applyPreskin(preskinBase, "world-ember-foundry"))
    },
    {
      id: "character",
      scope: "character.player",
      pack: compileStyleIntent(applyPreskin(preskinBase, "character-soft-hero"))
    },
    {
      id: "fx",
      scope: "fx",
      pack: compileStyleIntent(applyPreskin(preskinBase, "arcade-neon-circuit"))
    }
  ]);
  const worldBinding = layered.bindings.find((entry) => entry.target === "world.background");
  const characterBinding = layered.bindings.find(
    (entry) => entry.target === "character.player.body"
  );
  record(
    validateSkinPack(layered).ok &&
      worldBinding?.material !== characterBinding?.material,
    "LAYER_SCOPE_ISOLATION",
    `${worldBinding?.material} != ${characterBinding?.material}`
  );

  const profiled = applyPerformanceProfile(layered, "legacy");
  record(
    validateSkinPack(profiled.pack).ok &&
      Object.values(profiled.pack.materials).every(
        (material) => material.pulseSpeed === 0 && material.shimmerSpeed === 0
      ) &&
      profiled.pack.tokens.motion.pulseSpeed === 0 &&
      profiled.pack.tokens.motion.shimmerSpeed === 0,
    "PERFORMANCE_PROFILE_CAPS",
    `${profiled.receipt.changes.length} legacy caps applied`
  );

  const moldContract = createGameContractFromMold({
    moldId: "arcade-arena",
    gameId: "verify.arena",
    gameVersion: "0.5.0"
  });
  const moldReport = assessMoldCompatibility(first, moldContract, "arcade-arena");
  record(
    moldReport.summary.connected === 13 && moldReport.automaticWrites === 0,
    "MOLD_NEGOTIATION_NO_WRITES",
    `${moldReport.summary.connected}/${moldReport.summary.total} connected`
  );

  const fullSurfaceReport = gameSurfaceCoverage(
    first,
    createGameContractFromMold({
      moldId: "full-presentation",
      gameId: "verify.full-surface",
      gameVersion: "0.5.0"
    })
  );
  record(
    fullSurfaceReport.summary.connected === 33 &&
      fullSurfaceReport.summary.total === 33 &&
      fullSurfaceReport.categories.length === 7 &&
      fullSurfaceReport.automaticWrites === 0,
    "FULL_GAME_SURFACE_COVERAGE",
    `${fullSurfaceReport.summary.connected}/${fullSurfaceReport.summary.total} across ${fullSurfaceReport.categories.length} organs`
  );

  const conformanceContract = createGameContractFromMold({
    moldId: "full-presentation",
    gameId: "verify.conformance",
    gameVersion: "0.5.0"
  });
  const pendingConformance = assessGameAdapterConformance({
    gameContract: conformanceContract
  });
  record(
    pendingConformance.readiness === "CONTRACT_READY_RUNTIME_PENDING" &&
      pendingConformance.summary.failed === 0 &&
      pendingConformance.summary.pending === 4 &&
      pendingConformance.automaticWrites === 0,
    "ADAPTER_CONFORMANCE_PENDING_HONESTLY",
    `${pendingConformance.summary.passed} passed · ${pendingConformance.summary.pending} runtime proofs pending`
  );
  const reviewedConformance = assessGameAdapterConformance({
    gameContract: conformanceContract,
    adapterEvidence: {
      previewIsolated: true,
      fallbackObserved: true,
      rollbackObserved: true,
      receiptObserved: true
    }
  });
  record(
    reviewedConformance.readiness === "READY_FOR_ADOPTION_REVIEW" &&
      reviewedConformance.summary.passed === reviewedConformance.summary.total,
    "ADAPTER_CONFORMANCE_EVIDENCE_ROUTE",
    `${reviewedConformance.summary.passed}/${reviewedConformance.summary.total} declared observations`
  );

  const packReport = validateSkinPack(first);
  record(packReport.ok, "EXAMPLE_PACK_VALID", `${packReport.errors.length} errors`);
  const contractReport = validateGameSkinContract(contract);
  record(contractReport.ok, "EXAMPLE_CONTRACT_VALID", `${contractReport.errors.length} errors`);

  const resolution = await resolveSkinForGame({ packs: [first], gameContract: contract });
  record(
    resolution.ok && resolution.resolved.presentationAuthority === "ZERO_AUTHORITATIVE_WRITES",
    "RESOLUTION_BOUNDARY",
    resolution.ok ? resolution.compatibility : resolution.status
  );
  record(
    resolution.receipt?.summary.applied >= 4,
    "SEMANTIC_SLOT_COVERAGE",
    stableStringify(resolution.receipt?.summary ?? {})
  );

  first.integrity = await calculateSkinIntegrity(first);
  const integrity = await verifySkinIntegrity(first);
  record(integrity.ok, "INTEGRITY_ROUND_TRIP", integrity.status);

  record(
    PRESKINS.length === 25 &&
      preskinCatalog.count === 25 &&
      new Set(PRESKINS.map((preset) => preset.id)).size === 25,
    "PRESKIN_CATALOG",
    `${PRESKINS.length} source presets · ${preskinCatalog.count} portable entries`
  );

  const builtPreskins = await Promise.all(
    preskinCatalog.presets.map(async (entry) => {
      const pack = await json(join(rootPath, entry.file));
      return {
        id: entry.id,
        validation: validateSkinPack(pack),
        integrity: await verifySkinIntegrity(pack)
      };
    })
  );
  record(
    builtPreskins.every((entry) => entry.validation.ok),
    "PRESKIN_PACKS_VALID",
    `${builtPreskins.filter((entry) => entry.validation.ok).length}/${builtPreskins.length} valid`
  );
  record(
    builtPreskins.every((entry) => entry.integrity.ok),
    "PRESKIN_PACKS_INTEGRITY",
    `${builtPreskins.filter((entry) => entry.integrity.ok).length}/${builtPreskins.length} verified`
  );

  const blendedFirst = compileStyleIntent(
    blendPreskins(preskinBase, "axm-balanced", "world-ember-foundry", 0.37)
  );
  const blendedSecond = compileStyleIntent(
    blendPreskins(preskinBase, "axm-balanced", "world-ember-foundry", 0.37)
  );
  record(
    stableStringify(blendedFirst) === stableStringify(blendedSecond),
    "PRESKIN_FUSION_DETERMINISTIC",
    "Same two sources and blend amount produce identical canonical output."
  );
  record(
    validateSkinPack(compileStyleIntent(applyPreskin(preskinBase, "clarity-accessible-night"))).ok,
    "ACCESSIBLE_PRESKIN_VALID",
    "Accessible Night compiles through the same presentation-only validator."
  );

  const hostile = structuredClone(first);
  hostile.gameplay = { damage: 999 };
  const hostileReport = validateSkinPack(hostile);
  record(
    !hostileReport.ok &&
      hostileReport.errors.some((entry) =>
        ["UNKNOWN_TOP_LEVEL_FIELD", "FORBIDDEN_KEY"].includes(entry.code)
      ),
    "AUTHORITY_INJECTION_REJECTED",
    hostileReport.errors.map((entry) => entry.code).join(",")
  );

  const scriptAsset = structuredClone(first);
  scriptAsset.assets["asset.bad"] = {
    mime: "image/svg+xml",
    role: "texture",
    source: { kind: "embedded-data", data: "data:image/svg+xml;base64,PHNjcmlwdD4=" },
    sha256: "0".repeat(64),
    provenance: { origin: "test" }
  };
  const assetReport = validateSkinPack(scriptAsset);
  record(
    !assetReport.ok && assetReport.errors.some((entry) => entry.code === "ASSET_MIME_DENIED"),
    "SVG_SCRIPT_ROUTE_REJECTED",
    assetReport.errors.map((entry) => entry.code).join(",")
  );

  const summary = {
    status: failures.length ? "FAIL" : "PASS",
    checks: checks.length,
    passed: checks.filter((entry) => entry.ok).length,
    failed: failures.length,
    failures
  };
  console.log(stableStringify(summary, 2));
  if (failures.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
