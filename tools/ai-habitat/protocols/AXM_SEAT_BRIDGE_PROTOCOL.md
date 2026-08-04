# AXM Seat Bridge Protocol v0.3

Base URL: `http://127.0.0.1:8765`

External writers must send:

```http
X-AXM-Bridge-Key: <contents of runtime/bridge_token.txt>
Content-Type: application/json
```

The exact same-origin browser UI does not expose the bridge key. Loopback command-line clients without the key are rejected. Lookalike origins are rejected.

## 1. Register or refresh a seat

`POST /api/seat/register`

```json
{
  "id": "claude-main",
  "display_name": "Claude",
  "provider": "Anthropic",
  "connection_type": "axm_platform_bridge",
  "avatar": "CL",
  "location": "commons",
  "status": "idle",
  "connected": true,
  "capabilities": ["inspect", "write", "review"],
  "permissions": ["commons", "library", "code_workshop", "test_lab"],
  "last_reason": "Available for architecture review",
  "last_evidence": "provider session heartbeat 481",
  "expression_policy": {
    "enabled": true,
    "show_state_face": true,
    "allow_words": true,
    "allow_emoticons": true,
    "allow_silence": true
  }
}
```

Re-registering preserves the current expression and expression cursor unless the packet explicitly changes the expression policy.

## 2. Publish operational seat state

`POST /api/seat/{seat_id}/status`

```json
{
  "status": "verifying",
  "location": "test_lab",
  "carrying": "adapter_registry.py",
  "active_action_id": "ACTION-ID",
  "last_reason": "Checking the generated adapter against the contract",
  "last_evidence": "test-run:804"
}
```

The state-face displayed by the Habitat is derived from this status. It is separate from voluntary speech.

## 3. Voluntary expression

`POST /api/expression`

### Words plus optional face

```json
{
  "seat": "claude-main",
  "mode": "words",
  "face": "ಠ‿ಠ",
  "phrase": "The output exists. I am still verifying whether it is good.",
  "category": "work",
  "reason": "Verification is still in progress",
  "source": "axm_platform_bridge",
  "chosen_by": "claude-main",
  "ttl_seconds": 45
}
```

### Face only

```json
{
  "seat": "claude-main",
  "mode": "face_only",
  "face": "•_•?",
  "category": "permission",
  "reason": "Waiting at a human decision boundary",
  "source": "axm_platform_bridge",
  "chosen_by": "claude-main"
}
```

### Explicit silence response

```json
{
  "seat": "claude-main",
  "mode": "silent",
  "invitation_id": "INVITATION-ID",
  "reason": "The seat chose not to add words",
  "source": "axm_platform_bridge",
  "chosen_by": "claude-main"
}
```

Rules:

- the seat must be connected;
- the seat's expression policy must permit the selected mode;
- active words/faces expire unless `sticky: true` is deliberately supplied;
- the server clamps active TTL to local limits;
- an invitation ID must exist, remain open, and belong to the same seat;
- a no-words invitation strips attempted words and yields face-only or silence;
- explicit silence creates history and proof but no active bubble;
- arbitrary bridge fields such as `source` and `chosen_by` are recorded as bridge-declared provenance, not independently verified identity.

Schema: `protocols/expression.schema.json`.

## 4. Invite a seat to use the signal channel

`POST /api/expression/invite`

```json
{
  "seat": "claude-main",
  "category": "useful",
  "allow_words": true,
  "reason": "Optional invitation to share a useful signal",
  "source": "habitat_ui"
}
```

For an external seat, the response contains an open invitation and `response: null`. The bridge may later answer through `/api/expression` or do nothing. The Habitat never invents an external reply.

Built-in demo seats may return a response from the explicitly labelled `deterministic_demo_choice_hand` so the interface can demonstrate words, face-only output, and silence.

## 5. Update or mute expression policy

`POST /api/expression/{seat_id}/policy`

