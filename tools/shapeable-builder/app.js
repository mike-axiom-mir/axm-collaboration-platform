(function () {
  "use strict";

  const M = window.AXMBuilderModel;
  if (!M) throw new Error("AXM Builder model failed to load.");

  const STORAGE_KEY = "axm.shapeable.builder.beta.project.v1";
  const UI_KEY = "axm.shapeable.builder.beta.ui.v1";
  const VAULT_KEY = "axm.shapeable.builder.beta.vault.v1";
  const PACKS_KEY = "axm.shapeable.builder.beta.block-packs.v1";
  const CANVAS_WIDTH = 1600;
  const CANVAS_HEIGHT = 1000;
  const NODE_WIDTH = 224;
  const NODE_HEIGHT = 105;
  const GRID_SIZE = 12;
  const ALIGN_THRESHOLD = 7;
  const DRAG_START_THRESHOLD = 5;
  const TOUCH_DRAG_START_THRESHOLD = 12;
  const AUTOSCROLL_EDGE = 72;
  const AUTOSCROLL_MAX = 18;
  const MAX_HISTORY = 60;
  const MAX_PROJECTS = 20;
  const MAX_CHECKPOINTS = 12;

  const dom = {};
  let project = null;
  let saveTimer = null;
  let confirmAction = null;
  let confirmCancelAction = null;
  let confirmReturnDialog = null;
  let firstLaunch = false;
  let vault = null;

  const runtime = {
    activeLayer: "logic",
    inspectorTab: "inspect",
    selectedNodeId: null,
    selectedEdgeId: null,
    zoom: 1,
    pendingConnection: null,
    undo: [],
    redo: [],
    drag: null,
    paletteDrag: null,
    palettePointer: null,
    suppressNodeClickId: null,
    suppressNodeClickUntil: 0,
    lastValidation: null,
    paletteSearch: "",
    dirty: false,
    agentWorkspace: null,
    agentProposalReview: null,
    agentProposalPayload: null,
    influencePreview: null
  };

  function $(selector, root) {
    return (root || document).querySelector(selector);
  }

  function $$(selector, root) {
    return Array.from((root || document).querySelectorAll(selector));
  }

  function cacheDom() {
    [
      "appShell", "projectNameTop", "truthDot", "saveState", "undoButton", "redoButton", "testButton", "previewButton", "buildButton",
      "templateButton", "projectVaultButton", "goalBuilderButton", "spineMapButton", "packManagerButton", "helpButton", "palettePanel", "paletteTitle", "blockSearch", "blockList", "customBlockButton", "mobileCanvasButton", "mobileMenuButton", "closePaletteButton",
      "contextPulse", "contextTitle", "contextDescription", "fitButton", "zoomOutButton", "zoomInButton", "zoomOutput", "autoArrangeButton",
      "canvasViewport", "canvasScaleWrap", "canvasSurface", "edgeLayer", "nodeLayer", "alignmentGuideX", "alignmentGuideY", "canvasDropPreview", "dropPreviewSymbol", "dropPreviewTitle", "dropPreviewMeta", "emptyCanvas", "emptyTemplateButton",
      "logicCount", "capabilitiesCount", "visualCount", "nodeStatus", "bindingStatus", "coordinateStatus", "readinessButton", "readinessFill", "readinessScore",
      "inspectorPanel", "inspectorContent", "connectionToast", "connectionToastText", "cancelConnectionButton",
      "diagnosticsDrawer", "drawerScore", "diagnosticSummary", "diagnosticList", "closeDiagnosticsButton",
      "templateDialog", "templateGrid", "projectVaultDialog", "projectVaultContent", "checkpointNameInput", "createCheckpointButton", "vaultNewProjectButton",
      "goalBuilderDialog", "goalProjectName", "goalTemplateSelect", "goalStatement", "goalSuccessMeasure", "goalTargetSelect", "goalAccent", "goalCapabilityChoices", "applyGoalButton", "createGoalProjectButton",
      "spineMapDialog", "spineMapGoal", "spineMapBoard", "spineMapEdges", "spineMapGrid", "packManagerDialog", "packList", "importPackInput", "exportPackTemplateButton",
      "aiWorkbenchButton", "aiWorkbenchDialog", "aiRefreshWorkspaceButton", "aiSourceStamp", "aiExportWorkspaceButton", "aiCopyObservationButton", "aiExportProposalTemplateButton", "aiWorkspaceSummary", "aiObservationPreview", "aiProposalText", "aiProposalFileInput", "aiValidateProposalButton", "aiClearProposalButton", "aiProposalReview", "aiReviewChecklist", "aiCheckActions", "aiCheckAuthority", "aiCheckApply", "aiApplyProposalButton",
      "previewDialog", "previewFrame", "previewStage", "previewAddress", "refreshPreviewButton", "previewExportButton",
      "exportDialog", "exportStatusText", "exportReadiness", "exportProjectButton", "exportHtmlButton", "exportAiIntentButton", "exportAgentWorkspaceButton", "exportEngineHandoffButton", "copySpineButton", "importProjectInput",
      "guideDialog", "confirmOverlay", "confirmTitle", "confirmMessage", "confirmCancelButton", "confirmAcceptButton", "toastStack"
    ].forEach(function (id) { dom[id] = document.getElementById(id); });
  }

  function emptyVault() {
    return { schema: "axm.shapeable.vault", schemaVersion: 1, activeProjectId: null, projects: {}, trash: {} };
  }

  function loadStoredPacks() {
    try {
      const stored = JSON.parse(localStorage.getItem(PACKS_KEY) || "[]");
      if (!Array.isArray(stored)) return;
      stored.forEach(function (pack) {
        const result = M.registerBlockPack(pack);
        if (!result.valid) console.warn("A stored block pack was skipped:", result.errors.join(" "));
      });
    } catch (error) {
      console.warn("Stored block packs could not be restored:", error);
    }
  }

  function persistPacks() {
    localStorage.setItem(PACKS_KEY, JSON.stringify(M.getRegisteredPacks()));
  }

  function normalizeVaultRecord(record) {
    if (!record || typeof record !== "object" || !record.project) return null;
    try {
      const normalized = M.normalizeProject(record.project, { recordImport: false });
      const checkpoints = Array.isArray(record.checkpoints) ? record.checkpoints.filter(function (checkpoint) {
        return checkpoint && checkpoint.project && typeof checkpoint.project === "object";
      }) : [];
      return { project: normalized, checkpoints: checkpoints, lastOpenedAt: record.lastOpenedAt || normalized.meta.updatedAt || M.now() };
    } catch (_) {
      return null;
    }
  }

  function loadVaultSource() {
    let source = null;
    try { source = JSON.parse(localStorage.getItem(VAULT_KEY) || "null"); } catch (_) { source = null; }
    const next = emptyVault();
    if (source && source.schema === "axm.shapeable.vault" && Number(source.schemaVersion) === 1) {
      Object.keys(source.projects || {}).forEach(function (id) {
        const record = normalizeVaultRecord(source.projects[id]);
        if (record) next.projects[record.project.id] = record;
      });
      Object.keys(source.trash || {}).forEach(function (id) {
        const record = normalizeVaultRecord(source.trash[id]);
        if (record) {
          record.deletedAt = source.trash[id].deletedAt || M.now();
          next.trash[record.project.id] = record;
        }
      });
      next.activeProjectId = next.projects[source.activeProjectId] ? source.activeProjectId : Object.keys(next.projects)[0] || null;
    }
    return next;
  }

  function loadInitialProject() {
    loadStoredPacks();
    vault = loadVaultSource();
    try {
      if (vault.activeProjectId && vault.projects[vault.activeProjectId]) {
        project = M.clone(vault.projects[vault.activeProjectId].project);
      } else {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) project = M.normalizeProject(JSON.parse(stored), { recordImport: false });
        else {
          firstLaunch = true;
          project = M.getTemplate("blank").build();
        }
        vault.projects[project.id] = { project: M.clone(project), checkpoints: [], lastOpenedAt: M.now() };
        vault.activeProjectId = project.id;
      }
    } catch (error) {
      console.warn("Stored project could not be restored:", error);
      firstLaunch = true;
      project = M.getTemplate("blank").build();
      vault = emptyVault();
      vault.projects[project.id] = { project: M.clone(project), checkpoints: [], lastOpenedAt: M.now() };
      vault.activeProjectId = project.id;
      setTimeout(function () { toast("Stored state was invalid. A clean local project was opened without rewriting the old data.", "warning", 5200); }, 200);
    }
    try {
      const ui = JSON.parse(localStorage.getItem(UI_KEY) || "{}");
      if (M.LAYERS[ui.activeLayer]) runtime.activeLayer = ui.activeLayer;
      if (Number.isFinite(ui.zoom)) runtime.zoom = Math.max(0.55, Math.min(1.35, ui.zoom));
    } catch (_) { /* UI preferences are optional. */ }
  }

  function storeUiState() {
    try {
      localStorage.setItem(UI_KEY, JSON.stringify({ activeLayer: runtime.activeLayer, zoom: runtime.zoom }));
    } catch (_) { /* Project work remains usable without preference storage. */ }
  }

  function setDirty(isDirty) {
    runtime.dirty = isDirty;
    dom.truthDot.classList.toggle("dirty", isDirty);
    dom.saveState.textContent = isDirty ? "Saving locally…" : "Local source truth";
  }

  function scheduleSave(immediate) {
    setDirty(true);
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveProject, immediate ? 0 : 220);
  }

  function saveProject() {
    try {
      const existing = vault.projects[project.id] || { checkpoints: [] };
      vault.projects[project.id] = {
        project: M.clone(project),
        checkpoints: Array.isArray(existing.checkpoints) ? existing.checkpoints : [],
        lastOpenedAt: M.now()
      };
      vault.activeProjectId = project.id;
      localStorage.setItem(VAULT_KEY, JSON.stringify(vault));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
      setDirty(false);
    } catch (error) {
      setDirty(true);
      dom.saveState.textContent = "Local save blocked";
      toast("The browser could not save locally. Export the project source before closing.", "error", 6000);
    }
  }

  function storeVaultState() {
    localStorage.setItem(VAULT_KEY, JSON.stringify(vault));
    if (project) localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
  }

  function resetProjectRuntime() {
    runtime.undo.length = 0;
    runtime.redo.length = 0;
    runtime.selectedNodeId = null;
    runtime.selectedEdgeId = null;
    runtime.pendingConnection = null;
    runtime.activeLayer = "logic";
  }

  function projectCount() {
    return Object.keys(vault.projects).length;
  }

  function canCreateProject() {
    if (projectCount() < MAX_PROJECTS) return true;
    toast("The beta vault holds up to " + MAX_PROJECTS + " active projects. Move one to recoverable trash before creating another.", "warning", 5600);
    return false;
  }

  function addProjectToVault(candidate, options) {
    options = options || {};
    if (!canCreateProject()) return false;
    saveProject();
    const next = M.clone(candidate);
    if (vault.projects[next.id] || vault.trash[next.id]) {
      next.id = M.uid("project");
      next.meta.createdAt = M.now();
      next.ledger.push({ id: M.uid("event"), at: M.now(), actor: "human", type: "project.copied", message: "Created a new project identity to avoid overwriting existing local source", layer: null });
    }
    next.meta.updatedAt = M.now();
    vault.projects[next.id] = { project: M.clone(next), checkpoints: [], lastOpenedAt: M.now() };
    vault.activeProjectId = next.id;
    project = next;
    resetProjectRuntime();
    storeVaultState();
    setDirty(false);
    renderAll();
    setTimeout(fitCanvas, 20);
    if (options.toast !== false) toast(options.message || "New project added to the local vault.", "success", 4300);
    return true;
  }

  function openVaultProject(projectId) {
    const record = vault.projects[projectId];
    if (!record || projectId === project.id) return;
    saveProject();
    project = M.normalizeProject(record.project, { recordImport: false });
    vault.activeProjectId = project.id;
    record.project = M.clone(project);
    record.lastOpenedAt = M.now();
    resetProjectRuntime();
    storeVaultState();
    setDirty(false);
    if (dom.projectVaultDialog.open) dom.projectVaultDialog.close();
    renderAll();
    setTimeout(fitCanvas, 20);
    toast("Opened “" + project.name + "” from the local vault.");
  }

  function formatVaultTime(value) {
    try { return new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }); }
    catch (_) { return String(value || "Unknown time"); }
  }

  function renderCheckpointChips(record, projectId) {
    const checkpoints = Array.isArray(record.checkpoints) ? record.checkpoints : [];
    if (!checkpoints.length) return "";
    return '<div class="checkpoint-list"><span class="sr-only">Named checkpoints</span>' + checkpoints.slice().reverse().map(function (checkpoint) {
      return '<span class="checkpoint-unit"><button class="checkpoint-chip" type="button" data-restore-checkpoint="' + M.escapeHtml(checkpoint.id) + '" data-project-id="' + M.escapeHtml(projectId) + '" title="Restore as a new project">↗ ' + M.escapeHtml(checkpoint.name) + ' · ' + M.escapeHtml(formatVaultTime(checkpoint.createdAt)) + '</button><button class="checkpoint-delete" type="button" data-delete-checkpoint="' + M.escapeHtml(checkpoint.id) + '" data-project-id="' + M.escapeHtml(projectId) + '" title="Permanently remove checkpoint" aria-label="Permanently remove checkpoint ' + M.escapeHtml(checkpoint.name) + '">×</button></span>';
    }).join("") + "</div>";
  }

  function renderVaultCard(record, isTrash) {
    const item = record.project;
    const counts = M.allNodes(item).length;
    const validation = M.validateProject(item);
    const active = !isTrash && item.id === project.id;
    const goal = item.spine && item.spine.goal && item.spine.goal.statement;
    const actions = isTrash
      ? '<button class="vault-mini" type="button" data-restore-project="' + M.escapeHtml(item.id) + '">Restore</button><button class="vault-mini" type="button" data-export-vault-project="' + M.escapeHtml(item.id) + '" data-from-trash="true">Export</button>'
      : (active ? '<button class="vault-mini" type="button" disabled>Open now</button>' : '<button class="vault-mini" type="button" data-open-project="' + M.escapeHtml(item.id) + '">Open</button>') + '<button class="vault-mini" type="button" data-duplicate-project="' + M.escapeHtml(item.id) + '">Duplicate</button><button class="vault-mini" type="button" data-export-vault-project="' + M.escapeHtml(item.id) + '">Export</button><button class="vault-mini danger" type="button" data-trash-project="' + M.escapeHtml(item.id) + '">Trash</button>';
    return '<article class="vault-card' + (active ? " active" : "") + (isTrash ? " trash" : "") + '" style="--card-rgb:' + (M.LAYERS[item.target === "game" ? "visual" : item.target === "dashboard" ? "capabilities" : "logic"].rgb) + '"><span class="vault-card-mark">' + (active ? "NOW" : isTrash ? "BIN" : String(M.TARGETS[item.target] ? M.TARGETS[item.target].extension : "AXM").toUpperCase()) + '</span><span class="vault-card-copy"><b>' + M.escapeHtml(item.name) + '</b><small>' + M.escapeHtml(M.TARGETS[item.target] ? M.TARGETS[item.target].label : item.target) + " · " + counts + " blocks · " + validation.score + '% ready</small><small class="vault-goal">' + M.escapeHtml(goal || item.description || "No goal stated") + '</small></span><span class="vault-card-actions">' + actions + "</span>" + (!isTrash ? renderCheckpointChips(record, item.id) : "") + "</article>";
  }

  function renderProjectVault() {
    saveProject();
    const records = Object.values(vault.projects).sort(function (a, b) { return String(b.lastOpenedAt).localeCompare(String(a.lastOpenedAt)); });
    const trashed = Object.values(vault.trash).sort(function (a, b) { return String(b.deletedAt).localeCompare(String(a.deletedAt)); });
    dom.projectVaultContent.innerHTML = '<section class="vault-column"><h3 class="vault-column-title">Active projects <span>' + records.length + " / " + MAX_PROJECTS + '</span></h3><div class="vault-list">' + records.map(function (record) { return renderVaultCard(record, false); }).join("") + '</div></section><section class="vault-column"><h3 class="vault-column-title">Recoverable trash <span>' + trashed.length + (trashed.length ? ' · <button class="vault-mini danger" type="button" data-empty-trash>Empty</button>' : "") + '</span></h3><div class="vault-list">' + (trashed.length ? trashed.map(function (record) { return renderVaultCard(record, true); }).join("") : '<div class="vault-empty">Nothing has been discarded. Projects moved here remain recoverable.</div>') + "</div></section>";
  }

  function openProjectVault() {
    renderProjectVault();
    showDialog(dom.projectVaultDialog);
  }

  function createCheckpoint() {
    const name = String(dom.checkpointNameInput.value || "").trim().slice(0, 80);
    if (!name) { toast("Name the checkpoint so its purpose remains visible.", "warning"); return; }
    saveProject();
    const record = vault.projects[project.id];
    if (record.checkpoints.length >= MAX_CHECKPOINTS) {
      toast("This project already has " + MAX_CHECKPOINTS + " checkpoints. Restore or export one, then deliberately remove a checkpoint before adding another.", "warning", 6200);
      return;
    }
    record.checkpoints.push({ id: M.uid("checkpoint"), name: name, createdAt: M.now(), project: M.projectSnapshot(project) });
    addLedger("checkpoint.created", "Saved named checkpoint “" + name + "”", null);
    record.project = M.clone(project);
    storeVaultState();
    dom.checkpointNameInput.value = "";
    renderProjectVault();
    toast("Named checkpoint saved locally.");
  }

  function restoreCheckpoint(projectId, checkpointId) {
    const record = vault.projects[projectId];
    const checkpoint = record && record.checkpoints.find(function (item) { return item.id === checkpointId; });
    if (!checkpoint) return;
    if (!canCreateProject()) return;
    const restored = M.normalizeProject(checkpoint.project, { recordImport: false });
    restored.id = M.uid("project");
    restored.name = (restored.name + " — " + checkpoint.name).slice(0, 160);
    restored.meta.createdAt = M.now();
    restored.meta.updatedAt = M.now();
    restored.ledger.push({ id: M.uid("event"), at: M.now(), actor: "human", type: "checkpoint.restored", message: "Restored checkpoint “" + checkpoint.name + "” as a new project", layer: null });
    if (dom.projectVaultDialog.open) dom.projectVaultDialog.close();
    addProjectToVault(restored, { message: "Checkpoint restored as a new project. The current source was not overwritten." });
  }

  function deleteCheckpoint(projectId, checkpointId) {
    const record = vault.projects[projectId];
    const checkpoint = record && record.checkpoints.find(function (item) { return item.id === checkpointId; });
    if (!checkpoint) return;
    showConfirm("Permanently remove this checkpoint?", "“" + checkpoint.name + "” will be removed from this device. Its project remains untouched.", "Remove checkpoint", function () {
      record.checkpoints = record.checkpoints.filter(function (item) { return item.id !== checkpointId; });
      storeVaultState();
      hideConfirm();
      renderProjectVault();
      toast("Checkpoint permanently removed. The project was not changed.", "warning");
    });
  }

  function duplicateVaultProject(projectId) {
    const record = vault.projects[projectId];
    if (!record || !canCreateProject()) return;
    const copy = M.clone(record.project);
    copy.id = M.uid("project");
    copy.name = (copy.name + " copy").slice(0, 160);
    copy.meta.createdAt = M.now();
    copy.meta.updatedAt = M.now();
    copy.ledger.push({ id: M.uid("event"), at: M.now(), actor: "human", type: "project.duplicated", message: "Duplicated project into a new local source identity", layer: null });
    vault.projects[copy.id] = { project: copy, checkpoints: [], lastOpenedAt: M.now() };
    storeVaultState();
    renderProjectVault();
    toast("Project duplicated without sharing its identity.");
  }

  function trashVaultProject(projectId) {
    const record = vault.projects[projectId];
    if (!record) return;
    if (projectId === project.id) record.project = M.clone(project);
    record.deletedAt = M.now();
    vault.trash[projectId] = record;
    delete vault.projects[projectId];
    if (projectId === project.id) {
      let nextId = Object.keys(vault.projects)[0];
      if (!nextId) {
        const blank = M.getTemplate("blank").build();
        vault.projects[blank.id] = { project: blank, checkpoints: [], lastOpenedAt: M.now() };
        nextId = blank.id;
      }
      project = M.clone(vault.projects[nextId].project);
      vault.activeProjectId = nextId;
      resetProjectRuntime();
      setDirty(false);
      renderAll();
      setTimeout(fitCanvas, 20);
    }
    storeVaultState();
    renderProjectVault();
    toast("Project moved to recoverable trash.", "warning");
  }

  function restoreTrashedProject(projectId) {
    const record = vault.trash[projectId];
    if (!record || !canCreateProject()) return;
    delete record.deletedAt;
    let nextId = record.project.id;
    if (vault.projects[nextId]) {
      nextId = M.uid("project");
      record.project.id = nextId;
      record.project.ledger.push({ id: M.uid("event"), at: M.now(), actor: "human", type: "project.identity.changed", message: "Restored with a new identity to avoid overwriting an active project", layer: null });
    }
    vault.projects[nextId] = record;
    delete vault.trash[projectId];
    storeVaultState();
    renderProjectVault();
    toast("Project restored from trash.");
  }

  function exportVaultProject(projectId, fromTrash) {
    const record = (fromTrash ? vault.trash : vault.projects)[projectId];
    if (!record) return;
    downloadBlob(JSON.stringify(record.project, null, 2), "application/json", M.slugify(record.project.name) + ".axm-project.json");
    toast("Portable project source downloaded.");
  }

  function handleVaultClick(event) {
    const open = event.target.closest("[data-open-project]");
    if (open) { openVaultProject(open.dataset.openProject); return; }
    const duplicate = event.target.closest("[data-duplicate-project]");
    if (duplicate) { duplicateVaultProject(duplicate.dataset.duplicateProject); return; }
    const trash = event.target.closest("[data-trash-project]");
    if (trash) { trashVaultProject(trash.dataset.trashProject); return; }
    const restore = event.target.closest("[data-restore-project]");
    if (restore) { restoreTrashedProject(restore.dataset.restoreProject); return; }
    const checkpoint = event.target.closest("[data-restore-checkpoint]");
    if (checkpoint) { restoreCheckpoint(checkpoint.dataset.projectId, checkpoint.dataset.restoreCheckpoint); return; }
    const deleteCheckpointButton = event.target.closest("[data-delete-checkpoint]");
    if (deleteCheckpointButton) { deleteCheckpoint(deleteCheckpointButton.dataset.projectId, deleteCheckpointButton.dataset.deleteCheckpoint); return; }
    const exportButton = event.target.closest("[data-export-vault-project]");
    if (exportButton) { exportVaultProject(exportButton.dataset.exportVaultProject, exportButton.dataset.fromTrash === "true"); return; }
    if (event.target.closest("[data-empty-trash]")) {
      const count = Object.keys(vault.trash).length;
      showConfirm("Permanently empty recoverable trash?", count + " project" + (count === 1 ? "" : "s") + " and their checkpoints will be removed from this device. Export anything you may need first.", "Permanently empty", function () {
        vault.trash = {};
        storeVaultState();
        hideConfirm();
        renderProjectVault();
        toast("Recoverable trash was permanently emptied.", "warning");
      });
    }
  }

  function snapshot() {
    return JSON.stringify(project);
  }

  function pushUndo(serialized) {
    runtime.undo.push(serialized || snapshot());
    if (runtime.undo.length > MAX_HISTORY) runtime.undo.shift();
    runtime.redo.length = 0;
    updateHistoryButtons();
  }

  function addLedger(type, message, layer, actor) {
    project.ledger = Array.isArray(project.ledger) ? project.ledger : [];
    project.ledger.push({
      id: M.uid("event"),
      at: M.now(),
      actor: actor || "human",
      type: type,
      message: message,
      layer: layer || null
    });
    if (project.ledger.length > 500) project.ledger = project.ledger.slice(-500);
  }

  function commit(label, options, mutation) {
    options = options || {};
    pushUndo();
    mutation();
    project.meta.updatedAt = M.now();
    addLedger(options.type || "project.changed", label, options.layer || null, options.actor || "human");
    scheduleSave(Boolean(options.immediate));
    if (options.render !== false) renderAll();
  }

  function undo() {
    if (!runtime.undo.length) return;
    runtime.redo.push(snapshot());
    const restored = runtime.undo.pop();
    project = JSON.parse(restored);
    project.meta.updatedAt = M.now();
    addLedger("history.undo", "Undid the most recent project change", null);
    runtime.selectedNodeId = null;
    runtime.pendingConnection = null;
    scheduleSave(true);
    renderAll();
    toast("Change undone. The previous state remains available to redo.");
  }

  function redo() {
    if (!runtime.redo.length) return;
    runtime.undo.push(snapshot());
    const restored = runtime.redo.pop();
    project = JSON.parse(restored);
    project.meta.updatedAt = M.now();
    addLedger("history.redo", "Restored the next project state", null);
    runtime.selectedNodeId = null;
    runtime.pendingConnection = null;
    scheduleSave(true);
    renderAll();
    toast("Change restored.");
  }

  function updateHistoryButtons() {
    dom.undoButton.disabled = runtime.undo.length === 0;
    dom.redoButton.disabled = runtime.redo.length === 0;
  }

  function activeLayerData() {
    return project.layers[runtime.activeLayer];
  }

  function selectedNode() {
    if (!runtime.selectedNodeId) return null;
    return M.findNode(project, runtime.selectedNodeId);
  }

  function selectedNodeLayer() {
    return runtime.selectedNodeId ? M.nodeLayer(project, runtime.selectedNodeId) : null;
  }

  function layerRgb(layer) {
    return (M.LAYERS[layer] || M.LAYERS.logic).rgb;
  }

  function applyLayerTheme() {
    const meta = M.LAYERS[runtime.activeLayer];
    document.documentElement.style.setProperty("--layer-rgb", meta.rgb);
    document.documentElement.style.setProperty("--layer-color", meta.color);
    dom.contextPulse.style.setProperty("--layer-rgb", meta.rgb);
    dom.contextPulse.querySelector("span").textContent = meta.index;
    dom.contextTitle.textContent = meta.canvasLabel;
    dom.contextDescription.textContent = meta.description;
    dom.paletteTitle.textContent = meta.label + " blocks";
    dom.canvasSurface.className = "canvas-surface " + meta.id + "-surface";
    dom.canvasViewport.style.setProperty("--layer-rgb", meta.rgb);
    dom.connectionToast.style.setProperty("--layer-rgb", meta.rgb);
    $$(".layer-button").forEach(function (button) {
      const active = button.dataset.layer === runtime.activeLayer;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }

  function renderAll() {
    applyLayerTheme();
    dom.projectNameTop.value = project.name;
    renderPalette();
    renderCanvas();
    renderInspector();
    updateStatus();
    updateHistoryButtons();
    if (!runtime.drag && !runtime.paletteDrag && !(runtime.palettePointer && runtime.palettePointer.active)) resetCoordinateStatus();
    storeUiState();
    if (dom.aiWorkbenchDialog && dom.aiWorkbenchDialog.open) refreshAgentWorkspace(true);
  }

  function renderPalette() {
    const query = runtime.paletteSearch.trim().toLowerCase();
    const groups = new Map();
    M.BLOCKS[runtime.activeLayer].forEach(function (block) {
      const haystack = [block.label, block.subtitle, block.description, block.group, (block.tags || []).join(" ")].join(" ").toLowerCase();
      if (query && !haystack.includes(query)) return;
      if (!groups.has(block.group)) groups.set(block.group, []);
      groups.get(block.group).push(block);
    });

    if (!groups.size) {
      dom.blockList.innerHTML = '<div class="no-block-results">No blocks match “' + M.escapeHtml(runtime.paletteSearch) + '”.</div>';
      return;
    }

    dom.blockList.innerHTML = Array.from(groups.entries()).map(function (entry) {
      const group = entry[0], blocks = entry[1];
      return '<section class="block-group"><h3 class="block-group-title">' + M.escapeHtml(group) + "</h3>" + blocks.map(function (block) {
        return '<article class="palette-block" draggable="true" aria-grabbed="false" data-block-type="' + M.escapeHtml(block.type) + '" data-axm-block-type="' + M.escapeHtml(block.type) + '" data-axm-layer="' + M.escapeHtml(runtime.activeLayer) + '" aria-label="' + M.escapeHtml(block.label + ", " + block.subtitle + ". Drag onto the canvas or use the plus button.") + '" style="--block-rgb:' + block.rgb + '">' +
          '<span class="block-symbol">' + M.icon(block.icon) + '</span><span class="block-copy"><b>' + M.escapeHtml(block.label) + '</b><small>' + M.escapeHtml(block.subtitle) + '</small></span>' +
          '<button class="add-block-button" type="button" data-add-block="' + M.escapeHtml(block.type) + '" aria-label="Add ' + M.escapeHtml(block.label) + '">+</button></article>';
      }).join("") + "</section>";
    }).join("");

    $$(".palette-block", dom.blockList).forEach(function (block) {
      block.addEventListener("dragstart", onPaletteDragStart);
      block.addEventListener("dragend", onPaletteDragEnd);
    });
  }

  function nodeConfigChips(node) {
    const entries = Object.entries(node.config || {}).filter(function (entry) {
      return entry[1] !== "" && entry[1] != null && typeof entry[1] !== "object";
    }).slice(0, 2);
    const chips = entries.map(function (entry) {
      return '<span class="node-chip" title="' + M.escapeHtml(entry[0]) + '">' + M.escapeHtml(String(entry[1])) + "</span>";
    });
    const bindings = M.bindingCount(project, node.id);
    if (bindings) chips.push('<span class="node-chip binding-chip">' + bindings + " bound</span>");
    const definition = M.getDefinition(node.layer, node.type);
    const influence = M.normalizeInfluence(node.influence, node.layer, node.type);
    const visualStateCount = Object.keys(influence.visualStates || {}).filter(function (stateId) {
      const state = influence.visualStates[stateId] || {};
      return Boolean(String(state.assetRef || "").trim() || String(state.color || "").trim() || String(state.notes || "").trim());
    }).length;
    if (influence.rules.length) chips.push('<span class="node-chip binding-chip">' + influence.rules.length + " reaction" + (influence.rules.length === 1 ? "" : "s") + "</span>");
    if (visualStateCount) chips.push('<span class="node-chip">' + visualStateCount + " visual" + (visualStateCount === 1 ? "" : "s") + "</span>");
    if (influence.codeHooks.length) chips.push('<span class="node-chip warning-chip">' + influence.codeHooks.length + " code draft" + (influence.codeHooks.length === 1 ? "" : "s") + "</span>");
    if (node.permission && !node.permission.approved) chips.push('<span class="node-chip warning-chip">consent needed</span>');
    if (node.layer === "capabilities" && M.CONTRACT_ONLY_CAPABILITIES.has(node.type)) chips.push('<span class="node-chip">contract-only β</span>');
    if (!chips.length) chips.push('<span class="node-chip">ready to configure</span>');
    return chips.join("");
  }

  function renderNode(node) {
    const definition = M.getDefinition(node.layer, node.type);
    const selected = runtime.selectedNodeId === node.id;
    const pending = runtime.pendingConnection && runtime.pendingConnection.nodeId === node.id;
    const classes = ["builder-node"];
    if (selected) classes.push("selected");
    if (node.enabled === false) classes.push("disabled-node");
    if (node.permission && !node.permission.approved) classes.push("needs-consent");
    const accessibleLabel = node.label + ", " + M.LAYERS[node.layer].label + " block, " + definition.subtitle;
    return '<article class="' + classes.join(" ") + '" data-node-id="' + M.escapeHtml(node.id) + '" data-axm-node-id="' + M.escapeHtml(node.id) + '" data-axm-layer="' + M.escapeHtml(node.layer) + '" data-axm-type="' + M.escapeHtml(node.type) + '" tabindex="0" role="group" aria-selected="' + (selected ? "true" : "false") + '" aria-label="' + M.escapeHtml(accessibleLabel) + '" style="left:' + Math.round(node.x) + "px;top:" + Math.round(node.y) + "px;--block-rgb:" + definition.rgb + '">' +
      '<span class="node-topline"></span>' +
      (definition.input ? '<button class="node-port input-port" type="button" data-port="input" title="Connect input" aria-label="Connect an input route to ' + M.escapeHtml(node.label) + '"><span class="node-port-label">input</span></button>' : "") +
      '<header class="node-header" title="Drag to move · hold Shift for free placement"><span class="node-symbol">' + M.icon(definition.icon) + '</span><span class="node-title"><b>' + M.escapeHtml(node.label) + '</b><small>' + M.escapeHtml(definition.subtitle) + '</small></span><button class="node-menu-button" type="button" data-node-menu title="Inspect block" aria-label="Inspect ' + M.escapeHtml(node.label) + '">•••</button></header>' +
      '<div class="node-body">' + nodeConfigChips(node) + "</div>" +
      (definition.output ? '<button class="node-port output-port' + (pending ? " pending" : "") + '" type="button" data-port="output" title="Start connection" aria-label="Start an output route from ' + M.escapeHtml(node.label) + '"><span class="node-port-label">output</span></button>' : "") +
      "</article>";
  }

  function renderCanvas() {
    const data = activeLayerData();
    dom.canvasSurface.style.transform = "scale(" + runtime.zoom + ")";
    dom.canvasScaleWrap.style.width = Math.round(CANVAS_WIDTH * runtime.zoom) + "px";
    dom.canvasScaleWrap.style.height = Math.round(CANVAS_HEIGHT * runtime.zoom) + "px";
    dom.zoomOutput.textContent = Math.round(runtime.zoom * 100) + "%";
    dom.nodeLayer.innerHTML = data.nodes.map(renderNode).join("");
    dom.emptyCanvas.classList.toggle("hidden", data.nodes.length > 0);
    renderEdges();
  }

  function edgePath(fromNode, toNode) {
    const x1 = fromNode.x + NODE_WIDTH;
    const y1 = fromNode.y + NODE_HEIGHT / 2;
    const x2 = toNode.x;
    const y2 = toNode.y + NODE_HEIGHT / 2;
    const distance = Math.max(70, Math.abs(x2 - x1) * 0.45);
    const c1 = x1 + distance;
    const c2 = x2 - distance;
    return "M " + x1 + " " + y1 + " C " + c1 + " " + y1 + ", " + c2 + " " + y2 + ", " + x2 + " " + y2;
  }

  function renderEdges() {
    const data = activeLayerData();
    const nodes = new Map(data.nodes.map(function (node) { return [node.id, node]; }));
    dom.edgeLayer.setAttribute("viewBox", "0 0 " + CANVAS_WIDTH + " " + CANVAS_HEIGHT);
    dom.edgeLayer.innerHTML = data.edges.map(function (edge) {
      const from = nodes.get(edge.from), to = nodes.get(edge.to);
      if (!from || !to) return "";
      const path = edgePath(from, to);
      const selected = runtime.selectedEdgeId === edge.id ? " selected" : "";
      return '<g data-edge-id="' + M.escapeHtml(edge.id) + '"><path class="edge-shadow" d="' + path + '"></path><path class="edge-path' + selected + '" d="' + path + '"></path><path class="edge-flow" d="' + path + '"></path></g>';
    }).join("");
  }

  function updateStatus() {
    const counts = {};
    Object.keys(M.LAYERS).forEach(function (layer) { counts[layer] = project.layers[layer].nodes.length; });
    dom.logicCount.textContent = counts.logic;
    dom.capabilitiesCount.textContent = counts.capabilities;
    dom.visualCount.textContent = counts.visual;
    const total = counts.logic + counts.capabilities + counts.visual;
    dom.nodeStatus.textContent = total + " block" + (total === 1 ? "" : "s");
    dom.bindingStatus.textContent = project.bindings.length + " cross-layer binding" + (project.bindings.length === 1 ? "" : "s");
    runtime.lastValidation = M.validateProject(project);
    const result = runtime.lastValidation;
    dom.readinessScore.textContent = result.score + "%";
    dom.readinessFill.style.width = result.score + "%";
    dom.readinessFill.style.background = result.errors ? "var(--red)" : result.warnings ? "var(--yellow)" : "var(--green)";
    dom.readinessButton.title = result.errors + " errors, " + result.warnings + " warnings — open diagnostics";
  }

  function switchLayer(layer) {
    if (!M.LAYERS[layer]) return;
    if (window.matchMedia("(max-width: 1050px)").matches) {
      dom.inspectorPanel.classList.remove("open");
      dom.palettePanel.classList.remove("open");
    }
    if (layer === runtime.activeLayer) return;
    runtime.activeLayer = layer;
    runtime.selectedNodeId = null;
    runtime.selectedEdgeId = null;
    cancelConnection();
    clearCanvasDropPreview();
    dom.blockSearch.value = "";
    runtime.paletteSearch = "";
    renderAll();
    dom.inspectorPanel.classList.remove("open");
  }

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function canvasPointFromClient(clientX, clientY) {
    const rect = dom.canvasSurface.getBoundingClientRect();
    return {
      x: (clientX - rect.left) / runtime.zoom - NODE_WIDTH / 2,
      y: (clientY - rect.top) / runtime.zoom - NODE_HEIGHT / 2
    };
  }

  function pointInsideCanvasViewport(clientX, clientY) {
    const rect = dom.canvasViewport.getBoundingClientRect();
    return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
  }

  function bestAxisAlignment(start, size, nodes, axis) {
    const nodeSize = axis === "x" ? NODE_WIDTH : NODE_HEIGHT;
    const candidateAnchors = [start, start + size / 2, start + size];
    let best = null;
    nodes.forEach(function (node) {
      const otherStart = Number(node[axis]) || 0;
      const otherAnchors = [otherStart, otherStart + nodeSize / 2, otherStart + nodeSize];
      candidateAnchors.forEach(function (candidateAnchor) {
        otherAnchors.forEach(function (otherAnchor) {
          const difference = otherAnchor - candidateAnchor;
          const distance = Math.abs(difference);
          if (distance <= ALIGN_THRESHOLD && (!best || distance < best.distance)) {
            best = { start: start + difference, guide: otherAnchor, distance: distance };
          }
        });
      });
    });
    return best;
  }

  function resolvePlacement(position, options) {
    options = options || {};
    const freeMove = Boolean(options.freeMove);
    const nodes = activeLayerData().nodes.filter(function (node) { return node.id !== options.excludeNodeId; });
    let x = clamp(Number(position.x) || 0, 10, CANVAS_WIDTH - NODE_WIDTH - 10);
    let y = clamp(Number(position.y) || 0, 10, CANVAS_HEIGHT - NODE_HEIGHT - 10);
    let snappedToGrid = false;
    let guideX = null;
    let guideY = null;

    if (!freeMove) {
      const gridX = Math.round(x / GRID_SIZE) * GRID_SIZE;
      const gridY = Math.round(y / GRID_SIZE) * GRID_SIZE;
      snappedToGrid = Math.abs(gridX - x) > 0.01 || Math.abs(gridY - y) > 0.01;
      x = gridX;
      y = gridY;

      const alignedX = bestAxisAlignment(x, NODE_WIDTH, nodes, "x");
      const alignedY = bestAxisAlignment(y, NODE_HEIGHT, nodes, "y");
      if (alignedX) {
        x = alignedX.start;
        guideX = alignedX.guide;
      }
      if (alignedY) {
        y = alignedY.start;
        guideY = alignedY.guide;
      }
    }

    x = clamp(x, 10, CANVAS_WIDTH - NODE_WIDTH - 10);
    y = clamp(y, 10, CANVAS_HEIGHT - NODE_HEIGHT - 10);
    return {
      x: x,
      y: y,
      guideX: guideX,
      guideY: guideY,
      freeMove: freeMove,
      snappedToGrid: snappedToGrid,
      aligned: guideX != null || guideY != null
    };
  }

  function showAlignmentGuides(placement) {
    const showX = placement && placement.guideX != null;
    const showY = placement && placement.guideY != null;
    dom.alignmentGuideX.classList.toggle("hidden", !showX);
    dom.alignmentGuideY.classList.toggle("hidden", !showY);
    if (showX) dom.alignmentGuideX.style.left = Math.round(placement.guideX) + "px";
    if (showY) dom.alignmentGuideY.style.top = Math.round(placement.guideY) + "px";
  }

  function hideAlignmentGuides() {
    dom.alignmentGuideX.classList.add("hidden");
    dom.alignmentGuideY.classList.add("hidden");
  }

  function placementModeText(placement) {
    if (!placement) return "";
    if (placement.freeMove) return "free placement";
    if (placement.aligned) return "aligned";
    return "snap " + GRID_SIZE;
  }

  function updateCoordinateStatus(prefix, placement) {
    if (!dom.coordinateStatus || !placement) return;
    dom.coordinateStatus.textContent = prefix + " x " + Math.round(placement.x) + " · y " + Math.round(placement.y) + " · " + placementModeText(placement);
  }

  function resetCoordinateStatus() {
    if (dom.coordinateStatus) dom.coordinateStatus.textContent = "Canvas " + CANVAS_WIDTH + " × " + CANVAS_HEIGHT + " · snap " + GRID_SIZE;
  }

  function showCanvasDropPreview(layer, type, placement) {
    const definition = M.getDefinition(layer, type);
    dom.canvasDropPreview.style.left = Math.round(placement.x) + "px";
    dom.canvasDropPreview.style.top = Math.round(placement.y) + "px";
    dom.canvasDropPreview.style.setProperty("--block-rgb", definition.rgb);
    dom.dropPreviewSymbol.innerHTML = M.icon(definition.icon);
    dom.dropPreviewTitle.textContent = definition.label;
    dom.dropPreviewMeta.textContent = "Release to place · " + placementModeText(placement);
    dom.canvasDropPreview.classList.remove("hidden");
    dom.canvasDropPreview.classList.toggle("free-placement", placement.freeMove);
    dom.canvasViewport.classList.add("drag-over");
    dom.canvasViewport.classList.toggle("touch-drag-over", Boolean(runtime.palettePointer && runtime.palettePointer.active));
    showAlignmentGuides(placement);
    updateCoordinateStatus("Drop", placement);
  }

  function clearCanvasDropPreview() {
    if (dom.canvasDropPreview) dom.canvasDropPreview.classList.add("hidden");
    if (dom.canvasViewport) dom.canvasViewport.classList.remove("drag-over", "touch-drag-over");
    hideAlignmentGuides();
    resetCoordinateStatus();
  }

  function autoScrollVelocity(position, start, end) {
    if (position < start || position > end) return 0;
    if (position < start + AUTOSCROLL_EDGE) {
      return -AUTOSCROLL_MAX * (1 - (position - start) / AUTOSCROLL_EDGE);
    }
    if (position > end - AUTOSCROLL_EDGE) {
      return AUTOSCROLL_MAX * (1 - (end - position) / AUTOSCROLL_EDGE);
    }
    return 0;
  }

  function autoScrollCanvasAtPoint(clientX, clientY) {
    const rect = dom.canvasViewport.getBoundingClientRect();
    const left = autoScrollVelocity(clientX, rect.left, rect.right);
    const top = autoScrollVelocity(clientY, rect.top, rect.bottom);
    if (!left && !top) return false;
    const beforeLeft = dom.canvasViewport.scrollLeft;
    const beforeTop = dom.canvasViewport.scrollTop;
    dom.canvasViewport.scrollLeft += left;
    dom.canvasViewport.scrollTop += top;
    return beforeLeft !== dom.canvasViewport.scrollLeft || beforeTop !== dom.canvasViewport.scrollTop;
  }

  function hasTransferType(dataTransfer, type) {
    return Boolean(dataTransfer && Array.from(dataTransfer.types || []).includes(type));
  }

  function isKnownPaletteBlock(layer, type) {
    return Boolean(M.BLOCKS[layer] && M.BLOCKS[layer].some(function (block) { return block.type === type; }));
  }

  function addNode(type, position) {
    const data = activeLayerData();
    if (!isKnownPaletteBlock(runtime.activeLayer, type)) {
      toast("That block is not available on the active layer.", "warning");
      return null;
    }
    const viewportRect = dom.canvasViewport.getBoundingClientRect();
    const rawPosition = {
      x: position && Number.isFinite(position.x) ? position.x : (dom.canvasViewport.scrollLeft + viewportRect.width / 2) / runtime.zoom - NODE_WIDTH / 2 + (data.nodes.length % 4) * 18,
      y: position && Number.isFinite(position.y) ? position.y : (dom.canvasViewport.scrollTop + viewportRect.height / 2) / runtime.zoom - NODE_HEIGHT / 2 + (data.nodes.length % 5) * 15
    };
    const placement = resolvePlacement(rawPosition, { freeMove: Boolean(position && position.freeMove) });
    const node = M.createNode(runtime.activeLayer, type, placement.x, placement.y);
    commit("Added “" + node.label + "”", { type: "block.added", layer: runtime.activeLayer }, function () {
      data.nodes.push(node);
      runtime.selectedNodeId = node.id;
      runtime.inspectorTab = "inspect";
    });
    dom.inspectorPanel.classList.add("open");
    toast(node.label + " added to the " + M.LAYERS[runtime.activeLayer].label.toLowerCase() + " layer.");
    return node;
  }

  function createPaletteDragImage(layer, type) {
    const definition = M.getDefinition(layer, type);
    const image = document.createElement("div");
    image.className = "palette-drag-image";
    image.setAttribute("aria-hidden", "true");
    image.style.setProperty("--block-rgb", definition.rgb);
    image.innerHTML = '<span class="block-symbol">' + M.icon(definition.icon) + '</span><span><b>' + M.escapeHtml(definition.label) + '</b><small>' + M.escapeHtml(definition.subtitle) + '</small></span>';
    document.body.appendChild(image);
    return image;
  }

  function cleanupNativePaletteDrag(source) {
    if (source) {
      source.classList.remove("dragging");
      source.setAttribute("aria-grabbed", "false");
    }
    if (runtime.paletteDrag && runtime.paletteDrag.dragImage) runtime.paletteDrag.dragImage.remove();
    runtime.paletteDrag = null;
    document.body.classList.remove("axm-dragging");
    clearCanvasDropPreview();
  }

  function onPaletteDragStart(event) {
    const block = event.currentTarget;
    if (event.target.closest("button") || !event.dataTransfer) {
      event.preventDefault();
      return;
    }
    const layer = runtime.activeLayer;
    const type = block.dataset.blockType;
    if (!isKnownPaletteBlock(layer, type)) {
      event.preventDefault();
      return;
    }
    const dragImage = createPaletteDragImage(layer, type);
    runtime.paletteDrag = { layer: layer, type: type, source: block, dragImage: dragImage };
    block.classList.add("dragging");
    block.setAttribute("aria-grabbed", "true");
    document.body.classList.add("axm-dragging");
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData("application/x-axm-block", JSON.stringify({ layer: layer, type: type }));
    event.dataTransfer.setData("text/plain", type);
    try { event.dataTransfer.setDragImage(dragImage, 32, 27); }
    catch (_) { /* Native browser drag image remains usable. */ }
  }

  function onPaletteDragEnd(event) {
    cleanupNativePaletteDrag(event.currentTarget);
  }

  function dropPosition(event) {
    return canvasPointFromClient(event.clientX, event.clientY);
  }

  function updatePaletteDropPreview(layer, type, clientX, clientY, freeMove) {
    if (layer !== runtime.activeLayer || !isKnownPaletteBlock(layer, type) || !pointInsideCanvasViewport(clientX, clientY)) {
      clearCanvasDropPreview();
      return null;
    }
    autoScrollCanvasAtPoint(clientX, clientY);
    const placement = resolvePlacement(canvasPointFromClient(clientX, clientY), { freeMove: Boolean(freeMove) });
    showCanvasDropPreview(layer, type, placement);
    return placement;
  }

  function createPalettePointerGhost(layer, type) {
    const definition = M.getDefinition(layer, type);
    const ghost = document.createElement("div");
    ghost.className = "palette-touch-ghost";
    ghost.setAttribute("aria-hidden", "true");
    ghost.style.setProperty("--block-rgb", definition.rgb);
    ghost.innerHTML = '<span class="block-symbol">' + M.icon(definition.icon) + '</span><span><b>' + M.escapeHtml(definition.label) + '</b><small>Drag onto the canvas</small></span>';
    document.body.appendChild(ghost);
    return ghost;
  }

  function positionPalettePointerGhost(pointer) {
    if (!pointer || !pointer.ghost) return;
    const width = pointer.ghost.offsetWidth || 214;
    const height = pointer.ghost.offsetHeight || 58;
    let left = pointer.clientX + 16;
    let top = pointer.clientY + 16;
    if (left + width > window.innerWidth - 8) left = pointer.clientX - width - 16;
    if (top + height > window.innerHeight - 8) top = pointer.clientY - height - 16;
    pointer.ghost.style.left = Math.round(clamp(left, 8, Math.max(8, window.innerWidth - width - 8))) + "px";
    pointer.ghost.style.top = Math.round(clamp(top, 8, Math.max(8, window.innerHeight - height - 8))) + "px";
  }

  function runPalettePointerFrame() {
    const pointer = runtime.palettePointer;
    if (!pointer || !pointer.active) return;
    positionPalettePointerGhost(pointer);
    pointer.placement = updatePaletteDropPreview(pointer.layer, pointer.type, pointer.clientX, pointer.clientY, false);
    pointer.frame = requestAnimationFrame(runPalettePointerFrame);
  }

  function startPalettePointerDrag(pointer) {
    pointer.active = true;
    pointer.source.classList.add("touch-dragging");
    pointer.source.setAttribute("aria-grabbed", "true");
    pointer.ghost = createPalettePointerGhost(pointer.layer, pointer.type);
    pointer.paletteWasOpen = dom.palettePanel.classList.contains("open");
    if (pointer.paletteWasOpen) dom.palettePanel.classList.remove("open");
    document.body.classList.add("axm-dragging");
    positionPalettePointerGhost(pointer);
    pointer.frame = requestAnimationFrame(runPalettePointerFrame);
  }

  function cleanupPalettePointerDrag(reopenPalette) {
    const pointer = runtime.palettePointer;
    if (!pointer) return;
    if (pointer.frame) cancelAnimationFrame(pointer.frame);
    if (pointer.ghost) pointer.ghost.remove();
    if (pointer.source) {
      pointer.source.classList.remove("touch-dragging");
      pointer.source.setAttribute("aria-grabbed", "false");
      try {
        if (pointer.source.hasPointerCapture(pointer.pointerId)) pointer.source.releasePointerCapture(pointer.pointerId);
      } catch (_) { /* Pointer already released. */ }
    }
    runtime.palettePointer = null;
    document.body.classList.remove("axm-dragging");
    clearCanvasDropPreview();
    if (reopenPalette) setTimeout(function () { dom.palettePanel.classList.add("open"); }, 0);
  }

  function onPalettePointerDown(event) {
    if (event.pointerType === "mouse" || event.button !== 0 || runtime.palettePointer) return;
    const block = event.target.closest(".palette-block");
    if (!block || event.target.closest("button") || !dom.blockList.contains(block)) return;
    const layer = runtime.activeLayer;
    const type = block.dataset.blockType;
    if (!isKnownPaletteBlock(layer, type)) return;
    runtime.palettePointer = {
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      source: block,
      layer: layer,
      type: type,
      startX: event.clientX,
      startY: event.clientY,
      clientX: event.clientX,
      clientY: event.clientY,
      active: false,
      paletteWasOpen: false,
      placement: null,
      frame: null,
      ghost: null
    };
    try { block.setPointerCapture(event.pointerId); }
    catch (_) { runtime.palettePointer = null; }
  }

  function onPalettePointerMove(event) {
    const pointer = runtime.palettePointer;
    if (!pointer || event.pointerId !== pointer.pointerId) return;
    pointer.clientX = event.clientX;
    pointer.clientY = event.clientY;
    if (!pointer.active) {
      const dx = event.clientX - pointer.startX;
      const dy = event.clientY - pointer.startY;
      const distance = Math.hypot(dx, dy);
      if (Math.abs(dy) > TOUCH_DRAG_START_THRESHOLD && Math.abs(dy) > Math.abs(dx) * 1.4) {
        cleanupPalettePointerDrag(false);
        return;
      }
      if (distance < TOUCH_DRAG_START_THRESHOLD) return;
      startPalettePointerDrag(pointer);
    }
    event.preventDefault();
    positionPalettePointerGhost(pointer);
  }

  function onPalettePointerUp(event) {
    const pointer = runtime.palettePointer;
    if (!pointer || event.pointerId !== pointer.pointerId) return;
    pointer.clientX = event.clientX;
    pointer.clientY = event.clientY;
    if (!pointer.active) {
      cleanupPalettePointerDrag(false);
      return;
    }
    pointer.placement = updatePaletteDropPreview(pointer.layer, pointer.type, pointer.clientX, pointer.clientY, false);
    const validDrop = pointer.layer === runtime.activeLayer && pointer.placement;
    const placement = pointer.placement;
    const type = pointer.type;
    const reopenPalette = pointer.paletteWasOpen && !validDrop;
    cleanupPalettePointerDrag(reopenPalette);
    if (validDrop) {
      addNode(type, placement);
      dom.palettePanel.classList.remove("open");
    } else {
      toast("Drop cancelled. Nothing changed.", "warning");
    }
  }

  function onPalettePointerCancel(event) {
    const pointer = runtime.palettePointer;
    if (!pointer || event.pointerId !== pointer.pointerId) return;
    cleanupPalettePointerDrag(pointer.paletteWasOpen);
  }

  function selectNode(nodeId) {
    if (runtime.selectedNodeId !== nodeId) runtime.influencePreview = null;
    runtime.selectedNodeId = nodeId;
    runtime.selectedEdgeId = null;
    runtime.inspectorTab = "inspect";
    renderCanvas();
    renderInspector();
    dom.inspectorPanel.classList.add("open");
  }

  function startConnection(nodeId) {
    runtime.pendingConnection = { nodeId: nodeId, layer: runtime.activeLayer };
    const node = M.findNode(project, nodeId);
    dom.connectionToastText.textContent = "Connect “" + (node ? node.label : "block") + "” to an input port";
    dom.connectionToast.classList.remove("hidden");
    renderCanvas();
  }

  function cancelConnection() {
    runtime.pendingConnection = null;
    if (dom.connectionToast) dom.connectionToast.classList.add("hidden");
    if (dom.nodeLayer) renderCanvas();
  }

  function completeConnection(targetId) {
    if (!runtime.pendingConnection) return;
    const sourceId = runtime.pendingConnection.nodeId;
    if (sourceId === targetId) {
      toast("A block cannot route directly into itself. Add another block for an intentional loop.", "warning");
      return;
    }
    const data = activeLayerData();
    if (data.edges.some(function (edge) { return edge.from === sourceId && edge.to === targetId; })) {
      toast("That route already exists.", "warning");
      cancelConnection();
      return;
    }
    const source = M.findNode(project, sourceId), target = M.findNode(project, targetId);
    commit("Connected “" + source.label + "” to “" + target.label + "”", { type: "route.connected", layer: runtime.activeLayer }, function () {
      data.edges.push({ id: M.uid("edge"), from: sourceId, to: targetId, label: "flow", createdAt: M.now() });
      runtime.pendingConnection = null;
    });
    dom.connectionToast.classList.add("hidden");
    toast("Route connected.");
  }

  function removeNode(nodeId) {
    const layer = M.nodeLayer(project, nodeId);
    if (!layer) return;
    const node = M.findNode(project, nodeId);
    commit("Removed “" + node.label + "”", { type: "block.removed", layer: layer }, function () {
      project.layers[layer].nodes = project.layers[layer].nodes.filter(function (item) { return item.id !== nodeId; });
      project.layers[layer].edges = project.layers[layer].edges.filter(function (edge) { return edge.from !== nodeId && edge.to !== nodeId; });
      project.bindings = project.bindings.filter(function (binding) { return binding.source !== nodeId && binding.target !== nodeId; });
      runtime.selectedNodeId = null;
      runtime.pendingConnection = null;
    });
    toast(node.label + " removed. Undo remains available.", "warning");
  }

  function duplicateNode(nodeId) {
    const source = M.findNode(project, nodeId);
    const layer = source && M.nodeLayer(project, nodeId);
    if (!source || !layer) return;
    const duplicate = M.createNode(layer, source.type, Math.min(CANVAS_WIDTH - NODE_WIDTH - 25, source.x + 34), Math.min(CANVAS_HEIGHT - NODE_HEIGHT - 25, source.y + 34), {
      label: (source.label + " copy").slice(0, 200),
      summary: source.summary,
      enabled: source.enabled !== false,
      config: M.clone(source.config || {}),
      influence: M.clone(source.influence || {}),
      provenance: M.clone(source.provenance || {})
    });
    duplicate.influence = M.normalizeInfluence(duplicate.influence, layer, duplicate.type);
    duplicate.influence.codeHooks.forEach(function (hook) {
      hook.enabled = false;
      hook.execution = "CONTRACT_ONLY";
    });
    if (duplicate.permission) duplicate.permission = { id: duplicate.permission.id, approved: false, reviewedAt: null };
    commit("Duplicated “" + source.label + "” without copying routes or consent", { type: "block.duplicated", layer: layer }, function () {
      project.layers[layer].nodes.push(duplicate);
      runtime.selectedNodeId = duplicate.id;
    });
    toast(duplicate.label + " created. Its own reactions and visual settings were copied; permission approval and routes were not.");
  }

  function removeEdge(edgeId) {
    const data = activeLayerData();
    const edge = data.edges.find(function (item) { return item.id === edgeId; });
    if (!edge) return;
    commit("Removed a visible route", { type: "route.removed", layer: runtime.activeLayer }, function () {
      data.edges = data.edges.filter(function (item) { return item.id !== edgeId; });
    });
  }

  function applyNodeDragPosition() {
    const drag = runtime.drag;
    if (!drag || !drag.moved) return;
    const node = M.findNode(project, drag.nodeId);
    if (!node) return;
    autoScrollCanvasAtPoint(drag.clientX, drag.clientY);
    const scrollX = (dom.canvasViewport.scrollLeft - drag.startScrollLeft) / runtime.zoom;
    const scrollY = (dom.canvasViewport.scrollTop - drag.startScrollTop) / runtime.zoom;
    const rawPosition = {
      x: drag.nodeX + (drag.clientX - drag.startX) / runtime.zoom + scrollX,
      y: drag.nodeY + (drag.clientY - drag.startY) / runtime.zoom + scrollY
    };
    const placement = resolvePlacement(rawPosition, { excludeNodeId: drag.nodeId, freeMove: drag.shiftKey });
    drag.lastPlacement = placement;
    node.x = placement.x;
    node.y = placement.y;
    const element = dom.nodeLayer.querySelector('[data-node-id="' + CSS.escape(node.id) + '"]');
    if (element) {
      element.style.left = Math.round(node.x) + "px";
      element.style.top = Math.round(node.y) + "px";
    }
    showAlignmentGuides(placement);
    updateCoordinateStatus("Move", placement);
    renderEdges();
  }

  function runNodeDragFrame() {
    const drag = runtime.drag;
    if (!drag) return;
    applyNodeDragPosition();
    drag.frame = requestAnimationFrame(runNodeDragFrame);
  }

  function beginNodeDrag(event, nodeElement) {
    if (event.button !== 0 || event.target.closest("button") || runtime.drag) return;
    const nodeId = nodeElement.dataset.nodeId;
    const node = M.findNode(project, nodeId);
    if (!node) return;
    event.preventDefault();
    runtime.selectedNodeId = nodeId;
    runtime.selectedEdgeId = null;
    runtime.inspectorTab = "inspect";
    $$(".builder-node", dom.nodeLayer).forEach(function (element) { element.classList.toggle("selected", element === nodeElement); });
    renderInspector();
    dom.inspectorPanel.classList.add("open");
    runtime.drag = {
      nodeId: nodeId,
      startX: event.clientX,
      startY: event.clientY,
      clientX: event.clientX,
      clientY: event.clientY,
      startScrollLeft: dom.canvasViewport.scrollLeft,
      startScrollTop: dom.canvasViewport.scrollTop,
      nodeX: node.x,
      nodeY: node.y,
      before: snapshot(),
      moved: false,
      shiftKey: Boolean(event.shiftKey),
      pointerId: event.pointerId,
      frame: null,
      lastPlacement: null
    };
    try { nodeElement.setPointerCapture(event.pointerId); }
    catch (_) { runtime.drag = null; return; }
    nodeElement.classList.add("is-dragging");
    dom.canvasViewport.classList.add("node-dragging");
    document.body.classList.add("axm-dragging");
    dom.coordinateStatus.textContent = "Drag block · snap " + GRID_SIZE + " · hold Shift for free placement";
    nodeElement.addEventListener("pointermove", onNodeDragMove);
    nodeElement.addEventListener("pointerup", endNodeDrag, { once: true });
    nodeElement.addEventListener("pointercancel", endNodeDrag, { once: true });
    runtime.drag.frame = requestAnimationFrame(runNodeDragFrame);
  }

  function onNodeDragMove(event) {
    const drag = runtime.drag;
    if (!drag || event.pointerId !== drag.pointerId) return;
    event.preventDefault();
    drag.clientX = event.clientX;
    drag.clientY = event.clientY;
    drag.shiftKey = Boolean(event.shiftKey);
    if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) >= DRAG_START_THRESHOLD) drag.moved = true;
    applyNodeDragPosition();
  }

  function endNodeDrag(event) {
    const drag = runtime.drag;
    const element = event.currentTarget;
    if (!drag || event.pointerId !== drag.pointerId) return;
    drag.clientX = event.clientX;
    drag.clientY = event.clientY;
    drag.shiftKey = Boolean(event.shiftKey);
    if (drag.moved) applyNodeDragPosition();
    if (drag.frame) cancelAnimationFrame(drag.frame);
    element.removeEventListener("pointermove", onNodeDragMove);
    element.removeEventListener("pointerup", endNodeDrag);
    element.removeEventListener("pointercancel", endNodeDrag);
    try {
      if (element.hasPointerCapture(drag.pointerId)) element.releasePointerCapture(drag.pointerId);
    } catch (_) { /* Pointer already released. */ }
    element.classList.remove("is-dragging");
    dom.canvasViewport.classList.remove("node-dragging");
    document.body.classList.remove("axm-dragging");
    hideAlignmentGuides();
    resetCoordinateStatus();

    const node = M.findNode(project, drag.nodeId);
    const cancelled = event.type === "pointercancel";
    runtime.drag = null;
    if (!node || !drag.moved) return;

    if (cancelled) {
      node.x = drag.nodeX;
      node.y = drag.nodeY;
      const restoredElement = dom.nodeLayer.querySelector('[data-node-id="' + CSS.escape(node.id) + '"]');
      if (restoredElement) {
        restoredElement.style.left = Math.round(node.x) + "px";
        restoredElement.style.top = Math.round(node.y) + "px";
      }
      renderEdges();
      return;
    }

    pushUndo(drag.before);
    node.updatedAt = M.now();
    project.meta.updatedAt = M.now();
    addLedger("block.moved", "Moved “" + node.label + "” on the " + M.LAYERS[node.layer].label.toLowerCase() + " canvas", node.layer);
    scheduleSave();
    updateStatus();
    renderInspector();
    runtime.suppressNodeClickId = drag.nodeId;
    runtime.suppressNodeClickUntil = performance.now() + 220;
  }

  function inspectorEmpty() {
    return '<div class="inspector-empty"><div><div class="inspector-empty-graphic"><span></span><span></span><span></span></div><h3>Select a block to inspect it</h3><p>Every label, rule, permission, route and cross-layer binding remains visible here.</p></div></div>';
  }

  function renderConfigField(field, node) {
    const value = node.config && node.config[field.key] != null ? node.config[field.key] : "";
    const label = '<span>' + M.escapeHtml(field.label) + "</span>";
    if (field.type === "select") {
      return '<label class="field">' + label + '<select data-config-key="' + M.escapeHtml(field.key) + '">' + (field.options || []).map(function (option) {
        return '<option value="' + M.escapeHtml(option) + '"' + (String(value) === String(option) ? " selected" : "") + ">" + M.escapeHtml(option) + "</option>";
      }).join("") + "</select></label>";
    }
    if (field.type === "textarea") {
      return '<label class="field">' + label + '<textarea data-config-key="' + M.escapeHtml(field.key) + '">' + M.escapeHtml(value) + "</textarea></label>";
    }
    if (field.type === "checkbox") {
      return '<div class="switch-row"><div class="switch-copy"><b>' + M.escapeHtml(field.label) + '</b><small>Stored explicitly in this block contract.</small></div><label class="toggle"><input type="checkbox" data-config-key="' + M.escapeHtml(field.key) + '"' + (value ? " checked" : "") + '><span></span></label></div>';
    }
    const inputType = ["number", "color"].includes(field.type) ? field.type : "text";
    return '<label class="field">' + label + '<input type="' + inputType + '" data-config-key="' + M.escapeHtml(field.key) + '" value="' + M.escapeHtml(value) + '"' + (field.min != null ? ' min="' + field.min + '"' : "") + (field.max != null ? ' max="' + field.max + '"' : "") + "></label>";
  }


  function influenceOptions(items, selected) {
    const list = items || [];
    const imported = selected && !list.some(function (item) { return item.id === selected; }) ? '<option value="' + M.escapeHtml(selected) + '" selected>Imported: ' + M.escapeHtml(selected) + '</option>' : "";
    return imported + list.map(function (item) {
      return '<option value="' + M.escapeHtml(item.id) + '"' + (item.id === selected ? " selected" : "") + '>' + M.escapeHtml(item.label) + '</option>';
    }).join("");
  }

  function configuredVisualStateCount(influence) {
    return Object.keys(influence.visualStates || {}).filter(function (stateId) {
      const state = influence.visualStates[stateId] || {};
      return Boolean(String(state.assetRef || "").trim() || String(state.color || "").trim() || String(state.notes || "").trim());
    }).length;
  }

  function renderInfluencePreview(node) {
    const preview = runtime.influencePreview;
    if (!preview || preview.nodeId !== node.id) return "";
    const steps = (preview.steps || []).map(function (step, index) {
      return '<li><span>' + (index + 1) + '</span><p>' + M.escapeHtml(step.sentence) + '</p></li>';
    }).join("");
    return '<div class="influence-preview" role="status"><div class="influence-preview-title"><b>Safe preview</b><small>NOT APPLIED</small></div>' +
      (steps ? '<ol>' + steps + '</ol>' : '<p>No enabled reaction matched this moment.</p>') +
      '<p class="influence-disclosure">' + M.escapeHtml(preview.disclosure || "This preview does not change source.") + '</p></div>';
  }

  function renderInfluenceRules(node, profile, influence) {
    const rules = influence.rules || [];
    const cards = rules.length ? rules.map(function (rule, index) {
      const actionDefinition = (profile.actions || []).find(function (item) { return item.id === rule.action; });
      const detailLabel = actionDefinition ? actionDefinition.valueLabel : "Action detail";
      const placeholder = actionDefinition ? actionDefinition.placeholder : "Describe the intended result";
      return '<article class="influence-rule-card" data-influence-rule-card="' + M.escapeHtml(rule.id) + '">' +
        '<div class="influence-rule-head"><div><span class="influence-rule-number">Reaction ' + (index + 1) + '</span><b>' + M.escapeHtml(rule.enabled !== false ? "Active" : "Paused") + '</b></div><div class="influence-rule-head-actions"><label class="mini-switch" title="Turn this reaction on or off"><input type="checkbox" data-influence-rule-id="' + M.escapeHtml(rule.id) + '" data-influence-field="enabled"' + (rule.enabled !== false ? " checked" : "") + '><span></span></label><button class="mini-delete" type="button" data-remove-influence-rule="' + M.escapeHtml(rule.id) + '" title="Remove reaction" aria-label="Remove reaction">×</button></div></div>' +
        '<p class="influence-sentence">' + M.escapeHtml(M.influenceRuleSentence(node, rule)) + '</p>' +
        '<div class="influence-rule-grid"><label class="field"><span>When this happens</span><select data-influence-rule-id="' + M.escapeHtml(rule.id) + '" data-influence-field="trigger">' + influenceOptions(profile.triggers, rule.trigger) + '</select></label>' +
        '<label class="field"><span>This block will</span><select data-influence-rule-id="' + M.escapeHtml(rule.id) + '" data-influence-field="action">' + influenceOptions(profile.actions, rule.action) + '</select></label></div>' +
        '<label class="field"><span>' + M.escapeHtml(detailLabel) + '</span><textarea data-influence-rule-id="' + M.escapeHtml(rule.id) + '" data-influence-field="value" placeholder="' + M.escapeHtml(placeholder) + '">' + M.escapeHtml(rule.value || "") + '</textarea></label>' +
        '<label class="field"><span>Why or boundary <small>optional</small></span><textarea class="short-textarea" data-influence-rule-id="' + M.escapeHtml(rule.id) + '" data-influence-field="note" placeholder="Explain what this reaction must preserve.">' + M.escapeHtml(rule.note || "") + '</textarea></label>' +
        '<button class="influence-preview-button" type="button" data-preview-influence-rule="' + M.escapeHtml(rule.id) + '">▶ Preview this reaction safely</button></article>';
    }).join("") : '<div class="influence-empty"><b>No reactions yet</b><p>Add one below using a simple When → Do → Detail sentence.</p></div>';

    const firstTrigger = profile.triggers && profile.triggers[0] ? profile.triggers[0].id : "";
    const firstAction = profile.actions && profile.actions[0] ? profile.actions[0].id : "";
    return '<div class="influence-subsection"><div class="influence-subtitle"><div><b>Guided reactions</b><small>Only this placed block</small></div><span>' + rules.length + ' / ' + M.MAX_INFLUENCE_RULES + '</span></div>' +
      '<div class="influence-rule-list">' + cards + '</div>' + renderInfluencePreview(node) +
      '<div class="influence-add-card"><div class="influence-add-copy"><b>Add a reaction</b><p>Choose a moment, choose what this block should do, then write the visible detail.</p></div>' +
      '<div class="influence-rule-grid"><label class="field"><span>When this happens</span><select data-new-influence-trigger>' + influenceOptions(profile.triggers, firstTrigger) + '</select></label>' +
      '<label class="field"><span>This block will</span><select data-new-influence-action>' + influenceOptions(profile.actions, firstAction) + '</select></label></div>' +
      '<label class="field"><span>Detail</span><input data-new-influence-value placeholder="Message, state, route or named result"></label>' +
      '<label class="field"><span>Why or boundary <small>optional</small></span><textarea class="short-textarea" data-new-influence-note placeholder="What should this preserve?"></textarea></label>' +
      '<button class="mini-add influence-add-button" type="button" data-add-influence-rule' + (rules.length >= M.MAX_INFLUENCE_RULES ? " disabled" : "") + '>+ Add this reaction</button></div></div>';
  }

  function renderVisualStates(node, profile, influence) {
    const slots = profile.visualStates || [];
    if (!slots.length) return '<div class="influence-subsection muted-influence-subsection"><div class="influence-subtitle"><div><b>Visual states</b><small>This module has no visual slots</small></div><span>0</span></div><p class="influence-help">This block can still use settings and guided reactions. A visual state section appears only when its module declares meaningful visual slots.</p></div>';
    const configured = configuredVisualStateCount(influence);
    const cards = slots.map(function (slot) {
      const state = influence.visualStates[slot.id] || {};
      const hasValue = Boolean(String(state.assetRef || "").trim() || String(state.color || "").trim() || String(state.notes || "").trim());
      const color = M.safeColor(state.color || node.config && node.config.color || project.accent);
      return '<details class="visual-state-card"' + (hasValue ? " open" : "") + '><summary><span class="visual-state-swatch" style="--state-color:' + M.escapeHtml(color) + '"></span><span><b>' + M.escapeHtml(slot.label) + '</b><small>' + M.escapeHtml(slot.help || "") + '</small></span><em>' + (hasValue ? "CONFIGURED" : "EMPTY") + '</em></summary><div class="visual-state-body">' +
        '<label class="field"><span>Asset reference <small>local path or asset ID</small></span><input data-visual-state="' + M.escapeHtml(slot.id) + '" data-visual-field="assetRef" value="' + M.escapeHtml(state.assetRef || "") + '" placeholder="assets/' + M.escapeHtml(M.slugify(node.label)) + '-' + M.escapeHtml(slot.id) + '.png"></label>' +
        '<label class="field"><span>Fallback color</span><input type="color" data-visual-state="' + M.escapeHtml(slot.id) + '" data-visual-field="color" value="' + M.escapeHtml(color) + '"></label>' +
        '<label class="field"><span>Visual notes</span><textarea data-visual-state="' + M.escapeHtml(slot.id) + '" data-visual-field="notes" placeholder="What should remain consistent in this state?">' + M.escapeHtml(state.notes || "") + '</textarea></label>' +
        '<button class="state-clear-button" type="button" data-clear-visual-state="' + M.escapeHtml(slot.id) + '">Clear this state</button></div></details>';
    }).join("");
    const open = ["character", "world-object"].includes(profile.id) ? " open" : "";
    return '<details class="influence-subsection visual-state-details"' + open + '><summary class="influence-subtitle"><div><b>Visual states</b><small>Later, each slot can receive a generated or local asset</small></div><span>' + configured + ' / ' + slots.length + '</span></summary><p class="influence-help">Changing one state does not replace this block’s identity, logic, permissions or other states.</p><div class="visual-state-list">' + cards + '</div><div class="asset-request-actions"><button type="button" data-copy-asset-request>Copy asset request</button><button type="button" data-download-asset-request>Download asset request</button></div><p class="influence-disclosure">These buttons prepare a local request packet only. They do not generate, upload or apply an asset.</p></details>';
  }

  function renderCodeHooks(node, profile, influence) {
    const hooks = influence.codeHooks || [];
    const cards = hooks.length ? hooks.map(function (hook, index) {
      const hookDefinition = (profile.hooks || []).find(function (item) { return item.id === hook.hook; });
      return '<article class="code-hook-card"><div class="code-hook-head"><div><span>Draft ' + (index + 1) + '</span><b>Saved, not run</b></div><button class="mini-delete" type="button" data-remove-code-hook="' + M.escapeHtml(hook.id) + '" title="Remove code draft" aria-label="Remove code draft">×</button></div>' +
        '<label class="field"><span>Hook moment</span><select data-code-hook-id="' + M.escapeHtml(hook.id) + '" data-code-field="hook">' + influenceOptions(profile.hooks, hook.hook) + '</select></label>' +
        '<div class="code-hook-grid"><label class="field"><span>Draft label</span><input data-code-hook-id="' + M.escapeHtml(hook.id) + '" data-code-field="label" value="' + M.escapeHtml(hook.label || "") + '"></label><label class="field"><span>Language</span><select data-code-hook-id="' + M.escapeHtml(hook.id) + '" data-code-field="language"><option' + (hook.language === "JavaScript" ? " selected" : "") + '>JavaScript</option><option' + (hook.language === "JSON expression" ? " selected" : "") + '>JSON expression</option></select></label></div>' +
        '<div class="hook-signature">' + M.escapeHtml(hookDefinition && hookDefinition.signature || "Transparent hook contract") + '</div>' +
        '<label class="field"><span>Visible code draft</span><textarea class="code-hook-textarea" spellcheck="false" data-code-hook-id="' + M.escapeHtml(hook.id) + '" data-code-field="code">' + M.escapeHtml(hook.code || "") + '</textarea></label>' +
        '<div class="code-contract-row"><span>Execution</span><code>CONTRACT_ONLY · DISABLED</code></div></article>';
    }).join("") : '<div class="influence-empty"><b>No advanced code drafts</b><p>Most people can stay with settings and guided reactions.</p></div>';
    return '<details class="code-hook-details"><summary><span><b>Advanced code hook drafts</b><small>Optional · transparent · never executed here</small></span><em>' + hooks.length + '</em></summary><div class="code-warning"><b>Important boundary</b><p>This beta stores advanced code as readable source only. It does not run it, hide it or grant it new permissions.</p></div><div class="code-hook-list">' + cards + '</div><button class="mini-add" type="button" data-add-code-hook' + (!(profile.hooks || []).length || hooks.length >= M.MAX_CODE_HOOKS ? " disabled" : "") + '>+ Add a transparent code draft</button></details>';
  }

  function renderInfluenceStudio(node) {
    const profile = M.getInfluenceProfile(node.layer, node.type);
    const influence = M.normalizeInfluence(node.influence, node.layer, node.type);
    return '<section class="inspector-section influence-studio" data-influence-studio><div class="section-title"><span>Per-block influence</span><small>' + M.escapeHtml(profile.label) + '</small></div>' +
      '<div class="influence-module-intro"><span class="influence-module-badge">THIS COPY</span><div><h3>' + M.escapeHtml(profile.beginnerLabel) + '</h3><p>' + M.escapeHtml(profile.description) + '</p></div></div>' +
      '<div class="influence-guide"><div><span>1</span><b>Choose a moment</b></div><div><span>2</span><b>Choose a response</b></div><div><span>3</span><b>Preview before testing</b></div></div>' +
      renderInfluenceRules(node, profile, influence) + renderVisualStates(node, profile, influence) + renderCodeHooks(node, profile, influence) + '</section>';
  }

  function renderInspectTab() {
    const node = selectedNode();
    if (!node) return inspectorEmpty();
    const layer = M.nodeLayer(project, node.id);
    const definition = M.getDefinition(layer, node.type);
    const routes = project.layers[layer].edges.filter(function (edge) { return edge.from === node.id || edge.to === node.id; });
    const otherNodes = Object.keys(M.LAYERS).filter(function (key) { return key !== layer; }).reduce(function (list, key) {
      return list.concat(project.layers[key].nodes);
    }, []);
    const permissionDefinition = definition.permission;
    const permissionHtml = permissionDefinition ? '<section class="inspector-section"><div class="section-title"><span>Consent gate</span><small>USER CONTROLLED</small></div><div class="permission-box' + (node.permission && node.permission.approved ? " approved" : "") + '"><span class="permission-badge">' + (node.permission && node.permission.approved ? "Approved for this project" : "Review required") + '</span><p><b>' + M.escapeHtml(permissionDefinition.label) + "</b><br>" + M.escapeHtml(permissionDefinition.reason) + '</p><div class="switch-row"><div class="switch-copy"><b>Allow this capability</b><small>Revocable at any time. The decision is recorded.</small></div><label class="toggle"><input type="checkbox" data-permission-toggle' + (node.permission && node.permission.approved ? " checked" : "") + '><span></span></label></div></div></section>' : "";
    const bindingHtml = otherNodes.length ? otherNodes.map(function (other) {
      const otherLayer = M.nodeLayer(project, other.id);
      const exists = project.bindings.some(function (binding) {
        return (binding.source === node.id && binding.target === other.id) || (binding.source === other.id && binding.target === node.id);
      });
      return '<label class="binding-option" style="--target-rgb:' + layerRgb(otherLayer) + '"><span class="binding-layer-dot">' + M.LAYERS[otherLayer].index + '</span><span class="binding-copy"><b>' + M.escapeHtml(other.label) + '</b><small>' + M.escapeHtml(M.LAYERS[otherLayer].label) + " · " + M.escapeHtml(other.type) + '</small></span><input type="checkbox" data-binding-target="' + M.escapeHtml(other.id) + '"' + (exists ? " checked" : "") + "></label>";
    }).join("") : '<div class="inline-item-text">Add blocks to another layer before creating a cross-layer binding.</div>';
    const routeHtml = routes.length ? routes.map(function (edge) {
      const incoming = edge.to === node.id;
      const other = M.findNode(project, incoming ? edge.from : edge.to);
      return '<div class="inline-item"><div class="inline-item-text">' + (incoming ? "← from " : "→ to ") + M.escapeHtml(other ? other.label : "missing block") + '</div><button class="mini-delete" type="button" data-remove-edge="' + M.escapeHtml(edge.id) + '" title="Remove route" aria-label="Remove route">×</button></div>';
    }).join("") : '<div class="inline-item-text">No same-layer route is connected to this block yet.</div>';

    return '<div class="inspect-hero" style="--block-rgb:' + definition.rgb + '"><div class="inspect-hero-row"><span class="node-symbol" style="--block-rgb:' + definition.rgb + '">' + M.icon(definition.icon) + '</span><div class="inspect-hero-copy"><h2>' + M.escapeHtml(node.label) + '</h2><span>' + M.escapeHtml(M.LAYERS[layer].label) + " · " + M.escapeHtml(definition.subtitle) + '</span></div><button class="icon-button inspect-duplicate" type="button" data-duplicate-selected title="Duplicate block" aria-label="Duplicate block"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="11" height="12" rx="1"/><path d="M16 8V4H5v12h3"/></svg></button><button class="icon-button inspect-delete" type="button" data-delete-selected title="Remove block" aria-label="Remove block"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6"/></svg></button></div></div>' +
      '<section class="inspector-section"><div class="section-title"><span>Block identity</span><small>' + M.escapeHtml(node.id.slice(-8)) + '</small></div><label class="field"><span>Name</span><input data-node-field="label" value="' + M.escapeHtml(node.label) + '"></label><label class="field"><span>Purpose</span><textarea data-node-field="summary">' + M.escapeHtml(node.summary || "") + '</textarea></label><div class="switch-row"><div class="switch-copy"><b>Block enabled</b><small>Disabled blocks remain visible but leave the active build route.</small></div><label class="toggle"><input type="checkbox" data-node-field="enabled"' + (node.enabled !== false ? " checked" : "") + '><span></span></label></div></section>' +
      '<section class="inspector-section"><div class="section-title"><span>Configuration</span><small>READABLE CONTRACT</small></div>' + (definition.fields.length ? definition.fields.map(function (field) { return renderConfigField(field, node); }).join("") : '<div class="inline-item-text">This block has no additional settings.</div>') + "</section>" +
      renderInfluenceStudio(node) +
      permissionHtml +
      '<section class="inspector-section"><div class="section-title"><span>Cross-layer bindings</span><small>' + M.bindingCount(project, node.id) + ' ACTIVE</small></div><div class="binding-list">' + bindingHtml + '</div></section>' +
      '<section class="inspector-section"><div class="section-title"><span>Visible routes</span><small>' + routes.length + ' CONNECTED</small></div><div class="inline-list">' + routeHtml + '</div></section>' +
      '<section class="inspector-section"><div class="section-title"><span>Source &amp; compatibility</span><small>PROVENANCE</small></div><div class="contract-row"><span>Type</span><code>' + M.escapeHtml(layer + ":" + node.type) + '</code></div><div class="contract-row"><span>Target support</span><code>' + M.escapeHtml(definition.targets.join(", ")) + '</code></div><div class="contract-row"><span>Source</span><code>' + M.escapeHtml(node.provenance && node.provenance.source || "Unknown") + '</code></div><div class="contract-row"><span>Version</span><code>' + M.escapeHtml(node.provenance && node.provenance.version || "Unversioned") + "</code></div></section>";
  }

  function renderSpineTab() {
    const nodes = M.allNodes(project);
    const permissionNodes = project.layers.capabilities.nodes.filter(function (node) { return M.getDefinition("capabilities", node.type).permission; });
    const stateEntries = Object.entries(project.spine.stateSchema || {});
    const sourceText = JSON.stringify(project, null, 2);
    const previewText = sourceText.length > 12000 ? sourceText.slice(0, 12000) + "\n… preview truncated; export preserves the complete source …" : sourceText;
    const invariants = (project.spine.invariants || []).map(function (item, index) {
      return '<div class="inline-item"><div class="inline-item-text">' + M.escapeHtml(item) + '</div><button class="mini-delete" type="button" data-remove-invariant="' + index + '" title="Remove invariant" aria-label="Remove invariant">×</button></div>';
    }).join("");
    const stateHtml = stateEntries.length ? stateEntries.map(function (entry) {
      const key = entry[0], value = entry[1] || {};
      return '<div class="inline-item"><div class="inline-item-text"><b>' + M.escapeHtml(key) + '</b> · ' + M.escapeHtml(value.type || typeof value.default) + ' · default ' + M.escapeHtml(JSON.stringify(value.default)) + '</div><button class="mini-delete" type="button" data-remove-state="' + M.escapeHtml(key) + '" title="Remove state key" aria-label="Remove state key">×</button></div>';
    }).join("") : '<div class="inline-item-text">No state keys are declared yet.</div>';
    const permissionsHtml = permissionNodes.length ? permissionNodes.map(function (node) {
      const def = M.getDefinition("capabilities", node.type);
      return '<div class="contract-row"><span>' + M.escapeHtml(def.permission.label) + '</span><code style="color:' + (node.permission && node.permission.approved ? "var(--green)" : "var(--yellow)") + '">' + (node.permission && node.permission.approved ? "APPROVED" : "PENDING") + "</code></div>";
    }).join("") : '<div class="inline-item-text">No permission-seeking capabilities are attached.</div>';
    const collaboration = project.spine.collaboration || {};
    const collaborationSafe = collaboration.mode === "HUMAN_LED" && collaboration.youngAiSeat === "PROPOSE_ONLY" && collaboration.humanApplyRequired === true && collaboration.permissionChanges === "HUMAN_ONLY" && collaboration.canonChanges === "HUMAN_ONLY" && collaboration.destructiveProjectActions === "HUMAN_ONLY" && collaboration.hiddenExecution === "BLOCKED";
    const reviewLog = Array.isArray(collaboration.reviewLog) ? collaboration.reviewLog.slice().reverse() : [];
    const reviewHtml = reviewLog.length ? reviewLog.slice(0, 5).map(function (entry) {
      let reviewedAt = entry.reviewedAt || "Unknown time";
      try { reviewedAt = new Date(reviewedAt).toLocaleString([], { dateStyle: "short", timeStyle: "short" }); } catch (_) { /* Preserve source text. */ }
      return '<div class="inline-item"><div class="inline-item-text"><b>' + M.escapeHtml(entry.title || entry.proposalId || "Reviewed proposal") + '</b><br>' + M.escapeHtml(reviewedAt) + ' · ' + Number(entry.actionCount || 0) + ' actions · diagnostics ' + Number(entry.diagnosticsBefore || 0) + '→' + Number(entry.diagnosticsAfter || 0) + '</div></div>';
    }).join("") : '<div class="inline-item-text">No young AI proposal has been human-approved in this project yet.</div>';

    return '<section class="project-hero"><div class="project-hero-top"><span class="project-mini-mark">' + M.icon("mirror") + '</span><div><h2>Shared project spine</h2><p>Humans and young AI read the same three-layer source truth through different safe seats.</p></div></div><div class="spine-stat-grid"><div class="spine-stat"><b>' + nodes.length + '</b><small>Blocks</small></div><div class="spine-stat"><b>' + project.bindings.length + '</b><small>Bindings</small></div><div class="spine-stat"><b>' + (project.spine.invariants || []).length + "</b><small>Rules</small></div></div></section>" +
      '<section class="inspector-section"><div class="section-title"><span>Goal &amp; proof</span><small>' + M.escapeHtml(project.spine.goal.status || "WORKING") + '</small></div><label class="field"><span>Human outcome</span><textarea data-goal-field="statement">' + M.escapeHtml(project.spine.goal.statement || "") + '</textarea></label><label class="field"><span>Observable success</span><textarea data-goal-field="successMeasure">' + M.escapeHtml(project.spine.goal.successMeasure || "") + '</textarea></label><label class="field"><span>Goal status</span><select data-goal-field="status">' + ["WORKING", "READY FOR REVIEW", "PROVEN", "PAUSED"].map(function (status) { return '<option' + (project.spine.goal.status === status ? " selected" : "") + '>' + status + "</option>"; }).join("") + "</select></label></section>" +
      '<section class="inspector-section"><div class="section-title"><span>Project identity</span><small>' + M.escapeHtml(project.meta.canonStatus || "EXPERIMENTAL") + '</small></div><label class="field"><span>Name</span><input data-project-field="name" value="' + M.escapeHtml(project.name) + '"></label><label class="field"><span>Description</span><textarea data-project-field="description">' + M.escapeHtml(project.description || "") + '</textarea></label><label class="field"><span>Build target</span><select data-project-field="target">' + Object.entries(M.TARGETS).map(function (entry) { return '<option value="' + entry[0] + '"' + (project.target === entry[0] ? " selected" : "") + ">" + M.escapeHtml(entry[1].label) + "</option>"; }).join("") + '</select></label><label class="field"><span>Accent</span><input type="color" data-project-field="accent" value="' + M.safeColor(project.accent) + '"></label></section>' +
      '<section class="inspector-section"><div class="section-title"><span>Skeleton invariants</span><small>NO SILENT REWRITE</small></div><div class="inline-list">' + invariants + '</div><label class="field" style="margin-top:9px"><span>Add a protected rule</span><input id="newInvariantInput" placeholder="What must future changes preserve?"></label><button class="mini-add" type="button" data-add-invariant>+ Add invariant</button></section>' +
      '<section class="inspector-section"><div class="section-title"><span>State schema</span><small>' + stateEntries.length + ' KEYS</small></div><div class="inline-list">' + stateHtml + '</div><div style="display:grid;grid-template-columns:minmax(0,1fr) 90px;gap:6px;margin-top:9px"><label class="field"><span>New key</span><input id="newStateKey" placeholder="score"></label><label class="field"><span>Type</span><select id="newStateType"><option>number</option><option>string</option><option>boolean</option><option>array</option><option>object</option></select></label></div><button class="mini-add" type="button" data-add-state>+ Add state key</button></section>' +
      '<section class="inspector-section"><div class="section-title"><span>Permission map</span><small>' + permissionNodes.length + ' REQUESTS</small></div>' + permissionsHtml + '</section>' +
      '<section class="inspector-section"><div class="section-title"><span>Young AI collaboration</span><small style="color:' + (collaborationSafe ? "var(--green)" : "var(--red)") + '">' + (collaborationSafe ? "SAFE GATE" : "HOLD") + '</small></div><div class="contract-row"><span>Control mode</span><code>' + M.escapeHtml(collaboration.mode || "MISSING") + '</code></div><div class="contract-row"><span>Young AI seat</span><code>' + M.escapeHtml(collaboration.youngAiSeat || "MISSING") + '</code></div><div class="contract-row"><span>Apply</span><code>HUMAN ONLY</code></div><div class="contract-row"><span>Permissions / canon / deletion</span><code>HUMAN ONLY</code></div><div class="section-title" style="margin-top:11px"><span>Human review receipts</span><small>' + reviewLog.length + ' RECORDED</small></div><div class="inline-list">' + reviewHtml + '</div><button class="mini-add" type="button" data-open-ai-workbench>Open young AI workbench</button></section>' +
      '<section class="inspector-section"><div class="section-title"><span>Canonical source preview</span><button class="mini-add" style="width:auto;margin:0;padding:0 8px" type="button" data-copy-source>Copy full</button></div><div class="source-preview"><pre>' + M.escapeHtml(previewText) + "</pre></div></section>";
  }

  function renderLedgerTab() {
    const entries = (project.ledger || []).slice().reverse();
    if (!entries.length) return '<div class="inspector-empty"><div><h3>No change events yet</h3><p>Edits will appear here as a visible local trail.</p></div></div>';
    return '<section class="project-hero"><div class="project-hero-top"><span class="project-mini-mark">' + M.icon("route") + '</span><div><h2>Append-only view</h2><p>' + entries.length + ' source-visible events in this project source.</p></div></div></section><div class="ledger-list">' + entries.map(function (entry) {
      const rgb = entry.layer && M.LAYERS[entry.layer] ? M.LAYERS[entry.layer].rgb : "125, 159, 177";
      let time = entry.at;
      try { time = new Date(entry.at).toLocaleString([], { dateStyle: "short", timeStyle: "short" }); } catch (_) { /* Preserve raw time. */ }
      return '<article class="ledger-entry" style="--entry-rgb:' + rgb + '"><b>' + M.escapeHtml(entry.message || entry.type) + '</b><small>' + M.escapeHtml(time) + " · " + M.escapeHtml(entry.type || "event") + " · " + M.escapeHtml(entry.actor || "human") + "</small></article>";
    }).join("") + "</div>";
  }

  function renderInspector() {
    $$(".inspector-tab").forEach(function (tab) {
      const active = tab.dataset.inspectorTab === runtime.inspectorTab;
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-selected", active ? "true" : "false");
    });
    if (runtime.inspectorTab === "spine") dom.inspectorContent.innerHTML = renderSpineTab();
    else if (runtime.inspectorTab === "ledger") dom.inspectorContent.innerHTML = renderLedgerTab();
    else dom.inspectorContent.innerHTML = renderInspectTab();
  }

  function updateNodeField(node, field, value) {
    const before = snapshot();
    if (field === "enabled") node.enabled = Boolean(value);
    else node[field] = String(value).slice(0, field === "summary" ? 2000 : 200);
    node.updatedAt = M.now();
    if (before === snapshot()) return;
    runtime.undo.push(before);
    if (runtime.undo.length > MAX_HISTORY) runtime.undo.shift();
    runtime.redo.length = 0;
    project.meta.updatedAt = M.now();
    addLedger("block.configured", "Updated “" + node.label + "”", node.layer);
    scheduleSave();
    renderAll();
  }

  function updateNodeConfig(node, key, value) {
    const definition = M.getDefinition(node.layer, node.type);
    const field = definition.fields.find(function (candidate) { return candidate.key === key; });
    let normalized = value;
    if (field && field.type === "number") normalized = Number(value);
    if (field && field.type === "checkbox") normalized = Boolean(value);
    commit("Configured “" + node.label + "”", { type: "block.configured", layer: node.layer }, function () {
      node.config = node.config || {};
      node.config[key] = normalized;
      node.updatedAt = M.now();
    });
  }


  function commitInfluenceChange(node, label, eventType, mutation) {
    runtime.influencePreview = null;
    commit(label, { type: eventType || "block.influence.updated", layer: node.layer }, function () {
      node.influence = M.normalizeInfluence(node.influence, node.layer, node.type);
      mutation(node.influence);
      node.influence.updatedAt = M.now();
      node.updatedAt = M.now();
    });
  }

  function addInfluenceRule() {
    const node = selectedNode();
    const studio = dom.inspectorContent.querySelector("[data-influence-studio]");
    if (!node || !studio) return;
    const profile = M.getInfluenceProfile(node.layer, node.type);
    const triggerInput = studio.querySelector("[data-new-influence-trigger]");
    const actionInput = studio.querySelector("[data-new-influence-action]");
    const valueInput = studio.querySelector("[data-new-influence-value]");
    const noteInput = studio.querySelector("[data-new-influence-note]");
    const trigger = triggerInput ? triggerInput.value : "";
    const action = actionInput ? actionInput.value : "";
    const value = valueInput ? valueInput.value.trim() : "";
    const note = noteInput ? noteInput.value.trim() : "";
    const triggerDefinition = (profile.triggers || []).find(function (item) { return item.id === trigger; });
    const actionDefinition = (profile.actions || []).find(function (item) { return item.id === action; });
    if (!triggerDefinition || !actionDefinition) {
      toast("Choose a valid moment and response first.", "warning");
      return;
    }
    if (actionDefinition.needsValue && !value) {
      toast("Add the “" + actionDefinition.valueLabel + "” detail so the reaction is understandable.", "warning", 5000);
      if (valueInput) valueInput.focus();
      return;
    }
    const current = M.normalizeInfluence(node.influence, node.layer, node.type);
    if (current.rules.length >= M.MAX_INFLUENCE_RULES) {
      toast("This block already has the beta limit of " + M.MAX_INFLUENCE_RULES + " reactions.", "warning");
      return;
    }
    commitInfluenceChange(node, "Added a guided reaction to “" + node.label + "”", "block.influence.rule.added", function (influence) {
      influence.rules.push(M.createInfluenceRule(trigger, action, value, note, true));
    });
    toast("Reaction added to this placed block only.", "success");
  }

  function updateInfluenceRule(node, ruleId, field, value) {
    const profile = M.getInfluenceProfile(node.layer, node.type);
    if (field === "trigger" && !(profile.triggers || []).some(function (item) { return item.id === value; })) return;
    if (field === "action" && !(profile.actions || []).some(function (item) { return item.id === value; })) return;
    commitInfluenceChange(node, "Updated a guided reaction on “" + node.label + "”", "block.influence.rule.updated", function (influence) {
      const rule = influence.rules.find(function (item) { return item.id === ruleId; });
      if (!rule) return;
      if (field === "enabled") rule.enabled = Boolean(value);
      else if (field === "value") rule.value = String(value || "").slice(0, 2000);
      else if (field === "note") rule.note = String(value || "").slice(0, 1000);
      else if (["trigger", "action"].includes(field)) rule[field] = String(value || "").slice(0, 120);
      rule.updatedAt = M.now();
    });
  }

  function removeInfluenceRule(ruleId) {
    const node = selectedNode();
    if (!node) return;
    const influence = M.normalizeInfluence(node.influence, node.layer, node.type);
    const rule = influence.rules.find(function (item) { return item.id === ruleId; });
    if (!rule) return;
    commitInfluenceChange(node, "Removed a guided reaction from “" + node.label + "”", "block.influence.rule.removed", function (next) {
      next.rules = next.rules.filter(function (item) { return item.id !== ruleId; });
    });
    toast("Reaction removed. Undo remains available.", "warning");
  }

  function previewInfluenceRule(ruleId) {
    const node = selectedNode();
    if (!node) return;
    const influence = M.normalizeInfluence(node.influence, node.layer, node.type);
    const rule = influence.rules.find(function (item) { return item.id === ruleId; });
    if (!rule) return;
    runtime.influencePreview = M.simulateInfluence(node, rule.trigger, rule.id);
    renderInspector();
    const preview = dom.inspectorContent.querySelector(".influence-preview");
    if (preview) preview.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  function updateVisualState(node, stateId, field, value) {
    const profile = M.getInfluenceProfile(node.layer, node.type);
    if (!(profile.visualStates || []).some(function (item) { return item.id === stateId; })) return;
    commitInfluenceChange(node, "Updated the “" + stateId + "” visual state on “" + node.label + "”", "block.influence.visual.updated", function (influence) {
      const state = Object.assign({}, influence.visualStates[stateId] || {});
      if (field === "assetRef") state.assetRef = String(value || "").slice(0, 1000);
      else if (field === "color") state.color = M.safeColor(value);
      else if (field === "notes") state.notes = String(value || "").slice(0, 2000);
      state.updatedAt = M.now();
      influence.visualStates[stateId] = state;
    });
  }

  function clearVisualState(stateId) {
    const node = selectedNode();
    if (!node) return;
    commitInfluenceChange(node, "Cleared the “" + stateId + "” visual state on “" + node.label + "”", "block.influence.visual.cleared", function (influence) {
      delete influence.visualStates[stateId];
    });
    toast("That visual slot is empty again. Other states were preserved.", "warning");
  }

  function addCodeHook() {
    const node = selectedNode();
    if (!node) return;
    const profile = M.getInfluenceProfile(node.layer, node.type);
    const firstHook = profile.hooks && profile.hooks[0];
    if (!firstHook) {
      toast("This module does not declare an advanced code hook.", "warning");
      return;
    }
    const current = M.normalizeInfluence(node.influence, node.layer, node.type);
    if (current.codeHooks.length >= M.MAX_CODE_HOOKS) {
      toast("This block already has the beta limit of " + M.MAX_CODE_HOOKS + " code drafts.", "warning");
      return;
    }
    commitInfluenceChange(node, "Added a transparent code-hook draft to “" + node.label + "”", "block.influence.code.added", function (influence) {
      influence.codeHooks.push({
        id: M.uid("hook"),
        hook: firstHook.id,
        label: firstHook.label + " draft",
        language: "JavaScript",
        code: "// Contract-only draft. AXM Shapeable Builder does not run this code.\n// " + firstHook.signature + "\n",
        execution: "CONTRACT_ONLY",
        enabled: false,
        updatedAt: M.now()
      });
    });
    toast("Code draft added visibly. It is disabled and will not run.", "warning", 5200);
  }

  function updateCodeHook(node, hookId, field, value) {
    const profile = M.getInfluenceProfile(node.layer, node.type);
    if (field === "hook" && !(profile.hooks || []).some(function (item) { return item.id === value; })) return;
    commitInfluenceChange(node, "Updated a contract-only code draft on “" + node.label + "”", "block.influence.code.updated", function (influence) {
      const hook = influence.codeHooks.find(function (item) { return item.id === hookId; });
      if (!hook) return;
      if (field === "hook") hook.hook = String(value || "").slice(0, 120);
      else if (field === "label") hook.label = String(value || "Advanced hook draft").slice(0, 240);
      else if (field === "language") hook.language = ["JavaScript", "JSON expression"].includes(value) ? value : "JavaScript";
      else if (field === "code") hook.code = String(value || "").slice(0, 12000);
      hook.execution = "CONTRACT_ONLY";
      hook.enabled = false;
      hook.updatedAt = M.now();
    });
  }

  function removeCodeHook(hookId) {
    const node = selectedNode();
    if (!node) return;
    commitInfluenceChange(node, "Removed a contract-only code draft from “" + node.label + "”", "block.influence.code.removed", function (influence) {
      influence.codeHooks = influence.codeHooks.filter(function (item) { return item.id !== hookId; });
    });
    toast("Code draft removed. No code was executed.", "warning");
  }

  function blockAssetRequest() {
    const node = selectedNode();
    if (!node) return null;
    try { return M.generateBlockAssetRequest(project, node.id); }
    catch (error) {
      toast(error.message || "The asset request could not be prepared.", "error");
      return null;
    }
  }

  function copyBlockAssetRequest() {
    const request = blockAssetRequest();
    if (request) copyText(JSON.stringify(request, null, 2), "Asset request copied. Nothing was uploaded or generated.");
  }

  function downloadBlockAssetRequest() {
    const node = selectedNode();
    const request = blockAssetRequest();
    if (!node || !request) return;
    downloadBlob(JSON.stringify(request, null, 2), "application/json", M.slugify(project.name) + "--" + M.slugify(node.label) + ".axm-asset-request.json");
    toast("Local asset request downloaded. Human review is still required before any asset is applied.");
  }

  function togglePermission(node, approved) {
    const definition = M.getDefinition(node.layer, node.type);
    if (!definition.permission) return;
    commit((approved ? "Approved" : "Revoked") + " “" + definition.permission.label + "”", { type: approved ? "permission.approved" : "permission.revoked", layer: node.layer, immediate: true }, function () {
      node.permission = { id: definition.permission.id, approved: approved, reviewedAt: M.now() };
      node.updatedAt = M.now();
    });
    toast(approved ? "Capability approved for this project only." : "Capability permission revoked.", approved ? "success" : "warning");
  }

  function toggleBinding(node, targetId, enabled) {
    const target = M.findNode(project, targetId);
    if (!target) return;
    const existing = project.bindings.find(function (binding) {
      return (binding.source === node.id && binding.target === targetId) || (binding.source === targetId && binding.target === node.id);
    });
    if (enabled && existing) return;
    if (!enabled && !existing) return;
    commit((enabled ? "Bound" : "Unbound") + " “" + node.label + "” and “" + target.label + "”", { type: enabled ? "binding.created" : "binding.removed", layer: null }, function () {
      if (enabled) project.bindings.push({ id: M.uid("binding"), source: node.id, target: targetId, purpose: "contract", createdAt: M.now() });
      else project.bindings = project.bindings.filter(function (binding) { return binding.id !== existing.id; });
    });
  }

  function updateProjectField(field, value) {
    let normalized = value;
    if (field === "name") normalized = String(value).trim().slice(0, 160) || "Untitled project";
    if (field === "description") normalized = String(value).slice(0, 2000);
    if (field === "target" && !M.TARGETS[value]) return;
    if (field === "accent") normalized = M.safeColor(value);
    if (project[field] === normalized) return;
    commit("Updated project " + field, { type: "project.metadata", layer: null }, function () {
      project[field] = normalized;
    });
  }

  function updateGoalField(field, value) {
    if (!["statement", "successMeasure", "status"].includes(field)) return;
    let normalized = String(value || "");
    if (field !== "status") normalized = normalized.slice(0, 2000);
    if (field === "status" && !["WORKING", "READY FOR REVIEW", "PROVEN", "PAUSED"].includes(normalized)) return;
    if (project.spine.goal[field] === normalized) return;
    commit("Updated project goal " + field, { type: "spine.goal.updated", layer: null }, function () {
      project.spine.goal[field] = normalized;
    });
  }

  function addInvariant() {
    const input = $("#newInvariantInput", dom.inspectorContent);
    const value = input ? input.value.trim() : "";
    if (!value) {
      toast("Write the rule that future changes must preserve.", "warning");
      return;
    }
    commit("Added a skeleton invariant", { type: "spine.invariant.added", layer: null }, function () {
      project.spine.invariants.push(value.slice(0, 1000));
    });
  }

  function removeInvariant(index) {
    const item = project.spine.invariants[index];
    if (item == null) return;
    commit("Removed a skeleton invariant", { type: "spine.invariant.removed", layer: null }, function () {
      project.spine.invariants.splice(index, 1);
    });
    toast("Invariant removed. Undo remains available.", "warning");
  }

  function defaultForType(type) {
    if (type === "number") return 0;
    if (type === "boolean") return false;
    if (type === "array") return [];
    if (type === "object") return {};
    return "";
  }

  function addStateKey() {
    const keyInput = $("#newStateKey", dom.inspectorContent);
    const typeInput = $("#newStateType", dom.inspectorContent);
    const key = keyInput ? keyInput.value.trim().replace(/[^a-zA-Z0-9_$]/g, "") : "";
    const type = typeInput ? typeInput.value : "string";
    if (!key) {
      toast("Give the state key a simple name such as score or status.", "warning");
      return;
    }
    if (Object.prototype.hasOwnProperty.call(project.spine.stateSchema, key)) {
      toast("That state key already exists. Nothing was overwritten.", "warning");
      return;
    }
    commit("Added state key “" + key + "”", { type: "spine.state.added", layer: null }, function () {
      project.spine.stateSchema[key] = { type: type, default: defaultForType(type) };
    });
  }

  function removeStateKey(key) {
    if (!Object.prototype.hasOwnProperty.call(project.spine.stateSchema, key)) return;
    commit("Removed state key “" + key + "”", { type: "spine.state.removed", layer: null }, function () {
      delete project.spine.stateSchema[key];
    });
    toast("State key removed. Undo remains available.", "warning");
  }

  function copyText(text, successMessage) {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(function () { toast(successMessage || "Copied."); }).catch(function () { fallbackCopy(text, successMessage); });
    } else {
      fallbackCopy(text, successMessage);
    }
  }

  function fallbackCopy(text, successMessage) {
    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    try {
      document.execCommand("copy");
      toast(successMessage || "Copied.");
    } catch (_) {
      toast("Clipboard access was blocked. Export the project source instead.", "warning", 4500);
    }
    area.remove();
  }

  function onInspectorChange(event) {
    const node = selectedNode();
    const influenceRuleId = event.target.dataset.influenceRuleId;
    const influenceField = event.target.dataset.influenceField;
    if (node && influenceRuleId && influenceField) {
      updateInfluenceRule(node, influenceRuleId, influenceField, event.target.type === "checkbox" ? event.target.checked : event.target.value);
      return;
    }
    const visualState = event.target.dataset.visualState;
    const visualField = event.target.dataset.visualField;
    if (node && visualState && visualField) {
      updateVisualState(node, visualState, visualField, event.target.value);
      return;
    }
    const codeHookId = event.target.dataset.codeHookId;
    const codeField = event.target.dataset.codeField;
    if (node && codeHookId && codeField) {
      updateCodeHook(node, codeHookId, codeField, event.target.value);
      return;
    }
    const nodeField = event.target.dataset.nodeField;
    if (node && nodeField) {
      updateNodeField(node, nodeField, event.target.type === "checkbox" ? event.target.checked : event.target.value);
      return;
    }
    const configKey = event.target.dataset.configKey;
    if (node && configKey) {
      updateNodeConfig(node, configKey, event.target.type === "checkbox" ? event.target.checked : event.target.value);
      return;
    }
    if (node && event.target.hasAttribute("data-permission-toggle")) {
      togglePermission(node, event.target.checked);
      return;
    }
    if (node && event.target.dataset.bindingTarget) {
      toggleBinding(node, event.target.dataset.bindingTarget, event.target.checked);
      return;
    }
    const projectField = event.target.dataset.projectField;
    if (projectField) { updateProjectField(projectField, event.target.value); return; }
    const goalField = event.target.dataset.goalField;
    if (goalField) updateGoalField(goalField, event.target.value);
  }

  function onInspectorClick(event) {
    if (event.target.closest("[data-add-influence-rule]")) { addInfluenceRule(); return; }
    const removeInfluence = event.target.closest("[data-remove-influence-rule]");
    if (removeInfluence) { removeInfluenceRule(removeInfluence.dataset.removeInfluenceRule); return; }
    const previewInfluence = event.target.closest("[data-preview-influence-rule]");
    if (previewInfluence) { previewInfluenceRule(previewInfluence.dataset.previewInfluenceRule); return; }
    const clearVisual = event.target.closest("[data-clear-visual-state]");
    if (clearVisual) { clearVisualState(clearVisual.dataset.clearVisualState); return; }
    if (event.target.closest("[data-copy-asset-request]")) { copyBlockAssetRequest(); return; }
    if (event.target.closest("[data-download-asset-request]")) { downloadBlockAssetRequest(); return; }
    if (event.target.closest("[data-add-code-hook]")) { addCodeHook(); return; }
    const removeCode = event.target.closest("[data-remove-code-hook]");
    if (removeCode) { removeCodeHook(removeCode.dataset.removeCodeHook); return; }
    const duplicateSelected = event.target.closest("[data-duplicate-selected]");
    if (duplicateSelected && runtime.selectedNodeId) { duplicateNode(runtime.selectedNodeId); return; }
    const deleteSelected = event.target.closest("[data-delete-selected]");
    if (deleteSelected && runtime.selectedNodeId) { removeNode(runtime.selectedNodeId); return; }
    const removeRoute = event.target.closest("[data-remove-edge]");
    if (removeRoute) { removeEdge(removeRoute.dataset.removeEdge); return; }
    const removeRule = event.target.closest("[data-remove-invariant]");
    if (removeRule) { removeInvariant(Number(removeRule.dataset.removeInvariant)); return; }
    const removeState = event.target.closest("[data-remove-state]");
    if (removeState) { removeStateKey(removeState.dataset.removeState); return; }
    if (event.target.closest("[data-add-invariant]")) { addInvariant(); return; }
    if (event.target.closest("[data-add-state]")) { addStateKey(); return; }
    if (event.target.closest("[data-open-ai-workbench]")) { openAiWorkbench(); return; }
    if (event.target.closest("[data-copy-source]")) copyText(JSON.stringify(project, null, 2), "Complete project spine copied.");
  }

  function templateArtwork(id) {
    if (id === "website") return '<svg viewBox="0 0 180 100"><rect x="9" y="10" width="162" height="80" rx="6" class="fill-soft"/><path d="M9 27h162M20 19h.01M27 19h.01M34 19h.01M25 43h72M25 53h92M25 67h38v10H25zM126 38c15 0 27 12 27 27s-12 20-27 20-27-5-27-20 12-27 27-27Z"/><path d="m118 63 7 7 13-17"/></svg>';
    if (id === "dashboard") return '<svg viewBox="0 0 180 100"><rect x="8" y="8" width="164" height="84" rx="6" class="fill-soft"/><path d="M8 26h164M22 17h34M20 37h39v19H20zM70 37h39v19H70zM120 37h39v19h-39zM20 67h86v14H20zM118 67h41v14h-41z"/><path d="m27 76 13-6 12 4 16-11 13 7 18-11"/></svg>';
    if (id === "game") return '<svg viewBox="0 0 180 100"><rect x="8" y="8" width="164" height="84" rx="6" class="fill-soft"/><path d="M8 39h164M72 8v84M117 8v84M8 72h164M18 17h43v14H18zM82 48h25v15H82zM127 18h34v13h-34zM126 79h34"/><circle cx="52" cy="56" r="7"/><path d="m143 52 7 7-7 7-7-7zM26 84h18"/></svg>';
    if (id === "hands-loop") return '<svg viewBox="0 0 180 100"><path d="M14 49h24M66 49h20M114 49h20M158 49h8M35 62c14 22 87 22 105 0"/><rect x="38" y="34" width="28" height="29" rx="7" class="fill-soft"/><rect x="86" y="34" width="28" height="29" rx="7" class="fill-soft"/><rect x="134" y="34" width="28" height="29" rx="7" class="fill-soft"/><circle cx="18" cy="49" r="8"/><path d="m47 48 5 5 8-11M95 48l5 5 8-11M143 48l5 5 8-11M90 83h20"/></svg>';
    if (id === "young-ai-workshop") return '<svg viewBox="0 0 180 100"><rect x="10" y="11" width="160" height="78" rx="7" class="fill-soft"/><path d="M10 30h160M66 30v59M117 30v59M20 21h.01M27 21h.01M34 21h.01"/><rect x="20" y="42" width="35" height="20" rx="4"/><rect x="76" y="42" width="31" height="20" rx="4"/><rect x="127" y="42" width="32" height="20" rx="4"/><path d="M55 52h21M107 52h20M143 62v10M143 72l-5-5m5 5 5-5M25 75h25M77 75h28M127 78h32"/><circle cx="40" cy="52" r="4"/><path d="m88 49 4 4 7-8m35 33 5 5 11-14"/></svg>';
    if (id === "cartoon-world") return '<svg viewBox="0 0 180 100"><path d="M7 76c20-18 35-13 52-25 18-13 25-36 50-30 21 5 27 22 64 18v54H7z" class="fill-soft"/><path d="M8 77c21-19 35-13 52-26 18-13 25-36 49-30 22 5 28 22 64 18M20 83c30-24 43-4 68-28 17-16 34-12 50 6"/><path d="m42 35-8 14h16zM42 42v18m72-12-12 20h24zM114 58v23"/><circle cx="85" cy="34" r="7"/><path d="m85 26 2 6 6 2-6 2-2 6-2-6-6-2 6-2zM144 77h20v12h-20z"/></svg>';
    return '<svg viewBox="0 0 180 100"><rect x="28" y="18" width="45" height="34" rx="5" class="fill-soft"/><rect x="107" y="48" width="45" height="34" rx="5" class="fill-soft"/><path d="M73 35h20a14 14 0 0 1 14 14M88 65H72a14 14 0 0 1-14-13M49 35h3M128 65h3"/><circle cx="90" cy="50" r="7"/></svg>';
  }

  function renderTemplates() {
    dom.templateGrid.innerHTML = M.TEMPLATES.map(function (template) {
      return '<button class="template-card" type="button" data-template-id="' + M.escapeHtml(template.id) + '" style="--template-rgb:' + template.rgb + '"><span class="template-visual">' + templateArtwork(template.id) + '</span><span class="template-card-copy"><span class="template-kicker">' + M.escapeHtml(template.kicker) + '</span><h3>' + M.escapeHtml(template.name) + '</h3><p>' + M.escapeHtml(template.description) + '</p><span class="template-meta"><span>' + M.escapeHtml(M.TARGETS[template.target].label) + '</span><span>' + M.escapeHtml(template.blocks) + "</span></span></span></button>";
    }).join("");
  }

  const GOAL_CAPABILITIES = ["local-storage", "diagnostics", "export-packager", "accessibility-audit", "localization", "ai-collaborator", "hand-router", "scenery-factory", "physics-adapter", "engine-dock", "lan-sync"];

  function renderGoalCapabilityChoices(target, selected) {
    selected = new Set(selected || []);
    dom.goalCapabilityChoices.innerHTML = GOAL_CAPABILITIES.map(function (type) {
      const definition = M.getDefinition("capabilities", type);
      const compatible = !definition.targets || definition.targets.includes(target);
      const consent = definition.permission ? " · asks for consent" : "";
      return '<label class="capability-choice"><input type="checkbox" value="' + M.escapeHtml(type) + '" data-goal-capability' + (selected.has(type) ? " checked" : "") + (compatible ? "" : " disabled") + '><span><b>' + M.escapeHtml(definition.label) + '</b><small>' + M.escapeHtml(compatible ? definition.subtitle + consent : "Not compatible with this target") + "</small></span></label>";
    }).join("");
  }

  function populateGoalBuilder() {
    dom.goalTemplateSelect.innerHTML = M.TEMPLATES.map(function (template) {
      return '<option value="' + M.escapeHtml(template.id) + '"' + (project.meta.templateId === template.id ? " selected" : "") + ">" + M.escapeHtml(template.name) + " — " + M.escapeHtml(template.kicker) + "</option>";
    }).join("");
    dom.goalTargetSelect.innerHTML = Object.entries(M.TARGETS).map(function (entry) {
      return '<option value="' + entry[0] + '"' + (project.target === entry[0] ? " selected" : "") + ">" + M.escapeHtml(entry[1].label) + "</option>";
    }).join("");
    dom.goalProjectName.value = project.name === "Untitled project" ? "" : project.name;
    dom.goalStatement.value = project.spine.goal.statement || "";
    dom.goalSuccessMeasure.value = project.spine.goal.successMeasure || "";
    dom.goalAccent.value = M.safeColor(project.accent);
    const attached = project.layers.capabilities.nodes.filter(function (node) { return node.enabled !== false; }).map(function (node) { return node.type; });
    renderGoalCapabilityChoices(project.target, attached.length ? attached : ["local-storage", "diagnostics", "export-packager"]);
  }

  function openGoalBuilder() {
    populateGoalBuilder();
    showDialog(dom.goalBuilderDialog);
  }

  function goalFormValues() {
    const name = String(dom.goalProjectName.value || "").trim().slice(0, 160);
    const statement = String(dom.goalStatement.value || "").trim().slice(0, 2000);
    const successMeasure = String(dom.goalSuccessMeasure.value || "").trim().slice(0, 2000);
    if (!name || !statement || !successMeasure) {
      toast("A project name, human outcome and observable success measure are all required.", "warning", 4800);
      return null;
    }
    return {
      name: name,
      statement: statement,
      successMeasure: successMeasure,
      target: M.TARGETS[dom.goalTargetSelect.value] ? dom.goalTargetSelect.value : "website",
      accent: M.safeColor(dom.goalAccent.value),
      templateId: dom.goalTemplateSelect.value,
      capabilities: $$('[data-goal-capability]:checked', dom.goalCapabilityChoices).map(function (input) { return input.value; })
    };
  }

  function attachGoalCapabilities(targetProject, types) {
    const existing = new Set(targetProject.layers.capabilities.nodes.map(function (node) { return node.type; }));
    types.forEach(function (type) {
      const definition = M.getDefinition("capabilities", type);
      if (existing.has(type) || (definition.targets && !definition.targets.includes(targetProject.target))) return;
      const index = targetProject.layers.capabilities.nodes.length;
      targetProject.layers.capabilities.nodes.push(M.createNode("capabilities", type, 80 + (index % 5) * 285, 120 + Math.floor(index / 5) * 160));
      existing.add(type);
    });
  }

  function applyGoalToCurrent() {
    const values = goalFormValues();
    if (!values) return;
    commit("Updated the project from the guided goal builder", { type: "spine.goal.guided", layer: null, immediate: true }, function () {
      project.name = values.name;
      project.description = values.statement;
      project.target = values.target;
      project.accent = values.accent;
      project.spine.goal = { statement: values.statement, successMeasure: values.successMeasure, status: "WORKING" };
      attachGoalCapabilities(project, values.capabilities);
    });
    dom.goalBuilderDialog.close();
    toast("Goal and proof updated. New permission-seeking capabilities remain pending review.", "success", 4700);
  }

  function createProjectFromGoal() {
    const values = goalFormValues();
    if (!values || !canCreateProject()) return;
    const template = M.getTemplate(values.templateId);
    const next = template.build();
    next.id = M.uid("project");
    next.name = values.name;
    next.description = values.statement;
    next.target = values.target;
    next.accent = values.accent;
    next.meta.createdAt = M.now();
    next.meta.updatedAt = M.now();
    next.spine.goal = { statement: values.statement, successMeasure: values.successMeasure, status: "WORKING" };
    attachGoalCapabilities(next, values.capabilities);
    next.ledger.push({ id: M.uid("event"), at: M.now(), actor: "human", type: "spine.goal.guided", message: "Created a rooted project from a human goal and observable success measure", layer: null });
    dom.goalBuilderDialog.close();
    addProjectToVault(next, { message: "Guided project created. Capability permissions remain yours to review." });
  }

  function renderSpineMap() {
    const goal = project.spine.goal || {};
    dom.spineMapGoal.innerHTML = '<span><b>' + M.escapeHtml(goal.statement || "No project goal has been stated yet.") + '</b><small>Goal status · ' + M.escapeHtml(goal.status || "WORKING") + '</small></span><span class="map-proof"><b>Observable success</b><small>' + M.escapeHtml(goal.successMeasure || "Add a success measure in the Goal Builder.") + "</small></span>";
    dom.spineMapGrid.innerHTML = Object.keys(M.LAYERS).map(function (layer) {
      const meta = M.LAYERS[layer];
      const nodes = project.layers[layer].nodes;
      const cards = nodes.length ? nodes.map(function (node) {
        const definition = M.getDefinition(layer, node.type);
        return '<button class="spine-map-node" type="button" data-map-node="' + M.escapeHtml(node.id) + '" style="--node-rgb:' + definition.rgb + '"><span class="spine-map-node-icon">' + M.icon(definition.icon) + '</span><span><b>' + M.escapeHtml(node.label) + '</b><small>' + M.escapeHtml(node.type) + '</small></span><em>' + M.bindingCount(project, node.id) + "×</em></button>";
      }).join("") : '<div class="spine-map-empty">No blocks in this layer yet.</div>';
      return '<section class="spine-map-column" style="--map-rgb:' + meta.rgb + '"><h3><span>' + meta.index + " " + M.escapeHtml(meta.label) + "</span><b>" + nodes.length + '</b></h3><div class="spine-map-node-list">' + cards + "</div></section>";
    }).join("");
  }

  function drawSpineMapEdges() {
    if (!dom.spineMapDialog.open) return;
    const boardRect = dom.spineMapBoard.getBoundingClientRect();
    const width = Math.max(dom.spineMapBoard.scrollWidth, dom.spineMapBoard.clientWidth);
    const height = Math.max(dom.spineMapBoard.scrollHeight, dom.spineMapBoard.clientHeight);
    dom.spineMapEdges.setAttribute("viewBox", "0 0 " + width + " " + height);
    dom.spineMapEdges.style.width = width + "px";
    dom.spineMapEdges.style.height = height + "px";
    dom.spineMapEdges.innerHTML = project.bindings.map(function (binding) {
      const source = $('[data-map-node="' + CSS.escape(binding.source) + '"]', dom.spineMapGrid);
      const target = $('[data-map-node="' + CSS.escape(binding.target) + '"]', dom.spineMapGrid);
      if (!source || !target) return "";
      const a = source.getBoundingClientRect(), b = target.getBoundingClientRect();
      let x1 = a.right - boardRect.left + dom.spineMapBoard.scrollLeft;
      let y1 = a.top + a.height / 2 - boardRect.top + dom.spineMapBoard.scrollTop;
      let x2 = b.left - boardRect.left + dom.spineMapBoard.scrollLeft;
      let y2 = b.top + b.height / 2 - boardRect.top + dom.spineMapBoard.scrollTop;
      if (x2 < x1) {
        x1 = a.left - boardRect.left + dom.spineMapBoard.scrollLeft;
        x2 = b.right - boardRect.left + dom.spineMapBoard.scrollLeft;
      }
      const bend = Math.max(50, Math.abs(x2 - x1) * .42);
      const direction = x2 >= x1 ? 1 : -1;
      const path = "M " + x1 + " " + y1 + " C " + (x1 + bend * direction) + " " + y1 + ", " + (x2 - bend * direction) + " " + y2 + ", " + x2 + " " + y2;
      const sourceLayer = M.nodeLayer(project, binding.source) || "logic";
      return '<path class="spine-map-binding-shadow" d="' + path + '"></path><path class="spine-map-binding" d="' + path + '" stroke="' + M.LAYERS[sourceLayer].color + '"><title>' + M.escapeHtml(binding.purpose || "contract") + "</title></path>";
    }).join("");
  }

  function openSpineMap() {
    renderSpineMap();
    showDialog(dom.spineMapDialog);
    requestAnimationFrame(function () { requestAnimationFrame(drawSpineMapEdges); });
  }

  function handleSpineMapClick(event) {
    const card = event.target.closest("[data-map-node]");
    if (!card) return;
    const layer = M.nodeLayer(project, card.dataset.mapNode);
    if (!layer) return;
    dom.spineMapDialog.close();
    switchLayer(layer);
    selectNode(card.dataset.mapNode);
    setTimeout(fitCanvas, 20);
  }

  function renderPackManager() {
    const packs = M.getRegisteredPacks();
    dom.packList.innerHTML = packs.length ? packs.map(function (pack) {
      return '<article class="pack-card"><div class="pack-card-head"><span><h3>' + M.escapeHtml(pack.name) + '</h3><p>' + M.escapeHtml(pack.source) + '</p></span><button class="pack-remove" type="button" data-remove-pack="' + M.escapeHtml(pack.id) + '">Remove definitions</button></div><div class="pack-badges"><span>v' + M.escapeHtml(pack.version) + '</span><span>' + M.escapeHtml(pack.testStatus) + '</span><span>' + M.escapeHtml(pack.licenseStatus) + '</span><span>' + pack.blocks.length + ' blocks</span></div><div class="pack-blocks">' + pack.blocks.map(function (block) { return M.escapeHtml(M.LAYERS[block.layer].index + " " + block.label); }).join(" · ") + "</div></article>";
    }).join("") : '<div class="pack-empty">No community packs are installed. Built-in blocks remain available.<br>Export the example to see the strict, code-free pack format.</div>';
  }

  function openPackManager() {
    renderPackManager();
    showDialog(dom.packManagerDialog);
  }

  function importPackFile(file) {
    if (!file) return;
    if (file.size > 1024 * 1024) {
      toast("That block pack is larger than the 1 MB beta limit. Nothing was imported.", "error", 5000);
      dom.importPackInput.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = function () {
      let payload;
      try { payload = JSON.parse(String(reader.result)); }
      catch (_) {
        toast("The selected pack is not valid JSON. Nothing was registered.", "error", 5000);
        dom.importPackInput.value = "";
        return;
      }
      const result = M.registerBlockPack(payload);
      if (!result.valid) {
        toast("Pack rejected: " + result.errors.slice(0, 3).join(" "), "error", 7600);
        dom.importPackInput.value = "";
        return;
      }
      try { persistPacks(); }
      catch (_) {
        M.unregisterBlockPack(result.pack.id);
        toast("The browser could not store that pack locally. It was not installed.", "error", 5500);
        return;
      }
      addLedger("block-pack.registered", "Registered community block pack “" + result.pack.name + "” without granting permissions", null);
      scheduleSave();
      renderPackManager();
      renderPalette();
      dom.importPackInput.value = "";
      toast(result.pack.name + " added to the palette. Its source and test status remain visible.");
    };
    reader.onerror = function () { toast("The selected pack could not be read. Nothing was registered.", "error"); };
    reader.readAsText(file);
  }

  function removePack(packId) {
    const pack = M.getRegisteredPacks().find(function (item) { return item.id === packId; });
    if (!pack || !M.unregisterBlockPack(packId)) return;
    try { persistPacks(); }
    catch (_) { M.registerBlockPack(pack); toast("The pack could not be removed from local storage.", "error"); return; }
    addLedger("block-pack.unregistered", "Removed block pack definitions for “" + pack.name + "”; existing project blocks were preserved", null);
    scheduleSave();
    renderPackManager();
    renderPalette();
    renderCanvas();
    renderInspector();
    toast("Pack definitions removed. Existing project blocks remain preserved as unknown source.", "warning", 5200);
  }

  function handlePackClick(event) {
    const remove = event.target.closest("[data-remove-pack]");
    if (remove) removePack(remove.dataset.removePack);
  }

  function exportPackTemplate() {
    downloadBlob(JSON.stringify(M.blockPackTemplate(), null, 2), "application/json", "axm-example-block-pack.json");
    toast("Example community block pack downloaded.");
  }

  function showDialog(dialog) {
    if (!dialog.open) dialog.showModal();
  }


  function proposalTextIsUntouchedTemplate() {
    const text = String(dom.aiProposalText && dom.aiProposalText.value || "").trim();
    if (!text) return true;
    try {
      const payload = JSON.parse(text);
      return payload && payload.schema === "axm.agent.proposal" && Array.isArray(payload.actions) && payload.actions.length === 0 && String(payload.proposalId || "").includes("replace-me");
    } catch (_) {
      return false;
    }
  }

  function renderAgentWorkspaceSummary(workspace) {
    const layers = workspace.observation.layers;
    const nodes = Object.keys(layers).reduce(function (count, layer) { return count + layers[layer].nodes.length; }, 0);
    const routes = Object.keys(layers).reduce(function (count, layer) { return count + layers[layer].edges.length; }, 0);
    const pendingPermissions = workspace.observation.permissions.filter(function (permission) { return !permission.approved; }).length;
    const reviewCount = workspace.observation.reviewLog.length;
    const selected = workspace.task.selectedNode;
    const diagnostics = workspace.observation.diagnostics;
    const goal = workspace.task.goal && workspace.task.goal.statement || "No human outcome has been written yet.";
    dom.aiWorkspaceSummary.innerHTML =
      '<div class="ai-summary-goal"><b>Human outcome:</b> ' + M.escapeHtml(goal) + '</div>' +
      '<article class="ai-summary-card score"><b>' + diagnostics.score + '%</b><small>diagnostic readiness · ' + diagnostics.errors + ' errors · ' + diagnostics.warnings + ' warnings</small></article>' +
      '<article class="ai-summary-card"><b>' + nodes + '</b><small>blocks across all three layers</small></article>' +
      '<article class="ai-summary-card"><b>' + routes + '</b><small>same-layer routes</small></article>' +
      '<article class="ai-summary-card"><b>' + workspace.observation.bindings.length + '</b><small>cross-layer bindings</small></article>' +
      '<article class="ai-summary-card' + (pendingPermissions ? " warning" : "") + '"><b>' + pendingPermissions + '</b><small>permission requests still human-pending</small></article>' +
      '<article class="ai-summary-card"><b>' + reviewCount + '</b><small>human review receipts</small></article>' +
      '<article class="ai-summary-card wide"><b>' + M.escapeHtml(selected ? selected.label : "No block selected") + '</b><small>' + M.escapeHtml(selected ? selected.layer + ':' + selected.type : "Select a block to include focused context") + '</small>' + (selected ? '<code>' + M.escapeHtml(selected.id) + '</code>' : '') + '</article>' +
      '<article class="ai-summary-card wide"><b>PROPOSE ONLY</b><small>' + workspace.actionProtocol.verbs.length + ' bounded verbs · ' + workspace.blockCatalog.length + ' known blocks · apply remains human-only</small><code>' + M.escapeHtml(workspace.schema + ' v' + workspace.schemaVersion) + '</code></article>';
  }

  function emptyAgentReview(message, symbol) {
    dom.aiProposalReview.innerHTML = '<div class="ai-review-empty"><span>' + M.escapeHtml(symbol || "?") + '</span><div><b>' + M.escapeHtml(message || "No proposal reviewed yet") + '</b><p>Validation runs on a cloned project. It never changes the active source or proves the result works.</p></div></div>';
  }

  function clearAgentProposalReview(message, symbol) {
    runtime.agentProposalReview = null;
    runtime.agentProposalPayload = null;
    [dom.aiCheckActions, dom.aiCheckAuthority, dom.aiCheckApply].forEach(function (checkbox) { checkbox.checked = false; });
    dom.aiReviewChecklist.classList.remove("ready");
    dom.aiApplyProposalButton.disabled = true;
    emptyAgentReview(message, symbol);
  }

  function refreshAgentWorkspace(preserveReview) {
    const previousReview = runtime.agentProposalReview;
    const previousPayload = runtime.agentProposalPayload;
    runtime.agentWorkspace = M.generateAgentWorkspace(project, runtime.selectedNodeId);
    const workspace = runtime.agentWorkspace;
    renderAgentWorkspaceSummary(workspace);
    const fullText = JSON.stringify(workspace, null, 2);
    dom.aiObservationPreview.textContent = fullText.length > 36000 ? fullText.slice(0, 36000) + "\n… preview truncated; export preserves the complete packet …" : fullText;
    let stampTime = workspace.source.projectUpdatedAt;
    try { stampTime = new Date(stampTime).toLocaleString([], { dateStyle: "short", timeStyle: "short" }); } catch (_) { /* Preserve source timestamp. */ }
    dom.aiSourceStamp.textContent = "project " + workspace.source.projectId.slice(-8) + " · " + stampTime + " · " + workspace.source.builderVersion;
    const stale = previousReview && previousPayload && String(previousPayload.source && previousPayload.source.projectUpdatedAt || "") !== String(project.meta.updatedAt);
    if (stale) {
      clearAgentProposalReview("Source changed after this proposal was reviewed. Export a fresh workspace and rebase before applying.", "!");
    } else if (!preserveReview && previousReview) {
      renderAgentProposalReview(previousReview);
    }
    return workspace;
  }

  function openAiWorkbench() {
    const refreshTemplate = proposalTextIsUntouchedTemplate();
    refreshAgentWorkspace(false);
    if (refreshTemplate) dom.aiProposalText.value = JSON.stringify(M.agentProposalTemplate(project), null, 2);
    showDialog(dom.aiWorkbenchDialog);
  }

  function exportAgentWorkspace() {
    const workspace = refreshAgentWorkspace(true);
    downloadBlob(JSON.stringify(workspace, null, 2), "application/json", M.slugify(project.name) + ".axm-agent-workspace.json");
    addLedger("agent.workspace.exported", "Exported a local young AI observation workspace; nothing was sent or applied", null);
    scheduleSave();
    toast("Young AI workspace downloaded. Nothing was sent, executed or applied.");
  }

  function copyAgentObservation() {
    const workspace = refreshAgentWorkspace(true);
    copyText(JSON.stringify(workspace, null, 2), "Complete young AI observation copied. Nothing was sent or applied.");
  }

  function exportAgentProposalTemplate() {
    const template = M.agentProposalTemplate(project);
    downloadBlob(JSON.stringify(template, null, 2), "application/json", M.slugify(project.name) + ".axm-agent-proposal-template.json");
    toast("Fresh proposal template downloaded for the current source stamp.");
  }

  function updateAgentApplyButton() {
    const reviewed = Boolean(runtime.agentProposalReview && runtime.agentProposalReview.valid && runtime.agentProposalPayload);
    const checked = dom.aiCheckActions.checked && dom.aiCheckAuthority.checked && dom.aiCheckApply.checked;
    dom.aiApplyProposalButton.disabled = !(reviewed && checked);
  }

  function renderReviewList(title, items, className, formatter) {
    if (!Array.isArray(items) || !items.length) return "";
    return '<section class="ai-review-section"><h4>' + M.escapeHtml(title) + '</h4><ul class="ai-review-list ' + M.escapeHtml(className || "") + '">' + items.map(function (item) {
      return '<li>' + (formatter ? formatter(item) : M.escapeHtml(String(item))) + '</li>';
    }).join("") + '</ul></section>';
  }

  function renderAgentProposalReview(review) {
    const valid = Boolean(review && review.valid);
    const errors = review && Array.isArray(review.errors) ? review.errors : ["Proposal validation did not return a usable result."];
    const warnings = review && Array.isArray(review.warnings) ? review.warnings : [];
    if (!valid) {
      dom.aiProposalReview.innerHTML =
        '<div class="ai-review-status invalid"><span class="ai-review-mark">×</span><div><b>Proposal blocked before apply</b><small>The active project is unchanged. Repair every error, then validate again.</small></div><span class="ai-review-score">' + errors.length + ' error' + (errors.length === 1 ? "" : "s") + '</span></div>' +
        renderReviewList("Blocking errors", errors, "errors") +
        renderReviewList("Warnings", warnings, "warnings");
      dom.aiReviewChecklist.classList.remove("ready");
      [dom.aiCheckActions, dom.aiCheckAuthority, dom.aiCheckApply].forEach(function (checkbox) { checkbox.checked = false; });
      dom.aiApplyProposalButton.disabled = true;
      return;
    }

    const proposal = review.normalizedProposal || {};
    const impact = review.impact || {};
    const delta = impact.delta || {};
    const beforeDiagnostics = impact.diagnosticsBefore || {};
    const afterDiagnostics = impact.diagnosticsAfter || {};
    const impactItems = [
      ["blocks", delta.nodes || 0], ["routes", delta.edges || 0], ["bindings", delta.bindings || 0], ["protected rules", delta.invariants || 0], ["state keys", delta.stateKeys || 0],
      ["reactions", delta.influenceRules || 0], ["visual states", delta.visualStates || 0], ["code drafts", delta.codeHooks || 0]
    ];
    dom.aiProposalReview.innerHTML =
      '<div class="ai-review-status valid"><span class="ai-review-mark">✓</span><div><b>' + M.escapeHtml(proposal.title || "Valid bounded proposal") + '</b><small>' + Number((proposal.actions || []).length) + ' declared actions passed protocol validation and clone dry-run. Source is still unchanged.</small></div><span class="ai-review-score">' + Number(beforeDiagnostics.score || 0) + '→' + Number(afterDiagnostics.score || 0) + '%</span></div>' +
      '<div class="ai-review-impact">' + impactItems.map(function (item) {
        const value = Number(item[1] || 0);
        return '<article class="ai-impact-card"><b class="' + (value ? "changed" : "") + '">' + (value > 0 ? "+" : "") + value + '</b><small>' + M.escapeHtml(item[0]) + '</small></article>';
      }).join("") + '</div>' +
      renderReviewList("Dry-run change list", review.changes || [], "changes", function (change) {
        return '<span class="ai-change-verb">' + M.escapeHtml(change.verb || "change") + '</span>' + M.escapeHtml(change.summary || "Declared change");
      }) +
      renderReviewList("Declared tests — not yet run", proposal.tests || [], "tests") +
      renderReviewList("Warnings", warnings, "warnings") +
      renderReviewList("Unresolved risks", proposal.unresolvedRisks || [], "warnings");
    dom.aiReviewChecklist.classList.add("ready");
    [dom.aiCheckActions, dom.aiCheckAuthority, dom.aiCheckApply].forEach(function (checkbox) { checkbox.checked = false; });
    updateAgentApplyButton();
  }

  function validateAgentProposalPayload(payload, quiet) {
    const review = M.validateAgentProposal(payload, project);
    runtime.agentProposalPayload = payload;
    runtime.agentProposalReview = review;
    renderAgentProposalReview(review);
    if (!quiet) toast(review.valid ? "Proposal is structurally valid and dry-ran on a clone. It has not been applied." : "Proposal is blocked. Review the listed errors; the project is unchanged.", review.valid ? "success" : "error", review.valid ? 4700 : 6200);
    return review;
  }

  function validateAgentProposalText() {
    const sourceText = String(dom.aiProposalText.value || "");
    if (sourceText.length > 2 * 1024 * 1024) {
      const review = { valid: false, errors: ["Proposal text exceeds the 2 MB local review limit."], warnings: [], changes: [] };
      runtime.agentProposalPayload = null;
      runtime.agentProposalReview = review;
      renderAgentProposalReview(review);
      toast("Proposal text is larger than the 2 MB review limit. The active project is unchanged.", "error", 5200);
      return review;
    }
    let payload;
    try { payload = JSON.parse(sourceText); }
    catch (error) {
      const review = { valid: false, errors: ["Proposal text is not valid JSON: " + error.message], warnings: [], changes: [] };
      runtime.agentProposalPayload = null;
      runtime.agentProposalReview = review;
      renderAgentProposalReview(review);
      toast("Proposal JSON could not be parsed. The active project is unchanged.", "error", 5200);
      return review;
    }
    return validateAgentProposalPayload(payload, false);
  }

  function readAgentProposalFile(file) {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast("That proposal is larger than the 2 MB review limit. Nothing was loaded.", "error", 5200);
      dom.aiProposalFileInput.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = function () {
      dom.aiProposalText.value = String(reader.result || "");
      dom.aiProposalFileInput.value = "";
      validateAgentProposalText();
    };
    reader.onerror = function () {
      dom.aiProposalFileInput.value = "";
      toast("The proposal file could not be read. The active project is unchanged.", "error");
    };
    reader.readAsText(file);
  }

  function clearAgentProposal() {
    dom.aiProposalText.value = "";
    dom.aiProposalFileInput.value = "";
    clearAgentProposalReview("Proposal review cleared. The active project was not changed.", "–");
  }

  function applyReviewedAgentProposal() {
    if (!runtime.agentProposalReview || !runtime.agentProposalReview.valid || !runtime.agentProposalPayload) return;
    if (!(dom.aiCheckActions.checked && dom.aiCheckAuthority.checked && dom.aiCheckApply.checked)) return;
    const proposalPayload = M.clone(runtime.agentProposalPayload);
    const preflight = M.applyAgentProposal(project, proposalPayload);
    if (!preflight.valid || !preflight.project) {
      runtime.agentProposalReview = preflight;
      renderAgentProposalReview(preflight);
      toast("The proposal became stale or invalid before confirmation. Nothing changed.", "error", 5600);
      return;
    }
    const title = preflight.normalizedProposal.title;
    const actionCount = preflight.normalizedProposal.actions.length;
    const reopenWorkbench = dom.aiWorkbenchDialog.open;
    if (reopenWorkbench) dom.aiWorkbenchDialog.close();
    showConfirm("Apply reviewed proposal?", "“" + title + "” contains " + actionCount + " bounded action" + (actionCount === 1 ? "" : "s") + ". This becomes one undoable project change. It does not prove the result works; diagnostics and the changed path still need to be tested.", "Apply as candidate", function () {
      hideConfirm();
      const finalApplied = M.applyAgentProposal(project, proposalPayload);
      if (!finalApplied.valid || !finalApplied.project) {
        if (reopenWorkbench) openAiWorkbench();
        dom.aiProposalText.value = JSON.stringify(proposalPayload, null, 2);
        runtime.agentProposalPayload = proposalPayload;
        runtime.agentProposalReview = finalApplied;
        renderAgentProposalReview(finalApplied);
        toast("The source changed while confirmation was open. The stale proposal was blocked and nothing was applied.", "error", 6200);
        return;
      }
      const selectedBefore = runtime.selectedNodeId;
      commit("Applied human-reviewed young AI proposal “" + title + "” (" + actionCount + " actions)", { type: "ai.proposal.applied", layer: null, actor: "young-ai proposal + human approval", immediate: true }, function () {
        project = finalApplied.project;
        if (selectedBefore && !M.findNode(project, selectedBefore)) runtime.selectedNodeId = null;
        runtime.agentWorkspace = null;
        runtime.agentProposalReview = null;
        runtime.agentProposalPayload = null;
      });
      dom.aiProposalText.value = "";
      clearAgentProposalReview("Proposal applied as one undoable candidate change. Run diagnostics and test the changed path next.", "✓");
      refreshAgentWorkspace(true);
      toast("Reviewed proposal applied. It remains one undoable candidate until you verify the actual result.", "success", 6200);
      if (reopenWorkbench) openAiWorkbench();
    }, function () {
      if (reopenWorkbench) openAiWorkbench();
    });
  }

  function focusNodeById(nodeId) {
    const layer = M.nodeLayer(project, nodeId);
    if (!layer) return false;
    runtime.activeLayer = layer;
    runtime.selectedNodeId = nodeId;
    runtime.selectedEdgeId = null;
    runtime.inspectorTab = "inspect";
    runtime.pendingConnection = null;
    if (dom.connectionToast) dom.connectionToast.classList.add("hidden");
    renderAll();
    dom.inspectorPanel.classList.add("open");
    setTimeout(function () {
      const nodeElement = $$('.builder-node', dom.nodeLayer).find(function (element) { return element.dataset.nodeId === nodeId; });
      if (!nodeElement) return;
      nodeElement.scrollIntoView({ block: "center", inline: "center" });
      nodeElement.focus({ preventScroll: true });
    }, 0);
    return true;
  }

  function stageAgentProposal(payload) {
    openAiWorkbench();
    dom.aiProposalText.value = typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
    return validateAgentProposalText();
  }

  function showConfirm(title, message, acceptLabel, callback, cancelCallback) {
    const openDialogs = $$("dialog[open]").filter(function (dialog) { return dialog !== dom.confirmOverlay; });
    confirmReturnDialog = openDialogs.length ? openDialogs[openDialogs.length - 1] : null;
    if (confirmReturnDialog) confirmReturnDialog.close();
    dom.confirmTitle.textContent = title;
    dom.confirmMessage.textContent = message;
    dom.confirmAcceptButton.textContent = acceptLabel || "Continue";
    confirmAction = callback;
    confirmCancelAction = cancelCallback || null;
    requestAnimationFrame(function () {
      if (!confirmAction && !confirmCancelAction) return;
      dom.confirmOverlay.classList.remove("hidden");
      if (!dom.confirmOverlay.open) dom.confirmOverlay.showModal();
      dom.confirmAcceptButton.focus();
    });
  }

  function hideConfirm() {
    const returnDialog = confirmReturnDialog;
    confirmReturnDialog = null;
    confirmAction = null;
    confirmCancelAction = null;
    if (dom.confirmOverlay.open) dom.confirmOverlay.close();
    dom.confirmOverlay.classList.add("hidden");
    if (returnDialog && returnDialog.isConnected && !returnDialog.open) {
      requestAnimationFrame(function () { if (!returnDialog.open) returnDialog.showModal(); });
    }
  }

  function cancelConfirm() {
    const cancel = confirmCancelAction;
    hideConfirm();
    if (cancel) cancel();
  }

  function requestTemplate(templateId) {
    const template = M.getTemplate(templateId);
    if (dom.templateDialog.open) dom.templateDialog.close();
    const hasWork = M.allNodes(project).length > 0 || project.name !== "Untitled project";
    if (hasWork) {
      showConfirm("Create “" + template.name + "”?", "The current project will stay intact in the local vault. This template will receive a new project identity and become the active workspace.", "Create new project", function () { loadTemplate(template); });
    } else {
      loadTemplate(template);
    }
  }

  function loadTemplate(template) {
    const next = template.build();
    next.meta.updatedAt = M.now();
    next.ledger.push({ id: M.uid("event"), at: M.now(), actor: "human", type: "template.activated", message: "Activated “" + template.name + "” in the builder", layer: null });
    const untouchedBlank = projectCount() === 1 && !M.allNodes(project).length && project.name === "Untitled project" && project.meta.templateId === "blank";
    hideConfirm();
    if (untouchedBlank) {
      delete vault.projects[project.id];
      project = next;
      vault.projects[project.id] = { project: M.clone(project), checkpoints: [], lastOpenedAt: M.now() };
      vault.activeProjectId = project.id;
      resetProjectRuntime();
      storeVaultState();
      setDirty(false);
      renderAll();
      setTimeout(fitCanvas, 20);
      toast(template.name + " loaded. Review requested capability permissions before building.", "success", 4300);
    } else {
      addProjectToVault(next, { message: template.name + " created as a new project. Review requested capability permissions before building." });
    }
  }

  function renderDiagnostics() {
    const result = M.validateProject(project);
    runtime.lastValidation = result;
    dom.drawerScore.textContent = result.score + "%";
    dom.drawerScore.style.borderColor = result.errors ? "var(--red)" : result.warnings ? "var(--yellow)" : "var(--green)";
    dom.drawerScore.style.color = result.errors ? "var(--red)" : result.warnings ? "var(--yellow)" : "var(--green)";
    dom.diagnosticSummary.innerHTML = '<span class="summary-pill error">' + result.errors + ' errors</span><span class="summary-pill warning">' + result.warnings + ' warnings</span><span class="summary-pill pass">' + result.passes + " passed</span>";
    const order = { error: 0, warning: 1, pass: 2 };
    dom.diagnosticList.innerHTML = result.checks.slice().sort(function (a, b) { return order[a.level] - order[b.level]; }).map(function (check) {
      const symbol = check.level === "error" ? "×" : check.level === "warning" ? "!" : "✓";
      const layerLabel = M.LAYERS[check.layer] ? M.LAYERS[check.layer].label : check.layer;
      return '<article class="diagnostic-item ' + check.level + '"><span class="diagnostic-symbol">' + symbol + '</span><span class="diagnostic-copy"><b>' + M.escapeHtml(check.title) + '</b><small>' + M.escapeHtml(check.detail) + '</small></span><span class="diagnostic-layer">' + M.escapeHtml(layerLabel) + "</span></article>";
    }).join("");
    updateStatus();
  }

  function openDiagnostics() {
    renderDiagnostics();
    dom.diagnosticsDrawer.classList.add("open");
    dom.diagnosticsDrawer.setAttribute("aria-hidden", "false");
  }

  function closeDiagnostics() {
    dom.diagnosticsDrawer.classList.remove("open");
    dom.diagnosticsDrawer.setAttribute("aria-hidden", "true");
  }

  function refreshPreview() {
    dom.previewAddress.textContent = "local-preview://" + M.slugify(project.name);
    dom.previewFrame.srcdoc = M.generateStandaloneHTML(project);
  }

  function openPreview() {
    refreshPreview();
    showDialog(dom.previewDialog);
  }

  function openExport() {
    const result = M.validateProject(project);
    runtime.lastValidation = result;
    dom.exportStatusText.textContent = result.blocked ? "The portable project source is available, but the working HTML build is blocked until critical checks pass." : "Choose what leaves the builder. Nothing is uploaded or published.";
    dom.exportReadiness.innerHTML = '<span class="score-ring" style="border-color:' + (result.errors ? "var(--red)" : result.warnings ? "var(--yellow)" : "var(--green)") + ';color:' + (result.errors ? "var(--red)" : result.warnings ? "var(--yellow)" : "var(--green)") + '">' + result.score + '%</span><span><b>' + (result.blocked ? "Build has critical blockers" : result.warnings ? "Build is usable with declared beta warnings" : "Build checks passed") + '</b><small>' + result.errors + " errors · " + result.warnings + " warnings · " + result.passes + " checks passed</small></span>";
    dom.exportHtmlButton.disabled = result.blocked;
    showDialog(dom.exportDialog);
  }

  function downloadBlob(contents, mime, filename) {
    const blob = new Blob([contents], { type: mime });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function exportProjectSource() {
    const exportCopy = M.projectSnapshot(project);
    downloadBlob(JSON.stringify(exportCopy, null, 2), "application/json", M.slugify(project.name) + ".axm-project.json");
    addLedger("project.exported", "Exported complete AXM project source", null);
    scheduleSave();
    toast("Portable project source downloaded.");
  }

  function exportHtmlBuild() {
    const result = M.validateProject(project);
    if (result.blocked) {
      if (dom.exportDialog.open) dom.exportDialog.close();
      openDiagnostics();
      toast("The HTML build is blocked by critical checks. Project source export remains available.", "error", 5200);
      return;
    }
    downloadBlob(M.generateStandaloneHTML(project), "text/html", M.slugify(project.name) + ".html");
    addLedger("build.exported", "Exported standalone HTML build", null);
    scheduleSave();
    toast("Standalone working build downloaded.");
  }

  function exportAiIntentPacket() {
    const packet = M.generateAiIntentPacket(project);
    downloadBlob(JSON.stringify(packet, null, 2), "application/json", M.slugify(project.name) + ".axm-intent.json");
    addLedger("intent.exported", "Exported a propose-only AI intent packet; no provider was contacted", null);
    scheduleSave();
    toast("Propose-only AI intent packet downloaded. Nothing was sent or applied.");
  }

  function exportEngineHandoff() {
    const packet = M.generateEngineHandoff(project);
    downloadBlob(JSON.stringify(packet, null, 2), "application/json", M.slugify(project.name) + ".axm-engine-handoff.json");
    addLedger("engine-handoff.exported", "Exported an external-engine handoff contract without executing commands", null);
    scheduleSave();
    toast("Engine handoff contract downloaded. No engine project or command was executed.");
  }

  function importProjectFile(file) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast("That project source is larger than the 5 MB beta intake limit. Nothing was imported.", "error", 5000);
      return;
    }
    const reader = new FileReader();
    reader.onload = function () {
      let candidate;
      try {
        candidate = M.normalizeProject(JSON.parse(String(reader.result)));
      } catch (error) {
        toast(error.message || "The project source could not be validated. Nothing was replaced.", "error", 5600);
        dom.importProjectInput.value = "";
        return;
      }
      const result = M.validateProject(candidate);
      if (dom.exportDialog.open) dom.exportDialog.close();
      showConfirm("Import “" + candidate.name + "”?", "Validation found " + result.errors + " errors and " + result.warnings + " warnings. It will be added as a separate vault project; the current source will not be overwritten.", "Add validated project", function () {
        hideConfirm();
        addProjectToVault(candidate, { message: "Validated project added to the vault. Unknown blocks, if any, were preserved." });
      });
      dom.importProjectInput.value = "";
    };
    reader.onerror = function () { toast("The selected file could not be read. Nothing was replaced.", "error"); };
    reader.readAsText(file);
  }

  function autoArrange() {
    const data = activeLayerData();
    if (!data.nodes.length) return;
    const byId = new Map(data.nodes.map(function (node) { return [node.id, node]; }));
    const incoming = new Map(data.nodes.map(function (node) { return [node.id, 0]; }));
    data.edges.forEach(function (edge) {
      if (incoming.has(edge.to) && byId.has(edge.from)) incoming.set(edge.to, incoming.get(edge.to) + 1);
    });
    const depth = new Map();
    const queue = data.nodes.filter(function (node) { return incoming.get(node.id) === 0; });
    queue.forEach(function (node) { depth.set(node.id, 0); });
    let guard = 0;
    while (queue.length && guard < 1000) {
      guard += 1;
      const current = queue.shift();
      const currentDepth = depth.get(current.id) || 0;
      data.edges.filter(function (edge) { return edge.from === current.id; }).forEach(function (edge) {
        if (!byId.has(edge.to)) return;
        depth.set(edge.to, Math.max(depth.get(edge.to) || 0, currentDepth + 1));
        incoming.set(edge.to, incoming.get(edge.to) - 1);
        if (incoming.get(edge.to) <= 0) queue.push(byId.get(edge.to));
      });
    }
    data.nodes.forEach(function (node, index) {
      if (!depth.has(node.id)) depth.set(node.id, index % 5);
    });
    const columns = new Map();
    data.nodes.forEach(function (node) {
      const column = Math.min(4, depth.get(node.id) || 0);
      if (!columns.has(column)) columns.set(column, []);
      columns.get(column).push(node);
    });
    commit("Auto-arranged the " + M.LAYERS[runtime.activeLayer].label.toLowerCase() + " canvas", { type: "canvas.arranged", layer: runtime.activeLayer }, function () {
      Array.from(columns.entries()).sort(function (a, b) { return a[0] - b[0]; }).forEach(function (entry) {
        const column = entry[0], nodes = entry[1];
        nodes.forEach(function (node, row) {
          node.x = 90 + column * 295;
          node.y = 90 + row * 155;
          node.updatedAt = M.now();
        });
      });
    });
    setTimeout(fitCanvas, 20);
  }

  function setZoom(value) {
    const next = Math.max(0.55, Math.min(1.35, Math.round(value * 20) / 20));
    const old = runtime.zoom;
    if (next === old) return;
    const centerX = (dom.canvasViewport.scrollLeft + dom.canvasViewport.clientWidth / 2) / old;
    const centerY = (dom.canvasViewport.scrollTop + dom.canvasViewport.clientHeight / 2) / old;
    runtime.zoom = next;
    renderCanvas();
    dom.canvasViewport.scrollLeft = centerX * next - dom.canvasViewport.clientWidth / 2;
    dom.canvasViewport.scrollTop = centerY * next - dom.canvasViewport.clientHeight / 2;
    storeUiState();
  }

  function fitCanvas() {
    const nodes = activeLayerData().nodes;
    if (!nodes.length) {
      runtime.zoom = 1;
      renderCanvas();
      dom.canvasViewport.scrollTo({ left: 0, top: 0, behavior: "smooth" });
      return;
    }
    const minX = Math.min.apply(null, nodes.map(function (node) { return node.x; }));
    const minY = Math.min.apply(null, nodes.map(function (node) { return node.y; }));
    const maxX = Math.max.apply(null, nodes.map(function (node) { return node.x + NODE_WIDTH; }));
    const maxY = Math.max.apply(null, nodes.map(function (node) { return node.y + NODE_HEIGHT; }));
    const availableWidth = Math.max(300, dom.canvasViewport.clientWidth - 80);
    const availableHeight = Math.max(250, dom.canvasViewport.clientHeight - 80);
    runtime.zoom = Math.max(0.55, Math.min(1.1, Math.floor(Math.min(availableWidth / Math.max(300, maxX - minX), availableHeight / Math.max(220, maxY - minY)) * 20) / 20));
    renderCanvas();
    setTimeout(function () {
      dom.canvasViewport.scrollTo({ left: Math.max(0, (minX - 40) * runtime.zoom), top: Math.max(0, (minY - 40) * runtime.zoom), behavior: "smooth" });
    }, 0);
    storeUiState();
  }

  function toast(message, type, duration) {
    type = type || "success";
    duration = duration || 3100;
    const element = document.createElement("div");
    element.className = "toast " + type;
    element.innerHTML = '<span class="toast-symbol">' + (type === "error" ? "×" : type === "warning" ? "!" : "✓") + '</span><span>' + M.escapeHtml(message) + "</span>";
    dom.toastStack.appendChild(element);
    setTimeout(function () {
      element.classList.add("leaving");
      setTimeout(function () { element.remove(); }, 230);
    }, duration);
  }

  function onNodeLayerClick(event) {
    const nodeElement = event.target.closest(".builder-node");
    if (!nodeElement) return;
    const nodeId = nodeElement.dataset.nodeId;
    if (runtime.suppressNodeClickId === nodeId && performance.now() < runtime.suppressNodeClickUntil) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    const port = event.target.closest("[data-port]");
    if (port) {
      event.stopPropagation();
      if (port.dataset.port === "output") startConnection(nodeId);
      else if (port.dataset.port === "input") completeConnection(nodeId);
      return;
    }
    selectNode(nodeId);
  }

  function onNodeLayerPointerDown(event) {
    const header = event.target.closest(".node-header");
    const nodeElement = event.target.closest(".builder-node");
    if (header && nodeElement) beginNodeDrag(event, nodeElement);
  }

  function onNodeLayerKeydown(event) {
    const nodeElement = event.target.closest(".builder-node");
    if (!nodeElement || event.target.closest("button")) return;
    const nodeId = nodeElement.dataset.nodeId;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectNode(nodeId);
      setTimeout(function () {
        const focused = $$(".builder-node", dom.nodeLayer).find(function (element) { return element.dataset.nodeId === nodeId; });
        if (focused) focused.focus({ preventScroll: true });
      }, 0);
      return;
    }
    const movement = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1]
    }[event.key];
    if (!movement) return;
    event.preventDefault();
    const node = M.findNode(project, nodeId);
    if (!node) return;
    const step = event.shiftKey ? 1 : 10;
    runtime.selectedNodeId = nodeId;
    commit("Moved “" + node.label + "” with the keyboard", { type: "block.moved.keyboard", layer: node.layer }, function () {
      node.x = Math.max(25, Math.min(CANVAS_WIDTH - NODE_WIDTH - 25, node.x + movement[0] * step));
      node.y = Math.max(25, Math.min(CANVAS_HEIGHT - NODE_HEIGHT - 25, node.y + movement[1] * step));
      node.updatedAt = M.now();
    });
    setTimeout(function () {
      const focused = $$(".builder-node", dom.nodeLayer).find(function (element) { return element.dataset.nodeId === nodeId; });
      if (focused) focused.focus({ preventScroll: true });
    }, 0);
  }

  function wireEvents() {
    $$(".layer-button").forEach(function (button) {
      button.addEventListener("click", function () { switchLayer(button.dataset.layer); });
    });

    dom.blockList.addEventListener("click", function (event) {
      const add = event.target.closest("[data-add-block]");
      if (add) addNode(add.dataset.addBlock);
    });
    dom.blockSearch.addEventListener("input", function () { runtime.paletteSearch = dom.blockSearch.value; renderPalette(); });
    dom.customBlockButton.addEventListener("click", function () {
      if (runtime.activeLayer !== "logic") {
        switchLayer("logic");
        toast("Readable custom code belongs in the logic layer. The view was switched without changing your project.");
      }
      addNode("custom-code");
    });

    dom.canvasViewport.addEventListener("dragover", function (event) {
      if (!hasTransferType(event.dataTransfer, "application/x-axm-block")) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      const drag = runtime.paletteDrag;
      if (drag) updatePaletteDropPreview(drag.layer, drag.type, event.clientX, event.clientY, event.shiftKey);
    });
    dom.canvasViewport.addEventListener("dragleave", function (event) {
      if (!event.relatedTarget || !dom.canvasViewport.contains(event.relatedTarget)) clearCanvasDropPreview();
    });
    dom.canvasViewport.addEventListener("drop", function (event) {
      if (!hasTransferType(event.dataTransfer, "application/x-axm-block")) return;
      event.preventDefault();
      try {
        const payload = JSON.parse(event.dataTransfer.getData("application/x-axm-block"));
        const placement = resolvePlacement(dropPosition(event), { freeMove: Boolean(event.shiftKey) });
        clearCanvasDropPreview();
        if (payload.layer !== runtime.activeLayer) {
          toast("The active layer changed during the drag. Nothing was added.", "warning");
          return;
        }
        if (!isKnownPaletteBlock(payload.layer, payload.type)) {
          toast("That drag payload was not a recognized AXM block.", "warning");
          return;
        }
        addNode(payload.type, placement);
        dom.palettePanel.classList.remove("open");
      } catch (_) {
        clearCanvasDropPreview();
        toast("That drag payload was not a recognized AXM block.", "warning");
      }
    });

    dom.blockList.addEventListener("pointerdown", onPalettePointerDown);
    document.addEventListener("pointermove", onPalettePointerMove, { passive: false });
    document.addEventListener("pointerup", onPalettePointerUp);
    document.addEventListener("pointercancel", onPalettePointerCancel);

    dom.nodeLayer.addEventListener("click", onNodeLayerClick);
    dom.nodeLayer.addEventListener("pointerdown", onNodeLayerPointerDown);
    dom.nodeLayer.addEventListener("keydown", onNodeLayerKeydown);
    dom.canvasViewport.addEventListener("pointerdown", function (event) {
      if (event.target === dom.canvasViewport || event.target === dom.canvasSurface || event.target === dom.nodeLayer) {
        runtime.selectedNodeId = null;
        renderCanvas();
        renderInspector();
      }
    });

    $$(".inspector-tab").forEach(function (tab) {
      tab.addEventListener("click", function () {
        runtime.inspectorTab = tab.dataset.inspectorTab;
        renderInspector();
        dom.inspectorPanel.classList.add("open");
      });
    });
    dom.inspectorContent.addEventListener("change", onInspectorChange);
    dom.inspectorContent.addEventListener("click", onInspectorClick);

    dom.projectNameTop.addEventListener("change", function () { updateProjectField("name", dom.projectNameTop.value); });
    dom.projectNameTop.addEventListener("keydown", function (event) { if (event.key === "Enter") dom.projectNameTop.blur(); });
    dom.undoButton.addEventListener("click", undo);
    dom.redoButton.addEventListener("click", redo);
    dom.templateButton.addEventListener("click", function () { showDialog(dom.templateDialog); });
    dom.projectVaultButton.addEventListener("click", openProjectVault);
    dom.projectVaultContent.addEventListener("click", handleVaultClick);
    dom.createCheckpointButton.addEventListener("click", createCheckpoint);
    dom.vaultNewProjectButton.addEventListener("click", function () { dom.projectVaultDialog.close(); openGoalBuilder(); });
    dom.goalBuilderButton.addEventListener("click", openGoalBuilder);
    dom.applyGoalButton.addEventListener("click", applyGoalToCurrent);
    dom.createGoalProjectButton.addEventListener("click", createProjectFromGoal);
    dom.goalTemplateSelect.addEventListener("change", function () {
      const template = M.getTemplate(dom.goalTemplateSelect.value);
      dom.goalTargetSelect.value = template.target;
      const selected = $$('[data-goal-capability]:checked', dom.goalCapabilityChoices).map(function (input) { return input.value; });
      renderGoalCapabilityChoices(template.target, selected);
    });
    dom.goalTargetSelect.addEventListener("change", function () {
      const selected = $$('[data-goal-capability]:checked', dom.goalCapabilityChoices).map(function (input) { return input.value; });
      renderGoalCapabilityChoices(dom.goalTargetSelect.value, selected);
    });
    dom.spineMapButton.addEventListener("click", openSpineMap);
    dom.spineMapGrid.addEventListener("click", handleSpineMapClick);
    dom.packManagerButton.addEventListener("click", openPackManager);
    dom.packList.addEventListener("click", handlePackClick);
    dom.importPackInput.addEventListener("change", function () { importPackFile(dom.importPackInput.files[0]); });
    dom.exportPackTemplateButton.addEventListener("click", exportPackTemplate);
    dom.aiWorkbenchButton.addEventListener("click", openAiWorkbench);
    dom.aiRefreshWorkspaceButton.addEventListener("click", function () { refreshAgentWorkspace(true); toast("Young AI observation refreshed from the active source."); });
    dom.aiExportWorkspaceButton.addEventListener("click", exportAgentWorkspace);
    dom.aiCopyObservationButton.addEventListener("click", copyAgentObservation);
    dom.aiExportProposalTemplateButton.addEventListener("click", exportAgentProposalTemplate);
    dom.aiProposalFileInput.addEventListener("change", function () { readAgentProposalFile(dom.aiProposalFileInput.files[0]); });
    dom.aiValidateProposalButton.addEventListener("click", validateAgentProposalText);
    dom.aiClearProposalButton.addEventListener("click", clearAgentProposal);
    [dom.aiCheckActions, dom.aiCheckAuthority, dom.aiCheckApply].forEach(function (checkbox) { checkbox.addEventListener("change", updateAgentApplyButton); });
    dom.aiApplyProposalButton.addEventListener("click", applyReviewedAgentProposal);
    dom.emptyTemplateButton.addEventListener("click", function () { showDialog(dom.templateDialog); });
    dom.templateGrid.addEventListener("click", function (event) {
      const card = event.target.closest("[data-template-id]");
      if (card) requestTemplate(card.dataset.templateId);
    });
    dom.helpButton.addEventListener("click", function () { showDialog(dom.guideDialog); });

    dom.testButton.addEventListener("click", openDiagnostics);
    dom.readinessButton.addEventListener("click", openDiagnostics);
    dom.closeDiagnosticsButton.addEventListener("click", closeDiagnostics);
    dom.previewButton.addEventListener("click", openPreview);
    dom.refreshPreviewButton.addEventListener("click", refreshPreview);
    dom.buildButton.addEventListener("click", openExport);
    dom.previewExportButton.addEventListener("click", function () { if (dom.previewDialog.open) dom.previewDialog.close(); openExport(); });
    $$("[data-preview-size]").forEach(function (button) {
      button.addEventListener("click", function () {
        $$("[data-preview-size]").forEach(function (item) { item.classList.toggle("active", item === button); });
        dom.previewStage.classList.toggle("mobile", button.dataset.previewSize === "mobile");
      });
    });

    dom.exportProjectButton.addEventListener("click", exportProjectSource);
    dom.exportHtmlButton.addEventListener("click", exportHtmlBuild);
    dom.exportAiIntentButton.addEventListener("click", exportAiIntentPacket);
    dom.exportAgentWorkspaceButton.addEventListener("click", exportAgentWorkspace);
    dom.exportEngineHandoffButton.addEventListener("click", exportEngineHandoff);
    dom.copySpineButton.addEventListener("click", function () { copyText(JSON.stringify(project, null, 2), "Complete project spine copied."); });
    dom.importProjectInput.addEventListener("change", function () { importProjectFile(dom.importProjectInput.files[0]); });

    dom.fitButton.addEventListener("click", fitCanvas);
    dom.zoomOutButton.addEventListener("click", function () { setZoom(runtime.zoom - 0.1); });
    dom.zoomInButton.addEventListener("click", function () { setZoom(runtime.zoom + 0.1); });
    dom.autoArrangeButton.addEventListener("click", autoArrange);
    dom.cancelConnectionButton.addEventListener("click", cancelConnection);

    dom.confirmCancelButton.addEventListener("click", cancelConfirm);
    dom.confirmAcceptButton.addEventListener("click", function () {
      const action = confirmAction;
      hideConfirm();
      if (action) action();
    });
    dom.confirmOverlay.addEventListener("cancel", function (event) {
      event.preventDefault();
      cancelConfirm();
    });

    dom.mobileCanvasButton.addEventListener("click", function () {
      dom.inspectorPanel.classList.remove("open");
      dom.palettePanel.classList.remove("open");
      dom.canvasViewport.focus({ preventScroll: true });
    });
    dom.mobileMenuButton.addEventListener("click", function () { dom.palettePanel.classList.toggle("open"); });
    dom.closePaletteButton.addEventListener("click", function () { dom.palettePanel.classList.remove("open"); });

    document.addEventListener("keydown", function (event) {
      const confirmOpen = !dom.confirmOverlay.classList.contains("hidden");
      if (confirmOpen) {
        if (event.key === "Escape") cancelConfirm();
        event.preventDefault();
        return;
      }
      const editing = ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement && document.activeElement.tagName);
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        event.shiftKey ? redo() : undo();
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
        event.preventDefault(); redo();
      } else if (event.key === "/" && !editing) {
        event.preventDefault(); dom.blockSearch.focus();
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d" && runtime.selectedNodeId && !editing) {
        event.preventDefault(); duplicateNode(runtime.selectedNodeId);
      } else if ((event.key === "Delete" || event.key === "Backspace") && runtime.selectedNodeId && !editing) {
        event.preventDefault(); removeNode(runtime.selectedNodeId);
      } else if (event.key === "Escape") {
        if (runtime.pendingConnection) cancelConnection();
        else closeDiagnostics();
      }
    });

    window.addEventListener("beforeunload", function () {
      clearTimeout(saveTimer);
      try {
        const existing = vault.projects[project.id] || { checkpoints: [] };
        vault.projects[project.id] = { project: M.clone(project), checkpoints: existing.checkpoints || [], lastOpenedAt: M.now() };
        vault.activeProjectId = project.id;
        storeVaultState();
      } catch (_) { /* Best effort only. */ }
    });
    window.addEventListener("resize", function () { if (dom.spineMapDialog.open) requestAnimationFrame(drawSpineMapEdges); });
  }

  function registerOfflineShell() {
    if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
      navigator.serviceWorker.register("sw.js").catch(function (error) {
        console.info("Offline shell registration was unavailable:", error.message);
      });
    }
  }

  function init() {
    cacheDom();
    loadInitialProject();
    renderTemplates();
    wireEvents();
    renderAll();
    registerOfflineShell();
    window.AXMShapeableBuilder = {
      version: M.APP_VERSION,
      getProject: function () { return M.clone(project); },
      getVaultSummary: function () {
        return {
          activeProjectId: vault.activeProjectId,
          projects: Object.values(vault.projects).map(function (record) { return { id: record.project.id, name: record.project.name, checkpoints: record.checkpoints.length }; }),
          trash: Object.values(vault.trash).map(function (record) { return { id: record.project.id, name: record.project.name }; })
        };
      },
      validate: function () { return M.validateProject(project); },
      loadTemplate: function (id) { loadTemplate(M.getTemplate(id)); },
      generateBuild: function () { return M.generateStandaloneHTML(project); },
      generateAiIntent: function () { return M.generateAiIntentPacket(project); },
      generateAgentWorkspace: function () { return M.generateAgentWorkspace(project, runtime.selectedNodeId); },
      getAgentProposalTemplate: function () { return M.agentProposalTemplate(project); },
      validateAgentProposal: function (payload) { return M.validateAgentProposal(payload, project); },
      stageAgentProposal: function (payload) { return stageAgentProposal(payload); },
      focusNode: function (nodeId) { return focusNodeById(nodeId); },
      getInfluenceProfile: function (nodeId) {
        const node = M.findNode(project, nodeId);
        return node ? M.clone(M.getInfluenceProfile(node.layer, node.type)) : null;
      },
      simulateInfluence: function (nodeId, trigger, ruleId) {
        const node = M.findNode(project, nodeId);
        return node ? M.simulateInfluence(node, trigger, ruleId) : null;
      },
      generateBlockAssetRequest: function (nodeId) { return M.generateBlockAssetRequest(project, nodeId); },
      generateEngineHandoff: function () { return M.generateEngineHandoff(project); }
    };
    if (firstLaunch) {
      setTimeout(function () { showDialog(dom.templateDialog); }, 280);
    } else {
      setTimeout(fitCanvas, 120);
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
