# AXM Technical Glasses

Technical Glasses is a read-only, AI-native description of the Workshop's current technical ground truth.

It compiles from current manifests, module contracts, source timestamps, live readiness, Body Pulse state and capability routes. It also consumes the shared structural-readiness observer in `shared/readiness/readiness-observer.js`, which is the same observer used by the Workshop Needs Observatory. It does not use chat memory or a README as technical authority.

## Machine routes

- `GET /api/workshop/technical-glasses`
- `GET /api/workshop/technical-glasses?focus=build%20a%20multiplayer%20game`
- `GET /api/workshop/technical-glasses.txt?focus=repair%20phone%20controllers`

The JSON and text routes recompile on every request. Every result includes a source fingerprint and compilation time.

## Without the Hub runtime

```powershell
node shared/technical-glasses/technical-glasses-cli.js --focus="your task"
node shared/technical-glasses/technical-glasses-cli.js --focus="your task" --json
node shared/technical-glasses/technical-glasses-cli.js --write
```

`--write` stores an atomic portability snapshot in `state/technical-glasses/latest.json`. That snapshot is evidence from its compilation time, not an automatically trusted current state.

## Boundaries

- Observation only.
- Missing evidence becomes `UNKNOWN`, never a guess.
- No automatic repair, action, permission change or canon promotion.
- A human-review candidate means the structural declaration, contract and current self-test evidence are ready for Mike to inspect. It is not approval, promotion, CANON status, runtime proof or a satisfied need.
- `STALE`, `INVALID` and `UNAVAILABLE` structural evidence stays visible and produces no review candidates.
- A structural scan does not replace runtime tests or human behavior checks.
- README files remain useful narrative context, but sit last in the technical authority order.