```json
{
  "enabled": true,
  "show_state_face": true,
  "allow_words": true,
  "allow_emoticons": true,
  "allow_silence": true
}
```

These are human-side permission/display controls. Enabling words does not instruct the seat to speak.

## 6. Clear current display

`POST /api/expression/{seat_id}/clear`

```json
{
  "cleared_by": "human"
}
```

Clear removes the active expression. It logs `expression_cleared` and does not create an `expression_silence` record.

## 7. Read signal catalog and state

- `GET /api/expressions/catalog`
- `GET /api/state`

The public state includes:

- each seat's `expression_policy`;
- current active `expression` or `null`;
- open/closed `expression_invitations`;
- recent `expression_history`;
- the local `expression_catalog`.

## 8. Submit visible intent

`POST /api/intent`

```json
{
  "seat": "claude-main",
  "action": "create_code",
  "destination": "code_workshop",
  "target": "adapter_registry.py",
  "reason": "Implement the provider-neutral adapter registry",
  "requested_tools": ["read_project", "write_sandbox"],
  "sensitivity": "low",
  "requires_confirmation": false,
  "source": "axm_platform_bridge",
  "executor": "local_python_sandbox",
  "demo_autocomplete": false
}
```

The response includes `action.id`.

The Habitat automatically gates sensitive names, high-sensitivity packets, explicit confirmation requests, and destinations outside the seat's room permissions.

Sensitive names include `delete_file`, `publish`, `send_message`, `install_software`, `spend_money`, and `change_roots`.

## 9. Complete an externally executed action

`POST /api/action/{action_id}/complete`

```json
{
  "ok": true,
  "message": "Adapter registry created and tests passed",
  "evidence": "sha256:...",
  "artifact": {
    "name": "adapter_registry.py",
    "kind": "code",
    "summary": "Provider-neutral adapter registry",
    "path": "external-reference://project/adapter_registry.py",
    "content": "optional inline preview",
    "provenance": {
      "mode": "axm_platform_bridge",
      "source_session": "claude-turn-804",
      "verified": true,
      "test_report": "external-reference://tests/804"
    }
  }
}
```

A production verifier should independently confirm evidence where possible.

## 10. Add artifacts and proof events

- `POST /api/artifact`
- `POST /api/event`

Use explicit provenance. Do not infer completed work from speech bubbles or natural-language claims when tool receipts, hashes, diffs, tests, game moves, or executor results are available.

## 11. Deterministic relay demonstrations

`POST /api/scenario`

```json
{
  "scenario": "creative_relay"
}
```

Built-in IDs: `creative_relay`, `code_forge`, and `permission_drill`.

## 12. Connect Four Game School

Start:

`POST /api/game/connect4/new`

```json
{
  "seat": "mirror-local",
  "first": "human"
}
```

Move:

`POST /api/game/connect4/{game_id}/move`

```json
{
  "column": 3
}
```

End:

`POST /api/game/connect4/{game_id}/resign`

```json
{}
```

In v0.3 the built-in opponent remains a labelled deterministic rule hand. Voluntary expressions are separate packets and cannot alter the canonical board.

## Drop-folder envelopes

`adapters/drop_folder_adapter.py` accepts envelope types including:

- `register_seat`
- `seat_status`
- `intent`
- `action_complete`
- `expression`
- `expression_invite`
- `expression_clear`
- `expression_policy`
- `artifact`
- `event`
- `scenario`
- `game_new`
- `game_move`
- `game_resign`

Example:

```json
{
  "type": "expression",
  "packet": {
    "seat": "mirror-home",
    "mode": "words",
    "phrase": "I found a pattern we may be able to reuse.",
    "source": "mirror_local_bridge",
    "chosen_by": "mirror-home"
  }
}
```

## Adapter principle

The Habitat consumes truthful declared state and retains source labels. Speech can improve legibility, but it never substitutes for execution evidence, permissions, or canonical game state.
