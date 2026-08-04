"use strict";

const state = { catalog: null, query: "", category: "ALL" };
const cards = document.querySelector("#cards");
const resultCount = document.querySelector("#result-count");
const filters = document.querySelector("#filters");
const template = document.querySelector("#card-template");

function effectLabel(row) {
  const effects = [];
  if (row.effects.filesystem) effects.push("filesystem surface");
  if (row.effects.process) effects.push("process surface");
  if (row.effects.network) effects.push("network surface");
  return effects.length ? effects.join(" · ") : "pure local calculation";
}

function render() {
  const query = state.query.trim().toLowerCase();
  const rows = state.catalog.components.filter(row => {
    if (state.category !== "ALL" && row.category !== state.category) return false;
    if (!query) return true;
    const text = [row.id, row.name, row.summary, row.category, ...row.tags, ...row.actions, ...row.exportedSymbols].join(" ").toLowerCase();
    return query.split(/\s+/).every(term => text.includes(term));
  });
  resultCount.textContent = `${rows.length} component${rows.length === 1 ? "" : "s"}`;
  cards.replaceChildren();
  for (const row of rows) {
    const node = template.content.cloneNode(true);
    node.querySelector(".category").textContent = row.category;
    node.querySelector(".risk").textContent = row.risk;
    node.querySelector("h3").textContent = row.name;
    node.querySelector(".summary").textContent = row.summary;
    node.querySelector(".symbols").textContent = row.exportedSymbols.join(" · ");
    const detail = node.querySelector(".detail-body");
    const lines = [
      ["ID", row.id],
      ["Accepts", row.accepts.join(", ") || "—"],
      ["Produces", row.produces.join(", ") || "—"],
      ["Effects", effectLabel(row)],
      ["Authority", "No automatic mutation or promotion"]
    ];
    for (const [label, value] of lines) {
      const paragraph = document.createElement("p");
      const strong = document.createElement("strong");
      strong.textContent = `${label}: `;
      paragraph.append(strong, document.createTextNode(value));
      detail.append(paragraph);
    }
    cards.append(node);
  }
}

function buildFilters() {
  const categories = ["ALL", ...new Set(state.catalog.components.map(row => row.category))];
  for (const category of categories) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = category;
    button.className = category === state.category ? "active" : "";
    button.addEventListener("click", () => {
      state.category = category;
      for (const item of filters.children) item.classList.toggle("active", item === button);
      render();
    });
    filters.append(button);
  }
}

fetch("catalog.json", { cache: "no-store" })
  .then(response => {
    if (!response.ok) throw new Error(`catalog HTTP ${response.status}`);
    return response.json();
  })
  .then(catalog => {
    state.catalog = catalog;
    document.querySelector("#component-count").textContent = catalog.summary.components;
    buildFilters();
    render();
  })
  .catch(error => {
    resultCount.textContent = "Catalog unavailable";
    cards.textContent = error.message;
  });

document.querySelector("#search").addEventListener("input", event => {
  state.query = event.target.value;
  if (state.catalog) render();
});
