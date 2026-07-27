"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function loadModel() {
  const context = {
    window: {},
    console,
    Date,
    Math,
    JSON,
    Map,
    Set,
    Object,
    Array,
    String,
    Number,
    Boolean,
    RegExp,
    Error
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "model.js"), "utf8"), context, { filename: "model.js" });
  return context.window.AXMBuilderModel;
}

(function run() {
  const M = loadModel();
  assert(/^0\.13\.\d+-beta$/.test(M.APP_VERSION), "Expected a compatible v0.13 beta model.");
  assert(M.INFLUENCE_SCHEMA_VERSION === 1, "Influence schema version is missing.");
  assert(M.MAX_INFLUENCE_RULES === 24 && M.MAX_CODE_HOOKS === 8, "Influence safety limits changed unexpectedly.");

  const characterProfile = M.getInfluenceProfile("visual", "npc");
  assert(characterProfile.id === "character", "NPC should use the character module.");
  assert(characterProfile.triggers.some((item) => item.id === "player_nearby"), "Character module is missing the nearby moment.");
  assert(characterProfile.actions.some((item) => item.id === "say_message"), "Character module is missing the visible message response.");
  assert(characterProfile.visualStates.length === 5, "Character module should advertise five beginner visual slots.");
  assert(M.getInfluenceProfile("visual", "button").id === "interface", "Button should use the interface module.");
  assert(M.getInfluenceProfile("visual", "world-object").id === "world-object", "World object should use the world-object module.");
  assert(M.getInfluenceProfile("logic", "condition").id === "logic-flow", "Logic block should use the logic-flow module.");
  assert(M.getInfluenceProfile("capabilities", "local-storage").id === "capability", "Capability block should use the capability module.");

  const project = M.getTemplate("cartoon-world").build();
  const validation = M.validateProject(project);
  assert(validation.errors === 0 && validation.warnings === 0, "Cartoon World should begin clean: " + JSON.stringify(validation));

  const player = project.layers.visual.nodes.find((node) => node.type === "player-sprite");
  const npc = project.layers.visual.nodes.find((node) => node.type === "npc");
  const worldObject = project.layers.visual.nodes.find((node) => node.type === "world-object");
  assert(player && npc && worldObject, "Cartoon World is missing a player, person or world object.");
  assert(npc.influence.moduleId === "character", "Placed person did not receive its module-owned influence contract.");
  assert(npc.influence.rules.length === 4, "Luma should demonstrate four guided reactions.");
  assert(Object.keys(npc.influence.visualStates).includes("talking"), "Luma should demonstrate a talking visual state.");
  assert(Number(player.config.movementSpeed) === 2.2, "Player should demonstrate an instance movement-speed setting.");

  const beforePreview = JSON.stringify(npc);
  const preview = M.simulateInfluence(npc, "player_nearby");
  assert(preview.matched === 2, "Nearby preview should explain both Luma reactions.");
  assert(preview.steps.some((step) => step.action === "say_message"), "Preview omitted Luma's visible greeting.");
  assert(preview.steps.some((step) => step.action === "change_visual_state"), "Preview omitted Luma's talking state.");
  assert(JSON.stringify(npc) === beforePreview, "Safe preview changed source.");
  assert(preview.disclosure.includes("does not execute code"), "Preview disclosure is not honest about execution.");

  const assetRequest = M.generateBlockAssetRequest(project, npc.id);
  assert(assetRequest.schema === "axm.asset.block-request", "Asset request schema is missing.");
  assert(assetRequest.authority === "PROPOSE_ASSETS_ONLY", "Asset request gained apply authority.");
  assert(assetRequest.source.blockId === npc.id, "Asset request lost the exact placed-block identity.");
  assert(assetRequest.states.length === 5, "Asset request should expose every character visual slot.");
  assert(assetRequest.disclosure.includes("does not generate"), "Asset request disclosure overstates what exists.");

  const legacy = M.clone(project);
  Object.values(legacy.layers).forEach((layer) => layer.nodes.forEach((node) => { delete node.influence; }));
  const normalizedLegacy = M.normalizeProject(legacy, { recordImport: false });
  const normalizedNodes = Object.values(normalizedLegacy.layers).flatMap((layer) => layer.nodes);
  assert(normalizedNodes.every((node) => node.influence && node.influence.schemaVersion === 1), "Legacy nodes were not safely backfilled.");
  assert(normalizedNodes.find((node) => node.type === "npc").influence.moduleId === "character", "Legacy NPC received the wrong module.");

  const existingCompletion = npc.influence.rules.find((rule) => rule.trigger === "task_completed" && rule.action === "say_message");
  const existingTalking = npc.influence.rules.find((rule) => rule.trigger === "player_nearby" && rule.action === "change_visual_state");
  assert(existingCompletion && existingTalking, "Template reaction fixtures are missing.");

  const proposal = M.agentProposalTemplate(project);
  proposal.proposalId = "proposal-per-block-influence";
  proposal.title = "Shape Luma without changing every character";
  proposal.summary = "Exercise the beginner reaction, visual-state and transparent-code contracts on one exact placed person.";
  proposal.assumptions = ["The human will inspect the exact block and every visible change before apply."];
  proposal.tests = ["Preview the new interaction reaction.", "Confirm the code draft remains disabled.", "Generate the local game candidate and test Luma's nearby message."];
  proposal.unresolvedRisks = ["Only a bounded subset of guided actions is consumed by the standalone beta runtime."];
  proposal.actions = [
    { id: "add-interaction", verb: "add_influence_rule", why: "Give this exact Luma instance an understandable click or tap response.", node: npc.id, trigger: "human_activates", action: "say_message", value: "I can explain the grove one step at a time.", note: "Do not complete the task for the player.", enabled: true },
    { id: "update-completion", verb: "update_influence_rule", why: "Make the success response warmer while preserving the same named reaction.", node: npc.id, ruleId: existingCompletion.id, value: "You restored the grove yourself. I only helped you see the path." },
    { id: "remove-talking", verb: "remove_influence_rule", why: "Demonstrate that removal is named and reviewable rather than hidden.", node: npc.id, ruleId: existingTalking.id },
    { id: "listening-state", verb: "set_visual_state", why: "Prepare one layered asset slot for a later asset generator.", node: npc.id, state: "listening", assetRef: "assets/luma-listening.png", color: "#ff9889", notes: "Keep Luma's face, clothing and warm guide identity consistent." },
    { id: "code-draft", verb: "set_code_hook", why: "Store an advanced idea transparently without executing it.", node: npc.id, hook: "onApproach", label: "Offer a bounded hint", language: "JavaScript", code: "// TEST_SENTINEL_MUST_NOT_EXECUTE\nreturn { proposal: 'offer-visible-hint' };" }
  ];

  const review = M.validateAgentProposal(proposal, project);
  assert(review.valid, "Influence proposal should validate: " + review.errors.join(" "));
  assert(review.changes.length === proposal.actions.length, "Every influence action should appear in the change list.");
  assert(review.impact.delta.influenceRules === 0, "One reaction addition and one removal should net to zero.");
  assert(review.impact.delta.visualStates === 1, "Expected one newly configured visual state.");
  assert(review.impact.delta.codeHooks === 1, "Expected one transparent code draft.");
  assert(review.warnings.some((warning) => warning.includes("does not execute")), "Code draft boundary warning is missing.");

  const candidateNpc = review.previewProject.layers.visual.nodes.find((node) => node.id === npc.id);
  assert(candidateNpc.influence.rules.some((rule) => rule.trigger === "human_activates" && rule.value.includes("one step")), "New guided reaction was not staged.");
  assert(!candidateNpc.influence.rules.some((rule) => rule.id === existingTalking.id), "Named reaction removal was not staged.");
  assert(candidateNpc.influence.visualStates.listening.assetRef === "assets/luma-listening.png", "Visual-state asset reference was not staged.");
  assert(candidateNpc.influence.codeHooks.length === 1, "Code draft was not staged.");
  assert(candidateNpc.influence.codeHooks[0].execution === "CONTRACT_ONLY" && candidateNpc.influence.codeHooks[0].enabled === false, "Code draft gained execution authority.");

  const applied = M.applyAgentProposal(project, proposal);
  assert(applied.valid && applied.project, "Reviewed influence proposal did not produce a candidate project.");
  const appliedNpc = applied.project.layers.visual.nodes.find((node) => node.id === npc.id);
  const hookId = appliedNpc.influence.codeHooks[0].id;
  assert(applied.project.spine.collaboration.reviewLog.length === 1, "Human review receipt was not recorded.");

  const removeHook = M.agentProposalTemplate(applied.project);
  removeHook.proposalId = "proposal-remove-transparent-hook";
  removeHook.title = "Remove the transparent draft";
  removeHook.actions = [{ id: "remove-hook", verb: "remove_code_hook", why: "Prove a named draft can be removed without touching other block settings.", node: npc.id, hookId }];
  const removeReview = M.validateAgentProposal(removeHook, applied.project);
  assert(removeReview.valid, "Named code-draft removal should validate: " + removeReview.errors.join(" "));
  assert(removeReview.impact.delta.codeHooks === -1, "Code-draft removal impact is wrong.");

  const badTrigger = M.agentProposalTemplate(project);
  badTrigger.proposalId = "proposal-bad-influence-trigger";
  badTrigger.title = "Reject an unknown moment";
  badTrigger.actions = [{ id: "bad-trigger", verb: "add_influence_rule", why: "Test module validation.", node: npc.id, trigger: "secret_background_event", action: "say_message", value: "Hidden" }];
  const badTriggerReview = M.validateAgentProposal(badTrigger, project);
  assert(!badTriggerReview.valid && badTriggerReview.errors.some((error) => error.includes("trigger is not offered")), "Unknown module trigger was not rejected.");

  const enableCode = M.agentProposalTemplate(project);
  enableCode.proposalId = "proposal-enable-code";
  enableCode.title = "Reject executable hook authority";
  enableCode.actions = [{ id: "enable-code", verb: "set_code_hook", why: "Test the execution boundary.", node: npc.id, hook: "onApproach", label: "Unsafe request", language: "JavaScript", code: "return true;", enabled: true, execution: "ACTIVE" }];
  const enableCodeReview = M.validateAgentProposal(enableCode, project);
  assert(!enableCodeReview.valid && enableCodeReview.errors.some((error) => error.includes("cannot enable") || error.includes("CONTRACT_ONLY")), "Executable hook request was not blocked.");

  const website = M.getTemplate("website").build();
  const websiteHtml = M.generateStandaloneHTML(website);
  assert(websiteHtml.includes("The next step is visible. Nothing was sent anywhere."), "Website build did not consume the structured button message.");
  assert(websiteHtml.includes("Opened"), "Website build did not consume the structured label reaction.");

  const candidateHtml = M.generateStandaloneHTML(applied.project);
  assert(candidateHtml.includes("Welcome, Milo. Five star seeds will relight the grove."), "Game build did not consume Luma's nearby structured message.");
  assert(candidateHtml.includes("You restored the grove yourself. I only helped you see the path."), "Game build did not consume the reviewed completion response.");
  assert(candidateHtml.includes("moveSpeed=184.8"), "Game build did not consume the placed player's movement-speed setting.");
  assert(!candidateHtml.includes("TEST_SENTINEL_MUST_NOT_EXECUTE"), "Contract-only code leaked into executable standalone output.");

  console.log("PASS model per-block influence system");
  console.log(JSON.stringify({
    version: M.APP_VERSION,
    modules: Object.keys(M.INFLUENCE_MODULES).length,
    npcReactions: npc.influence.rules.length,
    proposalActions: proposal.actions.length,
    assetStates: assetRequest.states.length,
    codeExecution: candidateNpc.influence.codeHooks[0].execution
  }, null, 2));
})();
