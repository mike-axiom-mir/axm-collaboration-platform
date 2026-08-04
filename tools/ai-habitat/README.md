# AXM AI Habitat v0.3.0 — Voluntary Signal Language

A local-first, provider-neutral spatial desktop for visible AI collaboration.

The Habitat turns connected AI seats into visible residents without pretending that animation equals intelligence:

- an **AI seat** is a registered connection;
- a **room** is a real capability or review boundary;
- movement represents a declared intent or state transition;
- **Mimic Grip** makes the current task, file, art object, code object, or game board visibly travel with the seat;
- an **action hand** is an executor and remains separate from the AI identity using it;
- the **Permission Gate** separates desire from authority;
- artifacts carry source and provenance;
- the proof trail records what actually happened.

## What v0.3 adds

### Voluntary Signal Language

Every seat can now communicate through two deliberately separate channels:

1. **State-face** — a funny emoticon derived from the seat's declared machine state, such as working, playing, blocked, waiting for permission, or offline.
2. **Voluntary expression** — a seat-submitted line, a face without words, or an explicit choice to remain silent.

A state-face does not claim emotion. A suggested line is not treated as spoken. An invitation is not a command. External AI seats never auto-answer.

### Expression Lounge

The new Signal Lounge lets the human:

- inspect the selected seat's state-face;
- see a source-labelled voluntary line when one exists;
- invite a seat to use a useful, playful, work, repair, uncertainty, permission, game, or check-in signal family;
- permit or mute state-faces, chosen faces, words, and recorded silence per seat;
- clear a visible expression without falsely recording that the AI chose silence;
- inspect recent word, face-only, and silence records.

### Editable local quote school

`config/expression_library.json` contains **52 optional lines across 8 local signal families**, plus funny faces and state symbols. They are examples the connected seat may choose from or ignore. The library contains statements such as:

- “I may be wrong. Let me verify before we build on it.”
- “This step is done. The larger goal is not.”
- “I am available, but I will not invent work to look busy.”
- “The door is locked. Your key, your choice.”
- “I lost honestly. Rude board.”
- “I am here. No response is required.”

Editing the library changes available examples; it does not force any seat to use them.

### Provider-neutral bridge support

A real connected AI may now submit:

- words plus an optional face;
- a face-only signal;
- an explicit silence response to an open invitation.

Each signal records its seat, source, chooser label, reason, category, invitation link, creation time, expiry, and proof event. Unknown, expired, reused, or cross-seat invitations are rejected.

### Preserved v0.2 capabilities

- eight-room living AI map;
- visible routes, status rings, carried work objects, and intent bubbles;
- Creative Relay, Code Forge, and Permission Drill;
- playable server-authoritative Connect Four;
- deterministic, truth-labelled art, code, test, and game hands;
- permission gates, artifacts, rollback-minded state migration, and append-only evidence;
- local-only security defaults with no cloud assets, analytics, accounts, or provider lock-in.

## Run

**Windows:** extract the ZIP and double-click `start_windows.bat`.

**Linux/macOS:**

```bash
./start_linux_mac.sh
```

Then open `http://127.0.0.1:8765`.

Python 3 is the only runtime requirement. The server uses the Python standard library; the interface uses plain HTML, CSS, and JavaScript.

## Verify the build

```bash
python tests/verify_build.py
```

The verifier temporarily backs up the runtime, tests migration, local security, external bridge behavior, voluntary words, face-only responses, explicit silence, human-side mute, proof records, generated art, permission denial, a multi-room relay, Connect Four, and state integrity, then restores the original runtime.

## Current functional scope

- provider-neutral seat registry and bridge-key protected write API;
- visible presence, state-faces, locations, routes, and carried objects;
- optional source-labelled expression packets;
- open invitations that external seats may answer later or ignore;
- per-seat expression policy;
- local signal expiry and manual clear;
- expression history and append-only proof events;
- local artifacts for notes, art, code, tests, and game records;
- deterministic work relays and Connect Four;
- local-only default with no internet dependency.

## Important truth boundaries

### Face is not feeling

The emoticons are symbolic interface signals. They make machine state readable and entertaining; they do not prove human-like emotion, consciousness, desire, or inner experience.

### Example is not speech

Lines shown under “examples only” are never treated as spoken. Words enter the active speech bubble only after the connected seat explicitly submits them or, for the built-in demonstration seats, the clearly labelled deterministic demo choice hand accepts an invitation.

### Silence is not failure

A seat may ignore an invitation. That creates no invented response. An explicit silence packet can be preserved as a choice, while clearing an old bubble merely removes display state and does not claim silence.

### Demo hand is not live provider output

Selecting Mirror, Codex, or another built-in seat can visibly exercise the architecture. The deterministic art, code, game, relay, and expression demonstrations remain labelled as demo hands. A real AXM/provider bridge can replace them without rebuilding the Habitat.

## Bridge references

- `protocols/AXM_SEAT_BRIDGE_PROTOCOL.md`
- `protocols/seat.schema.json`
- `protocols/intent.schema.json`
- `protocols/expression.schema.json`
- `adapters/example_bridge_client.py`
- `adapters/drop_folder_adapter.py`
- `docs/VOLUNTARY_SIGNAL_LANGUAGE.md`

## Local safety defaults

- binds to `127.0.0.1` only;
- no external assets, analytics, accounts, or internet calls;
- external writers require the local bridge key;
- browser writes require the exact Habitat origin;
- sensitive actions remain permission-gated;
- a seat entering a room does not gain authority;
- demo executors write only under `runtime/artifacts/`;
- current state lives in `runtime/state.json`;
- append-only evidence lives in `runtime/events.jsonl`;
- expression suggestions remain local in `config/expression_library.json`;
- expression permissions are separate per seat.

## Folder map

```text
AXM_AI_HABITAT_v0_3_0_SIGNAL_LANGUAGE/
├── server.py
├── start_windows.bat
├── start_linux_mac.sh
├── web/                 living habitat and Signal Lounge
├── config/              settings, seat example, editable signal library
├── protocols/           seat, intent, and expression contracts
├── adapters/            HTTP and drop-folder bridge examples
├── docs/                architecture, safety, signals, game school, roadmap
├── tests/               runtime-preserving verification
└── runtime/             state, evidence, bridge key, generated artifacts
```

## Status

**WORKING PROTOTYPE / TEST-HOLD-REVIEW**

Ready for local intake, provider-bridge mapping, visual state experiments, voluntary communication tests, deterministic games, and artifact demonstrations. It does not yet provide privileged Windows control, arbitrary file grabbing, live provider authentication, LAN/phone exposure, voice, or production sandboxing.
