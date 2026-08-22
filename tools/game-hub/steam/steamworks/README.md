# SteamPipe example boundary

Status: **TEST** · placeholders only · no upload performed

The VDF files in this directory are examples. Do not run them in-place: their
relative `..\\candidate` content root is intentionally meant for an external
staging layout, not the Workshop repository.

After Steamworks assigns non-secret App and Depot IDs:

1. Build and verify a depot candidate with
   `build-steam-depot-candidate.js --output <external>\\candidate`.
2. Create `<external>\\steamworks` and copy both example VDF files there.
3. Replace only the App/Depot ID placeholders and make the app-build file point
   to the copied depot-build filename.
4. Inspect `candidate\\AXM_STEAM_DEPOT_MANIFEST.json`, confirm the selected
   content hash, and obtain human upload approval.
5. Run SteamCMD preview/upload from the external staging folder using private
   credentials outside the repository. Keep `setlive` empty until a separately
   approved branch decision.

Never copy Steam Guard codes, passwords, tax/bank data, `steam_appid.txt`, logs,
or credentials into the candidate or this repository. A successful local
candidate does not prove a Steam-client install, Valve review, or release.
