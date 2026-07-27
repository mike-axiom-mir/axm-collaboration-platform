(function (root, factory) {
  var api = factory(
    typeof module === "object" && module.exports ? require("./game-organism") : root.AXMGameOrganism
  );
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.AXMGameOrganismExamples = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (GameOrganism) {
  "use strict";

  function port(id, type, required, multiple) {
    return { id: id, type: type, required: required !== false, multiple: multiple === true };
  }
  function organ(id, category, title, inputs, outputs, provides, requires, implementation, budget, judgments) {
    return GameOrganism.sealOrgan({
      id: id,
      version: "0.1.0",
      category: category,
      title: title,
      description: "Experimental " + category + " organ for a bounded street-scene game candidate.",
      ports: { inputs: inputs, outputs: outputs },
      capabilities: { provides: provides, requires: requires },
      resource_budget: budget || { cpu_weight: 1, gpu_weight: 0, peak_memory_mb: 8, working_storage_mb: 4 },
      verification: {
        automatic_checks: ["schema-and-port-contract", "deterministic-receipt"],
        human_judgments: judgments || [],
        assurance_ceiling: "candidate-assembly-only"
      },
      implementation: implementation
    });
  }

  function createStreetLifeExample() {
    var available = function (reference) { return { kind: "existing-runtime-reference", reference: reference, status: "AVAILABLE" }; };
    var declared = function (reference) { return { kind: "declared-machine", reference: reference, status: "DECLARED" }; };
    var human = function (reference) { return { kind: "human-gate", reference: reference, status: "AVAILABLE" }; };
    var organs = [
      organ("axm.game.intent.street-life", "intent", "Street-life intent", [], [port("concept", "game.intent/v1")], ["game.intent"], [], available("shared/direction")),
      organ("axm.game.design.street-life", "design", "Playable design", [port("intent", "game.intent/v1")], [port("design", "game.design/v1")], ["game.design"], ["game.intent"], available("tools/game-forge"), null, ["is-this-worth-playing"]),
      organ("axm.game.rules.street-life", "world-rules", "World and rules", [port("design", "game.design/v1")], [port("rules", "game.rules/v1")], ["game.rules"], ["game.design"], available("tools/game-forge/event-graph")),
      organ("axm.game.physics.street-life", "physics", "Local street physics", [port("rules", "game.rules/v1")], [port("motion", "game.motion-state/v1")], ["game.motion"], ["game.rules"], available("shared/physics"), { cpu_weight: 3, gpu_weight: 0, peak_memory_mb: 24, working_storage_mb: 8 }),
      organ("axm.game.animation.street-life", "animation", "Character motion", [port("motion", "game.motion-state/v1")], [port("animation", "game.animation-state/v1")], ["game.animation"], ["game.motion"], available("shared/game-animation-foundation"), { cpu_weight: 2, gpu_weight: 1, peak_memory_mb: 32, working_storage_mb: 12 }),
      organ("axm.game.asset.street-life", "asset", "Street visual vocabulary", [port("design", "game.design/v1")], [port("assets", "game.asset-set/v1")], ["game.assets"], ["game.design"], available("shared/asset-hands"), { cpu_weight: 1, gpu_weight: 1, peak_memory_mb: 48, working_storage_mb: 32 }, ["visual-coherence"]),
      organ("axm.game.assembly.street-life", "assembly", "Candidate assembler", [port("rules", "game.rules/v1"), port("animation", "game.animation-state/v1"), port("assets", "game.asset-set/v1")], [port("build", "game.candidate-build/v1")], ["game.candidate-build"], ["game.rules", "game.animation", "game.assets"], available("tools/game-forge/package-service"), { cpu_weight: 2, gpu_weight: 1, peak_memory_mb: 32, working_storage_mb: 64 }),
      organ("axm.game.eye.street-life", "playtest-eye", "Playtest Eye", [port("build", "game.candidate-build/v1")], [port("observations", "game.playtest-observations/v1")], ["game.playtest-observations"], ["game.candidate-build"], available("shared/sensorium"), { cpu_weight: 1, gpu_weight: 1, peak_memory_mb: 16, working_storage_mb: 4 }, ["appearance-and-feel"]),
      organ("axm.game.evidence.street-life", "evidence", "Evidence router", [port("observations", "game.playtest-observations/v1")], [port("receipt", "axm.verification-receipt/v2")], ["game.evidence"], ["game.playtest-observations"], available("shared/verification-spine")),
      organ("axm.game.repair.street-life", "repair", "Bounded repair proposer", [port("evidence", "axm.verification-receipt/v2")], [port("proposal", "game.repair-proposal/v1")], ["game.repair-proposal"], ["game.evidence"], declared("shared/repair-buddy:known-recipes-only")),
      organ("axm.game.release.street-life", "release-gate", "Human release gate", [port("build", "game.candidate-build/v1"), port("evidence", "axm.verification-receipt/v2"), port("repair", "game.repair-proposal/v1")], [port("candidate", "game.review-candidate/v1")], ["game.review-candidate"], ["game.candidate-build", "game.evidence", "game.repair-proposal"], human("human-steward-review"), null, ["fun", "taste", "release-approval"])
    ];
    var references = organs.map(function (item, index) {
      return { instance_id: "organ-" + String(index + 1).padStart(2, "0"), slot_category: item.category, organ_id: item.id, organ_version: item.version, organ_digest: item.digest };
    });
    var byCategory = {};
    references.forEach(function (reference) { byCategory[reference.slot_category] = reference.instance_id; });
    function link(fromCategory, fromPort, toCategory, toPort) {
      return { from: { instance_id: byCategory[fromCategory], port: fromPort }, to: { instance_id: byCategory[toCategory], port: toPort } };
    }
    var blueprint = GameOrganism.sealBlueprint({
      id: "axm.game-organism.street-life-slice",
      version: "0.1.0",
      title: "Street Life Slice",
      intent: "One small, responsive street scene where movement, people and atmosphere feel alive.",
      organs: references,
      connections: [
        link("intent", "concept", "design", "intent"),
        link("design", "design", "world-rules", "design"),
        link("world-rules", "rules", "physics", "rules"),
        link("physics", "motion", "animation", "motion"),
        link("design", "design", "asset", "design"),
        link("world-rules", "rules", "assembly", "rules"),
        link("animation", "animation", "assembly", "animation"),
        link("asset", "assets", "assembly", "assets"),
        link("assembly", "build", "playtest-eye", "build"),
        link("playtest-eye", "observations", "evidence", "observations"),
        link("evidence", "receipt", "repair", "evidence"),
        link("assembly", "build", "release-gate", "build"),
        link("evidence", "receipt", "release-gate", "evidence"),
        link("repair", "proposal", "release-gate", "repair")
      ],
      required_categories: GameOrganism.CATEGORIES,
      resource_budget: { cpu_weight: 24, gpu_weight: 12, peak_memory_mb: 512, working_storage_mb: 512 }
    });
    return { organs: organs, registry: GameOrganism.createRegistry(organs), blueprint: blueprint };
  }

  return { createStreetLifeExample: createStreetLifeExample };
});
