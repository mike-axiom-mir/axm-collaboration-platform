# AXM Modular Seed Foundry

The Modular Seed Foundry turns one direction into a portable family of small, exact growth seeds. The resulting file is meant to be downloaded and attached to an AI platform task. It tells that platform what to grow, how to keep the pieces modular, what evidence is still missing, and how to return the candidates for AXM intake.

## What a seed is

A seed is an untested plan with no runtime, install, promotion, publication or network authority. Every generated module begins as `SEED`, `UNTESTED`, and `NONE` authority. A platform can grow source candidates from it, but those candidates remain outside the Workshop until Mike and an independent machine steward review the intake.

The six reusable lanes are:

- **Nucleus** — domain model, vocabulary and invariants.
- **Interface Hand** — explicit human/machine direction.
- **Evidence Sensor** — claims, disconfirming tests and receipts.
- **Boundary Gate** — consent, authority, rollback and refusal.
- **Exchange Bridge** — portable artifacts and intake handoffs.
- **Evolution Memory** — lineage, versions and retained alternatives.

## Use

1. Open the module from the Hub.
2. Describe the subject, goal and constraints.
3. Choose the number of starting seeds and the maximum candidates allowed per seed in one platform run.
4. Generate the pack.
5. Download **Platform brief** and attach that single Markdown file to the platform task. It contains the complete machine-readable JSON packet.
6. Bring the returned ZIP or folder to AXM's Neutral Modular Intake Gate.

The suggested number of runs is planning context only. The Foundry explicitly requires one user-initiated platform run at a time and never starts a platform task itself.

## Verification

```powershell
node tools/modular-seed-foundry/selftest.js
node tools/modular-seed-foundry/discovery-seam-review.js
```

The browser implementation uses the local Web Crypto API for the semantic SHA-256 digest. The digest excludes only the creation timestamp and the digest field itself, so the same seed intent has the same semantic identity across sessions.
