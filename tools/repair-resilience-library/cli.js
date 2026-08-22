#!/usr/bin/env node
"use strict";

const Library = require("./library");

function usage() {
  process.stdout.write([
    "Repair & Resilience Library",
    "",
    "  node cli.js list",
    "  node cli.js search <words>",
    "  node cli.js show <component-id-or-slug>",
    "  node cli.js test <component-id-or-slug>",
    "  node cli.js test-all",
    "",
    "This CLI does not install, execute repairs, promote, publish, or change CANON."
  ].join("\n") + "\n");
}

const [command, ...rest] = process.argv.slice(2);
try {
  if (!command || command === "help" || command === "--help") usage();
  else if (command === "list") console.log(JSON.stringify(Library.catalog(), null, 2));
  else if (command === "search") console.log(JSON.stringify(Library.search(rest.join(" ")), null, 2));
  else if (command === "show") console.log(JSON.stringify(Library.inspectComponent(rest[0]), null, 2));
  else if (command === "test") {
    const result = Library.runSelftest(rest[0]);
    console.log(JSON.stringify(result, null, 2));
    if (!result.pass) process.exitCode = 1;
  } else if (command === "test-all") {
    const result = Library.runAllSelftests();
    console.log(JSON.stringify(result, null, 2));
    if (result.failed) process.exitCode = 1;
  } else {
    usage();
    process.exitCode = 2;
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 2;
}
