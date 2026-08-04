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
  assert(M.TEMPLATES.length === 7, "Expected seven starter templates.");

  const project = M.getTemplate("young-ai-workshop").build();
  const initialValidation = M.validateProject(project);
  assert(initialValidation.errors === 0 && initialValidation.warnings === 0, "Young AI starter should begin clean.");

  const workspace = M.generateAgentWorkspace(project, project.layers.logic.nodes[0].id);
  assert(workspace.schema === "axm.agent.workspace", "Workspace schema is missing.");
  assert(workspace.seat.authority === "PROPOSE_ONLY" && workspace.seat.mayApply === false, "Agent seat gained apply authority.");
  assert(workspace.blockCatalog.length === 77, "Expected 77 catalog blocks.");
  assert(workspace.actionProtocol.verbs.length === 17, "Expected seventeen bounded proposal verbs.");
  assert(Array.isArray(workspace.observation.recentLedger) && workspace.observation.recentLedger.length > 0, "Workspace should expose a bounded visible source timeline.");

  const existingLogicStart = project.layers.logic.nodes[0].id;
  const existingLogicEdge = project.layers.logic.edges[0].id;
  const existingBinding = project.bindings[0].id;
  const proposal = M.agentProposalTemplate(project);
  proposal.proposalId = "proposal-all-bounded-verbs";
  proposal.title = "Exercise the bounded young AI protocol";
  proposal.summary = "Dry-run every declared change family without granting authority.";
  proposal.assumptions = ["The human will inspect every identifier and reason before apply."];
  proposal.tests = ["Run diagnostics.", "Confirm the added capability remains unapproved.", "Undo the full proposal as one unit in the app."];
  proposal.unresolvedRisks = ["Removing one existing route and binding may alter the workshop story."];
  proposal.actions = [
    { id: "project-copy", verb: "set_project", why: "Make the candidate identity visibly distinct.", fields: { name: "Young AI protocol proof", accent: "#b977ff" } },
    { id: "goal-proof", verb: "set_goal", why: "Keep the human outcome and review state explicit.", fields: { statement: "Prove a young AI can draft bounded builder actions under human control.", status: "READY FOR REVIEW" } },
    { id: "add-logic", verb: "add_node", why: "Add one inspectable action to the logic path.", alias: "candidateAction", layer: "logic", type: "action", label: "Prepare candidate summary", x: 1180, y: 610, enabled: true, config: { action: "Summarize the bounded change for human review" } },
    { id: "update-logic", verb: "update_node", why: "Clarify the candidate action without replacing the block.", node: "@candidateAction", label: "Prepare human-readable candidate summary", summary: "Explains exactly what the proposal would change.", config: { action: "List changed source, reason, test and unresolved risk" } },
    { id: "move-logic", verb: "move_node", why: "Keep the added block readable on the canvas.", node: "@candidateAction", x: 1120, y: 590 },
    { id: "connect-logic", verb: "connect", why: "Attach the candidate summary to an existing source event.", layer: "logic", from: existingLogicStart, to: "@candidateAction", label: "draft candidate" },
    { id: "remove-old-edge", verb: "remove_edge", why: "Demonstrate that route removal is named and reviewable.", layer: "logic", edgeId: existingLogicEdge },
    { id: "add-storage", verb: "add_node", why: "Prove a proposed capability cannot inherit consent.", alias: "candidateStorage", layer: "capabilities", type: "local-storage", label: "Candidate local notes", x: 1310, y: 590, config: { namespace: "young-ai-candidate", autosave: false } },
    { id: "add-visual", verb: "add_node", why: "Give the human a visible place to read the candidate summary.", alias: "candidateText", layer: "visual", type: "text", label: "Candidate summary text", x: 1320, y: 690, config: { text: "Candidate change awaits human review." } },
    { id: "bind-summary", verb: "bind", why: "Make the logic-to-visual relationship explicit.", source: "@candidateAction", target: "@candidateText", purpose: "renders review summary" },
    { id: "remove-old-binding", verb: "remove_binding", why: "Demonstrate named cross-layer contract removal under review.", bindingId: existingBinding },
    { id: "add-state", verb: "set_state", why: "Declare one readable shared review state.", key: "youngAiReviewStatus", valueType: "string", default: "candidate" },
    { id: "add-rule", verb: "add_invariant", why: "Protect the human apply boundary in future changes.", text: "Young AI output remains a proposal until a human accepts it through a visible review gate." }
  ];

  const review = M.validateAgentProposal(proposal, project);
  assert(review.valid, "Full bounded proposal should validate: " + review.errors.join(" "));
  assert(review.changes.length === proposal.actions.length, "Every action should appear in the dry-run change list.");
  assert(review.impact.delta.nodes === 3, "Expected three added blocks.");
  assert(review.impact.delta.edges === 0, "One route addition and one route removal should net to zero.");
  assert(review.impact.delta.bindings === 0, "One binding addition and one removal should net to zero.");
  assert(review.impact.delta.stateKeys === 1 && review.impact.delta.invariants === 1, "Expected one state key and one invariant.");
  const dryRunStorage = review.previewProject.layers.capabilities.nodes.find((node) => node.label === "Candidate local notes");
  assert(dryRunStorage && dryRunStorage.permission && dryRunStorage.permission.approved === false, "Proposed capability permission must start unapproved.");

  const applied = M.applyAgentProposal(project, proposal);
  assert(applied.valid && applied.project, "Validated proposal should produce a candidate project.");
  assert(applied.project.spine.collaboration.reviewLog.length === 1, "Apply should create one human review receipt.");
  assert(applied.project.spine.collaboration.reviewLog[0].decision === "HUMAN_APPROVED", "Review receipt decision is missing.");

  const stale = M.agentProposalTemplate(project);
  stale.proposalId = "proposal-stale";
  stale.title = "Stale source proof";
  stale.actions = [{ id: "rule", verb: "add_invariant", why: "Test stale-source blocking.", text: "This should never apply from a stale source." }];
  project.meta.updatedAt = "2099-01-01T00:00:00.000Z";
  const staleReview = M.validateAgentProposal(stale, project);
  assert(!staleReview.valid && staleReview.errors.some((error) => error.includes("stale")), "Stale proposal was not blocked.");

  const forbidden = M.agentProposalTemplate(project);
  forbidden.source.projectUpdatedAt = project.meta.updatedAt;
  forbidden.proposalId = "proposal-forbidden";
  forbidden.title = "Forbidden authority proof";
  forbidden.actions = [{ id: "permission", verb: "grant_permission", why: "Attempt forbidden authority." }];
  const forbiddenReview = M.validateAgentProposal(forbidden, project);
  assert(!forbiddenReview.valid && forbiddenReview.errors.some((error) => error.includes("forbidden or unknown verb")), "Forbidden authority was not rejected.");

  const emptyLabel = M.agentProposalTemplate(project);
  emptyLabel.source.projectUpdatedAt = project.meta.updatedAt;
  emptyLabel.proposalId = "proposal-empty-label";
  emptyLabel.title = "Empty label proof";
  emptyLabel.actions = [{ id: "empty", verb: "update_node", why: "Test label integrity.", node: project.layers.logic.nodes[0].id, label: "   " }];
  const emptyLabelReview = M.validateAgentProposal(emptyLabel, project);
  assert(!emptyLabelReview.valid && emptyLabelReview.errors.some((error) => error.includes("label must contain")), "Empty node labels should be rejected.");

  const badConfig = M.agentProposalTemplate(project);
  badConfig.source.projectUpdatedAt = project.meta.updatedAt;
  badConfig.proposalId = "proposal-bad-config";
  badConfig.title = "Config type proof";
  badConfig.actions = [{ id: "bad-config", verb: "add_node", why: "Test typed config validation.", alias: "badStorage", layer: "capabilities", type: "local-storage", x: 100, y: 100, enabled: "yes", config: { autosave: "yes" } }];
  const badConfigReview = M.validateAgentProposal(badConfig, project);
  assert(!badConfigReview.valid && badConfigReview.errors.some((error) => error.includes("autosave") || error.includes("enabled")), "Bad typed values should be rejected.");

  console.log("PASS model agent protocol");
  console.log(JSON.stringify({ version: M.APP_VERSION, templates: M.TEMPLATES.length, catalogBlocks: workspace.blockCatalog.length, verbs: workspace.actionProtocol.verbs.length, legalActions: proposal.actions.length }, null, 2));
})();
