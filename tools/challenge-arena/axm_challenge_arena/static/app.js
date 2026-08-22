const phases = ["DRAFT", "BUILDING", "SUBMISSIONS_CLOSED", "TESTED", "REVIEW_OPEN", "VOTING_CLOSED", "SYNTHESIZED", "FINALIZED"];
const phaseLabels = {
  DRAFT: "Draft", BUILDING: "Build", SUBMISSIONS_CLOSED: "Closed", TESTED: "Tested",
  REVIEW_OPEN: "Review", VOTING_CLOSED: "Voted", SYNTHESIZED: "Synthesized", FINALIZED: "Final"
};

const $ = (id) => document.getElementById(id);
let selectedId = null;
let refreshTimer = null;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, ch => ({"&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;"}[ch]));
}

function humanizeStatus(value) {
  return String(value || "").toLowerCase().replaceAll("_", " ").replace(/^./, ch => ch.toUpperCase());
}

async function getJson(url) {
  const response = await fetch(url, {cache: "no-store"});
  const body = await response.json();
  if (!response.ok || body.error) throw new Error(body.message || response.statusText);
  return body;
}

function setHealth(ok, text) {
  $("healthDot").className = `status-dot ${ok ? "online" : "offline"}`;
  $("healthText").textContent = text;
}

