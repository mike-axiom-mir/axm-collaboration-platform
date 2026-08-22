# Special Effects Notes

High-end text rarely comes from one giant glow. It usually comes from layers:

1. Sharp base fill
2. Controlled gradient or metallic fill
3. Small bevel or top highlight
4. Dark separation edge
5. Near shadow
6. Atmospheric shadow
7. Near glow
8. Far glow
9. Optional sheen sweep or sparkle

## Safe material recipes

### Molten Gold
Use for reward titles, premium labels, ceremonial buttons, and luxury highlights.

### Silver Chrome
Use for futuristic UI, launcher titles, metallic sci-fi labels, and sleek dashboards.

### Neon Metal
Use for cyberpunk HUDs, game intros, dramatic mission messages, and stylized control panels.

### Holo Prism
Use sparingly for rare loot, celebratory overlays, premium badges, or special menus.

## Guardrails
- Tiny body text should avoid heavy metallic treatment.
- If readability drops, remove sparkle first, then reduce sheen, then reduce glow.
- Always test over the worst background, not the best one.

## Readable Futuristic Glitch

Use for software intros, cyberpunk HUD labels, missions, launchers, promo headers, or highlighted system states.

Layer logic:
1. Normal readable text core
2. Thin outline or edge separation
3. Small RGB or cyan/magenta channel offsets
4. Optional subtle flicker or jitter
5. Ambient glow kept below the point where edges dissolve

Guardrails:
- Keep offsets small (usually 1–3 px for UI scale text).
- Use mostly on medium or large text.
- Never let the glitch layer replace the readable core.
- Respect reduced motion.
