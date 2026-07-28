#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import process from "node:process";
import {
  HOSTED_POLICY_EXAMPLE,
  LOCAL_CREATOR_POLICY,
  calculateSkinIntegrity,
  compileStyleIntent,
  resolveSkinForGame,
  stableStringify,
  validateGameSkinContract,
  validateSkinPack,
  verifyEmbeddedAssets,
  verifySkinIntegrity
} from "../src/index.mjs";

function usage() {
  console.log(`AXM Style Fabric CLI

Usage:
  axm-skin compile <intent.json> <output.axmskin.json>
  axm-skin validate <pack.axmskin.json> [--policy hosted]
  axm-skin resolve <pack.axmskin.json> <game-contract.json> [output.json]
  axm-skin inspect <pack.axmskin.json>
  axm-skin hash <pack.axmskin.json>

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
    const report = validateSkinPack(pack, policy);
    const assets = await verifyEmbeddedAssets(pack, policy);
    const integrity = await verifySkinIntegrity(pack);
    printReport({
      ...report,
      ok: report.ok && assets.ok,
      errors: [...report.errors, ...assets.errors],
      warnings: [...report.warnings, ...assets.warnings, { code: integrity.status, ...integrity }],
      checks: [...report.checks, ...assets.checks],
      metrics: { ...report.metrics, ...assets.metrics }
    });
    if (!report.ok || !assets.ok || (pack.integrity && !integrity.ok)) process.exitCode = 1;
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
    const validation = validateSkinPack(pack);
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
          validation: validation.ok ? "STRUCTURE_VALIDATED" : "REJECTED",
          errors: validation.errors
        },
        2
      )
    );
    if (!validation.ok) process.exitCode = 1;
    return;
  }

  if (command === "hash") {
    if (!args[0]) throw new Error("hash requires a skin pack path.");
    const pack = await readJson(args[0]);
    const integrity = await calculateSkinIntegrity(pack);
    console.log(integrity.contentSha256);
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

main().catch((error) => {
  console.error(`BLOCKED: ${error.message}`);
  process.exitCode = 1;
});
