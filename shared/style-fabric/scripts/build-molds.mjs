import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyPerformanceProfile,
  calculateSkinIntegrity,
  compileStyleIntent,
  createGameContractFromMold,
  generateStyleIntent,
  listSkinMolds,
  stableStringify
} from "../src/index.mjs";

const root = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const output = join(root, "examples", "mold-kits");

const DEFINITIONS = [
  ["core-balanced", "Core Balanced", "universal-core", "balanced", 0.42, "balanced"],
  ["core-luxurious", "Core Luxurious", "universal-core", "luxurious", 0.72, "showcase"],
  ["world-wonder", "World Wonder", "world-atmosphere", "wonder", 0.84, "showcase"],
  ["world-grounded", "World Grounded", "world-atmosphere", "grounded", 0.62, "balanced"],
  ["character-playful", "Character Playful", "playable-character", "playful", 0.7, "balanced"],
  ["character-dramatic", "Character Dramatic", "character-cast", "dramatic", 0.78, "showcase"],
  ["arena-balanced", "Arena Balanced", "arcade-arena", "balanced", 0.58, "balanced"],
  ["arena-playful", "Arena Playful", "arcade-arena", "playful", 0.8, "balanced"],
  ["ui-luxurious", "Interface Luxurious", "ui-shell", "luxurious", 0.68, "balanced"],
  ["fx-wonder", "Effects Wonder", "effects-stage", "wonder", 0.9, "showcase"],
  ["environment-grounded", "Environment Grounded", "environment-kit", "grounded", 0.66, "balanced"],
  ["structures-industrial", "Structures Industrial", "structures-props", "grounded", 0.72, "balanced"],
  ["vehicle-dramatic", "Vehicle Dramatic", "vehicle-action", "dramatic", 0.8, "showcase"],
  ["loot-luxurious", "Loot Luxurious", "loot-combat", "luxurious", 0.76, "showcase"],
  ["rpg-wonder", "RPG Wonder", "rpg-adventure", "wonder", 0.86, "showcase"],
  ["strategy-balanced", "Strategy Balanced", "strategy-sim", "balanced", 0.58, "balanced"],
  ["party-playful", "Party Playful", "party-game", "playful", 0.84, "balanced"],
  ["platformer-dramatic", "Platformer Dramatic", "platformer-action", "dramatic", 0.74, "balanced"],
  ["full-dramatic", "Full Dramatic", "full-presentation", "dramatic", 0.86, "showcase"],
  ["full-accessible", "Full Accessible", "full-presentation", "balanced", 0.48, "reduced-motion"]
];

async function main() {
  await mkdir(output, { recursive: true });
  const kits = [];
  for (const [id, name, moldId, mood, complexity, profile] of DEFINITIONS) {
    const intent = generateStyleIntent({
      seed: `axm-kit-${id}`,
      name,
      moldId,
      mood,
      complexity,
      sharing: { attribution: "Mike - Axiom/mir", remixAllowed: true }
    });
    const profiled = applyPerformanceProfile(
      compileStyleIntent(intent),
      profile
    );
    profiled.pack.integrity = await calculateSkinIntegrity(profiled.pack);
    const file = `${id}.axmskin.json`;
    await writeFile(join(output, file), `${stableStringify(profiled.pack, 2)}\n`);
    kits.push({
      id,
      name,
      moldId,
      mood,
      complexity,
      performanceProfile: profile,
      file: `examples/mold-kits/${file}`,
      sha256: profiled.pack.integrity.contentSha256
    });
  }

  const contracts = listSkinMolds().map((mold) => mold.id);
  for (const moldId of contracts) {
    const contract = createGameContractFromMold({
      moldId,
      gameId: `axm.template.${moldId}`,
      gameVersion: "0.6.0",
      rendererProfile: "engine-neutral"
    });
    await writeFile(
      join(output, `${moldId}.game-skin-contract.json`),
      `${stableStringify(contract, 2)}\n`
    );
  }

  await writeFile(
    join(root, "mold-kit-catalog.json"),
    `${stableStringify({
      type: "axm.mold-kit-catalog",
      version: "1.0",
      release: "0.6.0",
      count: kits.length,
      generatedBy: "scripts/build-molds.mjs",
      kits
    }, 2)}\n`
  );
  console.log(`Built ${kits.length} deterministic mold kits and ${contracts.length} contracts.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
