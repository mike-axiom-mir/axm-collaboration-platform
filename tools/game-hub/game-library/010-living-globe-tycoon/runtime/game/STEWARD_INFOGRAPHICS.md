# Shared Island Brief — v0.10 steward infographics

`EXPERIMENTAL GAME METRICS · NOT SCIENCE, FINANCE OR POLICY ADVICE`

The **Brief** button opens one causal report shared by the human screen and AI player seat. It is a read-only view: opening, closing or reading it cannot advance a quarter, resolve a dilemma, issue an edict, approve a proposal or move either player.

There is deliberately **no overall island score**. Ecology, people, public books, supply and the current mission remain five separate truths. Good treasury income cannot conceal poor water quality; strong ecology cannot conceal unemployment; mission success cannot repair either.

## Five cards

### Living island

- food-web health from the bounded habitat-and-guild rules;
- water quality, mean district biodiversity and habitat connectivity;
- introduced-species and crop-pest pressure, where lower is better;
- causes from current pollination, insect control, seed dispersal, shore recycling and the weakest habitat;
- existing levers: ecological buffers, connected habitat and explicit biosecurity choices.

### People & politics

- public approval and legitimacy as separate readings;
- the least-supported faction and its current request;
- unemployment and election distance;
- current average health/education evidence and any open dilemma;
- existing levers: reachable work, services, Palace dilemma choices and time-bounded edicts.

### Public books

- exact recorded public income, expenses, net and closing funds;
- the living-cost index, visitors and named sector contributions;
- industry, entertainment and commerce sales alongside—not inside—their public contribution;
- private product sales and business capital in an explicitly separate box;
- existing levers: named public accounts, typed shortages, viable labor/input/demand combinations.

### Supply & industry

- exact public water, food, energy and material stock/capacity bars;
- the 16-product price index and last-quarter typed shortages;
- active and idle firms, private business capital and trade-ready lots;
- a named product bottleneck selected from actual price/reference and stock evidence;
- existing levers: deposits, processor inputs, logistics, workforce and protected reserves.

Trade-ready means `READY_NOT_EXPORTED`. The screen invents no buyer, ship, contract or export revenue.

### Mission & co-op

- current progress and active-play seconds remaining, or the next-mission countdown;
- human and AI contribution bars when the mission began in co-op mode;
- AI connection, Two-Shores route status and Festival Laurel balance;
- the fixed solo/co-op mode and reward selected at mission start;
- ordinary walk/tool actions as the only progress path.

Festival Laurels remain separate from treasury, business capital and trade goods. They still have no spending action.

## Status bands

The colored bands are disclosed gameplay thresholds, not predictions:

| Reading | Steady | Watch | Needs care |
|---|---:|---:|---:|
| Food web | at least 65% | 50–64.99% | below 50% |
| Water quality | at least 70% | 50–69.99% | below 50% |
| Habitat connectivity | at least 65% | 45–64.99% | below 45% |
| Introduced pressure | at most 40% | 40.01–65% | above 65% |
| Approval / legitimacy | at least 60% | 45–59.99% | below 45% |
| Least-supported faction | at least 55% | 40–54.99% | below 40% |
| Unemployment | at most 7% | 7.01–15% | above 15% |
| Living-cost index | at most 105 | 105.01–115 | above 115 |
| Product price index | at most 110 | 110.01–135 | above 135 |
| Public reserve | at least 50% | 25–49.99% | below 25% |

Treasury net uses a simpler sign: positive is steady, negative needs care and zero is informational. Elections, missions, connected seats, visitors and Laurels are contextual rather than moral scores.

## Trends and persistence

`core/steward-metrics.js` captures at most one reading for each strategic revision. Capturing the same revision replaces that revision rather than inventing another point. It keeps the latest 24 revisions and migrates older v0.9 saves to a single current reading without fabricating earlier history.

Mission time changes the live mission card but does not create strategic trend points. Sparklines therefore mean **recorded strategic revisions**, not wall-clock time.

The v0.10 local save owns:

- browser key `AXM_LIVING_GLOBE_STEWARD_VNEXT_V10`;
- outer schema `axm.living-globe.local-save/v11`;
- metric history `axm.living-world.steward-metric-history/v0.1`.

The read-only API is:

```js
window.AXMLivingWorld.metrics.describe()
window.AXMLivingWorld.metrics.observe()
window.AXMLivingWorld.metrics.history()
```

`observe()` returns the same five-card report supplied to `window.AXMLivingWorld.aiPlayerSeat.observe().stewardMetrics`. No metric API exposes a mutate, force, advance or resolve method.

## Honest limits

- All thresholds and indices are compact fictional game rules.
- The report does not model real national accounts, public opinion, biodiversity surveys or policy outcomes.
- A cause line names evidence already used by the current rules; it is not a guarantee that one action will dominate every other effect.
- The UI has deterministic regression coverage, but v0.10 has not received a real-browser screenshot or human play-feel pass in this workspace.
