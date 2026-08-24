# Code Specialist Capability Builder v1 (TEST)

This v2.6 rung gives registered Code Capability Fabric specialists real but
bounded construction routes. The initial build-profile catalog contains:

- `organ.code.data-schema` → `closed-json-schema-validator@0.1.0`; and
- `organ.code.markup-structure` → `static-accessible-html-page@0.1.0`; and
- `organ.code.application-logic` + Python → `bounded-python-record-transform@0.1.0`; and
- `organ.code.application-logic` + JavaScript → `pure-json-transform@1.1.0`; and
- `organ.code.application-logic` + JavaScript → `bounded-record-query@0.1.0`; and
- `organ.code.application-logic` + JavaScript → `bounded-portable-fsm-definition@0.1.0`; and
- `organ.code.application-logic` + JavaScript → `closed-object-contract-adapter@0.2.0`; and
- `organ.code.style-presentation` + CSS → `bounded-css-token-stylesheet@0.1.0`; and
- `organ.code.markup-structure` + SVG → `svg-status-badge@1.1.0`.

Each route emits one byte-bound detached candidate. Selection is exact across
the language, specialist Organ, build profile, Capability Fabric recipe, and
native builder digests and the language-native source/selftest paths. One
specialist cannot borrow or impersonate another profile's recipe.
Multiple profiles may share the same specialist and language only through distinct
exact modes, recipes, builders, artifacts, and profile digests.

The builder requires all of the following exact inputs:

- a v1.6 specialist-to-Organ-intent request and deterministically rebuilt plan;
- one exact admitted data-schema, HTML markup-structure, Python
  application-logic, JavaScript application-logic, record-query, or portable-FSM-definition, CSS style-presentation, or SVG markup-structure artifact
  lane;
- one exact registered build profile whose language matches that artifact;
- a human-reviewed Capability Fabric request whose source binds the v1.6 plan;
- tier-1 consent bound to the intent, build request, catalog, and recipe digests;
- a positive consent window no longer than 24 hours;
- four technical root passes and a research-only/direct-reuse hold; and
- fixed candidate file, byte, build-pass, attempt, process, cost, memory, and
  duration declarations.

It reuses the canonical Capability Fabric builder registry. That trusted native
builder creates candidate source bytes twice in memory to prove deterministic
rebuild parity. JavaScript candidates emit `capability.js` and `selftest.js`;
the Python candidate emits `capability.py` and `selftest.py`. All remain inert
data: this rung never evaluates, imports, runs, materializes, writes, installs,
integrates, publishes, promotes, or canonizes them.

The HTML-page hand accepts bounded structured text and emits semantic document
structure with a language declaration, viewport declaration, skip link,
heading hierarchy, escaped text, and no CSS, script, inline event handler, or
external resource. That is static source evidence only; it is not a visual or
accessibility-usability claim.

The CSS hand emits only a fixed `:root` custom-property sheet. Callers may
override declared tokens through five closed value types; they cannot inject a
selector, property, at-rule, import, URL, comment, escape, or raw declaration.
That is source and contract evidence only. Cascade behavior, compatibility,
motion timing, accessibility effect, and visual quality require separate live
browser evidence.

The SVG hand emits only one fixed text-and-rectangle status badge. Its runtime
input is a closed plain JSON record with optional bounded `label` and `value`
strings. Configuration is frozen, byte ceilings are explicit, text is
validated for XML and escaped without invoking input serialization hooks, and
raw SVG, paths, style, script, events, URLs, external
resources, and animation are not accepted. Static fixture parity is not a
browser, accessibility, or visual-quality claim.

The JavaScript hand consumes only a bounded own-data-property string record
and emits one declared string field. It rejects accessors without invoking
them, symbols, custom prototypes, unsafe field names, non-string values,
excessive keys, excessive string lengths, and byte-ceiling violations. Its
configuration is deeply frozen and it does not copy an arbitrary input value
or reference. This is one narrow Node-compatible transform contract, not
general JavaScript or browser behavior.

The closed-object adapter consumes one declared flat primitive object contract
and emits another through explicit map/default/drop rules. It refuses hidden
fields, symbols, accessors without invoking them, custom prototypes, unsupported
primitive values, property excess, and independently measured input/output byte
excess. Its successful result proves target shape only. Hostile Proxy behavior,
domain semantics, and end-to-end fitness remain unproven.

The record-query hand consumes one exact closed primitive record collection and
an explicit bounded query. It supports typed `AND` predicates, stable multi-key
ordering with original-index ties, unique projection fields, an exact result
limit, and bounded count summaries. It rejects sparse/decorated arrays,
accessors, symbols, custom prototypes, unknown or duplicate fields, unsafe
integers, unsupported operators, and byte ceilings. Hostile Proxy traps and
domain-semantic fitness remain unproven.

The portable-FSM-definition hand emits one frozen, handler-free
`axm.game-fsm/v1` definition with bounded state, transition, and canonical-byte
counts. Every target must exist and every state must be reachable. It composes
with the existing `shared/game-fsm` runtime and does not copy that runtime,
accept guards/actions/callbacks, or claim gameplay quality.

The result distinguishes what is proven from what remains unknown. Exact
specialist lineage, recipe lineage, candidate structure, byte lineage, portable
paths, and resource ceilings can pass. Runtime behavior remains `UNKNOWN`; the
generated selftest remains `EMITTED_NOT_RUN`; human identity authentication and
nonce replay prevention are not claimed.

Only the closed JSON Schema validator, static HTML-page renderer, one typed CSS
token-stylesheet renderer, one strict SVG status-badge renderer, and one
string-only transform in each of Python and JavaScript, plus the strict
JavaScript closed-object adapter, bounded record-query hand, and portable FSM
definition hand are registered. The CSS lane does not claim
arbitrary CSS generation or visual correctness; the SVG lane does not claim
general SVG, vector-scene creation, or browser correctness; the Python lane does
not claim general Python generation or runtime correctness. Broader CSS, SVG,
or Python, browser behavior, persistence, security, tests, build systems, shaders,
hardware simulation, performance, documentation, and audio still require
their own source-reviewed recipes, profiles, and evidence. A reviewed profile
can add a lane without rewriting this builder. Unsupported or drifted profiles
produce typed holds instead of borrowing a nearby recipe.

The Capability Fabric catalog and schemas now bind the HTML builder's exact
implementation digest alongside the prior validator HAND and bounded-review
SKILL. Shared use still requires Mike's merge decision.

Run the focused suite:

```powershell
node shared/code-capability-fabric/selftest-code-specialist-capability-builder-v1.js
```
