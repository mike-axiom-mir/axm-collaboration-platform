import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  PRESKINS,
  applyPreskin,
  calculateSkinIntegrity,
  compileStyleIntent,
  stableStringify
} from "../src/index.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const outputDirectory = join(root, "examples", "preskins");
await mkdir(outputDirectory, { recursive: true });

const catalog = {
  type: "axm.preskin-catalog",
  version: "1.0",
  release: "0.5.0",
  status: "WORKING_TEST",
  count: PRESKINS.length,
  presets: []
};

for (const preset of PRESKINS) {
  const intent = applyPreskin(
    {
      seed: `axm-preskin:${preset.id}`,
      scope: ["global", "character.player"],
      sharing: {
        license: "LicenseRef-AXM-Preskin-Test",
        remixAllowed: true,
        attribution: "Mike - Axiom/mir"
      }
    },
    preset.id
  );
  const pack = compileStyleIntent(intent);
  pack.integrity = await calculateSkinIntegrity(pack);
  const filename = `${preset.id}.axmskin.json`;
  await writeFile(join(outputDirectory, filename), `${stableStringify(pack, 2)}\n`, "utf8");
  catalog.presets.push({
    id: preset.id,
    name: preset.name,
    family: preset.family,
    tagline: preset.tagline,
    swatches: preset.swatches,
    file: `examples/preskins/${filename}`,
    packId: pack.id,
    integrity: pack.integrity.contentSha256
  });
}

await writeFile(
  join(root, "preskin-catalog.json"),
  `${stableStringify(catalog, 2)}\n`,
  "utf8"
);

console.log(`Built ${PRESKINS.length} deterministic preskin packs.`);
