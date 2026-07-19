AXM ACHIEVEMENT PACK
====================

This pack contains the achievement badge artwork created so far in this chat,
prepared for cleaner local Asset Vault intake.

What was done
-------------
- Renamed files into clearer asset-style names.
- Converted the checkerboard background into transparent PNG output.
- Resized every asset to a 512 x 512 master canvas.
- Fitted each badge inside a centered 420 x 420 safe artwork area.

Folder layout
-------------
/achievements  = finished specific badge assets
/templates     = reusable badge-style templates and frame assets

Naming rule
-----------
achievement-<metric>-<threshold>-<tier>.png

template-<purpose>.png
frame-progressive-<tier>.png

Tier language
-------------
primal  = wood / stone / nature
gold    = gold / silver / premium
diamond = alien / crystal / futuristic

Notes
-----
- These are local-intake ready PNGs, not code-integrated unlock logic.
- Threshold meaning is documented in BADGE_INDEX.txt and achievement_asset_manifest.json.
- Background is transparent. Any faint edge halo comes from checkerboard removal on exported source art.
