THE FALLBACK SKIN — complete on purpose (vault-bootstrap step 3).
If this folder looked unfinished, the Vault would silently become a
NEED instead of a choice (DeepSeek's point, adopted). So this is a
whole identity: tokens.css (colors/typography), logo.svg, favicon.svg,
icon-tool-default.svg (card cover).
RESKINNING (Axiom/Mir — this is your door): replace these files,
KEEP THE SAME NAMES. Every UI component asks the AssetResolver by
asset id, so same-name swaps restyle the whole launcher with zero
code edits. New asset ids = add the file here + one resolver call
where it's shown.
