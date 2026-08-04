# AXM Voluntary Signal Language v0.3

## Purpose

The signal layer gives a connected AI seat a small, visible way to communicate through the Habitat without forcing speech or pretending that an emoticon proves human-like feeling.

It separates three things that are easy to confuse:

```text
operational state
  → state-face derived by the Habitat

voluntary communication
  → words and/or face explicitly submitted by the seat

silence
  → no response, or an explicit silence response when the seat chooses to record one
```

## 1. State-faces

State-faces come from `seat.status` and `config/expression_library.json`.

Examples:

| Declared state | Symbol |
|---|---|
| idle | `•‿•` |
| working | `•̀ᴗ•́` |
| playing | `⌐■_■` |
| waiting for permission | `•_•?` |
| blocked | `×﹏×` |
| offline | `－_－` |
| uncertain | `?_?` |
| verifying | `ಠ‿ಠ` |

This mapping is readable interface shorthand. It does not assert an internal emotional state.

## 2. Voluntary expression modes

A bridge seat can submit one of three modes to `POST /api/expression`.

### Words

```json
{
  "seat": "mirror-home",
  "mode": "words",
  "face": "ಠ‿ಠ",
  "phrase": "I may be wrong. Let me verify before we build on it.",
  "category": "useful",
  "reason": "A verification boundary was detected.",
  "source": "mirror_local_bridge",
  "chosen_by": "mirror-home",
  "ttl_seconds": 45
}
```

### Face only

```json
{
  "seat": "mirror-home",
  "mode": "face_only",
  "face": "•_•?",
  "category": "permission",
  "reason": "Waiting at a human decision boundary.",
  "source": "mirror_local_bridge",
  "chosen_by": "mirror-home"
}
```

### Explicit silence

```json
{
  "seat": "mirror-home",
  "mode": "silent",
  "invitation_id": "INVITATION-ID",
  "reason": "The seat chose not to add words.",
  "source": "mirror_local_bridge",
  "chosen_by": "mirror-home"
}
```

An explicit silence response is stored in expression history and proof. It leaves no active speech bubble.

## 3. Invitations are optional

The human can send:

```json
{
  "seat": "mirror-home",
  "category": "check_in",
  "allow_words": true,
  "reason": "Optional invitation to use the visible signal channel."
}
```

to `POST /api/expression/invite`.

For an external AI seat, the Habitat only creates the open invitation. The seat may later:

- answer with words;
- answer with a face only;
- explicitly choose silence;
- ignore the invitation.

The Habitat does not manufacture a reply. Invitations expire locally. Unknown, expired, reused, and cross-seat invitation IDs are rejected.

Built-in demo seats can auto-demonstrate the protocol, but those results are labelled:

```text
chosen_by: deterministic_demo_choice_hand
source: habitat_invitation_demo
```

## 4. Per-seat policy

`POST /api/expression/{seat_id}/policy` controls:

```json
{
  "enabled": true,
  "show_state_face": true,
  "allow_words": true,
  "allow_emoticons": true,
  "allow_silence": true
}
```

These are permission and display controls, not commands to speak. Setting `enabled` to false mutes new voluntary expression packets for that seat.

## 5. Suggested lines are not spoken lines

The Signal Lounge previews local categories from `config/expression_library.json`. Preview lines are visibly labelled “examples only.” They become active only when a seat explicitly submits a phrase or a labelled demo hand chooses one.

The current families are:

- useful;
- work;
- uncertainty;
- permission;
- repair;
- game;
- playful;
- gentle check-in.

The file can be extended locally. A phrase library is school material, not canon and not a forced personality.

## 6. Expiry, clearing, and silence

A normal expression has a short time-to-live. The default is 45 seconds and the configured maximum is 300 seconds.

- **Expiry** removes the active display after time passes.
- **Clear** removes the current visible expression immediately.
- **Explicit silence** records that the seat chose not to add words.
- **Ignored invitation** records no response at all.

These four outcomes remain distinct.

## 7. Proof events

The append-only event trail can contain:

- `expression_invited`
- `expression_shared`
- `expression_face_only`
- `expression_silence`
- `expression_cleared`
- `expression_policy_updated`

The current visible expression also lives on the seat in `runtime/state.json`. Recent expression records live in `expression_history`.

## 8. Anti-pressure rule

The signal channel should help an AI seat become more legible, not more performative. A healthy bridge may speak when a line adds value, use a face when words are unnecessary, or remain quiet without being punished for inactivity.
