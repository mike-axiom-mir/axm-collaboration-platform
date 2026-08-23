#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const Receipts = require("../shared/growth/scope-transition-receipts");

function option(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

const planFile = option("--plan");
const confirmed = process.argv.includes("--confirm-local-reviewed-intake-archive");
if (!planFile || !confirmed) {
  console.error("Usage: node scripts/archive-workshop-intakes.js --plan <reviewed-plan.json> --confirm-local-reviewed-intake-archive");
  process.exit(2);
}
const resolvedPlan = path.resolve(planFile);
const plan = JSON.parse(fs.readFileSync(resolvedPlan, "utf8"));
const result = Receipts.moveVerifiedIntakes({
  plan,
  confirm: "explicit-local-reviewed-intake-archive",
});
console.log(JSON.stringify({ state: "PASS", moved: result.moved, archiveRoot: plan.archiveRoot, deletionPerformed: false }, null, 2));
