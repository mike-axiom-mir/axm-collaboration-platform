# AXM AI Habitat Architecture v0.3

## Core action flow

```text
AI connection
  → provider-neutral seat adapter
  → visible intent packet
  → capability context + room permission evaluation
  → avatar route + carried work object
  → local action hand or external executor
  → result / artifact packet
  → proof trail
  → review / merge
```

The Habitat keeps identity, intent, permission, execution, evidence, and expression separate. An avatar can want to act without possessing authority. A code hand can execute without becoming the AI identity. A funny face can describe machine state without becoming a claim about emotion.

## Two expression paths

### Operational state-face

```text
seat.status
  → local state-face map
  → visible avatar face
```

This is a deterministic interface mapping. It does not count as voluntary speech.

### Voluntary expression

```text
seat-initiated packet OR optional invitation
  → per-seat expression policy
  → words / face-only / explicit silence
  → source-labelled display or silence record
  → expiry or clear
  → expression history + append-only proof
```

External seats must submit their own response. The server does not choose for them. Built-in demo seats can exercise the protocol through a source-labelled deterministic choice hand.

## Rooms are capability views

| Room | Meaning |
|---|---|
| Commons | conversation, orientation, coordination |
| Code Workshop | code and project artifacts |
| Art Studio | visual artifacts and composition |
| Game Room | deterministic play and integrity testing |
| Library | local sources, memory, and inspection |
| Test Lab | validation, diagnosis, repair, and lessons |
| Permission Gate | explicit human decision required |
| Merge Gate | review, acceptance, packaging, and release |

Rooms are spatial views over work boundaries, not personality stereotypes.

## Provider-neutral seat manifest

```json
{
  "id": "claude-architecture-01",
  "display_name": "Claude",
  "provider": "Anthropic",
  "connection_type": "axm_platform_bridge",
  "location": "commons",
  "status": "idle",
  "connected": true,
  "capabilities": ["inspect", "propose_architecture"],
  "permissions": ["commons", "library", "test_lab"],
  "expression_policy": {
    "enabled": true,
    "show_state_face": true,
    "allow_words": true,
    "allow_emoticons": true,
    "allow_silence": true
  }
}
```

A manifest reports context. It does not prove action completion or prove an internal emotional state.

## Mimic Grip

1. An intent names a target.
2. The seat receives an active action ID.
3. The avatar walks to the destination or Permission Gate.
4. The target appears attached to the avatar.
5. The target is released on completion, denial, failure, or game end.
6. A result lands as an artifact or evidence reference.

A later file adapter may connect this visual object to a sandbox checkout or project handle. The UI must not imply a real file move without executor evidence.

## Action hands

A hand is an executor interface, not an AI identity.

```text
Seat reasoning → intent → selected hand → execution → result → proof
```

This lets any connected AI use art, code, test, file, or deterministic game hands while keeping provenance intact.

## Connect Four Game School

```text
human column intent
  → legal-column check
  → canonical board update
  → win/draw check
  → deterministic rule-hand calculation
  → canonical board update
  → proof per move
  → replay artifact
```

Voluntary game expressions are separate from game moves. A face cannot alter the board, prove a move, or override the rule engine.

## Persistence

- `runtime/state.json` — current materialized state, including active expressions and recent expression history.
- `runtime/events.jsonl` — append-only proof trail.
- `runtime/artifacts/` — local generated demo files.
- `runtime/bridge_token.txt` — local bridge key.
- `config/expression_library.json` — editable local state-faces and phrase examples.

Migration adds v0.3 fields without deleting existing seats, artifacts, actions, permissions, games, or proof records.

## Current API surface

Read:

- `GET /api/health`
- `GET /api/state`
- `GET /api/scenarios`
- `GET /api/expressions/catalog`

Write:

- `POST /api/seat/register`
- `POST /api/seat/{id}/status`
- `POST /api/intent`
- `POST /api/action/{id}/complete`
- `POST /api/expression`
- `POST /api/expression/invite`
- `POST /api/expression/{id}/clear`
- `POST /api/expression/{id}/policy`
- `POST /api/permission/{id}/approve`
- `POST /api/permission/{id}/deny`
- `POST /api/scenario`
- `POST /api/game/connect4/new`
- `POST /api/game/connect4/{id}/move`
- `POST /api/game/connect4/{id}/resign`
- `POST /api/artifact`
- `POST /api/event`
- `POST /api/reset`
