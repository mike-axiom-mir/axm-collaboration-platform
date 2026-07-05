# AXM Research Backlog

Research status: scout notes only. Do not import code blindly.

The purpose of this file is to turn useful public patterns into small AXM-safe issues and branches.

## Rules for research

- Learn patterns, do not copy code by default.
- Check license before using code.
- Prefer small AXM-native modules.
- Keep local-first and beginner-friendly.
- Add one thing at a time.
- Label untested work honestly.

## Highest-value safe additions

### 1. Agent instructions and routing

Public pattern: repositories increasingly include instruction files for coding agents and AI helpers.

AXM action:

- `AGENTS.md`
- `AXM_AGENT_ROUTING.md`
- issue templates
- PR template

Why it matters:

This gives Claude, ChatGPT, Copilot, Codex-style tools, and human helpers the same safety rules before touching the repo.

Status: started.

### 2. AXM verifier workflow

Public pattern: GitHub Actions can run project checks automatically.

AXM action:

- `.github/workflows/axm-verify.yml`
- run `cd AXM_WORKSHOP && node verify.js`

Why it matters:

The repo should fail visibly when AXM's own verifier fails.

Status: proposed.

### 3. Local-first / offline-first sync research

Public patterns to study later:

- local-first software lists
- Automerge-style CRDTs
- Yjs-style collaborative state
- peer/local sync patterns

AXM action now:

- document the seam
- do not add sync engine yet

Why wait:

Sync can create data loss, conflict drift, and hidden complexity if added before backup/rollback is stable.

Suggested future branch:

`axm/future-local-first-sync-notes`

### 4. Visual / design tool modules

Public patterns to study later:

- Excalidraw-style sketch canvas
- tldraw-style shared canvas
- Mermaid-style diagram text to visual
- CodeMirror-style editor
- Litegraph-style node/flow board

AXM action now:

- create tool proposals only
- do not import heavy dependencies yet

Possible AXM tool modules:

```text
AXM_WORKSHOP/tools/diagram-viewer/
AXM_WORKSHOP/tools/text-editor/
AXM_WORKSHOP/tools/flow-board/
AXM_WORKSHOP/tools/visual-canvas/
```

Safe first version:

- one static HTML file
- one manifest
- local save/load only
- no cloud dependency

### 5. Self-hosted tool category scouting

Public pattern: self-hosted lists organize tools by category.

AXM action:

Create category notes for what AXM might need later:

- dashboards
- documents
- notes
- media tools
- monitoring
- file transfer
- backup/export
- local accounts
- classroom/club tools

Suggested future file:

`docs/SCOUTED_TOOL_PATTERNS.md`

### 6. Plugin architecture

Public pattern: plugin systems often use a manifest/loader structure.

AXM already has a simple version:

- tool folder
- manifest
- entry file
- registry

AXM action:

Keep it boring. Improve verifier checks before adding complexity.

Possible checks:

- manifest has required fields
- entry file exists
- tool id matches folder
- status label is valid
- no tool references missing spine files

## Immediate issue backlog

### Good first issues

1. Fix Studio verifier DOM order issue.
2. Improve bridge setup wording for beginners.
3. Add screenshots or text walkthrough for running `START_AXM.bat`.
4. Add `node verify.js` GitHub Action.
5. Create issue templates for bug, tool proposal, research scout.

### Medium issues

1. Flatten/confirm public folder structure if needed.
2. Improve workshop README for non-technical users.
3. Add a visible architecture map.
4. Add safer local setup checklist.
5. Add public contributor guide.

### Later / hold

1. Real local-first sync.
2. CRDT experiments.
3. Cloud bridge options.
4. Multi-user accounts.
5. Big dependency visual canvas.

## Research-to-issue rule

Every research note should become one of:

- no action
- docs issue
- test issue
- small module proposal
- future seam
- blocked until safety layer exists

Do not turn research into immediate code unless the value and risk are both clear.
