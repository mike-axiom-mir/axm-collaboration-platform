(function () {
  "use strict";

  var KEY = "axm.asset-fabric.v1";
  var Core = window.AXMAssetFabric;
  var Creation = window.AXMCreationIncubator;
  var Hands = window.AXMAssetHands;
  var Composer = window.AXMPlayComposer;
  var Pulse = window.AXMBodyPulseClient;
  var PULSE_MODULE_ID = "asset-fabric";
  var state;
  var composerDraft = null;
  var composerParentDigest = null;
  var composerBranch = 0;
  var heartbeatTimer = null;
  var $ = function (id) {
    return document.getElementById(id);
  };

  function load() {
    try {
      state = JSON.parse(localStorage.getItem(KEY) || "null");
    } catch (e) {}
    state = Core.normalizeState(state);
    state.activeNeedId = state.needs.some(function (need) {
      return need.id === state.activeNeedId;
    })
      ? state.activeNeedId
      : state.needs[0] && state.needs[0].id;
    state.heartbeat = state.heartbeat || {
      active: false,
      cadenceMinutes: 30,
      totalBeats: 0,
      heldBeats: 0,
      lastBeatAt: null,
      lastStatus: "stopped",
      goalId: null,
    };
    state.heartbeat.active = false;
    state.heartbeat.cadenceMinutes = Math.max(
      15,
      Number(state.heartbeat.cadenceMinutes) || 30,
    );
    state.heartbeat.heldBeats = Number(state.heartbeat.heldBeats) || 0;
    state.heartbeat.lastStatus = state.heartbeat.lastStatus || "stopped";
    state.archive = state.archive || Creation.newArchive("asset-fabric-seed-0");
    state.reviewQueue = state.reviewQueue || {
      defaultLimitPerGoal: 8,
      items: [],
    };
    state.reviewQueue.defaultLimitPerGoal = Math.max(
      1,
      Number(
        state.reviewQueue.defaultLimitPerGoal || state.reviewQueue.limit,
      ) || 8,
    );
    state.reviewQueue.items = Array.isArray(state.reviewQueue.items)
      ? state.reviewQueue.items
      : [];
    state.reviewQueue.items.forEach(function (item) {
      if (item.goalId) return;
      var candidate =
        state.candidates &&
        state.candidates.find(function (entry) {
          return entry.id === item.candidateId;
        });
      item.goalId =
        (candidate && candidate.need && candidate.need.id) ||
        "legacy-unassigned";
    });
    state = Core.quarantineLegacyMachineSignals(state).state;
    save();
  }

  function save() {
    localStorage.setItem(KEY, JSON.stringify(state));
  }
  function dataUrl(svg) {
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }
  function composerValues() {
    return {
      title: $("composerDraftTitle").value,
      label: $("composerLabel").value,
      shape: $("composerShape").value,
      primary: $("composerPrimary").value,
      secondary: $("composerSecondary").value,
      background: $("composerBackground").value,
      angle: $("composerAngle").value,
      roundness: $("composerRoundness").value,
      scale: $("composerScale").value,
      stroke: $("composerStroke").value,
      glow: $("composerGlow").value,
      growth_direction: $("composerDirection").value,
      growth_energy: $("composerEnergy").value,
      parent_input_digest: composerParentDigest,
      branch: composerBranch,
    };
  }
  function applyComposerSpec(spec) {
    $("composerDraftTitle").value = spec.title;
    $("composerLabel").value = spec.label;
    $("composerShape").value = spec.shape;
    $("composerPrimary").value = spec.primary;
    $("composerSecondary").value = spec.secondary;
    $("composerBackground").value = spec.background;
    $("composerAngle").value = spec.angle;
    $("composerRoundness").value = spec.roundness;
    $("composerScale").value = spec.scale;
    $("composerStroke").value = spec.stroke;
    $("composerGlow").value = spec.glow;
    $("composerDirection").value = spec.growth_direction;
    $("composerEnergy").value = spec.growth_energy;
    composerParentDigest = spec.parent_input_digest;
    composerBranch = spec.branch;
  }
  function renderComposer() {
    try {
      composerDraft = Composer.buildDraft(composerValues());
      $("composerPreview").src = dataUrl(composerDraft.preview.svg);
      $("composerStatus").textContent = composerDraft.receipt.status;
      $("composerStatus").classList.remove("error");
      $("composerTruth").textContent =
        "4 immutable pieces · " +
        composerDraft.graph.connections.length +
        " typed links · grow " +
        composerDraft.spec.growth_direction +
        " at energy " +
        composerDraft.spec.growth_energy +
        " · zero AI · preview temporary until you choose Keep";
      $("composerJson").textContent = JSON.stringify(
        {
          schema: composerDraft.schema,
          input_digest: composerDraft.input_digest,
          components: composerDraft.components.map(function (component) {
            return {
              id: component.id,
              version: component.version,
              kind: component.kind,
              digest: component.digest,
              payload: component.payload,
            };
          }),
          graph: composerDraft.graph,
          receipt: composerDraft.receipt,
          truth: composerDraft.truth,
        },
        null,
        2,
      );
    } catch (error) {
      composerDraft = null;
      $("composerStatus").textContent = "INVALID_DRAFT";
      $("composerStatus").classList.add("error");
      $("composerTruth").textContent = error.message;
    }
  }
  function incubateComposerDraft() {
    if (!composerDraft) return;
    var need = Core.normalizeNeed({
      title: composerDraft.spec.title,
      target: "shared",
      kind: "ui-component",
      intended_use: "component-draft",
      width: 640,
      height: 360,
      size: 640,
      transparent: false,
      purpose:
        "Human-authored deterministic component draft from Play Composer",
      target_canvas: composerDraft.graph.target_canvas,
      required_outputs: ["image/svg+xml"],
      editable_recipe_formats: [Core.UCP_GRAPH_SCHEMA],
      fallback_policy: {
        generalist: "forbidden",
        lossy_conversion: "forbidden",
      },
      quality_requirements: {
        require_preview: true,
        require_validation: true,
        require_editable_source: true,
        minimum_quality_score: 0,
        strict_validation: true,
      },
    });
    state.generation = Number(state.generation || 0) + 1;
    var candidate = Core.candidateFromComponentDraft(
      need,
      state.generation,
      composerDraft,
    );
    if (
      !state.needs.some(function (existing) {
        return existing.id === need.id;
      })
    )
      state.needs.push(need);
    if (
      !state.candidates.some(function (existing) {
        return existing.id === candidate.id;
      })
    ) {
      state.candidates.push(candidate);
      state.log.push({
        at: new Date().toISOString(),
        kind: "human-play-compose-incubated",
        candidateId: candidate.id,
        graphDigest: composerDraft.graph.digest,
        inputDigest: composerDraft.input_digest,
      });
    }
    state.activeNeedId = need.id;
    save();
    render();
    $("composerTruth").textContent =
      "Explicitly kept in the incubator. Votes begin empty; READY_CONTRACT still does not mean visually approved.";
  }
  function esc(value) {
    return String(value == null ? "" : value).replace(
      /[&<>"']/g,
      function (character) {
        return {
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        }[character];
      },
    );
  }
  function openNeed() {
    return (
      state.needs.find(function (need) {
        return need.id === state.activeNeedId && need.status === "open";
      }) ||
      state.needs.find(function (need) {
        return need.status === "open";
      }) ||
      state.needs[0]
    );
  }
  function candidateArtifact(candidate) {
    if (!candidate.handResult)
      return candidate.svg
        ? {
            filename:
              candidate.need.title.toLowerCase().replace(/[^a-z0-9]+/g, "-") +
              "-candidate-unreviewed.svg",
            mime: "image/svg+xml",
            format: "SVG",
            text: candidate.svg,
          }
        : null;
    return (
      candidate.handResult.artifacts.find(function (artifact) {
        return (
          candidate.primaryArtifact &&
          artifact.id === candidate.primaryArtifact.id
        );
      }) ||
      candidate.handResult.artifacts.find(function (artifact) {
        return artifact.id === candidate.handResult.previewArtifactId;
      }) ||
      candidate.handResult.artifacts[0]
    );
  }
  function candidatePreviewUrl(candidate) {
    if (
      candidate.preview &&
      /^data:image\/(?:png|apng|jpeg|webp)/.test(
        candidate.preview.dataUrl || "",
      )
    )
      return candidate.preview.dataUrl;
    var artifact = candidateArtifact(candidate);
    if (
      artifact &&
      artifact.mime === "image/svg+xml" &&
      artifact.format === "SVG"
    )
      return dataUrl(artifact.text);
    if (
      artifact &&
      /^image\/(?:png|apng|jpeg|webp)$/.test(artifact.mime) &&
      /^data:image\//.test(artifact.dataUrl || "")
    )
      return artifact.dataUrl;
    return "";
  }
  function downloadCandidateArtifact(candidate) {
    var artifact = candidateArtifact(candidate);
    if (!artifact) return;
    if (artifact.dataUrl) {
      var anchor = document.createElement("a");
      anchor.download = artifact.filename || "asset-candidate";
      anchor.href = artifact.dataUrl;
      anchor.click();
      return;
    }
    download(
      artifact.filename || "asset-candidate",
      artifact.mime || "application/octet-stream",
      artifact.text || "",
    );
  }
  function vocabularyArtifact(entry) {
    return (
      (entry.sourceArtifacts || []).find(function (artifact) {
        return (
          entry.primaryArtifact && artifact.id === entry.primaryArtifact.id
        );
      }) ||
      (entry.sourceArtifacts || [])[0] ||
      (entry.svg
        ? {
            filename: entry.name + ".svg",
            mime: "image/svg+xml",
            format: "SVG",
            text: entry.svg,
          }
        : null)
    );
  }
  function vocabularyPreviewUrl(entry) {
    var artifact = vocabularyArtifact(entry);
    if (
      entry.preview &&
      /^data:image\/(?:png|apng|jpeg|webp)/.test(entry.preview.dataUrl || "")
    )
      return entry.preview.dataUrl;
    return artifact && artifact.mime === "image/svg+xml"
      ? dataUrl(artifact.text)
      : artifact &&
          /^data:image\/(?:png|apng|jpeg|webp)/.test(artifact.dataUrl || "")
        ? artifact.dataUrl
        : "";
  }

  async function generate(trigger) {
    var need = openNeed();
    if (!need) return;
    state.generation += 1;
    var handFamily =
      Hands && Hands.createFamilyAsync
        ? await Hands.createFamilyAsync(need, {
            maxHands: 8,
            seed: need.id + ":fabric-generation:" + state.generation,
            host: {
              capabilities: ["svg", "json"],
              accepts: [
                Hands.RESULT_SCHEMA,
                "image/svg+xml",
                "image/png",
                "image/ktx2",
                "image/jpeg",
                "image/webp",
                "application/json",
                "application/dxf",
              ],
            },
          })
        : null;
    var family = handFamily
      ? Core.familyFromHands(need, state.generation, handFamily)
      : Core.family(need, state.generation);
    state.routeIssues =
      handFamily && handFamily.issues
        ? handFamily.issues.map(function (issue) {
            return Object.assign({ needId: need.id }, issue);
          })
        : [];
    family.forEach(function (candidate) {
      var result = Creation.consider(state.archive, {
        id: candidate.id,
        nicheId: candidate.need.id,
        origin: "asset-fabric",
        nodes: candidate.nodes,
        descriptors: candidate.descriptors,
        values: candidate.values,
        constraints: {
          valid: candidate.technical.pass,
          violations: candidate.technical.errors,
        },
      });
      state.archive = result.archive;
      candidate.archiveDecision = result.receipt.decision;
      candidate.novelty = result.receipt.novelty;
      state.candidates.unshift(candidate);
    });
    state.candidates = state.candidates.slice(0, 60);
    state.log.push({
      at: new Date().toISOString(),
      kind: "family",
      trigger: trigger || "manual",
      needId: need.id,
      targetCanvas: need.target_canvas,
      routeStatus: handFamily
        ? handFamily.status
        : "LEGACY_REGISTRY_UNAVAILABLE",
      hands: handFamily
        ? handFamily.results.map(function (result) {
            return result.hand.id;
          })
        : ["legacy-procedural"],
      heldHands: handFamily ? handFamily.failures : [],
      routeIssues: state.routeIssues,
      candidates: family.map(function (candidate) {
        return candidate.id;
      }),
    });
    save();
    render();
  }

  function vote(id) {
    state = Core.vote(state, id, "mike", true);
    save();
    render();
  }

  function promote(id) {
    try {
      state = Core.promote(state, id);
      save();
      render();
    } catch (error) {
      alert(error.message);
    }
  }

  function download(name, type, content) {
    var anchor = document.createElement("a");
    anchor.download = name;
    anchor.href = URL.createObjectURL(new Blob([content], { type: type }));
    anchor.click();
    setTimeout(function () {
      URL.revokeObjectURL(anchor.href);
    }, 1000);
  }

  function exportReviewRequest(id) {
    try {
      var packet = Core.machineReviewRequest(state, id);
      var goalId = packet.need.id;
      var openItems = state.reviewQueue.items.filter(function (item) {
        return item.status === "OPEN" && item.goalId === goalId;
      });
      var existing = openItems.find(function (item) {
        return (
          item.candidateId === packet.candidateId &&
          item.candidateDigest === packet.candidateDigest
        );
      });
      if (
        !existing &&
        openItems.length >= state.reviewQueue.defaultLimitPerGoal
      )
        throw new Error(
          "Review attention queue for this goal is full. Creation remains available; finish or hold one of this goal’s existing reviews before requesting another.",
        );
      if (!existing)
        state.reviewQueue.items.push({
          queueItemId: "review-" + packet.requestId,
          goalId: goalId,
          candidateId: packet.candidateId,
          candidateDigest: packet.candidateDigest,
          status: "OPEN",
          requestedAt: new Date().toISOString(),
          resolvedAt: null,
        });
      save();
      render();
      download(
        "asset-fabric-review-" + id + ".json",
        "application/json",
        JSON.stringify(packet, null, 2),
      );
    } catch (error) {
      alert(error.message);
    }
  }

  function applyMachineReview(receipt) {
    state = Core.applyMachineReview(state, receipt);
    state.reviewQueue.items.forEach(function (item) {
      if (
        item.candidateId === receipt.candidateId &&
        item.candidateDigest === receipt.candidateDigest &&
        item.status === "OPEN"
      ) {
        item.status = "RESOLVED";
        item.resolvedAt = new Date().toISOString();
        item.verdict = receipt.verdict;
      }
    });
    save();
    render();
  }

  function importMachineReview(file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        applyMachineReview(JSON.parse(String(reader.result || "")));
      } catch (error) {
        alert("Machine review refused: " + error.message);
      } finally {
        $("machineReceiptFile").value = "";
      }
    };
    reader.readAsText(file);
  }

  function candidateCard(candidate) {
    var humanComponentDraft =
      candidate.origin && candidate.origin.kind === "human-play-to-compose/v1";
    var humanUp = candidate.votes.mike && candidate.votes.mike.value === "UP";
    var hasMachineReceipt = Core.validMachineReview(candidate);
    var machineUp =
      hasMachineReceipt && candidate.votes["axiom-mir"].value === "UP";
    var machineLabel = hasMachineReceipt
      ? machineUp
        ? "✓ Axiom/Mir receipt"
        : "Axiom/Mir " + esc(candidate.votes["axiom-mir"].value)
      : "Machine review pending";
    var preserved =
      candidate.archiveDecision &&
      candidate.archiveDecision.indexOf("PRESERVE_") === 0;
    var canPromote =
      candidate.technical.pass && preserved && humanUp && machineUp;
    var previewUrl = candidatePreviewUrl(candidate),
      artifact = candidateArtifact(candidate);
    return (
      '<article class="card">' +
      '<div class="preview">' +
      (previewUrl
        ? '<img src="' + previewUrl + '" alt="">'
        : '<span class="no-preview">No visual preview<br>' +
          esc((artifact && artifact.mime) || "artifact") +
          "</span>") +
      "</div>" +
      '<div class="body"><h3>' +
      esc(candidate.need.title) +
      " · v" +
      candidate.variant +
      "</h3>" +
      (candidate.assetHand
        ? '<span class="creator">' +
          esc(candidate.assetHand.title) +
          " · v" +
          esc(candidate.assetHand.version) +
          "</span>"
        : humanComponentDraft
          ? '<span class="creator">Human Play Composer · typed UCP graph</span>'
          : '<span class="creator">Legacy procedural provider</span>') +
      '<span class="creator">' +
      esc(candidate.need.target_canvas.medium) +
      " / " +
      esc(candidate.need.target_canvas.dimensions.unit) +
      " / " +
      esc((artifact && artifact.format) || "DATA") +
      "</span>" +
      '<div class="tags"><span class="tag ' +
      (candidate.technical.pass ? "pass" : "") +
      '">' +
      (candidate.technical.pass ? "TECH PASS" : "HOLD") +
      "</span>" +
      '<span class="tag novel">' +
      esc(
        candidate.archiveDecision ||
          (humanComponentDraft ? "UCP DRAFT" : "UNASSESSED"),
      ) +
      '</span><span class="tag">novel ' +
      (Number.isFinite(Number(candidate.novelty))
        ? Number(candidate.novelty).toFixed(2)
        : "unscored") +
      "</span></div>" +
      '<div class="votes"><button data-human-vote="' +
      candidate.id +
      '" class="' +
      (humanUp ? "up" : "") +
      '">' +
      (humanUp ? "✓ Mike" : "Mike +") +
      "</button>" +
      '<button class="machine-seat ' +
      (machineUp ? "up" : "") +
      '" disabled title="Only an independent connector receipt can fill this seat.">' +
      machineLabel +
      "</button></div>" +
      '<button class="review-packet" data-candidate-artifact="' +
      candidate.id +
      '">Download ' +
      esc((artifact && artifact.format) || "artifact") +
      " · unreviewed</button>" +
      (candidate.handResult
        ? '<button class="review-packet" data-candidate-bundle="' +
          candidate.id +
          '">Download hand result + metadata</button>'
        : "") +
      '<button class="review-packet" data-review-packet="' +
      candidate.id +
      '">Export machine review packet</button>' +
      '<button class="promote" data-promote="' +
      candidate.id +
      '" ' +
      (canPromote ? "" : "disabled") +
      ">Promote to vocabulary</button></div></article>"
    );
  }

  function render() {
    var preserved = state.candidates.filter(function (candidate) {
      return (
        candidate.archiveDecision &&
        candidate.archiveDecision.indexOf("PRESERVE_") === 0
      );
    });
    $("needCount").textContent = state.needs.filter(function (need) {
      return need.status === "open";
    }).length;
    $("candidateCount").textContent = preserved.length;
    $("vocabCount").textContent = state.vocabulary.length;
    $("handCount").textContent = Hands && Hands.list ? Hands.list().length : 0;
    $("beatCount").textContent = state.heartbeat.totalBeats || 0;
    $("heartbeatState").textContent = state.heartbeat.active
      ? "Running"
      : "Stopped";
    $("pulseDetail").textContent = state.heartbeat.active
      ? "Body Pulse · " +
        state.heartbeat.lastStatus +
        " · " +
        (state.heartbeat.heldBeats || 0) +
        " held"
      : "Body-governed · explicit start";
    $("heartbeat").textContent = state.heartbeat.active
      ? "Stop heartbeat"
      : "Start heartbeat";
    $("cadence").value = String(state.heartbeat.cadenceMinutes || 30);
    var openReviews = state.reviewQueue.items.filter(function (item) {
      return item.status === "OPEN";
    }).length;
    $("reviewQueueState").textContent =
      openReviews +
      " open · max " +
      state.reviewQueue.defaultLimitPerGoal +
      " per goal";
    $("needs").innerHTML =
      state.needs
        .map(function (need) {
          return (
            '<div class="need ' +
            (need.id === openNeed().id ? "active" : "") +
            '" data-need-id="' +
            esc(need.id) +
            '"><b>' +
            esc(need.title) +
            "</b><small>" +
            esc(need.intended_use) +
            " · " +
            esc(need.target_canvas.medium) +
            " · " +
            need.target_canvas.dimensions.width +
            "×" +
            need.target_canvas.dimensions.height +
            " " +
            esc(need.target_canvas.dimensions.unit) +
            "<br>" +
            esc(need.purpose) +
            "</small></div>"
          );
        })
        .join("") || '<div class="empty">No needs yet.</div>';
    var selectedNeed = openNeed();
    var routeHost = Hands
      ? {
          capabilities: ["svg", "json"],
          permissions: [],
          accepts: [
            Hands.RESULT_SCHEMA,
            "image/svg+xml",
            "image/png",
            "image/apng",
            "image/ktx2",
            "image/jpeg",
            "image/webp",
            "application/json",
            "application/pdf",
            "application/dxf",
            "application/mtlx+xml",
            "application/vnd.opentimelineio+json",
            "text/css",
            "text/plain",
            "model/obj",
            "model/gltf-binary",
          ],
        }
      : null;
    var routes =
      Hands && selectedNeed ? Hands.routes(selectedNeed, routeHost) : [];
    var diagnosis =
      Hands && Hands.diagnose && selectedNeed
        ? Hands.diagnose(selectedNeed, routeHost)
        : null;
    var issue =
      state.routeIssues &&
      state.routeIssues.find(function (item) {
        return item.needId === selectedNeed.id;
      });
    $("compatibleHands").innerHTML =
      routes
        .map(function (route) {
          return (
            '<span class="hand-chip ' +
            (route.score < 100 ? "fallback" : "") +
            '" title="' +
            esc(route.reason) +
            '">' +
            esc(route.hand.title) +
            "</span>"
          );
        })
        .join("") ||
      '<span class="meta route-error">' +
        esc(
          issue
            ? issue.code + ": " + issue.message
            : diagnosis
              ? diagnosis.status +
                ": missing " +
                diagnosis.request.kind +
                " hand for " +
                diagnosis.request.target_canvas.medium +
                " / " +
                (diagnosis.request.required_outputs.join(", ") ||
                  "declared output")
              : "No compatible hand is installed for this complete canvas contract.",
        ) +
        "</span>";
    $("candidates").innerHTML =
      state.candidates.map(candidateCard).join("") ||
      '<div class="empty">Generate a family from the first real need.</div>';
    $("vocabulary").innerHTML =
      state.vocabulary
        .map(function (entry) {
          var artifact = vocabularyArtifact(entry),
            url = vocabularyPreviewUrl(entry);
          return (
            '<article class="card"><div class="preview">' +
            (url
              ? '<img src="' + url + '" alt="">'
              : '<span class="no-preview">No visual preview</span>') +
            '</div><div class="body"><h3>' +
            esc(entry.name) +
            '</h3><div class="tags"><span class="tag pass">INDEPENDENT DUAL REVIEW</span><span class="tag">IMMUTABLE</span></div><button data-vocabulary-artifact="' +
            entry.id +
            '">Download ' +
            esc((artifact && artifact.format) || "artifact") +
            "</button></div></article>"
          );
        })
        .join("") ||
      '<div class="empty">Nothing is promoted by default. Human approval and a separate machine receipt are both required.</div>';

    Array.from(document.querySelectorAll("[data-human-vote]")).forEach(
      function (button) {
        button.onclick = function () {
          vote(button.dataset.humanVote);
        };
      },
    );
    Array.from(document.querySelectorAll("[data-review-packet]")).forEach(
      function (button) {
        button.onclick = function () {
          exportReviewRequest(button.dataset.reviewPacket);
        };
      },
    );
    Array.from(document.querySelectorAll("[data-candidate-artifact]")).forEach(
      function (button) {
        button.onclick = function () {
          var candidate = state.candidates.find(function (item) {
            return item.id === button.dataset.candidateArtifact;
          });
          if (candidate) downloadCandidateArtifact(candidate);
        };
      },
    );
    Array.from(document.querySelectorAll("[data-candidate-bundle]")).forEach(
      function (button) {
        button.onclick = function () {
          var candidate = state.candidates.find(function (item) {
            return item.id === button.dataset.candidateBundle;
          });
          if (candidate && candidate.handResult)
            download(
              candidate.need.title.toLowerCase().replace(/[^a-z0-9]+/g, "-") +
                "-asset-hand-result.json",
              "application/json",
              JSON.stringify(candidate.handResult, null, 2),
            );
        };
      },
    );
    Array.from(document.querySelectorAll("[data-need-id]")).forEach(
      function (button) {
        button.onclick = function () {
          state.activeNeedId = button.dataset.needId;
          save();
          render();
        };
      },
    );
    Array.from(document.querySelectorAll("[data-promote]")).forEach(
      function (button) {
        button.onclick = function () {
          promote(button.dataset.promote);
        };
      },
    );
    Array.from(document.querySelectorAll("[data-vocabulary-artifact]")).forEach(
      function (button) {
        button.onclick = function () {
          var entry = state.vocabulary.find(function (item) {
              return item.id === button.dataset.vocabularyArtifact;
            }),
            artifact = entry && vocabularyArtifact(entry);
          if (artifact) {
            if (artifact.dataUrl) {
              var anchor = document.createElement("a");
              anchor.download = artifact.filename;
              anchor.href = artifact.dataUrl;
              anchor.click();
            } else
              download(
                artifact.filename || entry.name,
                artifact.mime || "application/octet-stream",
                artifact.text || "",
              );
          }
        };
      },
    );
  }

  function registerPulseModule(enabled) {
    if (!Pulse)
      return Promise.reject(new Error("Body Pulse client unavailable"));
    return Pulse.register({
      moduleId: PULSE_MODULE_ID,
      name: "Asset Fabric",
      goalQueueId: "asset-fabric-goals",
      enabled: enabled === true,
      allowMaintenance: false,
      priority: 55,
      activeCadenceMs: state.heartbeat.cadenceMinutes * 60000,
      idleCadenceMs: 3600000,
      cost: { cpu: 8, memory: 5, gpu: 0 },
      authority: "incubator-candidate-only",
      promotionGate: "optional-project-constitution-or-explicit-export",
    });
  }

  function scheduleHeartbeat() {
    if (heartbeatTimer) clearTimeout(heartbeatTimer);
    heartbeatTimer = null;
    if (!state.heartbeat.active) return;
    heartbeatTimer = setTimeout(
      heartbeatCycle,
      state.heartbeat.cadenceMinutes * 60000,
    );
  }

  async function heartbeatCycle() {
    if (!state.heartbeat.active) return;
    try {
      var decision = await Pulse.runOnce(
        PULSE_MODULE_ID,
        async function () {
          await generate("body-pulse");
          state.heartbeat.totalBeats = (state.heartbeat.totalBeats || 0) + 1;
          state.heartbeat.lastBeatAt = new Date().toISOString();
          state.heartbeat.lastStatus = "candidate family created";
          save();
          render();
          return {
            summary: "Asset Fabric created one bounded candidate family.",
            effect: "browser-local-incubator-candidates-only",
          };
        },
        { leaseMs: 120000 },
      );
      if (!decision.granted) {
        state.heartbeat.heldBeats = (state.heartbeat.heldBeats || 0) + 1;
        state.heartbeat.lastStatus = "held: " + decision.reason;
        save();
        render();
      }
    } catch (error) {
      state.heartbeat.heldBeats = (state.heartbeat.heldBeats || 0) + 1;
      state.heartbeat.lastStatus = "held: " + error.message;
      save();
      render();
    }
    scheduleHeartbeat();
  }

  function stopHeartbeat() {
    if (heartbeatTimer) clearTimeout(heartbeatTimer);
    heartbeatTimer = null;
    state.heartbeat.active = false;
    state.heartbeat.lastStatus = "stopped";
    save();
    render();
    if (Pulse) registerPulseModule(false).catch(function () {});
  }

  async function startHeartbeat() {
    if (heartbeatTimer) clearTimeout(heartbeatTimer);
    heartbeatTimer = null;
    state.heartbeat.active = true;
    state.heartbeat.cadenceMinutes = Math.max(
      15,
      Number($("cadence").value) || 30,
    );
    state.heartbeat.goalId =
      "asset-fabric-family-run-" + Date.now().toString(36);
    state.heartbeat.lastStatus = "requesting body lease";
    save();
    render();
    try {
      await registerPulseModule(true);
      await Pulse.goal({
        goalId: state.heartbeat.goalId,
        moduleId: PULSE_MODULE_ID,
        queueId: "asset-fabric-goals",
        title:
          "Create bounded candidate families for current local asset needs",
        priority: 55,
        maxPulses: 12,
        status: "OPEN",
        createdBy: "mike-explicit-heartbeat-start",
        requiresReview: true,
      });
      await heartbeatCycle();
    } catch (error) {
      state.heartbeat.lastStatus = "held: " + error.message;
      state.heartbeat.heldBeats = (state.heartbeat.heldBeats || 0) + 1;
      save();
      render();
      scheduleHeartbeat();
    }
  }

  $("generate").onclick = async function () {
    var button = this,
      old = button.textContent;
    button.disabled = true;
    button.textContent = "Creating…";
    try {
      await generate("manual");
    } catch (error) {
      alert("Creation held: " + error.message);
    } finally {
      button.disabled = false;
      button.textContent = old;
    }
  };
  $("heartbeat").onclick = function () {
    if (state.heartbeat.active) stopHeartbeat();
    else startHeartbeat();
  };
  $("cadence").onchange = function () {
    state.heartbeat.cadenceMinutes = Math.max(15, Number(this.value) || 30);
    save();
    if (state.heartbeat.active) {
      registerPulseModule(true).catch(function () {});
      scheduleHeartbeat();
    }
  };
  function applyKindDefaults() {
    var kind = $("needKind").value,
      profile = null;
    if (["theme", "design-tokens"].indexOf(kind) >= 0)
      profile = {
        use: kind,
        medium: "ui",
        width: 1280,
        height: 720,
        unit: "px",
        colour: "srgb",
        behaviour: "responsive",
        outputs: "application/json, text/css",
        recipes: "axm.theme-token-recipe/v1",
        contrast: "4.5",
        editable: true,
      };
    if (["layout", "ui-layout"].indexOf(kind) >= 0)
      profile = {
        use: kind,
        medium: "ui",
        width: 1280,
        height: 720,
        unit: "px",
        colour: "srgb",
        behaviour: "responsive",
        outputs: "application/json, text/css",
        recipes: "axm.responsive-layout-recipe/v1",
        contrast: "4.5",
        editable: true,
      };
    if (["timeline", "sequence", "motion"].indexOf(kind) >= 0)
      profile = {
        use: kind,
        medium: "screen",
        width: 1920,
        height: 1080,
        unit: "px",
        colour: "srgb",
        behaviour: "animated",
        outputs: "application/vnd.opentimelineio+json",
        recipes: "axm.timeline-sequence-recipe/v1",
        editable: true,
      };
    if (["mesh", "3d-object", "prop"].indexOf(kind) >= 0)
      profile = {
        use: kind,
        medium: "3d-surface",
        width: 2,
        height: 1,
        unit: "m",
        colour: "material-channel",
        behaviour: "static",
        outputs: "model/obj, model/gltf-binary",
        recipes: "axm.parametric-mesh-recipe/v1",
        depth: "1",
        polygons: "1200",
        editable: true,
      };
    if (["material", "shader"].indexOf(kind) >= 0)
      profile = {
        use: kind === "shader" ? "shader" : "material",
        medium: "3d-surface",
        width: 1,
        height: 1,
        unit: "m",
        colour: "material-channel",
        behaviour: "static",
        outputs: "application/mtlx+xml, model/gltf-binary",
        recipes: "axm.material-graph/v1",
        polygons: "4000",
        editable: true,
      };
    if (kind === "texture")
      profile = {
        use: "texture",
        medium: "game-world",
        width: 256,
        height: 256,
        unit: "px",
        colour: "srgb",
        behaviour: "tileable",
        outputs: "image/ktx2",
        recipes: "axm.ktx2-texture-recipe/v1",
        textureMemory: "131072",
        editable: true,
      };
    if (kind === "animation")
      profile = {
        use: "animation",
        medium: "game-world",
        width: 64,
        height: 64,
        unit: "px",
        colour: "srgb",
        behaviour: "animated",
        outputs: "image/apng",
        recipes: "axm.animated-raster-recipe/v1",
        editable: true,
      };
    if (["device-ui", "midi-map", "notation", "score"].indexOf(kind) >= 0)
      profile = {
        use: kind,
        medium: "audio-device",
        width: 640,
        height: 360,
        unit: "px",
        colour: "srgb",
        behaviour: "interactive",
        outputs:
          "audio/midi, application/vnd.recordare.musicxml+xml, audio-device+json",
        recipes: "axm.audio-notation-recipe/v1",
        contrast: "4.5",
        editable: true,
      };
    if (
      ["poster", "cover", "document", "print-document", "label"].indexOf(
        kind,
      ) >= 0
    )
      profile = {
        use: kind,
        medium: "print",
        width: 210,
        height: 297,
        unit: "mm",
        colour: "cmyk",
        behaviour: "static",
        outputs: "application/pdf",
        recipes: "axm.production-print-recipe/v1",
        bleed: "3",
        stroke: ".25",
        editable: true,
      };
    if (!profile) return;
    $("needIntendedUse").value = profile.use;
    $("needMedium").value = profile.medium;
    $("needWidth").value = profile.width;
    $("needHeight").value = profile.height;
    $("needUnit").value = profile.unit;
    $("needColourSpace").value = profile.colour;
    $("needBehaviour").value = profile.behaviour;
    $("needRequiredOutputs").value = profile.outputs;
    $("needRecipeFormats").value = profile.recipes;
    $("needEditable").checked = profile.editable;
    if (profile.contrast) $("needContrast").value = profile.contrast;
    if (profile.bleed) $("needBleed").value = profile.bleed;
    if (profile.stroke) $("needMinStroke").value = profile.stroke;
    if (profile.depth) $("needDepth").value = profile.depth;
    if (profile.polygons) $("needPolygonBudget").value = profile.polygons;
    if (profile.textureMemory)
      $("needTextureBudget").value = profile.textureMemory;
  }
  $("needKind").addEventListener("change", applyKindDefaults);
  $("needMedium").addEventListener("change", function () {
    var medium = this.value,
      physical =
        [
          "print",
          "paper",
          "fabric",
          "wood",
          "metal",
          "physical-object",
        ].indexOf(medium) >= 0;
    if (medium === "game-world") {
      $("needUnit").value = "game-world-unit";
      $("needColourSpace").value = "srgb";
    } else if (medium === "3d-surface") {
      $("needUnit").value = "m";
      $("needColourSpace").value = "material-channel";
    } else if (physical) {
      $("needUnit").value = "mm";
      $("needColourSpace").value =
        medium === "print" || medium === "paper" ? "cmyk" : "srgb";
    } else {
      $("needUnit").value = "px";
      $("needColourSpace").value = "srgb";
    }
  });
  $("needForm").onsubmit = function (event) {
    event.preventDefault();
    function maybe(id) {
      return $(id).value === "" ? null : Number($(id).value);
    }
    function values(id) {
      return $(id)
        .value.split(",")
        .map(function (item) {
          return item.trim();
        })
        .filter(Boolean);
    }
    function merge(base, extra) {
      Object.keys(extra || {}).forEach(function (key) {
        if (
          extra[key] &&
          typeof extra[key] === "object" &&
          !Array.isArray(extra[key])
        ) {
          base[key] = merge(
            base[key] && typeof base[key] === "object" ? base[key] : {},
            extra[key],
          );
        } else base[key] = extra[key];
      });
      return base;
    }
    var unit = $("needUnit").value,
      behaviour = $("needBehaviour").value,
      repeat = $("needRepeat").value;
    var targetCanvas = {
      schema: Hands.TARGET_CANVAS_SCHEMA,
      medium: $("needMedium").value,
      dimensions: {
        width: Number($("needWidth").value),
        height: Number($("needHeight").value),
        depth: maybe("needDepth"),
        unit: unit,
      },
      colour: {
        space: $("needColourSpace").value,
        transparency:
          ["tile", "texture", "pattern", "background"].indexOf(
            $("needKind").value,
          ) < 0
            ? "allowed"
            : "opaque",
        minimum_contrast_ratio: maybe("needContrast"),
        printable_colours: $("needPrintable").checked,
      },
      physical: {
        unit: unit,
        bleed: maybe("needBleed"),
        minimum_stroke: maybe("needMinStroke"),
        cutting_tool_width: maybe("needToolWidth"),
        depth: maybe("needPhysicalDepth"),
        repeat: { mode: repeat },
        material_behaviour: values("needMaterial"),
      },
      behaviour:
        behaviour === "tileable" ? ["static", "tileable"] : [behaviour],
      performance: {
        max_file_bytes: maybe("needFileBudget"),
        max_texture_memory_bytes: maybe("needTextureBudget"),
        max_polygon_count: maybe("needPolygonBudget"),
        max_frame_ms: maybe("needFrameBudget"),
      },
      intended_use: $("needIntendedUse").value,
    };
    try {
      if ($("needCanvasJson").value.trim())
        targetCanvas = merge(
          targetCanvas,
          JSON.parse($("needCanvasJson").value),
        );
    } catch (error) {
      alert("Target canvas JSON was not added: " + error.message);
      return;
    }
    var need = Core.normalizeNeed({
      title: $("needTitle").value,
      target: $("needTarget").value,
      kind: $("needKind").value,
      intended_use: $("needIntendedUse").value,
      width: $("needWidth").value,
      height: $("needHeight").value,
      size:
        unit === "px"
          ? Math.max(
              Number($("needWidth").value) || 256,
              Number($("needHeight").value) || 256,
            )
          : 256,
      transparent:
        ["tile", "texture", "pattern", "background"].indexOf(
          $("needKind").value,
        ) < 0,
      purpose: "User-authored Asset Fabric requirement",
      target_canvas: targetCanvas,
      required_outputs: values("needRequiredOutputs"),
      editable_recipe_formats: values("needRecipeFormats"),
      fallback_policy: {
        generalist: $("needGeneralistFallback").checked
          ? "permitted"
          : "forbidden",
        lossy_conversion: $("needLossyFallback").checked
          ? "permitted"
          : "forbidden",
      },
      quality_requirements: {
        require_preview: true,
        require_validation: true,
        require_editable_source: $("needEditable").checked,
        minimum_quality_score: maybe("needMinimumQuality") || 0,
        strict_validation: $("needStrictValidation").checked,
      },
    });
    state.needs.push(need);
    state.activeNeedId = need.id;
    $("needTitle").value = "";
    save();
    render();
  };
  [
    "composerDraftTitle",
    "composerLabel",
    "composerShape",
    "composerPrimary",
    "composerSecondary",
    "composerBackground",
    "composerAngle",
    "composerRoundness",
    "composerScale",
    "composerStroke",
    "composerGlow",
    "composerDirection",
    "composerEnergy",
  ].forEach(function (id) {
    $(id).addEventListener("input", renderComposer);
    $(id).addEventListener("change", renderComposer);
  });
  $("composerRemix").onclick = function () {
    var next = Composer.directedVariation(
      composerValues(),
      $("composerDirection").value,
      Number($("composerEnergy").value),
      composerBranch + 1,
    );
    applyComposerSpec(next);
    renderComposer();
  };
  $("composerDownload").onclick = function () {
    if (!composerDraft) return;
    download(
      "axm-play-compose-" + composerDraft.input_digest.slice(0, 12) + ".json",
      "application/json",
      JSON.stringify(composerDraft, null, 2),
    );
  };
  $("composerIncubate").onclick = incubateComposerDraft;
  $("importMachineReview").onclick = function () {
    $("machineReceiptFile").click();
  };
  $("machineReceiptFile").onchange = function () {
    importMachineReview(this.files && this.files[0]);
  };
  $("exportVocabulary").onclick = function () {
    download(
      "axm-shared-asset-vocabulary.json",
      "application/json",
      JSON.stringify(
        { schema: "axm.asset-vocabulary/v1", entries: state.vocabulary },
        null,
        2,
      ),
    );
  };
  window.addEventListener("axm:asset-fabric-machine-review", function (event) {
    try {
      applyMachineReview(event.detail);
    } catch (error) {
      console.warn("Asset Fabric machine review refused:", error.message);
    }
  });
  window.addEventListener("beforeunload", stopHeartbeat);
  load();
  renderComposer();
  render();
})();
