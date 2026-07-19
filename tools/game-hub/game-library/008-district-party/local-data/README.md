# Local Runtime Data

The host creates `group-saves/save-slot-1.json` through `save-slot-9.json` here when the in-game Party House computer saves a group.

- These files remain on this machine.
- They contain no account, password, controller token, player name, phone address or telemetry.
- Do not copy personal play saves into a public release ZIP unless the players deliberately want to share that progress.
- Corrupt or hand-edited files are rejected by the host integrity and schema checks instead of being partially applied.

The distributed package intentionally contains no pre-filled save slot.
