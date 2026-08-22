# AXM Specialist Library

The Specialist Library turns the professional role contracts already maintained by Discovery into reusable, versioned masks and exposes explicitly registered bounded Workshop bodies through the same discovery and checkout surface.

A mask is a temporary method overlay. It is not an identity, personality, permission grant, proof of expertise, independent reviewer, or durable memory update.

## Shared routes

- `GET /api/specialists` — catalog, active/recent checkouts, proposals and truth boundaries.
- `POST /api/specialists/checkout` — header `x-axm-specialist: identity-action`.
- `POST /api/specialists/return` — header `x-axm-specialist: identity-action`.
- `POST /api/specialists/revoke` — header `x-axm-specialist: local-supervisor`.
- `POST /api/specialists/propose` — header `x-axm-specialist: mask-proposal`.

Checkout returns an `axm.specialist-work-packet/v2` containing the frozen mask version, actor attribution, bounded task, expiry, truth boundaries and one complete `axm.specialist-package/v1`.

Each package is loadable without hidden prompt knowledge. It contains eight virtual files:

1. `manifest.json` — identity-neutral entrypoint, dependencies and truth boundaries.
2. `mask.json` — the frozen Discovery role contract and runtime profile.
3. `PERSPECTIVE.md` — mission, focus questions and jurisdiction.
4. `METHOD.json` — Orient, Plan, Work, Challenge and Return phases with gates.
5. `TOOLS.json` — abstract capability requests expressed through `axm.action/v1`; never authority.
6. `CAPABILITY-BRIDGES.json` — model-specific fallback skills selected only for declared missing capabilities.
7. `OUTPUT.schema.json` — the common specialist result envelope plus role-specific artifact fields.
8. `BOUNDARIES.md` — abstention, overreach, veto and independence rules.

Return requires a human-readable summary and evidence reference. Machine collaborators should also return `axm.specialist-result/v2`, which is checked against the frozen specialist ID, version, artifact type and required artifact fields. Optional learning is stored as `CANDIDATE` only.

## Capability bridges

Capability bridges provide equal access without pretending every model has the same native interface:

- **JSON Visual Composer** teaches a text model to emit reviewed `axm.drawpacket/v1` instructions for Studio's real layered renderer.
- **Desktop Eyes · Screen Scout** lets a deliberately shared screen be observed by a vision-capable scout and passed as attributed text to a chosen model without native eyes. Mirror receives only an observation candidate in its private perception inbox; it does not enter training, wisdom, truth or permissions.
- **Tool Action Translator** lets text-only models propose normal `axm.action/v1` tool calls and wait for approval/receipts.
- **Bounded Context Index Reader** lets small-context models request traceable file slices without implying unread coverage.
- **Structured Output Repair** preserves raw output and permits one schema-only repair pass; it cannot invent missing evidence.

These are compensating skills, not safety bypasses. Screen capture stays visible, finite, consent-based and observation-only. The current scout is Claude, and scout/recipient attribution stays separate. Tool bridges cannot create a capability or permission the host has not exposed.

## Recommendation router

`shared/specialists/specialist-router.js` ranks one to three useful methods from the task wording and previews capability bridges for the declared model profile. The score is explicitly `HEURISTIC_NON_EVIDENCE`.

The router has no state-writing or checkout function. Its result contract fixes these boundaries:

- `recommendationOnly: true`
- `automaticCheckout: false`
- `automaticSkillActivation: false`
- `automaticAgentStart: false`
- `requiresSeparateConfirmation: true`

In AI Team, **Inspect & prepare checkout** selects the mask and copies the task, lease and model profile into the checkout form. It does not press checkout. Manual confirmation is the default and remains a separate action even when a recommendation looks strong.

## Identity and permission rules

- Identity allow/block lists are checked when a connector or package supplies its binding record.
- A checkout grants no tools, files, network access or connector permissions.
- A specialist cannot replace or merge the holder's identity.
- One identity may hold at most three active masks.
- Leases last 5–480 minutes and expire from the host clock.
- Same-model or shared-context masks must not be called independent review.

## Source of truth

`tools/discovery-engine/review-packs.js` remains the professional role-contract source. The library derives those masks from the packs at runtime and appends only explicit Workshop-body registrations with their own source, tool, route, authority, and identity boundaries.

The first body registration is `workshop-body:mirror-code-clone`, shown as **Code Mirror**. It points to `tools/mirror-code-clone`, stays distinct from Original Mirror, and exposes candidate-only drafting and verification as a discoverable specialist contract. Its scheduled drafting lane remains off, and checkout does not grant candidate writes, test execution, installation, promotion, GitHub, publishing, or CANON authority.
