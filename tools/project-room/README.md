# AXM Project Room v0.2

Project Room is the single local-first project workspace. It merges related project capabilities into views over one portable record instead of creating separate modules.

## Views

- Overview — project brief, status, decisions, events, upcoming dates and health counts
- Board — ideas through Done, with evidence required before completion
- Goals — goals, milestones and linked-card progress
- Timeline — tasks, goals, milestones, decisions and events
- Knowledge — notes, briefs, wiki pages, specifications and structured forms
- Collaboration — human/AI/shared updates plus the activity history
- Review — dailies, review notes, evidence notes and verdicts
- Versions — named checkpoints, explicit restore and full JSON backup

## Storage and migration

- Browser key: `axm.project-room.v1`
- File schema: `axm.project-room/v1`
- Record version: `2`
- Existing v1 rooms migrate forward automatically; cards, goals and milestones remain.
- Imports require explicit replacement confirmation.
- Checkpoint restore requires explicit confirmation and preserves checkpoint history.

## Boundaries

- No cloud sync claim
- No sample project on first open
- No automatic task execution
- No silent owner assignment
- No card reaches Done without evidence
- No silent import or checkpoint restore

## Verify

```powershell
node tools/project-room/selftest.js
npm.cmd test
```