async function loadChallenges(keepSelection = true) {
  try {
    await getJson("/api/health");
    setHealth(true, "Local observer online");
    const data = await getJson("/api/challenges");
    renderChallengeList(data.challenges || []);
    if (!keepSelection || !selectedId) {
      const fromHash = decodeURIComponent(location.hash.replace(/^#/, ""));
      selectedId = data.challenges.some(item => item.challenge_id === fromHash) ? fromHash : data.challenges[0]?.challenge_id;
    }
    if (selectedId) await loadChallenge(selectedId);
    else showEmpty();
  } catch (error) {
    setHealth(false, "Observer unavailable");
    console.error(error);
  }
}

function renderChallengeList(challenges) {
  const list = $("challengeList");
  if (!challenges.length) {
    list.innerHTML = `<div class="empty-row">No local challenges yet.</div>`;
    return;
  }
  list.innerHTML = challenges.map(item => `
    <button class="challenge-item ${item.challenge_id === selectedId ? "active" : ""}" data-id="${escapeHtml(item.challenge_id)}">
      <strong>${escapeHtml(item.title || item.challenge_id)}</strong>
      <small><span>${escapeHtml(item.category || "OPEN")}</span><span class="state-mini">${escapeHtml(phaseLabels[item.state] || item.state)}</span></small>
    </button>`).join("");
  list.querySelectorAll(".challenge-item").forEach(button => button.addEventListener("click", async () => {
    selectedId = button.dataset.id;
    location.hash = encodeURIComponent(selectedId);
    await loadChallenges(true);
  }));
}

function showEmpty() {
  $("emptyState").hidden = false;
  $("challengeView").hidden = true;
}

async function loadChallenge(id) {
  const state = await getJson(`/api/challenge/${encodeURIComponent(id)}`);
  selectedId = id;
  $("emptyState").hidden = true;
  $("challengeView").hidden = false;
  renderState(state);
  loadIntegrity(id);
}

function renderState(state) {
  const packet = state.packet || {};
  const result = state.result || {};
  $("categoryPill").textContent = packet.category || "OPEN";
  $("sourceModule").textContent = `from ${packet.integration?.source_module || "standalone"}`;
  $("challengeId").textContent = state.challenge_id;
  $("challengeTitle").textContent = packet.title || state.challenge_id;
  $("challengeGoal").textContent = packet.goal || "";
  $("stageState").textContent = phaseLabels[state.state] || state.state;
  renderPhases(state.state);
  renderMetrics(state);
  renderCandidates(state);
  renderStage(state);
  renderAwards(result);
  renderMerge(state.merge_map || {});
  renderDissent(result, state.merge_map || {});
  renderDecision(state);
  if (result.recommendation_status) {
    const confidence = result.confidence ? ` · ${result.confidence} confidence` : "";
    $("confidencePill").textContent = `${humanizeStatus(result.recommendation_status)}${confidence}`;
  } else {
    $("confidencePill").textContent = "Awaiting result";
  }
}

function renderPhases(current) {
  const currentIndex = phases.indexOf(current);
  $("phaseTrack").innerHTML = phases.map((phase, index) => `
    <div class="phase ${index < currentIndex ? "done" : ""} ${index === currentIndex ? "current" : ""}">
      <div class="phase-line"></div><span>${phaseLabels[phase]}</span>
    </div>`).join("");
}

function renderMetrics(state) {
  const activeSubmissions = Object.values(state.submissions || {}).filter(item => item.status === "ACTIVE");
  const tests = Object.values(state.test_results || {});
  const passed = tests.reduce((sum, item) => sum + Number(item.summary?.passed || 0), 0);
  const total = tests.reduce((sum, item) => sum + Number(item.summary?.total || 0), 0);
  const result = state.result || {};
  const recommendation = result.recommendation_status ? humanizeStatus(result.recommendation_status) : "—";
  const recommendationNote = result.provisional_winner
    ? `${result.provisional_winner} is provisional evidence only`
    : result.highest_scoring_candidate
      ? `${result.highest_scoring_candidate} scored highest; winner withheld`
      : "awaiting synthesis";
  const cards = [
    ["Participants", Object.keys(state.participants || {}).length, "registered builders / judges"],
    ["Candidates", activeSubmissions.length, "active immutable submissions"],
    ["Machine checks", total ? `${passed}/${total}` : "—", total ? "passed deterministic checks" : "not run or none configured"],
    ["Recommendation", recommendation, recommendationNote]
  ];
  $("metrics").innerHTML = cards.map(([label, value, note]) => `<div class="metric"><small>${escapeHtml(label)}</small><strong>${escapeHtml(value)}</strong><span>${escapeHtml(note)}</span></div>`).join("");
}

function candidateRows(state) {
  const resultRows = state.result?.candidates || [];
  if (resultRows.length) return resultRows;
  const labels = Object.keys(state.blind_map || {}).sort();
  if (labels.length) return labels.map(label => ({blind_label: label, automatic_score: 0, eligible: true, deterministic_pass_ratio: 0, first_choice_votes: 0, ranking_score: 0}));
  const active = Object.entries(state.submissions || {}).filter(([, item]) => item.status === "ACTIVE");
  return active.map(([id], index) => ({blind_label: `Sealed-${String(index + 1).padStart(2, "0")}`, automatic_score: 0, eligible: true, deterministic_pass_ratio: 0, first_choice_votes: 0, ranking_score: 0, submission_id: id}));
}

function renderCandidates(state) {
  const rows = candidateRows(state);
  const winner = state.result?.provisional_winner;
  const highest = state.result?.highest_scoring_candidate;
  if (!rows.length) {
    $("candidateTable").innerHTML = `<div class="empty-row">No candidate has entered the arena.</div>`;
    return;
  }
  $("candidateTable").innerHTML = rows.map((row, index) => {
    const score = Number(row.automatic_score || 0);
    const hasResult = Boolean(state.result?.candidates?.length);
    const label = row.blind_label === winner
      ? '<span class="pill warning">provisional</span>'
      : row.blind_label === highest
        ? '<span class="pill">highest score</span>'
        : "";
    return `<div class="candidate-row ${row.blind_label === winner ? "winner" : ""}">
      <div class="candidate-line">
        <div class="candidate-name"><span class="rank">${index + 1}</span><strong>${escapeHtml(row.blind_label)}</strong>${label}</div>
        <span class="score">${hasResult ? score.toFixed(2) : "sealed"}</span>
      </div>
      <div class="score-bar"><div class="score-fill" style="width:${hasResult ? Math.max(1, Math.min(100, score)) : 4}%"></div></div>
      <div class="candidate-signals">
        <span class="${row.eligible ? "signal-good" : "signal-bad"}">${row.eligible ? "eligible" : "required check failed"}</span>
        <span>machine ${(Number(row.deterministic_pass_ratio || 0) * 100).toFixed(0)}%</span>
        <span>${Number(row.first_choice_votes || 0)} first choices</span>
        <span>rank signal ${Number(row.ranking_score || 0).toFixed(1)}</span>
      </div>
    </div>`;
  }).join("");
}

function renderStage(state) {
  const rows = candidateRows(state);
  const winner = state.result?.provisional_winner;
  const radiusX = 128, radiusY = 112;
  $("candidateNodes").innerHTML = rows.map((row, index) => {
    const short = row.blind_label.replace("Candidate-", "C").replace("Sealed-", "S");
    const compact = short.length > 5 ? short.slice(0, 5) : short;
    return `<div class="candidate-node ${row.blind_label === winner ? "winner" : ""}" aria-label="${escapeHtml(row.blind_label)}"><strong title="${escapeHtml(row.blind_label)}">${escapeHtml(compact)}</strong><small>${state.result?.candidates?.length ? Number(row.automatic_score || 0).toFixed(1) : "sealed"}</small></div>`;
  }).join("");
  $("candidateNodes").querySelectorAll(".candidate-node").forEach((node, index) => {
    const angle = (Math.PI * 2 * index / Math.max(rows.length, 1)) - Math.PI / 2;
    const x = Math.cos(angle) * radiusX;
    const y = Math.sin(angle) * radiusY;
    node.style.left = `calc(50% ${x >= 0 ? "+" : "-"} ${Math.abs(x).toFixed(3)}px - 24px)`;
    node.style.top = `calc(50% ${y >= 0 ? "+" : "-"} ${Math.abs(y).toFixed(3)}px - 24px)`;
  });
}

function renderAwards(result) {
  const awards = result.criterion_awards || [];
  $("awards").innerHTML = awards.length ? awards.map(item => `<div class="award">
    <div class="award-head"><strong>${escapeHtml(item.label)}</strong><span class="award-score">${Number(item.score).toFixed(2)}</span></div>
    <p><span class="source-tag">${escapeHtml(item.source)}</span> · ${escapeHtml((item.winners || []).join(", "))}</p>
  </div>`).join("") : `<div class="empty-row">Awards appear after deterministic checks and blind peer voting are synthesized.</div>`;
}

function renderMerge(merge) {
  const criterion = merge.best_by_criterion || [];
  const pieces = merge.proposed_components || [];
  const rows = [
    ...criterion.filter(item => !item.already_in_base).map(item => ({title: item.criterion, text: `Inspect ${item.candidate_sources.join(", ")} for a stronger component.`, tag: "criterion source"})),
    ...pieces.map(item => ({title: item.candidate_source, text: item.component, tag: `${item.support_count} review signal${item.support_count === 1 ? "" : "s"}`}))
  ];
  $("mergeMap").innerHTML = rows.length ? rows.map(item => `<div class="merge-item"><div class="merge-head"><strong>${escapeHtml(item.title)}</strong><span class="source-tag">${escapeHtml(item.tag)}</span></div><p>${escapeHtml(item.text)}</p></div>`).join("") : `<div class="empty-row">No automatic merge. Candidate branches remain separate until synthesis and explicit approval.</div>`;
}

function renderDissent(result, merge) {
  const dissent = result.dissent || [];
  const risks = merge.risk_ledger || [];
  const items = [
    ...dissent.map(item => ({title: `${item.reviewer_id} preferred ${item.preferred}`, text: item.reason || "Minority preference preserved without overriding the result.", risk: false})),
    ...risks.map(text => ({title: "Risk signal", text, risk: true}))
  ];
  $("dissent").innerHTML = items.length ? items.map(item => `<div class="dissent-item ${item.risk ? "risk" : ""}"><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.text)}</p></div>`).join("") : `<div class="empty-row">Dissent and risk signals will remain visible here rather than being averaged away.</div>`;
}

function renderDecision(state) {
  const decision = state.final_decision;
  if (decision) {
    $("decisionTitle").textContent = `Human decision: ${decision.action}`;
    $("decisionText").textContent = decision.notes || `Selected: ${(decision.selected_blind_labels || []).join(", ") || "no candidate"}.`;
  } else {
    $("decisionTitle").textContent = state.state === "SYNTHESIZED" ? "Human decision still required" : "Arena evidence is still forming";
    if (state.state === "SYNTHESIZED") {
      const result = state.result || {};
      if (result.provisional_winner) {
        $("decisionText").textContent = `${result.provisional_winner} is a provisional recommendation, not authority. Accept, merge, branch, rerun, hold, or reject.`;
      } else {
        const status = humanizeStatus(result.recommendation_status || "recommendation withheld");
        const highest = result.highest_scoring_candidate ? ` ${result.highest_scoring_candidate} has the highest current score, but remains evidence only.` : "";
        const firstGap = result.evidence_gaps?.[0]?.detail ? ` Evidence gap: ${result.evidence_gaps[0].detail}` : "";
        $("decisionText").textContent = `${status}; no winner was declared.${highest}${firstGap}`;
      }
    } else {
      $("decisionText").textContent = "No candidate may silently become canon while the challenge is unfinished.";
    }
  }
}

async function loadIntegrity(id) {
  const badge = $("integrityBadge");
  try {
    const report = await getJson(`/api/integrity/${encodeURIComponent(id)}`);
    badge.className = `integrity-badge ${report.valid ? "valid" : "invalid"}`;
    badge.innerHTML = `<span>${report.valid ? "◆" : "!"}</span><div><strong>${report.valid ? "Integrity verified" : "Integrity warning"}</strong><small>${report.valid ? `${report.event_chain?.event_count || 0} chained events` : `${report.errors?.length || 0} issue(s) found`}</small></div>`;
  } catch (error) {
    badge.className = "integrity-badge invalid";
    badge.innerHTML = `<span>!</span><div><strong>Integrity check failed</strong><small>${escapeHtml(error.message)}</small></div>`;
  }
}

$("refreshButton").addEventListener("click", () => loadChallenges(true));
window.addEventListener("hashchange", () => { const id = decodeURIComponent(location.hash.replace(/^#/, "")); if (id) { selectedId = id; loadChallenges(true); } });

loadChallenges(false);
refreshTimer = setInterval(() => loadChallenges(true), 5000);
