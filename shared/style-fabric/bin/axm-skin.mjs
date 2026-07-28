#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import process from "node:process";
import {
  HOSTED_POLICY_EXAMPLE,
  LOCAL_CREATOR_POLICY,
  admitSkinPack,
  applyTreatmentToPack,
  calculateSkinIntegrity,
  compileStyleIntent,
  forgeSkinMold,
  generateTreatmentDirections,
  resolveSkinForGame,
  stableStringify,
  validateGameSkinContract,
  validateSkinPack
} from "../src/index.mjs";

function usage() {
  console.log(`AXM Style Fabric CLI

Usage:
  axm-skin compile <intent.json> <output.axmskin.json>
  axm-skin validate <pack.axmskin.json> [--policy hosted]
  axm-skin resolve <pack.axmskin.json> <game-contract.json> [output.json]
  axm-skin inspect <pack.axmskin.json>
  axm-skin hash <pack.axmskin.json>
  axm-skin mold-forge <definition.json> <output.skin-mold.json>
  axm-skin treatment-directions <mold-id> <seed> <output.json> [--profile balanced]
  axm-skin treatment-apply <pack.axmskin.json> <directions.json> <index> <output.axmskin.json>

All commands are local and presentation-only.`);
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function writeJson(path, value) {
  await writeFile(path, `${stableStringify(value, 2)}\n`, "utf8");
}

function printReport(report) {
  console.log(
    stableStringify(
      {
        ok: report.ok,
        errors: report.errors,
        warnings: report.warnings,
        checks: report.checks,
        metrics: report.metrics
      },
      2
    )
  );
}

function optionValue(args, name, fallback = null) {
  const index = args.indexOf(name);
  return index >= 0 ? (args[index + 1] ?? fallback) : fallback;
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (!command || ["help", "--help", "-h"].includes(command)) {
    usage();
    return;
  }

  if (command === "compile") {
    if (args.length < 2) throw new Error("compile requires an intent path and output path.");
    const intent = await readJson(args[0]);
    const pack = compileStyleIntent(intent);
    const validation = validateSkinPack(pack);
    if (!validation.ok) {
      printReport(validation);
      process.exitCode = 1;
      return;
    }
    pack.integrity = await calculateSkinIntegrity(pack);
    const admission = await admitSkinPack(pack, {
      ...LOCAL_CREATOR_POLICY,
      requireIntegrity: true,
      allowUnsigned: false
    });
    if (!admission.ok) {
      printReport(admission);
      process.exitCode = 1;
      return;
    }
    await writeJson(args[1], pack);
    console.log(
      stableStringify(
        {
          status: "COMPILED",
          output: args[1],
          packId: pack.id,
          release: pack.release,
          contentSha256: pack.integrity.contentSha256
        },
        2
      )
    );
    return;
  }

  if (command === "validate") {
    if (!args[0]) throw new Error("validate requires a skin pack path.");
    const pack = await readJson(args[0]);
    const policy = args.includes("--policy") && args[args.indexOf("--policy") + 1] === "hosted"
      ? HOSTED_POLICY_EXAMPLE
      : LOCAL_CREATOR_POLICY;
    const admission = await admitSkinPack(pack, policy);
    printReport(admission);
    if (!admission.ok) process.exitCode = 1;
    return;
  }

  if (command === "resolve") {
    if (args.length < 2) throw new Error("resolve requires a skin pack and a game contract.");
    const pack = await readJson(args[0]);
    const contract = await readJson(args[1]);
    const contractReport = validateGameSkinContract(contract);
    if (!contractReport.ok) {
      printReport(contractReport);
      process.exitCode = 1;
      return;
    }
    const result = await resolveSkinForGame({ packs: [pack], gameContract: contract });
    if (args[2]) await writeJson(args[2], result);
    console.log(
      stableStringify(
        {
          ok: result.ok,
          status: result.status,
          compatibility: result.compatibility ?? null,
          summary: result.receipt?.summary ?? null,
          output: args[2] ?? null
        },
        2
      )
    );
    if (!result.ok) process.exitCode = 1;
    return;
  }

  if (command === "inspect") {
    if (!args[0]) throw new Error("inspect requires a skin pack path.");
    const pack = await readJson(args[0]);
    const admission = await admitSkinPack(pack);
    console.log(
      stableStringify(
        {
          id: pack.id,
          release: pack.release,
          name: pack.metadata?.name,
          status: pack.status,
          scopes: pack.scopes,
          capabilities: pack.capabilities,
          materialCount: Object.keys(pack.materials ?? {}).length,
          bindingCount: pack.bindings?.length ?? 0,
          assetCount: Object.keys(pack.assets ?? {}).length,
          admission: admission.status,
          integrity: admission.integrity.status,
          errors: admission.errors
        },
        2
      )
    );
    if (!admission.ok) process.exitCode = 1;
    return;
  }

  if (command === "hash") {
    if (!args[0]) throw new Error("hash requires a skin pack path.");
    const pack = await readJson(args[0]);
    const admission = await admitSkinPack(pack);
    if (!admission.ok) {
      printReport(admission);
      process.exitCode = 1;
      return;
    }
    const integrity = await calculateSkinIntegrity(pack);
    console.log(integrity.contentSha256);
    return;
  }

  if (command === "mold-forge") {
    if (args.length < 2) {
      throw new Error("mold-forge requires a definition path and output path.");
    }
    const definition = await readJson(args[0]);
    const forged = forgeSkinMold(definition);
    await writeJson(args[1], forged.mold);
    console.log(
      stableStringify(
        {
          status: "DRAFT_REVIEW_REQUIRED",
          output: args[1],
          moldId: forged.mold.id,
          slots: forged.mold.slots.length,
          receipt: forged.receipt
        },
        2
      )
    );
    return;
  }

  if (command === "treatment-directions") {
    if (args.length < 3) {
      throw new Error(
        "treatment-directions requires a mold ID, seed, and output path."
      );
    }
    const generated = generateTreatmentDirections(args[0], {
      seed: args[1],
      profile: optionValue(args, "--profile", "balanced")
    });
    await writeJson(args[2], generated);
    console.log(
      stableStringify(
        {
          status: "THREE_DRAFTS_FOR_REVIEW",
          output: args[2],
          moldId: generated.receipt.moldId,
          count: generated.receipt.count,
          automaticWrites: generated.receipt.automaticWrites
        },
        2
      )
    );
    return;
  }

  if (command === "treatment-apply") {
    if (args.length < 4) {
      throw new Error(
        "treatment-apply requires a pack, directions file, direction index, and output path."
      );
    }
    const pack = await readJson(args[0]);
    const inputAdmission = await admitSkinPack(pack);
    if (!inputAdmission.ok) {
      printReport(inputAdmission);
      process.exitCode = 1;
      return;
    }
    const generated = await readJson(args[1]);
    const directionIndex = Number.parseInt(args[2], 10);
    const treatment = generated?.directions?.[directionIndex];
    if (!treatment || ![0, 1, 2].includes(directionIndex)) {
      throw new Error("Direction index must be 0, 1, or 2.");
    }
    const applied = applyTreatmentToPack(pack, treatment);
    if (!applied.receipt.applied.length) {
      throw new Error("Selected treatment has no bindings in this pack.");
    }
    applied.pack.integrity = await calculateSkinIntegrity(applied.pack);
    const outputAdmission = await admitSkinPack(applied.pack, {
      ...LOCAL_CREATOR_POLICY,
      requireIntegrity: true,
      allowUnsigned: false
    });
    if (!outputAdmission.ok) {
      printReport(outputAdmission);
      process.exitCode = 1;
      return;
    }
    await writeJson(args[3], applied.pack);
    console.log(
      stableStringify(
        {
          status: "TREATMENT_APPLIED",
          output: args[3],
          treatmentId: treatment.id,
          appliedTargets: applied.receipt.applied.length,
          skippedTargets: applied.receipt.skipped.length,
          contentSha256: applied.pack.integrity.contentSha256,
          receipt: applied.receipt
        },
        2
      )
    );
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

main().catch((error) => {
  console.error(`BLOCKED: ${error.message}`);
  process.exitCode = 1;
});
