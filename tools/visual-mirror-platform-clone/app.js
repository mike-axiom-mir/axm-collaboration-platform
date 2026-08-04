"use strict";

const byId = (id) => document.getElementById(id);
const compactHash = (value) => value ? `${value.slice(0, 14)}…${value.slice(-10)}` : "—";
const count = (value) => new Intl.NumberFormat().format(Number(value || 0));

async function loadProof() {
  const response = await fetch("./platform-proof.json", { cache: "no-store" });
  if (!response.ok) throw new Error(`Proof load failed: ${response.status}`);
  return response.json();
}

function render(proof) {
  const snapshot = proof.platform_snapshot;
  byId("status").textContent = proof.status === "PASS" ? "Clear evidence" : proof.status;
  byId("families").textContent = `${snapshot.capability_families_observed}/${snapshot.capability_families_total}`;
  byId("routes").textContent = count(snapshot.multiple_routes_preserved);
  byId("modules").textContent = count(snapshot.modules_seen);
  byId("writes").textContent = proof.authority.write_workshop ? "allowed" : "0";
  byId("weave-id").textContent = proof.binding.weave_id;
  byId("proposal-id").textContent = proof.binding.proposal_cycle_id;
  byId("weave-hash").textContent = compactHash(proof.binding.weave_sha256);
  byId("motion").textContent = proof.source_motion.classification.replaceAll("_", " ");
  byId("captured-at").textContent = `Captured ${new Date(proof.captured_at).toLocaleString()}`;

  const list = byId("truth-limits");
  list.replaceChildren(...proof.truth_limits.map((limit) => {
    const item = document.createElement("li");
    item.textContent = limit;
    return item;
  }));
}

byId("toggle-limits").addEventListener("click", (event) => {
  const list = byId("truth-limits");
  const hidden = list.hidden;
  list.hidden = !hidden;
  event.currentTarget.setAttribute("aria-expanded", String(hidden));
  event.currentTarget.textContent = hidden ? "Hide limits" : "Show limits";
});

loadProof().then(render).catch((error) => {
  byId("status").textContent = "Proof unavailable";
  byId("status").classList.remove("clear");
  byId("captured-at").textContent = error.message;
});
