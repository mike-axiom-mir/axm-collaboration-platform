"use strict";

const { chromium } = require("playwright");
const { spawn } = require("node:child_process");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const BASE = "http://127.0.0.1:4173";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(BASE + "/index.html");
      if (response.ok) return;
    } catch (_) { /* Server may still be starting. */ }
    await new Promise(function (resolve) { setTimeout(resolve, 150); });
  }
  throw new Error("Local test server did not start.");
}

(async function run() {
  const server = spawn("python3", ["-m", "http.server", "4173", "--bind", "127.0.0.1"], {
    cwd: ROOT,
    stdio: "ignore"
  });
  let browser;
  const browserErrors = [];
  try {
    await waitForServer();
    const launchOptions = { headless: true };
    if (process.env.AXM_CHROMIUM_PATH) {
      launchOptions.executablePath = process.env.AXM_CHROMIUM_PATH;
      launchOptions.args = ["--no-sandbox", "--disable-dev-shm-usage"];
    }
    browser = await chromium.launch(launchOptions);
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
    const page = await context.newPage();
    const externalRequests = [];
    page.on("pageerror", function (error) { browserErrors.push("pageerror: " + error.message); });
    page.on("console", function (message) {
      if (message.type() === "error") browserErrors.push("console: " + message.text());
    });
    page.on("request", function (request) {
      const url = request.url();
      if (!url.startsWith(BASE) && !url.startsWith("blob:") && !url.startsWith("data:")) externalRequests.push(url);
    });

    await page.goto(BASE, { waitUntil: "networkidle" });
    await page.evaluate(function () { localStorage.clear(); });
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(400);
    assert(await page.evaluate(function () { return AXMShapeableBuilder.version; }) === "0.13.0-beta", "The upgraded v0.13 model did not load.");
    if (!(await page.locator("#templateDialog").isVisible())) await page.locator("#templateButton").click();
    await page.locator("#templateDialog").waitFor({ state: "visible" });
    assert(await page.locator("[data-template-id]").count() === 7, "The template gallery did not expose all seven rooted starting points.");
    assert(await page.locator('[data-template-id="young-ai-workshop"]').count() === 1, "The young AI learning workshop starter is missing.");
    await page.screenshot({ path: path.join(__dirname, "template-gallery.png"), fullPage: true });

    await page.locator('[data-template-id="website"]').click();
    await page.locator("#templateDialog").waitFor({ state: "hidden" });
    assert(await page.locator(".builder-node").count() === 5, "Website logic template did not load five logic blocks.");
    assert(await page.locator("#projectNameTop").inputValue() === "Open invitation", "Project identity did not update from the template.");

    await page.locator('[data-layer="capabilities"]').click();
    assert(await page.locator(".builder-node").count() === 4, "Capability canvas did not load its template blocks.");
    await page.locator('.builder-node:has-text("Remember locally")').click();
    await page.locator(".permission-box .toggle").click();
    const permissionApproved = await page.evaluate(function () {
      const node = AXMShapeableBuilder.getProject().layers.capabilities.nodes.find(function (item) { return item.type === "local-storage"; });
      return Boolean(node && node.permission && node.permission.approved);
    });
    assert(permissionApproved, "Capability permission was not recorded in the project source.");
    await page.locator("[data-duplicate-selected]").click();
    const duplicatedCapability = await page.evaluate(function () {
      const nodes = AXMShapeableBuilder.getProject().layers.capabilities.nodes.filter(function (item) { return item.type === "local-storage"; });
      return { count: nodes.length, copyApproved: Boolean(nodes[1] && nodes[1].permission && nodes[1].permission.approved) };
    });
    assert(duplicatedCapability.count === 2, "Selected block duplication did not create a second block.");
    assert(!duplicatedCapability.copyApproved, "A duplicated capability silently inherited permission consent.");
    await page.locator("#undoButton").click();

    await page.locator('[data-layer="visual"]').click();
    const visualBefore = await page.locator(".builder-node").count();
    await page.locator('.palette-block[data-block-type="metric"]').dragTo(page.locator("#canvasSurface"), { targetPosition: { x: 760, y: 560 } });
    assert(await page.locator(".builder-node").count() === visualBefore + 1, "Palette add action did not create a visual block.");
    const bindingsBefore = await page.evaluate(function () { return AXMShapeableBuilder.getProject().bindings.length; });
    await page.locator(".binding-option").first().click();
    assert(await page.evaluate(function () { return AXMShapeableBuilder.getProject().bindings.length; }) === bindingsBefore + 1, "Inspector did not create a cross-layer binding.");
    await page.locator("#undoButton").click();
    assert(await page.evaluate(function () { return AXMShapeableBuilder.getProject().bindings.length; }) === bindingsBefore, "Undo did not restore the prior cross-layer contract.");
    await page.locator("#undoButton").click();
    assert(await page.locator(".builder-node").count() === visualBefore, "Undo did not restore the prior canvas.");
    await page.locator("#redoButton").click();
    await page.locator("#redoButton").click();
    assert(await page.locator(".builder-node").count() === visualBefore + 1, "Redo did not restore the added block.");

    await page.locator("#goalBuilderButton").click();
    await page.locator("#goalBuilderDialog").waitFor({ state: "visible" });
    await page.locator("#goalStatement").fill("Help a visitor understand the invitation and choose their next step.");
    await page.locator("#goalSuccessMeasure").fill("A visitor can read the purpose and reveal the participation message from one clear action.");
    await page.locator("#applyGoalButton").click();
    await page.locator("#goalBuilderDialog").waitFor({ state: "hidden" });
    const goal = await page.evaluate(function () { return AXMShapeableBuilder.getProject().spine.goal; });
    assert(goal.statement.includes("visitor"), "The guided goal builder did not update the shared project spine.");

    await page.locator("#spineMapButton").click();
    await page.locator("#spineMapDialog").waitFor({ state: "visible" });
    const mappedNodes = await page.locator("[data-map-node]").count();
    const totalNodes = await page.evaluate(function () {
      const p = AXMShapeableBuilder.getProject();
      return p.layers.logic.nodes.length + p.layers.capabilities.nodes.length + p.layers.visual.nodes.length;
    });
    assert(mappedNodes === totalNodes, "Whole-project map omitted one or more source blocks.");
    await page.locator(".spine-map-binding").first().waitFor({ state: "attached" });
    assert(await page.locator(".spine-map-binding").count() > 0, "Whole-project map did not draw cross-layer bindings.");
    await page.screenshot({ path: path.join(__dirname, "spine-map.png"), fullPage: true });
    await page.locator("#spineMapDialog .modal-close").click();

    const examplePack = {
      schema: "axm.shapeable.block-pack", schemaVersion: 1, id: "qa-community", name: "QA community pack", version: "0.1.0",
      source: "Local browser QA fixture", testStatus: "SMOKE TESTED", licenseStatus: "TEST FIXTURE ONLY",
      blocks: [{ layer: "logic", type: "qa-community--visible-step", label: "Community visible step", subtitle: "Pack safety proof", group: "QA pack", icon: "spark", rgb: "68, 215, 202", description: "A code-free test block.", input: true, output: true, targets: ["website", "dashboard", "game", "custom"], permission: null, defaults: { message: "Visible" }, fields: [{ key: "message", label: "Message", type: "text" }] }]
    };
    await page.locator("#packManagerButton").click();
    await page.locator("#packManagerDialog").waitFor({ state: "visible" });
    await page.locator("#importPackInput").setInputFiles({ name: "qa-community.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(examplePack)) });
    await page.locator(".pack-card:has-text('QA community pack')").waitFor();
    await page.screenshot({ path: path.join(__dirname, "pack-manager.png"), fullPage: true });
    await page.locator("#packManagerDialog .modal-close").click();
    await page.locator('[data-layer="logic"]').click();
    await page.locator('[data-add-block="qa-community--visible-step"]').click();
    assert(await page.locator('.builder-node:has-text("Community visible step")').count() === 1, "Imported community block was not available in the palette.");
    await page.locator("#packManagerButton").click();
    await page.locator('[data-remove-pack="qa-community"]').click();
    assert(await page.evaluate(function () {
      const p = AXMShapeableBuilder.getProject();
      return p.layers.logic.nodes.some(function (node) { return node.type === "qa-community--visible-step"; });
    }), "Removing a pack deleted an existing project block.");
    await page.locator("#packManagerDialog .modal-close").click();
    await page.locator('.builder-node:has-text("Community visible step")').click();
    await page.keyboard.press("Delete");

    const source = await page.evaluate(function () { return AXMShapeableBuilder.getProject(); });
    assert(source.bindings.length >= 7, "Cross-layer bindings were not preserved.");
    assert(source.spine.invariants.length >= 3, "Skeleton invariants were not preserved.");
    assert(source.ledger.length >= 5, "The visible project ledger did not record edits.");
    const accessibilityBasics = await page.evaluate(function () {
      const unlabeledButtons = Array.from(document.querySelectorAll("button")).filter(function (button) {
        return !(button.textContent.trim() || button.getAttribute("aria-label") || button.getAttribute("title"));
      }).length;
      const unlabeledInputs = Array.from(document.querySelectorAll("input,textarea,select")).filter(function (input) {
        if (input.type === "hidden") return false;
        const wrapped = input.closest("label");
        const explicit = input.id && document.querySelector('label[for="' + CSS.escape(input.id) + '"]');
        return !(wrapped || explicit || input.getAttribute("aria-label"));
      }).length;
      return { unlabeledButtons: unlabeledButtons, unlabeledInputs: unlabeledInputs, main: document.querySelectorAll("main").length };
    });
    assert(accessibilityBasics.unlabeledButtons === 0, "A visible button has no accessible name.");
    assert(accessibilityBasics.unlabeledInputs === 0, "A form control has no accessible label.");
    assert(accessibilityBasics.main === 1, "Application shell should expose exactly one main landmark.");

    await page.locator("#previewButton").click();
    await page.locator("#previewDialog").waitFor({ state: "visible" });
    const previewHeading = page.frameLocator("#previewFrame").locator("h1");
    await previewHeading.waitFor();
    assert((await previewHeading.textContent()).trim().length > 0, "Generated website preview did not render its heading.");
    await page.screenshot({ path: path.join(__dirname, "website-preview.png"), fullPage: true });
    await page.locator("#previewDialog .modal-close").click();

    await page.locator("#testButton").click();
    await page.locator("#diagnosticsDrawer.open").waitFor();
    const validation = await page.evaluate(function () { return AXMShapeableBuilder.validate(); });
    assert(validation.errors === 0, "Website template should have no critical errors after local-storage consent.");
    await page.locator("#closeDiagnosticsButton").click();

    await page.locator("#buildButton").click();
    await page.locator("#exportDialog").waitFor({ state: "visible" });
    assert(!(await page.locator("#exportHtmlButton").isDisabled()), "Standalone build remained blocked after critical checks passed.");
    const intentDownloadPromise = page.waitForEvent("download");
    await page.locator("#exportAiIntentButton").click();
    const intentDownload = await intentDownloadPromise;
    assert(intentDownload.suggestedFilename().endsWith(".axm-intent.json"), "AI intent packet export used an unexpected filename.");
    const engineDownloadPromise = page.waitForEvent("download");
    await page.locator("#exportEngineHandoffButton").click();
    const engineDownload = await engineDownloadPromise;
    assert(engineDownload.suggestedFilename().endsWith(".axm-engine-handoff.json"), "Engine handoff export used an unexpected filename.");
    const workspaceDownloadPromise = page.waitForEvent("download");
    await page.locator("#exportAgentWorkspaceButton").click();
    const workspaceDownload = await workspaceDownloadPromise;
    assert(workspaceDownload.suggestedFilename().endsWith(".axm-agent-workspace.json"), "Young AI workspace export used an unexpected filename.");
    await page.locator("#exportDialog .modal-close").click();

    await page.locator("#aiWorkbenchButton").click();
    await page.locator("#aiWorkbenchDialog").waitFor({ state: "visible" });
    const workspaceContract = await page.evaluate(function () { return AXMShapeableBuilder.generateAgentWorkspace(); });
    assert(workspaceContract.schema === "axm.agent.workspace", "Young AI workspace schema is missing.");
    assert(workspaceContract.seat.authority === "PROPOSE_ONLY", "Young AI seat gained apply authority.");
    assert(workspaceContract.blockCatalog.length === 77, "Young AI workspace did not expose the complete block catalog.");
    assert(workspaceContract.actionProtocol.verbs.length === 17, "Agent action protocol is incomplete.");
    await page.screenshot({ path: path.join(__dirname, "young-ai-workbench.png"), fullPage: true });
    const proposal = await page.evaluate(function () {
      const packet = AXMShapeableBuilder.getAgentProposalTemplate();
      packet.proposalId = "smoke-human-gate";
      packet.title = "Protect the visible human apply gate";
      packet.summary = "Add one invariant without altering permissions, canon or destructive authority.";
      packet.actions = [{ id: "gate-rule", verb: "add_invariant", why: "Keep shared collaboration under visible human control.", text: "A young AI proposal remains unapplied until a human explicitly accepts it through the visible review gate." }];
      packet.tests = ["Run diagnostics after apply.", "Use Undo and confirm the invariant and review receipt both roll back."];
      return packet;
    });
    const invariantCountBefore = await page.evaluate(function () { return AXMShapeableBuilder.getProject().spine.invariants.length; });
    await page.locator("#aiProposalText").fill(JSON.stringify(proposal, null, 2));
    await page.locator("#aiValidateProposalButton").click();
    await page.locator("#aiProposalReview .ai-review-status.valid").waitFor();
    assert(await page.locator("#aiApplyProposalButton").isDisabled(), "Valid proposal bypassed the human checklist.");
    await page.locator("#aiCheckActions").check();
    await page.locator("#aiCheckAuthority").check();
    await page.locator("#aiCheckApply").check();
    assert(!(await page.locator("#aiApplyProposalButton").isDisabled()), "Completed human checklist did not unlock apply.");
    await page.locator("#aiApplyProposalButton").click();
    await page.locator("#confirmOverlay").waitFor({ state: "visible" });
    assert(!(await page.locator("#aiWorkbenchDialog").isVisible()), "Workbench modal blocked the separate confirmation gate.");
    await page.locator("#confirmAcceptButton").click();
    await page.locator("#aiWorkbenchDialog").waitFor({ state: "visible" });
    const appliedProposal = await page.evaluate(function () {
      const source = AXMShapeableBuilder.getProject();
      return { invariants: source.spine.invariants.length, receipts: source.spine.collaboration.reviewLog.length, actor: source.ledger[source.ledger.length - 1].actor };
    });
    assert(appliedProposal.invariants === invariantCountBefore + 1, "Reviewed proposal did not apply its bounded invariant.");
    assert(appliedProposal.receipts > 0, "Applied proposal did not record a human review receipt.");
    assert(appliedProposal.actor.includes("human approval"), "Applied proposal ledger did not preserve mixed-source attribution.");
    await page.locator("#aiWorkbenchDialog .modal-close").click();
    await page.locator("#undoButton").click();
    assert(await page.evaluate(function () { return AXMShapeableBuilder.getProject().spine.invariants.length; }) === invariantCountBefore, "Young AI proposal was not one undoable source change.");
    await page.locator("#redoButton").click();
    assert(await page.evaluate(function () { return AXMShapeableBuilder.getProject().spine.invariants.length; }) === invariantCountBefore + 1, "Redo did not restore the reviewed proposal.");
    const blockedProposal = await page.evaluate(function () {
      const packet = AXMShapeableBuilder.getAgentProposalTemplate();
      packet.proposalId = "smoke-forbidden-authority";
      packet.title = "Forbidden authority attempt";
      packet.actions = [{ id: "bad-authority", verb: "grant_permission", why: "This must be blocked." }];
      return AXMShapeableBuilder.stageAgentProposal(packet);
    });
    assert(!blockedProposal.valid, "Unknown authority verb was not blocked.");
    await page.locator("#aiProposalReview .ai-review-status.invalid").waitFor();
    assert(await page.locator("#aiApplyProposalButton").isDisabled(), "Blocked proposal exposed an apply path.");
    await page.locator("#aiWorkbenchDialog .modal-close").click();

    await page.reload({ waitUntil: "networkidle" });
    assert(await page.locator("#projectNameTop").inputValue() === "Open invitation", "Local project autosave did not survive reload.");
    await page.evaluate(function () { AXMShapeableBuilder.loadTemplate("dashboard"); });
    assert(await page.locator("#projectNameTop").inputValue() === "Local stewardship board", "Dashboard template did not load.");
    await page.locator("#previewButton").click();
    const dashboardFrame = page.frameLocator("#previewFrame");
    await dashboardFrame.locator(".dashboard").waitFor();
    assert(await dashboardFrame.locator(".metrics article").count() >= 3, "Generated dashboard did not render its metric cards.");
    await page.locator("#previewDialog .modal-close").click();

    await page.evaluate(function () { AXMShapeableBuilder.loadTemplate("cartoon-world"); });
    assert(await page.locator("#projectNameTop").inputValue() === "Cartoon world quest", "Cartoon World Quest template did not load.");
    const cartoonValidation = await page.evaluate(function () { return AXMShapeableBuilder.validate(); });
    assert(cartoonValidation.errors === 0, "Cartoon World Quest should be buildable without enabling its optional Engine Dock.");
    await page.locator("#previewButton").click();
    const cartoonFrame = page.frameLocator("#previewFrame");
    await cartoonFrame.locator("#game").waitFor();
    assert((await cartoonFrame.locator("h1").textContent()).includes("Moonleaf"), "Biome-aware cartoon world preview did not use its configured HUD.");
    assert((await cartoonFrame.locator(".mission-readout article").first().textContent()).toUpperCase().includes("STAR SEEDS"), "Game renderer did not derive the configured objective label.");
    await cartoonFrame.locator("#startGame").click();
    assert(await cartoonFrame.locator("#status").textContent() === "ACTIVE", "Cartoon World Quest did not enter its playable state.");
    await page.screenshot({ path: path.join(__dirname, "cartoon-world-preview.png"), fullPage: true });
    await page.locator("#previewDialog .modal-close").click();

    await page.locator("#projectVaultButton").click();
    await page.locator("#projectVaultDialog").waitFor({ state: "visible" });
    assert(await page.locator(".vault-card:not(.trash)").count() >= 3, "Multi-project vault did not preserve earlier template projects.");
    await page.locator("#checkpointNameInput").fill("Playable forest proof");
    await page.locator("#createCheckpointButton").click();
    await page.locator('.checkpoint-chip:has-text("Playable forest proof")').waitFor();
    await page.screenshot({ path: path.join(__dirname, "project-vault.png"), fullPage: true });
    await page.locator('.vault-card.active .checkpoint-chip:has-text("Playable forest proof")').click();
    await page.locator("#projectVaultDialog").waitFor({ state: "hidden" });
    assert((await page.locator("#projectNameTop").inputValue()).includes("Playable forest proof"), "Checkpoint restore did not create and open a new project copy.");

    await page.locator("#goalBuilderButton").click();
    await page.locator("#goalProjectName").fill("QA guided build loop");
    await page.locator("#goalTemplateSelect").selectOption("hands-loop");
    await page.locator("#goalStatement").fill("Let a human route one bounded change through Scout, Builder and Tester.");
    await page.locator("#goalSuccessMeasure").fill("A reviewable proposal and passing evidence exist before any apply decision.");
    await page.locator("#createGoalProjectButton").click();
    await page.locator("#goalBuilderDialog").waitFor({ state: "hidden" });
    assert(await page.locator("#projectNameTop").inputValue() === "QA guided build loop", "Goal Builder did not create a separate rooted project.");
    await page.locator("#projectVaultButton").click();
    await page.locator('.vault-card.active [data-trash-project]').click();
    assert(await page.locator(".vault-card.trash").count() === 1, "Project trash did not preserve the discarded project.");
    await page.locator('.vault-card.trash [data-restore-project]').click();
    assert(await page.locator(".vault-card.trash").count() === 0, "Recoverable trash did not restore the project.");
    await page.locator("#projectVaultDialog .modal-close").click();

    await page.locator("#templateButton").click();
    await page.locator('[data-template-id="game"]').click();
    await page.locator("#confirmOverlay").waitFor({ state: "visible" });
    await page.locator("#confirmAcceptButton").click();
    await page.locator("#confirmOverlay").waitFor({ state: "hidden" });
    assert(await page.locator("#projectNameTop").inputValue() === "Parcel run", "Confirmed template replacement did not load Parcel Run.");

    await page.locator("#previewButton").click();
    const gameFrame = page.frameLocator("#previewFrame");
    await gameFrame.locator("#game").waitFor();
    await gameFrame.locator("#startGame").click();
    await gameFrame.locator("#intro.hidden").waitFor();
    assert(await gameFrame.locator("#status").textContent() === "ACTIVE", "Generated game did not enter its playable state.");
    await page.screenshot({ path: path.join(__dirname, "game-preview.png"), fullPage: true });
    await page.locator("#previewDialog .modal-close").click();

    await page.screenshot({ path: path.join(__dirname, "beta-ui.png"), fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload({ waitUntil: "networkidle" });
    const mobileLayout = await page.evaluate(function () {
      return { bodyWidth: document.body.scrollWidth, viewport: window.innerWidth, menuVisible: getComputedStyle(document.getElementById("mobileMenuButton")).display !== "none" };
    });
    assert(mobileLayout.bodyWidth <= mobileLayout.viewport, "Mobile application shell overflows the viewport.");
    assert(mobileLayout.menuVisible, "Mobile block-palette control is not visible.");
    await page.screenshot({ path: path.join(__dirname, "mobile-ui.png"), fullPage: true });

    await page.evaluate(function () { return navigator.serviceWorker.ready; });
    await context.setOffline(true);
    await page.reload({ waitUntil: "domcontentloaded" });
    assert(await page.locator(".brand-name").textContent() === "Shapeable", "Offline shell did not restore the application.");
    await context.setOffline(false);

    assert(browserErrors.length === 0, "Browser errors were recorded:\n" + browserErrors.join("\n"));
    assert(externalRequests.length === 0, "Unexpected outside network requests were recorded:\n" + externalRequests.join("\n"));
    console.log(JSON.stringify({
      status: "PASS",
      templates: 7,
      tested: ["template load", "permission gate", "safe block duplication", "drag/drop", "cross-layer binding", "undo/redo", "goal update and rooted project creation", "whole-project map", "community pack lifecycle", "multi-project vault", "recoverable trash", "named checkpoint restore", "autosave", "diagnostics", "website preview", "dashboard preview", "standalone game", "cartoon world game", "AI intent export", "young AI workspace export", "proposal validation and clone dry-run", "human checklist and apply gate", "proposal review receipt", "proposal undo/redo", "forbidden authority rejection", "engine handoff export", "mobile layout", "accessibility basics", "offline reload", "no external requests"],
      validationScore: validation.score,
      browserErrors: browserErrors.length
    }, null, 2));
  } finally {
    if (browser) await browser.close();
    server.kill("SIGTERM");
  }
})().catch(function (error) {
  console.error(error.stack || error);
  process.exitCode = 1;
});
