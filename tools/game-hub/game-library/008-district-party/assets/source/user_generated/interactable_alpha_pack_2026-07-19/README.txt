AXM DISTRICT PARTY — INTERACTABLE REAL-ALPHA ASSET PACK

This pack was made from the existing asset sheets. No new images were generated.

FOLDERS
- transparent_sheets:
  Full source sheets with a real RGBA alpha channel.
- individual_assets:
  Individually detected and tightly cropped transparent PNG sprites.
- qa_previews:
  Each transparent sheet composited on magenta and navy backgrounds.
  These previews make leftover checkerboard or edge contamination easier to see.

FILES
- MANIFEST.json:
  Machine-readable list of every output and alpha-channel measurements.
- ALPHA_QA_REPORT.txt:
  Human-readable action and QA report.

STATUS
GAMEPLAY CANDIDATE.

The checkerboard has been replaced by real transparency and transparent pixels
have had their hidden RGB cleared. The source art's original lighting and cast
shadows remain. Test scale, collisions and readability locally before promotion
through the merge gate.
